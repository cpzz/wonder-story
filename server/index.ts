import express from 'express'
import cors from 'cors'
import booksRouter from './routes/books'
import optionsRouter from './routes/options'
import storyRouter from './routes/story'
import troubleRouter from './routes/trouble'
import translateRouter from './routes/translate'
import qwenImageRouter from './routes/qwenImage'
import adminApiKeysRouter from './routes/admin/apiKeys'
import adminLlmSettingsRouter from './routes/admin/llmSettings'
import adminConfigPersistRouter from './routes/admin/configPersist'
import llmStatusRouter from './routes/llmStatus'

// 为所有 console 输出添加时间戳
;(function patchConsole() {
  const pad = (n: number) => String(n).padStart(2, '0')
  const ts = () => {
    const now = new Date()
    return `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}.${String(now.getMilliseconds()).padStart(3, '0')}`
  }
  const _log = console.log
  const _warn = console.warn
  const _error = console.error
  console.log = (...args) => _log(`[${ts()}]`, ...args)
  console.warn = (...args) => _warn(`[${ts()}]`, ...args)
  console.error = (...args) => _error(`[${ts()}]`, ...args)
})()

const app = express()
app.use(cors())
app.use(express.json())

app.use('/api/books', booksRouter)
app.use('/api/options', optionsRouter)
app.use('/api/story', storyRouter)
app.use('/api/trouble', troubleRouter)
app.use('/api/translate', translateRouter)
app.use('/api/qwen-image', qwenImageRouter)
app.use('/api/llm-status', llmStatusRouter)
app.use('/api/admin/api-keys', adminApiKeysRouter)
app.use('/api/admin/llm-settings', adminLlmSettingsRouter)
app.use('/api/admin/config', adminConfigPersistRouter)

const PORT = Number(process.env.PORT) || 3002
app.listen(PORT, () => {
  console.log(`API server → http://localhost:${PORT}`)
})
