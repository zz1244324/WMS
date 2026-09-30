/**
 * Excel 导入 / 导出（SheetJS）
 */
import XLSX from 'xlsx'
import { db, q } from './db.js'

/* ------------------------------------------------------------------ */
/* 通用小工具                                                          */
/* ------------------------------------------------------------------ */

const pad = (n) => String(n).padStart(2, '0')

export function toDateString(value) {
  if (value === null || value === undefined || value === '') return today()

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    // 8 位纯数字视作 yyyymmdd
    const s = String(Math.trunc(value))
    if (s.length === 8) return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`
    // 否则视作 Excel 日期序列号
    const ms = Math.round((value - 25569) * 86400 * 1000)
    const d = new Date(ms)
    if (!Number.isNaN(d.getTime())) {
      return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`
    }
    return today()
  }

  const str = String(value).trim()
  const m = str.match(/^(\d{4})\D{0,2}(\d{1,2})\D{0,2}(\d{1,2})/)
  if (m) return `${m[1]}-${pad(m[2])}-${pad(m[3])}`
  const d = new Date(str)
  if (!Number.isNaN(d.getTime())) {
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
  }
  return today()
}

export function today() {
  const d = new Date()
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

const num = (v, fallback = 0) => {
  if (v === null || v === undefined || v === '') return fallback
  const n = Number(String(v).replace(/[^\d.\-]/g, ''))
  return Number.isFinite(n) ? n : fallback
}

const str = (v) => (v === null || v === undefined ? '' : String(v).trim())

/* ------------------------------------------------------------------ */
/* 导出                                                                */
/* ------------------------------------------------------------------ */

export function buildWorkbook() {
  const wb = XLSX.utils.book_new()

  const products = q.all('SELECT * FROM product_stats ORDER BY category, name')
  const purchases = q.all(`
    SELECT pu.purchase_date, p.name, p.sku, p.spec, p.unit,
           pu.qty, pu.unit_price, (pu.qty * pu.unit_price) AS amount,
           pu.supplier, pu.note
    FROM purchases pu JOIN products p ON p.id = pu.product_id
    ORDER BY pu.purchase_date DESC, pu.id DESC`)
  const outbounds = q.all(`
    SELECT ob.outbound_date, p.name, p.sku, p.spec, p.unit,
           ob.qty, ob.recipient, ob.note
    FROM outbounds ob JOIN products p ON p.id = ob.product_id
    ORDER BY ob.outbound_date DESC, ob.id DESC`)

  const sheetProducts = XLSX.utils.json_to_sheet(
    products.map((p) => ({
      名称: p.name,
      编号: p.sku,
      分类: p.category,
      规格型号: p.spec,
      单位: p.unit,
      存放位置: p.location,
      当前库存: p.stock_qty,
      加权平均价: round2(p.avg_price),
      简单平均价: round2(p.simple_avg_price),
      最低采购价: round2(p.min_price),
      最高采购价: round2(p.max_price),
      库存金额: round2(p.stock_value),
      累计入库数量: p.purchased_qty,
      累计采购金额: round2(p.purchased_amount),
      累计出库数量: p.outbound_qty,
      采购批次数: p.batch_count,
      预警值: p.min_stock,
      最近入库日期: p.last_purchase_date ?? '',
      备注: p.note,
    })),
    { header: ['名称', '编号', '分类', '规格型号', '单位', '存放位置', '当前库存', '加权平均价', '简单平均价', '最低采购价', '最高采购价', '库存金额', '累计入库数量', '累计采购金额', '累计出库数量', '采购批次数', '预警值', '最近入库日期', '备注'] }
  )

  const sheetPurchases = XLSX.utils.json_to_sheet(
    purchases.map((r) => ({
      商品名称: r.name,
      编号: r.sku,
      规格型号: r.spec,
      入库日期: r.purchase_date,
      数量: r.qty,
      单价: round2(r.unit_price),
      金额: round2(r.amount),
      单位: r.unit,
      供应商: r.supplier,
      备注: r.note,
    })),
    { header: ['商品名称', '编号', '规格型号', '入库日期', '数量', '单价', '金额', '单位', '供应商', '备注'] }
  )

  const sheetOutbounds = XLSX.utils.json_to_sheet(
    outbounds.map((r) => ({
      商品名称: r.name,
      编号: r.sku,
      规格型号: r.spec,
      出库日期: r.outbound_date,
      数量: r.qty,
      单位: r.unit,
      领用人: r.recipient,
      备注: r.note,
    })),
    { header: ['商品名称', '编号', '规格型号', '出库日期', '数量', '单位', '领用人', '备注'] }
  )

  XLSX.utils.book_append_sheet(wb, sheetProducts, '商品汇总')
  XLSX.utils.book_append_sheet(wb, sheetPurchases, '入库明细')
  XLSX.utils.book_append_sheet(wb, sheetOutbounds, '出库明细')

  for (const ws of [sheetProducts, sheetPurchases, sheetOutbounds]) {
    ws['!cols'] = Array.from({ length: 20 }, () => ({ wch: 14 }))
  }
  return wb
}

export function workbookToBuffer(wb) {
  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })
}

function round2(n) {
  return Math.round((Number(n) || 0) * 100) / 100
}

/** 空白导入模板：只保留表头 + 一行示例，导入前把示例行删掉即可 */
export function buildTemplate() {
  const wb = XLSX.utils.book_new()

  const exampleProducts = [
    { 名称: '螺丝刀', 编号: 'A-001', 分类: '工具', 规格型号: '十字 6x150', 单位: '把', 存放位置: 'A区-1排-2层', 预警值: 5, 备注: '' },
    { 名称: 'A4打印纸', 编号: 'B-001', 分类: '办公用品', 规格型号: '70g 500张', 单位: '包', 存放位置: 'B区-3层', 预警值: 10, 备注: '' },
  ]
  const examplePurchases = [
    { 商品名称: '螺丝刀', 编号: 'A-001', 入库日期: today(), 数量: 10, 单价: 12.5, 供应商: '五金城', 备注: '' },
    { 商品名称: 'A4打印纸', 编号: 'B-001', 入库日期: today(), 数量: 20, 单价: 18.8, 供应商: '办公超市', 备注: '' },
  ]
  const exampleOutbounds = [
    { 商品名称: '螺丝刀', 编号: 'A-001', 出库日期: today(), 数量: 2, 领用人: '张三', 备注: '日常维修' },
  ]

  const wsP = XLSX.utils.json_to_sheet(exampleProducts, {
    header: ['名称', '编号', '分类', '规格型号', '单位', '存放位置', '预警值', '备注'],
  })
  const wsI = XLSX.utils.json_to_sheet(examplePurchases, {
    header: ['商品名称', '编号', '规格型号', '入库日期', '数量', '单价', '供应商', '备注'],
  })
  const wsO = XLSX.utils.json_to_sheet(exampleOutbounds, {
    header: ['商品名称', '编号', '出库日期', '数量', '领用人', '备注'],
  })

  for (const ws of [wsP, wsI, wsO]) {
    ws['!cols'] = Array.from({ length: 10 }, () => ({ wch: 14 }))
  }

  XLSX.utils.book_append_sheet(wb, wsP, '商品档案')
  XLSX.utils.book_append_sheet(wb, wsI, '入库明细')
  XLSX.utils.book_append_sheet(wb, wsO, '出库明细')
  return wb
}

/* ------------------------------------------------------------------ */
/* 导入                                                                */
/* ------------------------------------------------------------------ */

const SHEET_ALIASES = {
  products: ['商品档案', '商品汇总', '商品', '商品列表', 'products'],
  purchases: ['入库明细', '采购入库', '入库记录', '入库', 'purchases'],
  outbounds: ['出库明细', '出库记录', '出库', 'outbounds'],
}

function pickSheet(wb, aliases) {
  for (const name of wb.SheetNames) {
    if (aliases.includes(name.trim())) return wb.Sheets[name]
  }
  return null
}

function sheetRows(ws) {
  if (!ws) return []
  return XLSX.utils.sheet_to_json(ws, { defval: '' })
}

function pick(row, keys) {
  for (const k of keys) {
    if (row[k] !== undefined && row[k] !== '') return row[k]
  }
  return ''
}

/** 找到或创建商品，返回 id */
function findOrCreateProduct({ name, sku, spec, unit, category, location, minStock, note }, stats) {
  if (!name) return null
  let row = null
  if (sku) row = q.get('SELECT id FROM products WHERE sku = ?', sku)
  if (!row && name) row = q.get('SELECT id FROM products WHERE name = ?', name)
  if (row) {
    // 只补充空白字段，不覆盖已有数据
    const cur = q.get('SELECT * FROM products WHERE id = ?', row.id)
    q.run(
      `UPDATE products SET sku = ?, spec = ?, unit = ?, category = ?, location = ?, min_stock = ?, note = ? WHERE id = ?`,
      cur.sku || sku,
      cur.spec || spec,
      cur.unit || unit || '个',
      cur.category || category,
      cur.location || location,
      cur.min_stock || minStock,
      cur.note || note,
      row.id
    )
    stats.productsMatched++
    return row.id
  }
  const res = q.run(
    `INSERT INTO products (name, sku, spec, unit, category, location, min_stock, note)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    name, sku, spec, unit || '个', category, location, minStock, note
  )
  stats.productsCreated++
  return Number(res.lastInsertRowid)
}

export function importWorkbook(buffer) {
  const wb = XLSX.read(buffer, { type: 'buffer', cellDates: true })
  const stats = {
    productsCreated: 0,
    productsMatched: 0,
    purchasesAdded: 0,
    outboundsAdded: 0,
    skipped: 0,
    errors: [],
    sheets: wb.SheetNames,
  }

  const wsProducts = pickSheet(wb, SHEET_ALIASES.products)
  const wsPurchases = pickSheet(wb, SHEET_ALIASES.purchases)
  const wsOutbounds = pickSheet(wb, SHEET_ALIASES.outbounds)

  if (!wsProducts && !wsPurchases && !wsOutbounds) {
    stats.errors.push(`没有识别到可导入的工作表。文件中的工作表为：${wb.SheetNames.join('、')}`)
    return stats
  }

  // 1) 商品档案
  for (const row of sheetRows(wsProducts)) {
    const name = str(pick(row, ['名称', '商品名称', '品名', 'name']))
    if (!name) {
      stats.skipped++
      continue
    }
    findOrCreateProduct(
      {
        name,
        sku: str(pick(row, ['编号', '商品编号', 'sku'])),
        spec: str(pick(row, ['规格型号', '规格', '型号', 'spec'])),
        unit: str(pick(row, ['单位', 'unit'])),
        category: str(pick(row, ['分类', '类别', 'category'])),
        location: str(pick(row, ['存放位置', '库位', '位置', 'location'])),
        minStock: num(pick(row, ['预警值', '库存预警', '最低库存', 'min_stock']), 0),
        note: str(pick(row, ['备注', 'note'])),
      },
      stats
    )
  }

  // 2) 入库明细
  for (const row of sheetRows(wsPurchases)) {
    const name = str(pick(row, ['商品名称', '名称', '品名']))
    const qty = num(pick(row, ['数量', '入库数量']))
    const unitPrice = num(pick(row, ['单价', '采购单价', '价格']))
    if (!name || qty <= 0) {
      stats.skipped++
      continue
    }
    const productId = findOrCreateProduct(
      {
        name,
        sku: str(pick(row, ['编号', '商品编号'])),
        spec: str(pick(row, ['规格型号', '规格', '型号'])),
        unit: '',
        category: '',
        location: '',
        minStock: 0,
        note: '',
      },
      stats
    )
    q.run(
      `INSERT INTO purchases (product_id, purchase_date, qty, unit_price, supplier, note)
       VALUES (?, ?, ?, ?, ?, ?)`,
      productId,
      toDateString(pick(row, ['入库日期', '日期', '采购日期'])),
      qty,
      unitPrice,
      str(pick(row, ['供应商', '商家', '供货商'])),
      str(pick(row, ['备注', '说明']))
    )
    stats.purchasesAdded++
  }

  // 3) 出库明细
  for (const row of sheetRows(wsOutbounds)) {
    const name = str(pick(row, ['商品名称', '名称', '品名']))
    const qty = num(pick(row, ['数量', '出库数量']))
    if (!name || qty <= 0) {
      stats.skipped++
      continue
    }
    const productId = findOrCreateProduct(
      { name, sku: str(pick(row, ['编号', '商品编号'])), spec: '', unit: '', category: '', location: '', minStock: 0, note: '' },
      stats
    )
    q.run(
      `INSERT INTO outbounds (product_id, outbound_date, qty, recipient, note)
       VALUES (?, ?, ?, ?, ?)`,
      productId,
      toDateString(pick(row, ['出库日期', '日期'])),
      qty,
      str(pick(row, ['领用人', '领用', '去向', '接收人'])),
      str(pick(row, ['备注', '说明']))
    )
    stats.outboundsAdded++
  }

  return stats
}
