import { v4 as uuidv4 } from 'uuid'
import { readJson, writeJson } from './storage'
import type { BookItem } from '@/types'

const FILENAME = 'books.json'

export function getBooks(): BookItem[] {
  return readJson<BookItem[]>(FILENAME, [])
}

export function getBookById(id: string): BookItem | undefined {
  return getBooks().find((b) => b.id === id)
}

export function saveBook(data: Omit<BookItem, 'id' | 'createdAt'>): BookItem {
  const books = getBooks()
  const book: BookItem = {
    ...data,
    id: uuidv4(),
    createdAt: new Date().toISOString(),
  }
  books.unshift(book) // newest first
  writeJson(FILENAME, books)
  return book
}

export function deleteBook(id: string): boolean {
  const books = getBooks()
  const filtered = books.filter((b) => b.id !== id)
  if (filtered.length === books.length) return false
  writeJson(FILENAME, filtered)
  return true
}
