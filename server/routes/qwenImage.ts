import { Router } from 'express'
import { getActiveLLMKey } from '@/lib/configStore'
import { decrypt } from '@/lib/crypto'
import { getBookById, saveImage, hasImage, saveRefImage, hasRefImage, updateBook } from '@/lib/booksStore'
import { getStylePrompt } from '@/lib/illustrationStyles'
import type { CharacterCard } from '@/types'
import { createImageAdapter } from '../lib/image/factory'

export class QwenImageError extends Error {
  constructor(public statusCode: number, public detail: string) {
    super(`qwen-image API 请求失败: ${statusCode} ${detail}`)
  }
}

const REFERENCE_SLOT_MAX = 3

function isCdnReferenceUrl(u: string | undefined): boolean {
  return typeof u === 'string' && (u.startsWith('http://') || u.startsWith('https://'))
}

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
    `\nCharacter reference (keep appearance STRICTLY consistent):\n${lines}\n\nConsistency for illustration: keep the **same character identity** (species, face, fur/skin colors and patterns, markings, outfit design) as the character sheet and reference images — do not recolor or change outfit/markings unless the page story text explicitly describes such a change. **Independently for each page**, vary pose, expression, gesture, viewpoint, and scene composition so spreads do not look like repeated copies of the reference portrait.\n\nReference fidelity (when reference images are attached): use each reference as the **ground truth for which anatomy exists** (antennae, horns, feelers, ears, tail, wings, snout, markings) — do **not** add features absent from that reference, and do **not** let stray words in the prompt override that. References define **who**, not **one fixed pose**: render a **new** pose and moment each time; never paste the catalog neutral stance onto every page.\n\nSpecies lock: each roster character is exactly ONE species/identity — never merge two reference images or two characters into one chimera; never put another character's ears/snout/tail/pattern on the wrong body.\nScale lock: across **all** illustrations, preserve one **fixed cast-wide proportional hierarchy** for the **whole recurring roster** (any pair or group): same relative height, bulk, and size ordering vs. **every other** recurring character as in reference portraits and cards on **every** page and the cover — **never** invert or reshuffle who reads as larger or smaller compared to other spreads unless the story explicitly demands a size-changing event. Perspective must not overturn that hierarchy.\nAnatomy lock: bilateral symmetry; two eyes, one mouth, two ears for normal mammals; no third eye, no missing ear, no duplicated faces; no invented antennae/horns/wings/tail shapes not visible on the reference.\nTexture lock: use the same fur/feather/skin rendering style and material finish across all pages for each character.\n`
  )
}

const router = Router()

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
    const adapter = createImageAdapter(keyConfig.provider)
    const results: Array<{ index: number; name: string; success: boolean; error?: string }> = []
    const updatedCharacters = [...characters]

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
        const result = await adapter.generate(plainKey, modelName, {
          prompt: c.refPrompt,
          size: '1024*1024',
          promptExtend: false,
        })
        const buffer = await adapter.downloadImage(result.imageUrl)
        saveRefImage(bookId, i, buffer)
        updatedCharacters[i] = { ...c, refImageUrl: result.cdnUrl }
        console.log(`[qwen-image] 角色参考图 [${i}] ${c.nameEn} 已保存, cdnUrl=${(result.cdnUrl ?? result.imageUrl).slice(0, 60)}...`)
        results.push({ index: i, name: c.name, success: true })
      } catch (err) {
        console.error(`[qwen-image] 角色参考图 [${i}] ${c.nameEn} 生成失败:`, err)
        const statusCode = err instanceof QwenImageError ? err.statusCode : 0
        const detail = err instanceof QwenImageError ? err.detail : String(err)
        results.push({ index: i, name: c.name, success: false, statusCode, detail })
        break
      }
    }

    updateBook(bookId, (b) => ({ ...b, characters: updatedCharacters }))
    res.json({ success: true, results })
  } catch (err) {
    console.error('[POST /api/qwen-image/gen-refs]', err)
    res.status(500).json({ error: '生成参考图失败' })
  }
})

router.post('/test', async (req, res) => {
  try {
    const { prompt, model }: { prompt?: string; model?: string } = req.body

    const keyConfig = getActiveLLMKey('picture')
    if (!keyConfig) {
      return res.status(400).json({ error: 'Illustration model not configured' })
    }

    const plainKey = decrypt(keyConfig.keyEncrypted)
    const adapter = createImageAdapter(keyConfig.provider)
    const testPrompt = prompt || '一只可爱的小兔子坐在月亮上，卡通风格，温暖的色调'

    const result = await adapter.generate(plainKey, model || keyConfig.model, {
      prompt: testPrompt,
      size: '1024*1024',
    })

    res.json({ success: true, imageUrl: result.imageUrl, model: keyConfig.model })
  } catch (err) {
    console.error('[POST /api/qwen-image/test]', err)
    res.status(500).json({ error: String(err) })
  }
})

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
    const adapter = createImageAdapter(keyConfig.provider)
    const characters = book.characters ?? []
    const referenceUrls = getSlotReferenceUrls(characters)
    const charDesc = buildCharacterDesc(characters, referenceUrls)
    const stylePrompt = getStylePrompt(book.illustrationStyleId)
    console.log(`[qwen-image] 角色档案卡: ${characters.length} 个, 参考图URL: ${referenceUrls.length} 个, 风格: ${book.illustrationStyleId ?? 'watercolor'}`)
    const results: Array<{ pageNumber: number; success: boolean; error?: string }> = []

    const shouldGenCover = !pageNumbers || pageNumbers.includes(0)
    if (shouldGenCover && book.story.cover?.imagePrompt && !hasImage(bookId, 0)) {
      try {
        console.log('[qwen-image] 正在生成封面图片...')
        const result = await adapter.generate(plainKey, modelName, {
          prompt: book.story.cover.imagePrompt + ', ' + stylePrompt + charDesc,
          size: size || '1024*1024',
          referenceUrls,
        })
        const buffer = await adapter.downloadImage(result.imageUrl)
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
        const result = await adapter.generate(plainKey, modelName, {
          prompt: page.imagePrompt + ', ' + stylePrompt + charDesc,
          size: size || '1024*1024',
          referenceUrls,
        })

        console.log(`[qwen-image] 正在下载第 ${page.pageNumber} 页图片...`)
        const buffer = await adapter.downloadImage(result.imageUrl)

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
