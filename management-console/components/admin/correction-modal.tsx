'use client'

import { useState } from 'react'
import { Wrench, ArrowRight } from 'lucide-react'
import { Modal } from '@/components/ui/overlay'
import { Button } from '@/components/ui/button'
import { Input, Label, Select, Textarea } from '@/components/ui/field'

export function CorrectionModal({
  open,
  onClose,
  target,
  targetType,
  field = '',
  currentValue = '',
}: {
  open: boolean
  onClose: () => void
  target: string
  targetType?: string
  field?: string
  currentValue?: string
}) {
  const [before] = useState(currentValue)
  const [after, setAfter] = useState(currentValue)
  const [reason, setReason] = useState('')
  const [phrase, setPhrase] = useState('')
  const canConfirm = reason.trim().length >= 4 && phrase.trim() === '确认修正'

  return (
    <Modal
      open={open}
      onClose={onClose}
      width="max-w-2xl"
      title={
        <span className="flex items-center gap-2">
          <Wrench className="size-4 text-primary" /> 新建数据修正任务
        </span>
      }
      description="修正前后对比清晰可见，支持回滚。所有修正会生成可回滚记录与审计日志。"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            取消
          </Button>
          <Button variant="destructive" disabled={!canConfirm} onClick={onClose}>
            执行修正
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>修正对象</Label>
            <Input readOnly value={target} className="font-mono" />
          </div>
          <div>
            <Label>修正类型</Label>
            <Select defaultValue={targetType}>
              <option>用户资料</option>
              <option>手机号</option>
              <option>头像</option>
              <option>会员权益</option>
              <option>小组关系</option>
              <option>成员档案</option>
              <option>训练 session</option>
              <option>每组训练数据</option>
              <option>计划数据</option>
              <option>动作数据</option>
              <option>同步状态</option>
              <option>订单权益</option>
              <option>激活码记录</option>
              <option>文件资源</option>
            </Select>
          </div>
        </div>

        <div>
          <Label>修正字段</Label>
          <Input defaultValue={field} placeholder="如 session.sets[3].weight" className="font-mono" />
        </div>

        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
          <div>
            <Label>当前数据（修改前）</Label>
            <Input readOnly value={before} className="bg-muted/50 font-mono" />
          </div>
          <ArrowRight className="mt-5 size-4 text-muted-foreground" />
          <div>
            <Label>目标数据（修改后）</Label>
            <Input
              value={after}
              onChange={(e) => setAfter(e.target.value)}
              className="border-primary/40 font-mono"
            />
          </div>
        </div>

        <div className="flex flex-wrap gap-4 rounded-md border border-border bg-muted/30 p-3 text-sm">
          <label className="flex items-center gap-2">
            <input type="checkbox" defaultChecked /> 同步到用户设备
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" /> 重新计算统计与分析
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" /> 关联反馈工单
          </label>
        </div>

        <div>
          <Label>修正原因（必填）</Label>
          <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="请说明修正原因" />
        </div>

        <div>
          <Label>
            二次确认：请输入 <span className="font-mono text-destructive">确认修正</span>
          </Label>
          <Input value={phrase} onChange={(e) => setPhrase(e.target.value)} placeholder="确认修正" />
        </div>
      </div>
    </Modal>
  )
}
