import { NextRequest, NextResponse } from 'next/server'
import { getAPIKeyViews, updateAPIKey, deleteAPIKey } from '@/lib/configStore'
import type { APIKeyInput } from '@/types'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const key = getAPIKeyViews().find((k) => k.id === id)
  if (!key) return NextResponse.json({ error: 'API Key 不存在' }, { status: 404 })
  return NextResponse.json(key)
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const body: Partial<APIKeyInput> = await req.json()
    const updated = updateAPIKey(id, body)
    if (!updated) return NextResponse.json({ error: 'API Key 不存在' }, { status: 404 })
    return NextResponse.json(updated)
  } catch (err) {
    console.error('[PUT /api/admin/api-keys/:id]', err)
    return NextResponse.json({ error: '更新失败' }, { status: 500 })
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const deleted = deleteAPIKey(id)
  if (!deleted) return NextResponse.json({ error: 'API Key 不存在' }, { status: 404 })
  return NextResponse.json({ success: true })
}
