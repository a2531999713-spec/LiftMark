'use client'

import { useMemo, useState } from 'react'
import { Search, RotateCcw, Crown, Plus } from 'lucide-react'
import { PageHeader, FilterBar, Field } from '@/components/admin/page-parts'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input, Select } from '@/components/ui/field'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
import { StatusBadge, TierBadge } from '@/components/admin/status-badge'
import { GrantMembershipModal } from '@/components/admin/grant-membership'
import { memberships, dashboardStats, type Membership } from '@/lib/data'

const sourceLabel: Record<Membership['source'], string> = {
  manual: '手动开通',
  payment: '付费购买',
  code: '激活码',
  beta: '内测赠送',
  campus: '校园推广',
  partner: '合作方',
  compensation: '客服补偿',
}

const statusMeta: Record<Membership['status'], { label: string; variant: 'success' | 'warning' | 'danger' }> = {
  active: { label: '有效', variant: 'success' },
  expired: { label: '已过期', variant: 'warning' },
  revoked: { label: '已撤销', variant: 'danger' },
}

export default function MembershipPage() {
  const [q, setQ] = useState('')
  const [tier, setTier] = useState('all')
  const [source, setSource] = useState('all')
  const [grant, setGrant] = useState(false)

  const filtered = useMemo(
    () =>
      memberships.filter((m) => {
        if (q && !`${m.userName}${m.userId}${m.id}`.toLowerCase().includes(q.toLowerCase())) return false
        if (tier !== 'all' && m.tier !== tier) return false
        if (source !== 'all' && m.source !== source) return false
        return true
      }),
    [q, tier, source],
  )

  const stats = [
    { label: 'Pro 会员', value: dashboardStats.proUsers, hint: '当前有效' },
    { label: '永久会员', value: dashboardStats.lifetimeUsers, hint: '当前有效' },
    { label: '本月激活码兑换', value: dashboardStats.codeRedeems, hint: '成功兑换' },
    { label: '即将到期（30天）', value: 47, hint: '需关注续费' },
  ]

  return (
    <>
      <PageHeader
        title="会员与权益"
        description="管理 Pro 与永久会员，手动开通/续期/撤销权益，配置每位用户的 Pro 小组数量与人数上限。"
        actions={
          <Button onClick={() => setGrant(true)}>
            <Plus data-icon="inline-start" /> 开通/赠送会员
          </Button>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {stats.map((s) => (
          <Card key={s.label} className="p-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Crown className="size-4 text-primary" /> {s.label}
            </div>
            <div className="mt-1.5 text-2xl font-semibold tabular-nums">{s.value.toLocaleString()}</div>
            <div className="mt-0.5 text-xs text-muted-foreground">{s.hint}</div>
          </Card>
        ))}
      </div>

      <FilterBar>
        <Field label="搜索">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="用户 / 会员编号" className="pl-8" />
          </div>
        </Field>
        <Field label="会员类型">
          <Select value={tier} onChange={(e) => setTier(e.target.value)}>
            <option value="all">全部</option>
            <option value="pro">Pro 会员</option>
            <option value="lifetime">永久会员</option>
          </Select>
        </Field>
        <Field label="开通来源">
          <Select value={source} onChange={(e) => setSource(e.target.value)}>
            <option value="all">全部</option>
            {Object.entries(sourceLabel).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </Select>
        </Field>
        <Button variant="ghost" onClick={() => { setQ(''); setTier('all'); setSource('all') }}>
          <RotateCcw data-icon="inline-start" /> 重置
        </Button>
      </FilterBar>

      <Card>
        <div className="border-b border-border px-4 py-2.5 text-xs text-muted-foreground">共 {filtered.length} 条会员记录</div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>会员编号</TableHead>
              <TableHead>用户</TableHead>
              <TableHead>类型</TableHead>
              <TableHead>来源</TableHead>
              <TableHead>有效期</TableHead>
              <TableHead className="text-right">Pro 组</TableHead>
              <TableHead className="text-right">每组上限</TableHead>
              <TableHead>操作人</TableHead>
              <TableHead>状态</TableHead>
              <TableHead className="text-right">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((m) => (
              <TableRow key={m.id}>
                <TableCell className="font-mono text-xs">{m.id}</TableCell>
                <TableCell>
                  <span className="block font-medium">{m.userName}</span>
                  <span className="block font-mono text-xs text-muted-foreground">{m.userId}</span>
                </TableCell>
                <TableCell><TierBadge tier={m.tier} /></TableCell>
                <TableCell className="text-xs">{sourceLabel[m.source]}</TableCell>
                <TableCell className="text-xs text-muted-foreground">{m.startAt} ~ {m.endAt}</TableCell>
                <TableCell className="text-right tabular-nums">{m.usedProGroups}/{m.proGroups}</TableCell>
                <TableCell className="text-right tabular-nums">{m.maxPerGroup}</TableCell>
                <TableCell className="text-xs">{m.operator}</TableCell>
                <TableCell><StatusBadge label={statusMeta[m.status].label} variant={statusMeta[m.status].variant} /></TableCell>
                <TableCell className="text-right">
                  <Button variant="outline" size="sm" onClick={() => setGrant(true)}>调整</Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      <GrantMembershipModal open={grant} onClose={() => setGrant(false)} />
    </>
  )
}
