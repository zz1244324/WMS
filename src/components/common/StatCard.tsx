import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

type Tone = 'primary' | 'success' | 'warning' | 'danger'

const toneMap: Record<Tone, { icon: string; value: string }> = {
  primary: { icon: 'bg-blue-50 text-blue-700', value: 'text-slate-900' },
  success: { icon: 'bg-emerald-50 text-emerald-700', value: 'text-emerald-700' },
  warning: { icon: 'bg-amber-50 text-amber-700', value: 'text-amber-700' },
  danger: { icon: 'bg-rose-50 text-rose-700', value: 'text-rose-700' },
}

interface Props {
  label: string
  value: string
  sub?: string
  icon: LucideIcon
  tone?: Tone
}

export function StatCard({ label, value, sub, icon: Icon, tone = 'primary' }: Props) {
  const t = toneMap[tone]
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm transition-colors duration-200 hover:border-slate-300">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
          <p className={cn('tnum mt-2 text-2xl font-semibold leading-none', t.value)}>{value}</p>
          {sub ? <p className="mt-2 text-xs text-slate-500">{sub}</p> : null}
        </div>
        <div className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-md', t.icon)}>
          <Icon className="h-5 w-5" strokeWidth={2} />
        </div>
      </div>
    </div>
  )
}
