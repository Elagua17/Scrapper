import { createApiHandler, executeMultiSearch } from '../server/scraperService.js'

export default createApiHandler(
  executeMultiSearch,
  'Error procesando la búsqueda multi-proveedor.'
)
