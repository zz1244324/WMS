import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Info } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Spinner } from '@/components/ui/spinner'
import { EmptyState } from '@/components/common/EmptyState'
import { api, errMsg } from '@/lib/api'
import { money, price, qty } from '@/lib/format'
import type { Outbound, Product, Purchase } from '@/types'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  productId: number | null
}

export function ProductDetailDialog({ open, onOpenChange, productId }: Props) {
  const [loading, setLoading] = useState(false)
  const [product, setProduct] = useState<Product | null>(null)
  const [purchases, setPurchases] = useState<Purchase[]>([])
  const [outbounds, setOutbounds] = useState<Outbound[]>([])

  const load = useCallback(async () => {
    if (!productId) return
    setLoading(true)
    try {
      const res = await api.product(productId)
      setProduct(res.product)
      setPurchases(res.purchases)
      setOutbounds(res.outbounds)
    } catch (err) {
      toast.error(errMsg(err))
    } finally {
      setLoading(false)
    }
  }, [productId])

  useEffect(() => {
    if (open) void load()
    else {
      setProduct(null)
      setPurchases([])
      setOutbounds([])
    }
  }, [open, load])

  const totalQty = purchases.reduce((s, p) => s + Number(p.qty), 0)
  const totalAmount = purchases.reduce((s, p) => s + Number(p.amount ?? p.qty * p.unit_price), 0)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[88vh] max-w-4xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex flex-wrap items-center gap-2">
            {product?.name ?? '商品详情'}
            {product?.sku ? (
              <Badge variant="secondary" className="font-normal">
                {product.sku}
              </Badge>
            ) : null}
          </DialogTitle>
          <DialogDescription>
            {product
              ? [product.category, product.spec, product.location].filter(Boolean).join(' · ') || '暂无补充信息'
              : '加载中…'}
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-16 text-slate-400">
            <Spinner className="h-6 w-6" />
          </div>
        ) : !product ? (
          <EmptyState icon={Info} title="没有读取到该商品" />
        ) : (
          <div className="space-y-5">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Stat label="当前库存" value={`${qty(product.stock_qty)} ${product.unit}`} accent />
              <Stat label="加权平均价" value={price(product.avg_price)} hint="总金额 ÷ 总数量" />
              <Stat label="简单平均价" value={price(product.simple_avg_price)} hint="各批次单价直接平均" />
              <Stat label="库存金额" value={money(product.stock_value)} hint="库存 × 加权均价" />
            </div>

            <div className="rounded-md border border-blue-100 bg-blue-50/60 px-3 py-2 text-xs leading-relaxed text-slate-600">
              共 <span className="tnum font-semibold text-slate-800">{purchases.length}</span> 个采购批次，累计入库{' '}
              <span className="tnum font-semibold text-slate-800">{qty(totalQty)} {product.unit}</span>，累计采购金额{' '}
              <span className="tnum font-semibold text-slate-800">{money(totalAmount)} 元</span>；采购价区间{' '}
              <span className="tnum font-semibold text-slate-800">{price(product.min_price)}</span> ~{' '}
              <span className="tnum font-semibold text-slate-800">{price(product.max_price)}</span>。
            </div>

            <section>
              <h3 className="mb-2 text-sm font-semibold text-slate-800">入库批次明细</h3>
              <div className="rounded-md border border-slate-200">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>日期</TableHead>
                      <TableHead className="text-right">数量</TableHead>
                      <TableHead className="text-right">单价</TableHead>
                      <TableHead className="text-right">金额</TableHead>
                      <TableHead>供应商</TableHead>
                      <TableHead>备注</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {purchases.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="py-8 text-center text-sm text-slate-500">
                          还没有入库记录
                        </TableCell>
                      </TableRow>
                    ) : (
                      purchases.map((p) => (
                        <TableRow key={p.id}>
                          <TableCell className="tnum">{p.purchase_date}</TableCell>
                          <TableCell className="tnum text-right">{qty(p.qty)}</TableCell>
                          <TableCell className="tnum text-right">{price(p.unit_price)}</TableCell>
                          <TableCell className="tnum text-right font-medium">{money(p.amount)}</TableCell>
                          <TableCell className="text-slate-600">{p.supplier || '—'}</TableCell>
                          <TableCell className="max-w-[180px] truncate text-slate-500">{p.note || '—'}</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </section>

            <section>
              <h3 className="mb-2 text-sm font-semibold text-slate-800">出库记录</h3>
              <div className="rounded-md border border-slate-200">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>日期</TableHead>
                      <TableHead className="text-right">数量</TableHead>
                      <TableHead>领用人</TableHead>
                      <TableHead>备注</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {outbounds.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={4} className="py-8 text-center text-sm text-slate-500">
                          还没有出库记录
                        </TableCell>
                      </TableRow>
                    ) : (
                      outbounds.map((o) => (
                        <TableRow key={o.id}>
                          <TableCell className="tnum">{o.outbound_date}</TableCell>
                          <TableCell className="tnum text-right">{qty(o.qty)}</TableCell>
                          <TableCell className="text-slate-600">{o.recipient || '—'}</TableCell>
                          <TableCell className="max-w-[220px] truncate text-slate-500">{o.note || '—'}</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </section>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

function Stat({
  label,
  value,
  hint,
  accent,
}: {
  label: string
  value: string
  hint?: string
  accent?: boolean
}) {
  return (
    <div className="rounded-md border border-slate-200 bg-white px-3 py-2">
      <p className="text-xs text-slate-500">{label}</p>
      <p className={`tnum mt-1 text-base font-semibold ${accent ? 'text-blue-700' : 'text-slate-900'}`}>{value}</p>
      {hint ? <p className="mt-0.5 text-[11px] text-slate-400">{hint}</p> : null}
    </div>
  )
}
