import { Router } from 'express'
import { getActiveLLMKey } from '@/lib/configStore'
import { decrypt } from '@/lib/crypto'
import { getBookById, saveImage, hasImage, saveRefImage, hasRefImage, updateBook } from '@/lib/booksStore'
import { getStylePrompt } from '@/lib/illustrationStyles'
import type { CharacterCard } from '@/types'

const DASHSCOPE_ENDPOINT = 'https://dashscope.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation'

const NEGATIVE_PROMPT = '低分辨率，低画质，肢体畸形，手指畸形，多余肢体，缺少肢体，穿模，模型穿插，身体扭曲，比例失调，脸部变形，五官错乱，眼睛不对称，多只眼睛，多张嘴，额外的头，关节异常，骨骼扭曲，身体部位重叠，画面过饱和，蜡像感，人脸无细节，过度光滑，画面具有AI感，构图混乱，文字模糊，扭曲，恐怖，怪异。'

// 每次生成插图或参考图（定妆）之间，两次调用通义生图 API 至少间隔约 10 秒
const REQUEST_INTERVAL_MS = 10_000
// After each 429, wait before next attempt: 10s → 20s → 40s (at most 3 retries)
const RATE_LIMIT_RETRY_BACKOFF_MS = [10_000, 20_000, 40_000] as const
const MAX_429_RETRIES = RATE_LIMIT_RETRY_BACKOFF_MS.length

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))
let lastRequestTime = 0


interface QwenImageRequest {
  prompt: string
  size?: string
  negativePrompt?: string
  promptExtend?: boolean
  watermark?: boolean
  seed?: number
  referenceUrls?: string[]  // Qwen CDN URLs of character reference images (max 3)
}

interface QwenImageResponse {
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

async function callQwenImageAPI(
  apiKey: string,
  model: string,
  request: QwenImageRequest,
): Promise<string> {
  const imageItems = (request.referenceUrls ?? []).slice(0, 3).map((url) => ({ image: url }))
  // qwen-image-2.0 series always uses input.messages format; older models use input.prompt
  const isV2 = model.startsWith('qwen-image-2.')

  const body = {
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

  for (let attempt = 0; attempt <= MAX_429_RETRIES; attempt++) {
    // Enforce minimum interval between requests
    const elapsed = Date.now() - lastRequestTime
    if (elapsed < REQUEST_INTERVAL_MS) {
      await sleep(REQUEST_INTERVAL_MS - elapsed)
    }
    lastRequestTime = Date.now()

    const response = await fetch(DASHSCOPE_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
    })

    if (response.status === 429) {
      if (attempt < MAX_429_RETRIES) {
        const delay = RATE_LIMIT_RETRY_BACKOFF_MS[attempt]
        console.warn(`[qwen-image] 429 限流，${delay / 1000}s 后重试 (${attempt + 1}/${MAX_429_RETRIES})...`)
        await sleep(delay)
        continue
      }
      const errorText = await response.text()
      throw new Error(`qwen-image API 请求失败: 429 ${errorText}`)
    }

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`qwen-image API 请求失败: ${response.status} ${errorText}`)
    }

    const data = await response.json() as QwenImageResponse

    if (data.code || data.message) {
      throw new Error(`图片生成失败: ${data.code} ${data.message}`)
    }

    // Simple format: output.results[].url (qwen-image-plus / sync)
    // Multimodal format: output.choices[].message.content[].image
    const imageUrl =
      data.output?.results?.[0]?.url ??
      data.output?.choices?.[0]?.message?.content?.[0]?.image
    if (!imageUrl) {
      throw new Error('图片生成 API 返回了空结果')
    }

    return imageUrl
  }

  throw new Error('图片生成超过最大重试次数')
}

async function downloadImage(url: string): Promise<Buffer> {
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`图片下载失败: ${response.status}`)
  }
  const arrayBuffer = await response.arrayBuffer()
  return Buffer.from(arrayBuffer)
}

import fs from 'fs'

// Build character appearance description, referencing image positions when CDN URLs are available
function buildCharacterDesc(characters: CharacterCard[]): string {
  if (!characters.length) return ''
  const lines = characters.map((c, i) => {
    const imgRef = c.refImageUrl?.startsWith('http') ? ` [see Image ${i + 1}]` : ''
    return `- ${c.nameEn} (${c.name})${imgRef}: ${c.species}, ${c.bodyType}. Face: ${c.face}. Color: ${c.color}. Outfit: ${c.outfit}. FORBIDDEN: ${c.forbidden}.`
  }).join('\n')
  return `\n\nCharacter reference (keep appearance STRICTLY consistent):\n${lines}`
}

const router = Router()

// 生成角色定妆参考图
router.post('/gen-refs', async (req, res) => {
  try {
    const { bookId }: { bookId: string } = req.body
    if (!bookId) return res.status(400).json({ error: '缺少 bookId' })

    const book = getBookById(bookId)
    if (!book) return res.status(404).json({ error: '绘本不存在' })

    const characters = book.characters ?? []
    if (characters.length === 0) return res.json({ success: true, results: [] })

    const keyConfig = getActiveLLMKey('picture')
    if (!keyConfig) return res.status(400).json({ error: '未配置绘本图片模型' })

    const plainKey = decrypt(keyConfig.keyEncrypted)
    const modelName = keyConfig.model?.includes('edit') ? 'qwen-image-2.0-pro' : keyConfig.model
    const results: Array<{ index: number; name: string; success: boolean; error?: string }> = []
    const updatedCharacters = [...characters]

    for (let i = 0; i < characters.length; i++) {
      const c = characters[i]
      if (!c.refPrompt) {
        results.push({ index: i, name: c.name, success: false, error: '无 refPrompt' })
        continue
      }
      if (hasRefImage(bookId, i)) {
        updatedCharacters[i] = { ...c, refImageUrl: `/api/books/${bookId}/refs/${i}` }
        results.push({ index: i, name: c.name, success: true, error: '已存在' })
        continue
      }
      try {
        console.log(`[qwen-image] 生成角色参考图 [${i}] ${c.nameEn}...`)
        const cdnUrl = await callQwenImageAPI(plainKey, modelName, {
          prompt: c.refPrompt,
          size: '1024*1024',
          promptExtend: false,
        })
        const buffer = await downloadImage(cdnUrl)
        saveRefImage(bookId, i, buffer)
        // Save the CDN URL so it can be passed as image reference in later generation calls
        updatedCharacters[i] = { ...c, refImageUrl: cdnUrl }
        console.log(`[qwen-image] 角色参考图 [${i}] ${c.nameEn} 已保存, cdnUrl=${cdnUrl.slice(0, 60)}...`)
        results.push({ index: i, name: c.name, success: true })
      } catch (err) {
        console.error(`[qwen-image] 角色参考图 [${i}] ${c.nameEn} 生成失败:`, err)
        results.push({ index: i, name: c.name, success: false, error: String(err) })
      }
    }

    // Update book's characters with refImageUrl
    updateBook(bookId, (b) => ({ ...b, characters: updatedCharacters }))

    res.json({ success: true, results })
  } catch (err) {
    console.error('[POST /api/qwen-image/gen-refs]', err)
    res.status(500).json({ error: '生成参考图失败' })
  }
})

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

    const plainKey = decrypt(keyConfig.keyEncrypted)
    const modelName = keyConfig.model?.includes('edit') ? 'qwen-image-2.0-pro' : keyConfig.model
    const characters = book.characters ?? []
    const charDesc = buildCharacterDesc(characters)
    const referenceUrls = characters
      .map((c) => c.refImageUrl)
      .filter((u): u is string => !!u && u.startsWith('http'))
      .slice(0, 3)
    const stylePrompt = getStylePrompt(book.illustrationStyleId)
    console.log(`[qwen-image] 角色档案卡: ${characters.length} 个, 参考图URL: ${referenceUrls.length} 个, 风格: ${book.illustrationStyleId ?? 'watercolor'}`)
    const results: Array<{ pageNumber: number; success: boolean; error?: string }> = []

    // ── Cover image (pageNumber 0) ──────────────────────────────
    const shouldGenCover = !pageNumbers || pageNumbers.includes(0)
    if (shouldGenCover && book.pictureBook.coverPrompt && !hasImage(bookId, 0)) {
      try {
        console.log('[qwen-image] 正在生成封面图片...')
        const imageUrl = await callQwenImageAPI(plainKey, modelName, {
          prompt: book.pictureBook.coverPrompt + ', ' + stylePrompt + charDesc,
          size: size || '1024*1024',
          referenceUrls,
        })
        const buffer = await downloadImage(imageUrl)
        saveImage(bookId, 0, buffer)
        console.log('[qwen-image] 封面图片已保存')
        results.push({ pageNumber: 0, success: true })
      } catch (err) {
        console.error('[qwen-image] 封面生成失败:', err)
        results.push({ pageNumber: 0, success: false, error: String(err) })
      }
    }

    // ── Regular pages ───────────────────────────────────────────
    const pages = book.pictureBook.pages
      .filter(p => !pageNumbers || pageNumbers.includes(p.pageNumber))
      .sort((a, b) => a.pageNumber - b.pageNumber)

    if (results.length === 0 && pages.length === 0) return res.status(400).json({ error: '没有需要生成的页面' })

    for (const page of pages) {
      try {
        if (hasImage(bookId, page.pageNumber)) {
          results.push({ pageNumber: page.pageNumber, success: true, error: '已存在' })
          continue
        }

        console.log(`[qwen-image] 正在生成第 ${page.pageNumber} 页图片...`)
        const imageUrl = await callQwenImageAPI(plainKey, modelName, {
          prompt: page.imagePrompt + ', ' + stylePrompt + charDesc,
          size: size || '1024*1024',
          referenceUrls,
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
