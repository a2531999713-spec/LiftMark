'use client'

import { useMemo, useState } from 'react'
import { Search, RotateCcw, Plus, Ticket, Ban, Copy, Loader2, AlertCircle, Check } from 'lucide-react'
import { PageHeader, FilterBar, Field } from '@/components/admin/page-parts'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input, Label, Select } from '@/components/ui/field'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
import { StatusBadge } from '@/components/admin/status-badge'
import { Modal } from '@/components/ui/overlay'
import { DangerConfirm } from '@/components/admin/danger-confirm'
import { useFetch, useMutate, formatDate } from '@/lib/hooks'

type ActivationCodeDto = {
  id: string
  codePrefix: string
  membershipType: 'pro' | 'lifetime'
  durationDays: number | null
  isLifetime: boolean
  proGroupLimit: number
  maxRedemptions: number
  redeemedCount: number
  disabledAt: string | null
  createdAt: string
}

type ActivationCodesResponse = { activationCodes: ActivationCodeDto[] }
type CreateCodeResponse = { id: string; code: string; warning: string }
type DisableCodeResponse = { ok: boolean }

function benefitText(c: ActivationCodeDto): string {
  if (c.isLifetime) return '永久会员'
  if (c.durationDays) return `Pro ${c.durationDays} 天`
  return 'Pro 365 天'
}

function statusOf(c: ActivationCodeDto): { key: 'active' | 'disabled'; label: string; variant: 'success' | 'danger' } {
  if (c.disabledAt) return { key: 'disabled', label: '已停用', variant: 'danger' }
  return { key: 'active', label: '生效中', variant: 'success' }
}

export default function CodesPage() {
  const [q, setQ] = useState('')
  const [type, setType] = useState('all')
  const [status, setStatus] = useState('all')
  const [gen, setGen] = useState(false)
  const [disable, setDisable] = useState<ActivationCodeDto | null>(null)
  const [generated, setGenerated] = useState<{ code: string; warning: string } | null>(null)
  const [copied, setCopied] = useState(false)

  const { data, loading, error, reload } = useFetch<ActivationCodesResponse>('/admin/activation-codes')

  const codes = data?.activationCodes ?? []

  const filtered = useMemo(
    () =>
      codes.filter((c) => {
        if (q && !`${c.codePrefix}${c.id}`.toLowerCase().includes(q.toLowerCase())) return false
        if (type !== 'all' && c.membershipType !== type) return false
        if (status !== 'all' && statusOf(c).key !== status) return false
        return true
      }),
    [codes, q, type, status],
  )

  // 生成激活码表单状态
  const [genType, setGenType] = useState<'pro' | 'lifetime'>('pro')
  const [genDuration, setGenDuration] = useState(365)
  const [genProGroup, setGenProGroup] = useState(2)
  const [genMaxRedemptions, setGenMaxRedemptions] = useState(1)
  const [genError, setGenError] = useState<string | null>(null)

  const { mutate: createCode, loading: creating } = useMutate<CreateCodeResponse>()

  function openGen() {
    setGenError(null)
    setGenType('pro')
    setGenDuration(365)
    setGenProGroup(2)
    setGenMaxRedemptions(1)
    setGen(true)
  }

  async function handleGenerate() {
    setGenError(null)
    const isLifetime = genType === 'lifetime'
    const body: Record<string, unknown> = {
      membershipType: genType,
      isLifetime,
      proGroupLimit: genProGroup,
      maxRedemptions: genMaxRedemptions,
    }
    if (!isLifetime) body.durationDays = genDuration
    try {
      const res = await createCode('POST', '/admin/activation-codes', body)
      setGenerated({ code: res.code, warning: res.warning })
      setGen(false)
      reload()
    } catch (err) {
      setGenError(err instanceof Error ? err.message : '生成失败')
    }
  }

  const { mutate: disableCode } = useMutate<DisableCodeResponse>()
  const [disableError, setDisableError] = useState<string | null>(null)

  async function handleDisable() {
    if (!disable) return
    setDisableError(null)
    try {
      await disableCode('PATCH', `/admin/activation-codes/${disable.id}/disable`)
      setDisable(null)
      reload()
    } catch (err) {
      setDisableError(err instanceof Error ? err.message : '停用失败')
    }
  }

  async function copyCode(code: string) {
    try {
      await navigator.clipboard.writeText(code)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // 忽略剪贴板错误
    }
  }

  return (
    <>
      <PageHeader
        title="激活码管理"
        description="生成、发放与管理各类会员激活码。支持单个/批量生成、设置有效期与每人限领次数。"
        actions={
          <Button onClick={openGen}>
            <Plus data-icon="inline-start" /> 生成激活码
          </Button>
        }
      />

      <FilterBar>
        <Field label="搜索">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="激活码前缀 / 批次号" className="pl-8" />
          </div>
        </Field>
        <Field label="类型">
          <Select value={type} onChange={(e) => setType(e.target.value)}>
            <option value="all">全部</option>
            <option value="pro">Pro 会员</option>
            <option value="lifetime">永久会员</option>
          </Select>
        </Field>
        <Field label="状态">
          <Select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="all">全部</option>
            <option value="active">生效中</option>
            <option value="disabled">已停用</option>
          </Select>
        </Field>
        <Button variant="ghost" onClick={() => { setQ(''); setType('all'); setStatus('all') }}>
          <RotateCcw data-icon="inline-start" /> 重置
        </Button>
      </FilterBar>

      <Card>
        <div className="border-b border-border px-4 py-2.5 text-xs text-muted-foreground">
          {loading ? '加载中…' : `共 ${filtered.length} 个激活码`}
        </div>
        {disableError ? (
          <div className="flex items-center justify-between gap-2 border-b border-destructive/25 bg-destructive/8 px-4 py-2 text-xs text-destructive">
            <span>停用失败：{disableError}</span>
            <Button variant="ghost" size="xs" onClick={() => setDisableError(null)}>忽略</Button>
          </div>
        ) : null}
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>批次号 / 激活码前缀</TableHead>
              <TableHead>类型</TableHead>
              <TableHead>权益</TableHead>
              <TableHead className="text-right">Pro 组上限</TableHead>
              <TableHead className="text-right">已用 / 总量</TableHead>
              <TableHead>创建时间</TableHead>
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
            ) : filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="py-8 text-center text-sm text-muted-foreground">
                  暂无激活码
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((c) => {
                const s = statusOf(c)
                return (
                  <TableRow key={c.id}>
                    <TableCell>
                      <span className="block font-mono text-xs text-muted-foreground">{c.id}</span>
                      <span className="flex items-center gap-1 font-mono text-xs">
                        <Ticket className="size-3 text-primary" /> {c.codePrefix}…
                      </span>
                    </TableCell>
                    <TableCell className="text-xs">{c.isLifetime ? '永久会员' : 'Pro 会员'}</TableCell>
                    <TableCell className="text-xs">{benefitText(c)}</TableCell>
                    <TableCell className="text-right tabular-nums">{c.proGroupLimit}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      <span className={c.redeemedCount >= c.maxRedemptions ? 'text-destructive' : ''}>{c.redeemedCount}</span>
                      <span className="text-muted-foreground"> / {c.maxRedemptions}</span>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{formatDate(c.createdAt)}</TableCell>
                    <TableCell><StatusBadge label={s.label} variant={s.variant} /></TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={s.key !== 'active'}
                          onClick={() => setDisable(c)}
                        >
                          <Ban data-icon="inline-start" /> 停用
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </Card>

      <Modal
        open={gen}
        onClose={() => setGen(false)}
        title="生成激活码"
        description="配置激活码规则，系统将生成对应激活码。永久会员码为高危类型。生成后明文仅显示一次，请妥善保存。"
        width="max-w-xl"
        footer={
          <>
            <Button variant="outline" onClick={() => setGen(false)}>取消</Button>
            <Button onClick={handleGenerate} disabled={creating}>
              {creating ? <Loader2 className="size-4 animate-spin" /> : null}
              {creating ? '生成中…' : '生成激活码'}
            </Button>
          </>
        }
      >
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>会员类型</Label>
            <Select value={genType} onChange={(e) => setGenType(e.target.value as 'pro' | 'lifetime')}>
              <option value="pro">Pro 会员</option>
              <option value="lifetime">永久会员</option>
            </Select>
          </div>
          <div>
            <Label>有效天数</Label>
            <Input
              type="number"
              value={genDuration}
              min={1}
              disabled={genType === 'lifetime'}
              onChange={(e) => setGenDuration(Number(e.target.value) || 0)}
            />
          </div>
          <div>
            <Label>可激活 Pro 小组数量</Label>
            <Input
              type="number"
              value={genProGroup}
              min={0}
              max={10}
              onChange={(e) => setGenProGroup(Number(e.target.value) || 0)}
            />
          </div>
          <div>
            <Label>最大兑换次数</Label>
            <Input
              type="number"
              value={genMaxRedemptions}
              min={1}
              onChange={(e) => setGenMaxRedemptions(Number(e.target.value) || 1)}
            />
          </div>
          {genError ? (
            <div className="col-span-2 rounded-md border border-destructive/25 bg-destructive/8 p-2 text-xs text-destructive">
              {genError}
            </div>
          ) : null}
          {genType === 'lifetime' ? (
            <p className="col-span-2 rounded-md border border-destructive/25 bg-destructive/8 p-2 text-xs text-destructive">
              永久会员为高危操作，请谨慎发放。
            </p>
          ) : null}
        </div>
      </Modal>

      <DangerConfirm
        open={!!disable}
        onClose={() => setDisable(null)}
        onConfirm={() => handleDisable()}
        action="停用激活码"
        scope={disable ? (disable.isLifetime ? '永久会员' : 'Pro 会员') : ''}
        target={disable?.codePrefix ?? ''}
        before="生效中"
        after="已停用"
        confirmPhrase="确认停用"
      />

      <Modal
        open={!!generated}
        onClose={() => setGenerated(null)}
        title="激活码生成成功"
        description="激活码明文仅在本次显示，关闭后将无法再次查看，请立即复制保存。"
        width="max-w-lg"
        footer={
          <>
            <Button variant="outline" onClick={() => setGenerated(null)}>关闭</Button>
            <Button onClick={() => generated && copyCode(generated.code)}>
              {copied ? <Check data-icon="inline-start" /> : <Copy data-icon="inline-start" />}
              {copied ? '已复制' : '复制激活码'}
            </Button>
          </>
        }
      >
        {generated ? (
          <div className="space-y-3">
            <div className="rounded-md border border-primary/25 bg-primary/6 p-3">
              <div className="mb-1 text-xs text-muted-foreground">激活码</div>
              <div className="break-all font-mono text-base font-semibold tracking-wide">{generated.code}</div>
            </div>
            <p className="text-xs text-muted-foreground">{generated.warning}</p>
          </div>
        ) : null}
      </Modal>
    </>
  )
}
