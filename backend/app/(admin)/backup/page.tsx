'use client'

import { PageHeader, InfoRow } from '@/components/admin/page-parts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export default function BackupPage() {
  return (
    <>
      <PageHeader
        title="备份与恢复"
        description="数据库备份与恢复操作指引。当前未提供远程备份 API，请通过 SSH 在服务器上手动操作。"
      />

      <Card>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            数据库为 PostgreSQL，数据目录在服务器。当前未提供远程备份 API。请通过 SSH 登录服务器，使用{' '}
            <code className="rounded bg-muted px-1 py-0.5 text-xs">pg_dump</code>{' '}
            进行手动备份。
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>数据库信息</CardTitle>
        </CardHeader>
        <CardContent>
          <dl>
            <InfoRow label="数据库">liftmark_prod</InfoRow>
            <InfoRow label="用户">liftmark_user</InfoRow>
            <InfoRow label="主机">127.0.0.1:5432</InfoRow>
          </dl>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>常用命令</CardTitle>
        </CardHeader>
        <CardContent>
          <pre className="rounded bg-muted p-3 text-xs overflow-x-auto">
{`# 完整备份
pg_dump -U liftmark_user -h 127.0.0.1 liftmark_prod > liftmark_backup_$(date +%Y%m%d).sql

# 恢复
psql -U liftmark_user -h 127.0.0.1 liftmark_prod < liftmark_backup_YYYYMMDD.sql`}
          </pre>
        </CardContent>
      </Card>
    </>
  )
}
