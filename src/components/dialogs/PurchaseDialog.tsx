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
import { money, price, qty, todayStr } from '@/lib/format'
import type { Product, Purchase, PurchaseForm } from '@/types'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  purchase: Purchase | null
  products: Product[]
  presetProductId?: number | null
  onSaved: () => void
}

export function PurchaseDialog({ open, onOpenChange, purchase, products, presetProductId, onSaved }: Props) {
  const [form, setForm] = useState<PurchaseForm>({
    product_id: 0,
    purchase_date: todayStr(),
    qty: 1,
    unit_price: 0,
    supplier: '',
    note: '',
  })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    setForm(
      purchase
        ? {
            product_id: purchase.product_id,
            purchase_date: purchase.purchase_date,
            qty: purchase.qty,
            unit_price: purchase.unit_price,
            supplier: purchase.supplier ?? '',
            note: purchase.note ?? '',
          }
        : {
            product_id: presetProductId ?? 0,
            purchase_date: todayStr(),
            qty: 1,
            unit_price: 0,
            supplier: '',
            note: '',
          }
    )
  }, [open, purchase, presetProductId])

  const set = <K extends keyof PurchaseForm>(key: K, value: PurchaseForm[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }))

  const selected = useMemo(() => products.find((p) => p.id === form.product_id) ?? null, [products, form.product_id])
  const amount = (Number(form.qty) || 0) * (Number(form.unit_price) || 0)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!form.product_id) {
      toast.error('请选择商品')
      return
    }
    if (!(Number(form.qty) > 0)) {
      toast.error('入库数量必须大于 0')
      return
    }
    setSaving(true)
    try {
      if (purchase) {
        await api.updatePurchase(purchase.id, form)
        toast.success('入库记录已更新，均价已重新计算')
      } else {
        await api.createPurchase(form)
        toast.success('入库成功，均价已重新计算')
      }
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
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{purchase ? '编辑入库记录' : '新增入库记录'}</DialogTitle>
          <DialogDescription>
            同一个商品可以分多次、按不同单价入库，系统会自动按「总金额 ÷ 总数量」算出加权平均价。
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
          <Field label="商品" required className="sm:col-span-2">
            <ProductSelect products={products} value={form.product_id || null} onChange={(id) => set('product_id', id)} />
          </Field>

          {selected ? (
            <div className="tnum sm:col-span-2 rounded-md border border-blue-100 bg-blue-50/60 px-3 py-2 text-xs text-slate-600">
              当前库存 <span className="font-semibold text-slate-800">{qty(selected.stock_qty)} {selected.unit}</span>
              <span className="mx-2 text-slate-300">|</span>
              加权均价 <span className="font-semibold text-slate-800">{price(selected.avg_price)}</span>
              <span className="mx-2 text-slate-300">|</span>
              简单均价 <span className="font-semibold text-slate-800">{price(selected.simple_avg_price)}</span>
              <span className="mx-2 text-slate-300">|</span>
              已入库 {selected.batch_count} 批
            </div>
          ) : null}

          <Field label="入库日期" required>
            <Input
              type="date"
              value={form.purchase_date}
              onChange={(e) => set('purchase_date', e.target.value)}
            />
          </Field>

          <Field label="供应商 / 商家">
            <Input value={form.supplier} onChange={(e) => set('supplier', e.target.value)} placeholder="选填" />
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

          <Field label="单价" required hint="含税或实际支付单价，按你记账的口径填即可">
            <Input
              type="number"
              min={0}
              step="any"
              value={form.unit_price}
              onChange={(e) => set('unit_price', Number(e.target.value))}
            />
          </Field>

          <div className="tnum sm:col-span-2 flex items-center justify-between rounded-md bg-slate-50 px-3 py-2 text-sm">
            <span className="text-slate-500">本次入库金额</span>
            <span className="font-semibold text-slate-900">{money(amount)} 元</span>
          </div>

          <Field label="备注" className="sm:col-span-2">
            <Textarea rows={2} value={form.note} onChange={(e) => set('note', e.target.value)} placeholder="选填" />
          </Field>

          <DialogFooter className="sm:col-span-2">
            <Button type="button" variant="outline" className="cursor-pointer" onClick={() => onOpenChange(false)}>
              取消
            </Button>
            <Button type="submit" className="cursor-pointer" disabled={saving}>
              {saving ? <Spinner className="mr-1.5 h-4 w-4" /> : null}
              {purchase ? '保存修改' : '确认入库'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
