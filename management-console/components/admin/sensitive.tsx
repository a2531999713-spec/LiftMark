'use client'

import { useState } from 'react'
import { Eye, ShieldAlert } from 'lucide-react'
import { Modal } from '@/components/ui/overlay'
import { Button } from '@/components/ui/button'
import { Label, Select } from '@/components/ui/field'

export function SensitiveValue({
  masked,
  full,
  className,
}: {
  masked: string
  full: string
  className?: string
}) {
  const [revealed, setRevealed] = useState(false)
  const [confirming, setConfirming] = useState(false)

  return (
    <span className={className}>
      <span className="font-mono">{revealed ? full : masked}</span>
      {!revealed && (
        <button
          type="button"
          onClick={() => setConfirming(true)}
          className="ml-1.5 inline-flex items-center text-muted-foreground hover:text-primary"
          aria-label="查看完整信息"
        >
          <Eye className="size-3.5" />
        </button>
      )}
      <Modal
        open={confirming}
        onClose={() => setConfirming(false)}
        title={
          <span className="flex items-center gap-2 text-warning-foreground">
            <ShieldAlert className="size-4" /> 查看敏感信息
          </span>
        }
        description="该数据默认脱敏。查看将被记录到操作日志，且仅短时间显示。"
        footer={
          <>
            <Button variant="outline" onClick={() => setConfirming(false)}>
              取消
            </Button>
            <Button
              onClick={() => {
                setRevealed(true)
                setConfirming(false)
                window.setTimeout(() => setRevealed(false), 15000)
              }}
            >
              确认查看（15 秒）
            </Button>
          </>
        }
      >
        <Label>查看原因</Label>
        <Select defaultValue="工单处理">
          <option>工单处理</option>
          <option>用户申诉核实</option>
          <option>支付异常排查</option>
          <option>数据修正核对</option>
          <option>安全审计</option>
        </Select>
        <p className="mt-3 text-xs text-muted-foreground">
          不允许批量无理由导出敏感数据。此次查看将记录操作人、时间、IP 与原因。
        </p>
      </Modal>
    </span>
  )
}
