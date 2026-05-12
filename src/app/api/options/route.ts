import { NextRequest, NextResponse } from 'next/server'
import { getOptions, updateOptions } from '@/lib/optionsStore'
import type { DropdownOptions } from '@/types'

export async function GET() {
  return NextResponse.json(getOptions())
}

export async function PUT(req: NextRequest) {
  try {
    const body: DropdownOptions = await req.json()
    const updated = updateOptions(body)
    return NextResponse.json(updated)
  } catch (err) {
    console.error('[PUT /api/options]', err)
    return NextResponse.json({ error: '更新选项失败' }, { status: 500 })
  }
}
