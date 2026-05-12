import { Router } from 'express'
import { generateText } from '@/lib/llm'
import { getPromptByType } from '@/lib/promptStore'
import { fillTemplate } from '@/lib/templateUtils'
import { DEFAULT_IMAGE_TEMPLATE } from '@/lib/defaultPrompts'
import type { Story, PictureBook, PictureBookPage } from '@/types'

const router = Router()

router.post('/', async (req, res) => {
  try {
    const { story, ageGroup }: { story: Story; ageGroup: string } = req.body
    if (!story?.title || !Array.isArray(story?.pages) || story.pages.length === 0) {
      return res.status(400).json({ error: '缺少故事内容' })
    }
    const template = getPromptByType('image') ?? { ...DEFAULT_IMAGE_TEMPLATE, id: 'default' }
    const pages: PictureBookPage[] = await Promise.all(
      story.pages.map(async (page) => {
        const imagePrompt = await generateText(
          template.systemPrompt,
          fillTemplate(template.userPromptTemplate, { title: story.title, pageText: page.text, ageGroup }),
        )
        return { pageNumber: page.pageNumber, text: page.text, imagePrompt: imagePrompt.trim() }
      }),
    )
    const pictureBook: PictureBook = { title: story.title, pages }
    res.json(pictureBook)
  } catch (err) {
    console.error('[POST /api/picture-book]', err)
    res.status(500).json({ error: '生成绘本失败，请检查 LLM 配置' })
  }
})

export default router
