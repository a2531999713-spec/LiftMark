'use client'

import { useMemo, useState } from 'react'
import { Search, RotateCcw, Undo2, ShieldAlert } from 'lucide-react'
import { PageHeader, FilterBar, Field } from '@/components/admin/page-parts'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input, Select } from '@/components/ui/field'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
import { StatusBadge } from '@/components/admin/status-badge'
import { DangerConfirm } from '@/components/admin/danger-confirm'
import { corrections, type Correction } from '@/lib/data'

const statusMeta: Record<Correction['status'], { label: string; variant: 'success' | 'warning' | 'danger' }> = {
  done: { label: '已生效', variant: 'success' },
  pending: { label: '待复核', variant: 'warning' },
  rolledback: { label: '已回滚', variant: 'danger' },
}

export default function CorrectionsPage() {
  const [q, setQ] = useState('')
  const [status, setStatus] = useState('all')
  const [rollback, setRollback] = useState<Correction | null>(null)

  const filtered = useMemo(
    () =>
      corrections.filter((c) => {
        if (q && !`${c.id}${c.target}${c.user}${c.field}`.toLowerCase().includes(q.toLowerCase())) return false
        if (status !== 'all' && c.status !== status) return false
        return true
      }),
    [q, status],
  )

  return (
    <>
      <PageHeader
        title="数据修正中心"
        description="集中记录所有对用户数据的人工修正操作。每一次修改都会留痕、可回滚，并可选择是否同步到设备与重新计算统计。"
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
            <option value="pending">待复核</option>
            <option value="rolledback">已回滚</option>
          </Select>
        </Field>
        <Button variant="ghost" onClick={() => { setQ(''); setStatus('all') }}>
          <RotateCcw data-icon="inline-start" /> 重置
        </Button>
      </FilterBar>

      <Card>
        <div className="border-b border-border px-4 py-2.5 text-xs text-muted-foreground">共 {filtered.length} 条修正记录</div>
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
            {filtered.map((c) => (
              <TableRow key={c.id}>
                <TableCell className="font-mono text-xs">{c.id}</TableCell>
                <TableCell>
                  <span className="block text-xs text-muted-foreground">{c.targetType}</span>
                  <span className="font-mono text-xs">{c.target}</span>
                </TableCell>
                <TableCell className="font-mono text-xs">{c.field}</TableCell>
                <TableCell>
                  <span className="inline-flex items-center gap-1.5 text-xs">
                    <code className="rounded bg-muted px-1.5 py-0.5 text-muted-foreground line-through">{c.before}</code>
                    <span className="text-muted-foreground">→</span>
                    <code className="rounded bg-primary/10 px-1.5 py-0.5 text-primary">{c.after}</code>
                  </span>
                </TableCell>
                <TableCell className="max-w-40 text-xs text-muted-foreground">{c.reason}</TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  <div>{c.syncToDevice ? '同步设备' : '仅服务端'}</div>
                  <div>{c.recompute ? '重算统计' : '不重算'}</div>
                </TableCell>
                <TableCell className="text-xs">{c.operator}</TableCell>
                <TableCell className="text-xs text-muted-foreground">{c.time}</TableCell>
                <TableCell>
                  <StatusBadge label={statusMeta[c.status].label} variant={statusMeta[c.status].variant} />
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
            ))}
          </TableBody>
        </Table>
      </Card>

      <DangerConfirm
        open={!!rollback}
        onClose={() => setRollback(null)}
        onConfirm={() => setRollback(null)}
        action="回滚数据修正"
        scope={rollback?.targetType ?? ''}
        target={rollback?.target ?? ''}
        before={rollback?.after}
        after={rollback?.before}
        confirmPhrase="确认回滚"
      />
    </>
  )
}
