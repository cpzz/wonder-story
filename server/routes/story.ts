import { Router } from 'express'
import { generateJSON } from '@/lib/llm'
import { getPromptByType } from '@/lib/promptStore'
import { fillTemplate } from '@/lib/templateUtils'
import { DEFAULT_STORY_TEMPLATE } from '@/lib/defaultPrompts'
import type { TroubleInput, Story } from '@/types'

const router = Router()

router.post('/', async (req, res) => {
  try {
    const { emotion, scene, ageGroup, description = '' }: TroubleInput = req.body
    if (!emotion || !scene || !ageGroup) {
      return res.status(400).json({ error: '缺少必填字段: emotion, scene, ageGroup' })
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
