'use client'

import { useMemo, useState } from 'react'
import { Search, RotateCcw, Users, Dumbbell, RefreshCw } from 'lucide-react'
import { PageHeader, FilterBar, Field } from '@/components/admin/page-parts'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/field'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
import { useFetch, formatDate, maskPhone } from '@/lib/hooks'

type SyncTask = {
  id: string
  user_id: string
  device_id: string
  last_pulled_at: string | null
  last_pushed_at: string | null
  updated_at: string
  user_name: string | null
  user_phone: string | null
}

type SyncStatusSummary = {
  users: number
  workoutSessions: number
  workoutSets: number
  syncStates: unknown[]
}

export default function SyncPage() {
  const [q, setQ] = useState('')

  const query = useMemo(() => {
    const p = new URLSearchParams()
    if (q) p.set('q', q)
    const s = p.toString()
    return s ? `?${s}` : ''
  }, [q])

  const { data: statusData, loading: statusLoading, error: statusError } = useFetch<SyncStatusSummary>(
    '/admin/sync/status',
    [],
  )

  const { data, loading, error } = useFetch<{ tasks: SyncTask[] }>(
    `/admin/sync/tasks${query}`,
    [query],
  )

  const tasks = data?.tasks ?? []

  const summary = [
    {
      label: '总用户数',
      value: statusData?.users ?? 0,
      icon: Users,
    },
    {
      label: '训练 Session 数',
      value: statusData?.workoutSessions ?? 0,
      icon: Dumbbell,
    },
    {
      label: '同步状态数',
      value: statusData?.syncStates?.length ?? 0,
      icon: RefreshCw,
    },
  ]

  return (
    <>
      <PageHeader
        title="云同步管理"
        description="查看用户设备的同步任务与整体同步状态，掌握数据拉取与推送的最新情况。"
      />

      <div className="grid gap-3 sm:grid-cols-3">
        {summary.map((item) => {
          const Icon = item.icon
          return (
            <Card key={item.label}>
              <CardContent className="flex items-center gap-3">
                <span className="flex size-9 items-center justify-center rounded-md bg-primary/10 text-primary">
                  <Icon className="size-4" />
                </span>
                <div className="min-w-0">
                  <div className="text-xs text-muted-foreground">{item.label}</div>
                  <div className="text-lg font-semibold tabular-nums">
                    {statusLoading ? '—' : statusError ? '—' : item.value}
                  </div>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>
      {statusError ? (
        <p className="text-xs text-destructive">概览加载失败：{statusError}</p>
      ) : null}

      <FilterBar>
        <Field label="搜索">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="用户昵称 / 手机号 / 用户 ID"
              className="pl-8"
            />
          </div>
        </Field>
        <Button variant="ghost" onClick={() => setQ('')}>
          <RotateCcw data-icon="inline-start" /> 重置
        </Button>
      </FilterBar>

      <Card>
        <div className="flex items-center justify-between border-b border-border px-4 py-2.5 text-xs text-muted-foreground">
          <span>共 {tasks.length} 条同步任务</span>
          {loading ? <span>加载中...</span> : error ? <span className="text-destructive">{error}</span> : null}
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>用户</TableHead>
              <TableHead>设备 ID</TableHead>
              <TableHead>最后拉取时间</TableHead>
              <TableHead>最后推送时间</TableHead>
              <TableHead>更新时间</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {tasks.map((t) => (
              <TableRow key={t.id}>
                <TableCell>
                  <span className="block font-medium">{t.user_name || '（未知用户）'}</span>
                  <span className="block text-xs text-muted-foreground">{maskPhone(t.user_phone)}</span>
                </TableCell>
                <TableCell className="font-mono text-xs">{t.device_id || '—'}</TableCell>
                <TableCell className="text-xs text-muted-foreground">{formatDate(t.last_pulled_at)}</TableCell>
                <TableCell className="text-xs text-muted-foreground">{formatDate(t.last_pushed_at)}</TableCell>
                <TableCell className="text-xs text-muted-foreground">{formatDate(t.updated_at)}</TableCell>
              </TableRow>
            ))}
            {!loading && tasks.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-sm text-muted-foreground py-8">
                  {error ? `加载失败：${error}` : '暂无同步任务数据'}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>
    </>
  )
}
