'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { Search, Download, RotateCcw } from 'lucide-react'
import { PageHeader, FilterBar, Field } from '@/components/admin/page-parts'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input, Select } from '@/components/ui/field'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
import { Avatar } from '@/components/admin/avatar'
import { SensitiveValue } from '@/components/admin/sensitive'
import { SyncBadge, TierBadge, AccountStatusBadge } from '@/components/admin/status-badge'
import { users, maskPhone } from '@/lib/data'

export default function UsersPage() {
  const [q, setQ] = useState('')
  const [tier, setTier] = useState('all')
  const [status, setStatus] = useState('all')
  const [sync, setSync] = useState('all')

  const filtered = useMemo(() => {
    return users.filter((u) => {
      if (q && !`${u.name}${u.phone}${u.id}${u.liftId}`.toLowerCase().includes(q.toLowerCase())) return false
      if (tier !== 'all' && u.tier !== tier) return false
      if (status !== 'all' && u.status !== status) return false
      if (sync !== 'all' && u.sync !== sync) return false
      return true
    })
  }, [q, tier, status, sync])

  return (
    <>
      <PageHeader
        title="用户管理"
        description="搜索用户、查看用户详情、处理账号问题与数据修正。手机号等敏感信息默认脱敏。"
        actions={
          <Button variant="outline">
            <Download data-icon="inline-start" /> 导出（需原因）
          </Button>
        }
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
            <option value="active">正常</option>
            <option value="disabled">已禁用</option>
            <option value="abnormal">异常</option>
          </Select>
        </Field>
        <Field label="云同步状态">
          <Select value={sync} onChange={(e) => setSync(e.target.value)}>
            <option value="all">全部</option>
            <option value="synced">已同步</option>
            <option value="pending_sync">待同步</option>
            <option value="sync_failed">同步失败</option>
            <option value="conflict">数据冲突</option>
            <option value="local_only">仅本地</option>
          </Select>
        </Field>
        <Button
          variant="ghost"
          onClick={() => {
            setQ('')
            setTier('all')
            setStatus('all')
            setSync('all')
          }}
        >
          <RotateCcw data-icon="inline-start" /> 重置
        </Button>
      </FilterBar>

      <Card>
        <div className="flex items-center justify-between border-b border-border px-4 py-2.5 text-xs text-muted-foreground">
          <span>共 {filtered.length} 名用户</span>
          <span>手机号默认脱敏 · 查看完整信息将记录审计日志</span>
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
              <TableHead className="text-right">成员</TableHead>
              <TableHead className="text-right">训练</TableHead>
              <TableHead>同步</TableHead>
              <TableHead>状态</TableHead>
              <TableHead className="text-right">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((u) => (
              <TableRow key={u.id}>
                <TableCell>
                  <Link href={`/users/${u.id}`} className="flex items-center gap-2 hover:text-primary">
                    <Avatar name={u.name} />
                    <span>
                      <span className="block font-medium">{u.name}</span>
                      <span className="block font-mono text-xs text-muted-foreground">{u.id}</span>
                    </span>
                  </Link>
                </TableCell>
                <TableCell>
                  <SensitiveValue masked={maskPhone(u.phone)} full={u.phone} />
                </TableCell>
                <TableCell className="font-mono text-xs">{u.liftId}</TableCell>
                <TableCell className="text-xs text-muted-foreground">{u.registeredAt}</TableCell>
                <TableCell className="text-xs text-muted-foreground">{u.lastLogin}</TableCell>
                <TableCell><TierBadge tier={u.tier} /></TableCell>
                <TableCell className="text-right tabular-nums">{u.groups}</TableCell>
                <TableCell className="text-right tabular-nums">{u.members}</TableCell>
                <TableCell className="text-right tabular-nums">{u.trainings}</TableCell>
                <TableCell><SyncBadge status={u.sync} /></TableCell>
                <TableCell><AccountStatusBadge status={u.status} /></TableCell>
                <TableCell className="text-right">
                  <Button variant="outline" size="sm" render={<Link href={`/users/${u.id}`} />}>
                    详情
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </>
  )
}
