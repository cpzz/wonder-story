import { Router } from 'express'
import { getOptions, updateOptions } from '@/lib/optionsStore'
import type { DropdownOptions } from '@/types'

const router = Router()

router.get('/', (_req, res) => {
  res.json(getOptions())
})

router.put('/', (req, res) => {
  try {
    const body: DropdownOptions = req.body
    res.json(updateOptions(body))
  } catch (err) {
    console.error('[PUT /api/options]', err)
    res.status(500).json({ error: '更新选项失败' })
  }
})

export default router
