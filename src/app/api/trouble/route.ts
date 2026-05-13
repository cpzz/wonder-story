import { NextRequest, NextResponse } from 'next/server'
import { generateJSON } from '@/lib/llm'
import { getPromptByType } from '@/lib/promptStore'
import { fillTemplate } from '@/lib/templateUtils'
import { DEFAULT_GUIDE_TEMPLATE } from '@/lib/defaultPrompts'
import type { TroubleInput, Guide } from '@/types'

export async function POST(req: NextRequest) {
  try {
    const body: TroubleInput = await req.json()
    const { emotion, scene, ageGroup, description = '', textLang } = body

    if (!emotion || !scene || !ageGroup) {
      return NextResponse.json({ error: '缺少必填字段：emotion, scene, ageGroup' }, { status: 400 })
    }

    const template = getPromptByType('guide') ?? { ...DEFAULT_GUIDE_TEMPLATE, id: 'default' }
    const variables = { emotion, scene, ageGroup, description }
    const langNote = textLang === 'en' ? '\n\nIMPORTANT: Write the message and tips in English.' : ''

    const guide = await generateJSON<Guide>(
      template.systemPrompt,
      fillTemplate(template.userPromptTemplate, variables) + langNote,
    )

    return NextResponse.json(guide)
  } catch (err) {
    console.error('[/api/trouble]', err)
    return NextResponse.json({ error: '生成引导建议失败，请检查 LLM 配置' }, { status: 500 })
  }
}
