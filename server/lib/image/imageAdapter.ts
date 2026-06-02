export interface ImageRequest {
  prompt: string
  size?: string
  negativePrompt?: string
  promptExtend?: boolean
  watermark?: boolean
  seed?: number
  referenceUrls?: string[]
}

export interface ImageResult {
  imageUrl: string
  cdnUrl?: string
}
 
export abstract class ImageModelAdapter {
  abstract readonly provider: string

  protected abstract getEndpoint(): string

  protected abstract buildRequestBody(model: string, request: ImageRequest): unknown

  protected abstract extractImageUrl(response: unknown): string

  protected getHeaders(apiKey: string): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    }
  }

  protected async handleRateLimit(_response: Response): Promise<boolean> {
    return false
  }

  protected getNegativePrompt(): string | undefined {
    return undefined
  }

  protected getRequestIntervalMs(): number {
    return 0
  }

  protected getRetryBackoffMs(): readonly number[] {
    return []
  }

  async generate(apiKey: string, model: string, request: ImageRequest): Promise<ImageResult> {
    const backoffs = this.getRetryBackoffMs()
    const maxRetries = backoffs.length
    const intervalMs = this.getRequestIntervalMs()

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      if (intervalMs > 0 && attempt === 0) {
        const elapsed = Date.now() - lastRequestTime
        if (elapsed < intervalMs) {
          await sleep(intervalMs - elapsed)
        }
        lastRequestTime = Date.now()
      }

      const body = this.buildRequestBody(model, request)
      const response = await fetch(this.getEndpoint(), {
        method: 'POST',
        headers: this.getHeaders(apiKey),
        body: JSON.stringify(body),
      })

      if (response.status === 429) {
        const shouldRetry = await this.handleRateLimit(response)
        if (shouldRetry && attempt < maxRetries) {
          const delay = backoffs[attempt]
          console.warn(`[${this.provider}] 429 限流，${delay / 1000}s 后重试 (${attempt + 1}/${maxRetries})...`)
          await sleep(delay)
          continue
        }
        throw new ImageModelError(this.provider, 429, 'Too Many Requests')
      }

      if (!response.ok) {
        const errorData = await response.json().catch(() => null)
        const code = errorData?.code || ''
        const msg = errorData?.message || ''
        const shortMsg = msg.split('.')[0].split('，')[0].slice(0, 80)
        throw new ImageModelError(this.provider, response.status, code || shortMsg || 'Server Error')
      }

      const data = await response.json()
      const imageUrl = this.extractImageUrl(data)
      if (!imageUrl) {
        throw new Error(`${this.provider} 图片生成 API 返回了空结果`)
      }

      return { imageUrl, cdnUrl: imageUrl }
    }

    throw new ImageModelError(this.provider, 0, '图片生成超过最大重试次数')
  }

  async downloadImage(url: string): Promise<Buffer> {
    const response = await fetch(url)
    if (!response.ok) {
      throw new Error(`图片下载失败: ${response.status}`)
    }
    const arrayBuffer = await response.arrayBuffer()
    return Buffer.from(arrayBuffer)
  }
}

export class ImageModelError extends Error {
  constructor(
    public provider: string,
    public statusCode: number,
    public detail: string,
  ) {
    super(`${provider} API 请求失败: ${statusCode} ${detail}`)
  }
}

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))
let lastRequestTime = 0
