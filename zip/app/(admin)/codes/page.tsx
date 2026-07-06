'use client'

import { useMemo, useState } from 'react'
import { Search, RotateCcw, Plus, Ticket, Ban, Copy } from 'lucide-react'
import { PageHeader, FilterBar, Field } from '@/components/admin/page-parts'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input, Label, Select, Textarea } from '@/components/ui/field'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
import { StatusBadge } from '@/components/admin/status-badge'
import { Modal } from '@/components/ui/overlay'
import { DangerConfirm } from '@/components/admin/danger-confirm'
import { activationCodes, codeTypes, type ActivationCode } from '@/lib/data'

const statusMeta: Record<ActivationCode['status'], { label: string; variant: 'success' | 'warning' | 'danger' }> = {
  active: { label: '生效中', variant: 'success' },
  disabled: { label: '已停用', variant: 'danger' },
  expired: { label: '已过期', variant: 'warning' },
}

export default function CodesPage() {
  const [q, setQ] = useState('')
  const [type, setType] = useState('all')
  const [status, setStatus] = useState('all')
  const [gen, setGen] = useState(false)
  const [disable, setDisable] = useState<ActivationCode | null>(null)

  const filtered = useMemo(
    () =>
      activationCodes.filter((c) => {
        if (q && !`${c.code}${c.campaign}${c.id}`.toLowerCase().includes(q.toLowerCase())) return false
        if (type !== 'all' && c.type !== type) return false
        if (status !== 'all' && c.status !== status) return false
        return true
      }),
    [q, type, status],
  )

  return (
    <>
      <PageHeader
        title="激活码管理"
        description="生成、发放与管理各类会员激活码。支持单个/批量生成、设置有效期、每人限领次数、使用渠道与关联活动。"
        actions={
          <Button onClick={() => setGen(true)}>
            <Plus data-icon="inline-start" /> 生成激活码
          </Button>
        }
      />

      <FilterBar>
        <Field label="搜索">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="激活码 / 活动 / 批次号" className="pl-8" />
          </div>
        </Field>
        <Field label="类型">
          <Select value={type} onChange={(e) => setType(e.target.value)}>
            <option value="all">全部</option>
            {codeTypes.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </Select>
        </Field>
        <Field label="状态">
          <Select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="all">全部</option>
            <option value="active">生效中</option>
            <option value="disabled">已停用</option>
            <option value="expired">已过期</option>
          </Select>
        </Field>
        <Button variant="ghost" onClick={() => { setQ(''); setType('all'); setStatus('all') }}>
          <RotateCcw data-icon="inline-start" /> 重置
        </Button>
      </FilterBar>

      <Card>
        <div className="border-b border-border px-4 py-2.5 text-xs text-muted-foreground">共 {filtered.length} 个批次</div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>批次号 / 激活码</TableHead>
              <TableHead>类型</TableHead>
              <TableHead>权益</TableHead>
              <TableHead>关联活动</TableHead>
              <TableHead>渠道</TableHead>
              <TableHead className="text-right">已用 / 总量</TableHead>
              <TableHead>有效期至</TableHead>
              <TableHead>状态</TableHead>
              <TableHead className="text-right">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((c) => (
              <TableRow key={c.id}>
                <TableCell>
                  <span className="block font-mono text-xs text-muted-foreground">{c.id}</span>
                  <span className="flex items-center gap-1 font-mono text-xs">
                    <Ticket className="size-3 text-primary" /> {c.code}
                  </span>
                </TableCell>
                <TableCell className="text-xs">{c.type}</TableCell>
                <TableCell className="text-xs">{c.benefit}</TableCell>
                <TableCell className="text-xs text-muted-foreground">{c.campaign}</TableCell>
                <TableCell className="text-xs text-muted-foreground">{c.channel}</TableCell>
                <TableCell className="text-right tabular-nums">
                  <span className={c.used >= c.total ? 'text-destructive' : ''}>{c.used}</span>
                  <span className="text-muted-foreground"> / {c.total}</span>
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">{c.validUntil}</TableCell>
                <TableCell><StatusBadge label={statusMeta[c.status].label} variant={statusMeta[c.status].variant} /></TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    <Button variant="ghost" size="icon-sm" aria-label="复制">
                      <Copy />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={c.status !== 'active'}
                      onClick={() => setDisable(c)}
                    >
                      <Ban data-icon="inline-start" /> 停用
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      <Modal
        open={gen}
        onClose={() => setGen(false)}
        title="生成激活码"
        description="配置激活码规则，系统将生成对应批次。永久会员码为高危类型，需二次确认。"
        width="max-w-xl"
        footer={
          <>
            <Button variant="outline" onClick={() => setGen(false)}>取消</Button>
            <Button onClick={() => setGen(false)}>生成批次</Button>
          </>
        }
      >
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>激活码类型</Label>
            <Select defaultValue={codeTypes[0]}>
              {codeTypes.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </Select>
          </div>
          <div>
            <Label>权益内容</Label>
            <Select defaultValue="Pro 90 天">
              <option>Pro 30 天</option>
              <option>Pro 90 天</option>
              <option>Pro 180 天</option>
              <option>Pro 365 天</option>
              <option>永久会员</option>
            </Select>
          </div>
          <div>
            <Label>生成数量</Label>
            <Input type="number" defaultValue={100} />
          </div>
          <div>
            <Label>每人限领次数</Label>
            <Input type="number" defaultValue={1} />
          </div>
          <div>
            <Label>有效期至</Label>
            <Input type="date" defaultValue="2026-12-31" />
          </div>
          <div>
            <Label>发放渠道</Label>
            <Select defaultValue="官网">
              <option>官网</option>
              <option>App 内</option>
              <option>微信</option>
              <option>线下</option>
              <option>合作方</option>
              <option>客服</option>
            </Select>
          </div>
          <div className="col-span-2">
            <Label>关联活动</Label>
            <Input placeholder="如：夏日健身季" />
          </div>
          <div className="col-span-2">
            <Label>备注</Label>
            <Textarea placeholder="批次用途说明" />
          </div>
        </div>
      </Modal>

      <DangerConfirm
        open={!!disable}
        onClose={() => setDisable(null)}
        onConfirm={() => setDisable(null)}
        action="停用激活码批次"
        scope={disable?.type ?? ''}
        target={disable?.code ?? ''}
        before="生效中"
        after="已停用"
        confirmPhrase="确认停用"
      />
    </>
  )
}
