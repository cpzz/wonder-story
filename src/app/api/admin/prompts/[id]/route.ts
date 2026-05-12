import { NextRequest, NextResponse } from 'next/server'
import { getPromptById, upsertPrompt, deletePrompt } from '@/lib/promptStore'
import type { PromptTemplate } from '@/types'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const prompt = getPromptById(id)
  if (!prompt) return NextResponse.json({ error: '模板不存在' }, { status: 404 })
  return NextResponse.json(prompt)
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const existing = getPromptById(id)
    if (!existing) return NextResponse.json({ error: '模板不存在' }, { status: 404 })

    const body: Partial<PromptTemplate> = await req.json()
    const updated: PromptTemplate = {
      ...existing,
      ...body,
      id,
      createdAt: existing.createdAt,
      updatedAt: new Date().toISOString(),
    }

    upsertPrompt(updated)
    return NextResponse.json(updated)
  } catch (err) {
    console.error('[PUT /api/admin/prompts/:id]', err)
    return NextResponse.json({ error: '更新模板失败' }, { status: 500 })
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const deleted = deletePrompt(id)
  if (!deleted) return NextResponse.json({ error: '模板不存在' }, { status: 404 })
  return NextResponse.json({ success: true })
}
