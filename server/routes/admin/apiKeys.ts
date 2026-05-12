import { Router } from 'express'
import { v4 as uuidv4 } from 'uuid'
import { getAPIKeyViews, createAPIKey, updateAPIKey, deleteAPIKey } from '@/lib/configStore'
import type { APIKeyInput } from '@/types'

const router = Router()

router.get('/', (_req, res) => {
  res.json(getAPIKeyViews())
})

router.post('/', (req, res) => {
  try {
    const body: Partial<APIKeyInput> = req.body
    if (!body.name) {
      return res.status(400).json({ error: '请填写名称' })
    }
    const view = createAPIKey({
      name: body.name,
      provider: body.provider ?? '',
      model: body.model ?? '',
      baseURL: body.baseURL,
      apiKey: body.apiKey ?? '',
      supportsImageGen: Boolean(body.supportsImageGen),
    })
    res.status(201).json(view)
  } catch (err) {
    console.error('[POST /api/admin/api-keys]', err)
    res.status(500).json({ error: '创建 API Key 失败' })
  }
})

router.get('/:id', (req, res) => {
  const key = getAPIKeyViews().find((k) => k.id === req.params.id)
  if (!key) return res.status(404).json({ error: 'API Key 不存在' })
  res.json(key)
})

router.put('/:id', (req, res) => {
  try {
    const body: Partial<APIKeyInput> = req.body
    const updated = updateAPIKey(req.params.id, body)
    if (!updated) return res.status(404).json({ error: 'API Key 不存在' })
    res.json(updated)
  } catch (err) {
    console.error('[PUT /api/admin/api-keys/:id]', err)
    res.status(500).json({ error: '更新失败' })
  }
})

router.delete('/:id', (req, res) => {
  const deleted = deleteAPIKey(req.params.id)
  if (!deleted) return res.status(404).json({ error: 'API Key 不存在' })
  res.json({ success: true })
})

export default router
