import { NextRequest, NextResponse } from 'next/server'
import { v4 as uuidv4 } from 'uuid'
import { getPrompts, upsertPrompt } from '@/lib/promptStore'
import type { PromptTemplate } from '@/types'

export async function GET() {
  return NextResponse.json(getPrompts())
}

export async function POST(req: NextRequest) {
  try {
    const body: Omit<PromptTemplate, 'id' | 'createdAt' | 'updatedAt'> = await req.json()

    if (!body.name || !body.type || !body.systemPrompt || !body.userPromptTemplate) {
      return NextResponse.json({ error: '缺少必填字段：name, type, systemPrompt, userPromptTemplate' }, { status: 400 })
    }

    const now = new Date().toISOString()
    const newPrompt: PromptTemplate = {
      ...body,
      id: uuidv4(),
      createdAt: now,
      updatedAt: now,
    }

    upsertPrompt(newPrompt)
    return NextResponse.json(newPrompt, { status: 201 })
  } catch (err) {
    console.error('[POST /api/admin/prompts]', err)
    return NextResponse.json({ error: '创建模板失败' }, { status: 500 })
  }
}
