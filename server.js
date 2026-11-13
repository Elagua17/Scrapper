import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  createApiHandler,
  executeMultiSearch,
  executeScrapeUrl
} from './server/scraperService.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const distDir = path.join(__dirname, 'dist')
const port = Number(process.env.PORT) || 3000

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon'
}

const multiSearchHandler = createApiHandler(
  executeMultiSearch,
  'Error procesando la búsqueda multi-proveedor.'
)
const scrapeHandler = createApiHandler(
  executeScrapeUrl,
  'No fue posible conectar con la página del proveedor.'
)

function serveStatic(reqPath, res) {
  const safePath = path.normalize(reqPath).replace(/^(\.\.[/\\])+/, '')
  let filePath = path.join(distDir, safePath === '/' ? 'index.html' : safePath)

  if (!filePath.startsWith(distDir) || !fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    filePath = path.join(distDir, 'index.html')
  }

  if (!fs.existsSync(filePath)) {
    res.statusCode = 404
    res.end('Build no encontrado. Ejecutá "npm run build" primero.')
    return
  }

  const ext = path.extname(filePath).toLowerCase()
  res.statusCode = 200
  res.setHeader('Content-Type', MIME_TYPES[ext] || 'application/octet-stream')
  fs.createReadStream(filePath).pipe(res)
}

const server = http.createServer(async (req, res) => {
  const urlPath = (req.url || '/').split('?')[0]
  if (urlPath === '/api/multi-search') {
    await multiSearchHandler(req, res)
    return
  }
  if (urlPath === '/api/scrape') {
    await scrapeHandler(req, res)
    return
  }
  serveStatic(urlPath, res)
})

server.listen(port, () => {
  console.log(`NEXPRICE server listening on http://localhost:${port}`)
})
