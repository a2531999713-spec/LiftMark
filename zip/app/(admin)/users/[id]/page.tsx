'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import {
  ArrowLeft, Crown, Ban, ShieldAlert, Phone, ImageUp, RefreshCw,
  Wrench, GitMerge, Download, StickyNote, Smartphone, Undo2,
} from 'lucide-react'
import { PageHeader, InfoRow, SectionTitle } from '@/components/admin/page-parts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Avatar } from '@/components/admin/avatar'
import { SensitiveValue } from '@/components/admin/sensitive'
import { SyncBadge, TierBadge, AccountStatusBadge, StatusBadge } from '@/components/admin/status-badge'
import { GrantMembershipModal } from '@/components/admin/grant-membership'
import { CorrectionModal } from '@/components/admin/correction-modal'
import { DangerConfirm } from '@/components/admin/danger-confirm'
import { getUser, maskPhone, memberships, sessions, devices, orders, feedbacks, logs, corrections } from '@/lib/data'
import { cn } from '@/lib/utils'

const tabs = ['基础与账号', '会员权益', '小组与成员', '训练与同步', '订单与反馈', '修正与日志']

export default function UserDetailPage() {
  const params = useParams()
  const id = String(params.id)
  const user = getUser(id) ?? getUser('U100234')!
  const [tab, setTab] = useState(0)
  const [grant, setGrant] = useState(false)
  const [correct, setCorrect] = useState(false)
  const [danger, setDanger] = useState<null | { action: string; before?: string; after?: string; phrase?: string }>(null)

  const userMemberships = memberships.filter((m) => m.userName === user.name).slice(0, 3)
  const userSessions = sessions.filter((s) => s.user === user.name).slice(0, 5)
  const userDevices = devices.filter((d) => d.user === user.name).slice(0, 3)
  const userOrders = orders.filter((o) => o.user === user.name).slice(0, 4)
  const userFeedback = feedbacks.filter((f) => f.user === user.name).slice(0, 3)
  const userLogs = logs.slice(0, 6)
  const userCorrections = corrections.slice(0, 4)

  return (
    <>
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link href="/users" className="flex items-center gap-1 hover:text-primary">
          <ArrowLeft className="size-4" /> 用户管理
        </Link>
        <span>/</span>
        <span className="font-mono text-foreground">{user.id}</span>
      </div>

      <PageHeader
        title={`${user.name} 的用户详情`}
        description="查看用户全量数据、处理账号问题并执行数据修正。敏感信息默认脱敏。"
      />

      <div className="flex flex-col gap-4 xl:flex-row">
        {/* 概要卡 + 操作面板 */}
        <div className="w-full space-y-4 xl:w-72 xl:shrink-0">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <Avatar name={user.name} className="size-12 text-lg" />
                <div className="min-w-0">
                  <div className="truncate text-base font-semibold">{user.name}</div>
                  <div className="font-mono text-xs text-muted-foreground">{user.liftId}</div>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-1.5">
                <TierBadge tier={user.tier} />
                <AccountStatusBadge status={user.status} />
                <SyncBadge status={user.sync} />
              </div>
              <dl className="mt-3 border-t border-border pt-2">
                <InfoRow label="手机号">
                  <SensitiveValue masked={maskPhone(user.phone)} full={user.phone} />
                </InfoRow>
                <InfoRow label="注册时间">{user.registeredAt}</InfoRow>
                <InfoRow label="最近登录">{user.lastLogin}</InfoRow>
              </dl>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>管理员操作</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1.5">
              <Button variant="outline" size="sm" className="w-full justify-start" onClick={() => setGrant(true)}>
                <Crown data-icon="inline-start" /> 发放 / 延长会员
              </Button>
              <Button variant="outline" size="sm" className="w-full justify-start" onClick={() => setCorrect(true)}>
                <Wrench data-icon="inline-start" /> 新建数据修正任务
              </Button>
              <Button variant="outline" size="sm" className="w-full justify-start" onClick={() => setDanger({ action: '触发重新同步', before: user.sync, after: 'pending_sync' })}>
                <RefreshCw data-icon="inline-start" /> 触发重新同步
              </Button>
              <Button variant="outline" size="sm" className="w-full justify-start" onClick={() => setDanger({ action: '修复头像同步', before: '失败', after: '重新处理' })}>
                <ImageUp data-icon="inline-start" /> 修复头像同步
              </Button>
              <Button variant="outline" size="sm" className="w-full justify-start">
                <StickyNote data-icon="inline-start" /> 添加管理员备注
              </Button>
              <Button variant="outline" size="sm" className="w-full justify-start">
                <Download data-icon="inline-start" /> 导出用户数据
              </Button>

              <div className="pt-2 text-[11px] font-medium text-destructive">高危操作</div>
              <Button variant="destructive" size="sm" className="w-full justify-start" onClick={() => setDanger({ action: '修改手机号', before: maskPhone(user.phone), after: '13900000000', phrase: '确认修改' })}>
                <Phone data-icon="inline-start" /> 修改手机号
              </Button>
              <Button variant="destructive" size="sm" className="w-full justify-start" onClick={() => setDanger({ action: user.status === 'disabled' ? '解禁账号' : '禁用账号', before: user.status, after: user.status === 'disabled' ? 'active' : 'disabled' })}>
                <Ban data-icon="inline-start" /> {user.status === 'disabled' ? '解禁账号' : '禁用账号'}
              </Button>
              <Button variant="destructive" size="sm" className="w-full justify-start" onClick={() => setDanger({ action: '标记异常用户', before: 'normal', after: 'abnormal' })}>
                <ShieldAlert data-icon="inline-start" /> 标记异常用户
              </Button>
              <Button variant="destructive" size="sm" className="w-full justify-start" onClick={() => setDanger({ action: '合并重复账号', scope: '账号数据合并' as never, before: '2 个账号', after: '1 个账号' })}>
                <GitMerge data-icon="inline-start" /> 合并重复账号
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* 详情主体 */}
        <div className="min-w-0 flex-1 space-y-4">
          <div className="flex flex-wrap gap-1 rounded-lg border border-border bg-card p-1">
            {tabs.map((t, i) => (
              <button
                key={t}
                onClick={() => setTab(i)}
                className={cn(
                  'rounded-md px-3 py-1.5 text-sm transition-colors',
                  tab === i ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted',
                )}
              >
                {t}
              </button>
            ))}
          </div>

          {tab === 0 && (
            <div className="grid gap-4 md:grid-cols-2">
              <Card>
                <CardHeader><CardTitle>用户基础信息</CardTitle></CardHeader>
                <CardContent>
                  <dl>
                    <InfoRow label="用户 ID">{user.id}</InfoRow>
                    <InfoRow label="昵称">{user.name}</InfoRow>
                    <InfoRow label="练刻 ID">{user.liftId}</InfoRow>
                    <InfoRow label="性别">{user.gender}</InfoRow>
                    <InfoRow label="年龄">{user.age}</InfoRow>
                  </dl>
                </CardContent>
              </Card>
              <Card>
                <CardHeader><CardTitle>账号安全与登录</CardTitle></CardHeader>
                <CardContent>
                  <dl>
                    <InfoRow label="登录方式">手机号验证码</InfoRow>
                    <InfoRow label="手机号"><SensitiveValue masked={maskPhone(user.phone)} full={user.phone} /></InfoRow>
                    <InfoRow label="账号状态"><AccountStatusBadge status={user.status} /></InfoRow>
                    <InfoRow label="最近登录 IP"><SensitiveValue masked="112.65.*.*" full="112.65.12.108" /></InfoRow>
                    <InfoRow label="登录设备数">{userDevices.length}</InfoRow>
                  </dl>
                </CardContent>
              </Card>
            </div>
          )}

          {tab === 1 && (
            <Card>
              <CardHeader>
                <CardTitle>会员权益与来源</CardTitle>
                <Button size="sm" onClick={() => setGrant(true)}><Crown data-icon="inline-start" /> 发放会员</Button>
              </CardHeader>
              <CardContent className="p-0">
                {userMemberships.length ? userMemberships.map((m) => (
                  <div key={m.id} className="border-b border-border p-4 last:border-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <TierBadge tier={m.tier} />
                      <StatusBadge label={m.status === 'active' ? '生效中' : m.status === 'expired' ? '已过期' : '已撤销'} variant={m.status === 'active' ? 'success' : m.status === 'expired' ? 'outline' : 'danger'} />
                      <Badge variant="info">来源：{m.source}</Badge>
                      <span className="ml-auto font-mono text-xs text-muted-foreground">{m.id}</span>
                    </div>
                    <div className="mt-2 grid grid-cols-2 gap-x-6 md:grid-cols-4">
                      <InfoRow label="生效">{m.startAt}</InfoRow>
                      <InfoRow label="到期">{m.endAt}</InfoRow>
                      <InfoRow label="Pro 小组">{m.usedProGroups}/{m.proGroups}</InfoRow>
                      <InfoRow label="每组上限">{m.maxPerGroup} 人</InfoRow>
                    </div>
                  </div>
                )) : <div className="p-4 text-sm text-muted-foreground">该用户暂无会员权益记录。</div>}
              </CardContent>
            </Card>
          )}

          {tab === 2 && (
            <div className="grid gap-4 md:grid-cols-2">
              <Card>
                <CardHeader><CardTitle>小组列表（{user.groups}）</CardTitle></CardHeader>
                <CardContent className="space-y-2">
                  {Array.from({ length: Math.max(user.groups, 1) }).map((_, i) => (
                    <div key={i} className="flex items-center justify-between rounded-md border border-border px-3 py-2 text-sm">
                      <span>清晨力量小队 #{i + 1}</span>
                      <Badge variant={i === 0 ? 'primary' : 'outline'}>{i === 0 ? '组长' : '成员'}</Badge>
                    </div>
                  ))}
                </CardContent>
              </Card>
              <Card>
                <CardHeader><CardTitle>成员档案（{user.members}）</CardTitle></CardHeader>
                <CardContent className="space-y-2">
                  {Array.from({ length: user.members }).map((_, i) => (
                    <div key={i} className="flex items-center justify-between rounded-md border border-border px-3 py-2 text-sm">
                      <span className="flex items-center gap-2"><Avatar name={`成${i}`} className="size-6" /> 成员档案 {i + 1}</span>
                      <Badge variant="outline">{i === 0 ? '账号绑定' : '本机成员'}</Badge>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>
          )}

          {tab === 3 && (
            <div className="space-y-4">
              <Card>
                <CardHeader><CardTitle>训练数据汇总</CardTitle></CardHeader>
                <CardContent className="grid grid-cols-3 gap-4">
                  <div><div className="text-2xl font-semibold">{user.trainings}</div><div className="text-xs text-muted-foreground">总训练次数</div></div>
                  <div><div className="text-2xl font-semibold">{userSessions.length}</div><div className="text-xs text-muted-foreground">近期 session</div></div>
                  <div><div className="text-2xl font-semibold">{user.members}</div><div className="text-xs text-muted-foreground">训练成员</div></div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader><CardTitle>近期训练与同步</CardTitle></CardHeader>
                <CardContent className="space-y-2">
                  {userSessions.length ? userSessions.map((s) => (
                    <div key={s.id} className="flex items-center gap-3 rounded-md border border-border px-3 py-2 text-sm">
                      <span className="font-mono text-xs text-muted-foreground">{s.id}</span>
                      <span className="flex-1">{s.title} · {s.date}</span>
                      <SyncBadge status={s.sync} />
                      <Button size="xs" variant="outline" render={<Link href={`/training/${s.id}`} />}>查看</Button>
                    </div>
                  )) : <div className="text-sm text-muted-foreground">暂无训练记录</div>}
                </CardContent>
              </Card>
              <Card>
                <CardHeader><CardTitle>设备登录记录</CardTitle></CardHeader>
                <CardContent className="space-y-2">
                  {userDevices.map((d) => (
                    <div key={d.id} className="flex items-center gap-3 rounded-md border border-border px-3 py-2 text-sm">
                      <Smartphone className="size-4 text-muted-foreground" />
                      <span className="flex-1">{d.model} · {d.platform} {d.osVersion} · App {d.appVersion}</span>
                      <span className="text-xs text-muted-foreground">{d.lastLogin}</span>
                      <Button size="xs" variant="destructive">解绑</Button>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>
          )}

          {tab === 4 && (
            <div className="grid gap-4 md:grid-cols-2">
              <Card>
                <CardHeader><CardTitle>订单记录</CardTitle></CardHeader>
                <CardContent className="space-y-2">
                  {userOrders.length ? userOrders.map((o) => (
                    <div key={o.id} className="flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm">
                      <span className="flex-1">{o.product} · ¥{o.amount}</span>
                      <StatusBadge label={o.payStatus === 'paid' ? '已支付' : o.payStatus === 'refunded' ? '已退款' : o.payStatus === 'failed' ? '支付失败' : '未支付'} variant={o.payStatus === 'paid' ? 'success' : o.payStatus === 'failed' ? 'danger' : 'outline'} />
                      <Button size="xs" variant="outline" render={<Link href="/orders" />}>查看</Button>
                    </div>
                  )) : <div className="text-sm text-muted-foreground">无订单记录</div>}
                </CardContent>
              </Card>
              <Card>
                <CardHeader><CardTitle>反馈工单</CardTitle></CardHeader>
                <CardContent className="space-y-2">
                  {userFeedback.length ? userFeedback.map((f) => (
                    <div key={f.id} className="flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm">
                      <span className="flex-1 truncate">{f.title}</span>
                      <Badge variant="outline">{f.type}</Badge>
                      <Button size="xs" variant="outline" render={<Link href={`/feedback/${f.id}`} />}>处理</Button>
                    </div>
                  )) : <div className="text-sm text-muted-foreground">无反馈工单</div>}
                </CardContent>
              </Card>
            </div>
          )}

          {tab === 5 && (
            <div className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>数据修正记录</CardTitle>
                  <Button size="sm" onClick={() => setCorrect(true)}><Wrench data-icon="inline-start" /> 新建修正</Button>
                </CardHeader>
                <CardContent className="space-y-2">
                  {userCorrections.map((c) => (
                    <div key={c.id} className="rounded-md border border-border px-3 py-2 text-sm">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">{c.targetType}</Badge>
                        <span className="font-mono text-xs">{c.field}</span>
                        <StatusBadge label={c.status === 'done' ? '已完成' : c.status === 'pending' ? '待执行' : '已回滚'} variant={c.status === 'done' ? 'success' : c.status === 'pending' ? 'warning' : 'outline'} />
                        {c.status === 'done' && <Button size="xs" variant="ghost" className="ml-auto"><Undo2 data-icon="inline-start" /> 回滚</Button>}
                      </div>
                      <div className="mt-1 flex items-center gap-2 font-mono text-xs text-muted-foreground">
                        <span className="text-destructive">{c.before}</span> → <span className="text-primary">{c.after}</span>
                        <span className="ml-auto">{c.operator} · {c.time}</span>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
              <Card>
                <CardHeader><CardTitle>操作日志</CardTitle></CardHeader>
                <CardContent className="space-y-2">
                  {userLogs.map((l) => (
                    <div key={l.id} className="flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm">
                      <StatusBadge label={l.module} variant="outline" />
                      <span className="flex-1 truncate">{l.action}</span>
                      <StatusBadge label={l.risk === 'high' ? '高危' : l.risk === 'medium' ? '中' : '低'} variant={l.risk === 'high' ? 'danger' : l.risk === 'medium' ? 'warning' : 'default'} />
                      <span className="text-xs text-muted-foreground">{l.operator} · {l.time}</span>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </div>

      <GrantMembershipModal open={grant} onClose={() => setGrant(false)} presetUser={user.phone} />
      <CorrectionModal open={correct} onClose={() => setCorrect(false)} target={user.id} targetType="用户资料" />
      <DangerConfirm
        open={!!danger}
        onClose={() => setDanger(null)}
        onConfirm={() => setDanger(null)}
        action={danger?.action ?? ''}
        scope="单个用户"
        target={user.id}
        before={danger?.before}
        after={danger?.after}
        confirmPhrase={danger?.phrase ?? '确认修改'}
      />
    </>
  )
}
