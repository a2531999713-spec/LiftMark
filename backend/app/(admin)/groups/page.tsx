'use client'

import { useMemo, useState } from 'react'
import { Search, RotateCcw } from 'lucide-react'
import { PageHeader, FilterBar, Field } from '@/components/admin/page-parts'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/field'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
import { TierBadge } from '@/components/admin/status-badge'
import { useFetch, formatDate, maskPhone } from '@/lib/hooks'

type Group = {
  id: string
  name: string
  ownerUserId: string
  ownerName: string
  ownerPhone: string | null
  ownerTier: string
  membershipEnabled: boolean
  memberLimit: number
  memberCount: number
  inviteCode: string
  createdAt: string
  updatedAt: string
}

export default function GroupsPage() {
  const [q, setQ] = useState('')

  const query = useMemo(() => {
    const p = new URLSearchParams()
    if (q) p.set('q', q)
    const s = p.toString()
    return s ? `?${s}` : ''
  }, [q])

  const { data, loading, error } = useFetch<{ groups: Group[] }>(
    `/admin/groups/list${query}`,
    [query],
  )

  const groups = data?.groups ?? []

  return (
    <>
      <PageHeader
        title="小组管理"
        description="查看所有小组与组长信息、邀请码、成员配额。支持按小组名称、ID、组长手机号或昵称搜索。"
      />

      <FilterBar>
        <Field label="搜索">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="小组名称 / ID / 组长手机号 / 昵称"
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
          <span>共 {groups.length} 个小组</span>
          {loading ? (
            <span>加载中...</span>
          ) : error ? (
            <span className="text-destructive">{error}</span>
          ) : null}
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>小组名称</TableHead>
              <TableHead>组长</TableHead>
              <TableHead>组长会员</TableHead>
              <TableHead className="text-right">成员数</TableHead>
              <TableHead className="text-right">成员上限</TableHead>
              <TableHead>邀请码</TableHead>
              <TableHead>创建时间</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {groups.map((g) => (
              <TableRow key={g.id}>
                <TableCell>
                  <span className="block font-medium">{g.name || '（未命名）'}</span>
                  <span className="block font-mono text-xs text-muted-foreground">{g.id}</span>
                </TableCell>
                <TableCell>
                  <span className="block">{g.ownerName || '—'}</span>
                  <span className="block font-mono text-xs text-muted-foreground">
                    {maskPhone(g.ownerPhone)}
                  </span>
                </TableCell>
                <TableCell>
                  <TierBadge tier={(g.ownerTier || 'free') as 'free' | 'pro' | 'lifetime'} />
                </TableCell>
                <TableCell className="text-right tabular-nums">{g.memberCount ?? 0}</TableCell>
                <TableCell className="text-right tabular-nums">{g.memberLimit ?? 0}</TableCell>
                <TableCell className="font-mono text-xs">{g.inviteCode || '—'}</TableCell>
                <TableCell className="text-xs text-muted-foreground">{formatDate(g.createdAt)}</TableCell>
              </TableRow>
            ))}
            {!loading && groups.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="py-8 text-center text-sm text-muted-foreground">
                  {error ? `加载失败：${error}` : '暂无小组数据'}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>
    </>
  )
}
