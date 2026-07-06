'use client'

import { Search, RefreshCw, MessageSquareWarning, Server, Database, LogOut, ChevronDown } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { dashboardStats } from '@/lib/data'

export function Topbar() {
  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-border bg-card/95 px-4 backdrop-blur">
      <div className="relative w-full max-w-sm">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <input
          type="search"
          placeholder="搜索用户 / 手机号 / 练刻 ID / 订单号…"
          className="h-9 w-full rounded-md border border-input bg-background pl-9 pr-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30"
        />
      </div>

      <div className="ml-auto flex items-center gap-2">
        <Badge variant="warning" className="hidden sm:inline-flex">
          生产环境
        </Badge>

        <div className="hidden items-center gap-3 border-l border-border pl-3 md:flex">
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            <Server className="size-3.5 text-success" /> API 正常
          </span>
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            <Database className="size-3.5 text-success" /> DB 正常
          </span>
        </div>

        <button
          className="relative flex size-9 items-center justify-center rounded-md border border-border hover:bg-muted"
          aria-label="同步失败提醒"
        >
          <RefreshCw className="size-4" />
          <span className="absolute -right-1 -top-1 flex min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold text-destructive-foreground">
            {dashboardStats.syncFailed}
          </span>
        </button>
        <button
          className="relative flex size-9 items-center justify-center rounded-md border border-border hover:bg-muted"
          aria-label="待处理反馈提醒"
        >
          <MessageSquareWarning className="size-4" />
          <span className="absolute -right-1 -top-1 flex min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold text-destructive-foreground">
            {dashboardStats.pendingFeedback}
          </span>
        </button>

        <button className="flex items-center gap-2 rounded-md border border-border py-1 pl-1 pr-2 hover:bg-muted">
          <span className="flex size-7 items-center justify-center rounded bg-primary text-xs font-semibold text-primary-foreground">
            超管
          </span>
          <span className="hidden text-left leading-tight sm:block">
            <span className="block text-xs font-medium">Wang Admin</span>
            <span className="block text-[10px] text-muted-foreground">超级管理员</span>
          </span>
          <ChevronDown className="size-3.5 text-muted-foreground" />
        </button>
        <button className="flex size-9 items-center justify-center rounded-md border border-border hover:bg-muted" aria-label="退出登录">
          <LogOut className="size-4" />
        </button>
      </div>
    </header>
  )
}
