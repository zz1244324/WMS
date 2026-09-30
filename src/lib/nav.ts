import { ArrowDownToLine, ArrowUpFromLine, Database, LayoutDashboard, Package } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

export type PageKey = 'dashboard' | 'products' | 'purchases' | 'outbounds' | 'data'

export interface NavItem {
  key: PageKey
  label: string
  description: string
  icon: LucideIcon
}

export const NAV_ITEMS: NavItem[] = [
  { key: 'dashboard', label: '库存概览', description: '库存总额、均价与预警', icon: LayoutDashboard },
  { key: 'products', label: '商品档案', description: '商品的增删改查与均价', icon: Package },
  { key: 'purchases', label: '入库记录', description: '不同单价的分批采购', icon: ArrowDownToLine },
  { key: 'outbounds', label: '出库记录', description: '领用与库存扣减', icon: ArrowUpFromLine },
  { key: 'data', label: '数据管理', description: 'Excel 导入导出与备份', icon: Database },
]
