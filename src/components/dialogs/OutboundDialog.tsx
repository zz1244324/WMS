import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Field } from '@/components/common/Field'
import { ProductSelect } from '@/components/common/ProductSelect'
import { Spinner } from '@/components/ui/spinner'
import { api, errMsg } from '@/lib/api'
import { price, qty, todayStr } from '@/lib/format'
import type { Outbound, OutboundForm, Product } from '@/types'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  outbound: Outbound | null
  products: Product[]
  presetProductId?: number | null
  onSaved: () => void
}

export function OutboundDialog({ open, onOpenChange, outbound, products, presetProductId, onSaved }: Props) {
  const [form, setForm] = useState<OutboundForm>({
    product_id: 0,
    outbound_date: todayStr(),
    qty: 1,
    recipient: '',
    note: '',
  })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    setForm(
      outbound
        ? {
            product_id: outbound.product_id,
            outbound_date: outbound.outbound_date,
            qty: outbound.qty,
            recipient: outbound.recipient ?? '',
            note: outbound.note ?? '',
          }
        : { product_id: presetProductId ?? 0, outbound_date: todayStr(), qty: 1, recipient: '', note: '' }
    )
  }, [open, outbound, presetProductId])

  const set = <K extends keyof OutboundForm>(key: K, value: OutboundForm[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }))

  const selected = useMemo(() => products.find((p) => p.id === form.product_id) ?? null, [products, form.product_id])
  const overStock = selected ? Number(form.qty) > selected.stock_qty : false

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!form.product_id) {
      toast.error('请选择商品')
      return
    }
    if (!(Number(form.qty) > 0)) {
      toast.error('出库数量必须大于 0')
      return
    }
    setSaving(true)
    try {
      const res = outbound ? await api.updateOutbound(outbound.id, form) : await api.createOutbound(form)
      toast.success('出库已记录')
      if (res.warning) toast.warning(res.warning)
      onOpenChange(false)
      onSaved()
    } catch (err) {
      toast.error(errMsg(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>{outbound ? '编辑出库记录' : '新增出库记录'}</DialogTitle>
          <DialogDescription>出库会从当前库存中扣减，不影响历史采购的加权平均价。</DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} className="grid gap-4">
          <Field label="商品" required>
            <ProductSelect products={products} value={form.product_id || null} onChange={(id) => set('product_id', id)} />
          </Field>

          {selected ? (
            <div className="tnum rounded-md border border-blue-100 bg-blue-50/60 px-3 py-2 text-xs text-slate-600">
              当前库存 <span className="font-semibold text-slate-800">{qty(selected.stock_qty)} {selected.unit}</span>
              <span className="mx-2 text-slate-300">|</span>
              加权均价 <span className="font-semibold text-slate-800">{price(selected.avg_price)}</span>
              {overStock ? (
                <span className="ml-2 text-rose-600">出库数量超过当前库存，记录后库存会变成负数</span>
              ) : null}
            </div>
          ) : null}

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="出库日期" required>
              <Input
                type="date"
                value={form.outbound_date}
                onChange={(e) => set('outbound_date', e.target.value)}
              />
            </Field>

            <Field label="数量" required>
              <Input
                type="number"
                min={0}
                step="any"
                value={form.qty}
                onChange={(e) => set('qty', Number(e.target.value))}
              />
            </Field>
          </div>

          <Field label="领用人 / 去向">
            <Input value={form.recipient} onChange={(e) => set('recipient', e.target.value)} placeholder="选填，例如：张三 / 生产车间" />
          </Field>

          <Field label="备注">
            <Textarea rows={2} value={form.note} onChange={(e) => set('note', e.target.value)} placeholder="选填" />
          </Field>

          <DialogFooter>
            <Button type="button" variant="outline" className="cursor-pointer" onClick={() => onOpenChange(false)}>
              取消
            </Button>
            <Button type="submit" className="cursor-pointer" disabled={saving}>
              {saving ? <Spinner className="mr-1.5 h-4 w-4" /> : null}
              {outbound ? '保存修改' : '确认出库'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
