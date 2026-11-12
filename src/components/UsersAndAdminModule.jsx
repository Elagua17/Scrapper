import React, { useState, useMemo } from 'react'
import {
  Building2,
  ShieldAlert,
  DatabaseBackup,
  UserPlus,
  CheckCircle2,
  AlertCircle,
  ClipboardList,
  Users,
  Trash2,
  Edit3,
  Download,
  Upload,
  Percent,
  Search
} from 'lucide-react'

export default function UsersAndAdminModule({
  currentUser,
  cuentas,
  usuarios,
  clientes,
  auditoriaLogs,
  onSavePerfilOperador,
  onAddCliente,
  onUpdateCliente,
  onDeleteCliente,
  onAdminCreateOperator,
  onAdminToggleAccountStatus,
  onExportBackup,
  onImportBackup,
  onResetCleanDatabase
}) {
  const isAdmin = currentUser?.rol === 'ADMIN'
  const [subTab, setSubTab] = useState('clientes')

  const currentOp = usuarios[0] || {}
  const [perfilForm, setPerfilForm] = useState({
    razon_social: currentOp.razon_social || '',
    localidad: currentOp.localidad || '',
    categoria: currentOp.categoria || '',
    margen_ganancia: currentOp.margen_ganancia ?? 0,
    telefono: currentOp.telefono || '',
    email_comercial: currentOp.email_comercial || '',
    seg_distribuidor: currentOp.segmentos_rentabilidad?.Distribuidor ?? 0,
    seg_mayorista: currentOp.segmentos_rentabilidad?.Mayorista ?? 0,
    seg_minorista: currentOp.segmentos_rentabilidad?.Minorista ?? 0
  })
  const [savedNotice, setSavedNotice] = useState('')

  // Estado de Gestión de Clientes (Alta y Edición sin duplicados)
  const [cliForm, setCliForm] = useState({
    id: null,
    razon_social: '',
    segmento: 'Mayorista',
    cuit: '',
    email: '',
    telefono: '',
    localidad: ''
  })
  const [cliStatus, setCliStatus] = useState({ type: '', text: '' })
  const [searchClienteQuery, setSearchClienteQuery] = useState('')

  const [newOpForm, setNewOpForm] = useState({
    email: '',
    password: '',
    razon_social: '',
    localidad: '',
    categoria: 'Operador Comercial'
  })
  const [adminMsg, setAdminMsg] = useState('')

  const clientesFiltrados = useMemo(() => {
    const q = searchClienteQuery.trim().toLowerCase()
    if (!q) return clientes
    return clientes.filter(
      (c) =>
        (c.razon_social || '').toLowerCase().includes(q) ||
        (c.segmento || '').toLowerCase().includes(q) ||
        (c.email || '').toLowerCase().includes(q) ||
        (c.cuit || '').toLowerCase().includes(q) ||
        (c.localidad || '').toLowerCase().includes(q)
    )
  }, [clientes, searchClienteQuery])

  const handleSaveProfile = (e) => {
    e.preventDefault()
    onSavePerfilOperador({
      razon_social: perfilForm.razon_social,
      localidad: perfilForm.localidad,
      categoria: perfilForm.categoria,
      margen_ganancia: Number(perfilForm.margen_ganancia) || 0,
      telefono: perfilForm.telefono,
      email_comercial: perfilForm.email_comercial,
      segmentos_rentabilidad: {
        Distribuidor: Number(perfilForm.seg_distribuidor) || 0,
        Mayorista: Number(perfilForm.seg_mayorista) || 0,
        Minorista: Number(perfilForm.seg_minorista) || 0
      }
    })
    setSavedNotice('Perfil comercial y márgenes de ganancia actualizados correctamente.')
    setTimeout(() => setSavedNotice(''), 3000)
  }

  const handleSubmitClient = (e) => {
    e.preventDefault()
    setCliStatus({ type: '', text: '' })

    if (cliForm.id) {
      const res = onUpdateCliente ? onUpdateCliente(cliForm) : { ok: false }
      if (!res.ok) {
        setCliStatus({
          type: 'error',
          text: res.message || 'No se pudo actualizar el cliente.'
        })
        return
      }
      setCliStatus({
        type: 'success',
        text: res.message
      })
      setCliForm({
        id: null,
        razon_social: '',
        segmento: 'Mayorista',
        cuit: '',
        email: '',
        telefono: '',
        localidad: ''
      })
    } else {
      const res = onAddCliente ? onAddCliente(cliForm) : { ok: false }
      if (!res.ok) {
        setCliStatus({
          type: 'error',
          text: res.message || 'No se pudo registrar el cliente.'
        })
        return
      }
      setCliStatus({
        type: 'success',
        text: res.message
      })
      setCliForm({
        id: null,
        razon_social: '',
        segmento: 'Mayorista',
        cuit: '',
        email: '',
        telefono: '',
        localidad: ''
      })
    }
  }

  const handleStartEditClient = (c) => {
    setCliStatus({ type: '', text: '' })
    setCliForm({
      id: c.id,
      razon_social: c.razon_social || '',
      segmento: c.segmento || 'Mayorista',
      cuit: c.cuit || '',
      email: c.email || '',
      telefono: c.telefono || '',
      localidad: c.localidad || ''
    })
  }

  const handleCancelEditClient = () => {
    setCliStatus({ type: '', text: '' })
    setCliForm({
      id: null,
      razon_social: '',
      segmento: 'Mayorista',
      cuit: '',
      email: '',
      telefono: '',
      localidad: ''
    })
  }

  const handleCreateOp = (e) => {
    e.preventDefault()
    if (!isAdmin) return
    const res = onAdminCreateOperator(newOpForm)
    setAdminMsg(res.message)
    if (res.ok) {
      setNewOpForm({
        email: '',
        password: '',
        razon_social: '',
        localidad: '',
        categoria: 'Operador Comercial'
      })
    }
  }

  const handleBackupFileUpload = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      try {
        const parsed = JSON.parse(String(ev.target?.result || '{}'))
        onImportBackup(parsed)
        setAdminMsg('Base de datos restaurada exitosamente.')
      } catch {
        setAdminMsg('El archivo seleccionado no es válido.')
      }
    }
    reader.readAsText(file)
  }

  return (
    <div className="space-y-6">
      <div className="nexus-card rounded-3xl p-6 border-l-4 border-l-[#FF5500] flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <span className="text-[11px] font-mono uppercase tracking-widest px-2.5 py-0.5 rounded-full bg-orange-50 text-[#FF5500] border border-orange-200 font-semibold">
            CONFIGURACIÓN COMERCIAL Y CARTERA DE CLIENTES
          </span>
          <h2 className="font-display text-2xl font-bold text-slate-900 mt-1">
            Clientes, Empresa, Márgenes y Administración
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Gestioná tu cartera de clientes (alta, edición y control anti-duplicados), márgenes por
            segmento y cuentas del sistema.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 bg-slate-100 p-1.5 rounded-2xl border border-slate-200">
          <button
            type="button"
            onClick={() => setSubTab('clientes')}
            className={`px-3.5 py-2 rounded-xl text-xs font-semibold transition flex items-center gap-1.5 ${
              subTab === 'clientes'
                ? 'bg-[#FF5500] text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>Clientes ({clientes.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setSubTab('perfil')}
            className={`px-3.5 py-2 rounded-xl text-xs font-semibold transition flex items-center gap-1.5 ${
              subTab === 'perfil'
                ? 'bg-[#FF5500] text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Building2 className="w-3.5 h-3.5" />
            <span>Empresa y Márgenes</span>
          </button>

          <button
            type="button"
            onClick={() => setSubTab('operadores')}
            className={`px-3.5 py-2 rounded-xl text-xs font-semibold transition flex items-center gap-1.5 ${
              subTab === 'operadores'
                ? 'bg-[#FF5500] text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <ShieldAlert className="w-3.5 h-3.5" />
            <span>Cuentas y Respaldo</span>
          </button>
        </div>
      </div>

      {subTab === 'clientes' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-5">
            <div className="nexus-card rounded-3xl p-6 space-y-4">
              <div>
                <span className="text-[10px] font-mono uppercase tracking-widest text-[#FF5500] font-bold">
                  {cliForm.id ? 'MODO EDICIÓN' : 'ALTA DE CLIENTE SIN DUPLICADOS'}
                </span>
                <h3 className="font-display text-lg font-bold text-slate-900 mt-0.5">
                  {cliForm.id ? `Editar Cliente: ${cliForm.razon_social}` : 'Registrar Nuevo Cliente'}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  El sistema verifica automáticamente que no se repitan clientes con el mismo
                  nombre, CUIT o correo electrónico.
                </p>
              </div>

              {cliStatus.text && (
                <div
                  className={`p-3.5 rounded-2xl border text-xs flex items-center gap-2 ${
                    cliStatus.type === 'error'
                      ? 'bg-red-50 border-red-200 text-red-700'
                      : 'bg-emerald-50 border-emerald-200 text-emerald-800'
                  }`}
                >
                  {cliStatus.type === 'error' ? (
                    <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
                  ) : (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  )}
                  <span>{cliStatus.text}</span>
                </div>
              )}

              <form onSubmit={handleSubmitClient} className="space-y-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                    Nombre o Razón Social *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ej. Distribuidora Litoral S.R.L."
                    value={cliForm.razon_social}
                    onChange={(e) =>
                      setCliForm({ ...cliForm, razon_social: e.target.value })
                    }
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs focus:outline-none focus:border-[#FF5500]"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                      Segmento de Precio
                    </label>
                    <select
                      value={cliForm.segmento}
                      onChange={(e) => setCliForm({ ...cliForm, segmento: e.target.value })}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-semibold focus:outline-none focus:border-[#FF5500]"
                    >
                      <option value="Distribuidor">Distribuidor</option>
                      <option value="Mayorista">Mayorista</option>
                      <option value="Minorista">Minorista</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                      CUIT / DNI (opcional)
                    </label>
                    <input
                      type="text"
                      placeholder="30-00000000-0"
                      value={cliForm.cuit}
                      onChange={(e) => setCliForm({ ...cliForm, cuit: e.target.value })}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-mono focus:outline-none focus:border-[#FF5500]"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                      Correo Electrónico
                    </label>
                    <input
                      type="email"
                      placeholder="compras@cliente.com"
                      value={cliForm.email}
                      onChange={(e) => setCliForm({ ...cliForm, email: e.target.value })}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs focus:outline-none focus:border-[#FF5500]"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                      Teléfono
                    </label>
                    <input
                      type="text"
                      placeholder="+54 3442..."
                      value={cliForm.telefono}
                      onChange={(e) => setCliForm({ ...cliForm, telefono: e.target.value })}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs focus:outline-none focus:border-[#FF5500]"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                    Localidad / Dirección
                  </label>
                  <input
                    type="text"
                    placeholder="Localidad / Provincia"
                    value={cliForm.localidad}
                    onChange={(e) => setCliForm({ ...cliForm, localidad: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs focus:outline-none focus:border-[#FF5500]"
                  />
                </div>

                <div className="flex items-center gap-2 pt-2">
                  <button
                    type="submit"
                    className="flex-1 btn-nexus-primary py-2.5 px-4 rounded-xl text-xs font-bold"
                  >
                    {cliForm.id ? 'Guardar Cambios del Cliente' : 'Agregar Cliente'}
                  </button>

                  {cliForm.id && (
                    <button
                      type="button"
                      onClick={handleCancelEditClient}
                      className="px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-100"
                    >
                      Cancelar
                    </button>
                  )}
                </div>
              </form>
            </div>
          </div>

          <div className="lg:col-span-7">
            <div className="nexus-card rounded-3xl p-6 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <span className="text-[10px] font-mono uppercase tracking-widest text-[#FF5500] font-bold">
                    REGISTROS ÚNICOS
                  </span>
                  <h3 className="font-display text-lg font-bold text-slate-900">
                    Cartera de Clientes ({clientesFiltrados.length})
                  </h3>
                </div>

                {clientes.length > 0 && (
                  <div className="relative w-full sm:w-64">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={searchClienteQuery}
                      onChange={(e) => setSearchClienteQuery(e.target.value)}
                      placeholder="Buscar cliente..."
                      className="w-full pl-8 pr-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs focus:outline-none focus:border-[#FF5500]"
                    />
                  </div>
                )}
              </div>

              {clientesFiltrados.length === 0 ? (
                <p className="text-xs text-slate-400 italic py-10 text-center border border-dashed border-slate-200 rounded-2xl">
                  {clientes.length === 0
                    ? 'No hay clientes cargados todavía.'
                    : 'No se encontraron clientes con ese criterio.'}
                </p>
              ) : (
                <div className="space-y-2.5 max-h-[500px] overflow-y-auto pr-1">
                  {clientesFiltrados.map((c) => {
                    const isEditingThis = cliForm.id === c.id
                    return (
                      <div
                        key={c.id}
                        className={`p-4 rounded-2xl border transition flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                          isEditingThis
                            ? 'bg-orange-50/70 border-[#FF5500] shadow-sm'
                            : 'bg-slate-50 border-slate-200 hover:border-orange-300'
                        }`}
                      >
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-display font-bold text-sm text-slate-900">
                              {c.razon_social}
                            </span>
                            <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-orange-50 text-[#FF5500] border border-orange-200">
                              {c.segmento}
                            </span>
                            {c.cuit && (
                              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-white border border-slate-200 text-slate-600">
                                CUIT: {c.cuit}
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-slate-500 mt-1">
                            {c.email || 'Sin correo'} • {c.telefono || 'Sin teléfono'} •{' '}
                            {c.localidad || 'Sin localidad'}
                          </p>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            type="button"
                            onClick={() => handleStartEditClient(c)}
                            className="px-3 py-1.5 rounded-xl bg-white border border-orange-300 text-[#FF5500] text-xs font-bold hover:bg-orange-50 flex items-center gap-1.5"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                            <span>Editar</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              if (cliForm.id === c.id) handleCancelEditClient()
                              onDeleteCliente(c.id)
                            }}
                            title="Eliminar cliente"
                            className="p-2 rounded-xl border border-slate-200 bg-white text-slate-400 hover:border-red-300 hover:text-red-600"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {subTab === 'perfil' && (
        <div className="nexus-card rounded-3xl p-6 max-w-4xl">
          <div className="mb-5">
            <span className="text-[10px] font-mono uppercase tracking-widest text-[#FF5500] font-bold">
              PERFIL COMERCIAL
            </span>
            <h3 className="font-display text-lg font-bold text-slate-900 mt-0.5">
              Datos de la Empresa y Porcentajes de Ganancia
            </h3>
          </div>

          {savedNotice && (
            <div className="mb-4 p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>{savedNotice}</span>
            </div>
          )}

          <form onSubmit={handleSaveProfile} className="space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Razón Social / Empresa
                </label>
                <input
                  type="text"
                  required
                  value={perfilForm.razon_social}
                  onChange={(e) =>
                    setPerfilForm({ ...perfilForm, razon_social: e.target.value })
                  }
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Rubro / Categoría
                </label>
                <input
                  type="text"
                  value={perfilForm.categoria}
                  onChange={(e) =>
                    setPerfilForm({ ...perfilForm, categoria: e.target.value })
                  }
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Localidad
                </label>
                <input
                  type="text"
                  value={perfilForm.localidad}
                  onChange={(e) =>
                    setPerfilForm({ ...perfilForm, localidad: e.target.value })
                  }
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Teléfono de Contacto
                </label>
                <input
                  type="text"
                  value={perfilForm.telefono}
                  onChange={(e) =>
                    setPerfilForm({ ...perfilForm, telefono: e.target.value })
                  }
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Email Comercial
                </label>
                <input
                  type="email"
                  value={perfilForm.email_comercial}
                  onChange={(e) =>
                    setPerfilForm({ ...perfilForm, email_comercial: e.target.value })
                  }
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Margen de Ganancia General (%)
                </label>
                <input
                  type="number"
                  step="0.5"
                  min="0"
                  value={perfilForm.margen_ganancia}
                  onChange={(e) =>
                    setPerfilForm({ ...perfilForm, margen_ganancia: e.target.value })
                  }
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 font-mono text-xs font-bold text-[#FF5500]"
                />
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-orange-50/60 border border-orange-200 space-y-3">
              <div className="flex items-center gap-2 text-xs font-bold text-[#FF5500]">
                <Percent className="w-4 h-4" />
                <span>Márgenes de Ganancia según Tipo de Cliente:</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                    Distribuidoras (%)
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    min="0"
                    value={perfilForm.seg_distribuidor}
                    onChange={(e) =>
                      setPerfilForm({ ...perfilForm, seg_distribuidor: e.target.value })
                    }
                    className="w-full px-3 py-2 rounded-xl bg-white border border-orange-200 font-mono text-xs font-bold text-slate-900"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                    Mayoristas (%)
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    min="0"
                    value={perfilForm.seg_mayorista}
                    onChange={(e) =>
                      setPerfilForm({ ...perfilForm, seg_mayorista: e.target.value })
                    }
                    className="w-full px-3 py-2 rounded-xl bg-white border border-orange-200 font-mono text-xs font-bold text-slate-900"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                    Minoristas (%)
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    min="0"
                    value={perfilForm.seg_minorista}
                    onChange={(e) =>
                      setPerfilForm({ ...perfilForm, seg_minorista: e.target.value })
                    }
                    className="w-full px-3 py-2 rounded-xl bg-white border border-orange-200 font-mono text-xs font-bold text-slate-900"
                  />
                </div>
              </div>
            </div>

            <button
              type="submit"
              className="btn-nexus-primary px-6 py-3 rounded-xl text-xs font-bold"
            >
              Guardar Datos y Márgenes
            </button>
          </form>
        </div>
      )}

      {subTab === 'operadores' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-6 space-y-5">
            <div className="nexus-card rounded-3xl p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-mono uppercase tracking-widest text-[#FF5500] font-bold">
                    USUARIOS DEL SISTEMA
                  </span>
                  <h3 className="font-display text-lg font-bold text-slate-900">
                    Gestión de Operadores
                  </h3>
                </div>
                <UserPlus className="w-5 h-5 text-[#FF5500]" />
              </div>

              {adminMsg && (
                <div className="p-3 rounded-xl bg-orange-50 border border-orange-200 text-xs text-slate-800">
                  {adminMsg}
                </div>
              )}

              {isAdmin ? (
                <form onSubmit={handleCreateOp} className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <input
                    type="email"
                    required
                    placeholder="Correo del nuevo operador"
                    value={newOpForm.email}
                    onChange={(e) => setNewOpForm({ ...newOpForm, email: e.target.value })}
                    className="px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs"
                  />
                  <input
                    type="password"
                    required
                    placeholder="Clave inicial"
                    value={newOpForm.password}
                    onChange={(e) =>
                      setNewOpForm({ ...newOpForm, password: e.target.value })
                    }
                    className="px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs"
                  />
                  <input
                    type="text"
                    required
                    placeholder="Razón Social / Nombre"
                    value={newOpForm.razon_social}
                    onChange={(e) =>
                      setNewOpForm({ ...newOpForm, razon_social: e.target.value })
                    }
                    className="px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs"
                  />
                  <input
                    type="text"
                    placeholder="Localidad"
                    value={newOpForm.localidad}
                    onChange={(e) =>
                      setNewOpForm({ ...newOpForm, localidad: e.target.value })
                    }
                    className="px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs"
                  />
                  <button
                    type="submit"
                    className="sm:col-span-2 btn-nexus-primary py-2.5 px-4 rounded-xl text-xs font-bold"
                  >
                    Dar de Alta Operador
                  </button>
                </form>
              ) : (
                <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-200 text-xs text-amber-900">
                  El alta y desactivación de operadores está disponible ingresando con la cuenta
                  <strong> Administrador</strong>.
                </div>
              )}

              <div className="space-y-2.5 pt-2">
                {cuentas.map((cta) => (
                  <div
                    key={cta.id_cuenta}
                    className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-between gap-3"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-xs text-slate-900">
                          {cta.email}
                        </span>
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-orange-50 text-[#FF5500] border border-orange-200">
                          {cta.rol}
                        </span>
                        <span
                          className={`text-[10px] font-mono px-2 py-0.5 rounded ${
                            cta.activo
                              ? 'bg-emerald-50 text-emerald-700'
                              : 'bg-red-50 text-red-700'
                          }`}
                        >
                          {cta.activo ? 'ACTIVA' : 'INACTIVA'}
                        </span>
                      </div>
                    </div>

                    {isAdmin && cta.id_cuenta !== currentUser.id_cuenta && (
                      <button
                        type="button"
                        onClick={() => onAdminToggleAccountStatus(cta.id_cuenta)}
                        className="px-3 py-1.5 rounded-xl border border-slate-200 bg-white text-[11px] font-semibold text-slate-700 hover:border-[#FF5500]"
                      >
                        {cta.activo ? 'Desactivar' : 'Reactivar'}
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="nexus-card rounded-3xl p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-mono uppercase tracking-widest text-[#FF5500] font-bold">
                    RESPALDO DE DATOS
                  </span>
                  <h3 className="font-display text-lg font-bold text-slate-900">
                    Copia de Seguridad y Restauración
                  </h3>
                </div>
                <DatabaseBackup className="w-5 h-5 text-[#FF5500]" />
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={onExportBackup}
                  className="btn-nexus-primary px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-1.5"
                >
                  <Download className="w-4 h-4" />
                  <span>Descargar Backup</span>
                </button>

                <label className="px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-700 hover:border-[#FF5500] cursor-pointer flex items-center gap-1.5">
                  <Upload className="w-4 h-4 text-[#FF5500]" />
                  <span>Restaurar Backup</span>
                  <input
                    type="file"
                    accept=".json"
                    onChange={handleBackupFileUpload}
                    className="hidden"
                  />
                </label>

                <button
                  type="button"
                  onClick={onResetCleanDatabase}
                  className="px-3.5 py-2.5 rounded-xl border border-red-200 text-xs font-semibold text-red-600 hover:bg-red-50"
                >
                  Reiniciar Datos
                </button>
              </div>
            </div>
          </div>

          <div className="lg:col-span-6">
            <div className="nexus-card rounded-3xl p-6 space-y-4 h-full">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-mono uppercase tracking-widest text-[#FF5500] font-bold">
                    REGISTRO DE ACTIVIDAD
                  </span>
                  <h3 className="font-display text-lg font-bold text-slate-900">
                    Historial de Operaciones
                  </h3>
                </div>
                <ClipboardList className="w-5 h-5 text-[#FF5500]" />
              </div>

              <div className="space-y-2 max-h-[480px] overflow-y-auto pr-1">
                {auditoriaLogs.map((log) => (
                  <div
                    key={log.id_log}
                    className="p-3 rounded-2xl bg-slate-50 border border-slate-200 text-xs flex items-start justify-between gap-3"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-orange-50 text-[#FF5500]">
                          {log.modulo}
                        </span>
                        <span className="font-mono text-[11px] text-slate-600">
                          {log.usuario_email}
                        </span>
                      </div>
                      <p className="text-slate-800 font-medium mt-1">{log.accion}</p>
                    </div>
                    <span className="text-[10px] font-mono text-slate-400 shrink-0">
                      {new Date(log.fecha).toLocaleTimeString('es-AR')}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
