import { useMemo, useState, type ReactNode } from 'react'
import { toast } from 'sonner'
import {
  ArrowDownToLine,
  Eye,
  MapPin,
  Package,
  PackageSearch,
  Pencil,
  Plus,
  Search,
  Trash2,
  TriangleAlert,
} from 'lucide-react'
import { PageHeader } from '@/components/common/PageHeader'
import { EmptyState } from '@/components/common/EmptyState'
import { ConfirmDialog } from '@/components/common/ConfirmDialog'
import { ProductDialog } from '@/components/dialogs/ProductDialog'
import { ProductDetailDialog } from '@/components/dialogs/ProductDetailDialog'
import { PurchaseDialog } from '@/components/dialogs/PurchaseDialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { api, errMsg } from '@/lib/api'
import { money, price, qty } from '@/lib/format'
import type { Meta, Product } from '@/types'

interface Props {
  products: Product[]
  meta: Meta | null
  loading: boolean
  onChanged: () => void
}

const ALL = '__all__'

export function Products({ products, meta, loading, onChanged }: Props) {
  const [keyword, setKeyword] = useState('')
  const [category, setCategory] = useState(ALL)
  const [onlyLow, setOnlyLow] = useState(false)

  const [editTarget, setEditTarget] = useState<Product | null>(null)
  const [productDialogOpen, setProductDialogOpen] = useState(false)
  const [detailId, setDetailId] = useState<number | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Product | null>(null)
  const [purchaseTarget, setPurchaseTarget] = useState<number | null>(null)

  const list = useMemo(() => {
    const k = keyword.trim().toLowerCase()
    return products.filter((p) => {
      if (category !== ALL && p.category !== category) return false
      if (onlyLow && !(p.min_stock > 0 && p.stock_qty <= p.min_stock)) return false
      if (!k) return true
      return [p.name, p.sku, p.spec, p.category, p.location]
        .filter(Boolean)
        .some((f) => String(f).toLowerCase().includes(k))
    })
  }, [products, keyword, category, onlyLow])

  const totals = useMemo(
    () => ({
      kinds: list.length,
      qty: list.reduce((s, p) => s + Number(p.stock_qty), 0),
      value: list.reduce((s, p) => s + Number(p.stock_value), 0),
    }),
    [list]
  )

  const openCreate = () => {
    setEditTarget(null)
    setProductDialogOpen(true)
  }

  const openEdit = (p: Product) => {
    setEditTarget(p)
    setProductDialogOpen(true)
  }

  const doDelete = async () => {
    if (!deleteTarget) return
    try {
      await api.deleteProduct(deleteTarget.id)
      toast.success(`「${deleteTarget.name}」及其出入库记录已删除`)
      setDeleteTarget(null)
      onChanged()
    } catch (err) {
      toast.error(errMsg(err))
    }
  }

  return (
    <div className="space-y-4">
      <PageHeader title="商品档案" description="库存与平均价由入库记录自动统计，不在这里手改。">
        <Button className="cursor-pointer" onClick={openCreate}>
          <Plus className="mr-1.5 h-4 w-4" />
          新增商品
        </Button>
      </PageHeader>

      <div className="flex flex-col gap-2 rounded-lg border border-slate-200 bg-white p-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            placeholder="搜索名称 / 编号 / 规格 / 位置"
            className="pl-8"
          />
        </div>
        <Select value={category} onValueChange={setCategory}>
          <SelectTrigger className="w-full cursor-pointer sm:w-[180px]">
            <SelectValue placeholder="全部分类" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>全部分类</SelectItem>
            {(meta?.categories ?? []).map((c) => (
              <SelectItem key={c} value={c}>
                {c}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          type="button"
          variant={onlyLow ? 'default' : 'outline'}
          className="cursor-pointer whitespace-nowrap"
          onClick={() => setOnlyLow((v) => !v)}
        >
          <TriangleAlert className="mr-1.5 h-4 w-4" />
          仅看预警
        </Button>
      </div>

      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        {loading ? (
          <div className="py-16 text-center text-sm text-slate-500">加载中…</div>
        ) : list.length === 0 ? (
          <EmptyState
            icon={PackageSearch}
            title={products.length === 0 ? '还没有商品' : '没有符合条件的商品'}
            description={
              products.length === 0
                ? '新增商品后，再到「入库记录」录入你的每一批采购价格，系统会自动算平均价。'
                : '换个关键词或清空筛选条件试试。'
            }
          >
            {products.length === 0 ? (
              <Button className="cursor-pointer" onClick={openCreate}>
                <Plus className="mr-1.5 h-4 w-4" />
                新增第一个商品
              </Button>
            ) : null}
          </EmptyState>
        ) : (
          <>
            <div className="scrollbar-thin overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50/80">
                    <TableHead className="min-w-[200px]">商品</TableHead>
                    <TableHead>分类</TableHead>
                    <TableHead>存放位置</TableHead>
                    <TableHead className="text-right">当前库存</TableHead>
                    <TableHead className="text-right">
                      <span className="inline-flex items-center gap-1">
                        平均价
                        <span className="text-[11px] font-normal text-slate-400">加权 / 简单</span>
                      </span>
                    </TableHead>
                    <TableHead className="text-right">库存金额</TableHead>
                    <TableHead className="w-[150px] text-right">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {list.map((p) => {
                    const low = p.min_stock > 0 && p.stock_qty <= p.min_stock
                    return (
                      <TableRow key={p.id} className="transition-colors duration-150 hover:bg-slate-50/70">
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-slate-100 text-slate-500">
                              <Package className="h-3.5 w-3.5" />
                            </span>
                            <div className="min-w-0">
                              <p className="truncate font-medium text-slate-800">{p.name}</p>
                              <p className="truncate text-xs text-slate-400">
                                {p.sku ? `编号 ${p.sku}` : ''}
                                {p.sku && p.spec ? ' · ' : ''}
                                {p.spec}
                                {!p.sku && !p.spec ? `入库 ${p.batch_count} 批` : ''}
                              </p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          {p.category ? (
                            <Badge variant="secondary" className="font-normal">
                              {p.category}
                            </Badge>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-slate-500">
                          {p.location ? (
                            <span className="inline-flex items-center gap-1">
                              <MapPin className="h-3.5 w-3.5 text-slate-400" />
                              {p.location}
                            </span>
                          ) : (
                            '—'
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <span className={`tnum font-semibold ${low ? 'text-rose-600' : 'text-slate-800'}`}>
                            {qty(p.stock_qty)}
                          </span>
                          <span className="ml-1 text-xs text-slate-400">{p.unit}</span>
                          {low ? (
                            <Badge variant="destructive" className="ml-1.5 px-1.5 py-0 text-[11px] font-normal">
                              低
                            </Badge>
                          ) : null}
                        </TableCell>
                        <TableCell className="text-right">
                          <p className="tnum font-medium text-slate-900">{price(p.avg_price)}</p>
                          <p className="tnum text-xs text-slate-400">简单 {price(p.simple_avg_price)}</p>
                        </TableCell>
                        <TableCell className="tnum text-right font-medium text-slate-800">
                          {money(p.stock_value)}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-0.5">
                            <IconButton title="查看明细" onClick={() => setDetailId(p.id)}>
                              <Eye className="h-4 w-4" />
                            </IconButton>
                            <IconButton title="为它入库" onClick={() => setPurchaseTarget(p.id)}>
                              <ArrowDownToLine className="h-4 w-4" />
                            </IconButton>
                            <IconButton title="编辑" onClick={() => openEdit(p)}>
                              <Pencil className="h-4 w-4" />
                            </IconButton>
                            <IconButton title="删除" danger onClick={() => setDeleteTarget(p)}>
                              <Trash2 className="h-4 w-4" />
                            </IconButton>
                          </div>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
            <div className="tnum flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 bg-slate-50/60 px-4 py-2.5 text-xs text-slate-600">
              <span>
                共 <span className="font-semibold text-slate-800">{totals.kinds}</span> 种商品
                {list.length !== products.length ? `（已从 ${products.length} 种中筛选）` : ''}
              </span>
              <span>
                库存合计 <span className="font-semibold text-slate-800">{qty(totals.qty)}</span>
                <span className="mx-2 text-slate-300">|</span>
                金额合计 <span className="font-semibold text-slate-800">{money(totals.value)}</span> 元
              </span>
            </div>
          </>
        )}
      </div>

      <ProductDialog
        open={productDialogOpen}
        onOpenChange={setProductDialogOpen}
        product={editTarget}
        meta={meta}
        onSaved={onChanged}
      />

      <ProductDetailDialog open={detailId !== null} onOpenChange={(v) => !v && setDetailId(null)} productId={detailId} />

      <PurchaseDialog
        open={purchaseTarget !== null}
        onOpenChange={(v) => !v && setPurchaseTarget(null)}
        purchase={null}
        products={products}
        presetProductId={purchaseTarget}
        onSaved={onChanged}
      />

      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(v) => !v && setDeleteTarget(null)}
        title={`删除「${deleteTarget?.name ?? ''}」？`}
        description="该商品的所有入库、出库记录都会一起删除，且无法恢复。如果只是暂时不用了，建议保留档案。"
        confirmText="确认删除"
        onConfirm={doDelete}
      />
    </div>
  )
}

function IconButton({
  title,
  onClick,
  danger,
  children,
}: {
  title: string
  onClick: () => void
  danger?: boolean
  children: ReactNode
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      title={title}
      aria-label={title}
      onClick={onClick}
      className={`h-8 w-8 cursor-pointer ${danger ? 'text-slate-400 hover:bg-rose-50 hover:text-rose-600' : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900'}`}
    >
      {children}
    </Button>
  )
}
