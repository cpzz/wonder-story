import { ImageModelAdapter, type ImageRequest } from './imageAdapter'

const OPENAI_ENDPOINT = 'https://api.openai.com/v1/images/generations'

export class OpenAIImageAdapter extends ImageModelAdapter {
  readonly provider = 'openai'

  protected getEndpoint(): string {
    return OPENAI_ENDPOINT
  }

  protected buildRequestBody(model: string, request: ImageRequest): unknown {
    return {
      model,
      prompt: request.prompt,
      n: 1,
      size: request.size || '1024x1024',
      ...(request.seed !== undefined && { seed: request.seed }),
    }
  }

  protected extractImageUrl(response: unknown): string {
    const data = response as {
      data?: Array<{ url?: string; b64_json?: string }>
    }
    return data.data?.[0]?.url ?? data.data?.[0]?.b64_json ?? ''
  }
}
