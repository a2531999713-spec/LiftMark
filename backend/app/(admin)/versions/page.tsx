'use client'

import { useState } from 'react'
import { Plus, Pencil, Loader2, AlertCircle, Settings2 } from 'lucide-react'
import { PageHeader } from '@/components/admin/page-parts'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input, Label, Textarea } from '@/components/ui/field'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
import { Modal } from '@/components/ui/overlay'
import { useFetch, useMutate, formatDate } from '@/lib/hooks'

type ConfigRow = {
  id?: string
  key: string
  value: unknown
  created_at?: string
  updated_at?: string
}

type VersionConfigsResponse = { configs: ConfigRow[] }
type AppConfigsResponse = { appConfig: Array<{ key: string; value: unknown }> }
type PutResponse = { ok: boolean }

type EditMode = 'edit' | 'create'

function truncate(value: unknown, max = 60): string {
  let str: string
  try {
    str = typeof value === 'string' ? value : JSON.stringify(value)
  } catch {
    str = String(value)
  }
  if (str.length <= max) return str
  return str.slice(0, max) + '…'
}

export default function VersionsPage() {
  const { data, loading, error, reload } = useFetch<VersionConfigsResponse>('/admin/version-configs')
  const fallback = useFetch<AppConfigsResponse>('/admin/app-config')

  const primaryConfigs = data?.configs ?? []
  const fallbackConfigs: ConfigRow[] = (fallback.data?.appConfig ?? []).map((c) => ({ key: c.key, value: c.value }))
  const usingFallback = !loading && !error && primaryConfigs.length === 0 && fallbackConfigs.length > 0
  const configs = usingFallback ? fallbackConfigs : primaryConfigs

  // 编辑 / 新增表单
  const [modalMode, setModalMode] = useState<EditMode | null>(null)
  const [fKey, setFKey] = useState('')
  const [fValue, setFValue] = useState('{}')
  const [formError, setFormError] = useState<string | null>(null)

  const { mutate: putMutate, loading: saving } = useMutate<PutResponse>()

  function openEdit(row: ConfigRow) {
    setFormError(null)
    setFKey(row.key)
    let pretty = '{}'
    try {
      pretty = typeof row.value === 'string' ? row.value : JSON.stringify(row.value, null, 2)
    } catch {
      pretty = String(row.value ?? '{}')
    }
    setFValue(pretty)
    setModalMode('edit')
  }

  function openCreate() {
    setFormError(null)
    setFKey('')
    setFValue('{}')
    setModalMode('create')
  }

  async function handleSave() {
    setFormError(null)
    if (!fKey.trim()) {
      setFormError('请填写配置 key')
      return
    }
    let parsed: unknown
    try {
      parsed = JSON.parse(fValue)
    } catch (err) {
      setFormError(`JSON 格式无效：${err instanceof Error ? err.message : String(err)}`)
      return
    }
    try {
      await putMutate('PUT', `/admin/version-configs/${encodeURIComponent(fKey.trim())}`, { value: parsed })
      setModalMode(null)
      reload()
    } catch (err) {
      setFormError(err instanceof Error ? err.message : '保存失败')
    }
  }

  return (
    <>
      <PageHeader
        title="版本配置"
        description="管理系统版本相关的配置项与开关。配置以 JSON 对象存储，可在线编辑并实时生效。"
        actions={
          <Button onClick={openCreate}>
            <Plus data-icon="inline-start" /> 新增
          </Button>
        }
      />

      {usingFallback ? (
        <div className="rounded-md border border-info/25 bg-info/8 px-3 py-2 text-xs text-info">
          当前未返回版本配置项，已显示通用应用配置（app-config）作为参考；编辑与新增仍写入 version-configs。
        </div>
      ) : null}

      <Card>
        <div className="border-b border-border px-4 py-2.5 text-xs text-muted-foreground">
          {loading ? '加载中…' : `共 ${configs.length} 条配置`}
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Key</TableHead>
              <TableHead>Value</TableHead>
              <TableHead>更新时间</TableHead>
              <TableHead className="text-right">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {error ? (
              <TableRow>
                <TableCell colSpan={4} className="py-8 text-center text-sm text-destructive">
                  <div className="flex flex-col items-center gap-2">
                    <AlertCircle className="size-4" />
                    <span>{error}</span>
                    <Button variant="outline" size="sm" onClick={reload}>重试</Button>
                  </div>
                </TableCell>
              </TableRow>
            ) : loading ? (
              <TableRow>
                <TableCell colSpan={4} className="py-8 text-center text-sm text-muted-foreground">
                  <Loader2 className="mx-auto size-4 animate-spin" />
                </TableCell>
              </TableRow>
            ) : configs.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="py-8 text-center text-sm text-muted-foreground">
                  暂无配置项
                </TableCell>
              </TableRow>
            ) : (
              configs.map((c) => (
                <TableRow key={c.key}>
                  <TableCell className="font-mono text-xs">
                    <span className="inline-flex items-center gap-1.5">
                      <Settings2 className="size-3 text-muted-foreground" /> {c.key}
                    </span>
                  </TableCell>
                  <TableCell className="max-w-96 truncate font-mono text-xs text-muted-foreground" title={truncate(c.value, 240)}>
                    {truncate(c.value)}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {c.updated_at ? formatDate(c.updated_at) : '—'}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="outline" size="sm" onClick={() => openEdit(c)}>
                      <Pencil data-icon="inline-start" /> 编辑
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>

      <Modal
        open={modalMode !== null}
        onClose={() => setModalMode(null)}
        title={modalMode === 'create' ? '新增配置' : '编辑配置'}
        description="value 必须为合法 JSON 对象，保存后将立即生效。"
        width="max-w-xl"
        footer={
          <>
            <Button variant="outline" onClick={() => setModalMode(null)}>取消</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="size-4 animate-spin" /> : null}
              {saving ? '保存中…' : '保存'}
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <div>
            <Label>Key</Label>
            <Input
              value={fKey}
              onChange={(e) => setFKey(e.target.value)}
              readOnly={modalMode === 'edit'}
              placeholder="如 min_app_version"
              className="font-mono"
            />
          </div>
          <div>
            <Label>Value（JSON 对象）</Label>
            <Textarea
              value={fValue}
              onChange={(e) => setFValue(e.target.value)}
              rows={10}
              className="font-mono text-xs"
              spellCheck={false}
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
