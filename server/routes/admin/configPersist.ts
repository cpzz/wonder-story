import { Router } from 'express'
import { applyFullAdminPersist } from '@/lib/configStore'
import type { AdminPersistApiKeyInput, LLMSettings } from '@/types'

const router = Router()

/** 将 body 中的 apiKeys + llmSettings 写入内存中的 AppConfig 并落盘 config.json（管理端唯一写入口） */
router.post('/persist', (req, res) => {
  try {
    const body = req.body as { llmSettings?: LLMSettings; apiKeys?: AdminPersistApiKeyInput[] }
    if (!body.llmSettings || typeof body.llmSettings !== 'object') {
      return res.status(400).json({ error: '请求体需包含 llmSettings 对象' })
    }
    if (!Array.isArray(body.apiKeys)) {
      return res.status(400).json({ error: '请求体需包含 apiKeys 数组' })
    }
    applyFullAdminPersist({
      apiKeys: body.apiKeys,
      llmSettings: {
        storyLLMId: body.llmSettings.storyLLMId ?? '',
        pictureLLMId: body.llmSettings.pictureLLMId ?? '',
      },
    })
    res.json({ success: true })
  } catch (err) {
    const msg = err instanceof Error ? err.message : ''
    if (msg === 'INVALID_ROW_ID') {
      return res.status(400).json({ error: 'apiKeys 中存在无效的 rowId' })
    }
    if (msg === 'PICTURE_LLM_NOT_IMAGE_CAPABLE') {
      return res.status(400).json({ error: '绘本 LLM 必须选择支持图像生成的 API Key' })
    }
    console.error('[POST /api/admin/config/persist]', err)
    res.status(500).json({ error: '保存失败' })
  }
})

export default router
