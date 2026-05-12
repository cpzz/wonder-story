import { Router } from 'express'
import { getBooks, getBookById, saveBook, deleteBook } from '@/lib/booksStore'
import type { BookItem } from '@/types'

const router = Router()

router.get('/', (_req, res) => {
  res.json(getBooks())
})

router.post('/', (req, res) => {
  try {
    const { emotion, scene, ageGroup, description, guide, story, pictureBook } = req.body
    if (!emotion || !scene || !ageGroup || !guide || !story || !pictureBook) {
      return res.status(400).json({ error: '缺少必填字段' })
    }
    const book: BookItem = saveBook({ title: story.title, emotion, scene, ageGroup, description, guide, story, pictureBook })
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

export default router
