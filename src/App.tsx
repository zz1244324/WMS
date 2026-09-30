import { useCallback, useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { Layout } from '@/components/Layout'
import { Toaster } from '@/components/ui/sonner'
import { Spinner } from '@/components/ui/spinner'
import { Dashboard } from '@/pages/Dashboard'
import { Products } from '@/pages/Products'
import { Purchases } from '@/pages/Purchases'
import { Outbounds } from '@/pages/Outbounds'
import { DataCenter } from '@/pages/DataCenter'
import { api, errMsg } from '@/lib/api'
import type { PageKey } from '@/lib/nav'
import type { Meta, Product } from '@/types'

export default function App() {
  const [page, setPage] = useState<PageKey>('dashboard')
  const [meta, setMeta] = useState<Meta | null>(null)
  const [products, setProducts] = useState<Product[]>([])
  const [version, setVersion] = useState(0)
  const [booting, setBooting] = useState(true)

  /** 重新拉取基础数据，并让各页面通过 version 变化刷新自己的列表 */
  const refresh = useCallback(async () => {
    try {
      const [m, p] = await Promise.all([api.meta(), api.products()])
      setMeta(m)
      setProducts(p)
      setVersion((v) => v + 1)
    } catch (err) {
      toast.error(`无法连接后端服务：${errMsg(err)}`)
    } finally {
      setBooting(false)
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const lowStockCount = useMemo(
    () => products.filter((p) => p.min_stock > 0 && p.stock_qty <= p.min_stock).length,
    [products]
  )

  if (booting) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-slate-50 text-slate-500">
        <Spinner className="h-6 w-6" />
        <p className="text-sm">正在连接本地数据…</p>
      </div>
    )
  }

  return (
    <>
      <Layout page={page} onNavigate={setPage} badges={{ products: lowStockCount }}>
        {page === 'dashboard' ? <Dashboard onNavigate={setPage} version={version} /> : null}
        {page === 'products' ? (
          <Products products={products} meta={meta} loading={false} onChanged={refresh} />
        ) : null}
        {page === 'purchases' ? (
          <Purchases products={products} version={version} onChanged={refresh} />
        ) : null}
        {page === 'outbounds' ? (
          <Outbounds products={products} version={version} onChanged={refresh} />
        ) : null}
        {page === 'data' ? (
          <DataCenter meta={meta} hasData={products.length > 0} onChanged={refresh} />
        ) : null}
      </Layout>
      <Toaster richColors closeButton position="top-center" />
    </>
  )
}
