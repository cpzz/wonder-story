import { Router } from 'express'
import { getLLMSettings, updateLLMSettings, getAPIKeyById } from '@/lib/configStore'
import type { LLMSettings } from '@/types'

const router = Router()

router.get('/', (_req, res) => {
  res.json(getLLMSettings())
})

router.put('/', (req, res) => {
  try {
    const body: Partial<LLMSettings> = req.body
    if (body.pictureLLMId) {
      const key = getAPIKeyById(body.pictureLLMId)
      if (!key) return res.status(400).json({ error: '绘本 LLM 对应的 API Key 不存在' })
      if (!key.supportsImageGen) return res.status(400).json({ error: '绘本 LLM 必须选择支持图像生成的 API Key' })
    }
    res.json(updateLLMSettings(body))
  } catch (err) {
    console.error('[PUT /api/admin/llm-settings]', err)
    res.status(500).json({ error: '保存失败' })
  }
})

export default router
