/**
 * 打包成 exe 后的入口（Node SEA）。
 *  - 前端页面以 base64 内嵌在 embedded-assets.js 里，运行时不依赖 dist 目录
 *  - exe 是 GUI 子系统，没有控制台窗口，靠系统托盘图标操作
 */
import { ASSETS, APP_ICON_BASE64 } from './embedded-assets.js'
import { createApp } from './app.js'
import { DEFAULT_PORT, launch } from './launch.js'
import { startTray } from './tray.js'
import { log } from './logger.js'

const port = DEFAULT_PORT
let tray = null
let quitting = false

function quit() {
  if (quitting) return
  quitting = true
  try {
    tray?.stop()
  } catch {
    /* ignore */
  }
  log('仓管家已退出。')
  setTimeout(() => process.exit(0), 250)
}

launch(createApp({ assets: ASSETS }), {
  port,
  // WAREHOUSE_NO_BROWSER=1 可以禁止自动打开浏览器（排查问题时用）
  openBrowser: process.env.WAREHOUSE_NO_BROWSER !== '1',
  onReady: () => {
    tray = startTray({ iconBase64: APP_ICON_BASE64, port, quit })
  },
})
