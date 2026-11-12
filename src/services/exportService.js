import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import * as XLSX from 'xlsx'

export function exportCotizacionToPDF({ cotizacion, detalles, productosMap, perfilEmpresa }) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const razonSocial = perfilEmpresa?.razon_social || 'Empresa Importadora'
  const localidad = perfilEmpresa?.localidad || ''
  const telefono = perfilEmpresa?.telefono || ''
  const email = perfilEmpresa?.email_comercial || ''
  const categoria = perfilEmpresa?.categoria || 'Importador / Distribuidor'

  // Barra superior futurista Naranja
  doc.setFillColor(255, 85, 0)
  doc.rect(0, 0, 210, 8, 'F')

  // Encabezado de Empresa
  doc.setTextColor(15, 23, 42)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(18)
  doc.text(razonSocial.toUpperCase(), 14, 20)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(71, 85, 105)
  doc.text(`${categoria} ${localidad ? `| ${localidad}` : ''}`, 14, 26)
  doc.text(`Contacto: ${email || 'N/D'} ${telefono ? `| Tel: ${telefono}` : ''}`, 14, 31)

  // Caja derecha de metadatos de Lista de Venta
  doc.setFillColor(248, 250, 252)
  doc.setDrawColor(255, 85, 0)
  doc.setLineWidth(0.4)
  doc.roundedRect(130, 13, 66, 22, 2, 2, 'FD')

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.setTextColor(255, 85, 0)
  doc.text(`LISTA DE VENTA #${cotizacion.id_cotizacion}`, 134, 19)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8.5)
  doc.setTextColor(15, 23, 42)
  doc.text(`Fecha: ${new Date(cotizacion.fecha).toLocaleDateString('es-AR')}`, 134, 24.5)
  doc.text(`Vigencia: ${cotizacion.fecha_vigencia || '15 días'}`, 134, 29)
  doc.text(`Tipo Cliente: ${cotizacion.segmento_cliente || 'General'}`, 134, 33.5)

  // Título de lista y destinatario
  doc.setDrawColor(226, 232, 240)
  doc.line(14, 39, 196, 39)

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.setTextColor(15, 23, 42)
  doc.text(`Lista de Venta: ${cotizacion.titulo_lista || `Lista Comercial #${cotizacion.id_cotizacion}`}`, 14, 46)
  if (cotizacion.cliente_nombre) {
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9.5)
    doc.text(`Cliente destinatario: ${cotizacion.cliente_nombre}`, 14, 51.5)
  }

  const tableRows = detalles.map((det, idx) => {
    const prod = productosMap[det.id_producto] || {}
    const cantidad = Number(det.cantidad || 1)
    const unitario = Number(det.precio_venta_historico || 0)
    const subtotal = cantidad * unitario
    return [
      idx + 1,
      prod.titulo || det.titulo_snapshot || `Producto #${det.id_producto}`,
      prod.nombre_proveedor || prod.dominio_proveedor || 'Directo',
      cantidad,
      `USD ${unitario.toFixed(2)}`,
      `USD ${subtotal.toFixed(2)}`
    ]
  })

  autoTable(doc, {
    startY: cotizacion.cliente_nombre ? 56 : 51,
    head: [['#', 'Producto / Descripción', 'Proveedor Origen', 'Cant.', 'Precio Unit. Venta', 'Subtotal']],
    body: tableRows,
    theme: 'grid',
    headStyles: {
      fillColor: [255, 85, 0],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 9
    },
    styles: {
      fontSize: 8.5,
      cellPadding: 3,
      textColor: [15, 23, 42]
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252]
    },
    columnStyles: {
      0: { cellWidth: 10, halign: 'center' },
      3: { cellWidth: 16, halign: 'center' },
      4: { cellWidth: 34, halign: 'right' },
      5: { cellWidth: 34, halign: 'right' }
    }
  })

  const finalY = (doc.lastAutoTable?.finalY || 90) + 8

  const ajusteGlobal = Number(cotizacion.descuento_global || 0)
  const costoLogisticoExtra = Number(cotizacion.costo_logistico || 0)

  doc.setFillColor(248, 250, 252)
  doc.setDrawColor(226, 232, 240)
  doc.roundedRect(120, finalY, 76, 28, 2, 2, 'FD')

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(71, 85, 105)
  doc.text(
    `${ajusteGlobal < 0 ? 'Descuento global' : 'Recargo global'}: ${ajusteGlobal}%`,
    124,
    finalY + 7
  )
  doc.text(`Costo logístico adic.: USD ${costoLogisticoExtra.toFixed(2)}`, 124, finalY + 13)

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(12)
  doc.setTextColor(255, 85, 0)
  doc.text(`TOTAL: USD ${Number(cotizacion.total || 0).toFixed(2)}`, 124, finalY + 22)

  doc.setFont('helvetica', 'italic')
  doc.setFontSize(8)
  doc.setTextColor(148, 163, 184)
  doc.text('Generado por NEXPRICE // Plataforma de Comparación de Proveedores y Listas de Venta', 14, 287)

  doc.save(`Lista_Venta_${cotizacion.id_cotizacion}_${razonSocial.replace(/\s+/g, '_')}.pdf`)
}

export function exportCotizacionToExcel({ cotizacion, detalles, productosMap, perfilEmpresa }) {
  const rows = detalles.map((det, idx) => {
    const prod = productosMap[det.id_producto] || {}
    const cantidad = Number(det.cantidad || 1)
    const unitario = Number(det.precio_venta_historico || 0)
    return {
      Item: idx + 1,
      ID_Producto: det.id_producto,
      Producto: prod.titulo || det.titulo_snapshot || `Producto #${det.id_producto}`,
      Proveedor_Origen: prod.nombre_proveedor || prod.dominio_proveedor || 'N/D',
      Cantidad: cantidad,
      Costo_Importacion_USD: Number(det.costo_importacion_unitario || 0),
      Margen_Aplicado_Porc: Number(det.margen_aplicado || 0),
      Precio_Venta_Unitario_USD: unitario,
      Subtotal_USD: Number((cantidad * unitario).toFixed(2))
    }
  })

  const headerInfo = [
    ['EMPRESA:', perfilEmpresa?.razon_social || 'Importadora'],
    ['CONTACTO:', `${perfilEmpresa?.email_comercial || ''} | ${perfilEmpresa?.telefono || ''}`],
    ['LISTA DE VENTA #:', cotizacion.id_cotizacion],
    ['TÍTULO LISTA:', cotizacion.titulo_lista || `Lista #${cotizacion.id_cotizacion}`],
    ['CLIENTE / SEGMENTO:', `${cotizacion.cliente_nombre || 'General'} (${cotizacion.segmento_cliente || 'Estándar'})`],
    ['FECHA EMISIÓN:', new Date(cotizacion.fecha).toLocaleString('es-AR')],
    ['VIGENCIA:', cotizacion.fecha_vigencia || '15 días'],
    ['AJUSTE GLOBAL (%):', `${cotizacion.descuento_global || 0}%`],
    ['COSTO LOGÍSTICO ADICIONAL (USD):', Number(cotizacion.costo_logistico || 0)],
    ['TOTAL LISTA DE VENTA (USD):', Number(cotizacion.total || 0)],
    []
  ]

  const ws = XLSX.utils.aoa_to_sheet(headerInfo)
  XLSX.utils.sheet_add_json(ws, rows, { origin: 'A12' })

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, `Lista_${cotizacion.id_cotizacion}`)
  XLSX.writeFile(wb, `Lista_Venta_${cotizacion.id_cotizacion}.xlsx`)
}

export function exportCotizacionToCSV({ cotizacion, detalles, productosMap, perfilEmpresa }) {
  const headers = [
    'ID_Lista',
    'Empresa',
    'Cliente',
    'Segmento',
    'ID_Producto',
    'Producto',
    'Proveedor',
    'Cantidad',
    'Precio_Venta_Unitario_USD',
    'Subtotal_USD'
  ]

  const escapeCsv = (val) => {
    const str = String(val ?? '').replace(/"/g, '""')
    return `"${str}"`
  }

  const lines = [headers.join(',')]
  detalles.forEach((det) => {
    const prod = productosMap[det.id_producto] || {}
    const cantidad = Number(det.cantidad || 1)
    const unitario = Number(det.precio_venta_historico || 0)
    lines.push(
      [
        escapeCsv(cotizacion.id_cotizacion),
        escapeCsv(perfilEmpresa?.razon_social || 'Importadora'),
        escapeCsv(cotizacion.cliente_nombre || 'Cliente General'),
        escapeCsv(cotizacion.segmento_cliente || 'General'),
        escapeCsv(det.id_producto),
        escapeCsv(prod.titulo || det.titulo_snapshot || `Producto #${det.id_producto}`),
        escapeCsv(prod.nombre_proveedor || prod.dominio_proveedor || 'N/D'),
        escapeCsv(cantidad),
        escapeCsv(unitario.toFixed(2)),
        escapeCsv((cantidad * unitario).toFixed(2))
      ].join(',')
    )
  })

  const blob = new Blob(['\uFEFF' + lines.join('\n')], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.setAttribute('download', `Lista_Venta_${cotizacion.id_cotizacion}.csv`)
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

export function exportCatalogReport({ productos, gestorImpuestos, format = 'xlsx' }) {
  const rows = productos.map((p) => {
    const desglose = gestorImpuestos.calcularDesgloseImportacion(p)
    return {
      ID_Producto: p.id_producto,
      Grupo_Comparacion: p.id_agrupacion || p.id_producto,
      Producto: p.titulo,
      Proveedor: p.nombre_proveedor || p.dominio_proveedor,
      Precio_FOB_USD: desglose.precioFOB,
      Costo_Envio_USD: desglose.costoEnvio,
      Impuestos_y_Tasas_USD: desglose.totalImpuestos,
      Costo_Final_Importacion_USD: desglose.costoTotalImportacion,
      Stock: p.stock,
      URL_Origen: p.url_origen
    }
  })

  if (format === 'csv') {
    const ws = XLSX.utils.json_to_sheet(rows)
    const csv = XLSX.utils.sheet_to_csv(ws)
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'Comparativa_Costos_Proveedores.csv'
    a.click()
    URL.revokeObjectURL(url)
    return
  }

  if (format === 'pdf') {
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
    doc.setFillColor(255, 85, 0)
    doc.rect(0, 0, 297, 7, 'F')
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(15)
    doc.text('COMPARATIVA DE COSTOS DE PROVEEDORES', 14, 18)

    autoTable(doc, {
      startY: 24,
      head: [['ID', 'Grupo', 'Producto', 'Proveedor', 'FOB (USD)', 'Envío (USD)', 'Tasas (USD)', 'Costo Final (USD)', 'Stock']],
      body: rows.map((r) => [
        r.ID_Producto,
        `#${r.Grupo_Comparacion}`,
        r.Producto,
        r.Proveedor,
        `$${r.Precio_FOB_USD.toFixed(2)}`,
        `$${r.Costo_Envio_USD.toFixed(2)}`,
        `$${r.Impuestos_y_Tasas_USD.toFixed(2)}`,
        `$${r.Costo_Final_Importacion_USD.toFixed(2)}`,
        r.Stock
      ]),
      headStyles: { fillColor: [255, 85, 0] },
      styles: { fontSize: 8 }
    })
    doc.save('Comparativa_Costos_Proveedores.pdf')
    return
  }

  const ws = XLSX.utils.json_to_sheet(rows)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Comparativa_Proveedores')
  XLSX.writeFile(wb, 'Comparativa_Costos_Proveedores.xlsx')
}
