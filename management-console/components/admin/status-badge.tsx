import { Badge } from '@/components/ui/badge'
import { syncStatusLabel, type SyncStatus } from '@/lib/data'

type Variant = 'default' | 'primary' | 'success' | 'warning' | 'danger' | 'info' | 'outline'

export function SyncBadge({ status }: { status: SyncStatus }) {
  const map: Record<SyncStatus, Variant> = {
    synced: 'success',
    pending_sync: 'warning',
    syncing: 'info',
    sync_failed: 'danger',
    conflict: 'danger',
    local_only: 'outline',
    deleted_pending: 'warning',
  }
  return <Badge variant={map[status]}>{syncStatusLabel[status]}</Badge>
}

export function TierBadge({ tier }: { tier: 'free' | 'pro' | 'lifetime' }) {
  if (tier === 'free') return <Badge variant="outline">免费</Badge>
  if (tier === 'pro') return <Badge variant="primary">Pro 会员</Badge>
  return <Badge variant="warning">永久会员</Badge>
}

export function AccountStatusBadge({ status }: { status: 'active' | 'disabled' | 'abnormal' }) {
  if (status === 'active') return <Badge variant="success">正常</Badge>
  if (status === 'disabled') return <Badge variant="danger">已禁用</Badge>
  return <Badge variant="warning">异常</Badge>
}

export function StatusBadge({ label, variant }: { label: string; variant: Variant }) {
  return <Badge variant={variant}>{label}</Badge>
}
