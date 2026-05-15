import { Router, type Request, type Response } from 'express'
import { getLLMSettings } from '@/lib/configStore'

const router = Router()

router.get('/', (_req, res) => {
  res.json(getLLMSettings())
})

router.put('/', (_req: Request, res: Response) => {
  res.status(405).setHeader('Allow', 'GET').json({
    error: '大模型选择请在设置页编辑后，通过 POST /api/admin/config/persist 点击「保存设置」一并提交',
  })
})

export default router
