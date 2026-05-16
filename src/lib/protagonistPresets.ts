import type { UILang } from '@/types'

/** 创作表单「主角选择」；选「自动」时在用户消息末尾追加随机抽象多样性指引（不列举具体动物） */
export const PROTAGONIST_PRESET_AUTO = 'protagonist.auto' as const

export const PROTAGONIST_PRESET_OPTIONS: readonly string[] = [
  PROTAGONIST_PRESET_AUTO,
  'protagonist.bunny',
  'protagonist.bear',
  'protagonist.girl',
  'protagonist.boy',
  'protagonist.cat',
  'protagonist.dog',
  'protagonist.hedgehog',
  'protagonist.fox',
  'protagonist.penguin',
  'protagonist.panda',
  'protagonist.dinosaur',
  'protagonist.robot',
  'protagonist.elf',
  'protagonist.alien',
  'protagonist.duck',
] as const

/** 返回 i18n key 对应的实际中文值（用于提示词拼接，保持中文给 LLM） */
const PROTAGONIST_ZH_MAP: Record<string, string> = {
  'protagonist.auto': '自动',
  'protagonist.bunny': '小兔子',
  'protagonist.bear': '小熊',
  'protagonist.girl': '小女孩',
  'protagonist.boy': '小男孩',
  'protagonist.cat': '小猫咪',
  'protagonist.dog': '小狗',
  'protagonist.hedgehog': '小刺猬',
  'protagonist.fox': '小狐狸',
  'protagonist.penguin': '小企鹅',
  'protagonist.panda': '小熊猫',
  'protagonist.dinosaur': '小恐龙',
  'protagonist.robot': '小机器人',
  'protagonist.elf': '小精灵',
  'protagonist.alien': '小外星人',
  'protagonist.duck': '小鸭子',
}

const PROTAGONIST_EN_MAP: Record<string, string> = {
  'protagonist.auto': 'Auto',
  'protagonist.bunny': 'Bunny',
  'protagonist.bear': 'Bear',
  'protagonist.girl': 'Little Girl',
  'protagonist.boy': 'Little Boy',
  'protagonist.cat': 'Kitten',
  'protagonist.dog': 'Puppy',
  'protagonist.hedgehog': 'Hedgehog',
  'protagonist.fox': 'Fox',
  'protagonist.penguin': 'Penguin',
  'protagonist.panda': 'Red Panda',
  'protagonist.dinosaur': 'Dinosaur',
  'protagonist.robot': 'Robot',
  'protagonist.elf': 'Elf',
  'protagonist.alien': 'Alien',
  'protagonist.duck': 'Duck',
}

export function getProtagonistZhName(key: string): string {
  return PROTAGONIST_ZH_MAP[key] ?? key
}

export function getProtagonistEnName(key: string): string {
  return PROTAGONIST_EN_MAP[key] ?? key
}

/** 「自动」模式下每次随机一条；文案不写具体动物名，由模型结合当前故事条件自定 */
const AUTO_PROTAGONIST_DIVERSITY_BRIEFS_ZH = [
  '【角色设定】主角与主要配角的形象、物种或身份请你完全依据本次创作条件（情绪、场景、年龄及用户补充说明）原创，与情节自然呼应；避免不经思考地复用你最习惯的那一类主角套路。',
  '【角色设定】请为本篇自主构思主角与配角，使他们在气质或来历上彼此有区分；整体须温暖、适合儿童绘本，物种或身份由你根据故事需要决定。',
  '【角色设定】主角类型由你根据故事需要自由选择（现实或温和幻想均可），配角不宜与主角完全同质；档案卡中的 species 须写清你本次原创选定后的具体类型，不得用模糊占位。',
  '【角色设定】在符合年龄与疗愈/舒缓基调的前提下，尽量让本篇主角在物种或身份维度上有清晰、好懂的设定；具体选什么由你结合全文判断。',
  '【角色设定】2–4 个角色中至少有一位在身份或物种维度上有清晰特征；整体像一个完整的小世界，角色之间关系合理、外形可画。',
  '【角色设定】先确定本篇主角的大致类型再设计配角；所有角色的 refPrompt 须与档案卡一致，物种或身份在全书范围内保持严格一致。',
]

const AUTO_PROTAGONIST_DIVERSITY_BRIEFS_EN = [
  '【Protagonist Setting】Please design the protagonist and main supporting characters entirely based on this story\'s conditions (emotion, scene, age, and user notes), making them naturally fit the plot; avoid unthinkingly reusing your default protagonist archetype.',
  '【Protagonist Setting】Please independently conceive the protagonist and supporting characters so they differ in temperament or background; the overall cast should be warm and suitable for a children\'s picture book. Species or identity is up to you based on story needs.',
  '【Protagonist Setting】You may freely choose the protagonist type (realistic or gently fantastical), but supporting characters should not be identical to the protagonist in nature; the "species" field in the character card must specify the exact type chosen, not a vague placeholder.',
  '【Protagonist Setting】Within the constraints of the age group and the healing/soothing tone, aim for a protagonist with a clear, easy-to-understand species or identity; the specific choice is up to your judgment of the whole story.',
  '【Protagonist Setting】Among the 2-4 characters, at least one should have a distinct identity or species dimension; the cast should feel like a coherent little world with reasonable relationships and drawable appearances.',
  '【Protagonist Setting】Decide the protagonist\'s general type first, then design supporting characters; all characters\' refPrompts must match their cards, and species or identity must be strictly consistent throughout the book.',
]

function pickAutoProtagonistDiversityBrief(lang?: string): string {
  const briefs = lang === 'en' ? AUTO_PROTAGONIST_DIVERSITY_BRIEFS_EN : AUTO_PROTAGONIST_DIVERSITY_BRIEFS_ZH
  const i = Math.floor(Math.random() * briefs.length)
  return briefs[i] ?? briefs[0]
}

/**
 * 拼接到故事生成用户提示末尾。
 * - 「自动」：追加一条随机的抽象角色多样性指引（不列举具体动物）。
 * - 非「自动」：严格按用户所选类型约束主角与家庭。
 */
export function buildProtagonistPromptSuffix(preset?: string, lang?: UILang): string {
  const p = (preset ?? PROTAGONIST_PRESET_AUTO).trim()
  const isEn = lang === 'en'
  if (!p || p === PROTAGONIST_PRESET_AUTO) {
    return `\n\n${pickAutoProtagonistDiversityBrief(lang)}`
  }
  if (isEn) {
    const enName = getProtagonistEnName(p)
    return `\n\n【Protagonist Setting】The user has selected "${enName}" as the protagonist type. You must strictly follow this choice and not use a different species or identity for the protagonist.\n- The character with role "protagonist": species must match "${enName}" (you may give a different name, but the type must not deviate).\n- The protagonist's family members (parents/children/siblings): must be the same type of creature as the protagonist (if human, the whole family is human; if animal, the whole family matches "${enName}").\n- All related characters' refPrompts and appearance descriptions must be consistent with "${enName}"; the protagonist's species must not change throughout the book.`
  }
  const zhName = getProtagonistZhName(p)
  return `\n\n【主角设定】用户已在「主角选择」中选择「${zhName}」，你必须严格按该选项生成，不得改用其他物种或身份作为故事主角。\n- 角色档案中 role 为「主角」的角色：species 必须与「${zhName}」一致（可另取角色名，但类型不得偏离）。\n- 主角家庭成员（父母/子女/兄弟姐妹）：须与主角为同一类生物（人类则全家人类；动物则全家为与「${zhName}」相符的同类）。\n- 所有相关角色的 refPrompt、外形描述须与「${zhName}」一致，全书不得更换主角物种。`
}
