import { Router } from 'express'
import { getActiveLLMKey } from '@/lib/configStore'
import { decrypt } from '@/lib/crypto'
import { getBookById, saveImage, hasImage } from '@/lib/booksStore'

const DASHSCOPE_ENDPOINT = 'https://dashscope.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation'

const NEGATIVE_PROMPT = '低分辨率，低画质，肢体畸形，手指畸形，画面过饱和，蜡像感，人脸无细节，过度光滑，画面具有AI感。构图混乱。文字模糊，扭曲。'

interface QwenImageRequest {
  prompt: string
  size?: string
  negativePrompt?: string
  promptExtend?: boolean
  watermark?: boolean
  seed?: number
}

interface QwenImageResponse {
  output?: {
    choices?: Array<{
      message?: {
        content?: Array<{ image?: string }>
      }
    }>
  }
  code?: string
  message?: string
}

async function callQwenImageAPI(
  apiKey: string,
  model: string,
  request: QwenImageRequest,
): Promise<string> {
  const body = {
    model,
    input: {
      messages: [
        {
          role: 'user',
          content: [{ text: request.prompt }],
        },
      ],
    },
    parameters: {
      size: request.size || '1024*1024',
      n: 1,
      negative_prompt: request.negativePrompt ?? NEGATIVE_PROMPT,
      prompt_extend: request.promptExtend ?? true,
      watermark: request.watermark ?? false,
      ...(request.seed !== undefined && { seed: request.seed }),
    },
  }

  const response = await fetch(DASHSCOPE_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`qwen-image API 请求失败: ${response.status} ${errorText}`)
  }

  const data = await response.json() as QwenImageResponse

  if (data.code || data.message) {
    throw new Error(`图片生成失败: ${data.code} ${data.message}`)
  }

  const imageUrl = data.output?.choices?.[0]?.message?.content?.[0]?.image
  if (!imageUrl) {
    throw new Error('图片生成 API 返回了空结果')
  }

  return imageUrl
}

async function downloadImage(url: string): Promise<Buffer> {
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`图片下载失败: ${response.status}`)
  }
  const arrayBuffer = await response.arrayBuffer()
  return Buffer.from(arrayBuffer)
}

const router = Router()

// 测试图片生成 API 连接
router.post('/test', async (req, res) => {
  try {
    const { prompt, model }: { prompt?: string; model?: string } = req.body

    const keyConfig = getActiveLLMKey('picture')
    if (!keyConfig) {
      return res.status(400).json({ error: '未配置绘本图片模型' })
    }

    const plainKey = decrypt(keyConfig.keyEncrypted)
    const testPrompt = prompt || '一只可爱的小兔子坐在月亮上，卡通风格，温暖的色调'

    const imageUrl = await callQwenImageAPI(plainKey, model || keyConfig.model, {
      prompt: testPrompt,
      size: '1024*1024',
    })

    res.json({ success: true, imageUrl, model: keyConfig.model })
  } catch (err) {
    console.error('[POST /api/qwen-image/test]', err)
    res.status(500).json({ error: String(err) })
  }
})

// 为绘本生成图片
router.post('/generate', async (req, res) => {
  try {
    const { bookId, pageNumbers, size }: { bookId: string; pageNumbers?: number[]; size?: string } = req.body
    if (!bookId) return res.status(400).json({ error: '缺少绘本 ID' })

    const book = getBookById(bookId)
    if (!book?.pictureBook) return res.status(404).json({ error: '绘本不存在或尚未生成绘本描述' })

    const keyConfig = getActiveLLMKey('picture')
    if (!keyConfig) return res.status(400).json({ error: '未配置绘本图片模型' })

    const pages = book.pictureBook.pages
      .filter(p => !pageNumbers || pageNumbers.includes(p.pageNumber))
      .sort((a, b) => a.pageNumber - b.pageNumber)

    if (pages.length === 0) return res.status(400).json({ error: '没有需要生成的页面' })

    const plainKey = decrypt(keyConfig.keyEncrypted)
    const results: Array<{ pageNumber: number; success: boolean; error?: string }> = []

    for (const page of pages) {
      try {
        if (hasImage(bookId, page.pageNumber)) {
          results.push({ pageNumber: page.pageNumber, success: true, error: '已存在' })
          continue
        }

        console.log(`[qwen-image] 正在生成第 ${page.pageNumber} 页图片...`)
        const modelName = keyConfig.model?.includes('edit') ? 'qwen-image-2.0-pro' : keyConfig.model
        const imageUrl = await callQwenImageAPI(plainKey, modelName, {
          prompt: page.imagePrompt,
          size: size || '1024*1024',
        })

        console.log(`[qwen-image] 正在下载第 ${page.pageNumber} 页图片...`)
        const buffer = await downloadImage(imageUrl)

        saveImage(bookId, page.pageNumber, buffer)
        console.log(`[qwen-image] 第 ${page.pageNumber} 页图片已保存`)

        results.push({ pageNumber: page.pageNumber, success: true })
      } catch (err) {
        console.error(`[qwen-image] 第 ${page.pageNumber} 页生成失败:`, err)
        results.push({ pageNumber: page.pageNumber, success: false, error: String(err) })
      }
    }

    res.json({ success: true, results })
  } catch (err) {
    console.error('[POST /api/qwen-image/generate]', err)
    res.status(500).json({ error: '生成图片失败' })
  }
})

export default router
