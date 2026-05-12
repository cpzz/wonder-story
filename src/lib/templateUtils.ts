/**
 * 将模板字符串中的 {variable} 占位符替换为实际值。
 * 只替换 {word} 格式（字母/数字/下划线），不影响 JSON 中的 { "key": value } 结构。
 */
export function fillTemplate(template: string, variables: Record<string, string>): string {
  return template.replace(/\{([a-zA-Z_]\w*)\}/g, (match, key) => variables[key] ?? match)
}
