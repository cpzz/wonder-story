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
  type: 'story' | 'image' | 'guide'
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

export interface TroubleInput {
  emotion: string
  scene: string
  ageGroup: string
  description?: string
}

export interface StoryPage {
  pageNumber: number
  text: string
}

export interface Story {
  title: string
  pages: StoryPage[]
}

export interface PictureBookPage {
  pageNumber: number
  text: string
  imagePrompt: string
}

export interface PictureBook {
  title: string
  pages: PictureBookPage[]
}

export interface Guide {
  emotion: string
  message: string
  tips: string[]
}

// ── Books ──

export interface BookItem {
  id: string
  title: string
  emotion: string
  scene: string
  ageGroup: string
  description?: string
  guide: Guide
  story: Story
  pictureBook: PictureBook
  createdAt: string
}

// ── Dropdown Options ──

export interface DropdownOptions {
  emotions: string[]
  scenes: string[]
  ageGroups: string[]
}
