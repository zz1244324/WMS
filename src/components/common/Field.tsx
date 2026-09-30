import type { ReactNode } from 'react'
import { Label } from '@/components/ui/label'

interface Props {
  label: string
  required?: boolean
  hint?: ReactNode
  className?: string
  children: ReactNode
}

export function Field({ label, required, hint, className, children }: Props) {
  return (
    <div className={className}>
      <Label className="mb-1.5 block text-xs font-medium text-slate-600">
        {label}
        {required ? <span className="ml-0.5 text-rose-500">*</span> : null}
      </Label>
      {children}
      {hint ? <p className="mt-1 text-xs text-slate-400">{hint}</p> : null}
    </div>
  )
}
