import { Router } from 'express'
import { generateJSON } from '@/lib/textGeneration'
import { getStylePrompt, getStyleName } from '@/lib/illustrationStyles'
import { LANGUAGES, LANG_BY_CODE, LANG_CODES, type LangCode } from '@/lib/languages'
import type { Story, Guide, CharacterCard } from '@/types'

const DEFAULT_STYLE = "soft watercolor, children's picture book, warm and cozy"

/** 单一 LocalizedValue 的扁平化 JSON 形态。键随 LangCode 动态生成。 */
type LocalizedJSON = {
  text: string
  [key: `text${string}`]: string
}

/** 数据字段名 → LangCode 的映射（zh 特殊为 'text'，其它为 `text${fieldSuffix}`） */
function langFieldFor(code: LangCode): keyof LocalizedJSON {
  if (code === 'zh') return 'text'
  return `text${LANG_BY_CODE[code].fieldSuffix}` as keyof LocalizedJSON
}

/** 取 LangCode 对应的目标语言英文描述（用于 system prompt） */
function targetListItem(c: LangCode): string {
  return `${LANG_BY_CODE[c].translateName} (${langFieldFor(c)})`
}

/** 翻译批次 I/O：只含文本字段（不含 imagePrompt） */
interface TranslateBundle {
  cover: LocalizedJSON
  story: {
    pages: ({ pageNumber: number } & LocalizedJSON)[]
  }
  guide: {
    emotion: LocalizedJSON
    message: LocalizedJSON
    tips: LocalizedJSON[]
  }
}

/** imagePrompt 批次 I/O */
interface ImagePromptBundle {
  cover: { imagePrompt: string }
  story: {
    pages: ({ pageNumber: number; imagePrompt: string })[]
  }
}

/** 从 story 中提取中文源文本（始终基于 text 字段） */
function extractSourceText(
  story: Story,
  guide: Guide,
): {
  coverText: string
  pageTexts: { pageNumber: number; text: string }[]
  guideEmotion: string
  guideMessage: string
  guideTips: string[]
} {
  const getStr = (obj: Record<string, any> | undefined): string => {
    return (obj?.text || '').toString().trim()
  }
  const getArr = (obj: Record<string, any> | undefined, len: number): string[] => {
    const arr = obj?.text
    if (Array.isArray(arr) && arr.length === len) return arr.map((s) => s.toString().trim())
    return obj?.text || []
  }

  return {
    coverText: getStr(story.cover),
    pageTexts: [...story.pages]
      .sort((a, b) => a.pageNumber - b.pageNumber)
      .map((p) => ({ pageNumber: p.pageNumber, text: getStr(p) })),
    guideEmotion: getStr(guide.emotion),
    guideMessage: getStr(guide.message),
    guideTips: getArr(guide.tips, guide.tips?.text?.length || 0),
  }
}

/** 构建仅包含源文本 + 目标语言空字段的输入 */
function buildTranslateInput(
  sourceTexts: { coverText: string; pageTexts: { pageNumber: number; text: string }[]; guideEmotion: string; guideMessage: string; guideTips: string[] },
  batchLangs: LangCode[],
): TranslateBundle {
  const batchFields = (text: string): LocalizedJSON => {
    const out: LocalizedJSON = { text }
    for (const c of batchLangs) {
      ;(out as Record<string, string>)[langFieldFor(c)] = ''
    }
    return out
  }

  return {
    cover: batchFields(sourceTexts.coverText),
    story: {
      pages: sourceTexts.pageTexts.map((p) => ({
        pageNumber: p.pageNumber,
        ...batchFields(p.text),
      })),
    },
    guide: {
      emotion: batchFields(sourceTexts.guideEmotion),
      message: batchFields(sourceTexts.guideMessage),
      tips: sourceTexts.guideTips.map((t) => batchFields(t)),
    },
  }
}

/** 构建 imagePrompt 输入（只有源文本，imagePrompt 为空） */
function buildImagePromptInput(
  sourceTexts: { coverText: string; pageTexts: { pageNumber: number; text: string }[] },
): ImagePromptBundle {
  return {
    cover: { imagePrompt: '' },
    story: {
      pages: sourceTexts.pageTexts.map((p) => ({
        pageNumber: p.pageNumber,
        imagePrompt: '',
      })),
    },
  }
}

/** 根据目标语言动态生成 system prompt 的"目标语言"段落 */
function buildTranslateRules(targetLangs: LangCode[]): string {
  if (targetLangs.length === 0) {
    return `- The source text is in Chinese (field "text"). Leave ALL other textXxx fields empty.`
  }
  const fillList = targetLangs.map((c) => `${LANG_BY_CODE[c].translateName} (${langFieldFor(c)})`).join(', ')
  return `- The source text is in Chinese (field "text"). Translate it into the following target languages ONLY: ${fillList}.
  - Keep translations short, natural, and warm, suitable for ages 2-10 reading aloud.`
}

/** imagePrompt 生成的 system prompt */
function buildImagePromptSystem(styleId?: string): string {
  const style = getStylePrompt(styleId) ?? DEFAULT_STYLE
  return `You are a professional children's book illustrator.
Rules you MUST follow:
- Read the source text for each page (in "text" field) and write a vivid English illustration description in the "imagePrompt" field.
- The imagePrompt should be in English, since it feeds an English image-generation model.
- Return ONLY valid JSON with the exact same structure as the input (no extra keys, no missing keys).

Reference-image tagging (apply to every imagePrompt and cover.imagePrompt):
- The Character reference block below marks the first up to three **roster-order** characters as **[Image 1 / 图片1]**, **[Image 2 / 图片2]**, **[Image 3 / 图片3]**: **Image N = the N-th character in the cast list** (the 1st character in the list = Image 1, 2nd = Image 2, 3rd = Image 3).
- The image API later receives reference attachments **only in that same roster order**, and **only for a prefix of slots starting at the 1st character** where each slot has a generated reference (no reordering, no skipping a slot and using a later one). If fewer than three references exist, only use (image N) for slots that will actually receive an attachment.
- Whenever one of those characters appears in a scene, tag them with: **EnglishName (中文名) (image N)** or **EnglishName (中文名)（图片N）**, using the **same N** as [Image N / 图片N] in the list.
- Characters not given an [Image N] line must not use an (image N) tag; describe them by text only.

Character consistency rules (apply to every imagePrompt and cover.imagePrompt):
- Follow the roster **Character reference** exactly: each (image N) / named character is **one** species or identity as written on their card — **never** blend two roster characters or two reference images into one body (no chimera, no "half rabbit half squirrel", no mixed ears/snouts/tails on one creature).
- If the cast lists different species (e.g. different family members), keep each character **visually separate** with **only** that character's species features; do not merge parent and child species onto one figure.
- For a biological nuclear family in the story, prefer **one** species for all of them to reduce illustration confusion — unless the story text already establishes a deliberate multi-species family; in that case still **no hybridization**: each individual matches **only** their own card's species.
- **Body scale lock**: each character's size belongs to one **cast-wide** system — keep the same relative height/bulk vs. **every other** recurring character on every page and the cover (no random shrinking/growing for anyone). Adults clearly taller/bulkier than children when both appear; same-age peers similar size.
- **Cast-wide relative scale (critical)**: Across **all** pages and the cover, maintain one **consistent proportional size system** for the **entire recurring cast** — not only pairs. Whenever **any two or more** of them appear (same frame or compared across spreads), their **relative height, bulk, and who-is-larger-than-whom** must match character cards (role, age, bodyType) and reference portraits on **every** illustration — **never** shuffle the roster's size hierarchy (e.g. if A < B < C on page 1 when together, do not paint C < A on page 4 when the same three meet). Camera angle or foreshortening must **not** overturn that cast-wide ordering unless the story explicitly describes a size-changing event.
- **Texture lock**: describe fur/feathers/skin/scales with the **same** material look as in the character sheet and reference images (do not alternate "smooth plastic doll" vs "fluffy fur" for the same character across pages).
- For each character, keep these visual axes aligned with the Character reference on every page and on the cover: overall silhouette/body shape; fur, skin, or scale colors and patterns; markings; facial features; clothing colors and style.
- **Reference fidelity for [Image N] characters**: The **reference portrait** is the **ground truth for identity only** — which body parts exist (antennae, horns, feelers, ear shape and count, tail, wings, snout, markings) and their design. Do **not** invent such features absent from the reference. The reference is **not** a pose template: do **not** imply that every page should reuse the same front-facing neutral full-body stance as the portrait.
- If the story text for a given page does NOT explicitly describe a change (e.g. costume change, visible injury, getting wet or dirty, dye, aging), you MUST NOT change colors, markings, or outfit design in that page's imagePrompt — no arbitrary recoloring or invented new looks compared to other pages. Only describe a visual change when that page's story clearly supports it.

Image quality rules (apply to every imagePrompt):
- **Scene and acting variation (required)**: Every page must read as a **different moment** — vary **pose**, **facial expression**, **body orientation**, **gesture**, **interaction with props or other characters**, and **camera framing** (e.g. wide establishing shot vs medium vs gentle close-up) according to that page's story. **Do not** describe every illustration with the same static catalog pose or identical composition. Identity stays consistent; **action and layout change** page by page.
- **Anatomy**: normal bilateral symmetry; exactly **two** eyes, **one** mouth, **two** ears for typical mammals; **no** third eye, extra eyes, missing ear, or duplicated facial features. Do **not** mention antennae, horns, wings, or tail shape unless the character reference or story text explicitly requires them for that character.
- Describe clear, natural poses with characters in stable, grounded positions. Avoid overlapping limbs, twisted joints, or unnatural body angles.
- Keep compositions simple and uncluttered. Each character should have enough space to avoid body parts merging or intersecting.
- Do NOT describe awkward partial crops (e.g. a single floating hand with no context). Full figure or waist-up is fine; **intentional** emotional close-ups on the face are allowed when the story fits.
- Avoid describing multiple characters in tight overlapping positions that would cause clipping or body part confusion.

Safety & compliance rules (apply to every imagePrompt):
- **Power dynamics**: NEVER use "towers over", "dominates", "looms over", "authority", "commands", or any language implying power imbalance or oppression between characters. Describe interactions as gentle companionship, standing side-by-side, eye-level warmth.
- **Body pressure**: NEVER use size differences to create a sense of threat, oppression, or intimidation — even when the story intends a comforting/safe atmosphere.
- **Gaze direction**: NEVER use "gazing down at", "stares down", "looks down upon" or similar俯视 gaze descriptions. Use "looks at gently", "smiles warmly toward", "meets eyes with".
- **Physical contact**: NEVER describe embracing, pinning, binding, or other physical interactions that may be mis-flagged by content filters. Use "sits beside", "walks together", "shares a glance" as safe alternatives.

Vocabulary & compliance rules (apply to every imagePrompt):
- **Tentacles** -> use 'flowing ribbons' or 'graceful trailing arms' instead. The word "tentacles" is highly likely to be flagged by content filters.
- **No negation descriptions** -> NEVER use "no X" or "without X" to describe what is absent (e.g. "no hard shell or pupils"). Only describe what IS present positively. Example: instead of "no pupils" write "soft glowing eyes with a gentle light".
- **Avoid sensitive body-part words** -> Do not use "claws", "fangs", "sharp teeth", "blood", "wounds". Use "small paws", "tiny teeth", "gentle smile" instead.

Image style for all imagePrompts: ${style}.`
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

const router = Router()

router.post('/', async (req, res) => {
  try {
    const { story, guide, characters = [], textLang, illustrationStyleId, bookLangs }: {
      story: Story
      guide: Guide
      characters?: CharacterCard[]
      textLang: string
      illustrationStyleId?: string
      bookLangs?: LangCode[]
    } = req.body

    const sourceLang: LangCode = 'zh' // 源文始终为中文
    console.log(`[translate] sourceLang=${sourceLang}, bookLangs=${bookLangs?.join(',') || '(all)'}`)

    // 目标语言 = bookLangs 中除中文外的所有语言
    const effectiveBookLangs: LangCode[] = (() => {
      const requested = (bookLangs && bookLangs.length > 0 ? bookLangs : LANG_CODES.filter((c) => c !== 'zh'))
      return LANG_CODES.filter((c) => requested.includes(c))
    })()

    const targetLangs = effectiveBookLangs.filter((c) => c !== 'zh')
    const skippedLangs = LANG_CODES.filter((c) => c !== 'zh' && !targetLangs.includes(c))

    // 提取中文源文本
    const sourceTexts = extractSourceText(story, guide)
    const characterRef = buildCharacterRef(characters)

    /** 把目标语言每 2 个切一批 */
    const langBatches: LangCode[][] = []
    for (let i = 0; i < targetLangs.length; i += 2) {
      langBatches.push(targetLangs.slice(i, i + 2))
    }

    // ── 步骤 1：按批次翻译文本（每批 2 种语言，并发执行） ──
    const pickField = (r: any, code: LangCode): string => {
      const key = langFieldFor(code)
      return (r?.[key] ?? '').toString().trim()
    }

    const translateBatch = async (batch: LangCode[]): Promise<Record<string, Record<LangCode, string>>> => {
      const fieldList = batch.map(langFieldFor).join(' / ')
      const skipClause = skippedLangs.length > 0
        ? `Leave any ${skippedLangs.map((c) => `${langFieldFor(c)} (=${LANG_BY_CODE[c].translateName})`).join(', ')} blank (empty string).`
        : `No languages are skipped — fill every non-"text" field.`

      const input = buildTranslateInput(sourceTexts, batch)

      const userPrompt = `Translate the source text (in "text" field, in Chinese) into: ${batch.map(targetListItem).join(', ')}.
${skipClause}
Fill in the matching ${fieldList} fields.

Return the completed JSON only:
${JSON.stringify(input, null, 2)}`

      console.log(`[translate] translating ${batch.join('+')} ...`)
      const result = await generateJSON<TranslateBundle>(
        buildTranslateRules(batch),
        userPrompt,
        'story',
        8192,
      )

      const out: Record<string, Record<LangCode, string>> = {}

      // 封面
      out['cover'] = {}
      for (const c of batch) {
        out['cover'][c] = pickField(result.cover, c)
      }

      // 正文页
      const resultPages = [...(result.story?.pages ?? [])].sort((a, b) => a.pageNumber - b.pageNumber)
      for (const page of sourceTexts.pageTexts) {
        const matched = resultPages.find((r) => r.pageNumber === page.pageNumber)
        if (matched) {
          const key = `page.${page.pageNumber}`
          out[key] = {}
          for (const c of batch) {
            out[key][c] = pickField(matched, c)
          }
        }
      }

      // 引导页
      for (const section of ['emotion', 'message'] as const) {
        const key = `guide.${section}`
        out[key] = {}
        for (const c of batch) {
          out[key][c] = pickField(result.guide?.[section], c)
        }
      }
      for (let ti = 0; ti < sourceTexts.guideTips.length; ti++) {
        const key = `tips.${ti}`
        out[key] = {}
        for (const c of batch) {
          out[key][c] = pickField(result.guide?.tips?.[ti], c)
        }
      }

      return out
    }

    // ── 步骤 2：生成 imagePrompt（与翻译并发执行） ──
    const generateImagePrompts = async (): Promise<{ coverImagePrompt: string; pageImagePrompts: Record<number, string> }> => {
      const ipInput = buildImagePromptInput(sourceTexts)
      const ipPrompt = `Read the source text (in "text" field, in Chinese) for each page and fill in "imagePrompt" for the cover and every story page.
- "text" is the Chinese source text.
- "imagePrompt" must be in English (for image generation).
- Each page "imagePrompt": vivid English scene description, under 120 words.
- "cover.imagePrompt": under 100 words.
- For any on-screen character who has [Image N / 图片N] in the Character reference below, include **EnglishName (中文名) (image N)** (same N).

Character reference:\n${characterRef}

Return the completed JSON only:
${JSON.stringify(ipInput, null, 2)}`

      console.log('[translate] generating imagePrompts...')
      const ipResult = await generateJSON<ImagePromptBundle>(
        buildImagePromptSystem(illustrationStyleId),
        ipPrompt,
        'story',
        4096,
      )

      const coverImg = (ipResult.cover?.imagePrompt ?? '').toString().trim()
      const pageImgs: Record<number, string> = {}
      for (const p of ipResult.story?.pages ?? []) {
        pageImgs[p.pageNumber] = (p.imagePrompt ?? '').toString().trim()
      }
      console.log(`[translate] imagePrompts: cover=${!!coverImg}, pages=${Object.keys(pageImgs).length}`)
      return { coverImagePrompt: coverImg, pageImagePrompts: pageImgs }
    }

    // 翻译和 imagePrompt 并发执行
    const [batchResults, imageResult] = await Promise.all([
      Promise.all(langBatches.map(translateBatch)),
      generateImagePrompts(),
    ])

    // 合并所有翻译批次结果
    const allTranslations: Record<string, Record<LangCode, string>> = {}
    for (const batch of batchResults) {
      for (const [key, langMap] of Object.entries(batch)) {
        allTranslations[key] = { ...allTranslations[key], ...langMap }
      }
    }

    const { coverImagePrompt, pageImagePrompts } = imageResult

    // ── 合并所有结果 ──
    const translatedStory: Story = {
      cover: {
        ...story.cover,
        text: sourceTexts.coverText, // 确保中文源文正确
        ...Object.fromEntries(targetLangs.map((c) => [langFieldFor(c), allTranslations['cover']?.[c] ?? ''])),
        imagePrompt: coverImagePrompt,
      } as Story['cover'],
      pages: sourceTexts.pageTexts.map((p) => ({
        pageNumber: p.pageNumber,
        imagePrompt: pageImagePrompts[p.pageNumber] || '',
        text: p.text, // 确保中文源文正确
        ...Object.fromEntries(targetLangs.map((c) => [langFieldFor(c), allTranslations[`page.${p.pageNumber}`]?.[c] ?? ''])),
      })) as Story['pages'],
    }

    const translatedGuide: Guide = {
      emotion: {
        ...guide.emotion,
        text: sourceTexts.guideEmotion,
        ...Object.fromEntries(targetLangs.map((c) => [langFieldFor(c), allTranslations['guide.emotion']?.[c] ?? ''])),
      } as Guide['emotion'],
      message: {
        ...guide.message,
        text: sourceTexts.guideMessage,
        ...Object.fromEntries(targetLangs.map((c) => [langFieldFor(c), allTranslations['guide.message']?.[c] ?? ''])),
      } as Guide['message'],
      tips: {
        ...guide.tips,
        text: sourceTexts.guideTips,
        ...Object.fromEntries(targetLangs.map((c) => [langFieldFor(c), sourceTexts.guideTips.map((_, i) => allTranslations[`tips.${i}`]?.[c] ?? '')])),
      } as Guide['tips'],
    }

    console.log(
      `[translate] done: cover imagePrompt=${!!translatedStory.cover.imagePrompt}, pages=${translatedStory.pages.length}, emptyPrompts=${translatedStory.pages.filter((p) => !p.imagePrompt).length}, translationBatches=${langBatches.length}`,
    )

    res.json({ story: translatedStory, guide: translatedGuide })
  } catch (err) {
    console.error('[POST /api/translate]', err)
    res.status(500).json({ error: '翻译失败，请检查 LLM 配置' })
  }
})

export default router
