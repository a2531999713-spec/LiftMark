'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Dumbbell } from 'lucide-react'
import { navGroups } from '@/lib/nav'
import { cn } from '@/lib/utils'
import { dashboardStats } from '@/lib/data'

export function Sidebar() {
  const pathname = usePathname()

  return (
    <aside className="hidden w-60 shrink-0 flex-col bg-sidebar text-sidebar-foreground lg:flex">
      <div className="flex h-14 items-center gap-2.5 px-4">
        <div className="flex size-8 items-center justify-center rounded-md bg-sidebar-primary text-sidebar-primary-foreground">
          <Dumbbell className="size-5" />
        </div>
        <div className="leading-tight">
          <div className="text-sm font-semibold text-white">练刻 LiftMark</div>
          <div className="text-[11px] text-sidebar-foreground/70">管理员控制台</div>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-2.5 pb-6">
        {navGroups.map((group) => (
          <div key={group.title} className="mt-4 first:mt-2">
            <div className="px-2 pb-1.5 text-[11px] font-medium uppercase tracking-wider text-sidebar-foreground/45">
              {group.title}
            </div>
            <ul className="space-y-0.5">
              {group.items.map((item) => {
                const active =
                  item.href === '/'
                    ? pathname === '/'
                    : pathname.startsWith(item.href)
                const Icon = item.icon
                const count =
                  item.badge === 'sync'
                    ? dashboardStats.syncFailed
                    : item.badge === 'feedback'
                      ? dashboardStats.pendingFeedback
                      : 0
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className={cn(
                        'flex items-center gap-2.5 rounded-md px-2 py-1.5 text-[13px] transition-colors',
                        active
                          ? 'bg-sidebar-accent font-medium text-sidebar-accent-foreground'
                          : 'text-sidebar-foreground/80 hover:bg-sidebar-accent/50 hover:text-white',
                      )}
                    >
                      <Icon className="size-4 shrink-0" />
                      <span className="flex-1 truncate">{item.label}</span>
                      {count > 0 && (
                        <span className="rounded bg-sidebar-primary px-1.5 text-[11px] font-semibold text-sidebar-primary-foreground">
                          {count}
                        </span>
                      )}
                    </Link>
                  </li>
                )
              })}
            </ul>
          </div>
        ))}
      </nav>
    </aside>
  )
}
