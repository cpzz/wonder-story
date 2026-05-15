/** 创作表单「主角选择」；选「自动」时在用户消息末尾追加随机抽象多样性指引（不列举具体动物） */
export const PROTAGONIST_PRESET_AUTO = '自动' as const

export const PROTAGONIST_PRESET_OPTIONS: readonly string[] = [
  PROTAGONIST_PRESET_AUTO,
  '小兔子',
  '小熊',
  '小女孩',
  '小男孩',
  '小猫咪',
  '小狗',
  '小刺猬',
  '小狐狸',
  '小企鹅',
  '小熊猫',
  '小恐龙',
  '小机器人',
  '小精灵',
  '小外星人',
  '小鸭子',
] as const

/** 「自动」模式下每次随机一条；文案不写具体动物名，由模型结合当前故事条件自定 */
const AUTO_PROTAGONIST_DIVERSITY_BRIEFS = [
  '【角色设定】主角与主要配角的形象、物种或身份请你完全依据本次创作条件（情绪、场景、年龄及用户补充说明）原创，与情节自然呼应；避免不经思考地复用你最习惯的那一类主角套路。',
  '【角色设定】请为本篇自主构思主角与配角，使他们在气质或来历上彼此有区分；整体须温暖、适合儿童绘本，物种或身份由你根据故事需要决定。',
  '【角色设定】主角类型由你根据故事需要自由选择（现实或温和幻想均可），配角不宜与主角完全同质；档案卡中的 species 须写清你本次原创选定后的具体类型，不得用模糊占位。',
  '【角色设定】在符合年龄与疗愈/舒缓基调的前提下，尽量让本篇主角在物种或身份维度上有清晰、好懂的设定；具体选什么由你结合全文判断。',
  '【角色设定】2–4 个角色中至少有一位在身份或物种维度上有清晰特征；整体像一个完整的小世界，角色之间关系合理、外形可画。',
  '【角色设定】先确定本篇主角的大致类型再设计配角；所有角色的 refPrompt 须与档案卡一致，物种或身份在全书范围内保持严格一致。',
]

function pickAutoProtagonistDiversityBrief(): string {
  const i = Math.floor(Math.random() * AUTO_PROTAGONIST_DIVERSITY_BRIEFS.length)
  return AUTO_PROTAGONIST_DIVERSITY_BRIEFS[i] ?? AUTO_PROTAGONIST_DIVERSITY_BRIEFS[0]
}

/**
 * 拼接到故事生成用户提示末尾。
 * - 「自动」：追加一条随机的抽象角色多样性指引（不列举具体动物）。
 * - 非「自动」：严格按用户所选类型约束主角与家庭。
 */
export function buildProtagonistPromptSuffix(preset?: string): string {
  const p = (preset ?? PROTAGONIST_PRESET_AUTO).trim()
  if (!p || p === PROTAGONIST_PRESET_AUTO) {
    return `\n\n${pickAutoProtagonistDiversityBrief()}`
  }
  return `\n\n【主角设定】用户已在「主角选择」中选择「${p}」，你必须严格按该选项生成，不得改用其他物种或身份作为故事主角。\n- 角色档案中 role 为「主角」的角色：species 必须与「${p}」一致（可另取角色名，但类型不得偏离）。\n- 主角家庭成员（父母/子女/兄弟姐妹）：须与主角为同一类生物（人类则全家人类；动物则全家为与「${p}」相符的同类）。\n- 所有相关角色的 refPrompt、外形描述须与「${p}」一致，全书不得更换主角物种。`
}
