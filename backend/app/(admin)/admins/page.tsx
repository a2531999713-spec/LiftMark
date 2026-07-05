'use client'

import { Info, Loader2, AlertCircle } from 'lucide-react'
import { PageHeader } from '@/components/admin/page-parts'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
import { Avatar } from '@/components/admin/avatar'
import { StatusBadge } from '@/components/admin/status-badge'
import { useFetch, formatDate, maskPhone } from '@/lib/hooks'

type Admin = {
  id: string
  nickname: string
  phone: string | null
  email: string | null
  status: string
  last_login_at: string | null
  created_at: string
}

type AdminsResponse = { admins: Admin[] }

type StatusVariant = 'success' | 'danger' | 'outline'

function adminStatus(status: string): { label: string; variant: StatusVariant } {
  if (status === 'disabled') return { label: '禁用', variant: 'danger' }
  if (status === 'normal') return { label: '正常', variant: 'success' }
  return { label: status || '未知', variant: 'outline' }
}

export default function AdminsPage() {
  const { data, loading, error, reload } = useFetch<AdminsResponse>('/admin/admins')

  const admins = data?.admins ?? []

  return (
    <>
      <PageHeader
        title="管理员权限"
        description="查看系统管理员账号与登录状态。"
      />

      <Card>
        <CardContent className="flex items-start gap-2">
          <Info className="mt-0.5 size-4 shrink-0 text-info" />
          <p className="text-sm text-muted-foreground">
            当前系统仅存在种子管理员账号。如需新增管理员，请在服务器上使用新的{' '}
            <code className="rounded bg-muted px-1 py-0.5 text-xs">ADMIN_*</code>{' '}
            环境变量执行 <code className="rounded bg-muted px-1 py-0.5 text-xs">db:seed</code>。
          </p>
        </CardContent>
      </Card>

      <Card>
        <div className="border-b border-border px-4 py-2.5 text-xs text-muted-foreground">
          {loading ? '加载中…' : `共 ${admins.length} 名管理员`}
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>管理员</TableHead>
              <TableHead>手机号</TableHead>
              <TableHead>邮箱</TableHead>
              <TableHead>状态</TableHead>
              <TableHead>最近登录</TableHead>
              <TableHead>创建时间</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {error ? (
              <TableRow>
                <TableCell colSpan={6} className="py-8 text-center text-sm text-destructive">
                  <div className="flex flex-col items-center gap-2">
                    <AlertCircle className="size-4" />
                    <span>{error}</span>
                    <Button variant="outline" size="sm" onClick={reload}>重试</Button>
                  </div>
                </TableCell>
              </TableRow>
            ) : loading ? (
              <TableRow>
                <TableCell colSpan={6} className="py-8 text-center text-sm text-muted-foreground">
                  <Loader2 className="mx-auto size-4 animate-spin" />
                </TableCell>
              </TableRow>
            ) : admins.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="py-8 text-center text-sm text-muted-foreground">
                  暂无管理员数据
                </TableCell>
              </TableRow>
            ) : (
              admins.map((a) => {
                const s = adminStatus(a.status)
                return (
                  <TableRow key={a.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Avatar name={a.nickname || a.id} />
                        <span>
                          <span className="block font-medium">{a.nickname || '（未设置昵称）'}</span>
                          <span className="block font-mono text-xs text-muted-foreground">{a.id}</span>
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="font-mono text-xs">{maskPhone(a.phone)}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{a.email || '—'}</TableCell>
                    <TableCell><StatusBadge label={s.label} variant={s.variant} /></TableCell>
                    <TableCell className="text-xs text-muted-foreground">{formatDate(a.last_login_at)}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{formatDate(a.created_at)}</TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </Card>
    </>
  )
}
