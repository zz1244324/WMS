import type { ReactNode } from 'react'
import { Boxes } from 'lucide-react'
import { cn } from '@/lib/utils'
import { NAV_ITEMS, type PageKey } from '@/lib/nav'

interface Props {
  page: PageKey
  onNavigate: (page: PageKey) => void
  badges?: Partial<Record<PageKey, number>>
  children: ReactNode
}

export function Layout({ page, onNavigate, badges, children }: Props) {
  return (
    <div className="min-h-screen bg-slate-50">
      {/* 桌面侧边栏 */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[232px] flex-col border-r border-slate-200 bg-white lg:flex">
        <div className="flex h-14 items-center gap-2 border-b border-slate-200 px-4">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-blue-800 text-white">
            <Boxes className="h-5 w-5" />
          </div>
          <div className="leading-tight">
            <p className="text-sm font-semibold text-slate-900">仓管家</p>
            <p className="text-[11px] text-slate-500">本地仓库管理 · 单机运行</p>
          </div>
        </div>

        <nav className="flex-1 space-y-1 p-2">
          {NAV_ITEMS.map((item) => {
            const active = page === item.key
            const count = badges?.[item.key]
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => onNavigate(item.key)}
                className={cn(
                  'flex w-full cursor-pointer items-center gap-3 rounded-md px-3 py-2 text-left text-sm transition-colors duration-200',
                  active
                    ? 'bg-blue-50 font-medium text-blue-800'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                )}
              >
                <item.icon className="h-4 w-4 shrink-0" />
                <span className="flex-1 truncate">{item.label}</span>
                {count ? (
                  <span className="tnum rounded-full bg-amber-100 px-1.5 py-0.5 text-[11px] font-medium text-amber-700">
                    {count}
                  </span>
                ) : null}
              </button>
            )
          })}
        </nav>

        <div className="border-t border-slate-200 p-3 text-[11px] leading-relaxed text-slate-400">
          数据保存在本机
          <br />
          <span className="text-slate-500">仓管家 · StockKeeper v1.0</span>
        </div>
      </aside>

      {/* 移动端顶栏 */}
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white lg:hidden">
        <div className="flex h-12 items-center gap-2 px-4">
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-blue-800 text-white">
            <Boxes className="h-4 w-4" />
          </div>
          <p className="text-sm font-semibold text-slate-900">仓管家</p>
        </div>
        <div className="scrollbar-thin flex gap-1 overflow-x-auto px-3 pb-2">
          {NAV_ITEMS.map((item) => {
            const active = page === item.key
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => onNavigate(item.key)}
                className={cn(
                  'shrink-0 cursor-pointer whitespace-nowrap rounded-md px-3 py-1.5 text-xs transition-colors duration-200',
                  active ? 'bg-blue-50 font-medium text-blue-800' : 'text-slate-600 hover:bg-slate-50'
                )}
              >
                {item.label}
              </button>
            )
          })}
        </div>
      </header>

      <main className="lg:pl-[232px]">
        <div className="mx-auto max-w-[1400px] px-4 py-6 sm:px-6 lg:px-8">{children}</div>
      </main>
    </div>
  )
}
