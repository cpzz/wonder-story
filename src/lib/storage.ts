import fs from 'fs'
import path from 'path'

const DATA_DIR = path.join(process.cwd(), 'data')

function ensureDataDir(): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true })
  }
}

const cache = new Map<string, unknown>()

export function readJson<T>(filename: string, defaultValue: T): T {
  if (cache.has(filename)) return cache.get(filename) as T
  ensureDataDir()
  const filePath = path.join(DATA_DIR, filename)
  if (!fs.existsSync(filePath)) {
    return defaultValue
  }
  try {
    const content = fs.readFileSync(filePath, 'utf-8')
    const data = JSON.parse(content) as T
    cache.set(filename, data)
    return data
  } catch {
    return defaultValue
  }
}

export function writeJson<T>(filename: string, data: T): void {
  ensureDataDir()
  const filePath = path.join(DATA_DIR, filename)
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8')
  cache.set(filename, data)
}
