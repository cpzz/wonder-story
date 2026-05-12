import { NextRequest, NextResponse } from 'next/server'
import { getAPIKeyViews, createAPIKey } from '@/lib/configStore'
import type { APIKeyInput } from '@/types'

export async function GET() {
  return NextResponse.json(getAPIKeyViews())
}

export async function POST(req: NextRequest) {
  try {
    const body: APIKeyInput = await req.json()
    const { name, provider, model, apiKey, supportsImageGen } = body

    if (!name || !provider || !model || !apiKey) {
      return NextResponse.json(
        { error: '缺少必填字段：name, provider, model, apiKey' },
        { status: 400 },
      )
    }

    const view = createAPIKey({ name, provider, model, baseURL: body.baseURL, apiKey, supportsImageGen: Boolean(supportsImageGen) })
    return NextResponse.json(view, { status: 201 })
  } catch (err) {
    console.error('[POST /api/admin/api-keys]', err)
    return NextResponse.json({ error: '创建 API Key 失败' }, { status: 500 })
  }
}
