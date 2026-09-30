import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import {
  AlertTriangle,
  ArrowDownToLine,
  ArrowUpFromLine,
  Banknote,
  Layers,
  PackageSearch,
  Scale,
} from 'lucide-react'
import { PageHeader } from '@/components/common/PageHeader'
import { StatCard } from '@/components/common/StatCard'
import { EmptyState } from '@/components/common/EmptyState'
import { Spinner } from '@/components/ui/spinner'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { api, errMsg } from '@/lib/api'
import { compact, money, price, qty } from '@/lib/format'
import type { DashboardData } from '@/types'
import type { PageKey } from '@/lib/nav'

interface Props {
  onNavigate: (page: PageKey) => void
  version: number
}

export function Dashboard({ onNavigate, version }: Props) {
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    try {
      setData(await api.dashboard())
    } catch (err) {
      toast.error(errMsg(err))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load, version])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 text-slate-400">
        <Spinner className="h-6 w-6" />
      </div>
    )
  }

  if (!data) {
    return <EmptyState icon={PackageSearch} title="没有读取到数据" description="请确认后端服务是否正常运行。" />
  }

  const { totals, lowStock, byCategory, topByValue, recent } = data
  const isEmpty = totals.product_count === 0

  return (
    <div className="space-y-6">
      <PageHeader title="库存概览" description="所有金额按「加权平均价」计算，即 总金额 ÷ 总数量。">
        <Button className="cursor-pointer" onClick={() => onNavigate('purchases')}>
          <ArrowDownToLine className="mr-1.5 h-4 w-4" />
          快速入库
        </Button>
      </PageHeader>

      {isEmpty ? (
        <div className="rounded-lg border border-slate-200 bg-white">
          <EmptyState
            icon={PackageSearch}
            title="仓库里还没有商品"
            description="你可以先到「商品档案」手动新增，也可以到「数据管理」一键载入示例数据或导入自己的 Excel。"
          >
            <div className="flex flex-wrap justify-center gap-2">
              <Button className="cursor-pointer" onClick={() => onNavigate('products')}>
                去新增商品
              </Button>
              <Button variant="outline" className="cursor-pointer" onClick={() => onNavigate('data')}>
                载入示例数据
              </Button>
            </div>
          </EmptyState>
        </div>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
              label="商品种类"
              value={qty(totals.product_count)}
              sub={`入库 ${totals.purchase_count} 条 · 出库 ${totals.outbound_count} 条`}
              icon={Layers}
            />
            <StatCard
              label="库存总数量"
              value={qty(totals.stock_qty)}
              sub={`累计入库 ${qty(totals.purchased_qty)} · 累计出库 ${qty(totals.outbound_qty)}`}
              icon={Scale}
            />
            <StatCard
              label="库存总金额"
              value={money(totals.stock_value)}
              sub={`累计采购支出 ${compact(totals.purchase_amount)} 元`}
              icon={Banknote}
            />
            <StatCard
              label="低库存预警"
              value={qty(totals.low_stock_count)}
              sub={totals.low_stock_count > 0 ? '建议尽快补货' : '所有商品库存充足'}
              icon={AlertTriangle}
              tone={totals.low_stock_count > 0 ? 'danger' : 'success'}
            />
          </div>

          <div className="grid gap-4 xl:grid-cols-3">
            {/* 低库存预警 */}
            <section className="rounded-lg border border-slate-200 bg-white xl:col-span-2">
              <header className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-amber-600" />
                  <h2 className="text-sm font-semibold text-slate-800">低库存预警</h2>
                </div>
                <Badge variant="secondary" className="font-normal">
                  {lowStock.length} 项
                </Badge>
              </header>
              {lowStock.length === 0 ? (
                <EmptyState
                  icon={AlertTriangle}
                  title="暂无预警"
                  description="给商品设置「库存预警值」后，库存不足时会在这里提醒你。"
                />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>商品</TableHead>
                      <TableHead>位置</TableHead>
                      <TableHead className="text-right">当前库存</TableHead>
                      <TableHead className="text-right">预警值</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {lowStock.slice(0, 8).map((item) => (
                      <TableRow key={item.id}>
                        <TableCell>
                          <span className="font-medium text-slate-800">{item.name}</span>
                          {item.spec ? <span className="ml-1.5 text-xs text-slate-400">{item.spec}</span> : null}
                        </TableCell>
                        <TableCell className="text-slate-500">{item.location || '—'}</TableCell>
                        <TableCell className="tnum text-right font-semibold text-rose-600">
                          {qty(item.stock_qty)} {item.unit}
                        </TableCell>
                        <TableCell className="tnum text-right text-slate-500">{qty(item.min_stock)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </section>

            {/* 最近动态 */}
            <section className="rounded-lg border border-slate-200 bg-white">
              <header className="border-b border-slate-100 px-4 py-3">
                <h2 className="text-sm font-semibold text-slate-800">最近出入库</h2>
              </header>
              {recent.length === 0 ? (
                <EmptyState icon={ArrowDownToLine} title="还没有出入库记录" />
              ) : (
                <ul className="divide-y divide-slate-100">
                  {recent.map((item) => (
                    <li key={`${item.type}-${item.id}`} className="flex items-start gap-3 px-4 py-2.5">
                      <span
                        className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${
                          item.type === 'in' ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-500'
                        }`}
                      >
                        {item.type === 'in' ? (
                          <ArrowDownToLine className="h-3.5 w-3.5" />
                        ) : (
                          <ArrowUpFromLine className="h-3.5 w-3.5" />
                        )}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm text-slate-800">{item.product_name}</p>
                        <p className="text-xs text-slate-400">
                          {item.date}
                          {item.party ? ` · ${item.party}` : ''}
                        </p>
                      </div>
                      <div className="tnum shrink-0 text-right text-xs">
                        <p className={item.type === 'in' ? 'text-emerald-600' : 'text-slate-600'}>
                          {item.type === 'in' ? '+' : '−'}
                          {qty(item.qty)} {item.unit}
                        </p>
                        {item.amount ? <p className="text-slate-400">{money(item.amount)}</p> : null}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            {/* 分类分布 */}
            <section className="rounded-lg border border-slate-200 bg-white p-4">
              <h2 className="mb-3 text-sm font-semibold text-slate-800">分类库存金额</h2>
              <BarList
                rows={byCategory.map((c) => ({
                  key: c.category,
                  label: c.category,
                  value: c.stock_value,
                  extra: `${c.product_count} 种`,
                }))}
              />
            </section>

            {/* 金额 TOP */}
            <section className="rounded-lg border border-slate-200 bg-white p-4">
              <h2 className="mb-3 text-sm font-semibold text-slate-800">占用金额最多的商品</h2>
              <BarList
                rows={topByValue.map((p) => ({
                  key: String(p.id),
                  label: p.name,
                  value: p.stock_value,
                  extra: `${qty(p.stock_qty)} ${p.unit} × ${price(p.avg_price)}`,
                }))}
              />
            </section>
          </div>
        </>
      )}
    </div>
  )
}

interface BarRow {
  key: string
  label: string
  value: number
  extra?: string
}

function BarList({ rows }: { rows: BarRow[] }) {
  if (rows.length === 0) {
    return <p className="py-8 text-center text-sm text-slate-500">暂无数据</p>
  }
  const max = Math.max(...rows.map((r) => r.value), 0)

  return (
    <ul className="space-y-3">
      {rows.map((row) => {
        const pct = max > 0 ? Math.max(2, (row.value / max) * 100) : 0
        return (
          <li key={row.key}>
            <div className="mb-1 flex items-baseline justify-between gap-3 text-sm">
              <span className="truncate text-slate-700">{row.label}</span>
              <span className="tnum shrink-0 text-slate-500">
                <span className="font-medium text-slate-800">{money(row.value)}</span>
                {row.extra ? <span className="ml-2 text-xs text-slate-400">{row.extra}</span> : null}
              </span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
              <div className="h-full rounded-full bg-blue-700/80" style={{ width: `${pct}%` }} />
            </div>
          </li>
        )
      })}
    </ul>
  )
}
