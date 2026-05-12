import { readJson, writeJson } from './storage'
import type { DropdownOptions } from '@/types'

const FILENAME = 'options.json'

const DEFAULT_OPTIONS: DropdownOptions = {
  emotions: ['害怕', '难过', '愤怒', '焦虑', '孤独', '委屈', '嫉妒', '紧张'],
  scenes: ['家里', '幼儿园', '学校', '户外', '朋友家', '医院'],
  ageGroups: ['2-3', '3-5', '5-7', '7-10'],
}

export function getOptions(): DropdownOptions {
  return readJson<DropdownOptions>(FILENAME, DEFAULT_OPTIONS)
}

export function updateOptions(options: DropdownOptions): DropdownOptions {
  writeJson(FILENAME, options)
  return options
}
