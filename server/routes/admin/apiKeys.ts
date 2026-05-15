import { Router, type Request, type Response } from 'express'
import { getAPIKeyViews } from '@/lib/configStore'

const router = Router()

router.get('/', (_req, res) => {
  res.json(getAPIKeyViews())
})

router.get('/:id', (req, res) => {
  const key = getAPIKeyViews().find((k) => k.id === req.params.id)
  if (!key) return res.status(404).json({ error: 'API Key 不存在' })
  res.json(key)
})

const mutateDisabled = (_req: Request, res: Response) => {
  res.status(405).setHeader('Allow', 'GET').json({
    error: 'API Key 的增删改请在设置页编辑后，通过 POST /api/admin/config/persist 点击「保存设置」一并提交',
  })
}

router.post('/', mutateDisabled)
router.put('/:id', mutateDisabled)
router.delete('/:id', mutateDisabled)

export default router
