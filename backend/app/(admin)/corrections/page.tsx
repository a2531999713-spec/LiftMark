'use client'

import { useMemo, useState } from 'react'
import { Search, RotateCcw, Undo2, ShieldAlert, Plus, Loader2, AlertCircle, Wrench } from 'lucide-react'
import { PageHeader, FilterBar, Field } from '@/components/admin/page-parts'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input, Label, Select, Textarea } from '@/components/ui/field'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
import { StatusBadge } from '@/components/admin/status-badge'
import { Modal } from '@/components/ui/overlay'
import { DangerConfirm } from '@/components/admin/danger-confirm'
import { useFetch, useMutate, formatDate } from '@/lib/hooks'

type CorrectionStatus = 'done' | 'pending' | 'rolledback'

type Correction = {
  id: string
  operator_user_id: string | null
  operator_name: string | null
  target_type: string
  target_id: string
  target_user_id: string | null
  field: string | null
  before_value: string | null
  after_value: string | null
  reason: string | null
  sync_to_device: boolean
  recompute: boolean
  ticket_id: string | null
  status: CorrectionStatus
  created_at: string
  updated_at: string
  rolled_back_at: string | null
}

type CorrectionsResponse = { corrections: Correction[] }
type CreateCorrectionResponse = { id: string }
type RollbackResponse = { ok: boolean }

const statusMeta: Record<CorrectionStatus, { label: string; variant: 'success' | 'warning' | 'outline' }> = {
  done: { label: '已生效', variant: 'success' },
  pending: { label: '待复核', variant: 'warning' },
  rolledback: { label: '已回滚', variant: 'outline' },
}

const targetTypeOptions = [
  '用户资料',
  '手机号',
  '头像',
  '会员权益',
  '小组关系',
  '成员档案',
  '训练 session',
  '每组训练数据',
  '计划数据',
  '动作数据',
  '同步状态',
  '订单权益',
  '激活码记录',
  '文件资源',
]

function buildPath(q: string, status: string): string {
  const params = new URLSearchParams()
  if (q) params.set('q', q)
  if (status !== 'all') params.set('status', status)
  const qs = params.toString()
  return qs ? `/admin/corrections?${qs}` : '/admin/corrections'
}

export default function CorrectionsPage() {
  const [q, setQ] = useState('')
  const [status, setStatus] = useState('all')
  const [rollback, setRollback] = useState<Correction | null>(null)
  const [create, setCreate] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)

  const path = useMemo(() => buildPath(q, status), [q, status])
  const { data, loading, error, reload } = useFetch<CorrectionsResponse>(path, [path])

  const corrections = data?.corrections ?? []

  // 新建修正表单
  const [fTargetType, setFTargetType] = useState(targetTypeOptions[0])
  const [fTargetId, setFTargetId] = useState('')
  const [fTargetUserId, setFTargetUserId] = useState('')
  const [fField, setFField] = useState('')
  const [fBefore, setFBefore] = useState('')
  const [fAfter, setFAfter] = useState('')
  const [fReason, setFReason] = useState('')
  const [fSync, setFSync] = useState(false)
  const [fRecompute, setFRecompute] = useState(false)
  const [fTicketId, setFTicketId] = useState('')
  const [createError, setCreateError] = useState<string | null>(null)

  const { mutate: createMutate, loading: creating } = useMutate<CreateCorrectionResponse>()

  function openCreate() {
    setCreateError(null)
    setFTargetType(targetTypeOptions[0])
    setFTargetId('')
    setFTargetUserId('')
    setFField('')
    setFBefore('')
    setFAfter('')
    setFReason('')
    setFSync(false)
    setFRecompute(false)
    setFTicketId('')
    setCreate(true)
  }

  async function handleCreate() {
    setCreateError(null)
    if (!fTargetId.trim()) {
      setCreateError('请输入修正对象 ID')
      return
    }
    if (fReason.trim().length < 4) {
      setCreateError('修正原因至少 4 个字符')
      return
    }
    const body: Record<string, unknown> = {
      targetType: fTargetType,
      targetId: fTargetId.trim(),
      field: fField.trim() || undefined,
      beforeValue: fBefore || undefined,
      afterValue: fAfter || undefined,
      reason: fReason.trim(),
      syncToDevice: fSync,
      recompute: fRecompute,
    }
    if (fTargetUserId.trim()) body.targetUserId = fTargetUserId.trim()
    if (fTicketId.trim()) body.ticketId = fTicketId.trim()
    try {
      await createMutate('POST', '/admin/corrections', body)
      setCreate(false)
      reload()
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : '创建失败')
    }
  }

  const { mutate: rollbackMutate } = useMutate<RollbackResponse>()

  async function handleRollback(reason: string) {
    if (!rollback) return
    setActionError(null)
    try {
      await rollbackMutate('POST', `/admin/corrections/${rollback.id}/rollback`, { reason })
      setRollback(null)
      reload()
    } catch (err) {
      setActionError(err instanceof Error ? err.message : '回滚失败')
    }
  }

  return (
    <>
      <PageHeader
        title="数据修正中心"
        description="集中记录所有对用户数据的人工修正操作。每一次修改都会留痕、可回滚，并可选择是否同步到设备与重新计算统计。"
        actions={
          <Button onClick={openCreate}>
            <Plus data-icon="inline-start" /> 新建修正
          </Button>
        }
      />

      <div className="flex items-start gap-2 rounded-lg border border-warning/40 bg-warning/10 p-3 text-sm">
        <ShieldAlert className="mt-0.5 size-4 shrink-0 text-warning" />
        <p className="text-pretty">
          数据修正属于高危操作，仅限授权管理员执行。所有修改需填写原因并关联工单，系统将完整记录修改前后的值与操作人。
        </p>
      </div>

      <FilterBar>
        <Field label="搜索">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="修正编号 / 对象 / 字段" className="pl-8" />
          </div>
        </Field>
        <Field label="状态">
          <Select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="all">全部</option>
            <option value="done">已生效</option>
            <option value="rolledback">已回滚</option>
          </Select>
        </Field>
        <Button variant="ghost" onClick={() => { setQ(''); setStatus('all') }}>
          <RotateCcw data-icon="inline-start" /> 重置
        </Button>
      </FilterBar>

      <Card>
        <div className="border-b border-border px-4 py-2.5 text-xs text-muted-foreground">
          {loading ? '加载中…' : `共 ${corrections.length} 条修正记录`}
        </div>
        {actionError ? (
          <div className="flex items-center justify-between gap-2 border-b border-destructive/25 bg-destructive/8 px-4 py-2 text-xs text-destructive">
            <span>回滚失败：{actionError}</span>
            <Button variant="ghost" size="xs" onClick={() => setActionError(null)}>忽略</Button>
          </div>
        ) : null}
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>修正编号</TableHead>
              <TableHead>对象</TableHead>
              <TableHead>字段</TableHead>
              <TableHead>修改前 → 修改后</TableHead>
              <TableHead>原因</TableHead>
              <TableHead>选项</TableHead>
              <TableHead>操作人</TableHead>
              <TableHead>时间</TableHead>
              <TableHead>状态</TableHead>
              <TableHead className="text-right">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {error ? (
              <TableRow>
                <TableCell colSpan={10} className="py-8 text-center text-sm text-destructive">
                  <div className="flex flex-col items-center gap-2">
                    <AlertCircle className="size-4" />
                    <span>{error}</span>
                    <Button variant="outline" size="sm" onClick={reload}>重试</Button>
                  </div>
                </TableCell>
              </TableRow>
            ) : loading ? (
              <TableRow>
                <TableCell colSpan={10} className="py-8 text-center text-sm text-muted-foreground">
                  <Loader2 className="mx-auto size-4 animate-spin" />
                </TableCell>
              </TableRow>
            ) : corrections.length === 0 ? (
              <TableRow>
                <TableCell colSpan={10} className="py-8 text-center text-sm text-muted-foreground">
                  暂无修正记录
                </TableCell>
              </TableRow>
            ) : (
              corrections.map((c) => {
                const meta = statusMeta[c.status] ?? statusMeta.pending
                return (
                  <TableRow key={c.id}>
                    <TableCell className="font-mono text-xs">{c.id}</TableCell>
                    <TableCell>
                      <span className="block text-xs text-muted-foreground">{c.target_type}</span>
                      <span className="font-mono text-xs">{c.target_id}</span>
                    </TableCell>
                    <TableCell className="font-mono text-xs">{c.field ?? '—'}</TableCell>
                    <TableCell>
                      <span className="inline-flex items-center gap-1.5 text-xs">
                        <code className="rounded bg-muted px-1.5 py-0.5 text-muted-foreground line-through">
                          {c.before_value ?? '—'}
                        </code>
                        <span className="text-muted-foreground">→</span>
                        <code className="rounded bg-primary/10 px-1.5 py-0.5 text-primary">
                          {c.after_value ?? '—'}
                        </code>
                      </span>
                    </TableCell>
                    <TableCell className="max-w-40 truncate text-xs text-muted-foreground" title={c.reason ?? ''}>
                      {c.reason ?? '—'}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      <div>{c.sync_to_device ? '同步设备' : '仅服务端'}</div>
                      <div>{c.recompute ? '重算' : '不重算'}</div>
                    </TableCell>
                    <TableCell className="text-xs">{c.operator_name ?? c.operator_user_id ?? '—'}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{formatDate(c.created_at)}</TableCell>
                    <TableCell>
                      <StatusBadge label={meta.label} variant={meta.variant} />
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={c.status !== 'done'}
                        onClick={() => setRollback(c)}
                      >
                        <Undo2 data-icon="inline-start" /> 回滚
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
        open={create}
        onClose={() => setCreate(false)}
        title={
          <span className="flex items-center gap-2">
            <Wrench className="size-4 text-primary" /> 新建数据修正任务
          </span>
        }
        description="修正前后对比清晰可见，支持回滚。所有修正会生成可回滚记录与审计日志。"
        width="max-w-2xl"
        footer={
          <>
            <Button variant="outline" onClick={() => setCreate(false)}>取消</Button>
            <Button variant="destructive" onClick={handleCreate} disabled={creating}>
              {creating ? <Loader2 className="size-4 animate-spin" /> : null}
              {creating ? '提交中…' : '执行修正'}
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>修正类型</Label>
              <Select value={fTargetType} onChange={(e) => setFTargetType(e.target.value)}>
                {targetTypeOptions.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </Select>
            </div>
            <div>
              <Label>修正对象 ID（必填）</Label>
              <Input
                value={fTargetId}
                onChange={(e) => setFTargetId(e.target.value)}
                placeholder="如 session / 用户 / 小组的 ID"
                className="font-mono"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>关联用户 ID（可选）</Label>
              <Input
                value={fTargetUserId}
                onChange={(e) => setFTargetUserId(e.target.value)}
                placeholder="可选，受影响的用户 ID"
                className="font-mono"
              />
            </div>
            <div>
              <Label>关联工单 ID（可选）</Label>
              <Input
                value={fTicketId}
                onChange={(e) => setFTicketId(e.target.value)}
                placeholder="可选，如反馈工单号"
                className="font-mono"
              />
            </div>
          </div>

          <div>
            <Label>修正字段</Label>
            <Input
              value={fField}
              onChange={(e) => setFField(e.target.value)}
              placeholder="如 session.sets[3].weight"
              className="font-mono"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>修改前</Label>
              <Input
                value={fBefore}
                onChange={(e) => setFBefore(e.target.value)}
                placeholder="原值"
                className="bg-muted/50 font-mono"
              />
            </div>
            <div>
              <Label>修改后</Label>
              <Input
                value={fAfter}
                onChange={(e) => setFAfter(e.target.value)}
                placeholder="目标值"
                className="border-primary/40 font-mono"
              />
            </div>
          </div>

          <div className="flex flex-wrap gap-4 rounded-md border border-border bg-muted/30 p-3 text-sm">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={fSync}
                onChange={(e) => setFSync(e.target.checked)}
              />
              同步到用户设备
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={fRecompute}
                onChange={(e) => setFRecompute(e.target.checked)}
              />
              重新计算统计与分析
            </label>
          </div>

          <div>
            <Label>修正原因（必填，至少 4 字）</Label>
            <Textarea
              value={fReason}
              onChange={(e) => setFReason(e.target.value)}
              placeholder="请说明修正原因，将记录到审计日志"
            />
          </div>

          {createError ? (
            <div className="rounded-md border border-destructive/25 bg-destructive/8 p-2 text-xs text-destructive">
              {createError}
            </div>
          ) : null}
        </div>
      </Modal>

      <DangerConfirm
        open={!!rollback}
        onClose={() => setRollback(null)}
        onConfirm={(reason) => handleRollback(reason)}
        action="回滚数据修正"
        scope={rollback?.target_type ?? ''}
        target={rollback?.target_id ?? ''}
        before={rollback?.after_value ?? undefined}
        after={rollback?.before_value ?? undefined}
        confirmPhrase="确认回滚"
      />
    </>
  )
}
