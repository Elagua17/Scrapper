import React, { useState, useMemo, useEffect } from 'react'
import {
  FileText,
  Plus,
  RefreshCw,
  Trash2,
  Percent,
  Check,
  Search,
  Award,
  Filter,
  Store,
  Layers,
  Sparkles,
  UserPlus,
  Edit3,
  AlertCircle,
  CheckCircle2,
  ArrowUpDown,
  Image as ImageIcon
} from 'lucide-react'
import { GestorImpuestos } from '../models/entities'
import {
  exportCotizacionToPDF,
  exportCotizacionToExcel,
  exportCotizacionToCSV
} from '../services/exportService'

const formatMoney = (val) =>
  Number(val || 0).toLocaleString('es-AR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })

export default function PriceListsModule({
  productos,
  cotizaciones,
  cotizacionDetalles,
  impuestosConfig,
  perfilOperador,
  clientes,
  preselectedProductIds,
  onClearPreselected,
  onSaveCotizacion,
  onOneClickUpdateCotizacion,
  onSoftDeleteCotizacion,
  onAddCliente,
  onUpdateCliente
}) {
  const gestor = useMemo(() => new GestorImpuestos(impuestosConfig), [impuestosConfig])

  const productosMap = useMemo(() => {
    const map = {}
    productos.forEach((p) => {
      map[p.id_producto] = p
    })
    return map
  }, [productos])

  const [tituloLista, setTituloLista] = useState('')
  const [segmentoCliente, setSegmentoCliente] = useState('Mayorista')
  const [selectedClienteId, setSelectedClienteId] = useState('')
  const [clienteNombre, setClienteNombre] = useState('')
  const [fechaVigencia, setFechaVigencia] = useState(() => {
    const d = new Date()
    d.setDate(d.getDate() + 15)
    return d.toISOString().slice(0, 10)
  })
  const [descuentoGlobal, setDescuentoGlobal] = useState(0)
  const [costoLogisticoExtra, setCostoLogisticoExtra] = useState(0)

  const [draftItems, setDraftItems] = useState({})

  // Controles de navegación para muchos productos y muchos proveedores
  const [searchProdQuery, setSearchProdQuery] = useState('')
  const [selectedGroupFilter, setSelectedGroupFilter] = useState('TODOS')
  const [selectedProviderFilter, setSelectedProviderFilter] = useState('TODOS')
  const [soloMasBaratos, setSoloMasBaratos] = useState(false)
  const [sortProdBy, setSortProdBy] = useState('menor_costo')

  // Modal de Creación / Edición rápida de Cliente (sin duplicados)
  const [clientModalOpen, setClientModalOpen] = useState(false)
  const [clientModalForm, setClientModalForm] = useState({
    id: null,
    razon_social: '',
    segmento: 'Mayorista',
    email: '',
    telefono: '',
    cuit: '',
    localidad: ''
  })
  const [clientModalError, setClientModalError] = useState('')
  const [clientFeedback, setClientFeedback] = useState('')

  // Filtros de historial de listas emitidas
  const [filterDateFrom, setFilterDateFrom] = useState('')
  const [filterVigenciaState, setFilterVigenciaState] = useState('TODAS')
  const [searchHistory, setSearchHistory] = useState('')

  const margenAutomaticoSegmento = useMemo(() => {
    const segs = perfilOperador?.segmentos_rentabilidad || {}
    if (segs[segmentoCliente] !== undefined) {
      return Number(segs[segmentoCliente]) || 0
    }
    return Number(perfilOperador?.margen_ganancia) || 0
  }, [perfilOperador, segmentoCliente])

  // Analizar todos los productos, agrupar por producto buscado/similar e identificar el MÁS BARATO de cada grupo
  const {
    productosEnriquecidos,
    gruposDisponibles,
    proveedoresDisponibles,
    idsGanadoresMasBaratos
  } = useMemo(() => {
    const base = productos.map((p) => {
      const costoFinal = gestor.calcularCostoTotal(p)
      const precioSugerido = Number(
        (costoFinal * (1 + margenAutomaticoSegmento / 100)).toFixed(2)
      )
      const groupName = (p.termino_busqueda || '').trim() || `Grupo #${p.id_agrupacion || p.id_producto}`
      const provName = (p.nombre_proveedor || p.dominio_proveedor || 'PROVEEDOR').toUpperCase()
      return {
        ...p,
        costoFinal,
        precioSugerido,
        groupName,
        provName
      }
    })

    // Agrupar por groupName (o id_agrupacion) para saber cuál es el más barato de cada producto
    const groupMap = new Map()
    base.forEach((item) => {
      const key = item.groupName.toLowerCase()
      if (!groupMap.has(key)) {
        groupMap.set(key, {
          key,
          label: item.groupName,
          items: []
        })
      }
      groupMap.get(key).items.push(item)
    })

    const winnerIdsSet = new Set()
    const statsByGroup = new Map()

    groupMap.forEach((g) => {
      const sorted = [...g.items].sort((a, b) => a.costoFinal - b.costoFinal)
      const cheapest = sorted[0]
      const mostExpensive = sorted[sorted.length - 1]
      if (cheapest) {
        winnerIdsSet.add(cheapest.id_producto)
      }
      statsByGroup.set(g.key, {
        label: g.label,
        count: g.items.length,
        cheapestId: cheapest?.id_producto,
        cheapestCost: cheapest?.costoFinal || 0,
        cheapestProvider: cheapest?.provName || '',
        maxCost: mostExpensive?.costoFinal || 0
      })
    })

    // Si no hay grupos con más de 1 producto pero hay varios productos en total, marcar también el menor global
    if (groupMap.size === base.length && base.length > 1) {
      const sortedAll = [...base].sort((a, b) => a.costoFinal - b.costoFinal)
      winnerIdsSet.add(sortedAll[0].id_producto)
    }

    const enriched = base.map((item) => {
      const gStat = statsByGroup.get(item.groupName.toLowerCase())
      const esMasBarato = gStat ? gStat.cheapestId === item.id_producto : false
      const ahorro =
        esMasBarato && gStat && gStat.maxCost > item.costoFinal
          ? Number((gStat.maxCost - item.costoFinal).toFixed(2))
          : 0
      return {
        ...item,
        esMasBarato,
        ahorro,
        cantidadOpcionesGrupo: gStat?.count || 1
      }
    })

    const groupsArr = Array.from(statsByGroup.values())
    const provsSet = new Set(base.map((b) => b.provName))

    return {
      productosEnriquecidos: enriched,
      gruposDisponibles: groupsArr,
      proveedoresDisponibles: Array.from(provsSet).sort(),
      idsGanadoresMasBaratos: Array.from(winnerIdsSet)
    }
  }, [productos, gestor, margenAutomaticoSegmento])

  // Filtrado y ordenamiento del navegador de productos
  const productosNavegados = useMemo(() => {
    const q = searchProdQuery.trim().toLowerCase()

    const filtered = productosEnriquecidos.filter((p) => {
      if (soloMasBaratos && !p.esMasBarato) return false
      if (
        selectedGroupFilter !== 'TODOS' &&
        p.groupName.toLowerCase() !== selectedGroupFilter.toLowerCase()
      ) {
        return false
      }
      if (selectedProviderFilter !== 'TODOS' && p.provName !== selectedProviderFilter) {
        return false
      }
      if (q) {
        return (
          p.titulo?.toLowerCase().includes(q) ||
          p.provName.toLowerCase().includes(q) ||
          p.groupName.toLowerCase().includes(q)
        )
      }
      return true
    })

    return filtered.sort((a, b) => {
      if (sortProdBy === 'menor_costo') {
        if (a.costoFinal !== b.costoFinal) return a.costoFinal - b.costoFinal
        return (b.esMasBarato ? 1 : 0) - (a.esMasBarato ? 1 : 0)
      }
      if (sortProdBy === 'mayor_ahorro') {
        if (b.ahorro !== a.ahorro) return b.ahorro - a.ahorro
        return a.costoFinal - b.costoFinal
      }
      if (sortProdBy === 'proveedor') {
        return a.provName.localeCompare(b.provName) || a.costoFinal - b.costoFinal
      }
      if (sortProdBy === 'alfabetico') {
        return (a.titulo || '').localeCompare(b.titulo || '')
      }
      return 0
    })
  }, [
    productosEnriquecidos,
    searchProdQuery,
    selectedGroupFilter,
    selectedProviderFilter,
    soloMasBaratos,
    sortProdBy
  ])

  useEffect(() => {
    if (preselectedProductIds && preselectedProductIds.length > 0) {
      const nextDraft = {}
      preselectedProductIds.forEach((id) => {
        const prod = productosMap[id]
        if (prod) {
          const costoImp = gestor.calcularCostoTotal(prod)
          const precioConMargen = Number(
            (costoImp * (1 + margenAutomaticoSegmento / 100)).toFixed(2)
          )
          nextDraft[id] = {
            cantidad: 1,
            precioManual: precioConMargen
          }
        }
      })
      setDraftItems(nextDraft)
      if (onClearPreselected) onClearPreselected()
    }
  }, [preselectedProductIds, productosMap, gestor, margenAutomaticoSegmento, onClearPreselected])

  const handleSelectSegmento = (nuevoSegmento) => {
    setSegmentoCliente(nuevoSegmento)
    const segs = perfilOperador?.segmentos_rentabilidad || {}
    const nuevoMargen =
      segs[nuevoSegmento] !== undefined
        ? Number(segs[nuevoSegmento]) || 0
        : Number(perfilOperador?.margen_ganancia) || 0

    setDraftItems((prev) => {
      const updated = {}
      Object.keys(prev).forEach((idKey) => {
        const prod = productosMap[idKey]
        if (prod) {
          const costoImp = gestor.calcularCostoTotal(prod)
          updated[idKey] = {
            ...prev[idKey],
            precioManual: Number((costoImp * (1 + nuevoMargen / 100)).toFixed(2))
          }
        }
      })
      return updated
    })
  }

  const handleSelectClienteRegistrado = (clientIdStr) => {
    setSelectedClienteId(clientIdStr)
    if (!clientIdStr) {
      setClienteNombre('')
      return
    }
    const cli = clientes.find((c) => String(c.id) === String(clientIdStr))
    if (cli) {
      setClienteNombre(cli.razon_social)
      if (cli.segmento) {
        handleSelectSegmento(cli.segmento)
      }
    }
  }

  const toggleProductInDraft = (prod) => {
    setDraftItems((prev) => {
      const copy = { ...prev }
      if (copy[prod.id_producto]) {
        delete copy[prod.id_producto]
      } else {
        const costoImp = gestor.calcularCostoTotal(prod)
        const precioVentaSugerido = Number(
          (costoImp * (1 + margenAutomaticoSegmento / 100)).toFixed(2)
        )
        copy[prod.id_producto] = {
          cantidad: 1,
          precioManual: precioVentaSugerido
        }
      }
      return copy
    })
  }

  // Seleccionar en 1 clic únicamente el producto más barato de cada búsqueda/grupo
  const handleSelectOnlyCheapestPerGroup = () => {
    const nextDraft = {}
    idsGanadoresMasBaratos.forEach((id) => {
      const prod = productosMap[id]
      if (prod) {
        const costoImp = gestor.calcularCostoTotal(prod)
        const precioConMargen = Number(
          (costoImp * (1 + margenAutomaticoSegmento / 100)).toFixed(2)
        )
        nextDraft[id] = {
          cantidad: 1,
          precioManual: precioConMargen
        }
      }
    })
    setDraftItems(nextDraft)
  }

  const handleOpenNewClientModal = () => {
    setClientModalError('')
    setClientModalForm({
      id: null,
      razon_social: clienteNombre || '',
      segmento: segmentoCliente || 'Mayorista',
      email: '',
      telefono: '',
      cuit: '',
      localidad: ''
    })
    setClientModalOpen(true)
  }

  const handleOpenEditClientModal = () => {
    const cli =
      clientes.find((c) => String(c.id) === String(selectedClienteId)) ||
      clientes.find(
        (c) =>
          c.razon_social.trim().toLowerCase() === clienteNombre.trim().toLowerCase()
      )
    if (!cli) return
    setClientModalError('')
    setClientModalForm({
      id: cli.id,
      razon_social: cli.razon_social || '',
      segmento: cli.segmento || 'Mayorista',
      email: cli.email || '',
      telefono: cli.telefono || '',
      cuit: cli.cuit || '',
      localidad: cli.localidad || ''
    })
    setClientModalOpen(true)
  }

  const handleSaveClientModal = (e) => {
    e.preventDefault()
    setClientModalError('')
    if (clientModalForm.id) {
      const res = onUpdateCliente ? onUpdateCliente(clientModalForm) : { ok: false }
      if (!res.ok) {
        setClientModalError(res.message || 'No se pudo actualizar el cliente.')
        return
      }
      setSelectedClienteId(String(res.client.id))
      setClienteNombre(res.client.razon_social)
      handleSelectSegmento(res.client.segmento)
      setClientModalOpen(false)
      setClientFeedback(res.message)
      setTimeout(() => setClientFeedback(''), 3500)
    } else {
      const res = onAddCliente ? onAddCliente(clientModalForm) : { ok: false }
      if (!res.ok) {
        setClientModalError(res.message || 'No se pudo registrar el cliente.')
        return
      }
      setSelectedClienteId(String(res.client.id))
      setClienteNombre(res.client.razon_social)
      handleSelectSegmento(res.client.segmento)
      setClientModalOpen(false)
      setClientFeedback(res.message)
      setTimeout(() => setClientFeedback(''), 3500)
    }
  }

  const draftSummary = useMemo(() => {
    let subtotalArticulos = 0
    const detallesList = Object.entries(draftItems).map(([idStr, cfg]) => {
      const idProd = Number(idStr)
      const prod = productosMap[idProd] || {}
      const costoImp = gestor.calcularCostoTotal(prod)
      const cantidad = Math.max(1, Number(cfg.cantidad) || 1)
      const precioUnitario = Math.max(0, Number(cfg.precioManual) || 0)
      subtotalArticulos += cantidad * precioUnitario
      return {
        id_producto: idProd,
        titulo_snapshot: prod.titulo,
        cantidad,
        costo_importacion_unitario: costoImp,
        margen_aplicado: margenAutomaticoSegmento,
        precio_venta_historico: precioUnitario
      }
    })

    const factorAjuste = 1 + (Number(descuentoGlobal) || 0) / 100
    const totalConAjuste =
      subtotalArticulos * factorAjuste + (Number(costoLogisticoExtra) || 0)

    return {
      detallesList,
      subtotalArticulos: Number(subtotalArticulos.toFixed(2)),
      totalFinal: Number(Math.max(0, totalConAjuste).toFixed(2))
    }
  }, [
    draftItems,
    productosMap,
    gestor,
    margenAutomaticoSegmento,
    descuentoGlobal,
    costoLogisticoExtra
  ])

  const handleEmitirCotizacion = (e) => {
    e.preventDefault()
    if (draftSummary.detallesList.length === 0) return

    onSaveCotizacion({
      titulo_lista:
        tituloLista.trim() ||
        `Lista de Venta ${segmentoCliente} - ${new Date().toLocaleDateString('es-AR')}`,
      segmento_cliente: segmentoCliente,
      cliente_nombre: clienteNombre.trim() || 'Cliente General',
      fecha_vigencia: fechaVigencia,
      costo_logistico: Number(costoLogisticoExtra) || 0,
      descuento_global: Number(descuentoGlobal) || 0,
      total: draftSummary.totalFinal,
      detalles: draftSummary.detallesList
    })

    setTituloLista('')
    setDraftItems({})
  }

  const historialFiltrado = useMemo(() => {
    const todayStr = new Date().toISOString().slice(0, 10)
    return cotizaciones
      .filter((c) => c.activo !== false)
      .filter((c) => {
        if (filterDateFrom && c.fecha.slice(0, 10) < filterDateFrom) return false
        const isVigente = !c.fecha_vigencia || c.fecha_vigencia >= todayStr
        if (filterVigenciaState === 'VIGENTES' && !isVigente) return false
        if (filterVigenciaState === 'VENCIDAS' && isVigente) return false
        if (searchHistory.trim()) {
          const q = searchHistory.toLowerCase()
          return (
            String(c.id_cotizacion).includes(q) ||
            (c.titulo_lista || '').toLowerCase().includes(q) ||
            (c.cliente_nombre || '').toLowerCase().includes(q) ||
            (c.segmento_cliente || '').toLowerCase().includes(q)
          )
        }
        return true
      })
  }, [cotizaciones, filterDateFrom, filterVigenciaState, searchHistory])

  const matchedRegisteredClient = useMemo(() => {
    if (selectedClienteId) {
      return clientes.find((c) => String(c.id) === String(selectedClienteId)) || null
    }
    if (clienteNombre.trim()) {
      return (
        clientes.find(
          (c) => c.razon_social.trim().toLowerCase() === clienteNombre.trim().toLowerCase()
        ) || null
      )
    }
    return null
  }, [clientes, selectedClienteId, clienteNombre])

  return (
    <div className="space-y-6">
      <div className="nexus-card rounded-3xl p-6 border-l-4 border-l-[#FF5500] flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <span className="text-[11px] font-mono uppercase tracking-widest px-2.5 py-0.5 rounded-full bg-orange-50 text-[#FF5500] border border-orange-200 font-semibold">
            FUNCIONALIDAD 2 // LISTA DE VENTA PARA CLIENTES
          </span>
          <h2 className="font-display text-2xl font-bold text-slate-900 mt-1">
            Generar y Exportar Lista de Venta para Cliente
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Navegá fácilmente entre múltiples productos y proveedores, filtrá los más baratos en 1
            clic, asigná tu cliente y descargá la lista en PDF, Excel o CSV.
          </p>
        </div>

        {productos.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleSelectOnlyCheapestPerGroup}
              className="btn-nexus-primary px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 shadow-sm"
            >
              <Award className="w-4 h-4" />
              <span>
                Elegir Solo los Más Baratos ({idsGanadoresMasBaratos.length})
              </span>
            </button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-7 space-y-5">
          <div className="nexus-card rounded-3xl p-6 space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <span className="text-[10px] font-mono uppercase tracking-widest text-[#FF5500] font-bold">
                  PASO 1 // CLIENTE Y MARGEN COMERCIAL
                </span>
                <h3 className="font-display text-lg font-bold text-slate-900">
                  Cliente Destinatario y Segmento de Rentabilidad
                </h3>
              </div>
              <span className="text-xs font-mono px-3 py-1 rounded-xl bg-orange-50 border border-orange-200 text-[#FF5500] font-bold self-start sm:self-auto">
                Margen Activo: +{margenAutomaticoSegmento}%
              </span>
            </div>

            {clientFeedback && (
              <div className="p-3 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>{clientFeedback}</span>
              </div>
            )}

            {/* Selector de Cliente sin duplicados + Botones Nuevo / Editar Cliente */}
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-end gap-2.5">
                <div className="flex-1">
                  <label className="block text-[11px] font-semibold uppercase text-slate-600 mb-1">
                    Seleccionar Cliente de tu Cartera ({clientes.length})
                  </label>
                  <select
                    value={matchedRegisteredClient ? String(matchedRegisteredClient.id) : ''}
                    onChange={(e) => handleSelectClienteRegistrado(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-slate-200 text-xs font-semibold text-slate-800 focus:outline-none focus:border-[#FF5500]"
                  >
                    <option value="">-- Seleccionar cliente registrado o escribir abajo --</option>
                    {clientes.map((c) => (
                      <option key={c.id} value={String(c.id)}>
                        {c.razon_social} ({c.segmento})
                        {c.localidad ? ` — ${c.localidad}` : ''}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={handleOpenNewClientModal}
                    className="px-3 py-2.5 rounded-xl bg-[#FF5500] text-white text-xs font-bold hover:bg-[#e04b00] transition flex items-center gap-1.5"
                  >
                    <UserPlus className="w-3.5 h-3.5" />
                    <span>Nuevo Cliente</span>
                  </button>

                  {matchedRegisteredClient && (
                    <button
                      type="button"
                      onClick={handleOpenEditClientModal}
                      className="px-3 py-2.5 rounded-xl bg-white border border-orange-300 text-[#FF5500] text-xs font-bold hover:bg-orange-50 transition flex items-center gap-1.5"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                      <span>Editar Cliente</span>
                    </button>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2.5 pt-1">
                {['Distribuidor', 'Mayorista', 'Minorista'].map((seg) => {
                  const segMargin =
                    perfilOperador?.segmentos_rentabilidad?.[seg] ??
                    perfilOperador?.margen_ganancia ??
                    0
                  const active = segmentoCliente === seg
                  return (
                    <button
                      key={seg}
                      type="button"
                      onClick={() => handleSelectSegmento(seg)}
                      className={`p-2.5 rounded-xl border text-left transition ${
                        active
                          ? 'bg-[#FF5500] text-white border-[#FF5500] shadow-sm'
                          : 'bg-white border-slate-200 text-slate-700 hover:border-orange-300'
                      }`}
                    >
                      <div className="text-xs font-display font-bold">{seg}</div>
                      <div
                        className={`text-[11px] font-mono mt-0.5 ${
                          active ? 'text-orange-100' : 'text-slate-500'
                        }`}
                      >
                        Margen: +{segMargin}%
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* PASO 2: Navegador Avanzado de Productos y Proveedores */}
            <div className="space-y-3 pt-2 border-t border-slate-100">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <span className="text-[10px] font-mono uppercase tracking-widest text-[#FF5500] font-bold">
                    PASO 2 // EXPLORADOR MULTI-PROVEEDOR
                  </span>
                  <h4 className="font-display text-base font-bold text-slate-900">
                    Seleccionar Productos para la Lista ({productosNavegados.length} visibles de{' '}
                    {productos.length})
                  </h4>
                </div>

                {productos.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setSoloMasBaratos((v) => !v)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition flex items-center gap-1.5 ${
                        soloMasBaratos
                          ? 'bg-[#FF5500] text-white border-[#FF5500] shadow-sm'
                          : 'bg-orange-50 text-[#FF5500] border-orange-200 hover:bg-orange-100'
                      }`}
                    >
                      <Award className="w-3.5 h-3.5" />
                      <span>
                        {soloMasBaratos
                          ? 'Mostrando Solo Más Baratos'
                          : 'Ver Solo los Más Baratos'}
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={handleSelectOnlyCheapestPerGroup}
                      className="px-3 py-1.5 rounded-xl text-xs font-bold border border-emerald-300 bg-emerald-50 text-emerald-800 hover:bg-emerald-100 transition flex items-center gap-1"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>Marcar Más Baratos</span>
                    </button>
                  </div>
                )}
              </div>

              {productos.length === 0 ? (
                <div className="p-8 rounded-2xl border-2 border-dashed border-slate-200 text-center bg-slate-50/50">
                  <p className="text-xs text-slate-500">
                    Todavía no hay productos cargados. Buscá productos en múltiples proveedores en{' '}
                    <span className="font-semibold text-[#FF5500]">1. Extraer Productos</span>.
                  </p>
                </div>
              ) : (
                <>
                  {/* Barra de búsqueda, filtro por proveedor y ordenamiento */}
                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 bg-slate-50 p-3 rounded-2xl border border-slate-200">
                    <div className="sm:col-span-5 relative">
                      <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        value={searchProdQuery}
                        onChange={(e) => setSearchProdQuery(e.target.value)}
                        placeholder="Buscar producto o marca..."
                        className="w-full pl-8 pr-3 py-2 rounded-xl bg-white border border-slate-200 text-xs focus:outline-none focus:border-[#FF5500]"
                      />
                    </div>

                    <div className="sm:col-span-4 flex items-center gap-1.5 bg-white border border-slate-200 rounded-xl px-2.5 py-1.5">
                      <Store className="w-3.5 h-3.5 text-[#FF5500] shrink-0" />
                      <select
                        value={selectedProviderFilter}
                        onChange={(e) => setSelectedProviderFilter(e.target.value)}
                        className="w-full bg-transparent text-xs font-semibold text-slate-700 focus:outline-none"
                      >
                        <option value="TODOS">
                          Todos los proveedores ({proveedoresDisponibles.length})
                        </option>
                        {proveedoresDisponibles.map((prov) => (
                          <option key={prov} value={prov}>
                            {prov}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="sm:col-span-3 flex items-center gap-1.5 bg-white border border-slate-200 rounded-xl px-2.5 py-1.5">
                      <ArrowUpDown className="w-3.5 h-3.5 text-[#FF5500] shrink-0" />
                      <select
                        value={sortProdBy}
                        onChange={(e) => setSortProdBy(e.target.value)}
                        className="w-full bg-transparent text-xs font-semibold text-slate-700 focus:outline-none"
                      >
                        <option value="menor_costo">Menor Costo</option>
                        <option value="mayor_ahorro">Mayor Ahorro</option>
                        <option value="proveedor">Por Proveedor</option>
                        <option value="alfabetico">Nombre A-Z</option>
                      </select>
                    </div>
                  </div>

                  {/* Pestañas / Píldoras por Producto Buscado para navegar rápido */}
                  {gruposDisponibles.length > 1 && (
                    <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
                      <button
                        type="button"
                        onClick={() => setSelectedGroupFilter('TODOS')}
                        className={`px-3 py-1.5 rounded-xl text-xs font-semibold shrink-0 transition ${
                          selectedGroupFilter === 'TODOS'
                            ? 'bg-[#FF5500] text-white shadow-sm'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                      >
                        Todos ({productos.length})
                      </button>
                      {gruposDisponibles.map((g) => {
                        const active =
                          selectedGroupFilter.toLowerCase() === g.label.toLowerCase()
                        return (
                          <button
                            key={g.label}
                            type="button"
                            onClick={() => setSelectedGroupFilter(g.label)}
                            className={`px-3 py-1.5 rounded-xl text-xs font-semibold shrink-0 transition flex items-center gap-1.5 ${
                              active
                                ? 'bg-[#FF5500] text-white shadow-sm'
                                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                            }`}
                          >
                            <Layers className="w-3 h-3" />
                            <span>{g.label}</span>
                            <span
                              className={`text-[10px] font-mono px-1.5 py-0.2 rounded-full ${
                                active
                                  ? 'bg-white/20 text-white'
                                  : 'bg-orange-100 text-[#FF5500]'
                              }`}
                            >
                              Min: ${formatMoney(g.cheapestCost)}
                            </span>
                          </button>
                        )
                      })}
                    </div>
                  )}

                  {/* Lista navegable de productos con indicador de MÁS BARATO */}
                  <div className="space-y-2 max-h-[390px] overflow-y-auto pr-1">
                    {productosNavegados.length === 0 ? (
                      <div className="p-6 text-center text-xs text-slate-400 border border-dashed border-slate-200 rounded-2xl">
                        No hay productos que coincidan con el filtro actual.
                      </div>
                    ) : (
                      productosNavegados.map((prod) => {
                        const isAdded = Boolean(draftItems[prod.id_producto])
                        return (
                          <div
                            key={prod.id_producto}
                            onClick={() => toggleProductInDraft(prod)}
                            className={`p-3 rounded-2xl border cursor-pointer transition flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                              isAdded
                                ? 'bg-orange-50/80 border-[#FF5500] shadow-sm'
                                : prod.esMasBarato
                                ? 'bg-gradient-to-r from-emerald-50/50 via-white to-white border-emerald-300 hover:border-[#FF5500]'
                                : 'bg-white border-slate-200 hover:border-orange-300'
                            }`}
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <div
                                className={`w-5 h-5 rounded-md flex items-center justify-center border shrink-0 ${
                                  isAdded
                                    ? 'bg-[#FF5500] border-[#FF5500] text-white'
                                    : 'border-slate-300 bg-white'
                                }`}
                              >
                                {isAdded && <Check className="w-3.5 h-3.5" />}
                              </div>

                              <div className="w-10 h-10 rounded-xl bg-white border border-slate-200 flex items-center justify-center p-1 shrink-0 overflow-hidden">
                                {prod.url_imagen ? (
                                  <img
                                    src={prod.url_imagen}
                                    alt={prod.titulo}
                                    className="max-h-full max-w-full object-contain"
                                  />
                                ) : (
                                  <ImageIcon className="w-4 h-4 text-slate-300" />
                                )}
                              </div>

                              <div className="min-w-0">
                                <div className="flex flex-wrap items-center gap-1.5 mb-0.5">
                                  {prod.esMasBarato && (
                                    <span className="inline-flex items-center gap-1 text-[10px] font-mono font-bold uppercase px-2 py-0.5 rounded-full bg-[#FF5500] text-white">
                                      <Award className="w-3 h-3" /> MÁS BARATO
                                    </span>
                                  )}
                                  <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                                    {prod.provName}
                                  </span>
                                  {prod.termino_busqueda && (
                                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-orange-50 text-[#FF5500] border border-orange-200">
                                      {prod.termino_busqueda}
                                    </span>
                                  )}
                                  {prod.ahorro > 0 && (
                                    <span className="text-[10px] font-mono font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                                      Ahorrás $ {formatMoney(prod.ahorro)}
                                    </span>
                                  )}
                                </div>

                                <div className="font-display font-bold text-xs text-slate-900 truncate">
                                  {prod.titulo}
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0 border-t sm:border-t-0 pt-2 sm:pt-0 border-slate-100">
                              <div className="text-left sm:text-right">
                                <div className="text-[10px] font-mono text-slate-500">
                                  Costo: $ {formatMoney(prod.costoFinal)}
                                </div>
                                <div className="text-xs font-mono font-bold text-[#FF5500]">
                                  Venta: $ {formatMoney(prod.precioSugerido)}
                                </div>
                              </div>

                              <span
                                className={`px-2.5 py-1 rounded-lg text-[11px] font-mono font-bold ${
                                  isAdded
                                    ? 'bg-[#FF5500] text-white'
                                    : 'bg-orange-50 text-[#FF5500] border border-orange-200'
                                }`}
                              >
                                {isAdded ? 'Incluido' : '+ Incluir'}
                              </span>
                            </div>
                          </div>
                        )
                      })
                    )}
                  </div>
                </>
              )}
            </div>

            {/* PASO 3: Formulario Final de Emisión de la Lista */}
            <form
              onSubmit={handleEmitirCotizacion}
              className="space-y-4 pt-3 border-t border-slate-100"
            >
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                    Nombre de la Lista
                  </label>
                  <input
                    type="text"
                    value={tituloLista}
                    onChange={(e) => setTituloLista(e.target.value)}
                    placeholder={`Lista ${segmentoCliente}`}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                    Cliente Destinatario
                  </label>
                  <input
                    type="text"
                    value={clienteNombre}
                    onChange={(e) => {
                      setClienteNombre(e.target.value)
                      const match = clientes.find(
                        (c) =>
                          c.razon_social.trim().toLowerCase() ===
                          e.target.value.trim().toLowerCase()
                      )
                      setSelectedClienteId(match ? String(match.id) : '')
                    }}
                    placeholder="Nombre o Razón Social"
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                    Fecha de Vigencia
                  </label>
                  <input
                    type="date"
                    value={fechaVigencia}
                    onChange={(e) => setFechaVigencia(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-mono"
                  />
                </div>
              </div>

              {Object.keys(draftItems).length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-mono uppercase tracking-wider text-[#FF5500] font-semibold">
                      Productos Incluidos en la Lista ({Object.keys(draftItems).length}) — Editables:
                    </span>
                    <button
                      type="button"
                      onClick={() => setDraftItems({})}
                      className="text-[11px] font-semibold text-red-600 hover:underline"
                    >
                      Quitar todos
                    </button>
                  </div>

                  <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                    {Object.entries(draftItems).map(([idStr, itemCfg]) => {
                      const prod = productosMap[idStr] || {}
                      const costoImp = gestor.calcularCostoTotal(prod)
                      return (
                        <div
                          key={idStr}
                          className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                        >
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-orange-50 text-[#FF5500] border border-orange-200">
                                {prod.nombre_proveedor || prod.dominio_proveedor}
                              </span>
                              <span className="text-xs font-bold text-slate-900 truncate">
                                {prod.titulo}
                              </span>
                            </div>
                            <div className="text-[10px] font-mono text-slate-500 mt-0.5">
                              Costo del Proveedor: $ {formatMoney(costoImp)}
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            <div>
                              <label className="block text-[10px] font-mono text-slate-400">
                                Cant.
                              </label>
                              <input
                                type="number"
                                min="1"
                                value={itemCfg.cantidad}
                                onChange={(e) =>
                                  setDraftItems((prev) => ({
                                    ...prev,
                                    [idStr]: { ...prev[idStr], cantidad: e.target.value }
                                  }))
                                }
                                className="w-16 px-2 py-1 rounded-lg bg-white border border-slate-200 font-mono text-xs text-center"
                              />
                            </div>

                            <div>
                              <label className="block text-[10px] font-mono text-[#FF5500] font-semibold">
                                Precio Venta ($)
                              </label>
                              <input
                                type="number"
                                step="0.01"
                                min="0"
                                value={itemCfg.precioManual}
                                onChange={(e) =>
                                  setDraftItems((prev) => ({
                                    ...prev,
                                    [idStr]: { ...prev[idStr], precioManual: e.target.value }
                                  }))
                                }
                                className="w-28 px-2.5 py-1 rounded-lg bg-white border border-orange-300 font-mono text-xs font-bold text-[#FF5500]"
                              />
                            </div>

                            <button
                              type="button"
                              onClick={() => toggleProductInDraft(prod)}
                              className="p-1.5 text-slate-400 hover:text-red-600 self-end mb-0.5"
                              title="Quitar de la lista"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                    Descuento (-) o Recargo (+) Global %
                  </label>
                  <div className="relative">
                    <Percent className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="number"
                      step="0.5"
                      value={descuentoGlobal}
                      onChange={(e) => setDescuentoGlobal(e.target.value)}
                      placeholder="Ej. -10 para 10% desc."
                      className="w-full pl-8 pr-3 py-2 rounded-xl bg-slate-50 border border-slate-200 font-mono text-xs"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                    Costo Logístico Local Adicional ($)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={costoLogisticoExtra}
                    onChange={(e) => setCostoLogisticoExtra(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 font-mono text-xs"
                  />
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-gradient-to-r from-orange-50 to-white border border-orange-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div>
                  <span className="text-[10px] font-mono uppercase tracking-wider text-slate-500 block">
                    TOTAL LISTA DE VENTA PARA EL CLIENTE
                  </span>
                  <span className="font-mono font-bold text-2xl text-[#FF5500]">
                    $ {formatMoney(draftSummary.totalFinal)}
                  </span>
                </div>

                <button
                  type="submit"
                  disabled={draftSummary.detallesList.length === 0}
                  className="btn-nexus-primary px-5 py-3 rounded-xl text-xs font-bold flex items-center gap-2"
                >
                  <Plus className="w-4 h-4" />
                  <span>Generar Lista de Venta</span>
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* Panel Derecho: Listas Generadas */}
        <div className="lg:col-span-5 space-y-5">
          <div className="nexus-card rounded-3xl p-6 space-y-4 h-full flex flex-col">
            <div>
              <span className="text-[10px] font-mono uppercase tracking-widest text-[#FF5500] font-bold">
                DESCARGA Y ENVÍO A CLIENTES
              </span>
              <h3 className="font-display text-lg font-bold text-slate-900">
                Listas de Venta Generadas
              </h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div className="relative sm:col-span-2">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchHistory}
                  onChange={(e) => setSearchHistory(e.target.value)}
                  placeholder="Buscar por cliente, título o tipo..."
                  className="w-full pl-8 pr-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs"
                />
              </div>

              <div>
                <label className="block text-[10px] font-mono uppercase text-slate-400 mb-0.5">
                  Desde Fecha
                </label>
                <input
                  type="date"
                  value={filterDateFrom}
                  onChange={(e) => setFilterDateFrom(e.target.value)}
                  className="w-full px-2.5 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-mono"
                />
              </div>

              <div>
                <label className="block text-[10px] font-mono uppercase text-slate-400 mb-0.5">
                  Vigencia
                </label>
                <select
                  value={filterVigenciaState}
                  onChange={(e) => setFilterVigenciaState(e.target.value)}
                  className="w-full px-2.5 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-semibold"
                >
                  <option value="TODAS">Todas</option>
                  <option value="VIGENTES">Vigentes</option>
                  <option value="VENCIDAS">Vencidas</option>
                </select>
              </div>
            </div>

            {historialFiltrado.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center py-12 px-4 border-2 border-dashed border-slate-200 rounded-2xl bg-slate-50/40">
                <FileText className="w-8 h-8 text-[#FF5500] mb-2" />
                <h4 className="font-display font-bold text-sm text-slate-800">
                  Sin Listas de Venta Todavía
                </h4>
                <p className="text-xs text-slate-500 mt-1">
                  Las listas de venta que generes para tus clientes aparecerán acá para descargarlas
                  en PDF, Excel o CSV.
                </p>
              </div>
            ) : (
              <div className="space-y-3 overflow-y-auto max-h-[600px] pr-1">
                {historialFiltrado.map((cot) => {
                  const detallesDeCot = cotizacionDetalles.filter(
                    (d) => d.id_cotizacion === cot.id_cotizacion
                  )
                  const todayStr = new Date().toISOString().slice(0, 10)
                  const vigente = !cot.fecha_vigencia || cot.fecha_vigencia >= todayStr

                  return (
                    <div
                      key={cot.id_cotizacion}
                      className="p-4 rounded-2xl bg-white border border-slate-200 hover:border-[#FF5500]/50 transition space-y-3"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-orange-50 text-[#FF5500] border border-orange-200">
                              #{cot.id_cotizacion} • {cot.segmento_cliente}
                            </span>
                            <span
                              className={`text-[10px] font-mono px-2 py-0.5 rounded ${
                                vigente
                                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                  : 'bg-red-50 text-red-700 border border-red-200'
                              }`}
                            >
                              {vigente ? `Vigente (${cot.fecha_vigencia})` : 'Vencida'}
                            </span>
                          </div>
                          <h4 className="font-display font-bold text-sm text-slate-900 mt-1">
                            {cot.titulo_lista}
                          </h4>
                          <p className="text-xs text-slate-500">
                            Cliente: <strong className="text-slate-700">{cot.cliente_nombre}</strong>{' '}
                            • {detallesDeCot.length} producto(s)
                          </p>
                        </div>

                        <div className="text-right">
                          <span className="text-[10px] font-mono text-slate-400 block">
                            PRECIO FINAL LISTA
                          </span>
                          <span className="font-mono font-bold text-base text-[#FF5500]">
                            $ {formatMoney(cot.total)}
                          </span>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100">
                        <button
                          type="button"
                          onClick={() => onOneClickUpdateCotizacion(cot.id_cotizacion)}
                          className="px-2.5 py-1.5 rounded-xl bg-orange-50 border border-orange-200 text-[#FF5500] text-[11px] font-semibold hover:bg-orange-100 flex items-center gap-1"
                        >
                          <RefreshCw className="w-3 h-3" />
                          <span>Recalcular Precios</span>
                        </button>

                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() =>
                              exportCotizacionToPDF({
                                cotizacion: cot,
                                detalles: detallesDeCot,
                                productosMap,
                                perfilEmpresa: perfilOperador
                              })
                            }
                            className="px-2.5 py-1.5 rounded-lg border border-slate-200 text-[11px] font-bold text-slate-700 hover:border-[#FF5500] hover:text-[#FF5500]"
                          >
                            PDF
                          </button>

                          <button
                            type="button"
                            onClick={() =>
                              exportCotizacionToExcel({
                                cotizacion: cot,
                                detalles: detallesDeCot,
                                productosMap,
                                perfilEmpresa: perfilOperador
                              })
                            }
                            className="px-2.5 py-1.5 rounded-lg border border-slate-200 text-[11px] font-bold text-emerald-700 hover:border-emerald-500"
                          >
                            XLSX
                          </button>

                          <button
                            type="button"
                            onClick={() =>
                              exportCotizacionToCSV({
                                cotizacion: cot,
                                detalles: detallesDeCot,
                                productosMap,
                                perfilEmpresa: perfilOperador
                              })
                            }
                            className="px-2.5 py-1.5 rounded-lg border border-slate-200 text-[11px] font-bold text-slate-600 hover:border-[#FF5500]"
                          >
                            CSV
                          </button>

                          <button
                            type="button"
                            onClick={() => onSoftDeleteCotizacion(cot.id_cotizacion)}
                            title="Eliminar lista"
                            className="p-1.5 rounded-lg text-slate-400 hover:text-red-600"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modal de Alta / Edición de Cliente desde Lista de Venta */}
      {clientModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 border-2 border-[#FF5500] shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <span className="text-[10px] font-mono uppercase tracking-widest text-[#FF5500] font-bold">
                  CARTERA DE CLIENTES (SIN DUPLICADOS)
                </span>
                <h3 className="font-display text-lg font-bold text-slate-900">
                  {clientModalForm.id ? 'Editar Cliente' : 'Registrar Nuevo Cliente'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setClientModalOpen(false)}
                className="text-xs font-mono px-2.5 py-1 rounded-lg border border-slate-200 text-slate-500"
              >
                Cerrar
              </button>
            </div>

            {clientModalError && (
              <div className="p-3 rounded-2xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
                <span>{clientModalError}</span>
              </div>
            )}

            <form onSubmit={handleSaveClientModal} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Nombre o Razón Social *
                </label>
                <input
                  type="text"
                  required
                  value={clientModalForm.razon_social}
                  onChange={(e) =>
                    setClientModalForm({ ...clientModalForm, razon_social: e.target.value })
                  }
                  placeholder="Ej. Distribuidora Entre Ríos S.R.L."
                  className="w-full px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Segmento / Tipo de Cliente
                  </label>
                  <select
                    value={clientModalForm.segmento}
                    onChange={(e) =>
                      setClientModalForm({ ...clientModalForm, segmento: e.target.value })
                    }
                    className="w-full px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-semibold"
                  >
                    <option value="Distribuidor">Distribuidor</option>
                    <option value="Mayorista">Mayorista</option>
                    <option value="Minorista">Minorista</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    CUIT / DNI (opcional)
                  </label>
                  <input
                    type="text"
                    value={clientModalForm.cuit}
                    onChange={(e) =>
                      setClientModalForm({ ...clientModalForm, cuit: e.target.value })
                    }
                    placeholder="30-00000000-0"
                    className="w-full px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Correo Electrónico
                  </label>
                  <input
                    type="email"
                    value={clientModalForm.email}
                    onChange={(e) =>
                      setClientModalForm({ ...clientModalForm, email: e.target.value })
                    }
                    placeholder="contacto@cliente.com"
                    className="w-full px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Teléfono
                  </label>
                  <input
                    type="text"
                    value={clientModalForm.telefono}
                    onChange={(e) =>
                      setClientModalForm({ ...clientModalForm, telefono: e.target.value })
                    }
                    placeholder="+54 3442..."
                    className="w-full px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Localidad / Dirección
                  </label>
                  <input
                    type="text"
                    value={clientModalForm.localidad}
                    onChange={(e) =>
                      setClientModalForm({ ...clientModalForm, localidad: e.target.value })
                    }
                    placeholder="Localidad / Provincia"
                    className="w-full px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setClientModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="btn-nexus-primary px-5 py-2 rounded-xl text-xs font-bold"
                >
                  {clientModalForm.id ? 'Guardar Cambios' : 'Registrar Cliente'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
