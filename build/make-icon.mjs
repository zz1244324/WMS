/**
 * 由 build/icon.svg 生成多尺寸 build/icon.ico
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'
import pngToIco from 'png-to-ico'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const SVG = path.join(__dirname, 'icon.svg')
const OUT = path.join(__dirname, 'icon.ico')

const SIZES = [16, 24, 32, 48, 64, 128, 256]

export async function makeIcon() {
  const svg = fs.readFileSync(SVG)
  // 先栅格化到 512×512，再逐级缩放，边缘更干净
  const base = await sharp(svg, { density: 400 }).resize(512, 512).png().toBuffer()

  const pngs = []
  for (const size of SIZES) {
    pngs.push(await sharp(base).resize(size, size, { fit: 'contain' }).png({ compressionLevel: 9 }).toBuffer())
  }

  const ico = await pngToIco(pngs)
  fs.writeFileSync(OUT, ico)
  console.log(`[icon] 已生成 ${path.relative(process.cwd(), OUT)}（${SIZES.join('/')}，${(ico.length / 1024).toFixed(1)} KB）`)
  return OUT
}

// 直接执行时立即生成（被 build-exe.mjs 引入时由调用方决定）
if (process.argv[1] && process.argv[1].includes('make-icon')) {
  await makeIcon()
}
