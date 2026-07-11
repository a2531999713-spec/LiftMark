import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const badgeVariants = cva(
  'inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-xs font-medium whitespace-nowrap',
  {
    variants: {
      variant: {
        default: 'border-transparent bg-secondary text-secondary-foreground',
        primary: 'border-primary/20 bg-primary/10 text-primary',
        success: 'border-success/25 bg-success/12 text-success',
        warning: 'border-warning/40 bg-warning/20 text-warning-foreground',
        danger: 'border-destructive/25 bg-destructive/12 text-destructive',
        info: 'border-info/25 bg-info/12 text-info',
        outline: 'border-border bg-transparent text-muted-foreground',
      },
    },
    defaultVariants: { variant: 'default' },
  },
)

function Badge({
  className,
  variant,
  ...props
}: React.ComponentProps<'span'> & VariantProps<typeof badgeVariants>) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />
}

export { Badge, badgeVariants }
