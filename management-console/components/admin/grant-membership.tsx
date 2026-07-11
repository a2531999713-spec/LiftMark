'use client'

import { useState } from 'react'
import { Modal } from '@/components/ui/overlay'
import { Button } from '@/components/ui/button'
import { Input, Label, Select, Textarea } from '@/components/ui/field'

export function GrantMembershipModal({
  open,
  onClose,
  presetUser,
}: {
  open: boolean
  onClose: () => void
  presetUser?: string
}) {
  const [type, setType] = useState('pro90')
  const [notify, setNotify] = useState(true)

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="发放会员权益"
      description="人工发放会员权益，操作将写入权益变更日志与操作审计。"
      width="max-w-xl"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            取消
          </Button>
          <Button onClick={onClose}>确认发放</Button>
        </>
      }
    >
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2">
          <Label>选择用户</Label>
          <Input defaultValue={presetUser ?? ''} placeholder="手机号 / 用户 ID / 练刻 ID" />
        </div>
        <div>
          <Label>权益类型</Label>
          <Select value={type} onChange={(e) => setType(e.target.value)}>
            <option value="pro30">Pro 30 天</option>
            <option value="pro90">Pro 90 天</option>
            <option value="pro180">Pro 180 天</option>
            <option value="pro365">Pro 365 天</option>
            <option value="lifetime">永久会员（高危）</option>
          </Select>
        </div>
        <div>
          <Label>可激活 Pro 小组数量</Label>
          <Input type="number" defaultValue={3} />
        </div>
        <div>
          <Label>每个 Pro 小组人数上限</Label>
          <Input type="number" defaultValue={6} />
        </div>
        <div>
          <Label>发放来源</Label>
          <Select defaultValue="manual">
            <option value="manual">manual 手动</option>
            <option value="beta">beta 内测</option>
            <option value="campus">campus 校园</option>
            <option value="partner">partner 合作方</option>
            <option value="compensation">compensation 补偿</option>
            <option value="payment_fix">payment_fix 支付修正</option>
            <option value="test">test 测试</option>
          </Select>
        </div>
        <div className="col-span-2">
          <Label>发放原因（必填）</Label>
          <Textarea placeholder="请填写发放原因，将记录到审计日志" />
        </div>
        <div className="col-span-2">
          <Label>备注</Label>
          <Input placeholder="可关联工单编号，如 F40001" />
        </div>
        <label className="col-span-2 flex items-center gap-2 text-sm">
          <input type="checkbox" checked={notify} onChange={(e) => setNotify(e.target.checked)} />
          发放后通知用户
        </label>
        {type === 'lifetime' && (
          <p className="col-span-2 rounded-md border border-destructive/25 bg-destructive/8 p-2 text-xs text-destructive">
            永久会员为高危操作，请谨慎发放。确认后将要求二次确认。
          </p>
        )}
      </div>
    </Modal>
  )
}
