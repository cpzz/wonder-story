import { Router } from 'express'
import { getActiveLLMKey } from '@/lib/configStore'
import { decrypt } from '@/lib/crypto'
import { getBookById, saveImage, hasImage, saveRefImage, hasRefImage, updateBook } from '@/lib/booksStore'
import { getStylePrompt } from '@/lib/illustrationStyles'
import type { CharacterCard } from '@/types'

const DASHSCOPE_ENDPOINT = 'https://dashscope.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation'

export class QwenImageError extends Error {
  constructor(public statusCode: number, public detail: string) {
    super(`qwen-image API 请求失败: ${statusCode} ${detail}`)
  }
}

// 「不同动物融合一体」含半兔半鼠式等：多只动物特征错误拼在同一身体上
const NEGATIVE_PROMPT =
  '低分辨率，低画质，肢体畸形，手指畸形，多余肢体，缺少肢体，穿模，模型穿插，身体扭曲，比例失调，脸部变形，五官错乱，眼睛不对称，多只眼睛，第三只眼，三只眼，独眼，多张嘴，额外的头，单耳，缺耳，耳朵数量错误，不对称耳朵，关节异常，骨骼扭曲，身体部位重叠，嵌合体，杂交，不同动物融合一体，多动物头，多个动物头部拼在一个身体上，物种混合，把两个角色的特征画在同一个身体上，随意添加触角，多余触角，参考图中没有的触角，凭空触角，不相符的触角，画面过饱和，蜡像感，塑料假皮，人脸无细节，过度光滑，皮毛质感混乱，画面具有AI感，构图混乱，文字模糊，扭曲，恐怖，怪异。'

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

/**
 * 通义多模态生图：与官方示例一致，user.content 按顺序为
 * `{ image: url }` …（图1、图2、图3，仅支持公网 http(s) URL）再接 `{ text: prompt }`。
 * 不支持 file:// 或 base64。
 */
async function callQwenImageAPI(
  apiKey: string,
  model: string,
  request: QwenImageRequest,
): Promise<string> {
  const imageItems = (request.referenceUrls ?? []).slice(0, 3).map((url) => ({ image: url }))
  // qwen-image-2.0 或带参考图时走 messages；否则旧模型可走单段 prompt
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
      throw new QwenImageError(429, 'Too Many Requests')
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => null)
      const code = errorData?.code || ''
      const msg = errorData?.message || ''
      const shortMsg = msg.split('.')[0].split('，')[0].slice(0, 80)
      throw new QwenImageError(response.status, code || shortMsg || 'Server Error')
    }

    const data = await response.json() as QwenImageResponse

    if (data.code || data.message) {
      throw new QwenImageError(0, `${data.code} ${data.message}`)
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

  throw new QwenImageError(0, '图片生成超过最大重试次数')
}

async function downloadImage(url: string): Promise<Buffer> {
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`图片下载失败: ${response.status}`)
  }
  const arrayBuffer = await response.arrayBuffer()
  return Buffer.from(arrayBuffer)
}

const REFERENCE_SLOT_MAX = 3

/** 定妆成功时写入的 refImageUrl（通义返回的 CDN）；可传给多模态 API */
function isCdnReferenceUrl(u: string | undefined): boolean {
  return typeof u === 'string' && (u.startsWith('http://') || u.startsWith('https://'))
}

/**
 * 与提示词 (image 1)(image 2)(image 3) 严格一致：只读各槽位 `refImageUrl`（gen-refs 成功时记录的 CDN），
 * 取下标 0→1→2 的连续前缀，遇第一个缺失或非 CDN 即停止。
 */
function getSlotReferenceUrls(characters: CharacterCard[]): string[] {
  const urls: string[] = []
  for (let slot = 0; slot < Math.min(REFERENCE_SLOT_MAX, characters.length); slot++) {
    const u = characters[slot]?.refImageUrl
    if (!isCdnReferenceUrl(u)) break
    urls.push(u)
  }
  return urls
}

function buildCharacterDesc(characters: CharacterCard[], slotUrls: string[]): string {
  if (!characters.length) return ''
  const k = slotUrls.length

  const legend =
    k > 0
      ? `\n\n[Attached reference images — same order as multimodal image parts before this text]\n${slotUrls
          .map((_, j) => {
            const c = characters[j]
            return `- Image ${j + 1} (图片${j + 1}) → roster slot ${j + 1}: ${c.nameEn} (${c.name})`
          })
          .join('\n')}\nRoster slot index j (0-based) = attachment position j+1. Use (image N) /（图片N）in the page prompt with this same N.\n`
      : ''

  const lines = characters
    .map((c, index) => {
      const hasAttachedSlot = index < k
      const slotTag = hasAttachedSlot
        ? ` [reference image ${index + 1} / 图片${index + 1} — roster slot ${index + 1}]`
        : ' (no CDN reference image attached for this roster slot in this request; match text only)'
      return `- ${c.nameEn} (${c.name})${slotTag}: ${c.species}, ${c.bodyType}. Face: ${c.face}. Color: ${c.color}. Outfit: ${c.outfit}. FORBIDDEN: ${c.forbidden}.`
    })
    .join('\n')

  return (
    legend +
    `\nCharacter reference (keep appearance STRICTLY consistent):\n${lines}\n\nConsistency for illustration: keep the **same character identity** (species, face, fur/skin colors and patterns, markings, outfit design) as the character sheet and reference images — do not recolor or change outfit/markings unless the page story text explicitly describes such a change. **Independently for each page**, vary pose, expression, gesture, viewpoint, and scene composition so spreads do not look like repeated copies of the reference portrait.\n\nReference fidelity (when reference images are attached): use each reference as the **ground truth for which anatomy exists** (antennae, horns, feelers, ears, tail, wings, snout, markings) — do **not** add features absent from that reference, and do **not** let stray words in the prompt override that. References define **who**, not **one fixed pose**: render a **new** pose and moment each time; never paste the catalog neutral stance onto every page.\n\nSpecies lock: each roster character is exactly ONE species/identity — never merge two reference images or two characters into one chimera; never put another character’s ears/snout/tail/pattern on the wrong body.\nScale lock: across **all** illustrations, preserve one **fixed cast-wide proportional hierarchy** for the **whole recurring roster** (any pair or group): same relative height, bulk, and size ordering vs. **every other** recurring character as in reference portraits and cards on **every** page and the cover — **never** invert or reshuffle who reads as larger or smaller compared to other spreads unless the story explicitly demands a size-changing event. Perspective must not overturn that hierarchy.\nAnatomy lock: bilateral symmetry; two eyes, one mouth, two ears for normal mammals; no third eye, no missing ear, no duplicated faces; no invented antennae/horns/wings/tail shapes not visible on the reference.\nTexture lock: use the same fur/feather/skin rendering style and material finish as the reference images (avoid random shifts between ultra-smooth plastic and fluffy fur for the same character).`
  )
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

    /** 先处理 roster 槽位 0–2，再处理其余角色，保证与 translate / 生图 API 的 Image 1–3 顺序一致 */
    const processOrder: number[] = [
      ...Array.from({ length: Math.min(REFERENCE_SLOT_MAX, characters.length) }, (_, i) => i),
      ...Array.from({ length: Math.max(0, characters.length - REFERENCE_SLOT_MAX) }, (_, j) => j + REFERENCE_SLOT_MAX),
    ]

    for (const i of processOrder) {
      const c = characters[i]
      if (!c.refPrompt) {
        results.push({ index: i, name: c.name, success: false, error: '无 refPrompt' })
        continue
      }
      if (hasRefImage(bookId, i)) {
        // refImageUrl 只存定妆 API 返回的 CDN；仅有本地文件时不在 JSON 里伪造 URL（展示可走 GET …/refs/:i）
        if (isCdnReferenceUrl(c.refImageUrl)) {
          updatedCharacters[i] = { ...c }
        } else {
          const { refImageUrl: _omit, ...rest } = c
          updatedCharacters[i] = rest
        }
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
        // 记录通义返回的 CDN，供 /generate 多模态参考图与本书持久化一致
        updatedCharacters[i] = { ...c, refImageUrl: cdnUrl }
        console.log(`[qwen-image] 角色参考图 [${i}] ${c.nameEn} 已保存, cdnUrl=${cdnUrl.slice(0, 60)}...`)
        results.push({ index: i, name: c.name, success: true })
      } catch (err) {
        console.error(`[qwen-image] 角色参考图 [${i}] ${c.nameEn} 生成失败:`, err)
        const statusCode = err instanceof QwenImageError ? err.statusCode : 0
        const detail = err instanceof QwenImageError ? err.detail : String(err)
        results.push({ index: i, name: c.name, success: false, statusCode, detail })
        break
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
      return res.status(400).json({ error: 'Illustration model not configured' })
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
    if (!book?.story?.pages?.length) return res.status(404).json({ error: '绘本不存在或没有故事页' })

    const keyConfig = getActiveLLMKey('picture')
    if (!keyConfig) return res.status(400).json({ error: '未配置绘本图片模型' })

    const plainKey = decrypt(keyConfig.keyEncrypted)
    const modelName = keyConfig.model?.includes('edit') ? 'qwen-image-2.0-pro' : keyConfig.model
    const characters = book.characters ?? []
    const referenceUrls = getSlotReferenceUrls(characters)
    const charDesc = buildCharacterDesc(characters, referenceUrls)
    const stylePrompt = getStylePrompt(book.illustrationStyleId)
    console.log(`[qwen-image] 角色档案卡: ${characters.length} 个, 参考图URL: ${referenceUrls.length} 个, 风格: ${book.illustrationStyleId ?? 'watercolor'}`)
    const results: Array<{ pageNumber: number; success: boolean; error?: string }> = []

    // ── Cover image (pageNumber 0) ──────────────────────────────
    const shouldGenCover = !pageNumbers || pageNumbers.includes(0)
    if (shouldGenCover && book.story.cover?.imagePrompt && !hasImage(bookId, 0)) {
      try {
        console.log('[qwen-image] 正在生成封面图片...')
        const imageUrl = await callQwenImageAPI(plainKey, modelName, {
          prompt: book.story.cover.imagePrompt + ', ' + stylePrompt + charDesc,
          size: size || '1024*1024',
          referenceUrls,
        })
        const buffer = await downloadImage(imageUrl)
        saveImage(bookId, 0, buffer)
        console.log('[qwen-image] 封面图片已保存')
        results.push({ pageNumber: 0, success: true })
      } catch (err) {
        console.error('[qwen-image] 封面生成失败:', err)
        const statusCode = err instanceof QwenImageError ? err.statusCode : 0
        const detail = err instanceof QwenImageError ? err.detail : String(err)
        results.push({ pageNumber: 0, success: false, statusCode, detail })
      }
    }

    // ── Regular pages ───────────────────────────────────────────
    const pages = book.story.pages
      .filter(p => !pageNumbers || pageNumbers.includes(p.pageNumber))
      .sort((a, b) => a.pageNumber - b.pageNumber)

    if (results.length === 0 && pages.length === 0) return res.status(400).json({ error: '没有需要生成的页面' })

    for (const page of pages) {
      try {
        if (hasImage(bookId, page.pageNumber)) {
          results.push({ pageNumber: page.pageNumber, success: true, error: '已存在' })
          continue
        }

        if (!page.imagePrompt?.trim()) {
          results.push({ pageNumber: page.pageNumber, success: false, error: '缺少 imagePrompt' })
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
        const statusCode = err instanceof QwenImageError ? err.statusCode : 0
        const detail = err instanceof QwenImageError ? err.detail : String(err)
        results.push({ pageNumber: page.pageNumber, success: false, statusCode, detail })
      }
    }

    res.json({ success: true, results })
  } catch (err) {
    console.error('[POST /api/qwen-image/generate]', err)
    res.status(500).json({ error: '生成图片失败' })
  }
})

export default router
