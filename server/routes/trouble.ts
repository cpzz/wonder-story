import { Router } from 'express'
import { generateJSON } from '@/lib/llm'
import { getPromptByType } from '@/lib/promptStore'
import { fillTemplate } from '@/lib/templateUtils'
import { DEFAULT_GUIDE_TEMPLATE, DEFAULT_BEDTIME_GUIDE_TEMPLATE, getLocalizedNameAndPrompts } from '@/lib/defaultPrompts'
import type { TroubleInput, Guide, UILang } from '@/types'

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
    const { emotion, scene, ageGroup, description = '', mode = 'emotion', theme = '', textLang = 'bilingual', uiLang = 'zh' }: TroubleInput & { uiLang?: UILang } = req.body
    const lang: UILang = uiLang ?? 'zh'
    if (mode === 'bedtime') {
      if (!ageGroup) return res.status(400).json({ error: lang === 'en' ? 'Missing required field: ageGroup' : '缺少必填字段: ageGroup' })
      const themeHint = theme
        ? (lang === 'en' ? `Story theme: ${theme}` : `故事主题：${theme}`)
        : ''
      const descHint = description
        ? (lang === 'en' ? `Note: ${description}` : `备注：${description}`)
        : ''
      const localized = getLocalizedNameAndPrompts('bedtime-guide', lang)
      console.log(`[trouble] bedtime mode, ageGroup=${ageGroup}, theme=${theme}, uiLang=${lang}`)
      const raw = await generateJSON<GuideRaw>(localized.systemPrompt, fillTemplate(localized.userPromptTemplate, { ageGroup, description: descHint }))
      console.log(`[trouble] bedtime guide done: emotion=${raw.emotion}, tips=${raw.tips?.length}`)
      return res.json(wrapRaw(raw))
    }
    if (!emotion || !scene || !ageGroup) {
      return res.status(400).json({ error: lang === 'en' ? 'Missing required fields: emotion, scene, ageGroup' : '缺少必填字段: emotion, scene, ageGroup' })
    }
    const localized = getLocalizedNameAndPrompts('guide', lang)
    console.log(`[trouble] emotion mode, emotion=${emotion}, scene=${scene}, ageGroup=${ageGroup}, uiLang=${lang}`)
    const raw = await generateJSON<GuideRaw>(localized.systemPrompt, fillTemplate(localized.userPromptTemplate, { emotion, scene, ageGroup, description }))
    console.log(`[trouble] guide done: emotion=${raw.emotion}, tips=${raw.tips?.length}`)
    res.json(wrapRaw(raw))
  } catch (err) {
    console.error('[POST /api/trouble]', err)
    res.status(500).json({ error: '生成引导建议失败，请检查 LLM 配置' })
  }
})

export default router
