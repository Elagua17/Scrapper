import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const BUILTIN_PROVIDERS = [
  {
    id: 'carrefour',
    nombre: 'CARREFOUR',
    dominio: 'carrefour.com.ar',
    baseUrl: 'https://www.carrefour.com.ar'
  },
  {
    id: 'dia',
    nombre: 'DÍA ONLINE',
    dominio: 'diaonline.supermercadosdia.com.ar',
    baseUrl: 'https://diaonline.supermercadosdia.com.ar'
  },
  {
    id: 'masonline',
    nombre: 'CHANGOMÁS',
    dominio: 'masonline.com.ar',
    baseUrl: 'https://www.masonline.com.ar'
  },
  {
    id: 'vea',
    nombre: 'VEA',
    dominio: 'vea.com.ar',
    baseUrl: 'https://www.vea.com.ar'
  },
  {
    id: 'disco',
    nombre: 'DISCO',
    dominio: 'disco.com.ar',
    baseUrl: 'https://www.disco.com.ar'
  },
  {
    id: 'jumbo',
    nombre: 'JUMBO',
    dominio: 'jumbo.com.ar',
    baseUrl: 'https://www.jumbo.com.ar'
  }
]

/**
 * Calcula el precio unitario efectivo contemplando promociones de supermercados/proveedores
 * (ej. "2do al 50%" -> 25% off c/u, "2do al 70%" -> 35% off c/u, "2x1" -> 50% off, "3x2" -> 33.33% off)
 */
function calculateEffectivePromoPrice(basePrice, listPrice, promoName = '', explicitDiscountPct = 0) {
  let finalPrice = Number(basePrice || 0)
  if (finalPrice <= 0) return { finalPrice: 0, promoClean: '' }

  const cleanPromo = String(promoName || '')
    .replace(/^PROMO-/i, '')
    .replace(/-Reg.*$/i, '')
    .trim()

  if (explicitDiscountPct > 0 && explicitDiscountPct < 100) {
    finalPrice = Number((basePrice * (1 - explicitDiscountPct / 100)).toFixed(2))
    return { finalPrice, promoClean: cleanPromo }
  }

  // Analizar texto de la promo si existe
  const pLower = cleanPromo.toLowerCase()
  const match2do = pLower.match(/2do\s*al\s*(\d{1,2})\s*%/)
  if (match2do) {
    const secondUnitDiscount = parseFloat(match2do[1])
    const effectivePct = secondUnitDiscount / 2
    finalPrice = Number((basePrice * (1 - effectivePct / 100)).toFixed(2))
    return { finalPrice, promoClean: cleanPromo }
  }

  if (/\b2\s*x\s*1\b/.test(pLower)) {
    finalPrice = Number((basePrice * 0.5).toFixed(2))
    return { finalPrice, promoClean: cleanPromo }
  }
  if (/\b3\s*x\s*2\b/.test(pLower)) {
    finalPrice = Number(((basePrice * 2) / 3).toFixed(2))
    return { finalPrice, promoClean: cleanPromo }
  }
  if (/\b4\s*x\s*3\b/.test(pLower)) {
    finalPrice = Number(((basePrice * 3) / 4).toFixed(2))
    return { finalPrice, promoClean: cleanPromo }
  }
  if (/\b6\s*x\s*5\b/.test(pLower)) {
    finalPrice = Number(((basePrice * 5) / 6).toFixed(2))
    return { finalPrice, promoClean: cleanPromo }
  }

  return { finalPrice: Number(finalPrice.toFixed(2)), promoClean: cleanPromo }
}

async function fetchVtexSearchRaw(baseUrl, q) {
  const apiUrl = `${baseUrl}/api/catalog_system/pub/products/search?ft=${encodeURIComponent(
    q
  )}&_from=0&_to=24`
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 10000)
  try {
    const res = await fetch(apiUrl, {
      signal: controller.signal,
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
        Accept: 'application/json'
      }
    })
    clearTimeout(timeout)
    if (!res.ok) return []
    const data = await res.json()
    return Array.isArray(data) ? data : []
  } catch {
    clearTimeout(timeout)
    return []
  }
}

/**
 * Busca un término en un proveedor VTEX usando su API de catálogo en tiempo real
 */
async function searchVtexProvider(provider, queryText, limit = 5) {
  try {
    const normalizedQuery = String(queryText || '')
      .replace(/,/g, '.')
      .replace(/\s+/g, ' ')
      .trim()

    let data = await fetchVtexSearchRaw(provider.baseUrl, normalizedQuery)

    // Si la consulta completa con números/unidades no arrojó resultados directos, reintentar con las palabras principales
    if (data.length === 0) {
      const mainWords = normalizedQuery
        .split(/\s+/)
        .filter((w) => w.length >= 2)
        .slice(0, 2)
        .join(' ')
      if (mainWords && mainWords !== normalizedQuery) {
        data = await fetchVtexSearchRaw(provider.baseUrl, mainWords)
      }
    }

    if (data.length === 0) return []

    const queryTokens = normalizedQuery
      .toLowerCase()
      .split(/\s+/)
      .filter((t) => t.length >= 2)

    const items = []
    for (const p of data) {
      const skus = Array.isArray(p?.items) ? p.items : []
      // Buscar el primer SKU que tenga precio y stock, o en su defecto el que tenga precio > 0
      let selectedSku = null
      let selectedOffer = null

      for (const candidateSku of skus) {
        const seller =
          candidateSku?.sellers?.find((s) => s.sellerDefault) || candidateSku?.sellers?.[0]
        const offer = seller?.commertialOffer
        const price = Number(offer?.Price ?? offer?.spotPrice ?? 0)
        const qty = Number(offer?.AvailableQuantity ?? 0)
        if (price > 0 && qty > 0) {
          selectedSku = candidateSku
          selectedOffer = offer
          break
        }
        if (price > 0 && !selectedOffer) {
          selectedSku = candidateSku
          selectedOffer = offer
        }
      }

      if (!selectedSku || !selectedOffer) continue

      const basePrice = Number(selectedOffer?.Price ?? selectedOffer?.spotPrice ?? 0)
      let listPrice = Number(selectedOffer?.ListPrice ?? basePrice)
      if (listPrice > basePrice * 5) listPrice = basePrice
      const stock = Number(selectedOffer?.AvailableQuantity ?? 0)

      if (basePrice <= 0) continue

      const rawTeaserName =
        selectedOffer?.PromotionTeasers?.[0]?.Name ||
        selectedOffer?.Teasers?.[0]?.['<Name>k__BackingField'] ||
        selectedOffer?.Teasers?.[0]?.name ||
        ''

      const { finalPrice, promoClean } = calculateEffectivePromoPrice(
        basePrice,
        listPrice,
        rawTeaserName,
        0
      )

      const img = selectedSku?.images?.[0]?.imageUrl || ''
      const productUrl = p.link
        ? p.link.startsWith('http')
          ? p.link
          : `${provider.baseUrl}${p.link}`
        : `${provider.baseUrl}/${p.linkText}/p`

      const titleLower = String(p.productName || '')
        .toLowerCase()
        .replace(/,/g, '.')
      const matchedTokens = queryTokens.filter((tk) => titleLower.includes(tk)).length
      const relevanceScore = queryTokens.length > 0 ? matchedTokens / queryTokens.length : 1

      items.push({
        titulo: p.productName,
        marca: p.brand || '',
        descripcion: p.description || p.productName,
        especificaciones: `Marca: ${p.brand || 'S/D'} | Proveedor: ${provider.nombre}`,
        precio_fob: finalPrice,
        precio_origen: finalPrice,
        precio_lista: listPrice,
        promo_texto: promoClean,
        moneda_origen: 'ARS',
        stock: stock > 0 ? stock : 10,
        hasStock: stock > 0,
        url_imagen: img,
        url_origen: productUrl,
        dominio_proveedor: provider.dominio,
        nombre_proveedor: provider.nombre,
        termino_busqueda: queryText,
        relevanceScore
      })
    }

    // Ordenar priorizando coincidencia relevante, disponibilidad en stock y menor precio
    return items
      .sort((a, b) => {
        if (b.relevanceScore !== a.relevanceScore) return b.relevanceScore - a.relevanceScore
        if (a.hasStock !== b.hasStock) return a.hasStock ? -1 : 1
        return a.precio_fob - b.precio_fob
      })
      .slice(0, limit)
  } catch {
    return []
  }
}

function scraperApiPlugin() {
  return {
    name: 'nexprice-scraper-middleware',
    configureServer(server) {
      // =====================================================================
      // ENDPOINT 1: BÚSQUEDA MASIVA AUTOMÁTICA MULTI-PROVEEDOR (/api/multi-search)
      // Elimina el cuello de botella de buscar producto por producto en cada página
      // =====================================================================
      server.middlewares.use('/api/multi-search', async (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ ok: false, error: 'Use POST' }))
          return
        }

        let body = ''
        req.on('data', (chunk) => {
          body += chunk
        })

        req.on('end', async () => {
          try {
            const parsedBody = JSON.parse(body || '{}')
            const {
              queries = [],
              maxPerProvider = 3
            } = parsedBody
            const providerIds =
              parsedBody.providers ||
              parsedBody.providerIds || [
                'carrefour',
                'dia',
                'masonline',
                'vea',
                'disco',
                'jumbo'
              ]

            const cleanQueries = (Array.isArray(queries) ? queries : [queries])
              .map((q) => String(q || '').trim())
              .filter(Boolean)

            if (cleanQueries.length === 0) {
              res.statusCode = 400
              res.setHeader('Content-Type', 'application/json')
              res.end(
                JSON.stringify({
                  ok: false,
                  userMessage: 'Ingresá al menos un producto para buscar.'
                })
              )
              return
            }

            const activeProviders = BUILTIN_PROVIDERS.filter((p) =>
              providerIds.includes(p.id)
            )

            const allProducts = []
            const summaryByQuery = []

            for (const queryText of cleanQueries) {
              const perProviderResults = await Promise.all(
                activeProviders.map(async (prov) => {
                  const found = await searchVtexProvider(
                    prov,
                    queryText,
                    Number(maxPerProvider) || 3
                  )
                  return {
                    provider: prov.nombre,
                    items: found
                  }
                })
              )

              let countForQuery = 0
              perProviderResults.forEach((r) => {
                r.items.forEach((item) => {
                  countForQuery++
                  allProducts.push(item)
                })
              })

              summaryByQuery.push({
                query: queryText,
                totalFound: countForQuery
              })
            }

            res.statusCode = 200
            res.setHeader('Content-Type', 'application/json')
            res.end(
              JSON.stringify({
                ok: allProducts.length > 0,
                count: allProducts.length,
                summaryByQuery,
                products: allProducts,
                userMessage:
                  allProducts.length > 0
                    ? `Búsqueda automática completada: ${allProducts.length} opciones encontradas en ${activeProviders.length} proveedores.`
                    : 'No se encontraron coincidencias para los productos buscados.'
              })
            )
          } catch (err) {
            res.statusCode = 200
            res.setHeader('Content-Type', 'application/json')
            res.end(
              JSON.stringify({
                ok: false,
                products: [],
                userMessage: 'Error procesando la búsqueda multi-proveedor.',
                technicalDetail: err?.message
              })
            )
          }
        })
      })

      // =====================================================================
      // ENDPOINT 2: EXTRACCIÓN POR URL DIRECTA (/api/scrape)
      // =====================================================================
      server.middlewares.use('/api/scrape', async (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ ok: false, error: 'Método no permitido. Use POST.' }))
          return
        }

        let body = ''
        req.on('data', (chunk) => {
          body += chunk
        })

        req.on('end', async () => {
          try {
            const { url } = JSON.parse(body || '{}')
            if (!url || !/^https?:\/\//i.test(url)) {
              res.statusCode = 400
              res.setHeader('Content-Type', 'application/json')
              res.end(
                JSON.stringify({
                  ok: false,
                  userMessage:
                    'La dirección web ingresada no es válida (debe comenzar con http:// o https://).'
                })
              )
              return
            }

            const parsedUrl = new URL(url)
            const domain = parsedUrl.hostname.replace(/^www\./i, '')
            const providerName = domain.split('.')[0].toUpperCase()

            const controller = new AbortController()
            const timeout = setTimeout(() => controller.abort(), 18000)

            const response = await fetch(url, {
              signal: controller.signal,
              headers: {
                'User-Agent':
                  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
                Accept:
                  'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                'Accept-Language': 'es-AR,es;q=0.9,en-US;q=0.8,en;q=0.7'
              }
            })
            clearTimeout(timeout)

            if (!response.ok) {
              res.statusCode = 200
              res.setHeader('Content-Type', 'application/json')
              res.end(
                JSON.stringify({
                  ok: false,
                  status: response.status,
                  domain,
                  userMessage: `El sitio del proveedor (${domain}) respondió con estado ${response.status}.`
                })
              )
              return
            }

            const html = await response.text()

            const cleanText = (str = '') =>
              String(str)
                .replace(/<script[\s\S]*?<\/script>/gi, ' ')
                .replace(/<style[\s\S]*?<\/style>/gi, ' ')
                .replace(/<[^>]*>/g, ' ')
                .replace(/&amp;/g, '&')
                .replace(/&quot;/g, '"')
                .replace(/&#39;|&apos;/g, "'")
                .replace(/&lt;/g, '<')
                .replace(/&gt;/g, '>')
                .replace(/&nbsp;/g, ' ')
                .replace(/\s+/g, ' ')
                .trim()

            const resolveUrl = (rawHref = '') => {
              if (!rawHref) return ''
              const trimmed = rawHref.trim()
              if (trimmed.startsWith('data:')) return ''
              if (/^https?:\/\//i.test(trimmed)) return trimmed
              if (trimmed.startsWith('//')) return `${parsedUrl.protocol}${trimmed}`
              if (trimmed.startsWith('/')) return `${parsedUrl.origin}${trimmed}`
              return `${parsedUrl.origin}/${trimmed}`
            }

            const parseNumericPrice = (val) => {
              if (typeof val === 'number') return Number(val.toFixed(2))
              if (!val) return 0
              let s = String(val).replace(/[^\d.,]/g, '').trim()
              if (!s) return 0
              const lastComma = s.lastIndexOf(',')
              const lastDot = s.lastIndexOf('.')
              if (lastComma > -1 && lastDot > -1) {
                if (lastComma > lastDot) {
                  s = s.replace(/\./g, '').replace(',', '.')
                } else {
                  s = s.replace(/,/g, '')
                }
              } else if (lastComma > -1) {
                const decimals = s.length - lastComma - 1
                if (decimals === 2 || decimals === 1) s = s.replace(',', '.')
                else s = s.replace(/,/g, '')
              } else if (lastDot > -1) {
                const parts = s.split('.')
                if (
                  parts.length > 2 ||
                  (parts.length === 2 && parts[1].length === 3 && domain.endsWith('.ar'))
                ) {
                  s = s.replace(/\./g, '')
                }
              }
              const num = parseFloat(s)
              return Number.isFinite(num) ? Number(num.toFixed(2)) : 0
            }

            const defaultCurrency = domain.endsWith('.ar') ? 'ARS' : 'USD'
            const extractedProducts = []
            const seenKeys = new Set()

            const pushProduct = (rawProd) => {
              const titulo = cleanText(rawProd.titulo || '').slice(0, 180)
              if (!titulo || titulo.length < 3) return
              if (
                /^(inicio|home|carrito|login|mi cuenta|categor[ií]as|buscar|contacto|ver m[aá]s)$/i.test(
                  titulo
                )
              ) {
                return
              }

              const precioFinal = parseNumericPrice(rawProd.precio_fob ?? rawProd.precio_origen)
              if (precioFinal <= 0) return

              const precioLista = parseNumericPrice(rawProd.precio_lista || precioFinal)
              const resolvedProductUrl = resolveUrl(rawProd.url_origen || url) || url
              const dedupeKey = `${resolvedProductUrl}_${titulo.toLowerCase()}_${precioFinal}`
              if (seenKeys.has(dedupeKey)) return
              seenKeys.add(dedupeKey)

              extractedProducts.push({
                titulo,
                descripcion: cleanText(rawProd.descripcion || titulo).slice(0, 400),
                especificaciones: cleanText(
                  rawProd.especificaciones ||
                    `${rawProd.marca ? `Marca: ${rawProd.marca} | ` : ''}Proveedor: ${providerName}`
                ),
                precio_origen: precioFinal,
                precio_lista: precioLista,
                promo_texto: rawProd.promo_texto || '',
                moneda_origen: rawProd.moneda_origen || defaultCurrency,
                precio_fob: precioFinal,
                stock: Number(rawProd.stock ?? 25),
                url_imagen: resolveUrl(rawProd.url_imagen || ''),
                url_origen: resolvedProductUrl,
                dominio_proveedor: domain,
                nombre_proveedor: providerName,
                reputacion_vendedor: rawProd.reputacion_vendedor || null
              })
            }

            // ESTRATEGIA 1: Tiendas VTEX IO (__STATE__)
            const vtexStateMatch =
              html.match(
                /<template[^>]*data-varname=["']__STATE__["'][^>]*>\s*<script[^>]*>([\s\S]*?)<\/script>\s*<\/template>/i
              ) || html.match(/__STATE__\s*=\s*(\{[\s\S]*?\})\s*<\/script>/i)

            if (vtexStateMatch && vtexStateMatch[1]) {
              try {
                const state = JSON.parse(vtexStateMatch[1])
                const allKeys = Object.keys(state)
                const prodKeys = allKeys.filter(
                  (k) => k.startsWith('Product:') && !k.includes('.') && state[k]?.productName
                )

                for (const pk of prodKeys) {
                  const p = state[pk]
                  const offerKey = allKeys.find(
                    (k) => k.includes(pk) && k.endsWith('.commertialOffer')
                  )
                  const offer = offerKey ? state[offerKey] : null
                  const basePrice = Number(offer?.Price ?? offer?.spotPrice ?? 0)
                  let listPrice = Number(offer?.ListPrice ?? basePrice)
                  if (listPrice > basePrice * 5) listPrice = basePrice
                  const stock = Number(offer?.AvailableQuantity ?? 0)

                  if (basePrice <= 0 || stock <= 0) continue

                  let explicitPct = 0
                  const discountParamKey = allKeys.find(
                    (k) =>
                      k.includes(pk) &&
                      k.includes('.commertialOffer.teasers.') &&
                      state[k]?.name === 'PercentualDiscount'
                  )
                  if (discountParamKey) {
                    explicitPct = parseFloat(state[discountParamKey].value) || 0
                  }

                  let rawPromoName = ''
                  const teaserKey = allKeys.find(
                    (k) => k.includes(pk) && /\.commertialOffer\.teasers\.\d+$/.test(k)
                  )
                  if (teaserKey && state[teaserKey]?.name) {
                    rawPromoName = state[teaserKey].name
                  }

                  const { finalPrice, promoClean } = calculateEffectivePromoPrice(
                    basePrice,
                    listPrice,
                    rawPromoName,
                    explicitPct
                  )

                  let imageUrl = ''
                  const skuKey = allKeys.find(
                    (k) => k.startsWith(`${pk}.items`) && state[k]?.__typename === 'SKU'
                  )
                  if (
                    skuKey &&
                    Array.isArray(state[skuKey].images) &&
                    state[skuKey].images[0]?.id
                  ) {
                    const imgNode = state[state[skuKey].images[0].id]
                    if (imgNode?.imageUrl) imageUrl = imgNode.imageUrl
                  }

                  pushProduct({
                    titulo: p.productName,
                    marca: p.brand,
                    descripcion: p.description || p.productName,
                    precio_fob: finalPrice,
                    precio_origen: finalPrice,
                    precio_lista: listPrice,
                    promo_texto: promoClean,
                    stock: stock > 0 ? stock : 25,
                    url_imagen: imageUrl,
                    url_origen: p.link ? `${parsedUrl.origin}${p.link}` : url
                  })
                }
              } catch {
                // ignore
              }
            }

            // ESTRATEGIA 2: JSON-LD
            if (extractedProducts.length === 0) {
              const ldMatches = html.matchAll(
                /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi
              )
              const extractFromJsonLdNode = (node) => {
                if (!node || typeof node !== 'object') return
                if (Array.isArray(node)) {
                  node.forEach(extractFromJsonLdNode)
                  return
                }
                if (node['@graph'] && Array.isArray(node['@graph'])) {
                  node['@graph'].forEach(extractFromJsonLdNode)
                }
                if (node.itemListElement && Array.isArray(node.itemListElement)) {
                  node.itemListElement.forEach((el) => {
                    if (el?.item) extractFromJsonLdNode(el.item)
                    else extractFromJsonLdNode(el)
                  })
                }

                const type = node['@type']
                const isProduct =
                  type === 'Product' || (Array.isArray(type) && type.includes('Product'))
                if (isProduct && node.name) {
                  const offers = node.offers
                  const offerObj = Array.isArray(offers)
                    ? offers[0]
                    : offers?.offers
                    ? Array.isArray(offers.offers)
                      ? offers.offers[0]
                      : offers.offers
                    : offers

                  const rawPrice =
                    offerObj?.price ?? offerObj?.lowPrice ?? offerObj?.highPrice ?? node.price ?? 0

                  let img = ''
                  if (typeof node.image === 'string') img = node.image
                  else if (Array.isArray(node.image)) {
                    img =
                      typeof node.image[0] === 'string'
                        ? node.image[0]
                        : node.image[0]?.url || ''
                  } else if (node.image?.url) {
                    img = node.image.url
                  }

                  pushProduct({
                    titulo: node.name,
                    descripcion: node.description || node.name,
                    precio_origen: rawPrice,
                    url_imagen: img,
                    url_origen: offerObj?.url || node.url || url
                  })
                }
              }

              for (const match of ldMatches) {
                try {
                  extractFromJsonLdNode(JSON.parse(match[1].trim()))
                } catch {
                  // ignore
                }
              }
            }

            // ESTRATEGIA 3: Tarjetas HTML genéricas
            if (extractedProducts.length === 0) {
              const parseHtmlCard = (cardHtml) => {
                let title = ''
                const titlePatterns = [
                  /<h[234][^>]*>([\s\S]*?)<\/h[234]>/i,
                  /class=["'][^"']*(?:poly-component__title|ui-search-item__title|product-title|product__title|item-title|card-title)[^"']*["'][^>]*>([\s\S]*?)<\//i,
                  /<a[^>]+title=["']([^"']{5,160})["'][^>]*>/i,
                  /<img[^>]+alt=["']([^"']{5,160})["'][^>]*>/i
                ]
                for (const tp of titlePatterns) {
                  const m = cardHtml.match(tp)
                  if (m && m[1]) {
                    const candidate = cleanText(m[1])
                    if (candidate.length >= 4) {
                      title = candidate
                      break
                    }
                  }
                }
                if (!title) return

                let rawPrice = null
                const pricePatterns = [
                  /class=["'][^"']*andes-money-amount__fraction[^"']*["'][^>]*>([\d.,]+)</i,
                  /itemprop=["']price["'][^>]*content=["']([\d.,]+)["']/i,
                  /data-price=["']([\d.,]+)["']/i,
                  /(?:USD|U\$S|US\$|\$|€)\s*(\d{1,3}(?:[.,]\d{3})*(?:[.,]\d{1,2})?)/i
                ]
                for (const pp of pricePatterns) {
                  const pm = cardHtml.match(pp)
                  if (pm && pm[1]) {
                    rawPrice = pm[1]
                    break
                  }
                }
                if (!rawPrice) return

                const hrefMatch = cardHtml.match(/<a[^>]+href=["']([^"'#]+)["']/i)
                const imgMatch =
                  cardHtml.match(
                    /<img[^>]+(?:data-src|data-lazy-src|src)=["']([^"']+)["']/i
                  ) || cardHtml.match(/<img[^>]+src=["']([^"']+)["']/i)

                pushProduct({
                  titulo: title,
                  precio_origen: rawPrice,
                  url_imagen: imgMatch ? imgMatch[1] : '',
                  url_origen: hrefMatch ? hrefMatch[1] : url
                })
              }

              const cardBlocks = [
                ...html.matchAll(
                  /<li[^>]+class=["'][^"']*(?:ui-search-layout__item|product|item|grid__item|cell)[^"']*["'][^>]*>([\s\S]*?)<\/li>/gi
                ),
                ...html.matchAll(/<article[^>]*>([\s\S]*?)<\/article>/gi)
              ]

              for (const match of cardBlocks) {
                if (extractedProducts.length >= 80) break
                parseHtmlCard(match[0])
              }
            }

            res.statusCode = 200
            res.setHeader('Content-Type', 'application/json')
            res.end(
              JSON.stringify({
                ok: extractedProducts.length > 0,
                domain,
                providerName,
                count: extractedProducts.length,
                products: extractedProducts,
                userMessage:
                  extractedProducts.length > 0
                    ? `Se extrajeron ${extractedProducts.length} producto(s) desde ${domain}.`
                    : `No se encontraron productos públicos legibles en ${domain}.`
              })
            )
          } catch (error) {
            res.statusCode = 200
            res.setHeader('Content-Type', 'application/json')
            res.end(
              JSON.stringify({
                ok: false,
                products: [],
                userMessage: 'No fue posible conectar con la página del proveedor.',
                technicalDetail: error?.message || 'Fetch error'
              })
            )
          }
        })
      })
    }
  }
}

export default defineConfig({
  plugins: [react(), scraperApiPlugin()],
  server: {
    port: 5173,
    host: true
  }
})
