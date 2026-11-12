import { hashPassword } from '../models/entities'

const STORAGE_KEY = 'NEXPRICE_DB_V1'
const SESSION_KEY = 'NEXPRICE_ACTIVE_SESSION_V1'
const TWELVE_HOURS_MS = 12 * 60 * 60 * 1000

export function getInitialDatabase() {
  const now = new Date().toISOString()
  return {
    CUENTAS: [
      {
        id_cuenta: 1,
        email: 'admin@nexprice.com',
        clave_hash: hashPassword('admin123'),
        rol: 'ADMIN',
        activo: true,
        fecha_creacion: now
      },
      {
        id_cuenta: 2,
        email: 'operador@nexprice.com',
        clave_hash: hashPassword('operador123'),
        rol: 'USUARIO',
        activo: true,
        fecha_creacion: now
      }
    ],
    ADMINISTRADORES: [
      {
        id_admin: 1,
        id_cuenta: 1,
        nombre: 'Administrador General',
        ultima_auditoria: now
      }
    ],
    USUARIOS: [
      {
        id_usuario: 1,
        id_cuenta: 2,
        razon_social: 'Comercializadora NexPrice',
        localidad: 'Argentina',
        categoria: 'Distribuidor Comercial',
        margen_ganancia: 0,
        telefono: '',
        email_comercial: 'ventas@nexprice.com',
        logo_url: '',
        segmentos_rentabilidad: {
          Distribuidor: 0,
          Mayorista: 0,
          Minorista: 0
        },
        lineas_rentabilidad: []
      }
    ],
    GESTOR_IMPUESTOS: [
      {
        id_configuracion: 1,
        id_usuario: 1,
        iva: 0,
        tasa_estadistica: 0,
        derechos_importacion: 0,
        impuestos_extra: 0,
        tarifa_por_kg: 0,
        tarifa_por_m3: 0,
        costo_fijo_logistico: 0,
        cotizacion_dolar_ars: 1050
      }
    ],
    PRODUCTOS: [],
    COTIZACIONES: [],
    COTIZACION_DETALLE: [],
    CLIENTES: [],
    DOMINIOS_PROVEEDORES: [],
    TAREAS_PROGRAMADAS: [],
    LOGS_SCRAPING: [],
    AUDITORIA_SISTEMA: [
      {
        id_log: 1,
        fecha: now,
        usuario_email: 'sistema@nexprice.com',
        modulo: 'SEGURIDAD',
        accion: 'Inicialización del sistema',
        nivel: 'INFO'
      }
    ],
    NOTIFICACIONES_PRECIOS: []
  }
}

export function loadDatabase() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) {
      const initial = getInitialDatabase()
      localStorage.setItem(STORAGE_KEY, JSON.stringify(initial))
      return initial
    }
    const parsed = JSON.parse(raw)
    const defaults = getInitialDatabase()
    return { ...defaults, ...parsed }
  } catch {
    return getInitialDatabase()
  }
}

export function saveDatabase(db) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(db))
}

export function resetDatabaseClean() {
  const initial = getInitialDatabase()
  localStorage.setItem(STORAGE_KEY, JSON.stringify(initial))
  return initial
}

export function loadSession() {
  try {
    const raw = localStorage.getItem(SESSION_KEY)
    if (!raw) return null
    const session = JSON.parse(raw)
    const now = Date.now()
    if (!session.lastActivity || now - session.lastActivity > TWELVE_HOURS_MS) {
      localStorage.removeItem(SESSION_KEY)
      return { expired: true }
    }
    session.lastActivity = now
    localStorage.setItem(SESSION_KEY, JSON.stringify(session))
    return session
  } catch {
    return null
  }
}

export function saveSession(sessionData) {
  const payload = {
    ...sessionData,
    loginAt: sessionData.loginAt || Date.now(),
    lastActivity: Date.now()
  }
  localStorage.setItem(SESSION_KEY, JSON.stringify(payload))
  return payload
}

export function clearSession() {
  localStorage.removeItem(SESSION_KEY)
}
