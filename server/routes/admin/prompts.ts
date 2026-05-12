import { Router } from 'express'
import { v4 as uuidv4 } from 'uuid'
import { getPrompts, getPromptById, upsertPrompt, deletePrompt } from '@/lib/promptStore'
import type { PromptTemplate } from '@/types'

const router = Router()

router.get('/', (_req, res) => {
  res.json(getPrompts())
})

router.post('/', (req, res) => {
  try {
    const body: Omit<PromptTemplate, 'id' | 'createdAt' | 'updatedAt'> = req.body
    if (!body.name || !body.type || !body.systemPrompt || !body.userPromptTemplate) {
      return res.status(400).json({ error: '缺少必填字段: name, type, systemPrompt, userPromptTemplate' })
    }
    const now = new Date().toISOString()
    const newPrompt: PromptTemplate = { ...body, id: uuidv4(), createdAt: now, updatedAt: now }
    upsertPrompt(newPrompt)
    res.status(201).json(newPrompt)
  } catch (err) {
    console.error('[POST /api/admin/prompts]', err)
    res.status(500).json({ error: '创建模板失败' })
  }
})

router.get('/:id', (req, res) => {
  const prompt = getPromptById(req.params.id)
  if (!prompt) return res.status(404).json({ error: '模板不存在' })
  res.json(prompt)
})

router.put('/:id', (req, res) => {
  try {
    const existing = getPromptById(req.params.id)
    if (!existing) return res.status(404).json({ error: '模板不存在' })
    const body: Partial<PromptTemplate> = req.body
    const updated: PromptTemplate = {
      ...existing, ...body,
      id: req.params.id,
      createdAt: existing.createdAt,
      updatedAt: new Date().toISOString(),
    }
    upsertPrompt(updated)
    res.json(updated)
  } catch (err) {
    console.error('[PUT /api/admin/prompts/:id]', err)
    res.status(500).json({ error: '更新模板失败' })
  }
})

router.delete('/:id', (req, res) => {
  const deleted = deletePrompt(req.params.id)
  if (!deleted) return res.status(404).json({ error: '模板不存在' })
  res.json({ success: true })
})

export default router
