'use client'

import { useMemo, useState } from 'react'
import { Search, RotateCcw, Loader2, AlertCircle } from 'lucide-react'
import { PageHeader, FilterBar, Field } from '@/components/admin/page-parts'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input, Select, Textarea, Label } from '@/components/ui/field'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
import { StatusBadge } from '@/components/admin/status-badge'
import { Modal } from '@/components/ui/overlay'
import { useFetch, useMutate, formatDate, maskPhone } from '@/lib/hooks'

type Feedback = {
  id: string
  user_id: string
  type: string
  content: string
  status: string
  created_at: string
  updated_at: string
  user_name: string | null
  user_phone: string | null
}

type Variant = 'default' | 'success' | 'warning' | 'danger' | 'info' | 'outline'

function feedbackStatus(status: string): { label: string; variant: Variant } {
  switch (status) {
    case 'open':
      return { label: '待处理', variant: 'warning' }
    case 'reviewing':
      return { label: '处理中', variant: 'info' }
    case 'resolved':
      return { label: '已解决', variant: 'success' }
    case 'closed':
      return { label: '已关闭', variant: 'outline' }
    default:
      return { label: status, variant: 'default' }
  }
}

export default function FeedbackPage() {
  const [q, setQ] = useState('')
  const [status, setStatus] = useState('all')
  const [type, setType] = useState('all')

  const query = useMemo(() => {
    const p = new URLSearchParams()
    if (q) p.set('q', q)
    if (status !== 'all') p.set('status', status)
    if (type !== 'all') p.set('type', type)
    const s = p.toString()
    return s ? `?${s}` : ''
  }, [q, status, type])

  const { data, loading, error, reload } = useFetch<{ feedback: Feedback[] }>(
    `/admin/feedback/list${query}`,
    [query],
  )

  const list = data?.feedback ?? []

  // 处理模态框
  const [editTarget, setEditTarget] = useState<Feedback | null>(null)
  const [newStatus, setNewStatus] = useState('open')
  const [adminNote, setAdminNote] = useState('')
  const [formError, setFormError] = useState<string | null>(null)

  const { mutate: patchFeedback, loading: patching } = useMutate<{ ok: boolean }>()

  function openEdit(fb: Feedback) {
    setEditTarget(fb)
    setNewStatus(fb.status || 'open')
    setAdminNote('')
    setFormError(null)
  }

  async function handleSubmit() {
    if (!editTarget) return
    setFormError(null)
    const body: Record<string, unknown> = { status: newStatus }
    if (adminNote.trim()) body.adminNote = adminNote.trim()
    try {
      await patchFeedback('PATCH', `/admin/feedback/${editTarget.id}`, body)
      setEditTarget(null)
      reload()
    } catch (err) {
      setFormError(err instanceof Error ? err.message : '处理失败')
    }
  }

  return (
    <>
      <PageHeader
        title="反馈与工单"
        description="查看用户反馈与工单，跟进处理状态并记录处理备注。"
      />

      <FilterBar>
        <Field label="搜索">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="用户昵称 / 手机 / 反馈内容"
              className="pl-8"
            />
          </div>
        </Field>
        <Field label="状态">
          <Select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="all">全部</option>
            <option value="open">待处理</option>
            <option value="reviewing">处理中</option>
            <option value="resolved">已解决</option>
            <option value="closed">已关闭</option>
          </Select>
        </Field>
        <Field label="类型">
          <Select value={type} onChange={(e) => setType(e.target.value)}>
            <option value="all">全部</option>
            <option value="bug">Bug</option>
            <option value="feature">需求</option>
            <option value="complaint">投诉</option>
            <option value="other">其他</option>
          </Select>
        </Field>
        <Button variant="ghost" onClick={() => { setQ(''); setStatus('all'); setType('all') }}>
          <RotateCcw data-icon="inline-start" /> 重置
        </Button>
      </FilterBar>

      <Card>
        <div className="border-b border-border px-4 py-2.5 text-xs text-muted-foreground">
          {loading ? '加载中…' : `共 ${list.length} 条反馈`}
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>反馈 ID</TableHead>
              <TableHead>用户</TableHead>
              <TableHead>类型</TableHead>
              <TableHead className="max-w-xs">内容</TableHead>
              <TableHead>状态</TableHead>
              <TableHead>创建时间</TableHead>
              <TableHead className="text-right">操作</TableHead>
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
            ) : list.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="py-8 text-center text-sm text-muted-foreground">
                  暂无反馈数据
                </TableCell>
              </TableRow>
            ) : (
              list.map((fb) => {
                const st = feedbackStatus(fb.status)
                return (
                  <TableRow key={fb.id}>
                    <TableCell className="font-mono text-xs">{fb.id}</TableCell>
                    <TableCell>
                      <span className="block font-medium">{fb.user_name ?? '—'}</span>
                      <span className="block font-mono text-xs text-muted-foreground">
                        {maskPhone(fb.user_phone)}
                      </span>
                    </TableCell>
                    <TableCell className="text-xs">{fb.type}</TableCell>
                    <TableCell className="max-w-xs">
                      <span className="block truncate text-xs text-muted-foreground" title={fb.content}>
                        {fb.content}
                      </span>
                    </TableCell>
                    <TableCell><StatusBadge label={st.label} variant={st.variant} /></TableCell>
                    <TableCell className="text-xs text-muted-foreground">{formatDate(fb.created_at)}</TableCell>
                    <TableCell className="text-right">
                      <Button variant="outline" size="sm" onClick={() => openEdit(fb)}>处理</Button>
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </Card>

      <Modal
        open={!!editTarget}
        onClose={() => setEditTarget(null)}
        title="处理反馈"
        description={editTarget ? `反馈编号 ${editTarget.id}` : undefined}
        footer={
          <>
            <Button variant="outline" onClick={() => setEditTarget(null)}>取消</Button>
            <Button onClick={handleSubmit} disabled={patching}>
              {patching ? <Loader2 className="size-4 animate-spin" /> : null}
              {patching ? '提交中…' : '提交'}
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <div>
            <Label>新状态</Label>
            <Select value={newStatus} onChange={(e) => setNewStatus(e.target.value)}>
              <option value="open">待处理</option>
              <option value="reviewing">处理中</option>
              <option value="resolved">已解决</option>
              <option value="closed">已关闭</option>
            </Select>
          </div>
          <div>
            <Label>处理备注</Label>
            <Textarea
              value={adminNote}
              onChange={(e) => setAdminNote(e.target.value)}
              placeholder="记录处理过程与结论（可选）"
            />
          </div>
          {formError ? (
            <div className="rounded-md border border-destructive/25 bg-destructive/8 p-2 text-xs text-destructive">
              {formError}
            </div>
          ) : null}
        </div>
      </Modal>
    </>
  )
}
