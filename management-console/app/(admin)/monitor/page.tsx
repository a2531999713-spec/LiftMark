'use client'

import { Loader2, AlertCircle, RefreshCw, Activity, Server, Users, Dumbbell, UsersRound, MessageSquareWarning, RefreshCcwDot, DoorOpen } from 'lucide-react'
import { PageHeader } from '@/components/admin/page-parts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useFetch } from '@/lib/hooks'

type ServiceStatus = {
  name: string
  status: string
  detail: string
}

type Metrics = {
  totalUsers: number
  totalSessions: number
  totalGroups: number
  openFeedback: number
  syncStates: number
  activeRooms: number
}

type MonitorResponse = {
  services: ServiceStatus[]
  metrics: Metrics
}

const metricCards: Array<{ key: keyof Metrics; label: string; icon: React.ReactNode }> = [
  { key: 'totalUsers', label: '总用户', icon: <Users className="size-4 text-primary" /> },
  { key: 'totalSessions', label: '训练 session', icon: <Dumbbell className="size-4 text-primary" /> },
  { key: 'totalGroups', label: '小组数', icon: <UsersRound className="size-4 text-primary" /> },
  { key: 'openFeedback', label: '待处理反馈', icon: <MessageSquareWarning className="size-4 text-primary" /> },
  { key: 'syncStates', label: '同步状态', icon: <RefreshCcwDot className="size-4 text-primary" /> },
  { key: 'activeRooms', label: '活跃房间', icon: <DoorOpen className="size-4 text-primary" /> },
]

export default function MonitorPage() {
  const { data, loading, error, reload } = useFetch<MonitorResponse>('/admin/monitor')

  const services = data?.services ?? []
  const metrics = data?.metrics

  return (
    <>
      <PageHeader
        title="系统监控"
        description="实时查看后端服务状态、关键业务指标与同步健康度。数据每次进入页面刷新，可手动重载。"
        actions={
          <Button variant="outline" onClick={reload} disabled={loading}>
            <RefreshCw data-icon="inline-start" className={loading ? 'animate-spin' : ''} /> 刷新
          </Button>
        }
      />

      {error ? (
        <Card>
          <CardContent className="py-8 text-center text-sm text-destructive">
            <div className="flex flex-col items-center gap-2">
              <AlertCircle className="size-4" />
              <span>{error}</span>
              <Button variant="outline" size="sm" onClick={reload}>重试</Button>
            </div>
          </CardContent>
        </Card>
      ) : loading ? (
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            <Loader2 className="mx-auto size-4 animate-spin" />
          </CardContent>
        </Card>
      ) : (
        <>
          <div>
            <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold">
              <Server className="size-4 text-primary" /> 服务状态
            </h2>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {services.length === 0 ? (
                <Card className="col-span-full">
                  <CardContent className="py-6 text-center text-xs text-muted-foreground">
                    暂无服务状态数据
                  </CardContent>
                </Card>
              ) : (
                services.map((s) => {
                  const ok = s.status === 'ok'
                  return (
                    <Card key={s.name}>
                      <CardHeader>
                        <CardTitle className="flex items-center justify-between gap-2">
                          <span className="truncate">{s.name}</span>
                          <Badge variant={ok ? 'success' : 'danger'}>
                            <Activity className="size-3" />
                            {ok ? '正常' : s.status || '异常'}
                          </Badge>
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <p className="break-words text-xs text-muted-foreground">
                          {s.detail || '—'}
                        </p>
                      </CardContent>
                    </Card>
                  )
                })
              )}
            </div>
          </div>

          <div>
            <h2 className="mb-2 mt-6 flex items-center gap-2 text-sm font-semibold">
              <Activity className="size-4 text-primary" /> 关键指标
            </h2>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
              {metricCards.map((m) => (
                <Card key={m.key}>
                  <CardContent>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      {m.icon}
                      <span className="truncate">{m.label}</span>
                    </div>
                    <div className="mt-1.5 text-2xl font-semibold tabular-nums">
                      {metrics ? Number(metrics[m.key] ?? 0).toLocaleString() : '—'}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </>
      )}
    </>
  )
}
