import fs from 'fs'
import path from 'path'
import { v4 as uuidv4 } from 'uuid'
import type { BookItem, Story, StoryCover, StoryPage } from '@/types'

const USR_DIR = path.join(process.cwd(), 'user', 'books')

function ensureUsrDir(): void {
  if (!fs.existsSync(USR_DIR)) fs.mkdirSync(USR_DIR, { recursive: true })
}

function bookDir(id: string): string {
  return path.join(USR_DIR, id)
}

function bookFile(id: string): string {
  return path.join(bookDir(id), 'index.json')
}

/** 旧版 `story.title` + 可选 `pictureBook` → `story.cover` + 页级 `imagePrompt` */
export function normalizeBookItem(book: BookItem): BookItem {
  type LegacyPb = {
    title?: { text: string; textEn?: string }
    coverPrompt?: string
    pages: { pageNumber: number; text?: string; textEn?: string; imagePrompt?: string }[]
  }
  const raw = book as BookItem & { pictureBook?: LegacyPb }
  const pb = raw.pictureBook
  const s = book.story as Story & { title?: { text: string; textEn?: string } }

  let cover: StoryCover
  if (s.cover && typeof s.cover.text === 'string') {
    cover = {
      text: s.cover.text,
      ...(s.cover as Record<string, string | undefined>),
      imagePrompt: s.cover.imagePrompt ?? pb?.coverPrompt,
    }
  } else {
    const t = s.title ?? book.title
    cover = {
      text: t?.text ?? '',
      ...(t as Record<string, string | undefined>),
      imagePrompt: pb?.coverPrompt,
    }
  }

  const pages: StoryPage[] = (s.pages ?? []).map((p) => {
    const fromPb = pb?.pages?.find((pp) => pp.pageNumber === p.pageNumber)
    return {
      ...p,
      ...(fromPb as Record<string, string | undefined> | undefined),
      imagePrompt: p.imagePrompt ?? fromPb?.imagePrompt,
    }
  })

  const { pictureBook: _drop, ...rest } = raw as BookItem & { pictureBook?: LegacyPb }
  return {
    ...rest,
    title: { text: cover.text, ...(cover as Record<string, string | undefined>) },
    story: { cover, pages },
  }
}

export function imagesDir(id: string): string {
  const dir = path.join(bookDir(id), 'images')
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  return dir
}

export function saveImage(id: string, pageNumber: number, imageBuffer: Buffer): string {
  const dir = imagesDir(id)
  const imagePath = path.join(dir, `${pageNumber}.png`)
  fs.writeFileSync(imagePath, imageBuffer)
  return imagePath
}

export function getImagePath(id: string, pageNumber: number): string | undefined {
  const imagePath = path.join(imagesDir(id), `${pageNumber}.png`)
  return fs.existsSync(imagePath) ? imagePath : undefined
}

export function hasImage(id: string, pageNumber: number): boolean {
  const imagePath = path.join(imagesDir(id), `${pageNumber}.png`)
  return fs.existsSync(imagePath)
}

// ── Character reference images ───────────────────────────────────────────────

function refsPath(id: string, charIndex: number): string {
  return path.join(bookDir(id), 'refs', `${charIndex}.png`)
}

export function saveRefImage(id: string, charIndex: number, imageBuffer: Buffer): void {
  const dir = path.join(bookDir(id), 'refs')
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(refsPath(id, charIndex), imageBuffer)
}

export function getRefImagePath(id: string, charIndex: number): string | undefined {
  const p = refsPath(id, charIndex)
  return fs.existsSync(p) ? p : undefined
}

export function hasRefImage(id: string, charIndex: number): boolean {
  return fs.existsSync(refsPath(id, charIndex))
}

// ── Book mutation ────────────────────────────────────────────────────────────

export function updateBook(id: string, updater: (book: BookItem) => BookItem): BookItem | undefined {
  const book = getBookById(id)
  if (!book) return undefined
  const updated = updater(book)
  fs.writeFileSync(bookFile(id), JSON.stringify(updated, null, 2), 'utf-8')
  return updated
}

export function getBooks(): BookItem[] {
  ensureUsrDir()
  const entries = fs.readdirSync(USR_DIR, { withFileTypes: true })
  const books: BookItem[] = []
  for (const entry of entries) {
    if (!entry.isDirectory()) continue
    const file = bookFile(entry.name)
    if (!fs.existsSync(file)) continue
    try {
      books.push(normalizeBookItem(JSON.parse(fs.readFileSync(file, 'utf-8')) as BookItem))
    } catch {}
  }
  return books.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
}

export function getBookById(id: string): BookItem | undefined {
  const file = bookFile(id)
  if (!fs.existsSync(file)) return undefined
  try {
    return normalizeBookItem(JSON.parse(fs.readFileSync(file, 'utf-8')) as BookItem)
  } catch {
    return undefined
  }
}

export function saveBook(data: Omit<BookItem, 'id' | 'createdAt'>): BookItem {
  const id = uuidv4()
  const book: BookItem = { ...data, id, createdAt: new Date().toISOString() }
  const dir = bookDir(id)
  fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(bookFile(id), JSON.stringify(book, null, 2), 'utf-8')
  return book
}

export function deleteBook(id: string): boolean {
  const dir = bookDir(id)
  if (!fs.existsSync(dir)) return false
  fs.rmSync(dir, { recursive: true, force: true })
  return true
}
