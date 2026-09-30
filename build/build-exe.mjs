/**
 * 把「仓管家」打包成单个 exe（Node SEA + 内嵌前端资源 + 注入图标与版本信息）
 *
 *   node build/build-exe.mjs
 *
 * 产物：release/仓管家.exe
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { execFileSync } from 'node:child_process'
import { createRequire } from 'node:module'
import * as esbuild from 'esbuild'
import { makeIcon } from './make-icon.mjs'

// resedit 是 CJS 包，用 createRequire 引入
const require = createRequire(import.meta.url)

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const DIST = path.join(ROOT, 'dist')
const RELEASE = path.join(ROOT, 'release')
const BUNDLE = path.join(__dirname, 'sea-bundle.cjs')
const SEA_CONFIG = path.join(__dirname, 'sea-config.json')
const SEA_BLOB = path.join(__dirname, 'sea-prep.blob')
const EMBEDDED = path.join(ROOT, 'server', 'embedded-assets.js')

const APP_NAME = '仓管家'
const APP_NAME_EN = 'CangGuanJia'
const EXE_NAME = `${APP_NAME}.exe`
const VERSION = '1.0.0'
const FUSE = 'NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2'

const MIME = {
  html: 'text/html; charset=utf-8',
  js: 'text/javascript; charset=utf-8',
  mjs: 'text/javascript; charset=utf-8',
  css: 'text/css; charset=utf-8',
  json: 'application/json; charset=utf-8',
  svg: 'image/svg+xml',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  ico: 'image/x-icon',
  woff: 'font/woff',
  woff2: 'font/woff2',
  ttf: 'font/ttf',
  txt: 'text/plain; charset=utf-8',
  map: 'application/json; charset=utf-8',
}

const log = (tag, msg) => console.log(`[${tag}] ${msg}`)

/* ---------------------------------------------------------------- */
/* 1. 把 dist 里的前端文件转成内嵌资源                                */
/* ---------------------------------------------------------------- */

function generateEmbeddedAssets() {
  if (!fs.existsSync(DIST)) throw new Error('还没构建前端，请先执行 npm run build')

  const iconFile = path.join(__dirname, 'icon.ico')
  const iconBase64 = fs.existsSync(iconFile) ? fs.readFileSync(iconFile).toString('base64') : ''

  const files = []
  const walk = (dir, prefix = '') => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const abs = path.join(dir, entry.name)
      const rel = prefix ? `${prefix}/${entry.name}` : entry.name
      if (entry.isDirectory()) walk(abs, rel)
      else files.push([rel.split(path.sep).join('/'), abs])
    }
  }
  walk(DIST)

  const map = {}
  for (const [rel, abs] of files) {
    const ext = path.extname(rel).slice(1).toLowerCase()
    map[rel] = {
      type: MIME[ext] || 'application/octet-stream',
      data: fs.readFileSync(abs).toString('base64'),
    }
  }

  fs.writeFileSync(
    EMBEDDED,
    [
      '// 由 build/build-exe.mjs 自动生成，请勿手动修改',
      `// 内嵌 ${files.length} 个前端文件 + 托盘图标`,
      `export const ASSETS = ${JSON.stringify(map)}`,
      `export const APP_ICON_BASE64 = ${JSON.stringify(iconBase64)}`,
      '',
    ].join('\n'),
    'utf8'
  )
  log('assets', `内嵌 ${files.length} 个前端文件 + 托盘图标 → server/embedded-assets.js`)
}

/* ---------------------------------------------------------------- */
/* 2. 用 esbuild 把服务端打成一个 CJS 文件                            */
/* ---------------------------------------------------------------- */

async function bundleServer() {
  await esbuild.build({
    entryPoints: [path.join(ROOT, 'server', 'sea.js')],
    bundle: true,
    platform: 'node',
    target: 'node22',
    format: 'cjs',
    outfile: BUNDLE,
    minify: true,
    legalComments: 'none',
    logLevel: 'warning',
    // 打包后没有真实的模块文件路径，统一兜底；数据目录走 LOCALAPPDATA，不受影响
    define: { 'import.meta.url': '"file:///"' },
  })
  const kb = (fs.statSync(BUNDLE).size / 1024).toFixed(0)
  log('bundle', `服务端已打包 → ${kb} KB`)
}

/* ---------------------------------------------------------------- */
/* 3. 生成 SEA blob                                                  */
/* ---------------------------------------------------------------- */

function buildSeaBlob() {
  fs.writeFileSync(
    SEA_CONFIG,
    JSON.stringify(
      {
        main: BUNDLE,
        output: SEA_BLOB,
        disableExperimentalSEAWarning: true,
        useSnapshot: false,
        useCodeCache: true,
      },
      null,
      2
    )
  )
  execFileSync(process.execPath, ['--experimental-sea-config', SEA_CONFIG], { stdio: 'inherit' })
  log('sea', `blob 已生成（${(fs.statSync(SEA_BLOB).size / 1024).toFixed(0)} KB）`)
}

/* ---------------------------------------------------------------- */
/* 4. 复制 node.exe、注入 blob                                       */
/* ---------------------------------------------------------------- */

async function makeExecutable() {
  fs.mkdirSync(RELEASE, { recursive: true })
  const target = path.join(RELEASE, EXE_NAME)

  fs.copyFileSync(process.execPath, target)
  log('copy', `以 ${process.execPath} 为基底 → ${EXE_NAME}`)

  const { inject } = await import('postject')
  await inject(target, 'NODE_SEA_BLOB', fs.readFileSync(SEA_BLOB), { sentinelFuse: FUSE })
  log('inject', 'SEA blob 注入完成')

  return target
}

/* ---------------------------------------------------------------- */
/* 5. 注入图标与版本信息（纯 JS 的 PE 资源编辑器，无需额外工具）      */
/* ---------------------------------------------------------------- */

function stampResources(exePath) {
  const { NtExecutable, NtExecutableResource, Resource, Data } = require('resedit')

  const exe = NtExecutable.from(fs.readFileSync(exePath), { ignoreCert: true })
  const res = NtExecutableResource.from(exe)

  // 图标
  const icon = Data.IconFile.from(fs.readFileSync(path.join(__dirname, 'icon.ico')))
  Resource.IconGroupEntry.replaceIconsForResource(
    res.entries,
    1,
    1033,
    icon.icons.map((i) => i.data)
  )

  // 版本信息
  const versions = Resource.VersionInfo.fromEntries(res.entries)
  const vi = versions.length ? versions[0] : Resource.VersionInfo.createEmpty()
  const [a, b, c] = VERSION.split('.').map(Number)
  vi.setFileVersion(a, b, c, 0)
  vi.setProductVersion(a, b, c, 0)
  vi.setStringValues(
    { lang: 1033, codepage: 1200 },
    {
      ProductName: APP_NAME,
      FileDescription: `${APP_NAME} · 本地仓库管理`,
      InternalName: APP_NAME_EN,
      OriginalFilename: EXE_NAME,
      CompanyName: '本地单机应用',
      LegalCopyright: '',
      Comments: `本地仓库管理工具 v${VERSION}`,
      FileVersion: VERSION,
      ProductVersion: VERSION,
    }
  )
  vi.outputToResourceEntries(res.entries)

  res.outputResource(exe)
  fs.writeFileSync(exePath, Buffer.from(exe.generate()))

  const mb = (fs.statSync(exePath).size / 1024 / 1024).toFixed(1)
  log('icon', `已写入图标与版本信息，${EXE_NAME} = ${mb} MB`)
}

/* ---------------------------------------------------------------- */
/* 6. 把 PE 子系统改成 GUI：双击不再弹出黑色控制台窗口                */
/* ---------------------------------------------------------------- */

function patchSubsystem(exePath) {
  const buf = fs.readFileSync(exePath)
  const peOffset = buf.readUInt32LE(0x3c)
  if (buf.toString('ascii', peOffset, peOffset + 4) !== 'PE\0\0') {
    throw new Error('目标不是有效的 PE 文件，跳过子系统修改')
  }
  // IMAGE_OPTIONAL_HEADER.Subsystem：PE 头 + 4(签名) + 20(COFF 头) + 68
  const offset = peOffset + 24 + 68
  const before = buf.readUInt16LE(offset)
  buf.writeUInt16LE(2, offset) // 2 = IMAGE_SUBSYSTEM_WINDOWS_GUI
  fs.writeFileSync(exePath, buf)
  log('gui', `子系统 ${before} → 2，双击不再弹出控制台窗口`)
}

/* ---------------------------------------------------------------- */
/* 主流程                                                            */
/* ---------------------------------------------------------------- */

async function main() {
  console.log('')
  console.log(`  开始打包 ${APP_NAME} v${VERSION}`)
  console.log('')

  await makeIcon()
  generateEmbeddedAssets()
  await bundleServer()
  buildSeaBlob()
  const exePath = await makeExecutable()
  stampResources(exePath)
  patchSubsystem(exePath)

  console.log('')
  console.log(`  打包完成：${exePath}`)
  console.log('')
}

await main()
