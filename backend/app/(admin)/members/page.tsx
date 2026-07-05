'use client'

import { useEffect, useMemo, useState } from 'react'
import { PageHeader, FilterBar, Field } from '@/components/admin/page-parts'
import { Card } from '@/components/ui/card'
import { Select } from '@/components/ui/field'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
import { Avatar } from '@/components/admin/avatar'
import { StatusBadge } from '@/components/admin/status-badge'
import { useFetch, formatDate, maskPhone } from '@/lib/hooks'

type Group = {
  id: string
  name: string
}

type Member = {
  id: string
  user_id: string
  group_id: string
  status: string
  joined_at: string | null
  nickname: string
  phone: string | null
  avatar_url: string | null
  bodyweight: number | null
  bench_1rm: number | null
  squat_1rm: number | null
  deadlift_1rm: number | null
}

type GroupDetail = {
  group: { id: string; name: string }
  members: Member[]
}

type BadgeVariant =
  | 'default'
  | 'primary'
  | 'success'
  | 'warning'
  | 'danger'
  | 'info'
  | 'outline'

const MEMBER_STATUS: Record<string, { variant: BadgeVariant; label: string }> = {
  active: { variant: 'success', label: '正常' },
  inactive: { variant: 'outline', label: '未激活' },
  banned: { variant: 'danger', label: '已封禁' },
  disabled: { variant: 'danger', label: '已禁用' },
  invited: { variant: 'warning', label: '已邀请' },
  pending: { variant: 'warning', label: '待处理' },
}

export default function MembersPage() {
  const [selectedGroupId, setSelectedGroupId] = useState<string>('')

  const { data: groupsData, loading: groupsLoading, error: groupsError } = useFetch<{ groups: Group[] }>(
    '/admin/groups/list',
    [],
  )

  const groups = groupsData?.groups ?? []
  const firstGroupId = groups[0]?.id ?? ''

  useEffect(() => {
    if (!selectedGroupId && firstGroupId) {
      setSelectedGroupId(firstGroupId)
    }
  }, [firstGroupId, selectedGroupId])

  const membersPath = useMemo(
    () => (selectedGroupId ? `/admin/groups/${selectedGroupId}` : null),
    [selectedGroupId],
  )

  const { data: detailData, loading: membersLoading, error: membersError } = useFetch<GroupDetail>(
    membersPath,
    [selectedGroupId],
  )

  const members = detailData?.members ?? []
  const selectedGroup = groups.find((g) => g.id === selectedGroupId)

  return (
    <>
      <PageHeader
        title="成员档案"
        description="选择小组查看成员名单、训练 PR（卧推 / 深蹲 / 硬拉 1RM）与体重、加入时间等档案信息。"
      />

      <FilterBar>
        <Field label="选择小组">
          <Select
            value={selectedGroupId}
            onChange={(e) => setSelectedGroupId(e.target.value)}
            disabled={groupsLoading || groups.length === 0}
          >
            {groups.length === 0 && <option value="">暂无小组</option>}
            {groups.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name || g.id}
              </option>
            ))}
          </Select>
        </Field>
      </FilterBar>

      <Card>
        <div className="flex items-center justify-between border-b border-border px-4 py-2.5 text-xs text-muted-foreground">
          <span>
            {selectedGroup
              ? `${selectedGroup.name || selectedGroup.id} · 共 ${members.length} 名成员`
              : '未选择小组'}
          </span>
          {groupsError ? (
            <span className="text-destructive">小组列表加载失败：{groupsError}</span>
          ) : membersLoading ? (
            <span>加载中...</span>
          ) : membersError ? (
            <span className="text-destructive">{membersError}</span>
          ) : null}
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>成员</TableHead>
              <TableHead>手机号</TableHead>
              <TableHead className="text-right">体重</TableHead>
              <TableHead className="text-right">卧推 1RM</TableHead>
              <TableHead className="text-right">深蹲 1RM</TableHead>
              <TableHead className="text-right">硬拉 1RM</TableHead>
              <TableHead>加入时间</TableHead>
              <TableHead>状态</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {members.map((m) => {
              const statusEntry = MEMBER_STATUS[m.status]
              return (
                <TableRow key={m.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Avatar name={m.nickname || m.user_id} />
                      <span>
                        <span className="block font-medium">{m.nickname || '（未设置昵称）'}</span>
                        <span className="block font-mono text-xs text-muted-foreground">{m.user_id}</span>
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="font-mono text-xs">{maskPhone(m.phone)}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {m.bodyweight != null ? m.bodyweight : '—'}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {m.bench_1rm != null ? m.bench_1rm : '—'}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {m.squat_1rm != null ? m.squat_1rm : '—'}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {m.deadlift_1rm != null ? m.deadlift_1rm : '—'}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">{formatDate(m.joined_at)}</TableCell>
                  <TableCell>
                    <StatusBadge
                      label={statusEntry ? statusEntry.label : m.status || '—'}
                      variant={statusEntry ? statusEntry.variant : 'default'}
                    />
                  </TableCell>
                </TableRow>
              )
            })}
            {!membersLoading && members.length === 0 && (
              <TableRow>
                <TableCell colSpan={8} className="py-8 text-center text-sm text-muted-foreground">
                  {membersError
                    ? `加载失败：${membersError}`
                    : groups.length === 0
                      ? '暂无小组'
                      : '该小组暂无成员'}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>
    </>
  )
}
