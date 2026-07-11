'use client'

import { useState } from 'react'
import { AlertTriangle } from 'lucide-react'
import { Modal } from '@/components/ui/overlay'
import { Button } from '@/components/ui/button'
import { Input, Label, Textarea } from '@/components/ui/field'

export function DangerConfirm({
  open,
  onClose,
  onConfirm,
  action,
  scope,
  target,
  before,
  after,
  confirmPhrase = '确认修改',
}: {
  open: boolean
  onClose: () => void
  onConfirm: (reason: string) => void
  action: string
  scope: string
  target: string
  before?: string
  after?: string
  confirmPhrase?: string
}) {
  const [reason, setReason] = useState('')
  const [phrase, setPhrase] = useState('')
  const canConfirm = reason.trim().length >= 4 && phrase.trim() === confirmPhrase

  function reset() {
    setReason('')
    setPhrase('')
  }

  return (
    <Modal
      open={open}
      onClose={() => {
        reset()
        onClose()
      }}
      title={
        <span className="flex items-center gap-2 text-destructive">
          <AlertTriangle className="size-4" /> 高危操作确认
        </span>
      }
      description="该操作会写入不可删除的审计日志，请谨慎处理。"
      footer={
        <>
          <Button
            variant="outline"
            onClick={() => {
              reset()
              onClose()
            }}
          >
            取消
          </Button>
          <Button
            variant="destructive"
            disabled={!canConfirm}
            onClick={() => {
              onConfirm(reason)
              reset()
            }}
          >
            确认执行
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <div className="rounded-md border border-destructive/25 bg-destructive/8 p-3">
          <dl className="grid grid-cols-[5rem_1fr] gap-y-1.5 text-sm">
            <dt className="text-muted-foreground">操作名称</dt>
            <dd className="font-medium text-destructive">{action}</dd>
            <dt className="text-muted-foreground">影响范围</dt>
            <dd>{scope}</dd>
            <dt className="text-muted-foreground">修改对象</dt>
            <dd className="font-mono text-xs">{target}</dd>
          </dl>
        </div>

        {(before || after) && (
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div className="rounded-md border border-border bg-muted/40 p-2.5">
              <div className="mb-1 text-xs text-muted-foreground">修改前</div>
              <div className="break-all font-mono text-xs">{before}</div>
            </div>
            <div className="rounded-md border border-primary/25 bg-primary/6 p-2.5">
              <div className="mb-1 text-xs text-muted-foreground">修改后</div>
              <div className="break-all font-mono text-xs">{after}</div>
            </div>
          </div>
        )}

        <div>
          <Label>修改原因（必填）</Label>
          <Textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="请填写此次操作的原因，将记录到审计日志"
          />
        </div>

        <div>
          <Label>
            二次确认：请输入 <span className="font-mono text-destructive">{confirmPhrase}</span>
          </Label>
          <Input
            value={phrase}
            onChange={(e) => setPhrase(e.target.value)}
            placeholder={confirmPhrase}
          />
        </div>
      </div>
    </Modal>
  )
}
