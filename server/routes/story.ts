import { Router } from 'express'
import { generateJSON } from '@/lib/llm'
import { getPromptByType } from '@/lib/promptStore'
import { fillTemplate } from '@/lib/templateUtils'
import { DEFAULT_STORY_TEMPLATE, DEFAULT_BEDTIME_STORY_TEMPLATE } from '@/lib/defaultPrompts'
import { buildProtagonistPromptSuffix } from '@/lib/protagonistPresets'
import type { TroubleInput, Story, CharacterCard } from '@/types'

// LLM now returns characters + story in one response
interface StoryRaw {
  characters?: CharacterCard[]
  title: string
  pages: { pageNumber: number; text: string }[]
}

function wrapStory(raw: StoryRaw): { characters: CharacterCard[]; story: Story } {
  return {
    characters: raw.characters ?? [],
    story: { title: { text: raw.title }, pages: raw.pages },
  }
}

const router = Router()

router.post('/', async (req, res) => {
  try {
    const { emotion, scene, ageGroup, description = '', mode = 'emotion', theme = '', protagonistPreset }: TroubleInput =
      req.body
    if (!ageGroup) {
      return res.status(400).json({ error: '缺少必填字段: ageGroup' })
    }
    if (mode === 'bedtime') {
      const themeHint = theme ? `故事主题偏好：${theme}。` : ''
      const descHint = description ? `额外要求：${description}` : ''
      const template = getPromptByType('bedtime-story') ?? { ...DEFAULT_BEDTIME_STORY_TEMPLATE, id: 'default' }
      console.log(`[story] bedtime mode, ageGroup=${ageGroup}, theme=${theme}`)
      const userPrompt =
        fillTemplate(template.userPromptTemplate, { ageGroup, theme: themeHint, description: descHint }) +
        buildProtagonistPromptSuffix(protagonistPreset)
      const raw = await generateJSON<StoryRaw>(template.systemPrompt, userPrompt, 'story', 8192)
      console.log(`[story] bedtime story done: title=${raw.title}, chars=${raw.characters?.length}, pages=${raw.pages?.length}`)
      return res.json(wrapStory(raw))
    }
    if (!emotion || !scene) {
      return res.status(400).json({ error: '缺少必填字段: emotion, scene' })
    }
    const template = getPromptByType('story') ?? { ...DEFAULT_STORY_TEMPLATE, id: 'default' }
    const descHint = description ? `额外要求：${description}` : ''
    console.log(`[story] emotion mode, emotion=${emotion}, scene=${scene}, ageGroup=${ageGroup}`)
    const userPrompt =
      fillTemplate(template.userPromptTemplate, { emotion, scene, ageGroup, description: descHint }) +
      buildProtagonistPromptSuffix(protagonistPreset)
    const raw = await generateJSON<StoryRaw>(template.systemPrompt, userPrompt, 'story', 8192)
    console.log(`[story] emotion story done: title=${raw.title}, chars=${raw.characters?.length}, pages=${raw.pages?.length}`)
    res.json(wrapStory(raw))
  } catch (err) {
    console.error('[POST /api/story]', err)
    res.status(500).json({ error: '生成故事失败，请检查 LLM 配置' })
  }
})

export default router
