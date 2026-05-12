import { NextRequest, NextResponse } from 'next/server'
import { getBookById, deleteBook } from '@/lib/booksStore'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const book = getBookById(id)
  if (!book) return NextResponse.json({ error: '绘本不存在' }, { status: 404 })
  return NextResponse.json(book)
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const deleted = deleteBook(id)
  if (!deleted) return NextResponse.json({ error: '绘本不存在' }, { status: 404 })
  return NextResponse.json({ success: true })
}
