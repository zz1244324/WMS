/** 金额：保留两位小数，带千分位 */
export function money(v: number | null | undefined): string {
  const n = Number(v ?? 0)
  if (!Number.isFinite(n)) return '0.00'
  return n.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

/** 单价：最多保留四位小数，去掉末尾多余的 0，便于看清 11.6667 这类加权均价 */
export function price(v: number | null | undefined): string {
  const n = Number(v ?? 0)
  if (!Number.isFinite(n)) return '0'
  const s = n.toFixed(4).replace(/0+$/, '').replace(/\.$/, '')
  return s === '' || s === '-' ? '0' : s
}

/** 数量：整数不显示小数，小数最多保留两位 */
export function qty(v: number | null | undefined): string {
  const n = Number(v ?? 0)
  if (!Number.isFinite(n)) return '0'
  return Number.isInteger(n) ? n.toLocaleString('zh-CN') : n.toLocaleString('zh-CN', { maximumFractionDigits: 2 })
}

export function compact(v: number | null | undefined): string {
  const n = Number(v ?? 0)
  const abs = Math.abs(n)
  if (abs >= 1e8) return `${(n / 1e8).toFixed(2)} 亿`
  if (abs >= 1e4) return `${(n / 1e4).toFixed(2)} 万`
  return money(n)
}

export function todayStr(): string {
  const d = new Date()
  const p = (x: number) => String(x).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}
