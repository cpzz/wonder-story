import { NextRequest, NextResponse } from 'next/server'

const EMOTIONS = ['害怕', '难过', '愤怒', '焦虑', '孤独', '委屈', '嫉妒', '紧张']

const EMOTION_DESC: Record<string, string> = {
  害怕: '害怕是孩子成长中非常正常的情绪。承认孩子的恐惧，帮助他们感到被理解和安全。',
  难过: '难过表明孩子有感知力和情感联结。允许孩子哭泣和表达，而不是急于让他们开心。',
  愤怒: '愤怒是正常的情绪反应。帮助孩子用语言表达愤怒，比要求压抑情绪更重要。',
  焦虑: '适度的焦虑是正常的，但需要帮助孩子建立应对机制和内心安全感。',
  孤独: '孤独感会激发孩子寻求连接的渴望。帮助孩子建立友谊技能，同时给予充分陪伴。',
  委屈: '委屈说明孩子有公平感和自尊心。先倾听，再帮助孩子理解不同的视角。',
  嫉妒: '嫉妒是自我意识发展的表现。帮助孩子认识自己的优点，培养感恩和欣赏他人的能力。',
  紧张: '紧张是面对新挑战时的正常反应。给予鼓励和预演练习，帮助孩子建立信心。',
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const emotion = searchParams.get('emotion') || ''

  return NextResponse.json({
    emotions: EMOTIONS,
    guide: emotion
      ? {
          emotion,
          description: EMOTION_DESC[emotion] || '这是孩子成长过程中需要理解和接纳的正常情绪。',
        }
      : null,
  })
}
