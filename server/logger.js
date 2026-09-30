/**
 * 日志：打包成 exe 后没有控制台窗口，所有信息写入
 *   %LOCALAPPDATA%\仓管家\logs\app.log
 * 源码运行时只输出到控制台。
 */
import fs from 'node:fs'
import path from 'node:path'
import { DATA_DIR, IS_PACKAGED } from './db.js'

const LOG_DIR = IS_PACKAGED ? path.join(path.dirname(DATA_DIR), 'logs') : null
export const LOG_FILE = LOG_DIR ? path.join(LOG_DIR, 'app.log') : null
const MAX_SIZE = 1024 * 1024

let stream = null

function getStream() {
  if (!LOG_FILE) return null
  if (stream) return stream
  try {
    fs.mkdirSync(LOG_DIR, { recursive: true })
    try {
      if (fs.statSync(LOG_FILE).size > MAX_SIZE) fs.rmSync(LOG_FILE, { force: true })
    } catch {
      /* 首次运行还没有日志文件 */
    }
    stream = fs.createWriteStream(LOG_FILE, { flags: 'a' })
    stream.on('error', () => {
      stream = null
    })
  } catch {
    stream = null
  }
  return stream
}

const stamp = () => {
  const d = new Date()
  const p = (x) => String(x).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`
}

export function log(...args) {
  const line = args
    .map((a) => {
      if (typeof a === 'string') return a
      if (a instanceof Error) return a.stack || a.message
      try {
        return JSON.stringify(a)
      } catch {
        return String(a)
      }
    })
    .join(' ')

  const s = getStream()
  if (s) s.write(`[${stamp()}] ${line}\n`)

  try {
    process.stdout.write(`${line}\n`)
  } catch {
    /* 没有控制台时忽略 */
  }
}

export function logError(err) {
  log('[错误]', err)
}
