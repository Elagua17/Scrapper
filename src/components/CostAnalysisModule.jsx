import React, { useState, useMemo, useEffect } from 'react'
import {
  Calculator,
  Award,
  Filter,
  Star,
  Truck,
  BarChart3,
  FileSpreadsheet,
  ArrowUpDown,
  CheckSquare,
  Square,
  BellRing,
  RefreshCw,
  ArrowRight
} from 'lucide-react'
import { GestorImpuestos } from '../models/entities'
import { exportCatalogReport } from '../services/exportService'

const formatMoney = (val) =>
  Number(val || 0).toLocaleString('es-AR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })

export default function CostAnalysisModule({
  productos,
  impuestosConfig,
  notificacionesPrecios,
  preselectedCompareIds,
  onClearPreselectedCompare,
  onSaveImpuestos,
  onUpdateProductPrice,
  onCreateListWithProducts
}) {
  const [formImpuestos, setFormImpuestos] = useState({
    iva: impuestosConfig?.iva ?? 0,
    derechos_importacion: impuestosConfig?.derechos_importacion ?? 0,
    tasa_estadistica: impuestosConfig?.tasa_estadistica ?? 0,
    impuestos_extra: impuestosConfig?.impuestos_extra ?? 0,
    tarifa_por_kg: impuestosConfig?.tarifa_por_kg ?? 0,
    tarifa_por_m3: impuestosConfig?.tarifa_por_m3 ?? 0,
    costo_fijo_logistico: impuestosConfig?.costo_fijo_logistico ?? 0,
    cotizacion_dolar_ars: impuestosConfig?.cotizacion_dolar_ars ?? 1050
  })
  const [savedBanner, setSavedBanner] = useState(false)

  const [searchQuery, setSearchQuery] = useState('')
  const [sortBy, setSortBy] = useState('menor_costo')
  const [selectedIds, setSelectedIds] = useState([])
  const [historyModalProd, setHistoryModalProd] = useState(null)
  const [newPriceInput, setNewPriceInput] = useState('')

  useEffect(() => {
    if (preselectedCompareIds && preselectedCompareIds.length > 0) {
      setSelectedIds(preselectedCompareIds)
      if (onClearPreselectedCompare) onClearPreselectedCompare()
    }
  }, [preselectedCompareIds, onClearPreselectedCompare])

  const gestor = useMemo(() => new GestorImpuestos(formImpuestos), [formImpuestos])

  const productosAnalizados = useMemo(() => {
    return productos.map((p) => {
      const desglose = gestor.calcularDesgloseImportacion(p)
      return {
        ...p,
        desglose,
        costoFinal: desglose.costoTotalImportacion,
        grupoId: p.id_agrupacion || p.id_producto
      }
    })
  }, [productos, gestor])

  const productosFiltrados = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    const list = productosAnalizados.filter((p) => {
      if (!q) return true
      return (
        p.titulo?.toLowerCase().includes(q) ||
        p.nombre_proveedor?.toLowerCase().includes(q) ||
        p.categoria?.toLowerCase().includes(q)
      )
    })

    return list.sort((a, b) => {
      if (sortBy === 'menor_costo') return a.costoFinal - b.costoFinal
      if (sortBy === 'menor_plazo') {
        return (Number(a.plazo_logistico_dias) || 99) - (Number(b.plazo_logistico_dias) || 99)
      }
      if (sortBy === 'mejor_reputacion') {
        return (Number(b.reputacion_vendedor) || 0) - (Number(a.reputacion_vendedor) || 0)
      }
      return 0
    })
  }, [productosAnalizados, searchQuery, sortBy])

  const productosEnComparacion = useMemo(() => {
    const base =
      selectedIds.length > 0
        ? productosAnalizados.filter((p) => selectedIds.includes(p.id_producto))
        : productosFiltrados
    return [...base].sort((a, b) => a.costoFinal - b.costoFinal)
  }, [selectedIds, productosAnalizados, productosFiltrados])

  const proveedorMasBarato = productosEnComparacion.length > 0 ? productosEnComparacion[0] : null
  const proveedorMasCaro =
    productosEnComparacion.length > 1
      ? productosEnComparacion[productosEnComparacion.length - 1]
      : null

  const handleSaveTaxConfig = (e) => {
    e.preventDefault()
    onSaveImpuestos({
      iva: Number(formImpuestos.iva) || 0,
      derechos_importacion: Number(formImpuestos.derechos_importacion) || 0,
      tasa_estadistica: Number(formImpuestos.tasa_estadistica) || 0,
      impuestos_extra: Number(formImpuestos.impuestos_extra) || 0,
      tarifa_por_kg: Number(formImpuestos.tarifa_por_kg) || 0,
      tarifa_por_m3: Number(formImpuestos.tarifa_por_m3) || 0,
      costo_fijo_logistico: Number(formImpuestos.costo_fijo_logistico) || 0,
      cotizacion_dolar_ars: Number(formImpuestos.cotizacion_dolar_ars) || 1050
    })
    setSavedBanner(true)
    setTimeout(() => setSavedBanner(false), 2500)
  }

  const toggleSelectProduct = (id) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    )
  }

  return (
    <div className="space-y-6">
      <div className="nexus-card rounded-3xl p-6 border-l-4 border-l-[#FF5500] flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <span className="text-[11px] font-mono uppercase tracking-widest px-2.5 py-0.5 rounded-full bg-orange-50 text-[#FF5500] border border-orange-200 font-semibold">
            FUNCIONALIDAD 1 // COMPARADOR DE PROVEEDORES
          </span>
          <h2 className="font-display text-2xl font-bold text-slate-900 mt-1">
            Costo del Proveedor Más Barato
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Seleccioná varios productos similares de distintos proveedores para comparar sus costos
            finales y pasar la mejor opción directamente a la lista de venta para tu cliente.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {productos.length > 0 && (
            <>
              <button
                type="button"
                onClick={() =>
                  exportCatalogReport({
                    productos: productosEnComparacion,
                    gestorImpuestos: gestor,
                    format: 'pdf'
                  })
                }
                className="px-3.5 py-2 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-700 hover:border-[#FF5500] flex items-center gap-1.5"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-[#FF5500]" />
                <span>PDF</span>
              </button>
              <button
                type="button"
                onClick={() =>
                  exportCatalogReport({
                    productos: productosEnComparacion,
                    gestorImpuestos: gestor,
                    format: 'xlsx'
                  })
                }
                className="px-3.5 py-2 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-700 hover:border-[#FF5500] flex items-center gap-1.5"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
                <span>Excel (.xlsx)</span>
              </button>
              <button
                type="button"
                onClick={() =>
                  exportCatalogReport({
                    productos: productosEnComparacion,
                    gestorImpuestos: gestor,
                    format: 'csv'
                  })
                }
                className="px-3.5 py-2 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-700 hover:border-[#FF5500] flex items-center gap-1.5"
              >
                <span>CSV</span>
              </button>
            </>
          )}
        </div>
      </div>

      {proveedorMasBarato && (
        <div className="nexus-card-active rounded-3xl p-6 bg-gradient-to-r from-orange-50/90 via-white to-white">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
            <div className="flex items-start gap-4">
              {proveedorMasBarato.url_imagen && (
                <img
                  src={proveedorMasBarato.url_imagen}
                  alt={proveedorMasBarato.titulo}
                  className="w-16 h-16 rounded-2xl object-contain bg-white border border-orange-200 p-1 shrink-0"
                />
              )}
              <div className="space-y-1.5">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 text-xs font-mono font-bold uppercase px-3 py-1 rounded-full bg-[#FF5500] text-white shadow-sm">
                    <Award className="w-4 h-4" /> PROVEEDOR MÁS BARATO DETECTADO
                  </span>
                  <span className="text-xs font-mono font-bold px-2.5 py-1 rounded-lg bg-white border border-orange-200 text-[#FF5500]">
                    Proveedor:{' '}
                    {proveedorMasBarato.nombre_proveedor || proveedorMasBarato.dominio_proveedor}
                  </span>
                  <span className="text-xs text-slate-500">
                    (Comparando {productosEnComparacion.length} opción/es)
                  </span>
                </div>

                <h3 className="font-display text-xl font-bold text-slate-900">
                  {proveedorMasBarato.titulo}
                </h3>

                <div className="flex flex-wrap items-center gap-4 text-xs font-mono text-slate-600">
                  <span>Costo Base: $ {formatMoney(proveedorMasBarato.desglose.precioFOB)}</span>
                  <span>+ Envío: $ {formatMoney(proveedorMasBarato.desglose.costoEnvio)}</span>
                  <span>
                    + Impuestos: $ {formatMoney(proveedorMasBarato.desglose.totalImpuestos)}
                  </span>
                  {proveedorMasCaro &&
                    proveedorMasCaro.costoFinal > proveedorMasBarato.costoFinal && (
                      <span className="text-emerald-700 font-bold bg-emerald-50 px-2.5 py-0.5 rounded-md border border-emerald-200">
                        Ahorro vs más caro: ${' '}
                        {formatMoney(
                          proveedorMasCaro.costoFinal - proveedorMasBarato.costoFinal
                        )}{' '}
                        (
                        {(
                          ((proveedorMasCaro.costoFinal - proveedorMasBarato.costoFinal) /
                            proveedorMasCaro.costoFinal) *
                          100
                        ).toFixed(1)}
                        %)
                      </span>
                    )}
                </div>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 shrink-0 border-t lg:border-t-0 pt-3 lg:pt-0 border-orange-200/60">
              <div className="text-left sm:text-right">
                <span className="text-[10px] font-mono uppercase text-slate-500 block">
                  COSTO FINAL MÁS BAJO
                </span>
                <span className="font-mono font-bold text-3xl text-[#FF5500]">
                  $ {formatMoney(proveedorMasBarato.costoFinal)}
                </span>
              </div>

              <div className="flex flex-col gap-2">
                <button
                  type="button"
                  onClick={() => onCreateListWithProducts([proveedorMasBarato.id_producto])}
                  className="btn-nexus-primary px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2"
                >
                  <span>Pasar Ganador a Lista de Venta</span>
                  <ArrowRight className="w-4 h-4" />
                </button>

                {selectedIds.length > 1 && (
                  <button
                    type="button"
                    onClick={() => onCreateListWithProducts(selectedIds)}
                    className="px-3.5 py-1.5 rounded-xl border border-orange-300 bg-white text-[#FF5500] text-[11px] font-semibold hover:bg-orange-50 text-center"
                  >
                    Pasar los {selectedIds.length} seleccionados a Lista de Venta
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {notificacionesPrecios && notificacionesPrecios.length > 0 && (
        <div className="p-4 rounded-2xl bg-gradient-to-r from-orange-50 via-white to-amber-50 border border-orange-300 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#FF5500] text-white flex items-center justify-center shrink-0">
              <BellRing className="w-4 h-4" />
            </div>
            <div>
              <span className="text-[10px] font-mono uppercase tracking-wider font-bold text-[#FF5500]">
                OPORTUNIDAD DETECTADA
              </span>
              <p className="text-xs font-semibold text-slate-900">
                {notificacionesPrecios[0].mensaje}
              </p>
            </div>
          </div>
          <span className="text-[11px] font-mono text-slate-500 shrink-0">
            {new Date(notificacionesPrecios[0].fecha).toLocaleTimeString('es-AR')}
          </span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-4">
          <div className="nexus-card rounded-3xl p-6 space-y-4 hud-corner">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-[10px] font-mono uppercase tracking-widest text-[#FF5500] font-bold">
                  VARIABLES DE COSTO
                </span>
                <h3 className="font-display text-lg font-bold text-slate-900">
                  Impuestos y Flete
                </h3>
              </div>
              <Calculator className="w-5 h-5 text-[#FF5500]" />
            </div>

            <p className="text-xs text-slate-500 leading-relaxed">
              Configurá los porcentajes de impuestos y costos de envío para calcular el costo real
              de cada proveedor.
            </p>

            <form onSubmit={handleSaveTaxConfig} className="space-y-3.5">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold uppercase text-slate-600 mb-1">
                    IVA (%)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={formImpuestos.iva}
                    onChange={(e) => setFormImpuestos({ ...formImpuestos, iva: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 font-mono text-xs font-bold text-slate-900 focus:border-[#FF5500] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold uppercase text-slate-600 mb-1">
                    Derechos Imp. (%)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={formImpuestos.derechos_importacion}
                    onChange={(e) =>
                      setFormImpuestos({
                        ...formImpuestos,
                        derechos_importacion: e.target.value
                      })
                    }
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 font-mono text-xs font-bold text-slate-900 focus:border-[#FF5500] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold uppercase text-slate-600 mb-1">
                    Tasa Estadística (%)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={formImpuestos.tasa_estadistica}
                    onChange={(e) =>
                      setFormImpuestos({
                        ...formImpuestos,
                        tasa_estadistica: e.target.value
                      })
                    }
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 font-mono text-xs font-bold text-slate-900 focus:border-[#FF5500] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold uppercase text-slate-600 mb-1">
                    Impuestos Extra (%)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={formImpuestos.impuestos_extra}
                    onChange={(e) =>
                      setFormImpuestos({
                        ...formImpuestos,
                        impuestos_extra: e.target.value
                      })
                    }
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 font-mono text-xs font-bold text-slate-900 focus:border-[#FF5500] focus:outline-none"
                  />
                </div>
              </div>

              <div className="pt-2 border-t border-slate-100">
                <span className="text-[10px] font-mono uppercase tracking-wider text-[#FF5500] font-semibold">
                  COSTO DE ENVÍO
                </span>
                <div className="grid grid-cols-2 gap-3 mt-2">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                      Tarifa por Kg ($)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={formImpuestos.tarifa_por_kg}
                      onChange={(e) =>
                        setFormImpuestos({
                          ...formImpuestos,
                          tarifa_por_kg: e.target.value
                        })
                      }
                      className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 font-mono text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                      Flete Fijo ($)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={formImpuestos.costo_fijo_logistico}
                      onChange={(e) =>
                        setFormImpuestos({
                          ...formImpuestos,
                          costo_fijo_logistico: e.target.value
                        })
                      }
                      className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 font-mono text-xs"
                    />
                  </div>
                </div>
              </div>

              <button
                type="submit"
                className="w-full btn-nexus-primary py-2.5 px-4 rounded-xl text-xs font-bold"
              >
                Aplicar y Guardar Parámetros
              </button>

              {savedBanner && (
                <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs text-center font-medium">
                  Parámetros actualizados correctamente.
                </div>
              )}
            </form>
          </div>
        </div>

        <div className="lg:col-span-8 space-y-4">
          <div className="nexus-card rounded-3xl p-6 space-y-4">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
              <div className="relative flex-1">
                <Filter className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Buscar producto similar para comparar entre proveedores..."
                  className="w-full pl-9 pr-4 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs focus:outline-none focus:border-[#FF5500]"
                />
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5">
                  <ArrowUpDown className="w-3.5 h-3.5 text-[#FF5500]" />
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value)}
                    className="bg-transparent text-xs font-semibold text-slate-700 focus:outline-none"
                  >
                    <option value="menor_costo">Menor Costo Final</option>
                    <option value="menor_plazo">Menor Plazo de Entrega</option>
                    <option value="mejor_reputacion">Mejor Calificación</option>
                  </select>
                </div>

                {selectedIds.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setSelectedIds([])}
                    className="px-3 py-1.5 rounded-xl border border-slate-200 text-xs text-slate-600 hover:bg-slate-100"
                  >
                    Ver todos ({productos.length})
                  </button>
                )}
              </div>
            </div>

            <div className="text-xs text-slate-500 flex items-center justify-between bg-slate-50 px-3.5 py-2 rounded-xl border border-slate-200/80">
              <span>
                Marcá las casillas de los productos similares de distintos proveedores que quieras
                comparar entre sí.
              </span>
              {selectedIds.length > 0 && (
                <span className="font-mono font-bold text-[#FF5500]">
                  {selectedIds.length} producto(s) en comparación directa
                </span>
              )}
            </div>

            {productosFiltrados.length === 0 ? (
              <div className="py-14 text-center border-2 border-dashed border-slate-200 rounded-2xl bg-slate-50/50 px-4">
                <Award className="w-8 h-8 text-[#FF5500] mx-auto mb-2" />
                <h4 className="font-display font-bold text-slate-800 text-base">
                  Sin Productos para Comparar
                </h4>
                <p className="text-xs text-slate-500 max-w-md mx-auto mt-1">
                  Extraé primero los productos desde los links de tus proveedores en la pestaña{' '}
                  <span className="font-semibold text-[#FF5500]">1. Extraer Productos</span>.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {productosFiltrados.map((item) => {
                  const isSelected = selectedIds.includes(item.id_producto)
                  const esElMasBarato =
                    proveedorMasBarato && proveedorMasBarato.id_producto === item.id_producto

                  return (
                    <div
                      key={item.id_producto}
                      className={`p-4 rounded-2xl transition border ${
                        esElMasBarato
                          ? 'bg-gradient-to-r from-orange-50/70 via-white to-white border-[#FF5500] shadow-orange-subtle'
                          : isSelected
                          ? 'bg-orange-50/20 border-orange-300'
                          : 'bg-white border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div className="flex items-start gap-3">
                          <button
                            type="button"
                            onClick={() => toggleSelectProduct(item.id_producto)}
                            className="mt-1 text-[#FF5500]"
                            title="Incluir como parámetro en la comparación"
                          >
                            {isSelected ? (
                              <CheckSquare className="w-4 h-4" />
                            ) : (
                              <Square className="w-4 h-4 text-slate-400" />
                            )}
                          </button>

                          {item.url_imagen && (
                            <img
                              src={item.url_imagen}
                              alt={item.titulo}
                              className="w-12 h-12 rounded-xl object-contain bg-white border border-slate-200 p-1 shrink-0"
                            />
                          )}

                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              {esElMasBarato && (
                                <span className="inline-flex items-center gap-1 text-[10px] font-mono font-bold uppercase px-2.5 py-0.5 rounded-full bg-[#FF5500] text-white shadow-sm">
                                  <Award className="w-3 h-3" /> PROVEEDOR MÁS BARATO
                                </span>
                              )}

                              <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-md bg-slate-100 text-slate-700">
                                {item.nombre_proveedor || item.dominio_proveedor}
                              </span>

                              {item.reputacion_vendedor && (
                                <span className="inline-flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded-md bg-amber-50 text-amber-800 border border-amber-200">
                                  <Star className="w-3 h-3 fill-amber-400 text-amber-500" />
                                  {item.reputacion_vendedor}
                                </span>
                              )}

                              <span className="inline-flex items-center gap-1 text-[10px] font-mono text-slate-500">
                                <Truck className="w-3 h-3 text-slate-400" />
                                {item.plazo_logistico_dias || 3} días
                              </span>
                            </div>

                            <h4 className="font-display font-bold text-sm text-slate-900 mt-1.5">
                              {item.titulo}
                            </h4>

                            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] font-mono text-slate-500 mt-1.5">
                              <span>Costo Base: $ {formatMoney(item.desglose.precioFOB)}</span>
                              <span>+ Envío: $ {formatMoney(item.desglose.costoEnvio)}</span>
                              <span>+ Impuestos: $ {formatMoney(item.desglose.totalImpuestos)}</span>
                            </div>
                          </div>
                        </div>

                        <div className="flex md:flex-col items-center md:items-end justify-between gap-2 border-t md:border-t-0 pt-2 md:pt-0 border-slate-100 shrink-0">
                          <div className="text-left md:text-right">
                            <span className="text-[10px] font-mono uppercase text-slate-400 block">
                              Costo Final Proveedor
                            </span>
                            <span className="font-mono font-bold text-lg text-[#FF5500]">
                              $ {formatMoney(item.costoFinal)}
                            </span>
                          </div>

                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => onCreateListWithProducts([item.id_producto])}
                              className="px-2.5 py-1.5 rounded-lg bg-orange-50 border border-orange-200 text-[11px] font-bold text-[#FF5500] hover:bg-orange-100 flex items-center gap-1"
                            >
                              <span>Pasar a Lista de Venta</span>
                              <ArrowRight className="w-3 h-3" />
                            </button>

                            <button
                              type="button"
                              onClick={() => {
                                setHistoryModalProd(item)
                                setNewPriceInput(String(item.precio_fob))
                              }}
                              className="px-2.5 py-1.5 rounded-lg border border-slate-200 text-[11px] font-semibold text-slate-700 hover:border-[#FF5500] hover:text-[#FF5500] flex items-center gap-1"
                            >
                              <BarChart3 className="w-3.5 h-3.5" />
                              <span>Histórico</span>
                            </button>
                          </div>
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

      {historyModalProd && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-xl w-full p-6 border-2 border-[#FF5500] shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <span className="text-[10px] font-mono uppercase tracking-widest text-[#FF5500] font-bold">
                  HISTORIAL DE PRECIOS DEL PROVEEDOR
                </span>
                <h3 className="font-display text-lg font-bold text-slate-900">
                  {historyModalProd.titulo}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setHistoryModalProd(null)}
                className="text-xs font-mono px-2.5 py-1 rounded-lg border border-slate-200 text-slate-500"
              >
                Cerrar
              </button>
            </div>

            {(() => {
              const history =
                historyModalProd.historial_precios && historyModalProd.historial_precios.length > 0
                  ? historyModalProd.historial_precios
                  : [
                      {
                        fecha: new Date().toISOString(),
                        precio_fob: Number(historyModalProd.precio_fob || 0)
                      }
                    ]

              const values = history.map((h) => Number(h.precio_fob || 0))
              const maxV = Math.max(...values, 1) * 1.1
              const minV = Math.max(0, Math.min(...values) * 0.9)
              const range = Math.max(maxV - minV, 1)

              const points = history
                .map((h, i) => {
                  const x =
                    history.length === 1 ? 240 : 40 + (i / (history.length - 1)) * 400
                  const y = 140 - ((Number(h.precio_fob) - minV) / range) * 100
                  return `${x},${y}`
                })
                .join(' ')

              return (
                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200">
                  <svg viewBox="0 0 480 170" className="w-full h-40">
                    <line x1="40" y1="30" x2="440" y2="30" stroke="#E2E8F0" strokeDasharray="4" />
                    <line x1="40" y1="85" x2="440" y2="85" stroke="#E2E8F0" strokeDasharray="4" />
                    <line x1="40" y1="140" x2="440" y2="140" stroke="#CBD5E1" />
                    {history.length > 1 && (
                      <polyline fill="none" stroke="#FF5500" strokeWidth="3" points={points} />
                    )}
                    {history.map((h, i) => {
                      const x =
                        history.length === 1 ? 240 : 40 + (i / (history.length - 1)) * 400
                      const y = 140 - ((Number(h.precio_fob) - minV) / range) * 100
                      return (
                        <g key={i}>
                          <circle cx={x} cy={y} r="5" fill="#FF5500" />
                          <text
                            x={x}
                            y={y - 10}
                            textAnchor="middle"
                            fontSize="10"
                            fill="#0F172A"
                            fontFamily="JetBrains Mono"
                          >
                            ${formatMoney(h.precio_fob)}
                          </text>
                        </g>
                      )
                    })}
                  </svg>
                </div>
              )
            })()}

            <form
              onSubmit={(e) => {
                e.preventDefault()
                const val = Number(newPriceInput)
                if (!Number.isFinite(val) || val < 0) return
                const updated = onUpdateProductPrice(historyModalProd.id_producto, val)
                if (updated) setHistoryModalProd(updated)
              }}
              className="p-3.5 rounded-2xl bg-orange-50/60 border border-orange-200 flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5"
            >
              <div className="flex-1">
                <label className="block text-[11px] font-semibold text-slate-700">
                  Actualizar precio detectado ($):
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={newPriceInput}
                  onChange={(e) => setNewPriceInput(e.target.value)}
                  className="mt-1 w-full px-3 py-1.5 rounded-xl bg-white border border-orange-200 font-mono text-xs"
                />
              </div>
              <button
                type="submit"
                className="btn-nexus-primary px-4 py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 self-end"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Guardar Precio</span>
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
