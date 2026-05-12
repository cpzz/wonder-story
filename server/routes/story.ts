import { Router } from 'express'
import { generateJSON } from '@/lib/llm'
import { getPromptByType } from '@/lib/promptStore'
import { fillTemplate } from '@/lib/templateUtils'
import { DEFAULT_STORY_TEMPLATE, DEFAULT_BEDTIME_STORY_TEMPLATE } from '@/lib/defaultPrompts'
import type { TroubleInput, Story } from '@/types'

const router = Router()

router.post('/', async (req, res) => {
  try {
    const { emotion, scene, ageGroup, description = '', mode = 'emotion', theme = '' }: TroubleInput = req.body
    if (!ageGroup) {
      return res.status(400).json({ error: '缺少必填字段: ageGroup' })
    }
    if (mode === 'bedtime') {
      const themeHint = theme ? `故事主题偏好：${theme}。` : ''
      const descHint = description ? `额外要求：${description}` : ''
      const template = getPromptByType('bedtime-story') ?? { ...DEFAULT_BEDTIME_STORY_TEMPLATE, id: 'default' }
      const story = await generateJSON<Story>(
        template.systemPrompt,
        fillTemplate(template.userPromptTemplate, { ageGroup, theme: themeHint, description: descHint }),
      )
      return res.json(story)
    }
    if (!emotion || !scene) {
      return res.status(400).json({ error: '缺少必填字段: emotion, scene' })
    }
    const template = getPromptByType('story') ?? { ...DEFAULT_STORY_TEMPLATE, id: 'default' }
    const story = await generateJSON<Story>(
      template.systemPrompt,
      fillTemplate(template.userPromptTemplate, { emotion, scene, ageGroup, description }),
    )
    res.json(story)
  } catch (err) {
    console.error('[POST /api/story]', err)
    res.status(500).json({ error: '生成故事失败，请检查 LLM 配置' })
  }
})

export default router
