import Link from 'next/link'
import {
  UserPlus, Crown, Ticket, RefreshCw, MessageSquareWarning, Megaphone,
  GitBranch, ScrollText, TrendingUp, ArrowRight, AlertTriangle,
} from 'lucide-react'
import { PageHeader } from '@/components/admin/page-parts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Sparkline, MiniBars } from '@/components/admin/mini-chart'
import { dashboardStats, pendingTasks, trendData, trendLabels } from '@/lib/data'

const statCards = [
  { label: '今日新增用户', value: dashboardStats.newUsers, hint: '较昨日 +12%' },
  { label: '今日活跃用户', value: dashboardStats.activeUsers, hint: 'DAU' },
  { label: '今日登录次数', value: dashboardStats.logins, hint: '' },
  { label: '今日训练次数', value: dashboardStats.trainings, hint: '' },
  { label: '今日新增小组', value: dashboardStats.newGroups, hint: '' },
  { label: '今日新增训练记录', value: dashboardStats.newRecords, hint: '' },
  { label: '当前 Pro 用户', value: dashboardStats.proUsers, hint: '', accent: 'primary' as const },
  { label: '当前永久会员', value: dashboardStats.lifetimeUsers, hint: '', accent: 'primary' as const },
  { label: '今日激活码兑换', value: dashboardStats.codeRedeems, hint: '' },
  { label: '今日订单金额', value: `¥${dashboardStats.orderAmount.toLocaleString()}`, hint: '' },
  { label: '今日支付成功', value: dashboardStats.paidOrders, hint: '' },
  { label: '今日退款订单', value: dashboardStats.refundOrders, hint: '', accent: 'warning' as const },
  { label: '同步失败数量', value: dashboardStats.syncFailed, hint: '需处理', accent: 'danger' as const },
  { label: '上传失败数量', value: dashboardStats.uploadFailed, hint: '需处理', accent: 'danger' as const },
  { label: '待处理反馈', value: dashboardStats.pendingFeedback, hint: '工单', accent: 'warning' as const },
  { label: '异常用户数量', value: dashboardStats.abnormalUsers, hint: '需排查', accent: 'danger' as const },
]

const trends = [
  { title: '用户增长趋势', data: trendData.users },
  { title: '活跃用户趋势', data: trendData.active },
  { title: '训练次数趋势', data: trendData.trainings },
  { title: '订单金额趋势', data: trendData.orders },
  { title: '激活码兑换趋势', data: trendData.redeems },
  { title: '同步失败趋势', data: trendData.syncFail, danger: true },
]

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

const accentClass: Record<string, string> = {
  primary: 'text-primary',
  danger: 'text-destructive',
  warning: 'text-warning-foreground',
}

export default function DashboardPage() {
  return (
    <>
      <PageHeader
        title="首页总览"
        description="练刻 LiftMark 运营控制台 · 实时掌握项目整体运行状态、待处理事项与关键趋势。"
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-8">
        {statCards.map((s) => (
          <Card key={s.label}>
            <CardContent className="p-3">
              <div className="text-xs text-muted-foreground">{s.label}</div>
              <div className={`mt-1 text-xl font-semibold tracking-tight ${s.accent ? accentClass[s.accent] : ''}`}>
                {s.value}
              </div>
              {s.hint ? <div className="mt-0.5 text-[11px] text-muted-foreground">{s.hint}</div> : null}
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {trends.map((t) => (
          <Card key={t.title}>
            <CardHeader>
              <CardTitle className="flex items-center gap-1.5">
                <TrendingUp className="size-3.5 text-muted-foreground" />
                {t.title}
              </CardTitle>
              <span className="text-xs text-muted-foreground">近 7 日</span>
            </CardHeader>
            <CardContent>
              <Sparkline data={t.data} stroke={t.danger ? 'var(--destructive)' : 'var(--primary)'} className="h-16 w-full" />
              <div className="mt-1 flex justify-between text-[10px] text-muted-foreground">
                {trendLabels.map((l) => (
                  <span key={l}>{l}</span>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-1.5">
              <AlertTriangle className="size-3.5 text-destructive" /> 待处理事项
            </CardTitle>
            <Badge variant="danger">{pendingTasks.reduce((a, t) => a + t.count, 0)} 项</Badge>
          </CardHeader>
          <CardContent className="p-0">
            <ul className="divide-y divide-border">
              {pendingTasks.map((t) => (
                <li key={t.id} className="flex items-center gap-3 px-4 py-2.5 hover:bg-muted/50">
                  <Badge variant={t.variant}>{t.type}</Badge>
                  <span className="flex-1 truncate text-sm">{t.title}</span>
                  <span className="text-xs text-muted-foreground">{t.time}</span>
                  <ArrowRight className="size-4 text-muted-foreground" />
                </li>
              ))}
            </ul>
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
          <CardTitle>本周训练活跃度</CardTitle>
          <span className="text-xs text-muted-foreground">按日训练次数</span>
        </CardHeader>
        <CardContent>
          <MiniBars data={trendData.trainings} className="h-24 w-full" />
          <div className="mt-1 flex justify-between text-[10px] text-muted-foreground">
            {trendLabels.map((l) => (
              <span key={l}>{l}</span>
            ))}
          </div>
        </CardContent>
      </Card>
    </>
  )
}
