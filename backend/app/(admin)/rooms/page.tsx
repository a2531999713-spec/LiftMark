'use client'

import { useMemo, useState } from 'react'
import { RotateCcw } from 'lucide-react'
import { PageHeader, FilterBar, Field } from '@/components/admin/page-parts'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Select } from '@/components/ui/field'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
import { StatusBadge } from '@/components/admin/status-badge'
import { useFetch, formatDateShort } from '@/lib/hooks'

type Room = {
  id: string
  group_id: string
  group_name: string | null
  created_by_user_id: string
  creator_name: string | null
  status: string
  created_at: string
  updated_at: string
  participantCount: number
}

function roomStatusBadge(status: string): { label: string; variant: 'success' | 'outline' | 'danger' | 'default' } {
  if (status === 'active') return { label: '进行中', variant: 'success' }
  if (status === 'ended') return { label: '已结束', variant: 'outline' }
  if (status === 'cancelled') return { label: '已取消', variant: 'danger' }
  return { label: status || '未知', variant: 'default' }
}

export default function RoomsPage() {
  const [status, setStatus] = useState('all')

  const query = useMemo(() => {
    const p = new URLSearchParams()
    if (status !== 'all') p.set('status', status)
    const s = p.toString()
    return s ? `?${s}` : ''
  }, [status])

  const { data, loading, error } = useFetch<{ rooms: Room[] }>(`/admin/rooms${query}`, [query])

  const rooms = data?.rooms ?? []

  return (
    <>
      <PageHeader
        title="在线同练房间"
        description="查看在线同练房间的创建与参与情况，按状态筛选进行中、已结束或已取消的房间。"
      />

      <FilterBar>
        <Field label="状态">
          <Select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="all">全部</option>
            <option value="active">进行中</option>
            <option value="ended">已结束</option>
            <option value="cancelled">已取消</option>
          </Select>
        </Field>
        <Button variant="ghost" onClick={() => setStatus('all')}>
          <RotateCcw data-icon="inline-start" /> 重置
        </Button>
      </FilterBar>

      <Card>
        <div className="flex items-center justify-between border-b border-border px-4 py-2.5 text-xs text-muted-foreground">
          <span>共 {rooms.length} 个房间</span>
          {loading ? <span>加载中...</span> : error ? <span className="text-destructive">{error}</span> : null}
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>房间 ID</TableHead>
              <TableHead>关联小组</TableHead>
              <TableHead>创建者</TableHead>
              <TableHead className="text-right">参与人数</TableHead>
              <TableHead>状态</TableHead>
              <TableHead>创建时间</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rooms.map((r) => {
              const badge = roomStatusBadge(r.status)
              return (
                <TableRow key={r.id}>
                  <TableCell className="font-mono text-xs">{r.id}</TableCell>
                  <TableCell>{r.group_name || '—'}</TableCell>
                  <TableCell>{r.creator_name || '—'}</TableCell>
                  <TableCell className="text-right tabular-nums">{r.participantCount}</TableCell>
                  <TableCell>
                    <StatusBadge label={badge.label} variant={badge.variant} />
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">{formatDateShort(r.created_at)}</TableCell>
                </TableRow>
              )
            })}
            {!loading && rooms.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-sm text-muted-foreground py-8">
                  {error ? `加载失败：${error}` : '暂无房间数据'}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>
    </>
  )
}
