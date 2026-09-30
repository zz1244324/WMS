import { useEffect, useState, type FormEvent } from 'react'
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
import { Spinner } from '@/components/ui/spinner'
import { api, errMsg } from '@/lib/api'
import type { Meta, Product, ProductForm } from '@/types'

const emptyForm: ProductForm = {
  name: '',
  sku: '',
  category: '',
  spec: '',
  unit: '个',
  location: '',
  min_stock: 0,
  note: '',
}

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  product: Product | null
  meta: Meta | null
  onSaved: () => void
}

export function ProductDialog({ open, onOpenChange, product, meta, onSaved }: Props) {
  const [form, setForm] = useState<ProductForm>(emptyForm)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    setForm(
      product
        ? {
            name: product.name ?? '',
            sku: product.sku ?? '',
            category: product.category ?? '',
            spec: product.spec ?? '',
            unit: product.unit || '个',
            location: product.location ?? '',
            min_stock: product.min_stock ?? 0,
            note: product.note ?? '',
          }
        : emptyForm
    )
  }, [open, product])

  const set = <K extends keyof ProductForm>(key: K, value: ProductForm[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }))

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!form.name.trim()) {
      toast.error('请填写商品名称')
      return
    }
    setSaving(true)
    try {
      if (product) {
        await api.updateProduct(product.id, form)
        toast.success(`「${form.name}」已更新`)
      } else {
        await api.createProduct(form)
        toast.success(`「${form.name}」已添加`)
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
          <DialogTitle>{product ? '编辑商品' : '新增商品'}</DialogTitle>
          <DialogDescription>
            商品档案只记录基本信息，价格和库存由下面的「入库记录」自动统计。
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
          <Field label="商品名称" required className="sm:col-span-2">
            <Input
              autoFocus
              value={form.name}
              onChange={(e) => set('name', e.target.value)}
              placeholder="例如：硒鼓 CF218A"
            />
          </Field>

          <Field label="商品编号" hint="选填，用来和 Excel 里的编号对应">
            <Input value={form.sku} onChange={(e) => set('sku', e.target.value)} placeholder="例如：P-1001" />
          </Field>

          <Field label="分类">
            <Input
              list="product-category-options"
              value={form.category}
              onChange={(e) => set('category', e.target.value)}
              placeholder="例如：办公耗材"
            />
            <datalist id="product-category-options">
              {(meta?.categories ?? []).map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </Field>

          <Field label="规格型号">
            <Input value={form.spec} onChange={(e) => set('spec', e.target.value)} placeholder="例如：70g / 500张" />
          </Field>

          <Field label="单位">
            <Input
              list="product-unit-options"
              value={form.unit}
              onChange={(e) => set('unit', e.target.value)}
              placeholder="个 / 包 / 箱"
            />
            <datalist id="product-unit-options">
              {['个', '件', '包', '箱', '盒', '套', '把', '卷', '千克', '米', ...(meta?.units ?? [])]
                .filter((v, i, a) => a.indexOf(v) === i)
                .map((u) => (
                  <option key={u} value={u} />
                ))}
            </datalist>
          </Field>

          <Field label="存放位置">
            <Input
              list="product-location-options"
              value={form.location}
              onChange={(e) => set('location', e.target.value)}
              placeholder="例如：A区-1排-2层"
            />
            <datalist id="product-location-options">
              {(meta?.locations ?? []).map((l) => (
                <option key={l} value={l} />
              ))}
            </datalist>
          </Field>

          <Field label="库存预警值" hint="当前库存 ≤ 该值时会在概览页提醒，填 0 表示不提醒">
            <Input
              type="number"
              min={0}
              step="any"
              value={form.min_stock}
              onChange={(e) => set('min_stock', Number(e.target.value))}
            />
          </Field>

          <Field label="备注" className="sm:col-span-2">
            <Textarea rows={2} value={form.note} onChange={(e) => set('note', e.target.value)} placeholder="选填" />
          </Field>

          <DialogFooter className="sm:col-span-2">
            <Button type="button" variant="outline" className="cursor-pointer" onClick={() => onOpenChange(false)}>
              取消
            </Button>
            <Button type="submit" className="cursor-pointer" disabled={saving}>
              {saving ? <Spinner className="mr-1.5 h-4 w-4" /> : null}
              {product ? '保存修改' : '确认添加'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
