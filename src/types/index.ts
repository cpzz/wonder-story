// ── API Key ──

export interface APIKey {
  id: string
  name: string
  provider: string
  model: string
  baseURL?: string
  keyEncrypted: string
  supportsImageGen: boolean
  createdAt: string
  updatedAt: string
}

export interface APIKeyInput {
  name: string
  provider: string
  model: string
  baseURL?: string
  apiKey: string
  supportsImageGen: boolean
}

export interface APIKeyView {
  id: string
  name: string
  provider: string
  model: string
  baseURL?: string
  keyMasked: string
  supportsImageGen: boolean
  createdAt: string
  updatedAt: string
}

// ── LLM Settings ──

export interface LLMSettings {
  storyLLMId: string
  pictureLLMId: string
}

/** POST /api/admin/config/persist 中 apiKeys 的每一项：rowId 为已有 id，或以 new_ 开头的客户端草稿 id */
export interface AdminPersistApiKeyInput {
  rowId: string
  name: string
  provider: string
  model: string
  baseURL?: string
  supportsImageGen: boolean
  /** 新建时可选；非空表示设置密钥（与原先 POST /api/admin/api-keys 一致） */
  apiKey?: string
}

// ── App Config ──

export interface AppConfig {
  apiKeys: APIKey[]
  llmSettings: LLMSettings
}

// ── Prompts ──

export interface PromptTemplate {
  id: string
  name: string
  type: 'story' | 'image' | 'guide' | 'bedtime-story' | 'bedtime-guide'
  meta: {
    emotion?: string
    scene?: string
    ageGroup?: string
  }
  systemPrompt: string
  userPromptTemplate: string
  createdAt: string
  updatedAt: string
}

export type TextLang = 'zh' | 'en' | 'bilingual'

export interface TroubleInput {
  emotion: string
  scene: string
  ageGroup: string
  description?: string
  /** 创作表单「主角选择」：默认「自动」，否则为预设物种/身份 */
  protagonistPreset?: string
  pageCount?: number
  mode?: 'emotion' | 'bedtime'
  theme?: string
  textLang?: TextLang
}

export interface StoryPage {
  pageNumber: number
  text: string
  textEn?: string
  /** 该页插图英文描述（文生图用） */
  imagePrompt?: string
}

/** 封面：书名 + 可选英文 + 封面插图描述 */
export interface StoryCover {
  text: string
  textEn?: string
  imagePrompt?: string
}

export interface Story {
  cover: StoryCover
  pages: StoryPage[]
}

// ── Character Bible ──

export interface CharacterCard {
  name: string         // 角色名（中文）
  nameEn: string       // 角色名（英文）
  role: string         // 主角 / 配角
  species: string      // 物种 / 种族
  face: string         // 面部特征
  color: string        // 毛发 / 肤色
  outfit: string       // 服饰
  bodyType: string     // 体型比例（如二头身Q版）
  personality: string  // 性格 / 习惯动作
  forbidden: string    // 禁用元素
  refPrompt: string    // 生成定妆图的英文 prompt
  refImageUrl?: string // 定妆图 CDN（仅 gen-refs 调用通义成功后写入的 url；非站内路径）
}

export interface Guide {
  emotion: { text: string; textEn?: string }
  message: { text: string; textEn?: string }
  tips: { text: string[]; textEn?: string[] }
}

// ── Books ──

export interface BookItem {
  id: string
  title: { text: string; textEn?: string }
  emotion: string
  scene: string
  ageGroup: string
  description?: string
  protagonistPreset?: string
  mode?: 'emotion' | 'bedtime'
  theme?: string
  textLang?: TextLang
  illustrationStyleId?: string
  characters?: CharacterCard[]
  guide: Guide
  story: Story
  createdAt: string
}

// ── Dropdown Options ──

export interface DropdownOptions {
  emotions: string[]
  scenes: string[]
  ageGroups: string[]
  themes: string[]
}
