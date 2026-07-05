'use client'

import { ExternalLink, FolderOpen } from 'lucide-react'
import { PageHeader, InfoRow } from '@/components/admin/page-parts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

export default function FilesPage() {
  return (
    <>
      <PageHeader
        title="文件与头像"
        description="查看服务器上的头像与上传文件存储位置与访问方式。"
      />

      <Card>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            头像与文件存储在服务器{' '}
            <code className="rounded bg-muted px-1 py-0.5 text-xs">/home/deploy/liftmark/uploads/</code>{' '}
            目录，通过 nginx 反代{' '}
            <code className="rounded bg-muted px-1 py-0.5 text-xs">/uploads/</code>{' '}
            访问。当前未提供文件列表 API，如需管理文件，请通过 SSH 登录服务器操作。
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>存储信息</CardTitle>
        </CardHeader>
        <CardContent>
          <dl>
            <InfoRow label="存储路径">/home/deploy/liftmark/uploads/</InfoRow>
            <InfoRow label="访问路径">http://47.100.239.29/uploads/</InfoRow>
            <InfoRow label="nginx 配置">/etc/nginx/sites-enabled/liftmark</InfoRow>
          </dl>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>头像目录</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="mb-3 text-sm text-muted-foreground">
            点击下方按钮在新标签页中查看头像目录。
          </p>
          <Button render={<a href="http://47.100.239.29/uploads/avatars/" target="_blank" rel="noreferrer" />}>
            <FolderOpen data-icon="inline-start" /> 查看头像目录
            <ExternalLink data-icon="inline-end" />
          </Button>
        </CardContent>
      </Card>
    </>
  )
}
