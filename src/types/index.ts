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
export type UILang = 'zh' | 'en'

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
  uiLang?: UILang
}

/**
 * 多语言文本字段。
 * - `text` 必填，存放创作时的主体语言（中文）原文。
 * - 其他语言为可选 `textXxx` 字段（Xxx 是 LangCode 对应的 fieldSuffix，如 En/Ja/Ko/Fr/Fi/Es/…），
 *   缺失时回退到 `text`。
 * - 朗读/界面显示时会按 `LangCode` 优先级取首个非空字段。
 */
export type LocalizedText = {
  text: string
  [key: `text${string}`]: string | undefined
}

/** 单条多语言文本（用于 Guide 的 emotion/message / BookItem.title 等） */
export type LocalizedValue = {
  text: string
  [key: `text${string}`]: string | undefined
}

/** 多条多语言文本（用于 Guide.tips） */
export interface LocalizedList {
  text: string[]
  [key: `text${string}`]: string[] | undefined
}

export interface StoryPage extends LocalizedText {
  pageNumber: number
  /** 该页插图英文描述（文生图用） */
  imagePrompt?: string
}

/** 封面：书名 + 多语言 + 封面插图描述 */
export interface StoryCover extends LocalizedText {
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
  emotion: LocalizedValue
  message: LocalizedValue
  tips: LocalizedList
}

// ── Books ──

export interface BookItem {
  id: string
  title: LocalizedValue
  emotion: string
  scene: string
  ageGroup: string
  description?: string
  protagonistPreset?: string
  mode?: 'emotion' | 'bedtime'
  theme?: string
  textLang?: TextLang
  uiLang?: UILang
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
