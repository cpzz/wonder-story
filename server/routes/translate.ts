import { Router } from 'express'
import { generateJSON } from '@/lib/textGeneration'
import { getStylePrompt, getStyleName } from '@/lib/illustrationStyles'
import type { Story, Guide, CharacterCard } from '@/types'

const TRANSLATE_SYSTEM_BASE = `You are a professional children's book translator and illustrator.
Rules you MUST follow:
- Translate ONLY the text values marked with "textEn": "". Do NOT add, infer, or explain anything.
- Fill in every "textEn" field with the English translation of the corresponding "text" field.
- Fill in every "imagePrompt" field with a vivid English illustration description for that page.
- Return ONLY valid JSON with the exact same structure as the input.
- Do NOT change any other fields.

Reference-image tagging (apply to every imagePrompt and cover.imagePrompt):
- The Character reference block below marks the first up to three **roster-order** characters as **[Image 1 / 图片1]**, **[Image 2 / 图片2]**, **[Image 3 / 图片3]**: **Image N = the N-th character in the cast list** (the 1st character in the list = Image 1, 2nd = Image 2, 3rd = Image 3).
- The image API later receives reference attachments **only in that same roster order**, and **only for a prefix of slots starting at the 1st character** where each slot has a generated reference (no reordering, no skipping a slot and using a later one). If fewer than three references exist, only use (image N) for slots that will actually receive an attachment.
- Whenever one of those characters appears in a scene, tag them with: **EnglishName (中文名) (image N)** or **EnglishName (中文名)（图片N）**, using the **same N** as [Image N / 图片N] in the list.
- Characters not given an [Image N] line must not use an (image N) tag; describe them by text only.

Character consistency rules (apply to every imagePrompt and cover.imagePrompt):
- Follow the roster **Character reference** exactly: each (image N) / named character is **one** species or identity as written on their card — **never** blend two roster characters or two reference images into one body (no chimera, no “half rabbit half squirrel”, no mixed ears/snouts/tails on one creature).
- If the cast lists different species (e.g. different family members), keep each character **visually separate** with **only** that character’s species features; do not merge parent and child species onto one figure.
- For a biological nuclear family in the story, prefer **one** species for all of them to reduce illustration confusion — unless the story text already establishes a deliberate multi-species family; in that case still **no hybridization**: each individual matches **only** their own card’s species.
- **Body scale lock**: each character’s size belongs to one **cast-wide** system — keep the same relative height/bulk vs. **every other** recurring character on every page and the cover (no random shrinking/growing for anyone). Adults clearly taller/bulkier than children when both appear; same-age peers similar size.
- **Cast-wide relative scale (critical)**: Across **all** pages and the cover, maintain one **consistent proportional size system** for the **entire recurring cast** — not only pairs. Whenever **any two or more** of them appear (same frame or compared across spreads), their **relative height, bulk, and who-is-larger-than-whom** must match character cards (role, age, bodyType) and reference portraits on **every** illustration — **never** shuffle the roster’s size hierarchy (e.g. if A < B < C on page 1 when together, do not paint C < A on page 4 when the same three meet). Camera angle or foreshortening must **not** overturn that cast-wide ordering unless the story explicitly describes a size-changing event.
- **Texture lock**: describe fur/feathers/skin/scales with the **same** material look as in the character sheet and reference images (do not alternate “smooth plastic doll” vs “fluffy fur” for the same character across pages).
- For each character, keep these visual axes aligned with the Character reference on every page and on the cover: overall silhouette/body shape; fur, skin, or scale colors and patterns; markings; facial features; clothing colors and style.
- **Reference fidelity for [Image N] characters**: The **reference portrait** is the **ground truth for identity only** — which body parts exist (antennae, horns, feelers, ear shape and count, tail, wings, snout, markings) and their design. Do **not** invent such features absent from the reference. The reference is **not** a pose template: do **not** imply that every page should reuse the same front-facing neutral full-body stance as the portrait.
- If the story text for a given page does NOT explicitly describe a change (e.g. costume change, visible injury, getting wet or dirty, dye, aging), you MUST NOT change colors, markings, or outfit design in that page's imagePrompt — no arbitrary recoloring or invented new looks compared to other pages. Only describe a visual change when that page's story clearly supports it.

Image quality rules (apply to every imagePrompt):
- **Scene and acting variation (required)**: Every page must read as a **different moment** — vary **pose**, **facial expression**, **body orientation**, **gesture**, **interaction with props or other characters**, and **camera framing** (e.g. wide establishing shot vs medium vs gentle close-up) according to that page’s story. **Do not** describe every illustration with the same static catalog pose or identical composition. Identity stays consistent; **action and layout change** page by page.
- **Anatomy**: normal bilateral symmetry; exactly **two** eyes, **one** mouth, **two** ears for typical mammals; **no** third eye, extra eyes, missing ear, or duplicated facial features. Do **not** mention antennae, horns, wings, or tail shape unless the character reference or story text explicitly requires them for that character.
- Describe clear, natural poses with characters in stable, grounded positions. Avoid overlapping limbs, twisted joints, or unnatural body angles.
- Keep compositions simple and uncluttered. Each character should have enough space to avoid body parts merging or intersecting.
- Do NOT describe awkward partial crops (e.g. a single floating hand with no context). Full figure or waist-up is fine; **intentional** emotional close-ups on the face are allowed when the story fits.
- Avoid describing multiple characters in tight overlapping positions that would cause clipping or body part confusion.`

const DEFAULT_STYLE = "soft watercolor, children's picture book, warm and cozy"

function buildTranslateSystem(styleId?: string): string {
  const style = getStylePrompt(styleId) ?? DEFAULT_STYLE
  return TRANSLATE_SYSTEM_BASE + `\n\nImage style for all imagePrompts: ${style}.`
}

function buildCharacterRef(characters: CharacterCard[]): string {
  if (!characters.length) return 'No specific character reference provided.'
  const max = Math.min(characters.length, 3)
  const head = characters.slice(0, max).map((c, i) => {
    const n = i + 1
    return `[Image ${n} / 图片${n}] ${c.nameEn} (${c.name}): ${c.species}, ${c.bodyType}. Face: ${c.face}. Color: ${c.color}. Outfit: ${c.outfit}. Personality: ${c.personality}. Forbidden: ${c.forbidden}.`
  })
  const tail =
    characters.length > max
      ? characters.slice(max).map(
          (c) =>
            `(no Image N tag — describe by text only) ${c.nameEn} (${c.name}): ${c.species}, ${c.bodyType}. Face: ${c.face}. Color: ${c.color}. Outfit: ${c.outfit}. Personality: ${c.personality}. Forbidden: ${c.forbidden}.`,
        )
      : []
  return [...head, ...tail].join('\n')
}

/** LLM I/O bundle：封面与正文分离，避免重复 title */
interface BundleInput {
  cover: { text: string; textEn: string; imagePrompt: string }
  story: {
    pages: { pageNumber: number; text: string; textEn: string; imagePrompt: string }[]
  }
  guide: {
    emotion: { text: string; textEn: string }
    message: { text: string; textEn: string }
    tips: { text: string; textEn: string }[]
  }
}

const router = Router()

router.post('/', async (req, res) => {
  try {
    const { story, guide, characters = [], textLang, illustrationStyleId }: {
      story: Story
      guide: Guide
      characters?: CharacterCard[]
      textLang: string
      illustrationStyleId?: string
    } = req.body

    const sortedPages = [...story.pages].sort((a, b) => a.pageNumber - b.pageNumber)
    const characterRef = buildCharacterRef(characters)

    const input: BundleInput = {
      cover: {
        text: story.cover.text,
        textEn: '',
        imagePrompt: '',
      },
      story: {
        pages: sortedPages.map((p) => ({
          pageNumber: p.pageNumber,
          text: p.text,
          textEn: '',
          imagePrompt: '',
        })),
      },
      guide: {
        emotion: { text: guide.emotion.text, textEn: '' },
        message: { text: guide.message.text, textEn: '' },
        tips: guide.tips.text.map((t) => ({ text: t, textEn: '' })),
      },
    }

    const userPrompt = `Translate all "textEn" fields to English, fill all "imagePrompt" fields (each story page and cover), and fill "cover.imagePrompt" for the book cover illustration.

Character reference (strictly follow for every imagePrompt and cover.imagePrompt). [Image N / 图片N] = N-th character in the roster (see system rules). Use matching (image N) /（图片N）tags in prompts:
${characterRef}

- Each page "imagePrompt": vivid English scene description, under 120 words. For any on-screen character who has [Image N / 图片N] above, include **EnglishName (中文名) (image N)** (same N). Follow character consistency rules in the system prompt.
- "cover.imagePrompt": under 100 words; same tagging for cover characters who have [Image N / 图片N].

Return the completed JSON only:
${JSON.stringify(input, null, 2)}`

    console.log(`[translate] calling LLM, pages: ${sortedPages.length} characters: ${characters.length} style: ${getStyleName(illustrationStyleId)}`)
    const result = await generateJSON<BundleInput>(buildTranslateSystem(illustrationStyleId), userPrompt, 'story', 8192)
    console.log(
      '[translate] LLM returned cover textEn:',
      result.cover?.textEn,
      'first page imagePrompt:',
      result.story?.pages?.[0]?.imagePrompt?.slice(0, 60),
    )

    const resultPages = [...(result.story?.pages ?? [])].sort((a, b) => a.pageNumber - b.pageNumber)

    const translatedStory: Story = {
      cover: {
        text: story.cover.text,
        textEn: result.cover?.textEn?.trim() ?? '',
        imagePrompt: result.cover?.imagePrompt?.trim() ?? '',
      },
      pages: sortedPages.map((p, i) => {
        const matched = resultPages.find((r) => r.pageNumber === p.pageNumber) ?? resultPages[i]
        return {
          ...p,
          textEn: matched?.textEn?.trim() ?? '',
          imagePrompt: matched?.imagePrompt?.trim() ?? '',
        }
      }),
    }

    const translatedGuide: Guide = {
      emotion: { text: guide.emotion.text, textEn: result.guide?.emotion?.textEn?.trim() ?? '' },
      message: { text: guide.message.text, textEn: result.guide?.message?.textEn?.trim() ?? '' },
      tips: {
        text: guide.tips.text,
        textEn: guide.tips.text.map((_, i) => result.guide?.tips?.[i]?.textEn?.trim() ?? ''),
      },
    }

    console.log(
      `[translate] story: cover imagePrompt=${!!translatedStory.cover.imagePrompt}, pages=${translatedStory.pages.length}, emptyPrompts=${translatedStory.pages.filter((p) => !p.imagePrompt).length}`,
    )

    // 始终返回完整的双语数据，不因 UI 语言而清空任何字段
    res.json({ story: translatedStory, guide: translatedGuide })
  } catch (err) {
    console.error('[POST /api/translate]', err)
    res.status(500).json({ error: '翻译失败，请检查 LLM 配置' })
  }
})

export default router
