import { cn } from '@/lib/utils'

export function Avatar({ name, className }: { name: string; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-medium text-primary',
        className,
      )}
      aria-hidden
    >
      {name.slice(0, 1)}
    </span>
  )
}
