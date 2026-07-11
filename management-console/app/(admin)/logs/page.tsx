'use client'

import { useMemo, useState } from 'react'
import { Search, RotateCcw, Loader2, AlertCircle } from 'lucide-react'
import { PageHeader, FilterBar, Field } from '@/components/admin/page-parts'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input, Select } from '@/components/ui/field'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
import { StatusBadge } from '@/components/admin/status-badge'
import { useFetch, formatDate } from '@/lib/hooks'

type AuditLog = {
  id: string
  operator_user_id: string | null
  operator_name: string | null
  module: string
  target_type: string | null
  target_id: string | null
  action: string
  risk: string
  reason: string | null
  ip: string | null
  device: string | null
  rollbackable: boolean
  created_at: string
}

type LogsResponse = { logs: AuditLog[] }

const MODULE_OPTIONS = [
  '用户管理',
  '会员管理',
  '激活码管理',
  '数据修正中心',
  '小组管理',
  '训练数据',
  '系统设置',
  '其他',
]

type RiskVariant = 'default' | 'warning' | 'danger' | 'outline'

function riskBadge(risk: string): { label: string; variant: RiskVariant } {
  if (risk === 'high') return { label: '高', variant: 'danger' }
  if (risk === 'medium') return { label: '中', variant: 'warning' }
  if (risk === 'low') return { label: '低', variant: 'default' }
  return { label: risk || '—', variant: 'outline' }
}

export default function LogsPage() {
  const [q, setQ] = useState('')
  const [module, setModule] = useState('all')
  const [risk, setRisk] = useState('all')

  const query = useMemo(() => {
    const p = new URLSearchParams()
    if (q) p.set('q', q)
    if (module !== 'all') p.set('module', module)
    if (risk !== 'all') p.set('risk', risk)
    const s = p.toString()
    return s ? `?${s}` : ''
  }, [q, module, risk])

  const { data, loading, error, reload } = useFetch<LogsResponse>(`/admin/audit-logs${query}`, [query])

  const logs = data?.logs ?? []

  return (
    <>
      <PageHeader
        title="操作日志"
        description="查看管理员操作审计日志，按模块、风险等级与操作人筛选。"
      />

      <FilterBar>
        <Field label="搜索">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="操作 / 对象 ID / 操作人"
              className="pl-8"
            />
          </div>
        </Field>
        <Field label="模块">
          <Select value={module} onChange={(e) => setModule(e.target.value)}>
            <option value="all">全部</option>
            {MODULE_OPTIONS.map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </Select>
        </Field>
        <Field label="风险">
          <Select value={risk} onChange={(e) => setRisk(e.target.value)}>
            <option value="all">全部</option>
            <option value="low">低</option>
            <option value="medium">中</option>
            <option value="high">高</option>
          </Select>
        </Field>
        <Button variant="ghost" onClick={() => { setQ(''); setModule('all'); setRisk('all') }}>
          <RotateCcw data-icon="inline-start" /> 重置
        </Button>
      </FilterBar>

      <Card>
        <div className="border-b border-border px-4 py-2.5 text-xs text-muted-foreground">
          {loading ? '加载中…' : `共 ${logs.length} 条日志`}
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>模块</TableHead>
              <TableHead>操作</TableHead>
              <TableHead>对象</TableHead>
              <TableHead>风险</TableHead>
              <TableHead>操作人</TableHead>
              <TableHead>IP</TableHead>
              <TableHead>时间</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {error ? (
              <TableRow>
                <TableCell colSpan={7} className="py-8 text-center text-sm text-destructive">
                  <div className="flex flex-col items-center gap-2">
                    <AlertCircle className="size-4" />
                    <span>{error}</span>
                    <Button variant="outline" size="sm" onClick={reload}>重试</Button>
                  </div>
                </TableCell>
              </TableRow>
            ) : loading ? (
              <TableRow>
                <TableCell colSpan={7} className="py-8 text-center text-sm text-muted-foreground">
                  <Loader2 className="mx-auto size-4 animate-spin" />
                </TableCell>
              </TableRow>
            ) : logs.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="py-8 text-center text-sm text-muted-foreground">
                  暂无日志数据
                </TableCell>
              </TableRow>
            ) : (
              logs.map((l) => {
                const r = riskBadge(l.risk)
                return (
                  <TableRow key={l.id}>
                    <TableCell>
                      <StatusBadge label={l.module || '—'} variant="outline" />
                    </TableCell>
                    <TableCell className="text-sm">{l.action}</TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {l.target_type ? `${l.target_type}:${l.target_id ?? ''}` : '—'}
                    </TableCell>
                    <TableCell><StatusBadge label={r.label} variant={r.variant} /></TableCell>
                    <TableCell className="text-xs">{l.operator_name || '—'}</TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">{l.ip || '—'}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{formatDate(l.created_at)}</TableCell>
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
