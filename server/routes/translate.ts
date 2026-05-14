import { Router } from 'express'
import { generateJSON } from '@/lib/llm'
import { fillTemplate } from '@/lib/templateUtils'
import { getStylePrompt, getStyleName } from '@/lib/illustrationStyles'
import type { Story, Guide, PictureBook, PictureBookPage, CharacterCard } from '@/types'

const TRANSLATE_SYSTEM_BASE = `You are a professional children's book translator and illustrator.
Rules you MUST follow:
- Translate ONLY the text values marked with "textEn": "". Do NOT add, infer, or explain anything.
- Fill in every "textEn" field with the English translation of the corresponding "text" field.
- Fill in every "imagePrompt" field with a vivid English illustration description for that page.
- Return ONLY valid JSON with the exact same structure as the input.
- Do NOT change any other fields.

Character consistency rules (apply to every imagePrompt):
- Family members (parents, children, siblings) MUST be the same type of being: if the protagonist is human, the whole family is human; if the protagonist is an animal, the whole family is the same species. Never mix species within a family.
- Character sizes must be realistic and consistent throughout: adults are clearly larger than children, same-age characters have similar proportions. Never let a character appear abnormally large or small across pages.
- Each character's appearance (species, fur/skin color, outfit) must be identical across every page.

Image quality rules (apply to every imagePrompt):
- Describe clear, natural poses with characters in stable, grounded positions. Avoid overlapping limbs, twisted joints, or unnatural body angles.
- Keep compositions simple and uncluttered. Each character should have enough space to avoid body parts merging or intersecting.
- Do NOT describe partial or cropped body parts — if a character appears, describe their full figure or at minimum from the waist up with both arms visible.
- Avoid describing multiple characters in tight overlapping positions that would cause clipping or body part confusion.`

const DEFAULT_STYLE = "soft watercolor, children's picture book, warm and cozy"

function buildTranslateSystem(styleId?: string): string {
  const style = getStylePrompt(styleId) ?? DEFAULT_STYLE
  return TRANSLATE_SYSTEM_BASE + `\n\nImage style for all imagePrompts: ${style}.`
}

// Build character reference string for imagePrompt generation
function buildCharacterRef(characters: CharacterCard[]): string {
  if (!characters.length) return 'No specific character reference provided.'
  return characters.map((c) =>
    `- ${c.nameEn} (${c.name}): ${c.species}, ${c.bodyType}. Face: ${c.face}. Color: ${c.color}. Outfit: ${c.outfit}. Personality: ${c.personality}. Forbidden: ${c.forbidden}.`
  ).join('\n')
}

interface BundleInput {
  cover: { title: string; coverPrompt: string }
  story: {
    title: { text: string; textEn: string }
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
      story: Story; guide: Guide; characters?: CharacterCard[]; textLang: string; illustrationStyleId?: string
    } = req.body

    const sortedPages = [...story.pages].sort((a, b) => a.pageNumber - b.pageNumber)
    const characterRef = buildCharacterRef(characters)

    // Build imagePrompt placeholder per page (LLM will fill them)
    const input: BundleInput = {
      cover: {
        title: story.title.text,
        coverPrompt: '',  // LLM fills: book cover illustration
      },
      story: {
        title: { text: story.title.text, textEn: '' },
        pages: sortedPages.map((p) => ({
          pageNumber: p.pageNumber,
          text: p.text,
          textEn: '',
          imagePrompt: '',  // LLM fills this
        })),
      },
      guide: {
        emotion: { text: guide.emotion.text, textEn: '' },
        message: { text: guide.message.text, textEn: '' },
        tips: guide.tips.text.map((t) => ({ text: t, textEn: '' })),
      },
    }

    const userPrompt = `Translate all "textEn" fields to English, fill all "imagePrompt" fields, and fill the "cover.coverPrompt" field.

Character reference (strictly follow for every imagePrompt):
${characterRef}

- Each page "imagePrompt": vivid scene description showing characters and action, under 120 words.
- "cover.coverPrompt": eye-catching book cover illustration featuring the main character(s) in a key scene, conveying the story's mood. Under 100 words.

Return the completed JSON only:
${JSON.stringify(input, null, 2)}`

    console.log(`[translate] calling LLM, pages: ${sortedPages.length} characters: ${characters.length} style: ${getStyleName(illustrationStyleId)}`)
    const result = await generateJSON<BundleInput>(buildTranslateSystem(illustrationStyleId), userPrompt, 'story', 8192)
    console.log('[translate] LLM returned title textEn:', result.story?.title?.textEn, 'first imagePrompt:', result.story?.pages?.[0]?.imagePrompt?.slice(0, 60))

    const resultPages = [...(result.story?.pages ?? [])].sort((a, b) => a.pageNumber - b.pageNumber)

    const translatedStory: Story = {
      title: { text: story.title.text, textEn: result.story?.title?.textEn?.trim() ?? '' },
      pages: sortedPages.map((p, i) => ({
        ...p,
        textEn:
          resultPages.find((r) => r.pageNumber === p.pageNumber)?.textEn?.trim()
          ?? resultPages[i]?.textEn?.trim()
          ?? '',
      })),
    }

    const translatedGuide: Guide = {
      emotion: { text: guide.emotion.text, textEn: result.guide?.emotion?.textEn?.trim() ?? '' },
      message: { text: guide.message.text, textEn: result.guide?.message?.textEn?.trim() ?? '' },
      tips: {
        text: guide.tips.text,
        textEn: guide.tips.text.map((_, i) => result.guide?.tips?.[i]?.textEn?.trim() ?? ''),
      },
    }

    // Build pictureBook from translated pages + imagePrompts
    const pictureBookPages: PictureBookPage[] = sortedPages.map((p, i) => {
      const matched = resultPages.find((r) => r.pageNumber === p.pageNumber) ?? resultPages[i]
      return {
        pageNumber: p.pageNumber,
        text: p.text,
        textEn: translatedStory.pages.find((tp) => tp.pageNumber === p.pageNumber)?.textEn ?? '',
        imagePrompt: matched?.imagePrompt?.trim() ?? '',
      }
    })
    const pictureBook: PictureBook = {
      title: story.title,
      coverPrompt: result.cover?.coverPrompt?.trim() ?? '',
      pages: pictureBookPages,
    }
    console.log(`[translate] pictureBook: coverPrompt=${!!pictureBook.coverPrompt}, pages=${pictureBook.pages.length}, emptyPrompts=${pictureBook.pages.filter(p => !p.imagePrompt).length}`)

    if (textLang === 'en') {
      return res.json({
        story: {
          title: { text: '', textEn: translatedStory.title.textEn },
          pages: translatedStory.pages.map((p) => ({ ...p, text: '', textEn: p.textEn })),
        } as Story,
        guide: {
          emotion: { text: '', textEn: translatedGuide.emotion.textEn },
          message: { text: '', textEn: translatedGuide.message.textEn },
          tips: { text: [], textEn: translatedGuide.tips.textEn },
        } as Guide,
        pictureBook: {
          ...pictureBook,
          pages: pictureBook.pages.map((p) => ({ ...p, text: '', textEn: p.textEn })),
        } as PictureBook,
      })
    }

    res.json({ story: translatedStory, guide: translatedGuide, pictureBook })
  } catch (err) {
    console.error('[POST /api/translate]', err)
    res.status(500).json({ error: '翻译失败，请检查 LLM 配置' })
  }
})

export default router
