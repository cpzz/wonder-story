export interface TextOptions {
  apiKey: string
  model: string
  baseURL?: string
  provider: string
  maxTokens?: number
  responseFormat?: 'text' | 'json_object'
}

export abstract class TextModelAdapter {
  abstract readonly provider: string

  abstract generateText(
    systemPrompt: string,
    userPrompt: string,
    options: TextOptions,
  ): Promise<string>

  abstract generateJSON<T>(
    systemPrompt: string,
    userPrompt: string,
    options: TextOptions,
  ): Promise<T>

  protected cleanJSON(content: string): string {
    const trimmed = content.trim()
    const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/)
    const inner = fenced ? fenced[1].trim() : trimmed
    const balanced = this.extractBalancedJson(inner) ?? inner

    const attempts = [balanced, inner, trimmed]
    let lastErr: unknown
    for (const candidate of attempts) {
      if (!candidate) continue
      try {
        const { jsonrepair } = require('jsonrepair')
        return jsonrepair(candidate)
      } catch (e) {
        lastErr = e
      }
    }
    const posNum =
      lastErr && typeof lastErr === 'object' && 'position' in lastErr
        ? (lastErr as { position: number }).position
        : -1
    const sample =
      posNum >= 0 ? balanced.slice(Math.max(0, posNum - 120), posNum + 120) : balanced.slice(0, 400)
    console.error('[cleanJSON] jsonrepair failed after balanced extract', { position: posNum, sample })
    throw lastErr instanceof Error ? lastErr : new Error(String(lastErr))
  }

  private extractBalancedJson(text: string): string | null {
    const start = text.search(/[\[{]/)
    if (start < 0) return null
    const stack: ('{' | '[')[] = []
    let inString = false
    let escape = false
    for (let i = start; i < text.length; i++) {
      const c = text[i]
      if (inString) {
        if (escape) { escape = false; continue }
        if (c === '\\') { escape = true; continue }
        if (c === '"') { inString = false; continue }
        continue
      }
      if (c === '"') { inString = true; continue }
      if (c === '{') { stack.push('{'); continue }
      if (c === '[') { stack.push('['); continue }
      if (c === '}') {
        if (stack.length === 0 || stack[stack.length - 1] !== '{') return null
        stack.pop()
        if (stack.length === 0) return text.slice(start, i + 1)
        continue
      }
      if (c === ']') {
        if (stack.length === 0 || stack[stack.length - 1] !== '[') return null
        stack.pop()
        if (stack.length === 0) return text.slice(start, i + 1)
        continue
      }
    }
    return null
  }
}
