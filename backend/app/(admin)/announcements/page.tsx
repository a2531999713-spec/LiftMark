'use client'

import { useState } from 'react'
import { Plus, Loader2, AlertCircle, Pencil, Power, Trash2 } from 'lucide-react'
import { PageHeader } from '@/components/admin/page-parts'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input, Select, Textarea, Label } from '@/components/ui/field'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
import { StatusBadge } from '@/components/admin/status-badge'
import { Modal } from '@/components/ui/overlay'
import { useFetch, useMutate, formatDate, formatDateShort } from '@/lib/hooks'

type Announcement = {
  id: string
  title: string
  content: string
  status: string
  starts_at: string | null
  ends_at: string | null
  created_at: string
  updated_at: string
}

type Variant = 'default' | 'success' | 'warning' | 'danger' | 'info' | 'outline'

function announcementStatus(status: string): { label: string; variant: Variant } {
  switch (status) {
    case 'draft':
      return { label: '草稿', variant: 'outline' }
    case 'published':
      return { label: '已发布', variant: 'success' }
    case 'offline':
      return { label: '已下线', variant: 'default' }
    default:
      return { label: status, variant: 'default' }
  }
}

function toDatetimeLocal(iso: string | null | undefined): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export default function AnnouncementsPage() {
  const { data, loading, error, reload } = useFetch<{ announcements: Announcement[] }>(
    `/admin/announcements`,
    [],
  )

  const list = data?.announcements ?? []

  // 表单状态
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Announcement | null>(null)
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [status, setStatus] = useState<'draft' | 'published'>('draft')
  const [startsAt, setStartsAt] = useState('')
  const [endsAt, setEndsAt] = useState('')
  const [formError, setFormError] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  const { mutate: saveAnnouncement, loading: saving } = useMutate<{ id?: string; ok?: boolean }>()
  const { mutate: patchAnnouncement } = useMutate<{ ok: boolean }>()
  const { mutate: deleteAnnouncement } = useMutate<{ ok: boolean }>()

  function openCreate() {
    setEditing(null)
    setTitle('')
    setContent('')
    setStatus('draft')
    setStartsAt('')
    setEndsAt('')
    setFormError(null)
    setModalOpen(true)
  }

  function openEdit(a: Announcement) {
    setEditing(a)
    setTitle(a.title ?? '')
    setContent(a.content ?? '')
    setStatus(a.status === 'published' ? 'published' : 'draft')
    setStartsAt(toDatetimeLocal(a.starts_at))
    setEndsAt(toDatetimeLocal(a.ends_at))
    setFormError(null)
    setModalOpen(true)
  }

  async function handleSubmit() {
    setFormError(null)
    if (!title.trim()) {
      setFormError('请输入公告标题')
      return
    }
    if (!content.trim()) {
      setFormError('请输入公告内容')
      return
    }
    const body: Record<string, unknown> = {
      title: title.trim(),
      content: content.trim(),
      status,
    }
    if (startsAt) body.startsAt = startsAt
    if (endsAt) body.endsAt = endsAt
    try {
      if (editing) {
        await saveAnnouncement('PATCH', `/admin/announcements/${editing.id}`, body)
      } else {
        await saveAnnouncement('POST', '/admin/announcements', body)
      }
      setModalOpen(false)
      reload()
    } catch (err) {
      setFormError(err instanceof Error ? err.message : '保存失败')
    }
  }

  async function handleOffline(a: Announcement) {
    setActionError(null)
    if (!window.confirm(`确认将公告「${a.title}」下线？`)) return
    try {
      await patchAnnouncement('PATCH', `/admin/announcements/${a.id}`, { status: 'offline' })
      reload()
    } catch (err) {
      setActionError(err instanceof Error ? err.message : '下线失败')
    }
  }

  async function handleDelete(a: Announcement) {
    setActionError(null)
    if (!window.confirm(`确认删除公告「${a.title}」？此操作不可恢复。`)) return
    try {
      await deleteAnnouncement('DELETE', `/admin/announcements/${a.id}`)
      reload()
    } catch (err) {
      setActionError(err instanceof Error ? err.message : '删除失败')
    }
  }

  return (
    <>
      <PageHeader
        title="公告管理"
        description="创建、编辑与下线应用内公告，控制生效时间区间。"
        actions={
          <Button onClick={openCreate}>
            <Plus data-icon="inline-start" /> 新建公告
          </Button>
        }
      />

      <Card>
        <div className="border-b border-border px-4 py-2.5 text-xs text-muted-foreground">
          {loading ? '加载中…' : `共 ${list.length} 条公告`}
        </div>
        {actionError ? (
          <div className="flex items-center justify-between gap-2 border-b border-destructive/25 bg-destructive/8 px-4 py-2 text-xs text-destructive">
            <span>{actionError}</span>
            <Button variant="ghost" size="xs" onClick={() => setActionError(null)}>忽略</Button>
          </div>
        ) : null}
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>标题</TableHead>
              <TableHead>状态</TableHead>
              <TableHead>生效区间</TableHead>
              <TableHead>创建时间</TableHead>
              <TableHead className="text-right">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {error ? (
              <TableRow>
                <TableCell colSpan={5} className="py-8 text-center text-sm text-destructive">
                  <div className="flex flex-col items-center gap-2">
                    <AlertCircle className="size-4" />
                    <span>{error}</span>
                    <Button variant="outline" size="sm" onClick={reload}>重试</Button>
                  </div>
                </TableCell>
              </TableRow>
            ) : loading ? (
              <TableRow>
                <TableCell colSpan={5} className="py-8 text-center text-sm text-muted-foreground">
                  <Loader2 className="mx-auto size-4 animate-spin" />
                </TableCell>
              </TableRow>
            ) : list.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="py-8 text-center text-sm text-muted-foreground">
                  暂无公告
                </TableCell>
              </TableRow>
            ) : (
              list.map((a) => {
                const st = announcementStatus(a.status)
                return (
                  <TableRow key={a.id}>
                    <TableCell className="font-medium">{a.title}</TableCell>
                    <TableCell><StatusBadge label={st.label} variant={st.variant} /></TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {formatDateShort(a.starts_at)} ~ {formatDateShort(a.ends_at)}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{formatDate(a.created_at)}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="outline" size="sm" onClick={() => openEdit(a)}>
                          <Pencil data-icon="inline-start" /> 编辑
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={a.status === 'offline'}
                          onClick={() => handleOffline(a)}
                        >
                          <Power data-icon="inline-start" /> 下线
                        </Button>
                        <Button variant="destructive" size="sm" onClick={() => handleDelete(a)}>
                          <Trash2 data-icon="inline-start" /> 删除
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
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? '编辑公告' : '新建公告'}
        description={editing ? `编辑公告 ${editing.id}` : '创建一条新公告，可设为草稿或立即发布。'}
        width="max-w-xl"
        footer={
          <>
            <Button variant="outline" onClick={() => setModalOpen(false)}>取消</Button>
            <Button onClick={handleSubmit} disabled={saving}>
              {saving ? <Loader2 className="size-4 animate-spin" /> : null}
              {saving ? '提交中…' : '保存'}
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <div>
            <Label>标题</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="公告标题" />
          </div>
          <div>
            <Label>内容</Label>
            <Textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="公告正文内容"
              className="min-h-28"
            />
          </div>
          <div>
            <Label>状态</Label>
            <Select value={status} onChange={(e) => setStatus(e.target.value as 'draft' | 'published')}>
              <option value="draft">草稿</option>
              <option value="published">已发布</option>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>生效开始时间</Label>
              <Input
                type="datetime-local"
                value={startsAt}
                onChange={(e) => setStartsAt(e.target.value)}
              />
            </div>
            <div>
              <Label>生效结束时间</Label>
              <Input
                type="datetime-local"
                value={endsAt}
                onChange={(e) => setEndsAt(e.target.value)}
              />
            </div>
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
