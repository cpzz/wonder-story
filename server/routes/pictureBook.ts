import { Router } from 'express'
import { generateText } from '@/lib/llm'
import { getPromptByType } from '@/lib/promptStore'
import { fillTemplate } from '@/lib/templateUtils'
import { DEFAULT_IMAGE_TEMPLATE } from '@/lib/defaultPrompts'
import { getBookById } from '@/lib/booksStore'
import type { Story, PictureBook, PictureBookPage } from '@/types'

const router = Router()

router.post('/', async (req, res) => {
  try {
    const { story, ageGroup }: { story: Story; ageGroup: string } = req.body
    if (!story?.title?.text || !Array.isArray(story?.pages) || story.pages.length === 0) {
      return res.status(400).json({ error: '缺少故事内容' })
    }
    const template = getPromptByType('image') ?? { ...DEFAULT_IMAGE_TEMPLATE, id: 'default' }
    const sortedStoryPages = [...story.pages].sort((a, b) => a.pageNumber - b.pageNumber)
    const pages: PictureBookPage[] = await Promise.all(
      sortedStoryPages.map(async (page) => {
        const pageText = page.textEn ?? page.text
        const imagePrompt = await generateText(
          template.systemPrompt,
          fillTemplate(template.userPromptTemplate, { title: story.title.textEn ?? story.title.text, pageText, ageGroup }),
          'story',
        )
        return { pageNumber: page.pageNumber, text: page.text, textEn: page.textEn, imagePrompt: imagePrompt.trim() }
      }),
    )
    pages.sort((a, b) => a.pageNumber - b.pageNumber)
    const pictureBook: PictureBook = { title: story.title, pages }
    res.json(pictureBook)
  } catch (err) {
    console.error('[POST /api/picture-book]', err)
    res.status(500).json({ error: '生成绘本失败，请检查 LLM 配置' })
  }
})

export default router
