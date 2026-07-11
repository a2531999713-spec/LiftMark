import type { Metadata, Viewport } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import './globals.css'
import { AuthProvider } from '@/lib/auth-context'

const geistSans = Geist({ subsets: ['latin'], variable: '--font-geist-sans' })
const geistMono = Geist_Mono({ subsets: ['latin'], variable: '--font-geist-mono' })

export const metadata: Metadata = {
  title: '练刻 LiftMark 管理员控制台',
  description:
    '练刻 LiftMark 运营控制台 · 用户 / 会员 / 激活码 / 小组 / 训练数据 / 云同步 / 订单 / 反馈 / 系统运维',
  icons: {
    icon: [
      {
        url: '/admin/icon-light-32x32.png',
        media: '(prefers-color-scheme: light)',
      },
      {
        url: '/admin/icon-dark-32x32.png',
        media: '(prefers-color-scheme: dark)',
      },
    ],
    apple: '/admin/apple-icon.png',
  },
}
export const viewport: Viewport = {
  colorScheme: 'light',
  themeColor: '#2a2f52',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="zh-CN" className={`bg-background ${geistSans.variable} ${geistMono.variable}`}>
      <body className="font-sans antialiased">
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  )
}
