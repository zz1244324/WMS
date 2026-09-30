import type {
  DashboardData,
  ImportResult,
  Meta,
  Outbound,
  OutboundForm,
  Product,
  ProductForm,
  Purchase,
  PurchaseForm,
} from '@/types'

const BASE = '/api'

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const isForm = init?.body instanceof FormData
  const res = await fetch(BASE + url, {
    ...init,
    headers: isForm ? init?.headers : { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
  })
  const text = await res.text()
  let data: unknown = null
  if (text) {
    try {
      data = JSON.parse(text)
    } catch {
      data = text
    }
  }
  if (!res.ok) {
    const msg =
      data && typeof data === 'object' && 'error' in data
        ? String((data as { error: unknown }).error)
        : `请求失败（HTTP ${res.status}）`
    throw new Error(msg)
  }
  return data as T
}

const qs = (params: Record<string, string | number | undefined>) => {
  const sp = new URLSearchParams()
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && String(v) !== '') sp.set(k, String(v))
  })
  const s = sp.toString()
  return s ? `?${s}` : ''
}

export const api = {
  meta: () => request<Meta>('/meta'),

  products: (params: { keyword?: string; category?: string; lowStock?: boolean } = {}) =>
    request<Product[]>(
      `/products${qs({ keyword: params.keyword, category: params.category, lowStock: params.lowStock ? 1 : undefined })}`
    ),
  product: (id: number) =>
    request<{ product: Product; purchases: Purchase[]; outbounds: Outbound[] }>(`/products/${id}`),
  createProduct: (body: ProductForm) =>
    request<Product>('/products', { method: 'POST', body: JSON.stringify(body) }),
  updateProduct: (id: number, body: ProductForm) =>
    request<Product>(`/products/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  deleteProduct: (id: number) => request<{ ok: boolean }>(`/products/${id}`, { method: 'DELETE' }),

  purchases: (params: { productId?: number; keyword?: string } = {}) =>
    request<Purchase[]>(`/purchases${qs({ productId: params.productId, keyword: params.keyword })}`),
  createPurchase: (body: PurchaseForm) =>
    request<Purchase>('/purchases', { method: 'POST', body: JSON.stringify(body) }),
  updatePurchase: (id: number, body: PurchaseForm) =>
    request<Purchase>(`/purchases/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  deletePurchase: (id: number) => request<{ ok: boolean }>(`/purchases/${id}`, { method: 'DELETE' }),

  outbounds: (params: { productId?: number; keyword?: string } = {}) =>
    request<Outbound[]>(`/outbounds${qs({ productId: params.productId, keyword: params.keyword })}`),
  createOutbound: (body: OutboundForm) =>
    request<{ row: Outbound; stock: number; warning: string | null }>('/outbounds', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  updateOutbound: (id: number, body: OutboundForm) =>
    request<{ row: Outbound; stock: number; warning: string | null }>(`/outbounds/${id}`, {
      method: 'PUT',
      body: JSON.stringify(body),
    }),
  deleteOutbound: (id: number) => request<{ ok: boolean }>(`/outbounds/${id}`, { method: 'DELETE' }),

  dashboard: () => request<DashboardData>('/dashboard'),

  importExcel: (file: File) => {
    const fd = new FormData()
    fd.append('file', file)
    return request<ImportResult>('/import', { method: 'POST', body: fd })
  },
  openDataDir: () => request<{ ok: boolean; dir: string }>('/open-data-dir', { method: 'POST' }),
  loadDemo: () => request<{ ok: boolean; count: number }>('/demo', { method: 'POST' }),
  reset: (confirm: string) => request<{ ok: boolean }>('/reset', { method: 'POST', body: JSON.stringify({ confirm }) }),
}

export const downloadUrl = {
  export: () => `${BASE}/export`,
  template: () => `${BASE}/template`,
}

/** 把异常转成可直接展示的文案 */
export function errMsg(e: unknown): string {
  if (e instanceof Error) return e.message
  return String(e ?? '未知错误')
}

/** 触发浏览器下载（保留后端设置的中文文件名） */
export function download(url: string) {
  const a = document.createElement('a')
  a.href = url
  a.rel = 'noopener'
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
}
