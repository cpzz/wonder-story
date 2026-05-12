import { Router } from 'express'
import { getLLMStatus } from '@/lib/configStore'

const router = Router()

router.get('/', (_req, res) => {
  res.json(getLLMStatus())
})

export default router
