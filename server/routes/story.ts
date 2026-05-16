import { Router } from 'express'
import { generateJSON } from '@/lib/llm'
import { getPromptByType } from '@/lib/promptStore'
import { fillTemplate } from '@/lib/templateUtils'
import { DEFAULT_STORY_TEMPLATE, DEFAULT_BEDTIME_STORY_TEMPLATE, getLocalizedNameAndPrompts } from '@/lib/defaultPrompts'
import { buildProtagonistPromptSuffix } from '@/lib/protagonistPresets'
import type { TroubleInput, Story, CharacterCard, UILang } from '@/types'

// LLM now returns characters + story in one response
interface StoryRaw {
  characters?: CharacterCard[]
  title: string
  pages: { pageNumber: number; text: string }[]
}

function wrapStory(raw: StoryRaw): { characters: CharacterCard[]; story: Story } {
  return {
    characters: raw.characters ?? [],
    story: { cover: { text: raw.title }, pages: raw.pages },
  }
}

const router = Router()

router.post('/', async (req, res) => {
  try {
    const { emotion, scene, ageGroup, description = '', mode = 'emotion', theme = '', protagonistPreset, textLang = 'bilingual', uiLang = 'zh' }: TroubleInput & { uiLang?: UILang } =
      req.body
    const lang: UILang = uiLang ?? 'zh'
    if (!ageGroup) {
      return res.status(400).json({ error: lang === 'en' ? 'Missing required field: ageGroup' : '缺少必填字段: ageGroup' })
    }
    if (mode === 'bedtime') {
      const themeHint = theme
        ? (lang === 'en' ? `Story theme preference: ${theme}.` : `故事主题偏好：${theme}。`)
        : ''
      const descHint = description
        ? (lang === 'en' ? `Extra requirements: ${description}` : `额外要求：${description}`)
        : ''
      const baseTemplate = getPromptByType('bedtime-story') ?? { ...DEFAULT_BEDTIME_STORY_TEMPLATE, id: 'default' }
      const localized = getLocalizedNameAndPrompts('bedtime-story', lang)
      const systemPrompt = localized.systemPrompt
      const userPromptTemplate = localized.userPromptTemplate
      console.log(`[story] bedtime mode, ageGroup=${ageGroup}, theme=${theme}, uiLang=${lang}`)
      const userPrompt =
        fillTemplate(userPromptTemplate, { ageGroup, theme: themeHint, description: descHint }) +
        buildProtagonistPromptSuffix(protagonistPreset, lang)
      const raw = await generateJSON<StoryRaw>(systemPrompt, userPrompt, 'story', 8192)
      console.log(`[story] bedtime story done: title=${raw.title}, chars=${raw.characters?.length}, pages=${raw.pages?.length}`)
      return res.json(wrapStory(raw))
    }
    if (!emotion || !scene) {
      return res.status(400).json({ error: lang === 'en' ? 'Missing required fields: emotion, scene' : '缺少必填字段: emotion, scene' })
    }
    const baseTemplate = getPromptByType('story') ?? { ...DEFAULT_STORY_TEMPLATE, id: 'default' }
    const localized = getLocalizedNameAndPrompts('story', lang)
    const systemPrompt = localized.systemPrompt
    const userPromptTemplate = localized.userPromptTemplate
    const descHint = description
      ? (lang === 'en' ? `Extra requirements: ${description}` : `额外要求：${description}`)
      : ''
    console.log(`[story] emotion mode, emotion=${emotion}, scene=${scene}, ageGroup=${ageGroup}, uiLang=${lang}`)
    const userPrompt =
      fillTemplate(userPromptTemplate, { emotion, scene, ageGroup, description: descHint }) +
      buildProtagonistPromptSuffix(protagonistPreset, lang)
    const raw = await generateJSON<StoryRaw>(systemPrompt, userPrompt, 'story', 8192)
    console.log(`[story] emotion story done: title=${raw.title}, chars=${raw.characters?.length}, pages=${raw.pages?.length}`)
    res.json(wrapStory(raw))
  } catch (err) {
    console.error('[POST /api/story]', err)
    res.status(500).json({ error: '生成故事失败，请检查 LLM 配置' })
  }
})

export default router
