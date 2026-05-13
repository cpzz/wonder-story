import { NextRequest, NextResponse } from 'next/server'
import { generateJSON } from '@/lib/llm'
import { getPromptByType } from '@/lib/promptStore'
import { fillTemplate } from '@/lib/templateUtils'
import { DEFAULT_STORY_TEMPLATE } from '@/lib/defaultPrompts'
import type { TroubleInput, Story } from '@/types'

function langInstruction(textLang?: string): string {
  if (textLang === 'en') return '\n\nIMPORTANT: Write all story text in English.'
  if (textLang === 'bilingual')
    return '\n\nIMPORTANT: For each page provide both Chinese and English text. Use this JSON shape for pages: {"pageNumber": 1, "text": "中文内容", "textEn": "English content"}. Also make the title bilingual: "中文标题 / English Title".'
  return ''
}

export async function POST(req: NextRequest) {
  try {
    const body: TroubleInput = await req.json()
    const { emotion, scene, ageGroup, description = '', textLang } = body

    if (!emotion || !scene || !ageGroup) {
      return NextResponse.json({ error: '缺少必填字段：emotion, scene, ageGroup' }, { status: 400 })
    }

    const template = getPromptByType('story') ?? { ...DEFAULT_STORY_TEMPLATE, id: 'default' }
    const variables = { emotion, scene, ageGroup, description }

    const story = await generateJSON<Story>(
      template.systemPrompt,
      fillTemplate(template.userPromptTemplate, variables) + langInstruction(textLang),
    )

    return NextResponse.json(story)
  } catch (err) {
    console.error('[/api/story]', err)
    return NextResponse.json({ error: '生成故事失败，请检查 LLM 配置' }, { status: 500 })
  }
}
