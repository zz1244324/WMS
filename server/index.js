/**
 * 源码运行入口：npm start / npm run serve / npm run dev:api
 * 静态资源读同级的 dist 目录。
 */
import { createApp } from './app.js'
import { launch } from './launch.js'

launch(createApp(), {
  openBrowser: process.argv.includes('--open') && process.env.WAREHOUSE_NO_BROWSER !== '1',
})
