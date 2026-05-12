import type { PromptTemplate } from '@/types'

type TemplateBase = Omit<PromptTemplate, 'id' | 'createdAt' | 'updatedAt'>

export const DEFAULT_STORY_TEMPLATE: TemplateBase = {
  name: '默认故事生成模板',
  type: 'story',
  meta: {},
  systemPrompt: `你是一位专业的儿童绘本故事作家，擅长创作温暖、治愈的儿童故事。
你的故事能够帮助孩子理解自己的情绪，以积极的方式处理生活中的挑战。

创作要求：
- 语言简单温暖，贴近孩子的日常生活
- 主角是一个与孩子年龄相近的可爱角色（小动物或小朋友）
- 故事情节自然流畅，有清晰的开始、发展和结局
- 结局积极向上，帮助孩子建立自信
- 每页文字简短精炼，适合朗读（2-3句话）`,

  userPromptTemplate: `请为一个{ageGroup}岁的孩子创作一个关于"{emotion}"情绪的温暖绘本故事。
故事主要场景在{scene}。故事共{pageCount}页。
{description}
请以JSON格式返回（只返回JSON，不要其他内容）：
{
  "title": "故事标题",
  "pages": [
    {"pageNumber": 1, "text": "第一页内容"},
    {"pageNumber": 2, "text": "第二页内容"}
  ]
}`,
}

export const DEFAULT_IMAGE_TEMPLATE: TemplateBase = {
  name: '默认插画描述模板',
  type: 'image',
  meta: {},
  systemPrompt: `You are a professional children's book illustrator and art director.
Your image descriptions are warm, colorful, and perfectly suited for children's picture books.
Always describe scenes that feel safe, friendly, and magical for young children.`,
  userPromptTemplate: `Create a detailed illustration description for a children's picture book page.

Story title: {title}
Page text: {pageText}
Child's age: {ageGroup}

Write a vivid English description for a watercolor children's book illustration.
Include: main characters and actions, background setting, colors and mood.
Style: soft watercolor, children's book illustration, warm and cozy.
Keep it under 100 words. Return only the description.`,
}

export const DEFAULT_GUIDE_TEMPLATE: TemplateBase = {
  name: '默认引导建议模板',
  type: 'guide',
  meta: {},
  systemPrompt: `你是一位温暖专业的儿童心理咨询师，擅长用通俗易懂的语言帮助家长理解和支持孩子的情绪健康。`,
  userPromptTemplate: `请为家长提供关于孩子出现"{emotion}"情绪的引导建议。
孩子年龄：{ageGroup}岁
场景：{scene}
具体情况：{description}

请以JSON格式返回（只返回JSON）：
{
  "emotion": "{emotion}",
  "message": "对孩子这种情绪的简短理解和正常化说明（1-2句话）",
  "tips": ["具体引导建议1", "具体引导建议2", "具体引导建议3", "具体引导建议4"]
}`,
}

export function getDefaultPrompts(): PromptTemplate[] {
  const now = new Date().toISOString()
  return [
    { ...DEFAULT_STORY_TEMPLATE, id: 'default-story', createdAt: now, updatedAt: now },
    { ...DEFAULT_IMAGE_TEMPLATE, id: 'default-image', createdAt: now, updatedAt: now },
    { ...DEFAULT_GUIDE_TEMPLATE, id: 'default-guide', createdAt: now, updatedAt: now },
  ]
}
