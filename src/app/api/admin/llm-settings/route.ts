import { NextRequest, NextResponse } from 'next/server'
import { getLLMSettings, updateLLMSettings, getAPIKeyById } from '@/lib/configStore'
import type { LLMSettings } from '@/types'

export async function GET() {
  return NextResponse.json(getLLMSettings())
}

export async function PUT(req: NextRequest) {
  try {
    const body: Partial<LLMSettings> = await req.json()

    // 校验：绘本 LLM 必须支持文生图
    if (body.pictureLLMId) {
      const key = getAPIKeyById(body.pictureLLMId)
      if (!key) {
        return NextResponse.json({ error: '绘本 LLM 对应的 API Key 不存在' }, { status: 400 })
      }
      if (!key.supportsImageGen) {
        return NextResponse.json(
          { error: '绘本 LLM 必须选择支持文生图的 API Key' },
          { status: 400 },
        )
      }
    }

    const updated = updateLLMSettings(body)
    return NextResponse.json(updated)
  } catch (err) {
    console.error('[PUT /api/admin/llm-settings]', err)
    return NextResponse.json({ error: '保存失败' }, { status: 500 })
  }
}
