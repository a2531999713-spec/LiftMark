'use client'

import { useMemo, useState } from 'react'
import { Search, RotateCcw } from 'lucide-react'
import { PageHeader, FilterBar, Field } from '@/components/admin/page-parts'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input, Select } from '@/components/ui/field'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
import { StatusBadge } from '@/components/admin/status-badge'
import { useFetch, formatDate, maskPhone } from '@/lib/hooks'

type Session = {
  id: string
  user_id: string
  group_id: string
  title: string
  status: string
  created_at: string
  updated_at: string
  user_name: string
  user_phone: string | null
  group_name: string
}

type BadgeVariant =
  | 'default'
  | 'primary'
  | 'success'
  | 'warning'
  | 'danger'
  | 'info'
  | 'outline'

const SESSION_STATUS: Record<string, { variant: BadgeVariant; label: string }> = {
  completed: { variant: 'success', label: '已完成' },
  in_progress: { variant: 'info', label: '进行中' },
  cancelled: { variant: 'outline', label: '已取消' },
}

function SessionStatusBadge({ status }: { status: string }) {
  const entry = SESSION_STATUS[status]
  if (entry) {
    return <StatusBadge label={entry.label} variant={entry.variant} />
  }
  return <StatusBadge label={status || '—'} variant="default" />
}

export default function TrainingPage() {
  const [q, setQ] = useState('')
  const [status, setStatus] = useState('all')

  const query = useMemo(() => {
    const p = new URLSearchParams()
    if (q) p.set('q', q)
    if (status !== 'all') p.set('status', status)
    p.set('limit', '100')
    const s = p.toString()
    return s ? `?${s}` : ''
  }, [q, status])

  const { data, loading, error } = useFetch<{ sessions: Session[] }>(
    `/admin/training/sessions${query}`,
    [query],
  )

  const sessions = data?.sessions ?? []

  return (
    <>
      <PageHeader
        title="训练数据"
        description="查看所有训练记录，按标题、用户搜索，并按状态筛选。"
      />

      <FilterBar>
        <Field label="搜索">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="标题 / 用户"
              className="pl-8"
            />
          </div>
        </Field>
        <Field label="状态">
          <Select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="all">全部</option>
            <option value="completed">已完成</option>
            <option value="in_progress">进行中</option>
            <option value="cancelled">已取消</option>
          </Select>
        </Field>
        <Button variant="ghost" onClick={() => { setQ(''); setStatus('all') }}>
          <RotateCcw data-icon="inline-start" /> 重置
        </Button>
      </FilterBar>

      <Card>
        <div className="flex items-center justify-between border-b border-border px-4 py-2.5 text-xs text-muted-foreground">
          <span>共 {sessions.length} 条训练记录</span>
          {loading ? (
            <span>加载中...</span>
          ) : error ? (
            <span className="text-destructive">{error}</span>
          ) : null}
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>训练 ID</TableHead>
              <TableHead>标题</TableHead>
              <TableHead>用户</TableHead>
              <TableHead>小组</TableHead>
              <TableHead>状态</TableHead>
              <TableHead>更新时间</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sessions.map((s) => (
              <TableRow key={s.id}>
                <TableCell className="font-mono text-xs">{s.id}</TableCell>
                <TableCell className="font-medium">{s.title || '（无标题）'}</TableCell>
                <TableCell>
                  <span className="block">{s.user_name || '—'}</span>
                  <span className="block font-mono text-xs text-muted-foreground">
                    {maskPhone(s.user_phone)}
                  </span>
                </TableCell>
                <TableCell>{s.group_name || '—'}</TableCell>
                <TableCell>
                  <SessionStatusBadge status={s.status} />
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">{formatDate(s.updated_at)}</TableCell>
              </TableRow>
            ))}
            {!loading && sessions.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="py-8 text-center text-sm text-muted-foreground">
                  {error ? `加载失败：${error}` : '暂无训练数据'}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>
    </>
  )
}
