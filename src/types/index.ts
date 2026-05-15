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
}

export interface Story {
  title: { text: string; textEn?: string }
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
  refImageUrl?: string // 定妆图 URL（图像模型生成后填入）
}

export interface PictureBookPage {
  pageNumber: number
  text: string
  textEn?: string
  imagePrompt: string
  imageUrl?: string    // 实际插图 URL（图像模型生成后填入）
}

export interface PictureBook {
  title: { text: string; textEn?: string }
  coverPrompt?: string   // 封面插画描述（图像模型生成封面用）
  pages: PictureBookPage[]
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
  pictureBook?: PictureBook
  createdAt: string
}

// ── Dropdown Options ──

export interface DropdownOptions {
  emotions: string[]
  scenes: string[]
  ageGroups: string[]
  themes: string[]
}
