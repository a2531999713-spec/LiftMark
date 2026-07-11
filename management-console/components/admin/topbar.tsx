'use client'

import { useRouter, usePathname } from 'next/navigation'
import { Server, Database, LogOut, RefreshCw } from 'lucide-react'
import { useState } from 'react'

import { Badge } from '@/components/ui/badge'
import { useAuth } from '@/lib/auth-context'
import { useFetch } from '@/lib/hooks'

export function Topbar() {
  const router = useRouter()
  const pathname = usePathname()
  const { user, logout } = useAuth()
  const [q, setQ] = useState('')

  // 拉取监控状态（首页除外，避免重复请求）
  const { data: monitor } = useFetch<{ services?: { status: string }[] }>(
    pathname === '/' ? null : '/admin/monitor',
  )
  const apiOk = monitor?.services?.every((s) => s.status === 'ok') ?? true

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    if (q.trim()) {
      router.push(`/users?q=${encodeURIComponent(q.trim())}`)
    }
  }

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-border bg-card/95 px-4 backdrop-blur">
      <form onSubmit={handleSearch} className="relative w-full max-w-sm">
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="搜索用户 / 手机号 / 练刻 ID..."
          className="h-9 w-full rounded-md border border-input bg-background pl-3 pr-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30"
        />
      </form>

      <div className="ml-auto flex items-center gap-2">
        <Badge variant="warning" className="hidden sm:inline-flex">
          生产环境
        </Badge>

        <div className="hidden items-center gap-3 border-l border-border pl-3 md:flex">
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            <Server className={`size-3.5 ${apiOk ? 'text-success' : 'text-destructive'}`} /> API {apiOk ? '正常' : '异常'}
          </span>
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            <Database className={`size-3.5 ${apiOk ? 'text-success' : 'text-destructive'}`} /> DB {apiOk ? '正常' : '异常'}
          </span>
        </div>

        <div className="flex items-center gap-2 rounded-md border border-border py-1 pl-1 pr-2">
          <span className="flex size-7 items-center justify-center rounded bg-primary text-xs font-semibold text-primary-foreground">
            {(user?.nickname || user?.phone || 'A').slice(0, 1)}
          </span>
          <span className="hidden text-left leading-tight sm:block">
            <span className="block text-xs font-medium">{user?.nickname || '管理员'}</span>
            <span className="block text-[10px] text-muted-foreground">超级管理员</span>
          </span>
        </div>
        <button
          onClick={logout}
          className="flex size-9 items-center justify-center rounded-md border border-border hover:bg-muted"
          aria-label="退出登录"
          title="退出登录"
        >
          <LogOut className="size-4" />
        </button>
      </div>
    </header>
  )
}
