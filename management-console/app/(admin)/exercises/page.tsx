'use client'

import { useMemo, useState } from 'react'
import { Search, RotateCcw, Loader2, AlertCircle } from 'lucide-react'
import { PageHeader, FilterBar, Field } from '@/components/admin/page-parts'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/field'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
import { useFetch, formatDate } from '@/lib/hooks'

type Exercise = {
  id: string
  user_id: string
  name: string
  created_at: string
  updated_at: string
  creator_name: string | null
}

type ExercisesResponse = { exercises: Exercise[] }

export default function ExercisesPage() {
  const [q, setQ] = useState('')

  const query = useMemo(() => {
    const p = new URLSearchParams()
    if (q) p.set('q', q)
    const s = p.toString()
    return s ? `?${s}` : ''
  }, [q])

  const { data, loading, error, reload } = useFetch<ExercisesResponse>(`/admin/exercises${query}`, [query])

  const exercises = data?.exercises ?? []

  return (
    <>
      <PageHeader
        title="动作库管理"
        description="查看所有用户创建的训练动作，支持按名称搜索。"
      />

      <FilterBar>
        <Field label="搜索">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="动作名"
              className="pl-8"
            />
          </div>
        </Field>
        <Button variant="ghost" onClick={() => setQ('')}>
          <RotateCcw data-icon="inline-start" /> 重置
        </Button>
      </FilterBar>

      <Card>
        <div className="border-b border-border px-4 py-2.5 text-xs text-muted-foreground">
          {loading ? '加载中…' : `共 ${exercises.length} 个动作`}
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>动作名</TableHead>
              <TableHead>创建者</TableHead>
              <TableHead>创建时间</TableHead>
              <TableHead>更新时间</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {error ? (
              <TableRow>
                <TableCell colSpan={4} className="py-8 text-center text-sm text-destructive">
                  <div className="flex flex-col items-center gap-2">
                    <AlertCircle className="size-4" />
                    <span>{error}</span>
                    <Button variant="outline" size="sm" onClick={reload}>重试</Button>
                  </div>
                </TableCell>
              </TableRow>
            ) : loading ? (
              <TableRow>
                <TableCell colSpan={4} className="py-8 text-center text-sm text-muted-foreground">
                  <Loader2 className="mx-auto size-4 animate-spin" />
                </TableCell>
              </TableRow>
            ) : exercises.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="py-8 text-center text-sm text-muted-foreground">
                  暂无动作数据
                </TableCell>
              </TableRow>
            ) : (
              exercises.map((e) => (
                <TableRow key={e.id}>
                  <TableCell className="font-medium">{e.name || '（未命名）'}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{e.creator_name || '—'}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{formatDate(e.created_at)}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{formatDate(e.updated_at)}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>
    </>
  )
}
