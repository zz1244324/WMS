import { spawn, spawnSync } from 'node:child_process'
import { DB_FILE, DATA_DIR } from './db.js'
import { log } from './logger.js'

export const DEFAULT_PORT = Number(process.env.PORT || 3333)

/** 用系统默认浏览器打开网址 */
export function openUrl(url) {
  try {
    if (process.platform === 'win32') {
      spawn(`start "" "${url}"`, { shell: true, detached: true, stdio: 'ignore' }).unref()
    } else if (process.platform === 'darwin') {
      spawn('open', [url], { detached: true, stdio: 'ignore' }).unref()
    } else {
      spawn('xdg-open', [url], { detached: true, stdio: 'ignore' }).unref()
    }
    return true
  } catch {
    return false
  }
}

/** 在文件管理器里打开目录 */
export function openFolder(dir) {
  try {
    if (process.platform === 'win32') {
      spawn(`explorer "${dir}"`, { shell: true, detached: true, stdio: 'ignore' }).unref()
    } else if (process.platform === 'darwin') {
      spawn('open', [dir], { detached: true, stdio: 'ignore' }).unref()
    } else {
      spawn('xdg-open', [dir], { detached: true, stdio: 'ignore' }).unref()
    }
    return true
  } catch {
    return false
  }
}

/** Windows 控制台默认是 GBK 代码页，切到 UTF-8 才能正常显示中文 */
function ensureUtf8Console() {
  if (process.platform !== 'win32') return
  if (!process.stdout.isTTY) return
  for (const cmd of ['chcp.com', 'cmd.exe']) {
    try {
      spawnSync(cmd, cmd === 'chcp.com' ? ['65001'] : ['/c', 'chcp 65001'], {
        stdio: 'ignore',
        windowsHide: true,
      })
      return
    } catch {
      /* 换下一个再试 */
    }
  }
}

/**
 * 启动 HTTP 服务。
 * 端口被占用时不报错退出，而是认为程序已在运行，直接把浏览器打开。
 */
export function launch(app, { port = DEFAULT_PORT, openBrowser = false, onReady } = {}) {
  if (openBrowser) ensureUtf8Console()

  const server = app.listen(port, () => {
    log('')
    log('==========================================')
    log('  仓管家  CangGuanJia  v1.0.0')
    log(`  服务地址： http://localhost:${port}`)
    log(`  数据文件： ${DB_FILE}`)
    log(`  数据目录： ${DATA_DIR}`)
    log('==========================================')
    log('')

    if (onReady) {
      try {
        onReady()
      } catch (err) {
        log('[托盘] 启动失败：', err)
      }
    }
    if (openBrowser) setTimeout(() => openUrl(`http://localhost:${port}`), 150)
  })

  server.on('error', (err) => {
    if (err && err.code === 'EADDRINUSE') {
      log(`端口 ${port} 已被占用，仓管家应该已经在运行了。`)
      if (openBrowser) openUrl(`http://localhost:${port}`)
      setTimeout(() => process.exit(0), 1200)
      return
    }
    log('[错误] 服务启动失败：', err)
    process.exit(1)
  })

  const bye = () => {
    log('收到退出信号，正在关闭…')
    process.exit(0)
  }
  process.on('SIGINT', bye)
  process.on('SIGTERM', bye)

  return server
}
