/**
 * 仓管家 —— 后端应用工厂
 *  - 全部 REST API（/api/*）
 *  - 静态资源：assets 为内存中的前端资源（打包成 exe 时），否则读 dist 目录
 */
import express from 'express'
import multer from 'multer'
import fs from 'node:fs'
import path from 'node:path'
import { db, q, DB_FILE, DATA_DIR, IS_PACKAGED } from './db.js'
import { openFolder } from './launch.js'
import { logError } from './logger.js'
import { buildWorkbook, workbookToBuffer, buildTemplate, importWorkbook, toDateString, today } from './excel.js'

/* ---------------------------------------------------------------- */
/* 工具                                                              */
/* ---------------------------------------------------------------- */

const s = (v, fallback = '') => (v === null || v === undefined ? fallback : String(v).trim())
const n = (v, fallback = 0) => {
  if (v === null || v === undefined || v === '') return fallback
  const x = Number(v)
  return Number.isFinite(x) ? x : fallback
}
const fail = (res, code, msg) => res.status(code).json({ error: msg })

const wrap = (fn) => (req, res) => {
  try {
    fn(req, res)
  } catch (err) {
    logError(err)
    fail(res, 500, err?.message || '服务器内部错误')
  }
}

/** 前端打包产物在源码运行时的位置 */
function defaultDistDir() {
  try {
    return path.resolve(__dirname, '..', 'dist')
  } catch {
    return null
  }
}

/** 把内存里的资源做成静态中间件（exe 模式） */
function embeddedStatic(assets) {
  const send = (res, entry) => {
    res.setHeader('Content-Type', entry.type)
    res.setHeader('Cache-Control', 'public, max-age=3600')
    res.end(Buffer.from(entry.data, 'base64'))
  }
  return (req, res, next) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') return next()
    const rel = decodeURIComponent(req.path.replace(/^\/+/, ''))
    if (rel.startsWith('api/')) return next()
    const hit = rel && assets[rel]
    if (hit) return send(res, hit)
    const index = assets['index.html']
    if (!index) return next()
    return send(res, index)
  }
}

/* ---------------------------------------------------------------- */
/* 应用                                                              */
/* ---------------------------------------------------------------- */

export function createApp({ assets = null, distDir = null } = {}) {
  const app = express()
  app.use(express.json({ limit: '5mb' }))

  const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } })

  /* ---------------------------- 基础信息 ---------------------------- */

  app.get('/api/meta', wrap((_req, res) => {
    const collect = (col) =>
      q.all(`SELECT DISTINCT ${col} AS v FROM products WHERE ${col} IS NOT NULL AND ${col} <> '' ORDER BY ${col}`)
        .map((r) => r.v)
    res.json({
      categories: collect('category'),
      units: collect('unit'),
      locations: collect('location'),
      today: today(),
      dbFile: DB_FILE,
      dataDir: DATA_DIR,
      packaged: IS_PACKAGED,
    })
  }))

  /* ------------------------------ 商品 ------------------------------ */

  app.get('/api/products', wrap((req, res) => {
    const { keyword = '', category = '', lowStock } = req.query
    let sql = 'SELECT * FROM product_stats WHERE 1 = 1'
    const params = []

    if (s(keyword)) {
      sql += ' AND (name LIKE ? OR sku LIKE ? OR spec LIKE ? OR location LIKE ?)'
      const k = `%${s(keyword)}%`
      params.push(k, k, k, k)
    }
    if (s(category)) {
      sql += ' AND category = ?'
      params.push(s(category))
    }
    if (lowStock === '1') {
      sql += ' AND min_stock > 0 AND stock_qty <= min_stock'
    }
    sql += ' ORDER BY id DESC'
    res.json(q.all(sql, ...params))
  }))

  app.get('/api/products/:id', wrap((req, res) => {
    const id = n(req.params.id, -1)
    const product = q.get('SELECT * FROM product_stats WHERE id = ?', id)
    if (!product) return fail(res, 404, '商品不存在')
    const purchases = q.all(
      'SELECT *, (qty * unit_price) AS amount FROM purchases WHERE product_id = ? ORDER BY purchase_date DESC, id DESC',
      id
    )
    const outbounds = q.all(
      'SELECT * FROM outbounds WHERE product_id = ? ORDER BY outbound_date DESC, id DESC',
      id
    )
    res.json({ product, purchases, outbounds })
  }))

  app.post('/api/products', wrap((req, res) => {
    const b = req.body || {}
    const name = s(b.name)
    if (!name) return fail(res, 400, '商品名称不能为空')
    const dup = q.get('SELECT id FROM products WHERE name = ?', name)
    if (dup) return fail(res, 400, `已存在同名商品「${name}」`)

    const r = q.run(
      `INSERT INTO products (name, sku, category, spec, unit, location, min_stock, note)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      name, s(b.sku), s(b.category), s(b.spec), s(b.unit, '个'), s(b.location), n(b.min_stock, 0), s(b.note)
    )
    res.json(q.get('SELECT * FROM product_stats WHERE id = ?', Number(r.lastInsertRowid)))
  }))

  app.put('/api/products/:id', wrap((req, res) => {
    const id = n(req.params.id, -1)
    const cur = q.get('SELECT * FROM products WHERE id = ?', id)
    if (!cur) return fail(res, 404, '商品不存在')
    const b = req.body || {}
    const name = s(b.name, cur.name)
    if (!name) return fail(res, 400, '商品名称不能为空')
    const dup = q.get('SELECT id FROM products WHERE name = ? AND id <> ?', name, id)
    if (dup) return fail(res, 400, `已存在同名商品「${name}」`)

    q.run(
      `UPDATE products SET name = ?, sku = ?, category = ?, spec = ?, unit = ?, location = ?, min_stock = ?, note = ?
       WHERE id = ?`,
      name, s(b.sku), s(b.category), s(b.spec), s(b.unit, '个'), s(b.location), n(b.min_stock, 0), s(b.note), id
    )
    res.json(q.get('SELECT * FROM product_stats WHERE id = ?', id))
  }))

  app.delete('/api/products/:id', wrap((req, res) => {
    const id = n(req.params.id, -1)
    const cur = q.get('SELECT * FROM products WHERE id = ?', id)
    if (!cur) return fail(res, 404, '商品不存在')
    q.run('DELETE FROM products WHERE id = ?', id)
    res.json({ ok: true })
  }))

  /* -------------------------- 入库（采购批次） -------------------------- */

  app.get('/api/purchases', wrap((req, res) => {
    const { productId, keyword = '' } = req.query
    let sql = `
      SELECT pu.*, p.name AS product_name, p.sku, p.spec, p.unit,
             (pu.qty * pu.unit_price) AS amount
      FROM purchases pu JOIN products p ON p.id = pu.product_id
      WHERE 1 = 1`
    const params = []
    if (s(productId)) {
      sql += ' AND pu.product_id = ?'
      params.push(n(productId, 0))
    }
    if (s(keyword)) {
      sql += ' AND (p.name LIKE ? OR pu.supplier LIKE ? OR pu.note LIKE ?)'
      const k = `%${s(keyword)}%`
      params.push(k, k, k)
    }
    sql += ' ORDER BY pu.purchase_date DESC, pu.id DESC'
    res.json(q.all(sql, ...params))
  }))

  app.post('/api/purchases', wrap((req, res) => {
    const b = req.body || {}
    const productId = n(b.product_id, 0)
    const qty = n(b.qty, 0)
    const unitPrice = n(b.unit_price, NaN)
    if (!q.get('SELECT id FROM products WHERE id = ?', productId)) return fail(res, 400, '请选择商品')
    if (qty <= 0) return fail(res, 400, '入库数量必须大于 0')
    if (!Number.isFinite(unitPrice) || unitPrice < 0) return fail(res, 400, '请输入有效的单价')

    const r = q.run(
      `INSERT INTO purchases (product_id, purchase_date, qty, unit_price, supplier, note)
       VALUES (?, ?, ?, ?, ?, ?)`,
      productId, toDateString(b.purchase_date), qty, unitPrice, s(b.supplier), s(b.note)
    )
    res.json(q.get('SELECT *, (qty * unit_price) AS amount FROM purchases WHERE id = ?', Number(r.lastInsertRowid)))
  }))

  app.put('/api/purchases/:id', wrap((req, res) => {
    const id = n(req.params.id, -1)
    const cur = q.get('SELECT * FROM purchases WHERE id = ?', id)
    if (!cur) return fail(res, 404, '入库记录不存在')
    const b = req.body || {}
    const productId = n(b.product_id, cur.product_id)
    const qty = n(b.qty, cur.qty)
    const unitPrice = n(b.unit_price, cur.unit_price)
    if (!q.get('SELECT id FROM products WHERE id = ?', productId)) return fail(res, 400, '请选择商品')
    if (qty <= 0) return fail(res, 400, '入库数量必须大于 0')
    if (unitPrice < 0) return fail(res, 400, '单价不能为负数')

    q.run(
      `UPDATE purchases SET product_id = ?, purchase_date = ?, qty = ?, unit_price = ?, supplier = ?, note = ?
       WHERE id = ?`,
      productId, toDateString(b.purchase_date ?? cur.purchase_date), qty, unitPrice, s(b.supplier), s(b.note), id
    )
    res.json(q.get('SELECT *, (qty * unit_price) AS amount FROM purchases WHERE id = ?', id))
  }))

  app.delete('/api/purchases/:id', wrap((req, res) => {
    const id = n(req.params.id, -1)
    if (!q.get('SELECT id FROM purchases WHERE id = ?', id)) return fail(res, 404, '入库记录不存在')
    q.run('DELETE FROM purchases WHERE id = ?', id)
    res.json({ ok: true })
  }))

  /* ------------------------------ 出库 ------------------------------ */

  const currentStock = (productId) => {
    const row = q.get('SELECT stock_qty FROM product_stats WHERE id = ?', productId)
    return row ? row.stock_qty : 0
  }

  app.get('/api/outbounds', wrap((req, res) => {
    const { productId, keyword = '' } = req.query
    let sql = `
      SELECT ob.*, p.name AS product_name, p.sku, p.spec, p.unit
      FROM outbounds ob JOIN products p ON p.id = ob.product_id
      WHERE 1 = 1`
    const params = []
    if (s(productId)) {
      sql += ' AND ob.product_id = ?'
      params.push(n(productId, 0))
    }
    if (s(keyword)) {
      sql += ' AND (p.name LIKE ? OR ob.recipient LIKE ? OR ob.note LIKE ?)'
      const k = `%${s(keyword)}%`
      params.push(k, k, k)
    }
    sql += ' ORDER BY ob.outbound_date DESC, ob.id DESC'
    res.json(q.all(sql, ...params))
  }))

  app.post('/api/outbounds', wrap((req, res) => {
    const b = req.body || {}
    const productId = n(b.product_id, 0)
    const qty = n(b.qty, 0)
    if (!q.get('SELECT id FROM products WHERE id = ?', productId)) return fail(res, 400, '请选择商品')
    if (qty <= 0) return fail(res, 400, '出库数量必须大于 0')

    const r = q.run(
      `INSERT INTO outbounds (product_id, outbound_date, qty, recipient, note) VALUES (?, ?, ?, ?, ?)`,
      productId, toDateString(b.outbound_date), qty, s(b.recipient), s(b.note)
    )
    const stock = currentStock(productId)
    res.json({
      row: q.get('SELECT * FROM outbounds WHERE id = ?', Number(r.lastInsertRowid)),
      stock,
      warning: stock < 0 ? '注意：该商品库存已为负数，请检查入库记录是否遗漏' : null,
    })
  }))

  app.put('/api/outbounds/:id', wrap((req, res) => {
    const id = n(req.params.id, -1)
    const cur = q.get('SELECT * FROM outbounds WHERE id = ?', id)
    if (!cur) return fail(res, 404, '出库记录不存在')
    const b = req.body || {}
    const productId = n(b.product_id, cur.product_id)
    const qty = n(b.qty, cur.qty)
    if (!q.get('SELECT id FROM products WHERE id = ?', productId)) return fail(res, 400, '请选择商品')
    if (qty <= 0) return fail(res, 400, '出库数量必须大于 0')

    q.run(
      `UPDATE outbounds SET product_id = ?, outbound_date = ?, qty = ?, recipient = ?, note = ? WHERE id = ?`,
      productId, toDateString(b.outbound_date ?? cur.outbound_date), qty, s(b.recipient), s(b.note), id
    )
    const stock = currentStock(productId)
    res.json({
      row: q.get('SELECT * FROM outbounds WHERE id = ?', id),
      stock,
      warning: stock < 0 ? '注意：该商品库存已为负数' : null,
    })
  }))

  app.delete('/api/outbounds/:id', wrap((req, res) => {
    const id = n(req.params.id, -1)
    if (!q.get('SELECT id FROM outbounds WHERE id = ?', id)) return fail(res, 404, '出库记录不存在')
    q.run('DELETE FROM outbounds WHERE id = ?', id)
    res.json({ ok: true })
  }))

  /* ------------------------------ 概览 ------------------------------ */

  app.get('/api/dashboard', wrap((_req, res) => {
    const totals = q.get(`
      SELECT
        (SELECT COUNT(*) FROM products)                                AS product_count,
        (SELECT COUNT(*) FROM purchases)                               AS purchase_count,
        (SELECT COUNT(*) FROM outbounds)                               AS outbound_count,
        COALESCE((SELECT SUM(qty * unit_price) FROM purchases), 0)     AS purchase_amount,
        COALESCE((SELECT SUM(stock_qty) FROM product_stats), 0)        AS stock_qty,
        COALESCE((SELECT SUM(purchased_qty) FROM product_stats), 0)    AS purchased_qty,
        COALESCE((SELECT SUM(outbound_qty) FROM product_stats), 0)     AS outbound_qty,
        COALESCE((SELECT SUM(stock_value) FROM product_stats), 0)      AS stock_value,
        (SELECT COUNT(*) FROM product_stats WHERE min_stock > 0 AND stock_qty <= min_stock) AS low_stock_count
    `)

    const lowStock = q.all(
      `SELECT id, name, sku, spec, unit, location, stock_qty, min_stock
       FROM product_stats WHERE min_stock > 0 AND stock_qty <= min_stock
       ORDER BY (stock_qty - min_stock) ASC LIMIT 50`
    )

    const byCategory = q.all(`
      SELECT CASE WHEN category IS NULL OR category = '' THEN '未分类' ELSE category END AS category,
             COUNT(*) AS product_count,
             COALESCE(SUM(stock_value), 0) AS stock_value,
             COALESCE(SUM(stock_qty), 0)   AS stock_qty
      FROM product_stats GROUP BY 1 ORDER BY stock_value DESC LIMIT 20
    `)

    const topByValue = q.all(
      `SELECT id, name, spec, unit, stock_qty, avg_price, stock_value
       FROM product_stats WHERE stock_value > 0 ORDER BY stock_value DESC LIMIT 8`
    )

    const recent = q.all(`
      SELECT * FROM (
        SELECT 'in' AS type, pu.id AS id, pu.purchase_date AS date, pu.qty AS qty,
               pu.unit_price AS unit_price, (pu.qty * pu.unit_price) AS amount,
               p.name AS product_name, p.unit AS unit, pu.supplier AS party
        FROM purchases pu JOIN products p ON p.id = pu.product_id
        UNION ALL
        SELECT 'out', ob.id, ob.outbound_date, ob.qty, NULL, NULL, p.name, p.unit, ob.recipient
        FROM outbounds ob JOIN products p ON p.id = ob.product_id
      ) ORDER BY date DESC, id DESC LIMIT 10
    `)

    res.json({ totals, lowStock, byCategory, topByValue, recent })
  }))

  /* --------------------------- Excel 导入导出 --------------------------- */

  app.get('/api/export', wrap((_req, res) => {
    const buf = workbookToBuffer(buildWorkbook())
    const fileName = `仓库数据_${today()}.xlsx`
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="warehouse_${today()}.xlsx"; filename*=UTF-8''${encodeURIComponent(fileName)}`
    )
    res.end(buf)
  }))

  app.get('/api/template', wrap((_req, res) => {
    const buf = workbookToBuffer(buildTemplate())
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="import_template.xlsx"; filename*=UTF-8''${encodeURIComponent('仓库导入模板.xlsx')}`
    )
    res.end(buf)
  }))

  app.post('/api/import', upload.single('file'), wrap((req, res) => {
    if (!req.file) return fail(res, 400, '请选择要导入的 Excel 文件')
    res.json(importWorkbook(req.file.buffer))
  }))

  /* ------------------------- 示例数据 / 清空 / 打开目录 ------------------------- */

  const DEMO_PRODUCTS = [
    { name: '硒鼓 CF218A', sku: 'P-1001', category: '办公耗材', spec: 'HP M132 适用', unit: '个', location: 'A区-1排-1层', min_stock: 2, note: '', batches: [{ qty: 3, price: 268, supplier: '办公超市' }, { qty: 5, price: 245, supplier: '耗材直营店' }] },
    { name: 'A4 打印纸', sku: 'P-1002', category: '办公耗材', spec: '70g / 500张', unit: '包', location: 'A区-2排-3层', min_stock: 10, note: '', batches: [{ qty: 20, price: 18.8, supplier: '办公超市' }, { qty: 30, price: 17.5, supplier: '文具批发' }] },
    { name: '十字螺丝刀', sku: 'T-2001', category: '工具', spec: '6x150mm', unit: '把', location: 'B区-1排-2层', min_stock: 5, note: '', batches: [{ qty: 10, price: 12.5, supplier: '五金城' }, { qty: 4, price: 15, supplier: '楼下五金店' }] },
    { name: '内六角扳手组', sku: 'T-2002', category: '工具', spec: '1.5-10mm 9件套', unit: '套', location: 'B区-1排-3层', min_stock: 2, note: '', batches: [{ qty: 2, price: 68, supplier: '五金城' }] },
    { name: '标签贴纸', sku: 'P-1003', category: '包装物料', spec: '50x30mm 1000枚', unit: '卷', location: 'C区-1层', min_stock: 3, note: '', batches: [{ qty: 6, price: 22.5, supplier: '包装城' }] },
  ]

  app.post('/api/demo', wrap((_req, res) => {
    if (q.get('SELECT COUNT(*) AS c FROM products').c > 0) {
      return fail(res, 400, '数据库里已经有数据了，为避免混淆，示例数据未写入')
    }
    const day = (offset) => {
      const d = new Date()
      d.setDate(d.getDate() - offset)
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    }
    for (const p of DEMO_PRODUCTS) {
      const r = q.run(
        `INSERT INTO products (name, sku, category, spec, unit, location, min_stock, note) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        p.name, p.sku, p.category, p.spec, p.unit, p.location, p.min_stock, p.note
      )
      const pid = Number(r.lastInsertRowid)
      p.batches.forEach((b, i) => {
        q.run(
          `INSERT INTO purchases (product_id, purchase_date, qty, unit_price, supplier, note) VALUES (?, ?, ?, ?, ?, '')`,
          pid, day(40 - i * 12), b.qty, b.price, b.supplier
        )
      })
      q.run(
        `INSERT INTO outbounds (product_id, outbound_date, qty, recipient, note) VALUES (?, ?, ?, ?, '')`,
        pid, day(6), Math.max(1, Math.floor(p.batches[0].qty / 3)), '仓库管理员'
      )
    }
    res.json({ ok: true, count: DEMO_PRODUCTS.length })
  }))

  app.post('/api/reset', wrap((req, res) => {
    if (s((req.body || {}).confirm) !== '清空') return fail(res, 400, '确认口令不正确')
    db.exec('DELETE FROM outbounds; DELETE FROM purchases; DELETE FROM products;')
    res.json({ ok: true })
  }))

  app.post('/api/open-data-dir', wrap((_req, res) => {
    res.json({ ok: openFolder(DATA_DIR), dir: DATA_DIR })
  }))

  /* ---------------------------- 静态资源 ---------------------------- */

  if (assets && Object.keys(assets).length > 0) {
    app.use(embeddedStatic(assets))
  } else {
    const dist = distDir ?? defaultDistDir()
    if (dist && fs.existsSync(dist)) {
      app.use(express.static(dist))
      // 单页应用回退：非 /api 的 GET 请求一律返回 index.html
      app.use((req, res, next) => {
        if (req.method !== 'GET' || req.path.startsWith('/api')) return next()
        res.sendFile(path.join(dist, 'index.html'))
      })
    } else {
      app.use((req, res, next) => {
        if (req.path.startsWith('/api')) return next()
        res.status(503).send('前端页面尚未构建，请先运行 npm run build，或用 npm run dev 进入开发模式。')
      })
    }
  }

  return app
}
