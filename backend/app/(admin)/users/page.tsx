'use client'

import { Suspense, useMemo, useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Search, RotateCcw } from 'lucide-react'
import { PageHeader, FilterBar, Field } from '@/components/admin/page-parts'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input, Select } from '@/components/ui/field'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
import { Avatar } from '@/components/admin/avatar'
import { SensitiveValue } from '@/components/admin/sensitive'
import { TierBadge, AccountStatusBadge } from '@/components/admin/status-badge'
import { useFetch, formatDate, maskPhone } from '@/lib/hooks'

type User = {
  id: string
  nickname: string
  phone: string | null
  email: string | null
  avatar_url: string | null
  liftmark_id: string
  role: string
  status: string
  registered_at: string | null
  last_login_at: string | null
  created_at: string
  tier: string
  is_lifetime: boolean
  tier_expires_at: string | null
  groups: number
  members: number
  trainings: number
}

function UsersContent() {
  const params = useSearchParams()
  const [q, setQ] = useState(params.get('q') ?? '')
  const [tier, setTier] = useState('all')
  const [status, setStatus] = useState('all')

  useEffect(() => {
    const qParam = params.get('q')
    if (qParam) setQ(qParam)
  }, [params])

  const query = useMemo(() => {
    const p = new URLSearchParams()
    if (q) p.set('q', q)
    if (tier !== 'all') p.set('tier', tier)
    if (status !== 'all') p.set('status', status)
    const s = p.toString()
    return s ? `?${s}` : ''
  }, [q, tier, status])

  const { data, loading, error } = useFetch<{ users: User[] }>(`/admin/users/search${query}`, [query])

  const users = data?.users ?? []

  return (
    <>
      <PageHeader
        title="用户管理"
        description="搜索用户、查看用户详情、处理账号问题与数据修正。手机号等敏感信息默认脱敏。"
      />

      <FilterBar>
        <Field label="搜索">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="手机号 / 用户 ID / 练刻 ID / 昵称"
              className="pl-8"
            />
          </div>
        </Field>
        <Field label="会员状态">
          <Select value={tier} onChange={(e) => setTier(e.target.value)}>
            <option value="all">全部</option>
            <option value="free">免费</option>
            <option value="pro">Pro 会员</option>
            <option value="lifetime">永久会员</option>
          </Select>
        </Field>
        <Field label="账号状态">
          <Select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="all">全部</option>
            <option value="normal">正常</option>
            <option value="disabled">已禁用</option>
          </Select>
        </Field>
        <Button variant="ghost" onClick={() => { setQ(''); setTier('all'); setStatus('all') }}>
          <RotateCcw data-icon="inline-start" /> 重置
        </Button>
      </FilterBar>

      <Card>
        <div className="flex items-center justify-between border-b border-border px-4 py-2.5 text-xs text-muted-foreground">
          <span>共 {users.length} 名用户</span>
          {loading ? <span>加载中...</span> : error ? <span className="text-destructive">{error}</span> : null}
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>用户</TableHead>
              <TableHead>手机号</TableHead>
              <TableHead>练刻 ID</TableHead>
              <TableHead>注册时间</TableHead>
              <TableHead>最近登录</TableHead>
              <TableHead>会员</TableHead>
              <TableHead className="text-right">小组</TableHead>
              <TableHead className="text-right">训练</TableHead>
              <TableHead>状态</TableHead>
              <TableHead className="text-right">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((u) => (
              <TableRow key={u.id}>
                <TableCell>
                  <Link href={`/users/${u.id}`} className="flex items-center gap-2 hover:text-primary">
                    <Avatar name={u.nickname || u.id} />
                    <span>
                      <span className="block font-medium">{u.nickname || '（未设置昵称）'}</span>
                      <span className="block font-mono text-xs text-muted-foreground">{u.id}</span>
                    </span>
                  </Link>
                </TableCell>
                <TableCell>
                  <SensitiveValue masked={maskPhone(u.phone)} full={u.phone ?? ''} />
                </TableCell>
                <TableCell className="font-mono text-xs">{u.liftmark_id || '—'}</TableCell>
                <TableCell className="text-xs text-muted-foreground">{formatDate(u.registered_at || u.created_at)}</TableCell>
                <TableCell className="text-xs text-muted-foreground">{formatDate(u.last_login_at)}</TableCell>
                <TableCell><TierBadge tier={(u.is_lifetime ? 'lifetime' : u.tier) as 'free' | 'pro' | 'lifetime'} /></TableCell>
                <TableCell className="text-right tabular-nums">{u.groups}</TableCell>
                <TableCell className="text-right tabular-nums">{u.trainings}</TableCell>
                <TableCell><AccountStatusBadge status={(u.status === 'normal' ? 'active' : u.status) as 'active' | 'disabled' | 'abnormal'} /></TableCell>
                <TableCell className="text-right">
                  <Button variant="outline" size="sm" render={<Link href={`/users/${u.id}`} />}>
                    详情
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {!loading && users.length === 0 && (
              <TableRow>
                <TableCell colSpan={10} className="text-center text-sm text-muted-foreground py-8">
                  {error ? `加载失败：${error}` : '暂无用户数据'}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>
    </>
  )
}

export default function UsersPage() {
  return (
    <Suspense fallback={<div className="text-sm text-muted-foreground">加载中...</div>}>
      <UsersContent />
    </Suspense>
  )
}
