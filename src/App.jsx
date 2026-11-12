import React, { useState, useEffect, useMemo } from 'react'
import {
  Cpu,
  Globe,
  Calculator,
  FileSpreadsheet,
  UserCheck,
  LogOut,
  Clock
} from 'lucide-react'
import {
  loadDatabase,
  saveDatabase,
  resetDatabaseClean,
  loadSession,
  saveSession,
  clearSession
} from './services/storageService'
import { GestorImpuestos, hashPassword, calcularSimilitudProductos } from './models/entities'
import LoginView from './components/LoginView'
import ScrapingModule from './components/ScrapingModule'
import CostAnalysisModule from './components/CostAnalysisModule'
import PriceListsModule from './components/PriceListsModule'
import UsersAndAdminModule from './components/UsersAndAdminModule'

export default function App() {
  const [db, setDb] = useState(() => loadDatabase())
  const [session, setSession] = useState(() => loadSession())
  const [sessionExpiredNotice, setSessionExpiredNotice] = useState(false)
  const [activeTab, setActiveTab] = useState('scraping') // 'scraping' | 'analysis' | 'lists' | 'users'
  const [preselectedForList, setPreselectedForList] = useState([])
  const [preselectedForCompare, setPreselectedForCompare] = useState([])

  useEffect(() => {
    saveDatabase(db)
  }, [db])

  useEffect(() => {
    if (session?.expired) {
      setSession(null)
      setSessionExpiredNotice(true)
    }
  }, [session])

  const addAuditLog = (modulo, accion, emailOverride) => {
    const email = emailOverride || session?.email || 'operador@nexprice.com'
    setDb((prev) => ({
      ...prev,
      AUDITORIA_SISTEMA: [
        {
          id_log: Date.now() + Math.floor(Math.random() * 1000),
          fecha: new Date().toISOString(),
          usuario_email: email,
          modulo,
          accion
        },
        ...(prev.AUDITORIA_SISTEMA || [])
      ]
    }))
  }

  const handleLogin = (email, password) => {
    const cuenta = db.CUENTAS.find(
      (c) => c.email.toLowerCase() === email.toLowerCase()
    )
    if (!cuenta) {
      return {
        ok: false,
        message: 'No existe una cuenta registrada con ese correo electrónico.'
      }
    }
    if (!cuenta.activo) {
      return {
        ok: false,
        message: 'Esta cuenta se encuentra desactivada.'
      }
    }
    if (cuenta.clave_hash !== hashPassword(password)) {
      return {
        ok: false,
        message: 'La clave ingresada no es válida.'
      }
    }

    const newSession = saveSession({
      id_cuenta: cuenta.id_cuenta,
      email: cuenta.email,
      rol: cuenta.rol
    })
    setSession(newSession)
    setSessionExpiredNotice(false)
    addAuditLog('ACCESO', `Inicio de sesión exitoso (${cuenta.rol})`, cuenta.email)
    return { ok: true }
  }

  const handleRecoverPassword = (email) => {
    addAuditLog('SEGURIDAD', `Solicitud de restablecimiento de clave para ${email}`, email)
    return `Se envió un enlace de verificación a ${email} para restablecer tu clave de acceso.`
  }

  const handleLogout = () => {
    if (session?.email) {
      addAuditLog('ACCESO', 'Cierre de sesión manual', session.email)
    }
    clearSession()
    setSession(null)
  }

  const impuestosActuales = useMemo(() => {
    return (
      db.GESTOR_IMPUESTOS?.[0] || {
        iva: 0,
        tasa_estadistica: 0,
        derechos_importacion: 0,
        impuestos_extra: 0,
        tarifa_por_kg: 0,
        tarifa_por_m3: 0,
        costo_fijo_logistico: 0,
        cotizacion_dolar_ars: 1050
      }
    )
  }, [db.GESTOR_IMPUESTOS])

  const perfilOperadorActual = useMemo(() => {
    return (
      db.USUARIOS?.[0] || {
        razon_social: 'Comercializadora NexPrice',
        localidad: 'Argentina',
        categoria: 'Distribuidor Comercial',
        margen_ganancia: 0,
        segmentos_rentabilidad: { Distribuidor: 0, Mayorista: 0, Minorista: 0 }
      }
    )
  }, [db.USUARIOS])

  // Guardar múltiples productos extraídos de una misma página
  const handleSaveMultipleProducts = (itemsArray = []) => {
    if (!Array.isArray(itemsArray) || itemsArray.length === 0) return
    setDb((prev) => {
      const list = [...(prev.PRODUCTOS || [])]
      const now = new Date().toISOString()
      let nextId = list.length > 0 ? Math.max(...list.map((p) => p.id_producto)) + 1 : 1

      itemsArray.forEach((prodData) => {
        // Emparejar con grupo existente si comparten término de búsqueda o similitud en el título
        let matchedGroup = null
        const termNorm = (prodData.termino_busqueda || '').trim().toLowerCase()
        for (const existing of list) {
          const existingTerm = (existing.termino_busqueda || '').trim().toLowerCase()
          if (termNorm && existingTerm && termNorm === existingTerm) {
            matchedGroup = existing.id_agrupacion || existing.id_producto
            break
          }
          if (calcularSimilitudProductos(prodData.titulo, existing.titulo) >= 0.35) {
            matchedGroup = existing.id_agrupacion || existing.id_producto
            break
          }
        }

        const currentId = nextId++
        list.unshift({
          ...prodData,
          id_producto: currentId,
          id_agrupacion: matchedGroup || currentId,
          fecha_extraccion: now,
          historial_precios: [
            { fecha: now, precio_fob: Number(prodData.precio_fob) || 0 }
          ]
        })
      })

      return {
        ...prev,
        PRODUCTOS: list
      }
    })
    addAuditLog('EXTRACCIÓN', `Se extrajeron ${itemsArray.length} producto(s) desde página web`)
  }

  const handleSaveProduct = (prodData) => {
    let savedProd = null
    setDb((prev) => {
      const list = [...(prev.PRODUCTOS || [])]
      const now = new Date().toISOString()

      if (prodData.id_producto) {
        const idx = list.findIndex((p) => p.id_producto === prodData.id_producto)
        if (idx > -1) {
          const old = list[idx]
          const nextHistory = [
            ...(old.historial_precios || []),
            { fecha: now, precio_fob: Number(prodData.precio_fob) || 0 }
          ]
          savedProd = {
            ...old,
            ...prodData,
            historial_precios: nextHistory
          }
          list[idx] = savedProd
        }
      }

      if (!savedProd) {
        const newId =
          list.length > 0 ? Math.max(...list.map((p) => p.id_producto)) + 1 : 1
        savedProd = {
          ...prodData,
          id_producto: newId,
          id_agrupacion: prodData.id_agrupacion || newId,
          fecha_extraccion: now,
          historial_precios: [
            { fecha: now, precio_fob: Number(prodData.precio_fob) || 0 }
          ]
        }
        list.unshift(savedProd)
      }

      return {
        ...prev,
        PRODUCTOS: list
      }
    })
    addAuditLog('EXTRACCIÓN', `Producto guardado: ${prodData.titulo}`)
    return savedProd
  }

  const handleDeleteProduct = (id_producto) => {
    setDb((prev) => ({
      ...prev,
      PRODUCTOS: prev.PRODUCTOS.filter((p) => p.id_producto !== id_producto)
    }))
  }

  const handleClearAllProducts = () => {
    setDb((prev) => ({
      ...prev,
      PRODUCTOS: []
    }))
  }

  const handleUpdateProductPrice = (id_producto, nuevoPrecioFob) => {
    let updatedRef = null
    setDb((prev) => {
      const now = new Date().toISOString()
      const alertas = [...(prev.NOTIFICACIONES_PRECIOS || [])]
      const nextProducts = prev.PRODUCTOS.map((p) => {
        if (p.id_producto !== id_producto) return p
        const precioAnterior = Number(p.precio_fob || 0)
        if (nuevoPrecioFob < precioAnterior && precioAnterior > 0) {
          const ahorro = (precioAnterior - nuevoPrecioFob).toFixed(2)
          alertas.unshift({
            id: Date.now(),
            fecha: now,
            id_producto,
            mensaje: `Baja de precio detectada en "${p.titulo}" (${p.nombre_proveedor}): bajó de USD ${precioAnterior.toFixed(2)} a USD ${nuevoPrecioFob.toFixed(2)} (-USD ${ahorro}).`
          })
        }
        const updated = {
          ...p,
          precio_fob: nuevoPrecioFob,
          historial_precios: [
            ...(p.historial_precios || []),
            { fecha: now, precio_fob: nuevoPrecioFob }
          ]
        }
        updatedRef = updated
        return updated
      })

      return {
        ...prev,
        PRODUCTOS: nextProducts,
        NOTIFICACIONES_PRECIOS: alertas
      }
    })
    return updatedRef
  }

  const handleLinkProductsGroup = (updates) => {
    setDb((prev) => {
      const groupMap = {}
      updates.forEach((u) => {
        groupMap[u.id_producto] = u.id_agrupacion
      })
      return {
        ...prev,
        PRODUCTOS: prev.PRODUCTOS.map((p) =>
          groupMap[p.id_producto]
            ? { ...p, id_agrupacion: groupMap[p.id_producto] }
            : p
        )
      }
    })
  }

  const handleSaveImpuestos = (newTaxCfg) => {
    setDb((prev) => ({
      ...prev,
      GESTOR_IMPUESTOS: [
        {
          id_configuracion: 1,
          id_usuario: 1,
          ...newTaxCfg
        }
      ]
    }))
    addAuditLog('COSTOS', 'Actualización de parámetros de impuestos y envío')
  }

  const handleSaveCotizacion = ({
    titulo_lista,
    segmento_cliente,
    cliente_nombre,
    fecha_vigencia,
    costo_logistico,
    descuento_global,
    total,
    detalles
  }) => {
    setDb((prev) => {
      const currentCots = prev.COTIZACIONES || []
      const newCotId =
        currentCots.length > 0
          ? Math.max(...currentCots.map((c) => c.id_cotizacion)) + 1
          : 1001

      const nuevaCot = {
        id_cotizacion: newCotId,
        id_usuario: 1,
        titulo_lista,
        segmento_cliente,
        cliente_nombre,
        fecha: new Date().toISOString(),
        fecha_vigencia,
        costo_logistico,
        descuento_global,
        total,
        activo: true
      }

      const currentDets = prev.COTIZACION_DETALLE || []
      let nextDetId =
        currentDets.length > 0
          ? Math.max(...currentDets.map((d) => d.id_detalle)) + 1
          : 1

      const nuevosDetalles = detalles.map((d) => ({
        id_detalle: nextDetId++,
        id_cotizacion: newCotId,
        id_producto: d.id_producto,
        titulo_snapshot: d.titulo_snapshot,
        cantidad: d.cantidad,
        costo_importacion_unitario: d.costo_importacion_unitario,
        margen_aplicado: d.margen_aplicado,
        precio_venta_historico: d.precio_venta_historico
      }))

      let nextClientes = prev.CLIENTES || []
      const cleanClientName = String(cliente_nombre || '').trim()
      if (
        cleanClientName &&
        cleanClientName.toLowerCase() !== 'cliente general' &&
        !nextClientes.some(
          (c) =>
            String(c.razon_social || '')
              .trim()
              .toLowerCase() === cleanClientName.toLowerCase()
        )
      ) {
        nextClientes = [
          {
            id: Date.now() + 1,
            razon_social: cleanClientName,
            segmento: segmento_cliente || 'Mayorista',
            email: '',
            telefono: '',
            cuit: '',
            localidad: ''
          },
          ...nextClientes
        ]
      }

      return {
        ...prev,
        CLIENTES: nextClientes,
        COTIZACIONES: [nuevaCot, ...currentCots],
        COTIZACION_DETALLE: [...nuevosDetalles, ...currentDets]
      }
    })
    addAuditLog('LISTAS DE VENTA', `Generación de lista "${titulo_lista}" para ${cliente_nombre}`)
  }

  const handleOneClickUpdateCotizacion = (id_cotizacion) => {
    const gestor = new GestorImpuestos(impuestosActuales)
    setDb((prev) => {
      const cot = prev.COTIZACIONES.find((c) => c.id_cotizacion === id_cotizacion)
      if (!cot) return prev

      const segs = prev.USUARIOS?.[0]?.segmentos_rentabilidad || {}
      const margenSeg =
        segs[cot.segmento_cliente] !== undefined
          ? Number(segs[cot.segmento_cliente]) || 0
          : Number(prev.USUARIOS?.[0]?.margen_ganancia) || 0

      let nuevoSubtotal = 0
      const nextDetalles = prev.COTIZACION_DETALLE.map((det) => {
        if (det.id_cotizacion !== id_cotizacion) return det
        const prod = prev.PRODUCTOS.find((p) => p.id_producto === det.id_producto)
        if (!prod) {
          nuevoSubtotal += Number(det.cantidad || 1) * Number(det.precio_venta_historico || 0)
          return det
        }
        const nuevoCostoImp = gestor.calcularCostoTotal(prod)
        const nuevoPrecioVenta = Number(
          (nuevoCostoImp * (1 + margenSeg / 100)).toFixed(2)
        )
        nuevoSubtotal += Number(det.cantidad || 1) * nuevoPrecioVenta
        return {
          ...det,
          costo_importacion_unitario: nuevoCostoImp,
          margen_aplicado: margenSeg,
          precio_venta_historico: nuevoPrecioVenta
        }
      })

      const factorAjuste = 1 + (Number(cot.descuento_global) || 0) / 100
      const nuevoTotal = Number(
        Math.max(
          0,
          nuevoSubtotal * factorAjuste + (Number(cot.costo_logistico) || 0)
        ).toFixed(2)
      )

      const nextCotizaciones = prev.COTIZACIONES.map((c) =>
        c.id_cotizacion === id_cotizacion
          ? { ...c, total: nuevoTotal, fecha: new Date().toISOString() }
          : c
      )

      return {
        ...prev,
        COTIZACIONES: nextCotizaciones,
        COTIZACION_DETALLE: nextDetalles
      }
    })
    addAuditLog('LISTAS DE VENTA', `Actualización de precios en Lista #${id_cotizacion}`)
  }

  const handleSoftDeleteCotizacion = (id_cotizacion) => {
    setDb((prev) => ({
      ...prev,
      COTIZACIONES: prev.COTIZACIONES.map((c) =>
        c.id_cotizacion === id_cotizacion ? { ...c, activo: false } : c
      )
    }))
    addAuditLog('LISTAS DE VENTA', `Eliminación de Lista #${id_cotizacion}`)
  }

  // Normalizador para evitar duplicados de clientes por nombre o email
  const normalizeText = (str) =>
    String(str || '')
      .trim()
      .toLowerCase()
      .replace(/\s+/g, ' ')

  const handleAddCliente = (cli) => {
    const nombreNorm = normalizeText(cli.razon_social)
    const emailNorm = normalizeText(cli.email)
    const cuitNorm = normalizeText(cli.cuit)

    if (!nombreNorm) {
      return { ok: false, message: 'El nombre o razón social del cliente es obligatorio.' }
    }

    const currentClients = db.CLIENTES || []
    const duplicateByName = currentClients.find(
      (c) => normalizeText(c.razon_social) === nombreNorm
    )
    if (duplicateByName) {
      return {
        ok: false,
        message: `Ya existe un cliente registrado con el nombre "${duplicateByName.razon_social}". No se permiten clientes duplicados.`
      }
    }

    if (emailNorm) {
      const duplicateByEmail = currentClients.find(
        (c) => normalizeText(c.email) === emailNorm
      )
      if (duplicateByEmail) {
        return {
          ok: false,
          message: `El correo "${cli.email}" ya pertenece al cliente "${duplicateByEmail.razon_social}".`
        }
      }
    }

    if (cuitNorm) {
      const duplicateByCuit = currentClients.find(
        (c) => normalizeText(c.cuit) === cuitNorm
      )
      if (duplicateByCuit) {
        return {
          ok: false,
          message: `El CUIT/DNI "${cli.cuit}" ya pertenece al cliente "${duplicateByCuit.razon_social}".`
        }
      }
    }

    const newClient = {
      id: Date.now(),
      razon_social: String(cli.razon_social).trim(),
      segmento: cli.segmento || 'Mayorista',
      email: String(cli.email || '').trim(),
      telefono: String(cli.telefono || '').trim(),
      cuit: String(cli.cuit || '').trim(),
      localidad: String(cli.localidad || '').trim()
    }

    setDb((prev) => ({
      ...prev,
      CLIENTES: [newClient, ...(prev.CLIENTES || [])]
    }))
    addAuditLog('CLIENTES', `Registro de cliente: ${newClient.razon_social}`)
    return {
      ok: true,
      message: `Cliente "${newClient.razon_social}" registrado correctamente.`,
      client: newClient
    }
  }

  const handleUpdateCliente = (updatedCli) => {
    const idTarget = updatedCli.id
    const nombreNorm = normalizeText(updatedCli.razon_social)
    const emailNorm = normalizeText(updatedCli.email)
    const cuitNorm = normalizeText(updatedCli.cuit)

    if (!nombreNorm) {
      return { ok: false, message: 'El nombre o razón social del cliente es obligatorio.' }
    }

    const currentClients = db.CLIENTES || []
    const existingClient = currentClients.find((c) => c.id === idTarget)

    const duplicateByName = currentClients.find(
      (c) => c.id !== idTarget && normalizeText(c.razon_social) === nombreNorm
    )
    if (duplicateByName) {
      return {
        ok: false,
        message: `No se puede guardar: ya existe otro cliente llamado "${duplicateByName.razon_social}".`
      }
    }

    if (emailNorm) {
      const duplicateByEmail = currentClients.find(
        (c) => c.id !== idTarget && normalizeText(c.email) === emailNorm
      )
      if (duplicateByEmail) {
        return {
          ok: false,
          message: `No se puede guardar: el correo "${updatedCli.email}" ya está asignado a "${duplicateByEmail.razon_social}".`
        }
      }
    }

    if (cuitNorm) {
      const duplicateByCuit = currentClients.find(
        (c) => c.id !== idTarget && normalizeText(c.cuit) === cuitNorm
      )
      if (duplicateByCuit) {
        return {
          ok: false,
          message: `No se puede guardar: el CUIT/DNI "${updatedCli.cuit}" ya está asignado a "${duplicateByCuit.razon_social}".`
        }
      }
    }

    const cleanUpdated = {
      ...existingClient,
      ...updatedCli,
      razon_social: String(updatedCli.razon_social).trim(),
      segmento: updatedCli.segmento || 'Mayorista',
      email: String(updatedCli.email || '').trim(),
      telefono: String(updatedCli.telefono || '').trim(),
      cuit: String(updatedCli.cuit || '').trim(),
      localidad: String(updatedCli.localidad || '').trim()
    }

    setDb((prev) => {
      const oldNameNorm = existingClient ? normalizeText(existingClient.razon_social) : ''
      const nextCotizaciones = (prev.COTIZACIONES || []).map((cot) => {
        if (oldNameNorm && normalizeText(cot.cliente_nombre) === oldNameNorm) {
          return {
            ...cot,
            cliente_nombre: cleanUpdated.razon_social
          }
        }
        return cot
      })

      return {
        ...prev,
        CLIENTES: (prev.CLIENTES || []).map((c) => (c.id === idTarget ? cleanUpdated : c)),
        COTIZACIONES: nextCotizaciones
      }
    })

    addAuditLog('CLIENTES', `Edición de cliente: ${cleanUpdated.razon_social}`)
    return {
      ok: true,
      message: `Cliente "${cleanUpdated.razon_social}" actualizado correctamente.`,
      client: cleanUpdated
    }
  }

  if (!session || session.expired) {
    return (
      <LoginView
        onLogin={handleLogin}
        onRecoverPassword={handleRecoverPassword}
        sessionExpiredNotice={sessionExpiredNotice}
      />
    )
  }

  return (
    <div className="min-h-screen bg-futuristic-grid flex flex-col">
      {/* Barra de Navegación Superior Futurista Blanca y Naranja */}
      <header className="sticky top-0 z-40 bg-white/90 backdrop-blur-md border-b border-slate-200/90 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#FF5500] to-[#FF8000] text-white flex items-center justify-center shadow-orange-glow">
              <Cpu className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-display font-bold text-lg tracking-tight text-slate-900">
                  NEX<span className="text-[#FF5500]">PRICE</span>
                </span>
                <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded-full bg-orange-50 text-[#FF5500] border border-orange-200 font-semibold">
                  {session.rol}
                </span>
              </div>
              <p className="text-[11px] text-slate-500 hidden sm:block">
                {perfilOperadorActual.razon_social} • Comparador de Proveedores y Listas de Venta
              </p>
            </div>
          </div>

          <nav className="flex flex-wrap items-center gap-1.5 bg-slate-100/90 p-1.5 rounded-2xl border border-slate-200">
            <button
              type="button"
              onClick={() => setActiveTab('scraping')}
              className={`px-3.5 py-2 rounded-xl text-xs font-semibold transition flex items-center gap-1.5 ${
                activeTab === 'scraping'
                  ? 'bg-[#FF5500] text-white shadow-orange-subtle'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
              }`}
            >
              <Globe className="w-3.5 h-3.5" />
              <span>1. Extraer Productos ({db.PRODUCTOS.length})</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('analysis')}
              className={`px-3.5 py-2 rounded-xl text-xs font-semibold transition flex items-center gap-1.5 ${
                activeTab === 'analysis'
                  ? 'bg-[#FF5500] text-white shadow-orange-subtle'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
              }`}
            >
              <Calculator className="w-3.5 h-3.5" />
              <span>2. Proveedor Más Barato</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('lists')}
              className={`px-3.5 py-2 rounded-xl text-xs font-semibold transition flex items-center gap-1.5 ${
                activeTab === 'lists'
                  ? 'bg-[#FF5500] text-white shadow-orange-subtle'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
              }`}
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span>
                3. Lista de Venta Cliente (
                {db.COTIZACIONES.filter((c) => c.activo !== false).length})
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('users')}
              className={`px-3.5 py-2 rounded-xl text-xs font-semibold transition flex items-center gap-1.5 ${
                activeTab === 'users'
                  ? 'bg-[#FF5500] text-white shadow-orange-subtle'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
              }`}
            >
              <UserCheck className="w-3.5 h-3.5" />
              <span>4. Empresa y Clientes</span>
            </button>
          </nav>

          <div className="flex items-center gap-3">
            <div className="hidden xl:flex flex-col items-end">
              <span className="text-xs font-semibold text-slate-800">{session.email}</span>
              <span className="text-[10px] font-mono text-emerald-600 flex items-center gap-1">
                <Clock className="w-3 h-3" /> Sesión activa
              </span>
            </div>

            <button
              type="button"
              onClick={handleLogout}
              title="Cerrar sesión"
              className="p-2.5 rounded-xl border border-slate-200 bg-white text-slate-600 hover:border-[#FF5500] hover:text-[#FF5500] transition"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Contenido Dinámico Principal (sin las 4 tarjetas superiores eliminadas) */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6">
        {activeTab === 'scraping' && (
          <ScrapingModule
            productos={db.PRODUCTOS}
            dominios={db.DOMINIOS_PROVEEDORES}
            tareasProgramadas={db.TAREAS_PROGRAMADAS}
            logsScraping={db.LOGS_SCRAPING}
            cotizacionDolar={impuestosActuales.cotizacion_dolar_ars}
            onSaveProduct={handleSaveProduct}
            onSaveMultipleProducts={handleSaveMultipleProducts}
            onDeleteProduct={handleDeleteProduct}
            onClearAllProducts={handleClearAllProducts}
            onAddDominio={(dom) =>
              setDb((prev) => ({
                ...prev,
                DOMINIOS_PROVEEDORES: [
                  { id: Date.now(), ...dom },
                  ...prev.DOMINIOS_PROVEEDORES
                ]
              }))
            }
            onDeleteDominio={(id) =>
              setDb((prev) => ({
                ...prev,
                DOMINIOS_PROVEEDORES: prev.DOMINIOS_PROVEEDORES.filter((d) => d.id !== id)
              }))
            }
            onAddTarea={(t) =>
              setDb((prev) => ({
                ...prev,
                TAREAS_PROGRAMADAS: [
                  { id: Date.now(), activa: true, ...t },
                  ...prev.TAREAS_PROGRAMADAS
                ]
              }))
            }
            onDeleteTarea={(id) =>
              setDb((prev) => ({
                ...prev,
                TAREAS_PROGRAMADAS: prev.TAREAS_PROGRAMADAS.filter((t) => t.id !== id)
              }))
            }
            onToggleTarea={(id) =>
              setDb((prev) => ({
                ...prev,
                TAREAS_PROGRAMADAS: prev.TAREAS_PROGRAMADAS.map((t) =>
                  t.id === id ? { ...t, activa: !t.activa } : t
                )
              }))
            }
            onAddLog={(log) =>
              setDb((prev) => ({
                ...prev,
                LOGS_SCRAPING: [
                  { id: Date.now() + Math.random(), fecha: new Date().toISOString(), ...log },
                  ...prev.LOGS_SCRAPING
                ]
              }))
            }
            onClearLogs={() => setDb((prev) => ({ ...prev, LOGS_SCRAPING: [] }))}
            onCompareSelectedProducts={(ids) => {
              setPreselectedForCompare(ids)
              setActiveTab('analysis')
            }}
            onCreateListWithProducts={(ids) => {
              setPreselectedForList(ids)
              setActiveTab('lists')
            }}
          />
        )}

        {activeTab === 'analysis' && (
          <CostAnalysisModule
            productos={db.PRODUCTOS}
            impuestosConfig={impuestosActuales}
            notificacionesPrecios={db.NOTIFICACIONES_PRECIOS}
            preselectedCompareIds={preselectedForCompare}
            onClearPreselectedCompare={() => setPreselectedForCompare([])}
            onSaveImpuestos={handleSaveImpuestos}
            onUpdateProductPrice={handleUpdateProductPrice}
            onLinkProductsGroup={handleLinkProductsGroup}
            onCreateListWithProducts={(ids) => {
              setPreselectedForList(ids)
              setActiveTab('lists')
            }}
          />
        )}

        {activeTab === 'lists' && (
          <PriceListsModule
            productos={db.PRODUCTOS}
            cotizaciones={db.COTIZACIONES}
            cotizacionDetalles={db.COTIZACION_DETALLE}
            impuestosConfig={impuestosActuales}
            perfilOperador={perfilOperadorActual}
            clientes={db.CLIENTES}
            preselectedProductIds={preselectedForList}
            onClearPreselected={() => setPreselectedForList([])}
            onSaveCotizacion={handleSaveCotizacion}
            onOneClickUpdateCotizacion={handleOneClickUpdateCotizacion}
            onSoftDeleteCotizacion={handleSoftDeleteCotizacion}
            onAddCliente={handleAddCliente}
            onUpdateCliente={handleUpdateCliente}
          />
        )}

        {activeTab === 'users' && (
          <UsersAndAdminModule
            currentUser={session}
            cuentas={db.CUENTAS}
            usuarios={db.USUARIOS}
            clientes={db.CLIENTES}
            auditoriaLogs={db.AUDITORIA_SISTEMA}
            onSavePerfilOperador={(newProfile) => {
              setDb((prev) => ({
                ...prev,
                USUARIOS: [{ ...(prev.USUARIOS?.[0] || { id_usuario: 1, id_cuenta: 2 }), ...newProfile }]
              }))
              addAuditLog('EMPRESA', 'Actualización de datos comerciales y márgenes')
            }}
            onAddCliente={handleAddCliente}
            onUpdateCliente={handleUpdateCliente}
            onDeleteCliente={(id) =>
              setDb((prev) => ({
                ...prev,
                CLIENTES: prev.CLIENTES.filter((c) => c.id !== id)
              }))
            }
            onAdminCreateOperator={({ email, password, razon_social, localidad, categoria }) => {
              if (db.CUENTAS.some((c) => c.email.toLowerCase() === email.toLowerCase())) {
                return { ok: false, message: 'Ya existe una cuenta con ese correo.' }
              }
              const newIdCuenta = Math.max(...db.CUENTAS.map((c) => c.id_cuenta)) + 1
              const newIdUsuario = Math.max(...db.USUARIOS.map((u) => u.id_usuario)) + 1
              setDb((prev) => ({
                ...prev,
                CUENTAS: [
                  ...prev.CUENTAS,
                  {
                    id_cuenta: newIdCuenta,
                    email,
                    clave_hash: hashPassword(password),
                    rol: 'USUARIO',
                    activo: true,
                    fecha_creacion: new Date().toISOString()
                  }
                ],
                USUARIOS: [
                  ...prev.USUARIOS,
                  {
                    id_usuario: newIdUsuario,
                    id_cuenta: newIdCuenta,
                    razon_social,
                    localidad,
                    categoria,
                    margen_ganancia: 0,
                    segmentos_rentabilidad: { Distribuidor: 0, Mayorista: 0, Minorista: 0 }
                  }
                ]
              }))
              addAuditLog('USUARIOS', `Alta de nuevo operador: ${email}`)
              return { ok: true, message: `Operador ${email} registrado correctamente.` }
            }}
            onAdminToggleAccountStatus={(id_cuenta) => {
              setDb((prev) => ({
                ...prev,
                CUENTAS: prev.CUENTAS.map((c) =>
                  c.id_cuenta === id_cuenta ? { ...c, activo: !c.activo } : c
                )
              }))
              addAuditLog('USUARIOS', `Cambio de estado sobre cuenta #${id_cuenta}`)
            }}
            onExportBackup={() => {
              const blob = new Blob([JSON.stringify(db, null, 2)], {
                type: 'application/json'
              })
              const url = URL.createObjectURL(blob)
              const a = document.createElement('a')
              a.href = url
              a.download = `NEXPRICE_Respaldo_${new Date().toISOString().slice(0, 10)}.json`
              a.click()
              URL.revokeObjectURL(url)
              addAuditLog('RESPALDO', 'Descarga de copia de seguridad')
            }}
            onImportBackup={(importedDb) => {
              setDb((prev) => ({ ...prev, ...importedDb }))
              addAuditLog('RESPALDO', 'Restauración de base de datos desde archivo')
            }}
            onResetCleanDatabase={() => {
              const clean = resetDatabaseClean()
              setDb(clean)
            }}
          />
        )}
      </main>
    </div>
  )
}
