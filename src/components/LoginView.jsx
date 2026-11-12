import React, { useState } from 'react'
import {
  ShieldCheck,
  Mail,
  Lock,
  ArrowRight,
  KeyRound,
  Cpu,
  Layers,
  CheckCircle2,
  AlertCircle,
  Sparkles
} from 'lucide-react'

export default function LoginView({ onLogin, onRecoverPassword, sessionExpiredNotice }) {
  const [email, setEmail] = useState('operador@nexprice.com')
  const [password, setPassword] = useState('operador123')
  const [error, setError] = useState('')
  const [recoverMode, setRecoverMode] = useState(false)
  const [recoverEmail, setRecoverEmail] = useState('')
  const [recoverMsg, setRecoverMsg] = useState('')

  const handleSubmit = (e) => {
    e.preventDefault()
    setError('')
    const res = onLogin(email.trim(), password)
    if (!res.ok) {
      setError(res.message)
    }
  }

  const handleQuickAccess = (targetEmail, targetPass) => {
    setEmail(targetEmail)
    setPassword(targetPass)
    setError('')
    onLogin(targetEmail, targetPass)
  }

  const handleRecoverSubmit = (e) => {
    e.preventDefault()
    if (!recoverEmail.trim()) return
    const msg = onRecoverPassword(recoverEmail.trim())
    setRecoverMsg(msg)
  }

  return (
    <div className="min-h-screen bg-futuristic-grid flex flex-col justify-between relative overflow-hidden">
      <div className="pointer-events-none fixed -top-32 -right-32 w-96 h-96 rounded-full bg-gradient-to-br from-[#FF5500]/15 to-amber-400/5 blur-3xl" />
      <div className="pointer-events-none fixed -bottom-32 -left-32 w-96 h-96 rounded-full bg-gradient-to-tr from-[#FF5500]/12 to-orange-200/10 blur-3xl" />

      <header className="w-full border-b border-slate-200/80 bg-white/80 backdrop-blur-md z-10">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#FF5500] to-[#FF8000] flex items-center justify-center text-white shadow-orange-glow">
              <Cpu className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-display font-bold text-lg tracking-tight text-slate-900">
                  NEX<span className="text-[#FF5500]">PRICE</span>
                </span>
                <span className="text-[10px] font-mono uppercase tracking-widest px-2 py-0.5 rounded-full bg-orange-50 text-[#FF5500] border border-orange-200 font-semibold">
                  CORE ENGINE
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Comparador de Proveedores y Generador de Listas de Venta
              </p>
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center p-6 z-10">
        <div className="max-w-5xl w-full grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          <div className="lg:col-span-7 space-y-6">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white border border-orange-200 shadow-sm">
              <Sparkles className="w-4 h-4 text-[#FF5500]" />
              <span className="text-xs font-semibold uppercase tracking-wider text-[#FF5500]">
                Inteligencia Comercial para Importación y Ventas
              </span>
            </div>

            <h1 className="font-display text-4xl sm:text-5xl font-bold text-slate-900 leading-tight">
              Extracción Masiva,{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#FF5500] to-[#FF8800]">
                Mejor Proveedor y Listas de Venta
              </span>
            </h1>

            <p className="text-slate-600 text-base leading-relaxed max-w-xl">
              Pegá los links de los catálogos de tus proveedores para extraer todos los productos de
              la página, compará artículos similares entre distintos proveedores para detectar el
              costo más bajo y generá al instante la lista de venta para tu cliente.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
              <div className="nexus-card p-4 rounded-2xl hud-corner">
                <div className="flex items-center gap-2.5 text-[#FF5500] font-display font-semibold text-sm mb-1">
                  <Layers className="w-4 h-4" />
                  1. Costo del Proveedor Más Barato
                </div>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Compará productos similares de distintos proveedores aplicando impuestos y flete
                  para identificar automáticamente la opción de menor costo final.
                </p>
              </div>

              <div className="nexus-card p-4 rounded-2xl hud-corner">
                <div className="flex items-center gap-2.5 text-[#FF5500] font-display font-semibold text-sm mb-1">
                  <ShieldCheck className="w-4 h-4" />
                  2. Lista de Venta para el Cliente
                </div>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Transformá los productos seleccionados en una lista de venta con el margen de tu
                  cliente lista para enviar en PDF, Excel o CSV.
                </p>
              </div>
            </div>
          </div>

          <div className="lg:col-span-5">
            <div className="nexus-card rounded-3xl p-7 sm:p-8 border-t-4 border-t-[#FF5500] relative">
              {sessionExpiredNotice && (
                <div className="mb-4 p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 text-[#FF5500]" />
                  <span>Tu sesión anterior caducó por inactividad.</span>
                </div>
              )}

              {!recoverMode ? (
                <>
                  <div className="mb-6">
                    <span className="text-[11px] font-mono uppercase tracking-widest text-[#FF5500] font-semibold">
                      ACCESO AL SISTEMA
                    </span>
                    <h2 className="font-display text-2xl font-bold text-slate-900 mt-1">
                      Iniciar Sesión
                    </h2>
                    <p className="text-xs text-slate-500 mt-1">
                      Ingresá con tus credenciales o seleccioná una cuenta abajo.
                    </p>
                  </div>

                  {error && (
                    <div className="mb-4 p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-start gap-2.5">
                      <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-600" />
                      <span>{error}</span>
                    </div>
                  )}

                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1.5">
                        Correo Electrónico
                      </label>
                      <div className="relative">
                        <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                        <input
                          type="email"
                          required
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          placeholder="usuario@empresa.com"
                          className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-sm text-slate-900 focus:outline-none focus:border-[#FF5500] focus:bg-white transition"
                        />
                      </div>
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600">
                          Clave de Acceso
                        </label>
                        <button
                          type="button"
                          onClick={() => {
                            setRecoverMode(true)
                            setRecoverEmail(email)
                            setRecoverMsg('')
                          }}
                          className="text-xs text-[#FF5500] hover:underline font-medium"
                        >
                          ¿Olvidaste tu clave?
                        </button>
                      </div>
                      <div className="relative">
                        <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                        <input
                          type="password"
                          required
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          placeholder="••••••••"
                          className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-sm text-slate-900 focus:outline-none focus:border-[#FF5500] focus:bg-white transition"
                        />
                      </div>
                    </div>

                    <button
                      type="submit"
                      className="w-full btn-nexus-primary py-3 px-5 rounded-xl flex items-center justify-center gap-2 text-sm"
                    >
                      <span>Ingresar</span>
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </form>

                  <div className="mt-6 pt-5 border-t border-slate-100">
                    <p className="text-[11px] font-mono uppercase tracking-wider text-slate-400 mb-2.5">
                      ACCESO RÁPIDO:
                    </p>
                    <div className="grid grid-cols-2 gap-2.5">
                      <button
                        type="button"
                        onClick={() => handleQuickAccess('operador@nexprice.com', 'operador123')}
                        className="p-2.5 rounded-xl border border-orange-200 bg-orange-50/60 hover:bg-orange-100/70 text-left transition group"
                      >
                        <div className="text-xs font-bold text-slate-900 group-hover:text-[#FF5500]">
                          Operador Comercial
                        </div>
                        <div className="text-[10px] font-mono text-slate-500 truncate">
                          Acceso Principal
                        </div>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleQuickAccess('admin@nexprice.com', 'admin123')}
                        className="p-2.5 rounded-xl border border-slate-200 bg-slate-50 hover:border-[#FF5500]/50 text-left transition group"
                      >
                        <div className="text-xs font-bold text-slate-900 group-hover:text-[#FF5500]">
                          Administrador
                        </div>
                        <div className="text-[10px] font-mono text-slate-500 truncate">
                          Gestión de Cuentas
                        </div>
                      </button>
                    </div>
                  </div>
                </>
              ) : (
                <div>
                  <span className="text-[11px] font-mono uppercase tracking-widest text-[#FF5500] font-semibold">
                    RECUPERACIÓN DE ACCESO
                  </span>
                  <h2 className="font-display text-2xl font-bold text-slate-900 mt-1">
                    Restablecer Clave
                  </h2>
                  <p className="text-xs text-slate-500 mt-1 mb-5">
                    Ingresá tu correo electrónico registrado para recibir un enlace de verificación.
                  </p>

                  {recoverMsg && (
                    <div className="mb-4 p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-start gap-2">
                      <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-600" />
                      <span>{recoverMsg}</span>
                    </div>
                  )}

                  <form onSubmit={handleRecoverSubmit} className="space-y-4">
                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1.5">
                        Correo de la Cuenta
                      </label>
                      <div className="relative">
                        <KeyRound className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                        <input
                          type="email"
                          required
                          value={recoverEmail}
                          onChange={(e) => setRecoverEmail(e.target.value)}
                          placeholder="usuario@empresa.com"
                          className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-sm text-slate-900 focus:outline-none focus:border-[#FF5500] focus:bg-white transition"
                        />
                      </div>
                    </div>

                    <button
                      type="submit"
                      className="w-full btn-nexus-primary py-2.5 px-4 rounded-xl text-sm"
                    >
                      Enviar Enlace de Verificación
                    </button>

                    <button
                      type="button"
                      onClick={() => setRecoverMode(false)}
                      className="w-full py-2.5 px-4 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition"
                    >
                      Volver al Inicio de Sesión
                    </button>
                  </form>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
