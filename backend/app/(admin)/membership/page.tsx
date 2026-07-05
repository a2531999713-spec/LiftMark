'use client'

import { useEffect, useMemo, useState } from 'react'
import { Search, RotateCcw, Crown, Plus, Loader2, AlertCircle } from 'lucide-react'
import { PageHeader, FilterBar, Field } from '@/components/admin/page-parts'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input, Label, Select, Textarea } from '@/components/ui/field'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
import { StatusBadge, TierBadge } from '@/components/admin/status-badge'
import { Modal } from '@/components/ui/overlay'
import { DangerConfirm } from '@/components/admin/danger-confirm'
import { useFetch, useMutate, formatDateShort, maskPhone } from '@/lib/hooks'

type MembershipDto = {
  id: string
  userId: string
  type: 'free' | 'pro' | 'lifetime'
  source: string
  startsAt: string | null
  expiresAt: string | null
  isLifetime: boolean
  proGroupLimit: number
  activatedProGroupCount: number
  userName: string | null
  userPhone: string | null
  userLiftmarkId: string | null
}

type MembershipsResponse = { memberships: MembershipDto[] }
type GrantResponse = { membership: MembershipDto }
type RevokeResponse = { ok: boolean }

const sourceLabel: Record<string, string> = {
  manual: '手动开通',
  payment: '付费购买',
  payment_reserved: '付费购买',
  payment_fix: '支付修正',
  code: '激活码',
  activation_code: '激活码',
  beta: '内测赠送',
  campus: '校园推广',
  partner: '合作方',
  compensation: '客服补偿',
  admin_grant: '管理员开通',
  test: '测试',
}

function sourceText(s: string): string {
  return sourceLabel[s] ?? s
}

const sourceOptions: Array<{ value: string; label: string }> = [
  { value: 'activation_code', label: '激活码' },
  { value: 'manual', label: '手动开通' },
  { value: 'admin_grant', label: '管理员开通' },
  { value: 'payment_reserved', label: '付费购买' },
  { value: 'beta', label: '内测赠送' },
  { value: 'campus', label: '校园推广' },
  { value: 'partner', label: '合作方' },
  { value: 'compensation', label: '客服补偿' },
  { value: 'payment_fix', label: '支付修正' },
  { value: 'test', label: '测试' },
]

function statusOf(m: MembershipDto): { label: string; variant: 'success' | 'warning' | 'danger' | 'outline' } {
  if (m.isLifetime) return { label: '永久有效', variant: 'success' }
  if (!m.expiresAt) return { label: '—', variant: 'outline' }
  const exp = new Date(m.expiresAt).getTime()
  if (Number.isNaN(exp)) return { label: '—', variant: 'warning' }
  if (exp < Date.now()) return { label: '已过期', variant: 'warning' }
  return { label: '有效', variant: 'success' }
}

function tierOf(m: MembershipDto): 'free' | 'pro' | 'lifetime' {
  if (m.isLifetime) return 'lifetime'
  if (m.type === 'pro') return 'pro'
  return 'free'
}

function buildMembershipsPath(q: string, tier: string, source: string): string {
  const params = new URLSearchParams()
  if (q) params.set('q', q)
  if (tier && tier !== 'all') params.set('tier', tier)
  if (source && source !== 'all') params.set('source', source)
  const qs = params.toString()
  return qs ? `/admin/memberships?${qs}` : '/admin/memberships'
}

export default function MembershipPage() {
  const [q, setQ] = useState('')
  const [tier, setTier] = useState('all')
  const [source, setSource] = useState('all')
  const [debouncedQ, setDebouncedQ] = useState('')
  const [grant, setGrant] = useState(false)
  const [revoke, setRevoke] = useState<MembershipDto | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(q), 300)
    return () => clearTimeout(t)
  }, [q])

  const path = buildMembershipsPath(debouncedQ, tier, source)
  const { data, loading, error, reload } = useFetch<MembershipsResponse>(path, [debouncedQ, tier, source])

  const memberships = data?.memberships ?? []

  const stats = useMemo(() => {
    const now = Date.now()
    const in30 = 30 * 24 * 60 * 60 * 1000
    let pro = 0
    let lifetime = 0
    let codeRedeems = 0
    let expiringSoon = 0
    for (const m of memberships) {
      if (m.isLifetime) {
        lifetime += 1
      } else if (m.type === 'pro') {
        pro += 1
      }
      if (m.source === 'activation_code' || m.source === 'code') codeRedeems += 1
      if (!m.isLifetime && m.expiresAt) {
        const exp = new Date(m.expiresAt).getTime()
        if (!Number.isNaN(exp) && exp > now && exp - now <= in30) expiringSoon += 1
      }
    }
    return { pro, lifetime, codeRedeems, expiringSoon }
  }, [memberships])

  const statsCards = [
    { label: 'Pro 会员', value: stats.pro, hint: '当前记录数' },
    { label: '永久会员', value: stats.lifetime, hint: '当前记录数' },
    { label: '激活码开通', value: stats.codeRedeems, hint: '当前记录数' },
    { label: '即将到期（30天）', value: stats.expiringSoon, hint: '需关注续费' },
  ]

  // 开通/赠送会员表单
  const [gUserId, setGUserId] = useState('')
  const [gType, setGType] = useState<'pro' | 'lifetime'>('pro')
  const [gDuration, setGDuration] = useState(365)
  const [gProGroup, setGProGroup] = useState(2)
  const [gSource, setGSource] = useState('manual')
  const [gReason, setGReason] = useState('')
  const [grantError, setGrantError] = useState<string | null>(null)

  const { mutate: grantMutate, loading: granting } = useMutate<GrantResponse>()

  function openGrant() {
    setGrantError(null)
    setGUserId('')
    setGType('pro')
    setGDuration(365)
    setGProGroup(2)
    setGSource('manual')
    setGReason('')
    setGrant(true)
  }

  async function handleGrant() {
    setGrantError(null)
    if (!gUserId.trim()) {
      setGrantError('请输入用户 ID')
      return
    }
    if (gReason.trim().length < 4) {
      setGrantError('发放原因至少 4 个字符')
      return
    }
    const isLifetime = gType === 'lifetime'
    const body: Record<string, unknown> = {
      userId: gUserId.trim(),
      type: gType,
      isLifetime,
      proGroupLimit: gProGroup,
      source: gSource,
      reason: gReason.trim(),
    }
    if (!isLifetime) body.durationDays = gDuration
    try {
      await grantMutate('POST', '/admin/memberships/grant', body)
      setGrant(false)
      reload()
    } catch (err) {
      setGrantError(err instanceof Error ? err.message : '开通失败')
    }
  }

  const { mutate: revokeMutate } = useMutate<RevokeResponse>()

  async function handleRevoke(reason: string) {
    if (!revoke) return
    setActionError(null)
    try {
      await revokeMutate('POST', `/admin/memberships/${revoke.id}/revoke`, { reason })
      setRevoke(null)
      reload()
    } catch (err) {
      setActionError(err instanceof Error ? err.message : '撤销失败')
    }
  }

  return (
    <>
      <PageHeader
        title="会员与权益"
        description="管理 Pro 与永久会员，手动开通/撤销权益，配置每位用户的 Pro 小组数量与人数上限。"
        actions={
          <Button onClick={openGrant}>
            <Plus data-icon="inline-start" /> 开通/赠送会员
          </Button>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {statsCards.map((s) => (
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
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="用户昵称 / 手机 / 用户 ID" className="pl-8" />
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
            {sourceOptions.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </Select>
        </Field>
        <Button variant="ghost" onClick={() => { setQ(''); setTier('all'); setSource('all') }}>
          <RotateCcw data-icon="inline-start" /> 重置
        </Button>
      </FilterBar>

      <Card>
        <div className="border-b border-border px-4 py-2.5 text-xs text-muted-foreground">
          {loading ? '加载中…' : `共 ${memberships.length} 条会员记录`}
        </div>
        {actionError ? (
          <div className="flex items-center justify-between gap-2 border-b border-destructive/25 bg-destructive/8 px-4 py-2 text-xs text-destructive">
            <span>撤销失败：{actionError}</span>
            <Button variant="ghost" size="xs" onClick={() => setActionError(null)}>忽略</Button>
          </div>
        ) : null}
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>会员编号</TableHead>
              <TableHead>用户</TableHead>
              <TableHead>类型</TableHead>
              <TableHead>来源</TableHead>
              <TableHead>有效期</TableHead>
              <TableHead className="text-right">Pro 组</TableHead>
              <TableHead>状态</TableHead>
              <TableHead className="text-right">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {error ? (
              <TableRow>
                <TableCell colSpan={8} className="py-8 text-center text-sm text-destructive">
                  <div className="flex flex-col items-center gap-2">
                    <AlertCircle className="size-4" />
                    <span>{error}</span>
                    <Button variant="outline" size="sm" onClick={reload}>重试</Button>
                  </div>
                </TableCell>
              </TableRow>
            ) : loading ? (
              <TableRow>
                <TableCell colSpan={8} className="py-8 text-center text-sm text-muted-foreground">
                  <Loader2 className="mx-auto size-4 animate-spin" />
                </TableCell>
              </TableRow>
            ) : memberships.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="py-8 text-center text-sm text-muted-foreground">
                  暂无会员记录
                </TableCell>
              </TableRow>
            ) : (
              memberships.map((m) => {
                const st = statusOf(m)
                return (
                  <TableRow key={m.id}>
                    <TableCell className="font-mono text-xs">{m.id}</TableCell>
                    <TableCell>
                      <span className="block font-medium">{m.userName ?? '—'}</span>
                      <span className="block font-mono text-xs text-muted-foreground">
                        {m.userLiftmarkId ?? m.userId}
                        {m.userPhone ? ` · ${maskPhone(m.userPhone)}` : ''}
                      </span>
                    </TableCell>
                    <TableCell><TierBadge tier={tierOf(m)} /></TableCell>
                    <TableCell className="text-xs">{sourceText(m.source)}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {formatDateShort(m.startsAt)} ~ {m.isLifetime ? '永久' : formatDateShort(m.expiresAt)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {m.activatedProGroupCount}/{m.proGroupLimit}
                    </TableCell>
                    <TableCell><StatusBadge label={st.label} variant={st.variant} /></TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={tierOf(m) === 'free'}
                        onClick={() => setRevoke(m)}
                      >
                        撤销
                      </Button>
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </Card>

      <Modal
        open={grant}
        onClose={() => setGrant(false)}
        title="开通/赠送会员"
        description="人工发放会员权益，操作将写入权益变更日志与操作审计。"
        width="max-w-xl"
        footer={
          <>
            <Button variant="outline" onClick={() => setGrant(false)}>取消</Button>
            <Button onClick={handleGrant} disabled={granting}>
              {granting ? <Loader2 className="size-4 animate-spin" /> : null}
              {granting ? '提交中…' : '确认发放'}
            </Button>
          </>
        }
      >
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <Label>用户 ID（必填）</Label>
            <Input
              value={gUserId}
              onChange={(e) => setGUserId(e.target.value)}
              placeholder="输入用户 ID（如 U100234）"
            />
          </div>
          <div>
            <Label>会员类型</Label>
            <Select value={gType} onChange={(e) => setGType(e.target.value as 'pro' | 'lifetime')}>
              <option value="pro">Pro 会员</option>
              <option value="lifetime">永久会员（高危）</option>
            </Select>
          </div>
          <div>
            <Label>有效天数</Label>
            <Input
              type="number"
              value={gDuration}
              min={1}
              disabled={gType === 'lifetime'}
              onChange={(e) => setGDuration(Number(e.target.value) || 0)}
            />
          </div>
          <div>
            <Label>可激活 Pro 小组数量</Label>
            <Input
              type="number"
              value={gProGroup}
              min={0}
              onChange={(e) => setGProGroup(Number(e.target.value) || 0)}
            />
          </div>
          <div>
            <Label>发放来源</Label>
            <Select value={gSource} onChange={(e) => setGSource(e.target.value)}>
              <option value="manual">手动开通</option>
              <option value="beta">内测赠送</option>
              <option value="campus">校园推广</option>
              <option value="partner">合作方</option>
              <option value="compensation">客服补偿</option>
              <option value="payment_fix">支付修正</option>
              <option value="test">测试</option>
            </Select>
          </div>
          <div className="col-span-2">
            <Label>发放原因（必填，至少 4 字）</Label>
            <Textarea
              value={gReason}
              onChange={(e) => setGReason(e.target.value)}
              placeholder="请填写发放原因，将记录到审计日志"
            />
          </div>
          {grantError ? (
            <div className="col-span-2 rounded-md border border-destructive/25 bg-destructive/8 p-2 text-xs text-destructive">
              {grantError}
            </div>
          ) : null}
          {gType === 'lifetime' ? (
            <p className="col-span-2 rounded-md border border-destructive/25 bg-destructive/8 p-2 text-xs text-destructive">
              永久会员为高危操作，请谨慎发放。
            </p>
          ) : null}
        </div>
      </Modal>

      <DangerConfirm
        open={!!revoke}
        onClose={() => setRevoke(null)}
        onConfirm={(reason) => handleRevoke(reason)}
        action="撤销会员权益"
        scope={revoke ? (revoke.isLifetime ? '永久会员' : 'Pro 会员') : ''}
        target={revoke?.userName ?? revoke?.id ?? ''}
        before={revoke ? (revoke.isLifetime ? '永久有效' : '有效') : ''}
        after="已撤销（降为免费）"
        confirmPhrase="确认撤销"
      />
    </>
  )
}
