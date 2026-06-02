import { ImageModelAdapter, type ImageRequest } from './imageAdapter'

const DASHSCOPE_ENDPOINT = 'https://dashscope.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation'

const NEGATIVE_PROMPT =
  '低分辨率，低画质，肢体畸形，手指畸形，多余肢体，缺少肢体，穿模，模型穿插，身体扭曲，比例失调，脸部变形，五官错乱，眼睛不对称，多只眼睛，第三只眼，三只眼，独眼，多张嘴，额外的头，单耳，缺耳，耳朵数量错误，不对称耳朵，关节异常，骨骼扭曲，身体部位重叠，嵌合体，杂交，不同动物融合一体，多动物头，多个动物头部拼在一个身体上，物种混合，把两个角色的特征画在同一个身体上，随意添加触角，多余触角，参考图中没有的触角，凭空触角，不相符的触角，画面过饱和，蜡像感，塑料假皮，人脸无细节，过度光滑，皮毛质感混乱，画面具有AI感，构图混乱，文字模糊，扭曲，恐怖，怪异。'

const REQUEST_INTERVAL_MS = 10_000
const RATE_LIMIT_RETRY_BACKOFF_MS = [10_000, 20_000, 40_000] as const

export class QwenImageAdapter extends ImageModelAdapter {
  readonly provider = 'qwen'

  protected getEndpoint(): string {
    return DASHSCOPE_ENDPOINT
  }

  protected getRequestIntervalMs(): number {
    return REQUEST_INTERVAL_MS
  }

  protected getRetryBackoffMs(): readonly number[] {
    return RATE_LIMIT_RETRY_BACKOFF_MS
  }

  protected getNegativePrompt(): string | undefined {
    return NEGATIVE_PROMPT
  }

  protected async handleRateLimit(_response: Response): Promise<boolean> {
    return true
  }

  protected buildRequestBody(model: string, request: ImageRequest): unknown {
    const imageItems = (request.referenceUrls ?? []).slice(0, 3).map((url) => ({ image: url }))
    const isV2 = model.startsWith('qwen-image-2.')

    return {
      model,
      input: isV2 || imageItems.length > 0
        ? {
            messages: [
              {
                role: 'user',
                content: [
                  ...imageItems,
                  { text: request.prompt },
                ],
              },
            ],
          }
        : { prompt: request.prompt },
      parameters: {
        size: request.size || '1024*1024',
        n: 1,
        negative_prompt: request.negativePrompt ?? NEGATIVE_PROMPT,
        prompt_extend: request.promptExtend ?? true,
        watermark: request.watermark ?? false,
        ...(request.seed !== undefined && { seed: request.seed }),
      },
    }
  }

  protected extractImageUrl(response: unknown): string {
    const data = response as {
      output?: {
        results?: Array<{ url?: string }>
        choices?: Array<{
          message?: {
            content?: Array<{ image?: string }>
          }
        }>
      }
      code?: string
      message?: string
    }

    if (data.code || data.message) {
      throw new Error(`${data.code} ${data.message}`)
    }

    return (
      data.output?.results?.[0]?.url ??
      data.output?.choices?.[0]?.message?.content?.[0]?.image ??
      ''
    )
  }
}
