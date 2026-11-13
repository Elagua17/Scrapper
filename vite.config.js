import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { attachScraperMiddlewares } from './server/scraperService.js'

function scraperApiPlugin() {
  return {
    name: 'nexprice-scraper-middleware',
    configureServer(server) {
      attachScraperMiddlewares(server.middlewares)
    },
    configurePreviewServer(server) {
      attachScraperMiddlewares(server.middlewares)
    }
  }
}

export default defineConfig({
  plugins: [react(), scraperApiPlugin()],
  server: {
    port: 5173,
    host: true
  },
  preview: {
    port: 4173,
    host: true
  }
})
