export interface IllustrationStyle {
  id: string
  name: string
  prompt: string
}

export const ILLUSTRATION_STYLES: IllustrationStyle[] = [
  {
    id: 'watercolor',
    name: '清新水彩',
    prompt: "children's picture book illustration, fresh transparent watercolor style, visible paper texture, natural water bleeding and washes, light and airy color layers, soft blue green purple palette, gentle edges, hand-painted brush strokes, forest flower meadow scene, dreamy fairytale mood",
  },
  {
    id: 'kawaii',
    name: '可爱治愈',
    prompt: "children's picture book illustration, cute kawaii style, chubby baby animals, round soft shapes, big shiny eyes, pastel color palette, low saturation, soft lighting, minimal background, lots of white space, flat pastel tones with slight highlights, gentle and cozy atmosphere, for toddlers",
  },
  {
    id: 'flat',
    name: '简约扁平',
    prompt: "educational children's book illustration, minimalist flat vector style, geometric shapes, simple animals and houses made of circles and rectangles, solid color fills, no gradients or shadows, high key colors, clean composition, suitable for early learning books, modern graphic design aesthetic",
  },
  {
    id: 'cartoon',
    name: '卡通夸张',
    prompt: "children's picture book illustration, cartoon exaggerated vector style, funny character design, oversized heads and eyes, expressive faces, dynamic poses, smooth rounded lines, high saturation bright colors, playful composition, humorous story vibe, vector art look",
  },
  {
    id: 'vintage',
    name: '复古经典',
    prompt: "classic children's picture book illustration, vintage retro style, brown ochre and cream dominant palette, thick outline strokes, slightly aged paper texture, visible grain, mid-20th century picture book feel, warm nostalgic atmosphere, simple backgrounds, timeless fairy tale vibe",
  },
  {
    id: 'chinese',
    name: '国风水墨',
    prompt: "Chinese style children's picture book illustration, traditional ink painting aesthetic, ink line drawing of figures and animals, light color wash, negative space composition, green-blue mountains and red accents, classical garden or village scenes, poetic atmosphere, suitable for Chinese folktales and myths",
  },
  {
    id: 'collage',
    name: '拼贴手工',
    prompt: "creative children's picture book illustration, collage art style, mixed media of cut paper, fabric, yarn, textured papers, visible hand-cut edges and glue marks, rich layered colors, tactile handcrafted look, encourages hands-on creativity, art class aesthetic",
  },
  {
    id: 'realistic',
    name: '写实细腻',
    prompt: "educational children's picture book illustration, realistic detailed style, lifelike animal characters with accurate proportions, fine fur feather and skin textures, natural lighting and volume, realistic environment details, forest grassland underwater scenes, scientific yet friendly",
  },
  {
    id: 'printmaking',
    name: '版画装饰',
    prompt: "artistic children's picture book illustration, decorative printmaking style, intricate patterns and geometric ornaments in background, black and white woodcut lines with selective bright colors, strong contrast, dense rhythmic composition, artistic and poetic storytelling vibe",
  },
]

export const DEFAULT_STYLE_ID = 'watercolor'

export function getStylePrompt(styleId?: string): string {
  return ILLUSTRATION_STYLES.find((s) => s.id === styleId)?.prompt
    ?? ILLUSTRATION_STYLES.find((s) => s.id === DEFAULT_STYLE_ID)!.prompt
}

export function getStyleName(styleId?: string): string {
  return ILLUSTRATION_STYLES.find((s) => s.id === styleId)?.name
    ?? ILLUSTRATION_STYLES.find((s) => s.id === DEFAULT_STYLE_ID)!.name
}
