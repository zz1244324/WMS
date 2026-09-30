import { useMemo, useState } from 'react'
import { Check, ChevronsUpDown, PackageSearch, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/lib/utils'
import { price, qty } from '@/lib/format'
import type { Product } from '@/types'

interface Props {
  products: Product[]
  value: number | null
  onChange: (id: number) => void
  placeholder?: string
  className?: string
}

export function ProductSelect({ products, value, onChange, placeholder = '请选择商品', className }: Props) {
  const [open, setOpen] = useState(false)
  const [kw, setKw] = useState('')

  const selected = products.find((p) => p.id === value) ?? null

  const list = useMemo(() => {
    const k = kw.trim().toLowerCase()
    if (!k) return products
    return products.filter((p) =>
      [p.name, p.sku, p.spec, p.category, p.location]
        .filter(Boolean)
        .some((f) => String(f).toLowerCase().includes(k))
    )
  }, [products, kw])

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn(
            'w-full cursor-pointer justify-between font-normal',
            !selected && 'text-slate-500',
            className
          )}
        >
          <span className="truncate">
            {selected ? `${selected.name}${selected.spec ? ` · ${selected.spec}` : ''}` : placeholder}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[var(--radix-popover-trigger-width)] min-w-[300px] p-0">
        <div className="flex items-center gap-2 border-b border-slate-100 px-3 py-2">
          <Search className="h-4 w-4 shrink-0 text-slate-400" />
          <Input
            autoFocus
            value={kw}
            onChange={(e) => setKw(e.target.value)}
            placeholder="输入名称 / 编号 / 规格搜索"
            className="h-8 border-0 px-0 shadow-none focus-visible:ring-0"
          />
        </div>
        <div className="scrollbar-thin max-h-72 overflow-y-auto py-1">
          {list.length === 0 ? (
            <div className="flex flex-col items-center gap-1 px-4 py-8 text-center">
              <PackageSearch className="h-5 w-5 text-slate-400" />
              <p className="text-xs text-slate-500">没有匹配的商品</p>
            </div>
          ) : (
            list.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => {
                  onChange(p.id)
                  setOpen(false)
                  setKw('')
                }}
                className="flex w-full cursor-pointer items-center gap-2 px-3 py-2 text-left transition-colors duration-150 hover:bg-slate-50"
              >
                <Check
                  className={cn('h-4 w-4 shrink-0 text-blue-600', value === p.id ? 'opacity-100' : 'opacity-0')}
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm text-slate-800">
                    {p.name}
                    {p.spec ? <span className="ml-1.5 text-xs text-slate-400">{p.spec}</span> : null}
                  </span>
                  {p.sku ? <span className="block text-xs text-slate-400">编号 {p.sku}</span> : null}
                </span>
                <span className="tnum shrink-0 text-right text-xs text-slate-500">
                  <span className="block">库存 {qty(p.stock_qty)} {p.unit}</span>
                  <span className="block">均价 {price(p.avg_price)}</span>
                </span>
              </button>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}
