import OpenAI from 'openai'
import { TextModelAdapter, type TextOptions } from './textAdapter'

export class OpenAITextAdapter extends TextModelAdapter {
  readonly provider = 'openai'

  async generateText(
    systemPrompt: string,
    userPrompt: string,
    options: TextOptions,
  ): Promise<string> {
    const client = this.createClient(options)
    const params = this.buildChatParams(systemPrompt, userPrompt, options, false)
    const response = await client.chat.completions.create(params)
    return this.extractContent(response)
  }

  async generateJSON<T>(
    systemPrompt: string,
    userPrompt: string,
    options: TextOptions,
  ): Promise<T> {
    const client = this.createClient(options)
    const params = this.buildChatParams(systemPrompt, userPrompt, options, true)
    const response = await client.chat.completions.create(params)
    const content = this.extractContent(response)
    if (!content) throw new Error('LLM 返回了空内容')
    const cleaned = this.cleanJSON(content)
    try {
      return JSON.parse(cleaned) as T
    } catch (parseError) {
      console.error('[OpenAITextAdapter] Failed to parse LLM response:', {
        raw: content,
        cleaned,
        error: parseError instanceof Error ? parseError.message : String(parseError),
      })
      throw new Error(`JSON 解析失败: ${parseError instanceof Error ? parseError.message : String(parseError)}`)
    }
  }

  private createClient(options: TextOptions): OpenAI {
    return new OpenAI({
      apiKey: options.apiKey,
      baseURL: options.baseURL || undefined,
      timeout: 120000,
      maxRetries: 2,
    })
  }

  private buildChatParams(
    systemPrompt: string,
    userPrompt: string,
    options: TextOptions,
    wantJson: boolean,
  ): Parameters<typeof OpenAI.prototype.chat.completions.create>[0] {
    const isDeepSeek = options.provider === 'deepseek'

    const systemContent = isDeepSeek
      ? systemPrompt + '\n\n请严格以 JSON 格式返回，不要包含任何其他文字或markdown。'
      : systemPrompt + '\n\n请只返回JSON，不要任何其他文字或markdown代码块。'

    const params: Parameters<typeof OpenAI.prototype.chat.completions.create>[0] = {
      model: options.model,
      messages: [
        { role: 'system', content: systemContent },
        { role: 'user', content: userPrompt },
      ],
      ...(isDeepSeek && wantJson && {
        response_format: { type: 'json_object' },
        max_tokens: options.maxTokens ?? 4096,
      }),
      ...(options.maxTokens && !isDeepSeek && { max_tokens: options.maxTokens }),
    }

    return params
  }

  private extractContent(response: unknown): string {
    const openAIResponse = response as { choices?: Array<{ message?: { content?: string | null } }> }
    return openAIResponse.choices?.[0]?.message?.content?.trim() || ''
  }
}
