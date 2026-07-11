'use client'

import { useMemo, useState } from 'react'
import { Search, RotateCcw } from 'lucide-react'
import { PageHeader, FilterBar, Field } from '@/components/admin/page-parts'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/field'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
import { StatusBadge } from '@/components/admin/status-badge'
import { useFetch, formatDate, maskPhone } from '@/lib/hooks'

type Device = {
  id: string
  user_id: string
  device_id: string
  last_pulled_at: string | null
  last_pushed_at: string | null
  updated_at: string
  user_name: string | null
  user_phone: string | null
  user_status: string
}

function latestSyncTime(d: Device): string | null {
  const times: string[] = []
  if (d.last_pulled_at) times.push(d.last_pulled_at)
  if (d.last_pushed_at) times.push(d.last_pushed_at)
  if (times.length === 0) return null
  return times.sort().at(-1) ?? null
}

function userStatusBadge(status: string): { label: string; variant: 'success' | 'danger' | 'outline' } {
  if (status === 'normal') return { label: '正常', variant: 'success' }
  if (status === 'disabled') return { label: '禁用', variant: 'danger' }
  return { label: status || '未知', variant: 'outline' }
}

export default function DevicesPage() {
  const [q, setQ] = useState('')

  const query = useMemo(() => {
    const p = new URLSearchParams()
    if (q) p.set('q', q)
    const s = p.toString()
    return s ? `?${s}` : ''
  }, [q])

  const { data, loading, error } = useFetch<{ devices: Device[] }>(`/admin/devices${query}`, [query])

  const devices = data?.devices ?? []

  return (
    <>
      <PageHeader
        title="设备管理"
        description="查看用户绑定的设备及其同步情况，掌握每台设备的最后同步时间与用户账号状态。"
      />

      <FilterBar>
        <Field label="搜索">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="用户昵称 / 手机号 / 设备 ID"
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
          <span>共 {devices.length} 台设备</span>
          {loading ? <span>加载中...</span> : error ? <span className="text-destructive">{error}</span> : null}
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>用户</TableHead>
              <TableHead>设备 ID</TableHead>
              <TableHead>最后同步</TableHead>
              <TableHead>更新时间</TableHead>
              <TableHead>用户状态</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {devices.map((d) => {
              const badge = userStatusBadge(d.user_status)
              return (
                <TableRow key={d.id}>
                  <TableCell>
                    <span className="block font-medium">{d.user_name || '（未知用户）'}</span>
                    <span className="block text-xs text-muted-foreground">{maskPhone(d.user_phone)}</span>
                  </TableCell>
                  <TableCell className="font-mono text-xs">{d.device_id || '—'}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{formatDate(latestSyncTime(d))}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{formatDate(d.updated_at)}</TableCell>
                  <TableCell>
                    <StatusBadge label={badge.label} variant={badge.variant} />
                  </TableCell>
                </TableRow>
              )
            })}
            {!loading && devices.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-sm text-muted-foreground py-8">
                  {error ? `加载失败：${error}` : '暂无设备数据'}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>
    </>
  )
}
