import type { LucideIcon } from 'lucide-react'
import {
  LayoutDashboard,
  Users,
  Crown,
  Ticket,
  UsersRound,
  IdCard,
  Dumbbell,
  ClipboardList,
  Library,
  RefreshCw,
  Smartphone,
  Radio,
  Receipt,
  MessageSquareWarning,
  Megaphone,
  GitBranch,
  ImageIcon,
  Activity,
  DatabaseBackup,
  ShieldCheck,
  ScrollText,
  Settings,
  Wrench,
} from 'lucide-react'

export type NavItem = {
  href: string
  label: string
  icon: LucideIcon
  badge?: 'sync' | 'feedback'
}

export type NavGroup = {
  title: string
  items: NavItem[]
}

export const navGroups: NavGroup[] = [
  {
    title: '总览',
    items: [{ href: '/', label: '首页总览', icon: LayoutDashboard }],
  },
  {
    title: '用户与权益',
    items: [
      { href: '/users', label: '用户管理', icon: Users },
      { href: '/membership', label: '会员与权益', icon: Crown },
      { href: '/codes', label: '激活码管理', icon: Ticket },
    ],
  },
  {
    title: '训练与协作',
    items: [
      { href: '/groups', label: '小组管理', icon: UsersRound },
      { href: '/members', label: '成员档案', icon: IdCard },
      { href: '/training', label: '训练数据', icon: Dumbbell },
      { href: '/plans', label: '计划管理', icon: ClipboardList },
      { href: '/exercises', label: '动作库管理', icon: Library },
      { href: '/rooms', label: '在线同练房间', icon: Radio },
    ],
  },
  {
    title: '数据与运维',
    items: [
      { href: '/sync', label: '云同步管理', icon: RefreshCw, badge: 'sync' },
      { href: '/devices', label: '设备管理', icon: Smartphone },
      { href: '/files', label: '文件与头像', icon: ImageIcon },
      { href: '/corrections', label: '数据修正中心', icon: Wrench },
    ],
  },
  {
    title: '商业与支持',
    items: [
      { href: '/orders', label: '订单与支付', icon: Receipt },
      { href: '/feedback', label: '反馈与工单', icon: MessageSquareWarning, badge: 'feedback' },
      { href: '/announcements', label: '公告管理', icon: Megaphone },
      { href: '/versions', label: '版本配置', icon: GitBranch },
    ],
  },
  {
    title: '系统',
    items: [
      { href: '/monitor', label: '系统监控', icon: Activity },
      { href: '/backup', label: '备份与恢复', icon: DatabaseBackup },
      { href: '/admins', label: '管理员权限', icon: ShieldCheck },
      { href: '/logs', label: '操作日志', icon: ScrollText },
      { href: '/settings', label: '系统设置', icon: Settings },
    ],
  },
]

export const flatNav = navGroups.flatMap((g) => g.items)
