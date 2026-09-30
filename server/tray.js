/**
 * 系统托盘图标（Windows）
 *
 * 不依赖任何原生模块：用一个隐藏的 PowerShell 进程创建 NotifyIcon，
 * 菜单点击通过标准输出回传给 Node，Node 再执行对应动作。
 */
import fs from 'node:fs'
import path from 'node:path'
import readline from 'node:readline'
import { spawn } from 'node:child_process'
import { DATA_DIR } from './db.js'
import { log } from './logger.js'
import { openFolder, openUrl } from './launch.js'

/** 把内嵌的 ico 落到磁盘，供 PowerShell 读取 */
function writeIconFile(base64) {
  if (!base64) return null
  try {
    const dir = path.join(path.dirname(DATA_DIR), 'cache')
    fs.mkdirSync(dir, { recursive: true })
    const file = path.join(dir, 'tray.ico')
    const buf = Buffer.from(base64, 'base64')
    if (!fs.existsSync(file) || fs.readFileSync(file).length !== buf.length) fs.writeFileSync(file, buf)
    return file
  } catch (err) {
    log('[托盘] 写入图标失败：', err)
    return null
  }
}

const psQuote = (v) => `'${String(v).replace(/'/g, "''")}'`

function buildScript({ iconFile, exePath, parentPid, title }) {
  return `
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

function Send([string]$m) {
  [Console]::Out.WriteLine($m)
  [Console]::Out.Flush()
}

$ni = New-Object System.Windows.Forms.NotifyIcon
$ready = $false
$iconFile = ${psQuote(iconFile || '')}
if ($iconFile -and (Test-Path -LiteralPath $iconFile)) {
  try { $ni.Icon = New-Object System.Drawing.Icon($iconFile, 16, 16); $ready = $true } catch { }
}
if (-not $ready) {
  try { $ni.Icon = [System.Drawing.Icon]::ExtractAssociatedIcon(${psQuote(exePath)}); $ready = $true } catch { }
}
if (-not $ready) { Send 'ERROR no-icon'; exit 1 }

$ni.Text = ${psQuote(title)}
$ni.Visible = $true

$menu = New-Object System.Windows.Forms.ContextMenuStrip
$null = $menu.Items.Add('打开仓管家')
$null = $menu.Items.Add('打开数据文件夹')
$null = $menu.Items.Add('-')
$null = $menu.Items.Add('退出仓管家')

$menu.Items[0].add_Click({ Send 'OPEN' })
$menu.Items[1].add_Click({ Send 'FOLDER' })
$menu.Items[3].add_Click({
  Send 'EXIT'
  $ni.Visible = $false
  [System.Windows.Forms.Application]::ExitThread()
})
$ni.add_MouseDoubleClick({ Send 'OPEN' })
$ni.ContextMenuStrip = $menu

# 父进程一旦消失，自己也退出，避免留下点不掉的幽灵图标
$parentPid = ${parentPid}
$watch = New-Object System.Windows.Forms.Timer
$watch.Interval = 2000
$watch.add_Tick({
  if (-not (Get-Process -Id $parentPid -ErrorAction SilentlyContinue)) {
    $ni.Visible = $false
    [System.Windows.Forms.Application]::ExitThread()
  }
})
$watch.Start()

# 启动提示气泡
$balloon = New-Object System.Windows.Forms.Timer
$balloon.Interval = 900
$balloon.add_Tick({
  $balloon.Stop()
  try {
    $ni.ShowBalloonTip(3500, '仓管家已启动', '双击图标打开界面，右键可退出。', [System.Windows.Forms.ToolTipIcon]::Info)
  } catch { }
})
$balloon.Start()

Send 'READY'
[System.Windows.Forms.Application]::Run()
$ni.Visible = $false
$ni.Dispose()
`
}

/**
 * @param {object} opts
 * @param {string} opts.iconBase64  内嵌的 ico（base64）
 * @param {number} opts.port
 * @param {string} opts.dataDir
 * @param {() => void} opts.quit
 */
export function startTray({ iconBase64, port, dataDir = DATA_DIR, quit } = {}) {
  if (process.platform !== 'win32') {
    log('[托盘] 当前系统不支持，已跳过。')
    return { stop() {}, ready: false }
  }

  const iconFile = writeIconFile(iconBase64)
  const script = buildScript({
    iconFile,
    exePath: process.execPath,
    parentPid: process.pid,
    title: '仓管家 · 本地仓库管理',
  })
  const encoded = Buffer.from(script, 'utf16le').toString('base64')

  let child
  try {
    child = spawn(
      'powershell.exe',
      ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-EncodedCommand', encoded],
      { stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true }
    )
  } catch (err) {
    log('[托盘] 无法启动 PowerShell：', err)
    return { stop() {}, ready: false }
  }

  const state = { ready: false, stopped: false }

  const rl = readline.createInterface({ input: child.stdout })
  rl.on('line', (raw) => {
    const cmd = raw.replace(/^\uFEFF/, '').trim()
    if (!cmd) return
    if (cmd === 'READY') {
      state.ready = true
      log('[托盘] 图标已就绪。')
      return
    }
    if (cmd === 'OPEN') {
      openUrl(`http://localhost:${port}`)
      return
    }
    if (cmd === 'FOLDER') {
      openFolder(dataDir)
      return
    }
    if (cmd === 'EXIT') {
      log('[托盘] 用户选择退出。')
      stopTray()
      if (typeof quit === 'function') quit()
      return
    }
    if (cmd.startsWith('ERROR')) log('[托盘] PowerShell 报错：', cmd)
  })

  child.stderr?.on('data', (chunk) => {
    const text = String(chunk).trim()
    if (!text) return
    // PowerShell 会把进度/错误序列化成 CLIXML 走 stderr，这里过滤掉纯噪音
    if (text.includes('CLIXML') || text.includes('<Objs')) return
    log('[托盘] ' + text)
  })

  child.on('error', (err) => log('[托盘] 进程异常：', err))
  child.on('exit', (code) => {
    state.ready = false
    if (!state.stopped && code !== 0) log(`[托盘] 已退出，代码 ${code}`)
  })

  function stopTray() {
    state.stopped = true
    try {
      rl.close()
    } catch {
      /* ignore */
    }
    try {
      child.kill()
    } catch {
      /* ignore */
    }
  }

  // 主进程退出时一并清理托盘
  process.on('exit', stopTray)

  setTimeout(() => {
    if (!state.ready) log('[托盘] 图标未在预期时间内出现，可能被系统策略拦截。')
  }, 12000)

  return { stop: stopTray, get ready() { return state.ready } }
}
