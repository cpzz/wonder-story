import { Router } from 'express'
import { generateJSON } from '@/lib/llm'
import type { Story, Guide } from '@/types'

const TRANSLATE_SYSTEM = `You are a professional children's book translator.
Rules you MUST follow:
- Translate ONLY the text values provided. Do NOT add, infer, or explain anything.
- Fill in every "textEn" field with the English translation of the corresponding "text" field.
- Return ONLY valid JSON with the exact same structure as the input.
- Do NOT change any other fields.`

interface BundleInput {
  story: {
    title: { text: string; textEn: string }
    pages: { pageNumber: number; text: string; textEn: string }[]
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
    const { story, guide, textLang }: { story: Story; guide: Guide; textLang: string } = req.body

    const sortedPages = [...story.pages].sort((a, b) => a.pageNumber - b.pageNumber)

    const input: BundleInput = {
      story: {
        title: { text: story.title.text, textEn: '' },
        pages: sortedPages.map((p) => ({ pageNumber: p.pageNumber, text: p.text, textEn: '' })),
      },
      guide: {
        emotion: { text: guide.emotion.text, textEn: '' },
        message: { text: guide.message.text, textEn: '' },
        tips: guide.tips.text.map((t) => ({ text: t, textEn: '' })),
      },
    }

    console.log('[translate] calling LLM with input pages:', input.story.pages.length, 'tips:', input.guide.tips.length)
    const result = await generateJSON<BundleInput>(
      TRANSLATE_SYSTEM,
      `Fill every "textEn" field with the English translation of the corresponding "text" field. Return the completed JSON only:\n${JSON.stringify(input, null, 2)}`,
      'story',
      8192,
    )
    console.log('[translate] LLM returned story title textEn:', result.story?.title?.textEn, 'first page textEn:', result.story?.pages?.[0]?.textEn)

    // Merge story translations (match by pageNumber, fallback to positional)
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

    // Merge guide translations
    const translatedGuide: Guide = {
      emotion: { text: guide.emotion.text, textEn: result.guide?.emotion?.textEn?.trim() ?? '' },
      message: { text: guide.message.text, textEn: result.guide?.message?.textEn?.trim() ?? '' },
      tips: {
        text: guide.tips.text,
        textEn: guide.tips.text.map((_, i) => result.guide?.tips?.[i]?.textEn?.trim() ?? ''),
      },
    }

    // For en-only: swap text→textEn (text becomes empty, textEn holds the content)
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
      })
    }

    res.json({ story: translatedStory, guide: translatedGuide })
  } catch (err) {
    console.error('[POST /api/translate]', err)
    res.status(500).json({ error: '翻译失败，请检查 LLM 配置' })
  }
})

export default router
