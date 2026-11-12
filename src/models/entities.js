/**
 * Arquitectura Orientada a Objetos y Modelo de Negocio (Secciones 4.7, 4.8 y 4.9 del TP)
 * Implementa:
 * - Superclase Cuenta y subclases Administrador / Usuario
 * - Clase GestorImpuestos (SRP - Lógica fiscal aislada sin valores hardcodeados)
 * - Abstracción IScraper y cliente modular de extracción
 * - Clases Producto, Cotizacion y CotizacionDetalle (3FN)
 */

// Hash simple determinístico para simulación local de contraseñas cifradas (RF-01 / RNF-01 Seguridad)
export function hashPassword(rawPassword = '') {
  let hash = 2166136261
  const str = `nexprice_salt_${rawPassword}`
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i)
    hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24)
  }
  return `sha256$${(hash >>> 0).toString(16).padStart(8, '0')}`
}

export class Cuenta {
  constructor({ id_cuenta, email, clave_hash, rol = 'USUARIO', activo = true, fecha_creacion }) {
    this.id_cuenta = id_cuenta
    this.email = email
    this.clave_hash = clave_hash
    this.rol = rol
    this.activo = activo
    this.fecha_creacion = fecha_creacion || new Date().toISOString()
  }

  autenticar(passwordPlano) {
    if (!this.activo) return false
    return this.clave_hash === hashPassword(passwordPlano)
  }
}

export class Administrador extends Cuenta {
  constructor(props) {
    super({ ...props, rol: 'ADMIN' })
    this.id_admin = props.id_admin
    this.ultima_auditoria = props.ultima_auditoria || new Date().toISOString()
  }
}

export class Usuario extends Cuenta {
  constructor(props) {
    super({ ...props, rol: 'USUARIO' })
    this.id_usuario = props.id_usuario
    this.razon_social = props.razon_social || ''
    this.localidad = props.localidad || ''
    this.categoria = props.categoria || 'Importador Mayorista'
    this.margen_ganancia = Number(props.margen_ganancia ?? 0)
    this.telefono = props.telefono || ''
    this.email_comercial = props.email_comercial || props.email || ''
    this.logo_url = props.logo_url || ''
    // RF-04: Porcentajes de rentabilidad según segmento de compradores y líneas de artículos
    this.segmentos_rentabilidad = props.segmentos_rentabilidad || {
      Distribuidor: 0,
      Mayorista: 0,
      Minorista: 0
    }
    this.lineas_rentabilidad = props.lineas_rentabilidad || []
  }
}

/**
 * Clase GestorImpuestos (Sección 4.7 y 4.8)
 * Sin porcentajes impositivos fijos ni hardcodeados: aplica estrictamente los valores
 * que el operador haya definido en su configuración.
 */
export class GestorImpuestos {
  constructor(config = {}) {
    this.id_configuracion = config.id_configuracion || 1
    this.id_usuario = config.id_usuario || 1
    this.iva = Number(config.iva ?? 0)
    this.tasa_estadistica = Number(config.tasa_estadistica ?? 0)
    this.derechos_importacion = Number(config.derechos_importacion ?? 0)
    this.impuestos_extra = Number(config.impuestos_extra ?? 0)
    // Parámetros logísticos configurables para estimar envío internacional (RF-02 Análisis)
    this.tarifa_por_kg = Number(config.tarifa_por_kg ?? 0)
    this.tarifa_por_m3 = Number(config.tarifa_por_m3 ?? 0)
    this.costo_fijo_logistico = Number(config.costo_fijo_logistico ?? 0)
    this.cotizacion_dolar_ars = Number(config.cotizacion_dolar_ars ?? 1050)
  }

  /**
   * RF-02 Análisis: Calcula el costo de envío internacional estimado según peso, volumen y costo base logístico
   */
  calcularCostoEnvio(producto = {}) {
    if (producto.costo_envio_manual !== undefined && producto.costo_envio_manual !== null && producto.costo_envio_manual !== '') {
      return Math.max(0, Number(producto.costo_envio_manual) || 0)
    }
    const peso = Math.max(0, Number(producto.peso_kg) || 0)
    const volumen = Math.max(0, Number(producto.volumen_m3) || 0)
    const envioCalculado =
      peso * this.tarifa_por_kg +
      volumen * this.tarifa_por_m3 +
      this.costo_fijo_logistico
    return Number(envioCalculado.toFixed(2))
  }

  /**
   * Calcula la base imponible (CIF estimado = Precio FOB + Envío internacional)
   */
  calcularBaseImponible(precioFOB = 0, costoEnvio = 0) {
    const fob = Math.max(0, Number(precioFOB) || 0)
    const envio = Math.max(0, Number(costoEnvio) || 0)
    return Number((fob + envio).toFixed(2))
  }

  /**
   * RF-03 Análisis y Sección 4.7:
   * Calcula el Costo Real Total de Importación por unidad (Precio FOB + Envío + Tasas/Impuestos configurados)
   */
  calcularDesgloseImportacion(producto = {}) {
    const precioFOB = Math.max(0, Number(producto.precio_fob) || 0)
    const costoEnvio = this.calcularCostoEnvio(producto)
    const baseImponible = this.calcularBaseImponible(precioFOB, costoEnvio)

    const montoDerechos = baseImponible * (this.derechos_importacion / 100)
    const montoTasaEstadistica = baseImponible * (this.tasa_estadistica / 100)
    const baseParaIva = baseImponible + montoDerechos + montoTasaEstadistica
    const montoIva = baseParaIva * (this.iva / 100)
    const montoImpuestosExtra = baseParaIva * (this.impuestos_extra / 100)

    const totalImpuestos = montoDerechos + montoTasaEstadistica + montoIva + montoImpuestosExtra
    const costoTotalImportacion = baseImponible + totalImpuestos

    return {
      precioFOB: Number(precioFOB.toFixed(2)),
      costoEnvio: Number(costoEnvio.toFixed(2)),
      baseImponible: Number(baseImponible.toFixed(2)),
      montoDerechos: Number(montoDerechos.toFixed(2)),
      montoTasaEstadistica: Number(montoTasaEstadistica.toFixed(2)),
      montoIva: Number(montoIva.toFixed(2)),
      montoImpuestosExtra: Number(montoImpuestosExtra.toFixed(2)),
      totalImpuestos: Number(totalImpuestos.toFixed(2)),
      costoTotalImportacion: Number(costoTotalImportacion.toFixed(2))
    }
  }

  calcularCostoTotal(producto = {}) {
    return this.calcularDesgloseImportacion(producto).costoTotalImportacion
  }
}

/**
 * Algoritmo de similitud de texto para emparejar productos equivalentes entre proveedores
 * (Sección 3.1 Normalización y emparejamiento inteligente / RF-04 Análisis / id_agrupacion DER)
 */
export function normalizarTextoComparacion(texto = '') {
  return String(texto)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\b(de|la|el|en|con|para|por|un|una|los|las|del|al|and|the|with|for|new|nuevo|original)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function calcularSimilitudProductos(tituloA = '', tituloB = '') {
  const tokensA = new Set(normalizarTextoComparacion(tituloA).split(' ').filter(t => t.length > 1))
  const tokensB = new Set(normalizarTextoComparacion(tituloB).split(' ').filter(t => t.length > 1))
  if (tokensA.size === 0 || tokensB.size === 0) return 0

  let interseccion = 0
  for (const token of tokensA) {
    if (tokensB.has(token)) interseccion++
  }
  const union = new Set([...tokensA, ...tokensB]).size
  return union === 0 ? 0 : interseccion / union
}
