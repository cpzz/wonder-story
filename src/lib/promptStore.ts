import { getDefaultPrompts } from './defaultPrompts'
import type { PromptTemplate } from '@/types'

/** 内置提示词模板（随 `defaultPrompts` 与代码发布更新，不落盘） */
export function getPrompts(): PromptTemplate[] {
  return getDefaultPrompts()
}

export function getPromptByType(type: PromptTemplate['type']): PromptTemplate | undefined {
  return getPrompts().find((p) => p.type === type)
}
