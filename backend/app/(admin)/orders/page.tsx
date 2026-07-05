'use client'

import { useMemo, useState } from 'react'
import { Search, RotateCcw, Loader2, AlertCircle } from 'lucide-react'
import { PageHeader, FilterBar, Field } from '@/components/admin/page-parts'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input, Select } from '@/components/ui/field'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
import { StatusBadge } from '@/components/admin/status-badge'
import { useFetch, formatDate, maskPhone } from '@/lib/hooks'

type Order = {
  id: string
  user_id: string
  status: string
  amount: number | string
  product?: string | null
  created_at: string
  updated_at: string
  user_name: string | null
  user_phone: string | null
}

type Variant = 'default' | 'success' | 'warning' | 'danger' | 'info' | 'outline'

function orderStatus(status: string): { label: string; variant: Variant } {
  switch (status) {
    case 'paid':
      return { label: '已支付', variant: 'success' }
    case 'pending':
      return { label: '待支付', variant: 'warning' }
    case 'refunded':
      return { label: '已退款', variant: 'outline' }
    case 'failed':
      return { label: '失败', variant: 'danger' }
    default:
      return { label: status, variant: 'default' }
  }
}

export default function OrdersPage() {
  const [q, setQ] = useState('')
  const [status, setStatus] = useState('all')

  const query = useMemo(() => {
    const p = new URLSearchParams()
    if (q) p.set('q', q)
    if (status !== 'all') p.set('status', status)
    const s = p.toString()
    return s ? `?${s}` : ''
  }, [q, status])

  const { data, loading, error, reload } = useFetch<{ orders: Order[] }>(
    `/admin/orders${query}`,
    [query],
  )

  const orders = data?.orders ?? []

  return (
    <>
      <PageHeader
        title="订单与支付"
        description="查询用户订单与支付状态，追踪支付、退款与失败记录。"
      />

      <FilterBar>
        <Field label="搜索">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="用户昵称 / 手机 / 订单 ID"
              className="pl-8"
            />
          </div>
        </Field>
        <Field label="状态">
          <Select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="all">全部</option>
            <option value="pending">待支付</option>
            <option value="paid">已支付</option>
            <option value="refunded">已退款</option>
            <option value="failed">失败</option>
          </Select>
        </Field>
        <Button variant="ghost" onClick={() => { setQ(''); setStatus('all') }}>
          <RotateCcw data-icon="inline-start" /> 重置
        </Button>
      </FilterBar>

      <Card>
        <div className="border-b border-border px-4 py-2.5 text-xs text-muted-foreground">
          {loading ? '加载中…' : `共 ${orders.length} 笔订单`}
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>订单 ID</TableHead>
              <TableHead>用户</TableHead>
              <TableHead className="text-right">金额</TableHead>
              <TableHead>状态</TableHead>
              <TableHead>创建时间</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {error ? (
              <TableRow>
                <TableCell colSpan={5} className="py-8 text-center text-sm text-destructive">
                  <div className="flex flex-col items-center gap-2">
                    <AlertCircle className="size-4" />
                    <span>{error}</span>
                    <Button variant="outline" size="sm" onClick={reload}>重试</Button>
                  </div>
                </TableCell>
              </TableRow>
            ) : loading ? (
              <TableRow>
                <TableCell colSpan={5} className="py-8 text-center text-sm text-muted-foreground">
                  <Loader2 className="mx-auto size-4 animate-spin" />
                </TableCell>
              </TableRow>
            ) : orders.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="py-8 text-center text-sm text-muted-foreground">
                  暂无订单数据
                </TableCell>
              </TableRow>
            ) : (
              orders.map((o) => {
                const st = orderStatus(o.status)
                return (
                  <TableRow key={o.id}>
                    <TableCell className="font-mono text-xs">{o.id}</TableCell>
                    <TableCell>
                      <span className="block font-medium">{o.user_name ?? '—'}</span>
                      <span className="block font-mono text-xs text-muted-foreground">
                        {maskPhone(o.user_phone)}
                      </span>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      ¥{Number(o.amount ?? 0).toFixed(2)}
                    </TableCell>
                    <TableCell><StatusBadge label={st.label} variant={st.variant} /></TableCell>
                    <TableCell className="text-xs text-muted-foreground">{formatDate(o.created_at)}</TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </Card>
    </>
  )
}
