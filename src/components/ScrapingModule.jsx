import React, { useState, useRef, useMemo } from 'react'
import {
  Globe,
  Search,
  Play,
  Pause,
  Square,
  Plus,
  Trash2,
  Clock,
  Terminal,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  ExternalLink,
  Edit3,
  Image as ImageIcon,
  RefreshCw,
  Sparkles,
  PackagePlus,
  CheckSquare,
  Square as SquareIcon,
  FileSpreadsheet,
  Tag,
  Award,
  Layers,
  Zap,
  ArrowRight
} from 'lucide-react'

const formatMoney = (val) =>
  Number(val || 0).toLocaleString('es-AR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })

const AVAILABLE_PROVIDERS = [
  { id: 'carrefour', name: 'Carrefour', domain: 'carrefour.com.ar' },
  { id: 'dia', name: 'Día Online', domain: 'diaonline.supermercadosdia.com.ar' },
  { id: 'masonline', name: 'Changomás', domain: 'masonline.com.ar' },
  { id: 'vea', name: 'Vea', domain: 'vea.com.ar' },
  { id: 'disco', name: 'Disco', domain: 'disco.com.ar' },
  { id: 'jumbo', name: 'Jumbo', domain: 'jumbo.com.ar' }
]

export default function ScrapingModule({
  productos,
  dominios,
  tareasProgramadas,
  logsScraping,
  cotizacionDolar,
  onSaveProduct,
  onSaveMultipleProducts,
  onDeleteProduct,
  onClearAllProducts,
  onAddDominio,
  onDeleteDominio,
  onAddTarea,
  onDeleteTarea,
  onToggleTarea,
  onAddLog,
  onClearLogs,
  onCompareSelectedProducts,
  onCreateListWithProducts
}) {
  const [activeSubTab, setActiveSubTab] = useState('multi')

  // Estado Buscador Masivo Multi-Proveedor
  const [searchQueriesText, setSearchQueriesText] = useState('')
  const [selectedProviders, setSelectedProviders] = useState(
    AVAILABLE_PROVIDERS.map((p) => p.id)
  )
  const [maxPerProvider, setMaxPerProvider] = useState(2)
  const [activeTermFilter, setActiveTermFilter] = useState('TODOS')

  // Estado Extracción por Links Directos
  const [urlsText, setUrlsText] = useState('')
  const [keywordFilter, setKeywordFilter] = useState('')
  const [categoriaDefault, setCategoriaDefault] = useState('General')
  const [paisDefault, setPaisDefault] = useState('Argentina')
  const [pesoDefault] = useState('0.5')
  const [plazoDefault] = useState('2')

  const [selectedIds, setSelectedIds] = useState([])

  const [jobState, setJobState] = useState({
    running: false,
    paused: false,
    progress: 0,
    total: 0,
    currentIndex: 0,
    currentUrl: '',
    extractedCount: 0,
    statusText: 'Listo para buscar'
  })
  const pauseRef = useRef(false)
  const cancelRef = useRef(false)

  const [editingProduct, setEditingProduct] = useState(null)

  const [domForm, setDomForm] = useState({
    dominio: '',
    nombre: '',
    palabras_clave: '',
    categoria_objetivo: ''
  })
  const [taskForm, setTaskForm] = useState({
    nombre: '',
    dias: 'Lunes, Miércoles, Viernes',
    horario: '08:00',
    dominio_asociado: ''
  })

  // Agrupación automática por producto buscado para mostrar el más barato de cada uno
  const gruposPorBusqueda = useMemo(() => {
    const map = new Map()
    productos.forEach((p) => {
      const term = (p.termino_busqueda || '').trim()
      if (!term) return
      const key = term.toLowerCase()
      if (!map.has(key)) {
        map.set(key, {
          label: term,
          items: []
        })
      }
      map.get(key).items.push(p)
    })

    const result = []
    map.forEach((group) => {
      const sorted = [...group.items].sort(
        (a, b) => Number(a.precio_fob || 0) - Number(b.precio_fob || 0)
      )
      const cheapest = sorted[0] || null
      const mostExpensive = sorted.length > 1 ? sorted[sorted.length - 1] : null
      const uniqueProviders = new Set(
        sorted.map((i) => i.nombre_proveedor || i.dominio_proveedor)
      ).size
      result.push({
        label: group.label,
        items: sorted,
        cheapest,
        mostExpensive,
        uniqueProviders
      })
    })
    return result
  }, [productos])

  const productosVisibles = useMemo(() => {
    if (activeTermFilter === 'TODOS') return productos
    return productos.filter(
      (p) => (p.termino_busqueda || '').trim().toLowerCase() === activeTermFilter.toLowerCase()
    )
  }, [productos, activeTermFilter])

  const toggleProvider = (id) => {
    setSelectedProviders((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    )
  }

  const waitIfPaused = async () => {
    while (pauseRef.current && !cancelRef.current) {
      await new Promise((r) => setTimeout(r, 250))
    }
  }

  // BÚSQUEDA AUTOMÁTICA MULTI-PROVEEDOR (Resuelve el cuello de botella manual)
  const handleRunMultiSearch = async (e) => {
    if (e) e.preventDefault()
    const queries = searchQueriesText
      .split(/\r?\n/)
      .map((q) => q.trim())
      .filter(Boolean)

    if (queries.length === 0 || selectedProviders.length === 0) return

    pauseRef.current = false
    cancelRef.current = false

    setJobState({
      running: true,
      paused: false,
      progress: 5,
      total: queries.length,
      currentIndex: 0,
      currentUrl: `Consultando ${selectedProviders.length} proveedores en simultáneo...`,
      extractedCount: 0,
      statusText: `Buscando ${queries.length} producto(s) en ${selectedProviders.length} proveedores a la vez...`
    })

    let totalExtractedInRun = 0

    for (let i = 0; i < queries.length; i++) {
      if (cancelRef.current) break
      await waitIfPaused()
      if (cancelRef.current) break

      const query = queries[i]
      setJobState((prev) => ({
        ...prev,
        currentIndex: i + 1,
        currentUrl: `Producto: "${query}" (${selectedProviders.length} proveedores en paralelo)`,
        progress: Math.round((i / queries.length) * 100),
        statusText: `Buscando "${query}" (${i + 1} de ${queries.length}) en todos los proveedores...`
      }))

      try {
        const res = await fetch('/api/multi-search', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            queries: [query],
            providers: selectedProviders,
            maxPerProvider: Number(maxPerProvider) || 2
          })
        })
        const payload = await res.json()

        const foundProducts = Array.isArray(payload.products) ? payload.products : []
        if (payload.ok && foundProducts.length > 0) {
          const itemsToSave = foundProducts.map((d) => ({
            titulo: d.titulo,
            descripcion: d.descripcion,
            especificaciones: d.especificaciones,
            precio_fob: d.precio_fob,
            precio_origen: d.precio_origen,
            precio_lista: d.precio_lista || d.precio_fob,
            promo_texto: d.promo_texto || '',
            moneda_origen: d.moneda_origen || 'ARS',
            stock: d.stock ?? 25,
            url_imagen: d.url_imagen,
            url_origen: d.url_origen,
            dominio_proveedor: d.dominio_proveedor,
            nombre_proveedor: d.nombre_proveedor,
            reputacion_vendedor: d.reputacion_vendedor || 4.8,
            termino_busqueda: query,
            categoria: categoriaDefault || query,
            pais_origen: paisDefault,
            peso_kg: Number(pesoDefault) || 0.5,
            volumen_m3: 0.01,
            plazo_logistico_dias: Number(plazoDefault) || 2
          }))

          onSaveMultipleProducts(itemsToSave)
          totalExtractedInRun += itemsToSave.length

          const sortedByPrice = [...itemsToSave].sort((a, b) => a.precio_fob - b.precio_fob)
          const winner = sortedByPrice[0]

          onAddLog({
            nivel: 'SUCCESS',
            url: `Búsqueda: "${query}"`,
            mensaje: `Se encontraron ${itemsToSave.length} opciones para "${query}". Proveedor más barato: ${winner.nombre_proveedor} ($ ${formatMoney(winner.precio_fob)}).`
          })
        } else {
          onAddLog({
            nivel: 'WARN',
            url: `Búsqueda: "${query}"`,
            mensaje: `No se encontraron coincidencias directas para "${query}" en los proveedores seleccionados.`
          })
        }
      } catch {
        onAddLog({
          nivel: 'ERROR',
          url: `Búsqueda: "${query}"`,
          mensaje: `Error de red al consultar proveedores para "${query}".`
        })
      }

      setJobState((prev) => ({
        ...prev,
        extractedCount: totalExtractedInRun,
        progress: Math.round(((i + 1) / queries.length) * 100)
      }))
    }

    setJobState((prev) => ({
      ...prev,
      running: false,
      paused: false,
      extractedCount: totalExtractedInRun,
      progress: cancelRef.current ? prev.progress : 100,
      statusText: cancelRef.current
        ? 'Búsqueda cancelada'
        : `Búsqueda finalizada: ${totalExtractedInRun} ofertas obtenidas en paralelo`
    }))
  }

  // EXTRACCIÓN DESDE LINKS DIRECTOS
  const handleRunExtraction = async (e) => {
    if (e) e.preventDefault()
    const rawList = urlsText
      .split(/\r?\n/)
      .map((u) => u.trim())
      .filter(Boolean)

    if (rawList.length === 0) return

    pauseRef.current = false
    cancelRef.current = false

    setJobState({
      running: true,
      paused: false,
      progress: 0,
      total: rawList.length,
      currentIndex: 0,
      currentUrl: rawList[0],
      extractedCount: 0,
      statusText: 'Escaneando páginas en busca de productos...'
    })

    let totalExtractedInRun = 0

    for (let i = 0; i < rawList.length; i++) {
      if (cancelRef.current) {
        onAddLog({
          nivel: 'WARN',
          url: rawList[i],
          mensaje: 'Proceso de extracción cancelado manualmente.'
        })
        break
      }

      await waitIfPaused()
      if (cancelRef.current) break

      const targetUrl = rawList[i]
      setJobState((prev) => ({
        ...prev,
        currentIndex: i + 1,
        currentUrl: targetUrl,
        progress: Math.round((i / rawList.length) * 100),
        statusText: `Analizando página (${i + 1} de ${rawList.length}) y extrayendo productos...`
      }))

      try {
        const res = await fetch('/api/scrape', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            url: targetUrl,
            exchangeRateARS: cotizacionDolar || 1050
          })
        })
        const payload = await res.json()

        await waitIfPaused()
        if (cancelRef.current) break

        const pageProducts = Array.isArray(payload.products) ? payload.products : []
        const filterKw = keywordFilter.trim().toLowerCase()
        const filteredPageProducts = filterKw
          ? pageProducts.filter((item) => item.titulo?.toLowerCase().includes(filterKw))
          : pageProducts

        if (payload.ok && filteredPageProducts.length > 0) {
          const itemsToSave = filteredPageProducts.map((d) => ({
            titulo: d.titulo,
            descripcion: d.descripcion,
            especificaciones: d.especificaciones,
            precio_fob: d.precio_fob,
            precio_origen: d.precio_origen,
            precio_lista: d.precio_lista || d.precio_fob,
            promo_texto: d.promo_texto || '',
            moneda_origen: d.moneda_origen,
            stock: d.stock ?? 25,
            url_imagen: d.url_imagen,
            url_origen: d.url_origen || targetUrl,
            dominio_proveedor: d.dominio_proveedor,
            nombre_proveedor: d.nombre_proveedor,
            reputacion_vendedor: d.reputacion_vendedor,
            categoria: categoriaDefault,
            pais_origen: paisDefault,
            peso_kg: Number(pesoDefault) || 0.5,
            volumen_m3: 0.01,
            plazo_logistico_dias: Number(plazoDefault) || 2
          }))

          onSaveMultipleProducts(itemsToSave)
          totalExtractedInRun += itemsToSave.length

          onAddLog({
            nivel: 'SUCCESS',
            url: targetUrl,
            mensaje: `Se extrajeron ${itemsToSave.length} producto(s) desde ${payload.domain || targetUrl}.`
          })
        } else {
          let hostname = 'proveedor.com'
          try {
            hostname = new URL(targetUrl).hostname.replace(/^www\./i, '')
          } catch {
            // ignore
          }
          onAddLog({
            nivel: 'WARN',
            url: targetUrl,
            mensaje:
              payload.userMessage ||
              `No se detectaron productos públicos directos en ${hostname}.`
          })
        }
      } catch {
        onAddLog({
          nivel: 'ERROR',
          url: targetUrl,
          mensaje: 'Ocurrió un fallo de conexión al intentar leer la página del proveedor.'
        })
      }

      setJobState((prev) => ({
        ...prev,
        extractedCount: totalExtractedInRun,
        progress: Math.round(((i + 1) / rawList.length) * 100)
      }))
    }

    setJobState((prev) => ({
      ...prev,
      running: false,
      paused: false,
      extractedCount: totalExtractedInRun,
      progress: cancelRef.current ? prev.progress : 100,
      statusText: cancelRef.current
        ? 'Proceso cancelado'
        : `Extracción finalizada: ${totalExtractedInRun} producto(s) obtenidos`
    }))
  }

  const handleTogglePause = () => {
    pauseRef.current = !pauseRef.current
    setJobState((prev) => ({
      ...prev,
      paused: pauseRef.current,
      statusText: pauseRef.current ? 'Proceso en pausa...' : 'Reanudando...'
    }))
  }

  const handleCancelJob = () => {
    cancelRef.current = true
    pauseRef.current = false
  }

  const handleOpenManualModal = () => {
    const firstUrl = urlsText.split(/\r?\n/).map((u) => u.trim()).find(Boolean) || ''
    let domain = 'proveedor.com'
    try {
      if (firstUrl) domain = new URL(firstUrl).hostname.replace(/^www\./i, '')
    } catch {
      // ignore
    }
    setEditingProduct({
      titulo: '',
      descripcion: '',
      especificaciones: '',
      precio_fob: '',
      precio_origen: '',
      moneda_origen: 'ARS',
      stock: 25,
      url_imagen: '',
      url_origen: firstUrl,
      dominio_proveedor: domain,
      nombre_proveedor: domain.split('.')[0].toUpperCase(),
      reputacion_vendedor: 4.8,
      categoria: categoriaDefault,
      pais_origen: paisDefault,
      peso_kg: Number(pesoDefault) || 0.5,
      volumen_m3: 0.01,
      plazo_logistico_dias: Number(plazoDefault) || 2
    })
  }

  const handleSaveEditedProduct = (e) => {
    e.preventDefault()
    if (!editingProduct) return
    onSaveProduct({
      ...editingProduct,
      precio_fob: Number(editingProduct.precio_fob) || 0,
      stock: Number(editingProduct.stock) || 0,
      peso_kg: Number(editingProduct.peso_kg) || 0,
      volumen_m3: Number(editingProduct.volumen_m3) || 0,
      plazo_logistico_dias: Number(editingProduct.plazo_logistico_dias) || 2,
      reputacion_vendedor: editingProduct.reputacion_vendedor
        ? Number(editingProduct.reputacion_vendedor)
        : null
    })
    setEditingProduct(null)
  }

  const toggleSelect = (id) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    )
  }

  const toggleSelectAll = () => {
    const visibleIds = productosVisibles.map((p) => p.id_producto)
    const allSelected =
      visibleIds.length > 0 && visibleIds.every((id) => selectedIds.includes(id))
    if (allSelected) {
      setSelectedIds((prev) => prev.filter((id) => !visibleIds.includes(id)))
    } else {
      setSelectedIds((prev) => Array.from(new Set([...prev, ...visibleIds])))
    }
  }

  const handlePassAllCheapestWinners = () => {
    const winnerIds = gruposPorBusqueda
      .map((g) => g.cheapest?.id_producto)
      .filter(Boolean)
    if (winnerIds.length > 0) {
      onCreateListWithProducts(winnerIds)
    }
  }

  return (
    <div className="space-y-6">
      <div className="nexus-card rounded-3xl p-6 border-l-4 border-l-[#FF5500] flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <span className="text-[11px] font-mono uppercase tracking-widest px-2.5 py-0.5 rounded-full bg-orange-50 text-[#FF5500] border border-orange-200 font-semibold">
            AUTOMATIZACIÓN DE BÚSQUEDA Y EXTRACCIÓN EN PARALELO
          </span>
          <h2 className="font-display text-2xl font-bold text-slate-900 mt-1">
            Buscador Masivo Multi-Proveedor y Extractor por Links
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Escribí tu lista de productos una sola vez para que el sistema recorra todos los
            proveedores simultáneamente sin entrar página por página, o pegá links directos de
            catálogos.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 bg-slate-100 p-1.5 rounded-2xl border border-slate-200">
          <button
            type="button"
            onClick={() => setActiveSubTab('multi')}
            className={`px-3.5 py-2 rounded-xl text-xs font-semibold transition flex items-center gap-1.5 ${
              activeSubTab === 'multi'
                ? 'bg-[#FF5500] text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Zap className="w-3.5 h-3.5" />
            <span>Buscador Multi-Proveedor</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSubTab('urls')}
            className={`px-3.5 py-2 rounded-xl text-xs font-semibold transition flex items-center gap-1.5 ${
              activeSubTab === 'urls'
                ? 'bg-[#FF5500] text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Globe className="w-3.5 h-3.5" />
            <span>Extraer por Links</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSubTab('config')}
            className={`px-3.5 py-2 rounded-xl text-xs font-semibold transition flex items-center gap-1.5 ${
              activeSubTab === 'config'
                ? 'bg-[#FF5500] text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>Proveedores y Tareas</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSubTab('logs')}
            className={`px-3.5 py-2 rounded-xl text-xs font-semibold transition flex items-center gap-1.5 ${
              activeSubTab === 'logs'
                ? 'bg-[#FF5500] text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Terminal className="w-3.5 h-3.5" />
            <span>Actividad ({logsScraping.length})</span>
          </button>
        </div>
      </div>

      {(activeSubTab === 'multi' || activeSubTab === 'urls') && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Panel Izquierdo */}
          <div className="lg:col-span-5 space-y-5">
            {activeSubTab === 'multi' ? (
              <div className="nexus-card rounded-3xl p-6 space-y-4">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <span className="text-[10px] font-mono uppercase tracking-widest text-[#FF5500] font-bold">
                      SIN BUSCAR LINKS MANUALMENTE
                    </span>
                    <h3 className="font-display text-lg font-bold text-slate-900">
                      Lista de Productos a Cotizar
                    </h3>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      setSearchQueriesText(
                        'Cerveza Stella Artois 473\nCoca Cola 2.25\nFernet Branca 750'
                      )
                    }
                    className="text-[11px] font-semibold text-[#FF5500] hover:bg-orange-50 px-2.5 py-1.5 rounded-xl border border-orange-200 transition"
                  >
                    Cargar Ejemplo (3 prod.)
                  </button>
                </div>

                <form onSubmit={handleRunMultiSearch} className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                      Escribí 1 o varios productos (uno por línea):
                    </label>
                    <textarea
                      rows={4}
                      value={searchQueriesText}
                      onChange={(e) => setSearchQueriesText(e.target.value)}
                      placeholder={
                        'Cerveza Stella Artois 473\nCoca Cola 2.25\nFernet Branca 750\nYerba Playadito 1 kg'
                      }
                      className="w-full p-3.5 rounded-2xl bg-slate-50 border border-slate-200 font-mono text-xs text-slate-900 focus:outline-none focus:border-[#FF5500] focus:bg-white transition"
                    />
                    <p className="text-[11px] text-slate-500 mt-1">
                      El motor consulta todos los proveedores seleccionados al mismo tiempo y
                      calcula automáticamente cuál tiene el menor costo para cada producto.
                    </p>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="text-[11px] font-semibold uppercase text-slate-600">
                        Proveedores a consultar en simultáneo ({selectedProviders.length}/
                        {AVAILABLE_PROVIDERS.length})
                      </label>
                      <button
                        type="button"
                        onClick={() =>
                          setSelectedProviders(
                            selectedProviders.length === AVAILABLE_PROVIDERS.length
                              ? []
                              : AVAILABLE_PROVIDERS.map((p) => p.id)
                          )
                        }
                        className="text-[11px] font-semibold text-[#FF5500] hover:underline"
                      >
                        {selectedProviders.length === AVAILABLE_PROVIDERS.length
                          ? 'Desmarcar todos'
                          : 'Marcar todos'}
                      </button>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {AVAILABLE_PROVIDERS.map((prov) => {
                        const active = selectedProviders.includes(prov.id)
                        return (
                          <button
                            key={prov.id}
                            type="button"
                            onClick={() => toggleProvider(prov.id)}
                            className={`px-3 py-2 rounded-xl border text-left transition flex items-center justify-between ${
                              active
                                ? 'bg-orange-50/90 border-[#FF5500] text-slate-900 shadow-sm'
                                : 'bg-slate-50 border-slate-200 text-slate-400 hover:text-slate-700'
                            }`}
                          >
                            <span className="text-xs font-bold truncate">{prov.name}</span>
                            <span
                              className={`w-2 h-2 rounded-full ${
                                active ? 'bg-[#FF5500]' : 'bg-slate-300'
                              }`}
                            />
                          </button>
                        )
                      })}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-semibold uppercase text-slate-500 mb-1">
                        Resultados por Proveedor
                      </label>
                      <select
                        value={maxPerProvider}
                        onChange={(e) => setMaxPerProvider(Number(e.target.value))}
                        className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-800 focus:outline-none focus:border-[#FF5500]"
                      >
                        <option value={1}>1 (Mejor coincidencia)</option>
                        <option value={2}>2 por proveedor</option>
                        <option value={4}>4 por proveedor</option>
                        <option value={6}>6 por proveedor</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold uppercase text-slate-500 mb-1">
                        Categoría General
                      </label>
                      <input
                        type="text"
                        value={categoriaDefault}
                        onChange={(e) => setCategoriaDefault(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 focus:outline-none focus:border-[#FF5500]"
                      />
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2.5 pt-1">
                    <button
                      type="submit"
                      disabled={
                        jobState.running ||
                        !searchQueriesText.trim() ||
                        selectedProviders.length === 0
                      }
                      className="flex-1 btn-nexus-primary py-3 px-4 rounded-xl text-xs font-bold flex items-center justify-center gap-2"
                    >
                      <Search className="w-4 h-4" />
                      <span>
                        Buscar en {selectedProviders.length} Proveedores Ahora
                      </span>
                    </button>

                    {searchQueriesText && (
                      <button
                        type="button"
                        onClick={() => setSearchQueriesText('')}
                        className="px-3 py-3 rounded-xl border border-slate-200 text-xs text-slate-500 hover:text-slate-800 hover:bg-slate-50"
                      >
                        Limpiar
                      </button>
                    )}
                  </div>
                </form>
              </div>
            ) : (
              <div className="nexus-card rounded-3xl p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-[10px] font-mono uppercase tracking-widest text-[#FF5500] font-bold">
                      ESCANEO DIRECTO DE URLS
                    </span>
                    <h3 className="font-display text-lg font-bold text-slate-900">
                      Links de Páginas de Proveedores
                    </h3>
                  </div>
                  <button
                    type="button"
                    onClick={handleOpenManualModal}
                    className="text-xs font-semibold text-[#FF5500] hover:bg-orange-50 px-3 py-1.5 rounded-xl border border-orange-200 transition flex items-center gap-1.5"
                  >
                    <PackagePlus className="w-3.5 h-3.5" />
                    <span>Agregar Manual</span>
                  </button>
                </div>

                <form onSubmit={handleRunExtraction} className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                      Pegá 1 o más links (uno por línea) — extrae todos los productos de la página:
                    </label>
                    <textarea
                      rows={4}
                      value={urlsText}
                      onChange={(e) => setUrlsText(e.target.value)}
                      placeholder="https://www.carrefour.com.ar/stella?_q=stella&map=ft&#10;https://www.masonline.com.ar/stella"
                      className="w-full p-3.5 rounded-2xl bg-slate-50 border border-slate-200 font-mono text-xs text-slate-900 focus:outline-none focus:border-[#FF5500] focus:bg-white transition"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold uppercase text-slate-500 mb-1">
                      Filtro opcional por palabra clave (dejar vacío para traer todos)
                    </label>
                    <input
                      type="text"
                      value={keywordFilter}
                      onChange={(e) => setKeywordFilter(e.target.value)}
                      placeholder="Ej. 473 ml, lata, rubia (opcional)"
                      className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 focus:outline-none focus:border-[#FF5500]"
                    />
                  </div>

                  <div className="flex flex-wrap items-center gap-2.5 pt-1">
                    <button
                      type="submit"
                      disabled={jobState.running || !urlsText.trim()}
                      className="flex-1 btn-nexus-primary py-3 px-4 rounded-xl text-xs font-bold flex items-center justify-center gap-2"
                    >
                      <Play className="w-4 h-4" />
                      <span>Extraer Todos los Productos de la Página</span>
                    </button>

                    {urlsText && (
                      <button
                        type="button"
                        onClick={() => setUrlsText('')}
                        className="px-3 py-3 rounded-xl border border-slate-200 text-xs text-slate-500 hover:text-slate-800 hover:bg-slate-50"
                      >
                        Limpiar
                      </button>
                    )}
                  </div>
                </form>
              </div>
            )}

            {(jobState.running || jobState.progress > 0) && (
              <div className="nexus-card p-4 rounded-2xl bg-orange-50/70 border border-orange-200 space-y-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-slate-900 flex items-center gap-2">
                    <RefreshCw
                      className={`w-3.5 h-3.5 text-[#FF5500] ${
                        jobState.running && !jobState.paused ? 'animate-spin' : ''
                      }`}
                    />
                    {jobState.statusText}
                  </span>
                  <span className="font-mono font-bold text-[#FF5500]">
                    {jobState.progress}%
                  </span>
                </div>

                <div className="w-full h-2.5 rounded-full bg-white border border-orange-200 overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-[#FF5500] to-[#FF8800] transition-all duration-300 animate-pulse-glow"
                    style={{ width: `${jobState.progress}%` }}
                  />
                </div>

                {jobState.currentUrl && (
                  <p className="text-[11px] font-mono text-slate-500 truncate">
                    {jobState.currentUrl}
                  </p>
                )}

                {jobState.running && (
                  <div className="flex items-center gap-2 pt-1">
                    <button
                      type="button"
                      onClick={handleTogglePause}
                      className="px-3 py-1.5 rounded-lg bg-white border border-orange-300 text-xs font-semibold text-[#FF5500] hover:bg-orange-50 flex items-center gap-1.5"
                    >
                      {jobState.paused ? (
                        <>
                          <Play className="w-3.5 h-3.5" /> Reanudar
                        </>
                      ) : (
                        <>
                          <Pause className="w-3.5 h-3.5" /> Pausar
                        </>
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={handleCancelJob}
                      className="px-3 py-1.5 rounded-lg bg-white border border-red-200 text-xs font-semibold text-red-600 hover:bg-red-50 flex items-center gap-1.5"
                    >
                      <Square className="w-3.5 h-3.5" /> Cancelar
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Panel Derecho: Resumen de Ganadores + Grilla de Productos */}
          <div className="lg:col-span-7 space-y-5">
            {/* Tarjeta de Resolución Automática: Proveedor Más Barato por Producto Buscado */}
            {gruposPorBusqueda.length > 0 && (
              <div className="nexus-card-active rounded-3xl p-5 bg-gradient-to-r from-orange-50/90 via-white to-white space-y-3.5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-orange-200/60 pb-3">
                  <div>
                    <span className="text-[10px] font-mono uppercase tracking-widest text-[#FF5500] font-bold flex items-center gap-1.5">
                      <Award className="w-3.5 h-3.5" /> GANADORES AUTOMÁTICOS POR PRODUCTO BUSCADO
                    </span>
                    <h3 className="font-display text-base font-bold text-slate-900">
                      Mejor Costo Detectado entre Proveedores ({gruposPorBusqueda.length}{' '}
                      producto/s)
                    </h3>
                  </div>

                  <button
                    type="button"
                    onClick={handlePassAllCheapestWinners}
                    className="btn-nexus-primary px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 shrink-0"
                  >
                    <FileSpreadsheet className="w-3.5 h-3.5" />
                    <span>
                      Pasar los {gruposPorBusqueda.length} Más Baratos a Lista de Venta
                    </span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="grid grid-cols-1 gap-2.5">
                  {gruposPorBusqueda.map((grupo) => {
                    const winner = grupo.cheapest
                    const highest = grupo.mostExpensive
                    const diff =
                      highest && winner
                        ? Number(highest.precio_fob) - Number(winner.precio_fob)
                        : 0
                    return (
                      <div
                        key={grupo.label}
                        className="p-3.5 rounded-2xl bg-white border border-orange-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                      >
                        <div className="space-y-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-xs font-display font-bold text-slate-900 uppercase">
                              {grupo.label}
                            </span>
                            <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-[#FF5500] text-white">
                              MÁS BARATO: {winner?.nombre_proveedor}
                            </span>
                            <span className="text-[11px] font-mono text-slate-500">
                              ({grupo.items.length} ofertas en {grupo.uniqueProviders} proveedores)
                            </span>
                          </div>
                          <p className="text-xs text-slate-600 truncate">{winner?.titulo}</p>
                        </div>

                        <div className="flex items-center gap-3 shrink-0">
                          <div className="text-right">
                            <span className="font-mono font-bold text-base text-[#FF5500] block">
                              $ {formatMoney(winner?.precio_fob)}
                            </span>
                            {diff > 0 && (
                              <span className="text-[10px] font-mono text-emerald-700 font-semibold">
                                Ahorrás $ {formatMoney(diff)} vs {highest?.nombre_proveedor}
                              </span>
                            )}
                          </div>

                          <button
                            type="button"
                            onClick={() =>
                              onCompareSelectedProducts(grupo.items.map((i) => i.id_producto))
                            }
                            className="px-2.5 py-1.5 rounded-xl border border-orange-300 bg-orange-50 text-[#FF5500] text-[11px] font-bold hover:bg-orange-100"
                          >
                            Comparar ({grupo.items.length})
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            <div className="nexus-card rounded-3xl p-6 flex flex-col">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
                <div>
                  <span className="text-[10px] font-mono uppercase tracking-widest text-[#FF5500] font-bold">
                    CATÁLOGO EXTRAÍDO
                  </span>
                  <h3 className="font-display text-lg font-bold text-slate-900">
                    Ofertas Encontradas ({productosVisibles.length})
                  </h3>
                </div>

                {productos.length > 0 && (
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={toggleSelectAll}
                      className="px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 hover:border-[#FF5500]"
                    >
                      {productosVisibles.length > 0 &&
                      productosVisibles.every((p) => selectedIds.includes(p.id_producto))
                        ? 'Deseleccionar visibles'
                        : 'Seleccionar visibles'}
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        onCompareSelectedProducts(
                          selectedIds.length > 0
                            ? selectedIds
                            : productosVisibles.map((p) => p.id_producto)
                        )
                      }
                      className="btn-nexus-primary px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>
                        Comparar Proveedor Más Barato
                        {selectedIds.length > 0 ? ` (${selectedIds.length})` : ''}
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        onCreateListWithProducts(
                          selectedIds.length > 0
                            ? selectedIds
                            : productosVisibles.map((p) => p.id_producto)
                        )
                      }
                      className="px-3.5 py-2 rounded-xl border border-orange-300 bg-orange-50 text-[#FF5500] text-xs font-bold hover:bg-orange-100 flex items-center gap-1.5"
                    >
                      <FileSpreadsheet className="w-3.5 h-3.5" />
                      <span>Pasar a Lista de Venta</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setSelectedIds([])
                        setActiveTermFilter('TODOS')
                        onClearAllProducts()
                      }}
                      className="px-2.5 py-2 rounded-xl border border-red-200 text-xs text-red-600 hover:bg-red-50"
                      title="Vaciar lista de productos"
                    >
                      Vaciar
                    </button>
                  </div>
                )}
              </div>

              {/* Filtros rápidos por término buscado */}
              {gruposPorBusqueda.length > 1 && (
                <div className="flex flex-wrap items-center gap-1.5 mb-4 pb-3 border-b border-slate-100">
                  <button
                    type="button"
                    onClick={() => setActiveTermFilter('TODOS')}
                    className={`px-3 py-1 rounded-full text-xs font-semibold transition ${
                      activeTermFilter === 'TODOS'
                        ? 'bg-[#FF5500] text-white'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    Todos ({productos.length})
                  </button>
                  {gruposPorBusqueda.map((g) => (
                    <button
                      key={g.label}
                      type="button"
                      onClick={() => setActiveTermFilter(g.label)}
                      className={`px-3 py-1 rounded-full text-xs font-semibold transition flex items-center gap-1 ${
                        activeTermFilter.toLowerCase() === g.label.toLowerCase()
                          ? 'bg-[#FF5500] text-white'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      <Layers className="w-3 h-3" />
                      <span>
                        {g.label} ({g.items.length})
                      </span>
                    </button>
                  ))}
                </div>
              )}

              {productosVisibles.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center text-center py-12 px-4 border-2 border-dashed border-slate-200 rounded-2xl bg-slate-50/50">
                  <div className="w-12 h-12 rounded-2xl bg-orange-50 border border-orange-200 flex items-center justify-center text-[#FF5500] mb-3">
                    <Search className="w-6 h-6" />
                  </div>
                  <h4 className="font-display font-bold text-slate-800 text-base">
                    Listo para Buscar en Múltiples Proveedores
                  </h4>
                  <p className="text-xs text-slate-500 max-w-md mt-1 leading-relaxed">
                    Escribí los nombres de los productos que necesitás cotizar (por ejemplo{' '}
                    <span className="font-mono text-slate-700">Cerveza Stella Artois 473</span>) y
                    presioná{' '}
                    <span className="font-semibold text-[#FF5500]">
                      "Buscar en Proveedores Ahora"
                    </span>{' '}
                    para traer y comparar los precios de Carrefour, Día, Changomás, Vea, Disco y
                    Jumbo automáticamente.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 overflow-y-auto max-h-[620px] pr-1">
                  {productosVisibles.map((prod) => {
                    const isChecked = selectedIds.includes(prod.id_producto)
                    const precioActual = Number(prod.precio_fob || 0)
                    const precioRegular = Number(prod.precio_lista || precioActual)
                    return (
                      <div
                        key={prod.id_producto}
                        className={`p-4 rounded-2xl bg-white border transition flex flex-col justify-between gap-3 ${
                          isChecked
                            ? 'border-[#FF5500] bg-orange-50/20 shadow-orange-subtle'
                            : 'border-slate-200 hover:border-[#FF5500]/50'
                        }`}
                      >
                        <div>
                          <div className="flex items-center justify-between gap-2 mb-2">
                            <button
                              type="button"
                              onClick={() => toggleSelect(prod.id_producto)}
                              className="flex items-center gap-1.5 text-xs font-semibold text-slate-700"
                            >
                              {isChecked ? (
                                <CheckSquare className="w-4 h-4 text-[#FF5500]" />
                              ) : (
                                <SquareIcon className="w-4 h-4 text-slate-400" />
                              )}
                              <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-orange-50 text-[#FF5500] border border-orange-200">
                                {prod.nombre_proveedor || prod.dominio_proveedor || 'PROVEEDOR'}
                              </span>
                            </button>

                            <div className="flex items-center gap-1">
                              {prod.termino_busqueda && (
                                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-100 text-slate-600 truncate max-w-[110px]">
                                  {prod.termino_busqueda}
                                </span>
                              )}
                              <button
                                type="button"
                                onClick={() => setEditingProduct({ ...prod })}
                                title="Editar producto"
                                className="p-1.5 rounded-lg border border-slate-200 text-slate-500 hover:border-[#FF5500] hover:text-[#FF5500]"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => onDeleteProduct(prod.id_producto)}
                                title="Eliminar producto"
                                className="p-1.5 rounded-lg border border-slate-200 text-slate-400 hover:border-red-300 hover:text-red-600"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>

                          <div className="w-full h-36 rounded-xl bg-white border border-slate-100 flex items-center justify-center p-2 mb-3 overflow-hidden">
                            {prod.url_imagen ? (
                              <img
                                src={prod.url_imagen}
                                alt={prod.titulo}
                                className="max-h-full max-w-full object-contain"
                              />
                            ) : (
                              <ImageIcon className="w-8 h-8 text-slate-300" />
                            )}
                          </div>

                          {prod.promo_texto && (
                            <div className="inline-flex items-center gap-1 text-[10px] font-bold uppercase text-[#FF5500] bg-orange-50 border border-orange-200 px-2 py-0.5 rounded mb-1.5 line-clamp-1">
                              <Tag className="w-3 h-3 shrink-0" />
                              <span className="truncate">{prod.promo_texto}</span>
                            </div>
                          )}

                          <div className="flex items-baseline gap-2">
                            <span className="font-mono font-bold text-lg text-[#FF5500]">
                              $ {formatMoney(precioActual)} c/u
                            </span>
                            {precioRegular > precioActual && (
                              <span className="font-mono text-xs text-slate-400 line-through">
                                $ {formatMoney(precioRegular)}
                              </span>
                            )}
                          </div>

                          <h4 className="font-display font-semibold text-xs sm:text-sm text-slate-800 mt-1 line-clamp-2">
                            {prod.titulo}
                          </h4>
                        </div>

                        {prod.url_origen && (
                          <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px]">
                            <a
                              href={prod.url_origen}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 font-mono text-[#FF5500] hover:underline truncate"
                            >
                              <ExternalLink className="w-3 h-3 shrink-0" />
                              <span>Ver en {prod.nombre_proveedor || 'tienda'}</span>
                            </a>
                            <span className="font-mono text-slate-400">Disponible</span>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {activeSubTab === 'config' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="nexus-card rounded-3xl p-6 space-y-5">
            <div>
              <span className="text-[10px] font-mono uppercase tracking-widest text-[#FF5500] font-bold">
                ORÍGENES FRECUENTES
              </span>
              <h3 className="font-display text-lg font-bold text-slate-900 mt-0.5">
                Dominios de Proveedores Recurrentes
              </h3>
              <p className="text-xs text-slate-500">
                Guardá tus proveedores habituales y palabras clave para búsquedas rápidas.
              </p>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault()
                if (!domForm.dominio.trim()) return
                onAddDominio(domForm)
                setDomForm({
                  dominio: '',
                  nombre: '',
                  palabras_clave: '',
                  categoria_objetivo: ''
                })
              }}
              className="grid grid-cols-1 sm:grid-cols-2 gap-3"
            >
              <input
                type="text"
                required
                placeholder="Dominio (ej. carrefour.com.ar)"
                value={domForm.dominio}
                onChange={(e) => setDomForm({ ...domForm, dominio: e.target.value })}
                className="px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs"
              />
              <input
                type="text"
                required
                placeholder="Nombre Proveedor"
                value={domForm.nombre}
                onChange={(e) => setDomForm({ ...domForm, nombre: e.target.value })}
                className="px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs"
              />
              <input
                type="text"
                placeholder="Palabras clave"
                value={domForm.palabras_clave}
                onChange={(e) => setDomForm({ ...domForm, palabras_clave: e.target.value })}
                className="px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs"
              />
              <input
                type="text"
                placeholder="Categoría"
                value={domForm.categoria_objetivo}
                onChange={(e) => setDomForm({ ...domForm, categoria_objetivo: e.target.value })}
                className="px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs"
              />
              <button
                type="submit"
                className="sm:col-span-2 btn-nexus-primary py-2.5 px-4 rounded-xl text-xs flex items-center justify-center gap-1.5"
              >
                <Plus className="w-4 h-4" />
                <span>Guardar Proveedor</span>
              </button>
            </form>

            <div className="space-y-2.5">
              {dominios.length === 0 ? (
                <p className="text-xs text-slate-400 italic py-4 text-center border border-dashed border-slate-200 rounded-xl">
                  No hay proveedores recurrentes personalizados guardados.
                </p>
              ) : (
                dominios.map((d) => (
                  <div
                    key={d.id}
                    className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-between gap-3"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-display font-bold text-xs text-slate-900">
                          {d.nombre}
                        </span>
                        <span className="text-[11px] font-mono text-[#FF5500]">{d.dominio}</span>
                      </div>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        Keywords: {d.palabras_clave || 'Todas'} | Categoría:{' '}
                        {d.categoria_objetivo || 'General'}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => onDeleteDominio(d.id)}
                      className="p-1.5 text-slate-400 hover:text-red-600"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="nexus-card rounded-3xl p-6 space-y-5">
            <div>
              <span className="text-[10px] font-mono uppercase tracking-widest text-[#FF5500] font-bold">
                ACTUALIZACIÓN AUTOMÁTICA
              </span>
              <h3 className="font-display text-lg font-bold text-slate-900 mt-0.5">
                Programar Tareas de Extracción
              </h3>
              <p className="text-xs text-slate-500">
                Configurá días y horarios para actualizar precios automáticamente.
              </p>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault()
                if (!taskForm.nombre.trim()) return
                onAddTarea(taskForm)
                setTaskForm({
                  nombre: '',
                  dias: 'Lunes, Miércoles, Viernes',
                  horario: '08:00',
                  dominio_asociado: ''
                })
              }}
              className="grid grid-cols-1 sm:grid-cols-2 gap-3"
            >
              <input
                type="text"
                required
                placeholder="Nombre de tarea"
                value={taskForm.nombre}
                onChange={(e) => setTaskForm({ ...taskForm, nombre: e.target.value })}
                className="px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs"
              />
              <input
                type="time"
                required
                value={taskForm.horario}
                onChange={(e) => setTaskForm({ ...taskForm, horario: e.target.value })}
                className="px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-mono"
              />
              <input
                type="text"
                placeholder="Días (ej. Lunes a Viernes)"
                value={taskForm.dias}
                onChange={(e) => setTaskForm({ ...taskForm, dias: e.target.value })}
                className="px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs"
              />
              <input
                type="text"
                placeholder="Proveedor o Lista de Productos"
                value={taskForm.dominio_asociado}
                onChange={(e) => setTaskForm({ ...taskForm, dominio_asociado: e.target.value })}
                className="px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs"
              />
              <button
                type="submit"
                className="sm:col-span-2 btn-nexus-primary py-2.5 px-4 rounded-xl text-xs flex items-center justify-center gap-1.5"
              >
                <Clock className="w-4 h-4" />
                <span>Guardar Tarea Programada</span>
              </button>
            </form>

            <div className="space-y-2.5">
              {tareasProgramadas.length === 0 ? (
                <p className="text-xs text-slate-400 italic py-4 text-center border border-dashed border-slate-200 rounded-xl">
                  No hay tareas programadas activas.
                </p>
              ) : (
                tareasProgramadas.map((t) => (
                  <div
                    key={t.id}
                    className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-between gap-3"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-display font-bold text-xs text-slate-900">
                          {t.nombre}
                        </span>
                        <span
                          className={`text-[10px] font-mono px-2 py-0.5 rounded-full ${
                            t.activa
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : 'bg-slate-200 text-slate-600'
                          }`}
                        >
                          {t.activa ? 'ACTIVA' : 'PAUSADA'}
                        </span>
                      </div>
                      <p className="text-[11px] font-mono text-slate-500 mt-0.5">
                        {t.dias} a las {t.horario} hs • {t.dominio_asociado || 'General'}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => onToggleTarea(t.id)}
                        className="px-2.5 py-1 rounded-lg border border-slate-200 bg-white text-[11px] font-semibold text-slate-700 hover:border-[#FF5500]"
                      >
                        {t.activa ? 'Pausar' : 'Activar'}
                      </button>
                      <button
                        type="button"
                        onClick={() => onDeleteTarea(t.id)}
                        className="p-1.5 text-slate-400 hover:text-red-600"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {activeSubTab === 'logs' && (
        <div className="nexus-card rounded-3xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-[10px] font-mono uppercase tracking-widest text-[#FF5500] font-bold">
                HISTORIAL DE CONEXIONES
              </span>
              <h3 className="font-display text-lg font-bold text-slate-900">
                Registro de Actividad de Extracción
              </h3>
            </div>
            {logsScraping.length > 0 && (
              <button
                type="button"
                onClick={onClearLogs}
                className="px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-100"
              >
                Limpiar Registro
              </button>
            )}
          </div>

          {logsScraping.length === 0 ? (
            <div className="py-12 text-center text-xs text-slate-400 border border-dashed border-slate-200 rounded-2xl">
              No se registraron eventos de búsqueda o extracción todavía.
            </div>
          ) : (
            <div className="space-y-2.5 max-h-[450px] overflow-y-auto pr-1">
              {logsScraping.map((log) => (
                <div
                  key={log.id}
                  className={`p-3.5 rounded-2xl border text-xs flex items-start gap-3 ${
                    log.nivel === 'ERROR'
                      ? 'bg-red-50/70 border-red-200 text-red-900'
                      : log.nivel === 'WARN'
                      ? 'bg-amber-50/70 border-amber-200 text-amber-900'
                      : 'bg-emerald-50/60 border-emerald-200 text-emerald-900'
                  }`}
                >
                  {log.nivel === 'ERROR' ? (
                    <XCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                  ) : log.nivel === 'WARN' ? (
                    <AlertTriangle className="w-4 h-4 text-[#FF5500] shrink-0 mt-0.5" />
                  ) : (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  )}

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono text-[11px] font-bold uppercase">
                        {new Date(log.fecha).toLocaleTimeString('es-AR')}
                      </span>
                      {log.url && (
                        <span className="font-mono text-[11px] truncate text-slate-500 max-w-sm">
                          {log.url}
                        </span>
                      )}
                    </div>
                    <p className="mt-1 leading-relaxed">{log.mensaje}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {editingProduct && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-6 sm:p-7 border-2 border-[#FF5500] shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div>
                <span className="text-[10px] font-mono uppercase tracking-widest text-[#FF5500] font-bold">
                  DATOS DEL PRODUCTO
                </span>
                <h3 className="font-display text-xl font-bold text-slate-900">
                  {editingProduct.id_producto ? 'Editar Producto' : 'Agregar Producto'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setEditingProduct(null)}
                className="text-xs font-mono text-slate-400 hover:text-slate-700 px-2.5 py-1 rounded-lg border border-slate-200"
              >
                Cerrar
              </button>
            </div>

            <form onSubmit={handleSaveEditedProduct} className="space-y-4 mt-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    URL del Proveedor
                  </label>
                  <input
                    type="url"
                    value={editingProduct.url_origen || ''}
                    onChange={(e) => {
                      const val = e.target.value
                      let dom = editingProduct.dominio_proveedor
                      let prov = editingProduct.nombre_proveedor
                      try {
                        if (val) {
                          dom = new URL(val).hostname.replace(/^www\./i, '')
                          prov = dom.split('.')[0].toUpperCase()
                        }
                      } catch {
                        // ignore
                      }
                      setEditingProduct({
                        ...editingProduct,
                        url_origen: val,
                        dominio_proveedor: dom,
                        nombre_proveedor: prov
                      })
                    }}
                    placeholder="https://..."
                    className="w-full px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-mono"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Nombre / Título del Producto
                  </label>
                  <input
                    type="text"
                    required
                    value={editingProduct.titulo || ''}
                    onChange={(e) =>
                      setEditingProduct({ ...editingProduct, titulo: e.target.value })
                    }
                    className="w-full px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Precio Unitario ($)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    value={editingProduct.precio_fob}
                    onChange={(e) =>
                      setEditingProduct({ ...editingProduct, precio_fob: e.target.value })
                    }
                    placeholder="0.00"
                    className="w-full px-3.5 py-2 rounded-xl bg-orange-50/50 border border-orange-300 font-mono text-sm font-bold text-[#FF5500]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Nombre del Proveedor
                  </label>
                  <input
                    type="text"
                    value={editingProduct.nombre_proveedor || ''}
                    onChange={(e) =>
                      setEditingProduct({ ...editingProduct, nombre_proveedor: e.target.value })
                    }
                    className="w-full px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    URL de Imagen
                  </label>
                  <input
                    type="text"
                    value={editingProduct.url_imagen || ''}
                    onChange={(e) =>
                      setEditingProduct({ ...editingProduct, url_imagen: e.target.value })
                    }
                    className="w-full px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-mono"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditingProduct(null)}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="btn-nexus-primary px-5 py-2.5 rounded-xl text-xs font-bold"
                >
                  Guardar Producto
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
