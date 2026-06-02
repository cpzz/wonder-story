import { TextModelAdapter, type TextOptions } from './textAdapter'

export class ClaudeTextAdapter extends TextModelAdapter {
  readonly provider = 'claude'

  async generateText(
    systemPrompt: string,
    userPrompt: string,
    options: TextOptions,
  ): Promise<string> {
    const response = await this.callClaudeAPI(systemPrompt, userPrompt, options)
    return this.extractContent(response)
  }

  async generateJSON<T>(
    systemPrompt: string,
    userPrompt: string,
    options: TextOptions,
  ): Promise<T> {
    const jsonPrompt = userPrompt + '\n\nReturn ONLY valid JSON, no other text.'
    const response = await this.callClaudeAPI(systemPrompt, jsonPrompt, options)
    const content = this.extractContent(response)
    if (!content) throw new Error('LLM 返回了空内容')
    const cleaned = this.cleanJSON(content)
    try {
      return JSON.parse(cleaned) as T
    } catch (parseError) {
      console.error('[ClaudeTextAdapter] Failed to parse LLM response:', {
        raw: content,
        cleaned,
        error: parseError instanceof Error ? parseError.message : String(parseError),
      })
      throw new Error(`JSON 解析失败: ${parseError instanceof Error ? parseError.message : String(parseError)}`)
    }
  }

  private async callClaudeAPI(
    systemPrompt: string,
    userPrompt: string,
    options: TextOptions,
  ): Promise<unknown> {
    const baseURL = options.baseURL || 'https://api.anthropic.com/v1/messages'

    const response = await fetch(baseURL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': options.apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: options.model,
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }],
        max_tokens: options.maxTokens ?? 4096,
      }),
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => null)
      throw new Error(`Claude API 请求失败: ${response.status} ${errorData?.error?.message || ''}`)
    }

    return response.json()
  }

  private extractContent(response: unknown): string {
    const claudeResponse = response as {
      content?: Array<{ text?: string }>
    }
    return claudeResponse.content?.[0]?.text?.trim() || ''
  }
}
