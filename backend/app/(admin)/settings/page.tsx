'use client'

import { useState } from 'react'
import { Plus, Loader2, AlertCircle } from 'lucide-react'
import { PageHeader } from '@/components/admin/page-parts'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input, Label, Textarea } from '@/components/ui/field'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
import { Modal } from '@/components/ui/overlay'
import { useFetch, useMutate, formatDate } from '@/lib/hooks'

type AppConfig = {
  id: string
  key: string
  value: unknown
  created_at: string
  updated_at: string
}

type AppConfigResponse = { appConfig: AppConfig[] }
type CreateConfigResponse = { id: string }

export default function SettingsPage() {
  const { data, loading, error, reload } = useFetch<AppConfigResponse>('/admin/app-config')

  const configs = data?.appConfig ?? []

  const [open, setOpen] = useState(false)
  const [key, setKey] = useState('')
  const [value, setValue] = useState('{}')
  const [formError, setFormError] = useState<string | null>(null)

  const { mutate: createConfig, loading: creating } = useMutate<CreateConfigResponse>()

  function openModal() {
    setKey('')
    setValue('{}')
    setFormError(null)
    setOpen(true)
  }

  async function handleSubmit() {
    setFormError(null)
    if (!key.trim()) {
      setFormError('请填写配置 key')
      return
    }
    let parsed: unknown
    try {
      parsed = JSON.parse(value)
    } catch (err) {
      setFormError('value 不是合法的 JSON：' + (err instanceof Error ? err.message : '解析失败'))
      return
    }
    try {
      await createConfig('POST', '/admin/app-config', { key: key.trim(), value: parsed })
      setOpen(false)
      reload()
    } catch (err) {
      setFormError(err instanceof Error ? err.message : '创建失败')
    }
  }

  return (
    <>
      <PageHeader
        title="系统设置"
        description="管理应用级配置项（键值对）。"
        actions={
          <Button onClick={openModal}>
            <Plus data-icon="inline-start" /> 新增配置
          </Button>
        }
      />

      <Card>
        <div className="border-b border-border px-4 py-2.5 text-xs text-muted-foreground">
          {loading ? '加载中…' : `共 ${configs.length} 项配置`}
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Key</TableHead>
              <TableHead>Value</TableHead>
              <TableHead>更新时间</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {error ? (
              <TableRow>
                <TableCell colSpan={3} className="py-8 text-center text-sm text-destructive">
                  <div className="flex flex-col items-center gap-2">
                    <AlertCircle className="size-4" />
                    <span>{error}</span>
                    <Button variant="outline" size="sm" onClick={reload}>重试</Button>
                  </div>
                </TableCell>
              </TableRow>
            ) : loading ? (
              <TableRow>
                <TableCell colSpan={3} className="py-8 text-center text-sm text-muted-foreground">
                  <Loader2 className="mx-auto size-4 animate-spin" />
                </TableCell>
              </TableRow>
            ) : configs.length === 0 ? (
              <TableRow>
                <TableCell colSpan={3} className="py-8 text-center text-sm text-muted-foreground">
                  暂无配置
                </TableCell>
              </TableRow>
            ) : (
              configs.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="font-mono text-xs">{c.key}</TableCell>
                  <TableCell className="max-w-md">
                    <span className="block truncate font-mono text-xs text-muted-foreground">
                      {JSON.stringify(c.value)}
                    </span>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">{formatDate(c.updated_at)}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="新增配置"
        description="添加应用级键值配置。value 需为合法 JSON。"
        width="max-w-lg"
        footer={
          <>
            <Button variant="outline" onClick={() => setOpen(false)}>取消</Button>
            <Button onClick={handleSubmit} disabled={creating}>
              {creating ? <Loader2 className="size-4 animate-spin" /> : null}
              {creating ? '保存中…' : '保存'}
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <div>
            <Label>Key</Label>
            <Input value={key} onChange={(e) => setKey(e.target.value)} placeholder="如 site.notice" />
          </div>
          <div>
            <Label>Value (JSON)</Label>
            <Textarea value={value} onChange={(e) => setValue(e.target.value)} rows={6} className="font-mono text-xs" />
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
