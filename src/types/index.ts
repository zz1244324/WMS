/** 商品（含统计字段，来自后端 product_stats 视图） */
export interface Product {
  id: number
  name: string
  sku: string
  category: string
  spec: string
  unit: string
  location: string
  min_stock: number
  note: string
  created_at: string
  /** 采购批次数 */
  batch_count: number
  /** 累计入库数量 */
  purchased_qty: number
  /** 累计采购金额 */
  purchased_amount: number
  /** 简单平均价：各批次单价直接平均 */
  simple_avg_price: number
  min_price: number
  max_price: number
  last_purchase_date: string | null
  /** 加权平均价：总金额 / 总数量 */
  avg_price: number
  /** 累计出库数量 */
  outbound_qty: number
  /** 当前库存 */
  stock_qty: number
  /** 库存金额 = 当前库存 × 加权平均价 */
  stock_value: number
}

export interface Purchase {
  id: number
  product_id: number
  purchase_date: string
  qty: number
  unit_price: number
  supplier: string
  note: string
  created_at: string
  amount: number
  product_name?: string
  sku?: string
  spec?: string
  unit?: string
}

export interface Outbound {
  id: number
  product_id: number
  outbound_date: string
  qty: number
  recipient: string
  note: string
  created_at: string
  product_name?: string
  sku?: string
  spec?: string
  unit?: string
}

export interface Meta {
  categories: string[]
  units: string[]
  locations: string[]
  today: string
  dbFile: string
  dataDir: string
  packaged: boolean
}

export interface DashboardTotals {
  product_count: number
  purchase_count: number
  outbound_count: number
  purchase_amount: number
  stock_qty: number
  purchased_qty: number
  outbound_qty: number
  stock_value: number
  low_stock_count: number
}

export interface LowStockItem {
  id: number
  name: string
  sku: string
  spec: string
  unit: string
  location: string
  stock_qty: number
  min_stock: number
}

export interface CategoryStat {
  category: string
  product_count: number
  stock_value: number
  stock_qty: number
}

export interface TopValueItem {
  id: number
  name: string
  spec: string
  unit: string
  stock_qty: number
  avg_price: number
  stock_value: number
}

export interface RecentItem {
  type: 'in' | 'out'
  id: number
  date: string
  qty: number
  unit_price: number | null
  amount: number | null
  product_name: string
  unit: string
  party: string
}

export interface DashboardData {
  totals: DashboardTotals
  lowStock: LowStockItem[]
  byCategory: CategoryStat[]
  topByValue: TopValueItem[]
  recent: RecentItem[]
}

export interface ImportResult {
  productsCreated: number
  productsMatched: number
  purchasesAdded: number
  outboundsAdded: number
  skipped: number
  errors: string[]
  sheets: string[]
}

export type ProductForm = {
  name: string
  sku: string
  category: string
  spec: string
  unit: string
  location: string
  min_stock: number
  note: string
}

export type PurchaseForm = {
  product_id: number
  purchase_date: string
  qty: number
  unit_price: number
  supplier: string
  note: string
}

export type OutboundForm = {
  product_id: number
  outbound_date: string
  qty: number
  recipient: string
  note: string
}
