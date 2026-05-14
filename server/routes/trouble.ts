import { Router } from 'express'
import { generateJSON } from '@/lib/llm'
import { getPromptByType } from '@/lib/promptStore'
import { fillTemplate } from '@/lib/templateUtils'
import { DEFAULT_GUIDE_TEMPLATE, DEFAULT_BEDTIME_GUIDE_TEMPLATE } from '@/lib/defaultPrompts'
import type { TroubleInput, Guide } from '@/types'

interface GuideRaw { emotion: string; message: string; tips: string[] }

function wrapRaw(raw: GuideRaw): Guide {
  return {
    emotion: { text: raw.emotion },
    message: { text: raw.message },
    tips: { text: raw.tips },
  }
}

const router = Router()

router.post('/', async (req, res) => {
  try {
    const { emotion, scene, ageGroup, description = '', mode = 'emotion', theme = '' }: TroubleInput = req.body
    if (mode === 'bedtime') {
      if (!ageGroup) return res.status(400).json({ error: '缺少必填字段: ageGroup' })
      const themeHint = theme ? `故事主题：${theme}` : ''
      const descHint = description ? `备注：${description}` : ''
      const template = getPromptByType('bedtime-guide') ?? { ...DEFAULT_BEDTIME_GUIDE_TEMPLATE, id: 'default' }
      console.log(`[trouble] bedtime mode, ageGroup=${ageGroup}, theme=${theme}`)
      const raw = await generateJSON<GuideRaw>(template.systemPrompt, fillTemplate(template.userPromptTemplate, { ageGroup, description: descHint }))
      console.log(`[trouble] bedtime guide done: emotion=${raw.emotion}, tips=${raw.tips?.length}`)
      return res.json(wrapRaw(raw))
    }
    if (!emotion || !scene || !ageGroup) {
      return res.status(400).json({ error: '缺少必填字段: emotion, scene, ageGroup' })
    }
    const template = getPromptByType('guide') ?? { ...DEFAULT_GUIDE_TEMPLATE, id: 'default' }
    console.log(`[trouble] emotion mode, emotion=${emotion}, scene=${scene}, ageGroup=${ageGroup}`)
    const raw = await generateJSON<GuideRaw>(template.systemPrompt, fillTemplate(template.userPromptTemplate, { emotion, scene, ageGroup, description }))
    console.log(`[trouble] guide done: emotion=${raw.emotion}, tips=${raw.tips?.length}`)
    res.json(wrapRaw(raw))
  } catch (err) {
    console.error('[POST /api/trouble]', err)
    res.status(500).json({ error: '生成引导建议失败，请检查 LLM 配置' })
  }
})

export default router
