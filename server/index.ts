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
import adminPromptsRouter from './routes/admin/prompts'
import llmStatusRouter from './routes/llmStatus'

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
app.use('/api/admin/prompts', adminPromptsRouter)

const PORT = Number(process.env.PORT) || 3002
app.listen(PORT, () => {
  console.log(`API server → http://localhost:${PORT}`)
})
