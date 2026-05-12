import { NextRequest, NextResponse } from 'next/server'
import { generateText } from '@/lib/llm'
import { getPromptByType } from '@/lib/promptStore'
import { fillTemplate } from '@/lib/templateUtils'
import { DEFAULT_IMAGE_TEMPLATE } from '@/lib/defaultPrompts'
import type { Story, PictureBook, PictureBookPage } from '@/types'

interface PictureBookInput {
  story: Story
  ageGroup: string
}

export async function POST(req: NextRequest) {
  try {
    const body: PictureBookInput = await req.json()
    const { story, ageGroup } = body

    if (!story?.title || !Array.isArray(story?.pages) || story.pages.length === 0) {
      return NextResponse.json({ error: '缺少故事内容' }, { status: 400 })
    }

    const template = getPromptByType('image') ?? { ...DEFAULT_IMAGE_TEMPLATE, id: 'default' }

    const pages: PictureBookPage[] = await Promise.all(
      story.pages.map(async (page) => {
        const variables = { title: story.title, pageText: page.text, ageGroup }
        const imagePrompt = await generateText(
          template.systemPrompt,
          fillTemplate(template.userPromptTemplate, variables),
        )
        return { pageNumber: page.pageNumber, text: page.text, imagePrompt: imagePrompt.trim() }
      }),
    )

    const pictureBook: PictureBook = { title: story.title, pages }
    return NextResponse.json(pictureBook)
  } catch (err) {
    console.error('[/api/picture-book]', err)
    return NextResponse.json({ error: '生成绘本失败，请检查 LLM 配置' }, { status: 500 })
  }
}
