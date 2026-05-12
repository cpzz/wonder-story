import { NextRequest, NextResponse } from 'next/server'
import { getBooks, saveBook } from '@/lib/booksStore'
import type { BookItem } from '@/types'

export async function GET() {
  return NextResponse.json(getBooks())
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { emotion, scene, ageGroup, description, guide, story, pictureBook } = body

    if (!emotion || !scene || !ageGroup || !guide || !story || !pictureBook) {
      return NextResponse.json({ error: '缺少必填字段' }, { status: 400 })
    }

    const book: BookItem = saveBook({
      title: story.title,
      emotion,
      scene,
      ageGroup,
      description,
      guide,
      story,
      pictureBook,
    })

    return NextResponse.json(book, { status: 201 })
  } catch (err) {
    console.error('[POST /api/books]', err)
    return NextResponse.json({ error: '保存绘本失败' }, { status: 500 })
  }
}
