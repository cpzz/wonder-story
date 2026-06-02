import { ImageModelAdapter } from './imageAdapter'
import { QwenImageAdapter } from './qwenAdapter'
import { OpenAIImageAdapter } from './openaiAdapter'

const imageAdapterRegistry: Record<string, new () => ImageModelAdapter> = {
  qwen: QwenImageAdapter,
  openai: OpenAIImageAdapter,
}

export function createImageAdapter(provider: string): ImageModelAdapter {
  const AdapterClass = imageAdapterRegistry[provider]
  if (!AdapterClass) {
    throw new Error(`不支持的图片模型提供商: ${provider}，当前支持: ${Object.keys(imageAdapterRegistry).join(', ')}`)
  }
  return new AdapterClass()
}

export function getSupportedImageProviders(): string[] {
  return Object.keys(imageAdapterRegistry)
}

export function registerImageAdapter(provider: string, adapterClass: new () => ImageModelAdapter): void {
  imageAdapterRegistry[provider] = adapterClass
}
