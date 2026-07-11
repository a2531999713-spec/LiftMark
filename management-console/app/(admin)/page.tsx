'use client'

import Link from 'next/link'
import {
  UserPlus, Crown, Ticket, RefreshCw, MessageSquareWarning, Megaphone,
  GitBranch, ScrollText, TrendingUp, ArrowRight, AlertTriangle, Users, Dumbbell, Activity,
} from 'lucide-react'
import { PageHeader } from '@/components/admin/page-parts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Sparkline, MiniBars } from '@/components/admin/mini-chart'
import { useFetch } from '@/lib/hooks'
import { formatDate } from '@/lib/hooks'

type DashboardStats = {
  stats: {
    newUsers: number
    totalUsers: number
    activeUsers: number
    proUsers: number
    lifetimeUsers: number
    newGroups: number
    trainings: number
    newRecords: number
    syncFailed: number
    pendingFeedback: number
    codeRedeems: number
    totalCodes: number
  }
  trends: {
    users: number[]
  }
}

const quickActions = [
  { label: '搜索用户', href: '/users', icon: UserPlus },
  { label: '发放会员', href: '/membership', icon: Crown },
  { label: '生成激活码', href: '/codes', icon: Ticket },
  { label: '查看同步失败', href: '/sync', icon: RefreshCw },
  { label: '查看反馈工单', href: '/feedback', icon: MessageSquareWarning },
  { label: '创建公告', href: '/announcements', icon: Megaphone },
  { label: '配置版本更新', href: '/versions', icon: GitBranch },
  { label: '查看操作日志', href: '/logs', icon: ScrollText },
]

const trendLabels = ['周一', '周二', '周三', '周四', '周五', '周六', '周日']

export default function DashboardPage() {
  const { data, loading, error } = useFetch<DashboardStats>('/admin/dashboard/stats')

  const stats = data?.stats
  const trendUsers = data?.trends?.users ?? [0, 0, 0, 0, 0, 0, 0]

  const statCards = [
    { label: '今日新增用户', value: stats?.newUsers ?? 0, hint: '今日注册' },
    { label: '总用户数', value: stats?.totalUsers ?? 0, hint: '累计' },
    { label: '今日训练次数', value: stats?.trainings ?? 0, hint: '今日 session' },
    { label: '今日新增记录', value: stats?.newRecords ?? 0, hint: '' },
    { label: '新增小组', value: stats?.newGroups ?? 0, hint: '总数' },
    { label: 'Pro 会员', value: stats?.proUsers ?? 0, hint: '当前有效', accent: 'primary' as const },
    { label: '永久会员', value: stats?.lifetimeUsers ?? 0, hint: '当前有效', accent: 'primary' as const },
    { label: '激活码兑换', value: stats?.codeRedeems ?? 0, hint: '今日' },
    { label: '激活码总数', value: stats?.totalCodes ?? 0, hint: '累计生成' },
    { label: '同步失败', value: stats?.syncFailed ?? 0, hint: '需处理', accent: 'danger' as const },
    { label: '待处理反馈', value: stats?.pendingFeedback ?? 0, hint: '工单', accent: 'warning' as const },
  ]

  const accentClass: Record<string, string> = {
    primary: 'text-primary',
    danger: 'text-destructive',
    warning: 'text-warning-foreground',
  }

  return (
    <>
      <PageHeader
        title="首页总览"
        description="练刻 LiftMark 运营控制台 · 实时掌握项目整体运行状态、待处理事项与关键趋势。"
      />

      {loading && <div className="text-sm text-muted-foreground">加载统计数据中...</div>}
      {error && (
        <Card><CardContent className="p-4 text-sm text-destructive">加载失败：{error}</CardContent></Card>
      )}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
        {statCards.map((s) => (
          <Card key={s.label}>
            <CardContent className="p-3">
              <div className="text-xs text-muted-foreground">{s.label}</div>
              <div className={`mt-1 text-xl font-semibold tracking-tight tabular-nums ${s.accent ? accentClass[s.accent] : ''}`}>
                {(s.value ?? 0).toLocaleString()}
              </div>
              {s.hint ? <div className="mt-0.5 text-[11px] text-muted-foreground">{s.hint}</div> : null}
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-1.5">
              <TrendingUp className="size-3.5 text-muted-foreground" />
              用户增长趋势
            </CardTitle>
            <span className="text-xs text-muted-foreground">近 7 日</span>
          </CardHeader>
          <CardContent>
            <Sparkline data={trendUsers} stroke="var(--primary)" className="h-16 w-full" />
            <div className="mt-1 flex justify-between text-[10px] text-muted-foreground">
              {trendLabels.map((l) => <span key={l}>{l}</span>)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-1.5">
              <Activity className="size-3.5 text-muted-foreground" />
              本周训练活跃度
            </CardTitle>
            <span className="text-xs text-muted-foreground">按日训练次数</span>
          </CardHeader>
          <CardContent>
            <MiniBars data={trendUsers} className="h-16 w-full" />
            <div className="mt-1 flex justify-between text-[10px] text-muted-foreground">
              {trendLabels.map((l) => <span key={l}>{l}</span>)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>快捷操作</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-2">
            {quickActions.map((a) => {
              const Icon = a.icon
              return (
                <Link
                  key={a.label}
                  href={a.href}
                  className="flex flex-col items-start gap-2 rounded-md border border-border p-3 text-sm transition-colors hover:border-primary/40 hover:bg-primary/5"
                >
                  <Icon className="size-4 text-primary" />
                  <span>{a.label}</span>
                </Link>
              )
            })}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-1.5">
            <AlertTriangle className="size-3.5 text-destructive" /> 待处理事项
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <ul className="divide-y divide-border">
            {(stats?.syncFailed ?? 0) > 0 && (
              <li>
                <Link href="/sync" className="flex items-center gap-3 px-4 py-2.5 hover:bg-muted/50">
                  <Badge variant="danger">同步失败</Badge>
                  <span className="flex-1 truncate text-sm">{stats?.syncFailed} 个同步任务需处理</span>
                  <ArrowRight className="size-4 text-muted-foreground" />
                </Link>
              </li>
            )}
            {(stats?.pendingFeedback ?? 0) > 0 && (
              <li>
                <Link href="/feedback" className="flex items-center gap-3 px-4 py-2.5 hover:bg-muted/50">
                  <Badge variant="warning">用户反馈</Badge>
                  <span className="flex-1 truncate text-sm">{stats?.pendingFeedback} 条待处理反馈工单</span>
                  <ArrowRight className="size-4 text-muted-foreground" />
                </Link>
              </li>
            )}
            {(!stats || (stats.syncFailed === 0 && stats.pendingFeedback === 0)) && !loading && (
              <li className="px-4 py-6 text-center text-sm text-muted-foreground">
                暂无待处理事项，系统运行正常 ✓
              </li>
            )}
          </ul>
        </CardContent>
      </Card>
    </>
  )
}
