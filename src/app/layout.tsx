import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: '童心事·绘本',
  description: '用一个故事，陪孩子走过每一种情绪',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body className="min-h-screen bg-gradient-to-br from-orange-50 via-pink-50 to-purple-50">
        {children}
      </body>
    </html>
  )
}
