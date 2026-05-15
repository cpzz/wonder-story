import { Router } from 'express'
import { getBooks, getBookById, saveBook, deleteBook, getImagePath, getRefImagePath } from '@/lib/booksStore'
import type { BookItem } from '@/types'

const router = Router()

router.get('/', (_req, res) => {
  res.json(getBooks())
})

router.post('/', (req, res) => {
  try {
    const {
      emotion,
      scene,
      ageGroup,
      description,
      protagonistPreset,
      guide,
      story,
      mode,
      theme,
      characters,
      illustrationStyleId,
    } = req.body
    if (!ageGroup || !guide || !story) {
      return res.status(400).json({ error: '缺少必填字段' })
    }
    const book: BookItem = saveBook({
      title: { text: story.cover.text, textEn: story.cover.textEn },
      emotion: emotion ?? '',
      scene: scene ?? '',
      ageGroup,
      description,
      protagonistPreset,
      guide,
      story,
      mode,
      theme,
      characters,
      illustrationStyleId,
    })
    console.log(
      `[books] saved book id=${book.id}, pages=${story.pages?.length}, chars=${characters?.length}, coverImagePrompt=${!!story.cover?.imagePrompt}, style=${illustrationStyleId ?? 'none'}`,
    )
    res.status(201).json(book)
  } catch (err) {
    console.error('[POST /api/books]', err)
    res.status(500).json({ error: '保存绘本失败' })
  }
})

router.get('/:id', (req, res) => {
  const book = getBookById(req.params.id)
  if (!book) return res.status(404).json({ error: '绘本不存在' })
  res.json(book)
})

router.delete('/:id', (req, res) => {
  const deleted = deleteBook(req.params.id)
  if (!deleted) return res.status(404).json({ error: '绘本不存在' })
  res.json({ success: true })
})

router.get('/:id/images/:pageNumber', (req, res) => {
  const { id, pageNumber } = req.params
  const imagePath = getImagePath(id, parseInt(pageNumber))
  if (!imagePath) return res.status(404).json({ error: '图片不存在' })
  res.sendFile(imagePath)
})

router.get('/:id/refs/:index', (req, res) => {
  const { id, index } = req.params
  const imagePath = getRefImagePath(id, parseInt(index))
  if (!imagePath) return res.status(404).json({ error: '参考图不存在' })
  res.sendFile(imagePath)
})

export default router
