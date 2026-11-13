import { createApiHandler, executeScrapeUrl } from '../server/scraperService.js'

export default createApiHandler(
  executeScrapeUrl,
  'No fue posible conectar con la página del proveedor.'
)
