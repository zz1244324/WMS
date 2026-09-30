/**
 * 数据层：使用 Node 24 内置的 node:sqlite（无需安装任何原生依赖）
 * 数据库就是 server/data/warehouse.db 这一个文件，复制它即完成备份。
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { DatabaseSync } from 'node:sqlite'

/** 源码运行时的模块目录；打包成 exe 后这里不会被用到，故容错处理 */
function moduleDir() {
  try {
    return path.dirname(fileURLToPath(import.meta.url))
  } catch {
    return process.cwd()
  }
}
const __dirname = moduleDir()

/** 是否运行在打包后的 exe 里（此时 process.execPath 就是仓管家.exe） */
export const IS_PACKAGED = path.basename(process.execPath).toLowerCase() !== 'node.exe'

/**
 * 数据目录优先级：
 *   1) 环境变量 WAREHOUSE_DATA_DIR（想自定义放哪就设它）
 *   2) 打包成 exe：%LOCALAPPDATA%\仓管家\data
 *   3) 源码运行：server/data
 */
export const DATA_DIR = (() => {
  if (process.env.WAREHOUSE_DATA_DIR) return path.resolve(process.env.WAREHOUSE_DATA_DIR)
  if (IS_PACKAGED) {
    const base = process.env.LOCALAPPDATA || path.dirname(process.execPath)
    return path.join(base, '仓管家', 'data')
  }
  return path.join(__dirname, 'data')
})()

fs.mkdirSync(DATA_DIR, { recursive: true })
export const DB_FILE = path.join(DATA_DIR, 'warehouse.db')

export const db = new DatabaseSync(DB_FILE)

db.exec('PRAGMA journal_mode = WAL;')
db.exec('PRAGMA foreign_keys = ON;')

db.exec(`
CREATE TABLE IF NOT EXISTS products (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  name        TEXT    NOT NULL,
  sku         TEXT    DEFAULT '',
  category    TEXT    DEFAULT '',
  spec        TEXT    DEFAULT '',
  unit        TEXT    DEFAULT '个',
  location    TEXT    DEFAULT '',
  min_stock   REAL    DEFAULT 0,
  note        TEXT    DEFAULT '',
  created_at  TEXT    DEFAULT (datetime('now','localtime'))
);

CREATE TABLE IF NOT EXISTS purchases (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id    INTEGER NOT NULL,
  purchase_date TEXT    NOT NULL,
  qty           REAL    NOT NULL,
  unit_price    REAL    NOT NULL,
  supplier      TEXT    DEFAULT '',
  note          TEXT    DEFAULT '',
  created_at    TEXT    DEFAULT (datetime('now','localtime')),
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS outbounds (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id    INTEGER NOT NULL,
  outbound_date TEXT    NOT NULL,
  qty           REAL    NOT NULL,
  recipient     TEXT    DEFAULT '',
  note          TEXT    DEFAULT '',
  created_at    TEXT    DEFAULT (datetime('now','localtime')),
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_purchases_product ON purchases(product_id);
CREATE INDEX IF NOT EXISTS idx_outbounds_product ON outbounds(product_id);
`)

/**
 * 统计视图：把「每个商品」的库存、加权平均价、简单平均价、金额一次性算好。
 *  - 加权平均价 = Σ(数量 × 单价) / Σ数量   —— 买得多的批次权重更大，反映真实成本
 *  - 简单平均价 = 各批次单价的算术平均      —— 每次采购不论数量多少都同等看待
 */
db.exec('DROP VIEW IF EXISTS product_stats;')
db.exec(`
CREATE VIEW product_stats AS
SELECT
  p.id,
  p.name,
  p.sku,
  p.category,
  p.spec,
  p.unit,
  p.location,
  p.min_stock,
  p.note,
  p.created_at,
  COALESCE(pu.batch_count, 0)                              AS batch_count,
  COALESCE(pu.total_qty, 0)                                AS purchased_qty,
  COALESCE(pu.total_amount, 0)                             AS purchased_amount,
  COALESCE(pu.simple_avg, 0)                               AS simple_avg_price,
  COALESCE(pu.min_price, 0)                                AS min_price,
  COALESCE(pu.max_price, 0)                                AS max_price,
  pu.last_purchase_date                                    AS last_purchase_date,
  CASE WHEN COALESCE(pu.total_qty, 0) > 0
       THEN CAST(pu.total_amount AS REAL) / pu.total_qty
       ELSE 0 END                                          AS avg_price,
  COALESCE(ob.out_qty, 0)                                  AS outbound_qty,
  COALESCE(pu.total_qty, 0) - COALESCE(ob.out_qty, 0)      AS stock_qty,
  CASE WHEN COALESCE(pu.total_qty, 0) > 0
       THEN (COALESCE(pu.total_qty, 0) - COALESCE(ob.out_qty, 0))
            * (CAST(pu.total_amount AS REAL) / pu.total_qty)
       ELSE 0 END                                          AS stock_value
FROM products p
LEFT JOIN (
  SELECT product_id,
         COUNT(*)              AS batch_count,
         SUM(qty)              AS total_qty,
         SUM(qty * unit_price) AS total_amount,
         AVG(unit_price)       AS simple_avg,
         MIN(unit_price)       AS min_price,
         MAX(unit_price)       AS max_price,
         MAX(purchase_date)    AS last_purchase_date
  FROM purchases
  GROUP BY product_id
) pu ON pu.product_id = p.id
LEFT JOIN (
  SELECT product_id, SUM(qty) AS out_qty
  FROM outbounds
  GROUP BY product_id
) ob ON ob.product_id = p.id;
`)

/** 常用查询封装 */
export const q = {
  all(sql, ...params) {
    return db.prepare(sql).all(...params)
  },
  get(sql, ...params) {
    return db.prepare(sql).get(...params)
  },
  run(sql, ...params) {
    return db.prepare(sql).run(...params)
  },
}
