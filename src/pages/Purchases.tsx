import { useCallback, useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { ArrowDownToLine, Info, Pencil, Plus, Search, Trash2 } from 'lucide-react'
import { PageHeader } from '@/components/common/PageHeader'
import { EmptyState } from '@/components/common/EmptyState'
import { ConfirmDialog } from '@/components/common/ConfirmDialog'
import { PurchaseDialog } from '@/components/dialogs/PurchaseDialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { api, errMsg } from '@/lib/api'
import { money, price, qty } from '@/lib/format'
import type { Product, Purchase } from '@/types'

interface Props {
  products: Product[]
  version: number
  onChanged: () => void
}

const ALL = '__all__'

export function Purchases({ products, version, onChanged }: Props) {
  const [rows, setRows] = useState<Purchase[]>([])
  const [loading, setLoading] = useState(true)
  const [keyword, setKeyword] = useState('')
  const [productFilter, setProductFilter] = useState(ALL)

  const [dialogOpen, setDialogOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<Purchase | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Purchase | null>(null)

  const load = useCallback(async () => {
    try {
      setRows(await api.purchases())
    } catch (err) {
      toast.error(errMsg(err))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load, version])

  const list = useMemo(() => {
    const k = keyword.trim().toLowerCase()
    return rows.filter((r) => {
      if (productFilter !== ALL && r.product_id !== Number(productFilter)) return false
      if (!k) return true
      return [r.product_name, r.supplier, r.note]
        .filter(Boolean)
        .some((f) => String(f).toLowerCase().includes(k))
    })
  }, [rows, keyword, productFilter])

  const totals = useMemo(
    () => ({
      count: list.length,
      qty: list.reduce((s, r) => s + Number(r.qty), 0),
      amount: list.reduce((s, r) => s + Number(r.amount ?? r.qty * r.unit_price), 0),
    }),
    [list]
  )

  const doDelete = async () => {
    if (!deleteTarget) return
    try {
      await api.deletePurchase(deleteTarget.id)
      toast.success('入库记录已删除，均价已重新计算')
      setDeleteTarget(null)
      onChanged()
    } catch (err) {
      toast.error(errMsg(err))
    }
  }

  return (
    <div className="space-y-4">
      <PageHeader title="入库记录" description="每一批采购单独记一条，系统按「总金额 ÷ 总数量」自动算加权平均价。">
        <Button
          className="cursor-pointer"
          onClick={() => {
            setEditTarget(null)
            setDialogOpen(true)
          }}
        >
          <Plus className="mr-1.5 h-4 w-4" />
          新增入库
        </Button>
      </PageHeader>

      <div className="flex flex-col gap-2 rounded-lg border border-slate-200 bg-white p-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            placeholder="搜索商品 / 供应商 / 备注"
            className="pl-8"
          />
        </div>
        <Select value={productFilter} onValueChange={setProductFilter}>
          <SelectTrigger className="w-full cursor-pointer sm:w-[220px]">
            <SelectValue placeholder="全部商品" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>全部商品</SelectItem>
            {products.map((p) => (
              <SelectItem key={p.id} value={String(p.id)}>
                {p.name}
                {p.spec ? ` · ${p.spec}` : ''}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        {loading ? (
          <div className="py-16 text-center text-sm text-slate-500">加载中…</div>
        ) : list.length === 0 ? (
          <EmptyState
            icon={ArrowDownToLine}
            title={rows.length === 0 ? '还没有入库记录' : '没有符合条件的记录'}
            description={
              products.length === 0
                ? '请先到「商品档案」新增商品，再回来录入采购记录。'
                : '记录每一批的采购数量和单价，平均价就会自动算出来。'
            }
          >
            {(products.length > 0 && rows.length === 0) || rows.length > 0 ? (
              <Button
                className="cursor-pointer"
                disabled={products.length === 0}
                onClick={() => {
                  setEditTarget(null)
                  setDialogOpen(true)
                }}
              >
                <Plus className="mr-1.5 h-4 w-4" />
                新增入库
              </Button>
            ) : null}
          </EmptyState>
        ) : (
          <>
            <div className="scrollbar-thin overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50/80">
                    <TableHead className="w-[110px]">入库日期</TableHead>
                    <TableHead className="min-w-[200px]">商品</TableHead>
                    <TableHead className="text-right">数量</TableHead>
                    <TableHead className="text-right">单价</TableHead>
                    <TableHead className="text-right">金额</TableHead>
                    <TableHead>供应商</TableHead>
                    <TableHead className="min-w-[140px]">备注</TableHead>
                    <TableHead className="w-[90px] text-right">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {list.map((r) => (
                    <TableRow key={r.id} className="transition-colors duration-150 hover:bg-slate-50/70">
                      <TableCell className="tnum text-slate-600">{r.purchase_date}</TableCell>
                      <TableCell>
                        <p className="truncate font-medium text-slate-800">{r.product_name}</p>
                        <p className="truncate text-xs text-slate-400">
                          {r.spec || '—'}
                          {r.unit ? ` · ${r.unit}` : ''}
                        </p>
                      </TableCell>
                      <TableCell className="tnum text-right text-slate-700">{qty(r.qty)}</TableCell>
                      <TableCell className="tnum text-right text-slate-700">{price(r.unit_price)}</TableCell>
                      <TableCell className="tnum text-right font-medium text-slate-900">{money(r.amount)}</TableCell>
                      <TableCell className="text-slate-600">{r.supplier || '—'}</TableCell>
                      <TableCell className="max-w-[200px] truncate text-slate-500">{r.note || '—'}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-0.5">
                          <Button
                            variant="ghost"
                            size="icon"
                            title="编辑"
                            aria-label="编辑"
                            className="h-8 w-8 cursor-pointer text-slate-500 hover:bg-slate-100 hover:text-slate-900"
                            onClick={() => {
                              setEditTarget(r)
                              setDialogOpen(true)
                            }}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            title="删除"
                            aria-label="删除"
                            className="h-8 w-8 cursor-pointer text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                            onClick={() => setDeleteTarget(r)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <div className="tnum flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 bg-slate-50/60 px-4 py-2.5 text-xs text-slate-600">
              <span>
                共 <span className="font-semibold text-slate-800">{totals.count}</span> 条入库记录
                {list.length !== rows.length ? `（已从 ${rows.length} 条中筛选）` : ''}
              </span>
              <span>
                数量合计 <span className="font-semibold text-slate-800">{qty(totals.qty)}</span>
                <span className="mx-2 text-slate-300">|</span>
                金额合计 <span className="font-semibold text-slate-800">{money(totals.amount)}</span> 元
              </span>
            </div>
          </>
        )}
      </div>

      <p className="flex items-start gap-1.5 text-xs text-slate-400">
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        同一个商品分多次采购、单价不同时，加权平均价会按数量加权，更贴近真实成本；简单平均价则把每批次同等看待。
      </p>

      <PurchaseDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        purchase={editTarget}
        products={products}
        onSaved={onChanged}
      />

      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(v) => !v && setDeleteTarget(null)}
        title="删除这条入库记录？"
        description="删除后该商品的库存数量和加权平均价都会重新计算，操作无法撤销。"
        confirmText="确认删除"
        onConfirm={doDelete}
      />
    </div>
  )
}
