'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import {
  ArrowLeft, Crown, Ban, ShieldAlert, Phone, ImageUp, RefreshCw,
  Wrench, GitMerge, Download, StickyNote, Smartphone,
} from 'lucide-react'
import { PageHeader, InfoRow } from '@/components/admin/page-parts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/field'
import { Avatar } from '@/components/admin/avatar'
import { SensitiveValue } from '@/components/admin/sensitive'
import { SyncBadge, TierBadge, AccountStatusBadge, StatusBadge } from '@/components/admin/status-badge'
import { GrantMembershipModal } from '@/components/admin/grant-membership'
import { CorrectionModal } from '@/components/admin/correction-modal'
import { DangerConfirm } from '@/components/admin/danger-confirm'
import { useFetch, useMutate, formatDate, formatDateShort, maskPhone } from '@/lib/hooks'
import { cn } from '@/lib/utils'
import type { SyncStatus } from '@/lib/data'

const tabs = ['基础与账号', '会员权益', '小组与成员', '训练与同步', '订单与反馈', '修正与日志']

type Variant = 'default' | 'primary' | 'success' | 'warning' | 'danger' | 'info' | 'outline'

type DetailUser = {
  id: string
  nickname: string
  phone: string | null
  email: string | null
  avatarUrl: string | null
  liftmarkId: string
  role: string
  status: string
  registeredAt: string | null
  lastLoginAt: string | null
  createdAt: string
}

type DetailMembership = {
  id: string
  type: string
  isLifetime: boolean
  expiresAt: string | null
  startAt?: string | null
  source?: string
  proGroups?: number
  usedProGroups?: number
  maxPerGroup?: number
  status?: string
} | null

type DetailGroup = {
  id: string
  group_id: string
  group_name: string
  status: string
  joined_at: string
}

type DetailSession = {
  id: string
  title: string
  status: string
  created_at: string
}

type DetailOrder = {
  id: string
  status: string
  amount: number
  product?: string
}

type DetailFeedback = {
  id: string
  type: string
  content: string
  status: string
  title?: string
}

type DetailSyncState = {
  id: string
  device_id: string
  last_pulled_at: string | null
  status?: string
}

type DetailNote = {
  id: string
  operator_name: string
  content: string
  created_at: string
}

type DetailCorrection = {
  id: string
  target_type: string
  field: string
  before_value: string
  after_value: string
  status: string
  operator?: string
  created_at?: string
}

type DetailCodeRedemption = {
  id: string
  code_prefix: string
  membership_type: string
  redeemed_at: string
}

type UserDetail = {
  user: DetailUser
  membership: DetailMembership
  groups: DetailGroup[]
  sessions: DetailSession[]
  orders: DetailOrder[]
  feedback: DetailFeedback[]
  syncStates: DetailSyncState[]
  notes: DetailNote[]
  corrections: DetailCorrection[]
  codeRedemptions: DetailCodeRedemption[]
}

type DangerState = {
  action: string
  before?: string
  after?: string
  phrase?: string
  targetStatus?: 'normal' | 'disabled'
}

function accountStatus(s: string): 'active' | 'disabled' | 'abnormal' {
  if (s === 'disabled') return 'disabled'
  if (s === 'abnormal') return 'abnormal'
  return 'active'
}

function deriveSyncStatus(syncStates: DetailSyncState[]): SyncStatus {
  if (syncStates.length === 0) return 'local_only'
  const statuses = syncStates.map((s) => s.status).filter((v): v is string => Boolean(v))
  if (statuses.length === 0) return 'synced'
  if (statuses.includes('sync_failed')) return 'sync_failed'
  if (statuses.includes('conflict')) return 'conflict'
  if (statuses.includes('pending_sync')) return 'pending_sync'
  if (statuses.includes('syncing')) return 'syncing'
  if (statuses.includes('deleted_pending')) return 'deleted_pending'
  return 'synced'
}

function sessionStatusBadge(s: string): { label: string; variant: Variant } {
  switch (s) {
    case 'completed': return { label: '已完成', variant: 'success' }
    case 'active': return { label: '进行中', variant: 'info' }
    case 'draft': return { label: '草稿', variant: 'outline' }
    case 'archived': return { label: '已归档', variant: 'outline' }
    default: return { label: s || '—', variant: 'outline' }
  }
}

function orderStatusBadge(s: string): { label: string; variant: Variant } {
  switch (s) {
    case 'paid': return { label: '已支付', variant: 'success' }
    case 'refunded': return { label: '已退款', variant: 'outline' }
    case 'failed': return { label: '支付失败', variant: 'danger' }
    case 'pending': return { label: '待支付', variant: 'warning' }
    default: return { label: s || '—', variant: 'outline' }
  }
}

function feedbackStatusBadge(s: string): { label: string; variant: Variant } {
  switch (s) {
    case 'open': return { label: '待处理', variant: 'warning' }
    case 'resolved': return { label: '已处理', variant: 'success' }
    case 'closed': return { label: '已关闭', variant: 'outline' }
    default: return { label: s || '—', variant: 'outline' }
  }
}

function correctionStatusBadge(s: string): { label: string; variant: Variant } {
  switch (s) {
    case 'done': return { label: '已完成', variant: 'success' }
    case 'pending': return { label: '待执行', variant: 'warning' }
    case 'rolled_back': return { label: '已回滚', variant: 'outline' }
    default: return { label: s || '—', variant: 'outline' }
  }
}

function groupStatusBadge(s: string): { label: string; variant: Variant } {
  switch (s) {
    case 'owner': return { label: '组长', variant: 'primary' }
    case 'active': return { label: '成员', variant: 'outline' }
    case 'left': return { label: '已退出', variant: 'outline' }
    default: return { label: s || '—', variant: 'outline' }
  }
}

export default function UserDetailPage() {
  const params = useParams()
  const id = String(params?.id ?? '')
  const { data, loading, error, reload } = useFetch<UserDetail>(
    id ? `/admin/users/${id}/detail` : null,
    [id],
  )
  const statusMutate = useMutate()
  const noteMutate = useMutate()

  const [tab, setTab] = useState(0)
  const [grant, setGrant] = useState(false)
  const [correct, setCorrect] = useState(false)
  const [danger, setDanger] = useState<DangerState | null>(null)
  const [noteOpen, setNoteOpen] = useState(false)
  const [noteContent, setNoteContent] = useState('')

  const user = data?.user ?? null
  const membership = data?.membership ?? null
  const groups = data?.groups ?? []
  const sessions = data?.sessions ?? []
  const orders = data?.orders ?? []
  const feedback = data?.feedback ?? []
  const syncStates = data?.syncStates ?? []
  const notes = data?.notes ?? []
  const corrections = data?.corrections ?? []
  const codeRedemptions = data?.codeRedemptions ?? []

  const tier: 'free' | 'pro' | 'lifetime' = membership?.isLifetime
    ? 'lifetime'
    : membership
      ? 'pro'
      : 'free'

  async function handleDangerConfirm(_reason: string) {
    const d = danger
    setDanger(null)
    if (!d?.targetStatus) return
    try {
      await statusMutate.mutate('PATCH', `/admin/users/${id}/status`, { status: d.targetStatus })
      reload()
    } catch {
      // 错误已记录在 statusMutate.error
    }
  }

  async function handleAddNote() {
    const content = noteContent.trim()
    if (!content) return
    try {
      await noteMutate.mutate('POST', `/admin/users/${id}/notes`, { content })
      setNoteContent('')
      setNoteOpen(false)
      reload()
    } catch {
      // 错误已记录在 noteMutate.error
    }
  }

  return (
    <>
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link href="/users" className="flex items-center gap-1 hover:text-primary">
          <ArrowLeft className="size-4" /> 用户管理
        </Link>
        <span>/</span>
        <span className="font-mono text-foreground">{id}</span>
      </div>

      <PageHeader
        title={user ? `${user.nickname || user.id} 的用户详情` : `用户 ${id} 详情`}
        description="查看用户全量数据、处理账号问题并执行数据修正。敏感信息默认脱敏。"
      />

      {!data || !user ? (
        <Card>
          <CardContent className="p-12 text-center text-sm text-muted-foreground">
            {loading ? (
              '加载中...'
            ) : error ? (
              <div>
                <p className="mb-3 text-destructive">加载失败：{error}</p>
                <Button variant="outline" size="sm" onClick={reload}>重试</Button>
              </div>
            ) : (
              '未找到用户数据'
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="flex flex-col gap-4 xl:flex-row">
          {/* 概要卡 + 操作面板 */}
          <div className="w-full space-y-4 xl:w-72 xl:shrink-0">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <Avatar name={user.nickname || user.id} className="size-12 text-lg" />
                  <div className="min-w-0">
                    <div className="truncate text-base font-semibold">{user.nickname || '（未设置昵称）'}</div>
                    <div className="font-mono text-xs text-muted-foreground">{user.liftmarkId || user.id}</div>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  <TierBadge tier={tier} />
                  <AccountStatusBadge status={accountStatus(user.status)} />
                  <SyncBadge status={deriveSyncStatus(syncStates)} />
                </div>
                <dl className="mt-3 border-t border-border pt-2">
                  <InfoRow label="手机号">
                    <SensitiveValue masked={maskPhone(user.phone)} full={user.phone ?? ''} />
                  </InfoRow>
                  <InfoRow label="注册时间">{formatDate(user.registeredAt)}</InfoRow>
                  <InfoRow label="最近登录">{formatDate(user.lastLoginAt)}</InfoRow>
                </dl>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>管理员操作</CardTitle>
              </CardHeader>
              <CardContent className="space-y-1.5">
                <Button variant="outline" size="sm" className="w-full justify-start" onClick={() => setGrant(true)}>
                  <Crown data-icon="inline-start" /> 发放 / 延长会员
                </Button>
                <Button variant="outline" size="sm" className="w-full justify-start" onClick={() => setCorrect(true)}>
                  <Wrench data-icon="inline-start" /> 新建数据修正任务
                </Button>
                <Button variant="outline" size="sm" className="w-full justify-start" onClick={() => setDanger({ action: '触发重新同步', before: deriveSyncStatus(syncStates), after: 'pending_sync' })}>
                  <RefreshCw data-icon="inline-start" /> 触发重新同步
                </Button>
                <Button variant="outline" size="sm" className="w-full justify-start" onClick={() => setDanger({ action: '修复头像同步', before: '失败', after: '重新处理' })}>
                  <ImageUp data-icon="inline-start" /> 修复头像同步
                </Button>
                <Button variant="outline" size="sm" className="w-full justify-start" onClick={() => setNoteOpen((v) => !v)}>
                  <StickyNote data-icon="inline-start" /> 添加管理员备注
                </Button>
                <Button variant="outline" size="sm" className="w-full justify-start">
                  <Download data-icon="inline-start" /> 导出用户数据
                </Button>

                <div className="pt-2 text-[11px] font-medium text-destructive">高危操作</div>
                <Button variant="destructive" size="sm" className="w-full justify-start" onClick={() => setDanger({ action: '修改手机号', before: maskPhone(user.phone), after: '—', phrase: '确认修改' })}>
                  <Phone data-icon="inline-start" /> 修改手机号
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  className="w-full justify-start"
                  onClick={() => setDanger({
                    action: user.status === 'disabled' ? '解禁账号' : '禁用账号',
                    before: user.status === 'disabled' ? 'disabled' : 'normal',
                    after: user.status === 'disabled' ? 'normal' : 'disabled',
                    targetStatus: user.status === 'disabled' ? 'normal' : 'disabled',
                  })}
                >
                  <Ban data-icon="inline-start" /> {user.status === 'disabled' ? '解禁账号' : '禁用账号'}
                </Button>
                <Button variant="destructive" size="sm" className="w-full justify-start" onClick={() => setDanger({ action: '标记异常用户', before: user.status, after: 'abnormal' })}>
                  <ShieldAlert data-icon="inline-start" /> 标记异常用户
                </Button>
                <Button variant="destructive" size="sm" className="w-full justify-start" onClick={() => setDanger({ action: '合并重复账号', before: '2 个账号', after: '1 个账号' })}>
                  <GitMerge data-icon="inline-start" /> 合并重复账号
                </Button>

                {statusMutate.loading && <p className="pt-1 text-xs text-muted-foreground">状态更新中...</p>}
                {statusMutate.error && <p className="text-xs text-destructive">状态更新失败：{statusMutate.error}</p>}
              </CardContent>
            </Card>

            {noteOpen && (
              <Card>
                <CardHeader>
                  <CardTitle>添加管理员备注</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <Textarea
                    value={noteContent}
                    onChange={(e) => setNoteContent(e.target.value)}
                    placeholder="请输入备注内容"
                    rows={3}
                  />
                  {noteMutate.error && <p className="text-xs text-destructive">{noteMutate.error}</p>}
                  <div className="flex justify-end gap-2">
                    <Button variant="outline" size="sm" onClick={() => { setNoteOpen(false); setNoteContent('') }}>
                      取消
                    </Button>
                    <Button size="sm" onClick={handleAddNote} disabled={noteMutate.loading || !noteContent.trim()}>
                      {noteMutate.loading ? '提交中...' : '提交'}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* 详情主体 */}
          <div className="min-w-0 flex-1 space-y-4">
            <div className="flex flex-wrap gap-1 rounded-lg border border-border bg-card p-1">
              {tabs.map((t, i) => (
                <button
                  key={t}
                  onClick={() => setTab(i)}
                  className={cn(
                    'rounded-md px-3 py-1.5 text-sm transition-colors',
                    tab === i ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted',
                  )}
                >
                  {t}
                </button>
              ))}
            </div>

            {tab === 0 && (
              <div className="grid gap-4 md:grid-cols-2">
                <Card>
                  <CardHeader><CardTitle>用户基础信息</CardTitle></CardHeader>
                  <CardContent>
                    <dl>
                      <InfoRow label="用户 ID">{user.id}</InfoRow>
                      <InfoRow label="昵称">{user.nickname || '—'}</InfoRow>
                      <InfoRow label="练刻 ID">{user.liftmarkId || '—'}</InfoRow>
                      <InfoRow label="邮箱">{user.email || '—'}</InfoRow>
                      <InfoRow label="角色">{user.role || '—'}</InfoRow>
                    </dl>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader><CardTitle>账号安全与登录</CardTitle></CardHeader>
                  <CardContent>
                    <dl>
                      <InfoRow label="登录方式">手机号验证码</InfoRow>
                      <InfoRow label="手机号"><SensitiveValue masked={maskPhone(user.phone)} full={user.phone ?? ''} /></InfoRow>
                      <InfoRow label="账号状态"><AccountStatusBadge status={accountStatus(user.status)} /></InfoRow>
                      <InfoRow label="注册时间">{formatDate(user.registeredAt)}</InfoRow>
                      <InfoRow label="最近登录">{formatDate(user.lastLoginAt)}</InfoRow>
                      <InfoRow label="同步设备数">{syncStates.length}</InfoRow>
                    </dl>
                  </CardContent>
                </Card>
              </div>
            )}

            {tab === 1 && (
              <div className="grid gap-4 md:grid-cols-2">
                <Card>
                  <CardHeader>
                    <CardTitle>会员权益与来源</CardTitle>
                    <Button size="sm" onClick={() => setGrant(true)}><Crown data-icon="inline-start" /> 发放会员</Button>
                  </CardHeader>
                  <CardContent className="p-0">
                    {membership ? (
                      <div className="border-b border-border p-4 last:border-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <TierBadge tier={tier} />
                          {membership.isLifetime && <Badge variant="warning">永久</Badge>}
                          <Badge variant="outline">{membership.type}</Badge>
                          {membership.source && <Badge variant="info">来源：{membership.source}</Badge>}
                          <span className="ml-auto font-mono text-xs text-muted-foreground">{membership.id}</span>
                        </div>
                        <div className="mt-2 grid grid-cols-2 gap-x-6 md:grid-cols-3">
                          <InfoRow label="生效">{formatDateShort(membership.startAt)}</InfoRow>
                          <InfoRow label="到期">{membership.isLifetime ? '永久' : formatDateShort(membership.expiresAt)}</InfoRow>
                          <InfoRow label="Pro 小组">{membership.proGroups ?? '—'}</InfoRow>
                        </div>
                      </div>
                    ) : (
                      <div className="p-4 text-sm text-muted-foreground">该用户暂无会员权益记录。</div>
                    )}
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader><CardTitle>激活码兑换记录</CardTitle></CardHeader>
                  <CardContent className="space-y-2">
                    {codeRedemptions.length ? codeRedemptions.map((c) => (
                      <div key={c.id} className="flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm">
                        <span className="font-mono text-xs">{c.code_prefix}****</span>
                        <Badge variant="outline">{c.membership_type}</Badge>
                        <span className="ml-auto text-xs text-muted-foreground">{formatDateShort(c.redeemed_at)}</span>
                      </div>
                    )) : <div className="text-sm text-muted-foreground">无激活码兑换记录</div>}
                  </CardContent>
                </Card>
              </div>
            )}

            {tab === 2 && (
              <div className="grid gap-4 md:grid-cols-2">
                <Card>
                  <CardHeader><CardTitle>小组列表（{groups.length}）</CardTitle></CardHeader>
                  <CardContent className="space-y-2">
                    {groups.length ? groups.map((g) => {
                      const gb = groupStatusBadge(g.status)
                      return (
                        <div key={g.id} className="flex items-center justify-between rounded-md border border-border px-3 py-2 text-sm">
                          <span className="flex items-center gap-2">
                            <span>{g.group_name}</span>
                            <span className="font-mono text-xs text-muted-foreground">{g.group_id}</span>
                          </span>
                          <StatusBadge label={gb.label} variant={gb.variant} />
                        </div>
                      )
                    }) : <div className="text-sm text-muted-foreground">未加入任何小组</div>}
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader><CardTitle>成员档案</CardTitle></CardHeader>
                  <CardContent>
                    <div className="text-sm text-muted-foreground">暂无成员档案数据</div>
                  </CardContent>
                </Card>
              </div>
            )}

            {tab === 3 && (
              <div className="space-y-4">
                <Card>
                  <CardHeader><CardTitle>训练数据汇总</CardTitle></CardHeader>
                  <CardContent className="grid grid-cols-3 gap-4">
                    <div><div className="text-2xl font-semibold">{sessions.length}</div><div className="text-xs text-muted-foreground">近期 session</div></div>
                    <div><div className="text-2xl font-semibold">{syncStates.length}</div><div className="text-xs text-muted-foreground">同步设备</div></div>
                    <div><div className="text-2xl font-semibold">{groups.length}</div><div className="text-xs text-muted-foreground">加入小组</div></div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader><CardTitle>近期训练与同步</CardTitle></CardHeader>
                  <CardContent className="space-y-2">
                    {sessions.length ? sessions.map((s) => {
                      const sb = sessionStatusBadge(s.status)
                      return (
                        <div key={s.id} className="flex items-center gap-3 rounded-md border border-border px-3 py-2 text-sm">
                          <span className="font-mono text-xs text-muted-foreground">{s.id}</span>
                          <span className="flex-1 truncate">{s.title}</span>
                          <StatusBadge label={sb.label} variant={sb.variant} />
                          <span className="text-xs text-muted-foreground">{formatDateShort(s.created_at)}</span>
                          <Button size="xs" variant="outline" render={<Link href={`/training/${s.id}`} />}>查看</Button>
                        </div>
                      )
                    }) : <div className="text-sm text-muted-foreground">暂无训练记录</div>}
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader><CardTitle>设备同步记录</CardTitle></CardHeader>
                  <CardContent className="space-y-2">
                    {syncStates.length ? syncStates.map((s) => (
                      <div key={s.id} className="flex items-center gap-3 rounded-md border border-border px-3 py-2 text-sm">
                        <Smartphone className="size-4 text-muted-foreground" />
                        <span className="flex-1 font-mono text-xs">{s.device_id}</span>
                        {s.status && <SyncBadge status={s.status as SyncStatus} />}
                        <span className="text-xs text-muted-foreground">最近同步：{formatDate(s.last_pulled_at)}</span>
                      </div>
                    )) : <div className="text-sm text-muted-foreground">无设备同步记录</div>}
                  </CardContent>
                </Card>
              </div>
            )}

            {tab === 4 && (
              <div className="grid gap-4 md:grid-cols-2">
                <Card>
                  <CardHeader><CardTitle>订单记录</CardTitle></CardHeader>
                  <CardContent className="space-y-2">
                    {orders.length ? orders.map((o) => {
                      const ob = orderStatusBadge(o.status)
                      return (
                        <div key={o.id} className="flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm">
                          <span className="flex-1">{o.product ?? '订单'} · ¥{o.amount}</span>
                          <StatusBadge label={ob.label} variant={ob.variant} />
                          <Button size="xs" variant="outline" render={<Link href="/orders" />}>查看</Button>
                        </div>
                      )
                    }) : <div className="text-sm text-muted-foreground">无订单记录</div>}
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader><CardTitle>反馈工单</CardTitle></CardHeader>
                  <CardContent className="space-y-2">
                    {feedback.length ? feedback.map((f) => {
                      const fb = feedbackStatusBadge(f.status)
                      return (
                        <div key={f.id} className="flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm">
                          <span className="flex-1 truncate">{f.content || f.title || '—'}</span>
                          <Badge variant="outline">{f.type}</Badge>
                          <StatusBadge label={fb.label} variant={fb.variant} />
                          <Button size="xs" variant="outline" render={<Link href={`/feedback/${f.id}`} />}>处理</Button>
                        </div>
                      )
                    }) : <div className="text-sm text-muted-foreground">无反馈工单</div>}
                  </CardContent>
                </Card>
              </div>
            )}

            {tab === 5 && (
              <div className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle>数据修正记录</CardTitle>
                    <Button size="sm" onClick={() => setCorrect(true)}><Wrench data-icon="inline-start" /> 新建修正</Button>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {corrections.length ? corrections.map((c) => {
                      const cb = correctionStatusBadge(c.status)
                      return (
                        <div key={c.id} className="rounded-md border border-border px-3 py-2 text-sm">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline">{c.target_type}</Badge>
                            <span className="font-mono text-xs">{c.field}</span>
                            <StatusBadge label={cb.label} variant={cb.variant} />
                          </div>
                          <div className="mt-1 flex items-center gap-2 font-mono text-xs text-muted-foreground">
                            <span className="text-destructive">{c.before_value}</span> → <span className="text-primary">{c.after_value}</span>
                            <span className="ml-auto">{c.operator ?? '—'} · {formatDate(c.created_at)}</span>
                          </div>
                        </div>
                      )
                    }) : <div className="text-sm text-muted-foreground">暂无修正记录</div>}
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader><CardTitle>管理员备注</CardTitle></CardHeader>
                  <CardContent className="space-y-2">
                    {notes.length ? notes.map((n) => (
                      <div key={n.id} className="rounded-md border border-border px-3 py-2 text-sm">
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <span className="font-medium text-foreground">{n.operator_name || '—'}</span>
                          <span className="ml-auto">{formatDate(n.created_at)}</span>
                        </div>
                        <p className="mt-1 break-words">{n.content}</p>
                      </div>
                    )) : <div className="text-sm text-muted-foreground">暂无备注</div>}
                  </CardContent>
                </Card>
              </div>
            )}
          </div>
        </div>
      )}

      {user && (
        <>
          <GrantMembershipModal open={grant} onClose={() => setGrant(false)} presetUser={user.phone ?? user.id} />
          <CorrectionModal open={correct} onClose={() => setCorrect(false)} target={user.id} targetType="用户资料" />
          <DangerConfirm
            open={!!danger}
            onClose={() => setDanger(null)}
            onConfirm={handleDangerConfirm}
            action={danger?.action ?? ''}
            scope="单个用户"
            target={user.id}
            before={danger?.before}
            after={danger?.after}
            confirmPhrase={danger?.phrase ?? '确认修改'}
          />
        </>
      )}
    </>
  )
}
