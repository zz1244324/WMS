import { useRef, useState, type ChangeEvent, type DragEvent } from 'react'
import { toast } from 'sonner'
import {
  CheckCircle2,
  Database,
  Download,
  FileSpreadsheet,
  FolderOpen,
  HardDriveDownload,
  Info,
  Sparkles,
  Trash2,
  Upload,
  XCircle,
} from 'lucide-react'
import { PageHeader } from '@/components/common/PageHeader'
import { Field } from '@/components/common/Field'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Spinner } from '@/components/ui/spinner'
import { api, download, downloadUrl, errMsg } from '@/lib/api'
import { cn } from '@/lib/utils'
import type { ImportResult, Meta } from '@/types'

interface Props {
  meta: Meta | null
  hasData: boolean
  onChanged: () => void
}

export function DataCenter({ meta, hasData, onChanged }: Props) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)
  const [importing, setImporting] = useState(false)
  const [result, setResult] = useState<ImportResult | null>(null)

  const [resetOpen, setResetOpen] = useState(false)
  const [resetText, setResetText] = useState('')
  const [working, setWorking] = useState(false)

  const handleFile = async (file: File | undefined) => {
    if (!file) return
    if (!/\.(xlsx|xls|csv)$/i.test(file.name)) {
      toast.error('请选择 .xlsx / .xls / .csv 文件')
      return
    }
    setImporting(true)
    setResult(null)
    try {
      const res = await api.importExcel(file)
      setResult(res)
      const added = res.productsCreated + res.productsMatched + res.purchasesAdded + res.outboundsAdded
      if (added === 0 && res.errors.length > 0) {
        toast.error('导入失败，请查看下方说明')
      } else {
        toast.success('导入完成')
        onChanged()
      }
    } catch (err) {
      toast.error(errMsg(err))
    } finally {
      setImporting(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setDragging(false)
    void handleFile(e.dataTransfer.files?.[0])
  }

  const loadDemo = async () => {
    setWorking(true)
    try {
      const res = await api.loadDemo()
      toast.success(`已载入 ${res.count} 个示例商品`)
      onChanged()
    } catch (err) {
      toast.error(errMsg(err))
    } finally {
      setWorking(false)
    }
  }

  const openDataFolder = async () => {
    try {
      const res = await api.openDataDir()
      if (!res.ok) toast.error(`没能自动打开，请手动访问：${res.dir}`)
    } catch (err) {
      toast.error(errMsg(err))
    }
  }

  const doReset = async () => {
    setWorking(true)
    try {
      await api.reset(resetText)
      toast.success('数据已清空')
      setResetOpen(false)
      setResetText('')
      setResult(null)
      onChanged()
    } catch (err) {
      toast.error(errMsg(err))
    } finally {
      setWorking(false)
    }
  }

  return (
    <div className="space-y-4">
      <PageHeader title="数据管理" description="用 Excel 批量编辑，或者备份、迁移到别的电脑。" />

      <div className="grid gap-4 lg:grid-cols-2">
        {/* 导出 */}
        <section className="rounded-lg border border-slate-200 bg-white p-4">
          <div className="flex items-start gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-blue-50 text-blue-700">
              <HardDriveDownload className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="text-sm font-semibold text-slate-800">导出为 Excel</h2>
              <p className="mt-1 text-xs leading-relaxed text-slate-500">
                导出一个工作簿，包含「商品汇总」（含加权/简单平均价、库存金额）、「入库明细」、「出库明细」三张表，
                可以直接用 Excel 打开查看或用数据透视表分析。
              </p>
              <Button
                className="mt-3 cursor-pointer"
                onClick={() => {
                  download(downloadUrl.export())
                  toast.success('已开始下载')
                }}
              >
                <Download className="mr-1.5 h-4 w-4" />
                导出全部数据
              </Button>
            </div>
          </div>
        </section>

        {/* 模板 */}
        <section className="rounded-lg border border-slate-200 bg-white p-4">
          <div className="flex items-start gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-emerald-50 text-emerald-700">
              <FileSpreadsheet className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="text-sm font-semibold text-slate-800">下载导入模板</h2>
              <p className="mt-1 text-xs leading-relaxed text-slate-500">
                模板里已经写好表头和示例数据。按「商品档案」「入库明细」「出库明细」三张表的格式填好后导入即可。
                商品名称没填过的会自动新建，填过的会直接沿用。
              </p>
              <Button
                variant="outline"
                className="mt-3 cursor-pointer"
                onClick={() => {
                  download(downloadUrl.template())
                  toast.success('模板已开始下载')
                }}
              >
                <Download className="mr-1.5 h-4 w-4" />
                下载模板
              </Button>
            </div>
          </div>
        </section>
      </div>

      {/* 导入 */}
      <section className="rounded-lg border border-slate-200 bg-white p-4">
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-amber-50 text-amber-700">
            <Upload className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-sm font-semibold text-slate-800">从 Excel 导入</h2>
            <p className="mt-1 text-xs leading-relaxed text-slate-500">
              导入是「追加」而不是覆盖：已经在库里的商品会保留原数据，只补充空缺字段；入库/出库明细会逐条新增。
            </p>
          </div>
        </div>

        <div
          onDragOver={(e) => {
            e.preventDefault()
            setDragging(true)
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          onClick={() => fileRef.current?.click()}
          className={cn(
            'mt-3 flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed px-6 py-10 text-center transition-colors duration-200',
            dragging ? 'border-blue-500 bg-blue-50/60' : 'border-slate-300 bg-slate-50/60 hover:border-blue-400'
          )}
        >
          {importing ? (
            <>
              <Spinner className="h-6 w-6 text-blue-700" />
              <p className="text-sm text-slate-600">正在导入，请稍候…</p>
            </>
          ) : (
            <>
              <Upload className="h-6 w-6 text-slate-400" />
              <p className="text-sm font-medium text-slate-700">点击选择文件，或把 Excel 拖到这里</p>
              <p className="text-xs text-slate-400">支持 .xlsx / .xls / .csv，单个文件不超过 20 MB</p>
            </>
          )}
        </div>
        <input
          ref={fileRef}
          type="file"
          accept=".xlsx,.xls,.csv"
          className="hidden"
          onChange={(e: ChangeEvent<HTMLInputElement>) => void handleFile(e.target.files?.[0])}
        />

        {result ? (
          <div className="mt-3 rounded-md border border-slate-200 bg-slate-50/70 p-3">
            <p className="mb-2 text-xs font-medium text-slate-700">
              导入结果（识别到工作表：{result.sheets.join('、')}）
            </p>
            <ul className="grid gap-1 text-xs text-slate-600 sm:grid-cols-2">
              <li className="flex items-center gap-1.5">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                新建商品 {result.productsCreated} 个，命中已有商品 {result.productsMatched} 次
              </li>
              <li className="flex items-center gap-1.5">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                新增入库明细 {result.purchasesAdded} 条、出库明细 {result.outboundsAdded} 条
              </li>
              {result.skipped > 0 ? (
                <li className="flex items-center gap-1.5">
                  <XCircle className="h-3.5 w-3.5 text-amber-600" />
                  跳过 {result.skipped} 行（缺名称或数量为 0）
                </li>
              ) : null}
              {result.errors.map((e) => (
                <li key={e} className="flex items-center gap-1.5 sm:col-span-2">
                  <XCircle className="h-3.5 w-3.5 text-rose-600" />
                  {e}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </section>

      {/* 数据库信息 */}
      <section className="rounded-lg border border-slate-200 bg-white p-4">
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-slate-100 text-slate-600">
            <Database className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-sm font-semibold text-slate-800">数据存放位置与备份</h2>
            <p className="mt-1 text-xs leading-relaxed text-slate-500">
              全部数据都存在下面这个 SQLite 文件里。想备份就把整个 <code className="rounded bg-slate-100 px-1">data</code>{' '}
              文件夹复制一份；换电脑时把它拷到新机器的同一位置即可。
            </p>
            <p className="mt-2 break-all rounded-md bg-slate-50 px-2 py-1.5 font-mono text-[11px] text-slate-600">
              {meta?.dbFile ?? '加载中…'}
            </p>
            <Button variant="outline" size="sm" className="mt-3 cursor-pointer" onClick={openDataFolder}>
              <FolderOpen className="mr-1.5 h-4 w-4" />
              打开数据文件夹
            </Button>
            <p className="mt-2 flex items-start gap-1.5 text-xs text-slate-400">
              <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              服务运行时不要直接编辑该文件，建议用「导出 Excel」来查看或修改数据。
            </p>
          </div>
        </div>
      </section>

      {/* 危险操作 */}
      <section className="rounded-lg border border-rose-200 bg-white p-4">
        <h2 className="text-sm font-semibold text-rose-700">其他操作</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button variant="outline" className="cursor-pointer" disabled={working || hasData} onClick={loadDemo}>
            {working ? <Spinner className="mr-1.5 h-4 w-4" /> : <Sparkles className="mr-1.5 h-4 w-4" />}
            {hasData ? '已有数据，无法载入示例' : '载入示例数据'}
          </Button>
          <Button
            variant="outline"
            className="cursor-pointer border-rose-200 text-rose-700 hover:bg-rose-50 hover:text-rose-800"
            onClick={() => setResetOpen(true)}
          >
            <Trash2 className="mr-1.5 h-4 w-4" />
            清空全部数据
          </Button>
        </div>
        <p className="mt-2 text-xs text-slate-400">
          示例数据只在库为空时可载入，用来快速体验整套流程；确认无误后再清空、录入自己的真实数据。
        </p>
      </section>

      <Dialog open={resetOpen} onOpenChange={setResetOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>清空全部数据</DialogTitle>
            <DialogDescription>
              这会删除所有商品、入库和出库记录，且无法撤销。建议先导出 Excel 备份。
            </DialogDescription>
          </DialogHeader>
          <Field label="请输入「清空」两个字以确认">
            <Input value={resetText} onChange={(e) => setResetText(e.target.value)} placeholder="清空" />
          </Field>
          <DialogFooter>
            <Button variant="outline" className="cursor-pointer" onClick={() => setResetOpen(false)}>
              取消
            </Button>
            <Button
              className="cursor-pointer bg-rose-600 text-white hover:bg-rose-700"
              disabled={resetText !== '清空' || working}
              onClick={doReset}
            >
              {working ? <Spinner className="mr-1.5 h-4 w-4" /> : null}
              确认清空
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
