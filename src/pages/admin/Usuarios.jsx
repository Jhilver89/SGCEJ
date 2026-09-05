import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import {
  UsersRound,
  UserPlus,
  Search,
  Pencil,
  UserCheck,
  UserX,
  X,
  ShieldCheck,
  GraduationCap,
  Clock3,
  RefreshCw,
  LockKeyhole,
} from 'lucide-react'
import './Usuarios.css'

const ROLES = [
  ['usuario', 'Usuario'],
  ['administrador', 'Administrador'],
]

function normalizarCorreo(valor) {
  return String(valor || '').trim().toLowerCase()
}

function Usuarios() {
  const { profile } = useAuth()

  const [usuarios, setUsuarios] = useState([])
  const [docentes, setDocentes] = useState([])

  const [busqueda, setBusqueda] = useState('')
  const [filtroRol, setFiltroRol] = useState('')
  const [filtroEstado, setFiltroEstado] = useState('activos')
  const [filtroTipo, setFiltroTipo] = useState('')

  const [cargando, setCargando] = useState(true)
  const [guardando, setGuardando] = useState(false)
  const [creandoCuentas, setCreandoCuentas] = useState(false)

  const [error, setError] = useState('')
  const [mensaje, setMensaje] = useState('')
  const [resultadoCuentas, setResultadoCuentas] = useState(null)

  const [modal, setModal] = useState(false)
  const [modo, setModo] = useState('crear')
  const [usuarioEditando, setUsuarioEditando] = useState(null)

  const [form, setForm] = useState({
    nombres: '',
    apellidos: '',
    email: '',
    rol: 'usuario',
    activo: true,
    password: '',
  })

  async function cargarDatos() {
    setCargando(true)
    setError('')

    const [usuariosResult, docentesResult] = await Promise.all([
      supabase
        .from('perfiles')
        .select('id, institucion_id, nombres, apellidos, email, rol, activo, created_at')
        .order('apellidos', { ascending: true })
        .order('nombres', { ascending: true }),

      supabase
        .from('docentes')
        .select('id, perfil_id, dni, nombres, apellidos, correo, activo')
        .order('apellidos', { ascending: true })
        .order('nombres', { ascending: true }),
    ])

    if (usuariosResult.error) {
      setError(usuariosResult.error.message)
      setUsuarios([])
    } else {
      setUsuarios(usuariosResult.data || [])
    }

    if (docentesResult.error) {
      setError((actual) => actual || docentesResult.error.message)
      setDocentes([])
    } else {
      setDocentes(docentesResult.data || [])
    }

    setCargando(false)
  }

  useEffect(() => {
    cargarDatos()
  }, [])

  const docentesPorPerfil = useMemo(() => {
    const mapa = new Map()
    docentes.forEach((d) => {
      if (d.perfil_id) mapa.set(d.perfil_id, d)
    })
    return mapa
  }, [docentes])

  const docentesConCuenta = useMemo(
    () => docentes.filter((d) => Boolean(d.perfil_id)).length,
    [docentes]
  )

  const docentesPendientes = useMemo(
    () => docentes.filter((d) => !d.perfil_id && normalizarCorreo(d.correo)).length,
    [docentes]
  )

  const docentesSinCorreo = useMemo(
    () => docentes.filter((d) => !d.perfil_id && !normalizarCorreo(d.correo)).length,
    [docentes]
  )

  const usuariosConTipo = useMemo(() => {
    return usuarios.map((u) => {
      const docente = docentesPorPerfil.get(u.id)

      return {
        ...u,
        tipo: docente ? 'docente' : 'usuario',
        docente,
      }
    })
  }, [usuarios, docentesPorPerfil])

  const usuariosFiltrados = useMemo(() => {
    const texto = busqueda.trim().toLowerCase()

    return usuariosConTipo.filter((u) => {
      if (filtroRol && u.rol !== filtroRol) return false

      if (filtroTipo === 'docente' && u.tipo !== 'docente') return false
      if (filtroTipo === 'usuario' && u.tipo !== 'usuario') return false

      if (filtroEstado === 'activos' && !u.activo) return false
      if (filtroEstado === 'inactivos' && u.activo) return false

      if (!texto) return true

      const contenido = [
        u.nombres,
        u.apellidos,
        u.email,
        u.rol,
        u.tipo,
        u.docente?.dni,
      ].join(' ').toLowerCase()

      return contenido.includes(texto)
    })
  }, [usuariosConTipo, busqueda, filtroRol, filtroEstado, filtroTipo])

  const estadisticas = useMemo(() => ({
    total: usuarios.length,
    activos: usuarios.filter((u) => u.activo).length,
    inactivos: usuarios.filter((u) => !u.activo).length,
    administradores: usuarios.filter((u) => u.rol === 'administrador').length,
  }), [usuarios])

  function abrirCrear() {
    setModo('crear')
    setUsuarioEditando(null)
    setForm({
      nombres: '',
      apellidos: '',
      email: '',
      rol: 'usuario',
      activo: true,
      password: '',
    })
    setError('')
    setMensaje('')
    setModal(true)
  }

  function abrirEditar(usuario) {
    setModo('editar')
    setUsuarioEditando(usuario)
    setForm({
      nombres: usuario.nombres || '',
      apellidos: usuario.apellidos || '',
      email: usuario.email || '',
      rol: usuario.rol || 'usuario',
      activo: Boolean(usuario.activo),
      password: '',
    })
    setError('')
    setMensaje('')
    setModal(true)
  }

  function cerrarModal() {
    if (guardando) return
    setModal(false)
    setUsuarioEditando(null)
  }

  function cambiarCampo(campo, valor) {
    setForm((actual) => ({ ...actual, [campo]: valor }))
  }

  async function obtenerToken() {
    const { data, error: sessionError } = await supabase.auth.getSession()
    if (sessionError) throw sessionError

    const accessToken = data.session?.access_token
    if (!accessToken) {
      throw new Error('La sesión administrativa no está disponible.')
    }

    return accessToken
  }

  async function invocarGestion(payload) {
    const accessToken = await obtenerToken()

    const { data, error: functionError } =
      await supabase.functions.invoke('gestionar-usuario', {
        body: payload,
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      })

    if (functionError) {
      let detalle = functionError.message || 'No se pudo completar la operación.'

      try {
        const texto = await functionError.context?.text?.()
        if (texto) {
          const json = JSON.parse(texto)
          detalle = json.error || detalle
        }
      } catch {
        // Mantener mensaje original.
      }

      throw new Error(detalle)
    }

    if (data?.error) throw new Error(data.error)

    return data
  }

  async function guardarUsuario(e) {
    e.preventDefault()
    setGuardando(true)
    setError('')
    setMensaje('')

    try {
      const nombres = form.nombres.trim()
      const apellidos = form.apellidos.trim()
      const email = normalizarCorreo(form.email)

      if (!nombres || !apellidos || !email) {
        throw new Error('Nombres, apellidos y correo son obligatorios.')
      }

      if (modo === 'crear' && form.password.length < 8) {
        throw new Error('La contraseña inicial debe tener al menos 8 caracteres.')
      }

      await invocarGestion({
        accion: modo === 'crear' ? 'crear' : 'editar',
        usuario_id: usuarioEditando?.id || null,
        nombres,
        apellidos,
        email,
        rol: form.rol,
        activo: Boolean(form.activo),
        password: modo === 'crear' ? form.password : undefined,
      })

      setMensaje(
        modo === 'crear'
          ? 'Usuario creado correctamente.'
          : 'Usuario actualizado correctamente.'
      )

      await cargarDatos()

      setTimeout(() => {
        setModal(false)
        setUsuarioEditando(null)
      }, 500)
    } catch (err) {
      setError(err.message || 'Ocurrió un error.')
    } finally {
      setGuardando(false)
    }
  }

  async function cambiarEstado(usuario) {
    const nuevoEstado = !usuario.activo
    const accion = nuevoEstado ? 'activar' : 'desactivar'

    if (!window.confirm(
      `¿Deseas ${accion} a ${usuario.nombres} ${usuario.apellidos}?`
    )) return

    setError('')
    setMensaje('')

    try {
      await invocarGestion({
        accion,
        usuario_id: usuario.id,
      })

      setMensaje(`Usuario ${nuevoEstado ? 'activado' : 'desactivado'} correctamente.`)
      await cargarDatos()
    } catch (err) {
      setError(err.message || 'No se pudo cambiar el estado.')
    }
  }

  async function crearCuentaDocente(docente) {
    const nombreCompleto = `${docente.nombres} ${docente.apellidos}`.trim()
    const correo = normalizarCorreo(docente.correo)

    if (!correo) {
      setError('El docente no tiene correo registrado.')
      return
    }

    if (!docente.dni) {
      setError('El docente no tiene documento de identidad registrado.')
      return
    }

    if (!window.confirm(
      `Se creará la cuenta de acceso para:\n\n${nombreCompleto}\n${correo}\n\nUsuario: correo\nContraseña inicial: documento de identidad\nRol: Usuario\n\n¿Continuar?`
    )) return

    setCreandoCuentas(true)
    setError('')
    setMensaje('')
    setResultadoCuentas(null)

    try {
      const resultado = await invocarGestion({
        accion: 'crear_cuenta_docente',
        docente_id: docente.id,
      })

      setResultadoCuentas({
        ...resultado,
        docente: nombreCompleto,
        correo,
      })
      setMensaje('La cuenta del docente fue creada correctamente.')
      await cargarDatos()
    } catch (err) {
      setError(err.message || 'No se pudo crear la cuenta del docente.')
    } finally {
      setCreandoCuentas(false)
    }
  }

  async function crearCuentasDocentes() {
    if (!window.confirm(
      `Se crearán cuentas de acceso para los docentes activos que tengan correo y todavía no tengan cuenta. La contraseña inicial será su DNI. Los docentes sin correo quedarán pendientes. ¿Continuar?`
    )) return

    setCreandoCuentas(true)
    setError('')
    setMensaje('')
    setResultadoCuentas(null)

    try {
      const resultado = await invocarGestion({
        accion: 'crear_cuentas_docentes',
      })

      setResultadoCuentas(resultado)
      setMensaje('Proceso de cuentas docentes finalizado.')
      await cargarDatos()
    } catch (err) {
      setError(err.message || 'No se pudieron crear las cuentas docentes.')
    } finally {
      setCreandoCuentas(false)
    }
  }

  return (
    <div className="usuarios-page">
      <div className="usuarios-header">
        <div className="usuarios-title">
          <div className="usuarios-title-icon">
            <UsersRound size={26} />
          </div>
          <div>
            <h1>Usuarios</h1>
            <p>Gestión de cuentas de acceso al SGCE</p>
          </div>
        </div>

        <div className="usuarios-header-actions">
          <button
            className="btn-secondary action-docentes"
            onClick={crearCuentasDocentes}
            disabled={creandoCuentas}
          >
            {creandoCuentas ? <RefreshCw size={18} className="spin" /> : <GraduationCap size={18} />}
            {creandoCuentas ? 'Creando cuentas...' : 'Crear cuentas docentes'}
          </button>

          <button className="btn-primary" onClick={abrirCrear}>
            <UserPlus size={18} />
            Nuevo usuario
          </button>
        </div>
      </div>

      <div className="docentes-access-summary">
        <div>
          <GraduationCap size={20} />
          <div>
            <strong>{docentesConCuenta}</strong>
            <span>Docentes con cuenta</span>
          </div>
        </div>

        <div>
          <Clock3 size={20} />
          <div>
            <strong>{docentesPendientes}</strong>
            <span>Con correo, pendientes</span>
          </div>
        </div>

        <div>
          <LockKeyhole size={20} />
          <div>
            <strong>{docentesSinCorreo}</strong>
            <span>Sin correo: pendientes</span>
          </div>
        </div>
      </div>

      <div className="usuarios-stats">
        <div className="stat-card">
          <div className="stat-icon blue"><UsersRound size={23} /></div>
          <div><span>Total usuarios</span><strong>{estadisticas.total}</strong></div>
        </div>

        <div className="stat-card">
          <div className="stat-icon green"><UserCheck size={23} /></div>
          <div><span>Activos</span><strong>{estadisticas.activos}</strong></div>
        </div>

        <div className="stat-card">
          <div className="stat-icon orange"><UserX size={23} /></div>
          <div><span>Inactivos</span><strong>{estadisticas.inactivos}</strong></div>
        </div>

        <div className="stat-card">
          <div className="stat-icon purple"><ShieldCheck size={23} /></div>
          <div><span>Administradores</span><strong>{estadisticas.administradores}</strong></div>
        </div>
      </div>

      {error && !modal && <div className="alert error">{error}</div>}
      {mensaje && !modal && <div className="alert success">{mensaje}</div>}

      {docentesPendientes > 0 && (
        <section className="usuarios-card docentes-pendientes-card">
          <div className="section-heading">
            <div>
              <h2>Docentes pendientes de cuenta</h2>
              <p>
                {docentesPendientes} docente(s) tienen correo y todavía no tienen una cuenta de acceso.
              </p>
            </div>
          </div>

          <div className="tabla-wrap">
            <table className="usuarios-table">
              <thead>
                <tr>
                  <th>DOCENTE</th>
                  <th>DOCUMENTO</th>
                  <th>CORREO</th>
                  <th>ESTADO</th>
                  <th>ACCIÓN</th>
                </tr>
              </thead>
              <tbody>
                {docentes
                  .filter((d) => !d.perfil_id && normalizarCorreo(d.correo))
                  .filter((d) => {
                    const texto = busqueda.trim().toLowerCase()
                    if (!texto) return true

                    return [
                      d.nombres,
                      d.apellidos,
                      d.correo,
                      d.dni,
                    ]
                      .join(' ')
                      .toLowerCase()
                      .includes(texto)
                  })
                  .map((docente) => (
                    <tr key={docente.id}>
                      <td>
                        <div className="user-cell">
                          <div className="avatar docente">
                            <GraduationCap size={18} />
                          </div>
                          <div>
                            <strong>
                              {docente.apellidos}, {docente.nombres}
                            </strong>
                            <span>Docente</span>
                          </div>
                        </div>
                      </td>
                      <td>{docente.dni || '—'}</td>
                      <td>{normalizarCorreo(docente.correo)}</td>
                      <td>
                        <span className="status-badge inactive">
                          Pendiente
                        </span>
                      </td>
                      <td>
                        <button
                          className="btn-primary btn-small"
                          onClick={() => crearCuentaDocente(docente)}
                          disabled={creandoCuentas}
                          title={`Crear cuenta para ${docente.nombres} ${docente.apellidos}`}
                        >
                          {creandoCuentas
                            ? <RefreshCw size={16} className="spin" />
                            : <UserPlus size={16} />}
                          Crear cuenta
                        </button>
                      </td>
                    </tr>
                  ))}

                {docentes.filter(
                  (d) => !d.perfil_id && normalizarCorreo(d.correo)
                ).filter((d) => {
                  const texto = busqueda.trim().toLowerCase()
                  if (!texto) return true
                  return [
                    d.nombres,
                    d.apellidos,
                    d.correo,
                    d.dni,
                  ]
                    .join(' ')
                    .toLowerCase()
                    .includes(texto)
                }).length === 0 && (
                  <tr>
                    <td colSpan="5" className="empty-cell">
                      No hay docentes pendientes que coincidan con la búsqueda.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <section className="usuarios-card">
        <div className="usuarios-filtros">
          <div className="search-box">
            <Search size={19} />
            <input
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar por nombres, apellidos, correo o DNI..."
            />
          </div>

          <select value={filtroTipo} onChange={(e) => setFiltroTipo(e.target.value)}>
            <option value="">Todos los tipos</option>
            <option value="docente">Docentes</option>
            <option value="usuario">Otros usuarios</option>
          </select>

          <select value={filtroRol} onChange={(e) => setFiltroRol(e.target.value)}>
            <option value="">Todos los roles</option>
            <option value="usuario">Usuario</option>
            <option value="administrador">Administrador</option>
          </select>

          <div className="segmented">
            <button className={filtroEstado === 'activos' ? 'selected' : ''} onClick={() => setFiltroEstado('activos')}>Activos</button>
            <button className={filtroEstado === 'inactivos' ? 'selected' : ''} onClick={() => setFiltroEstado('inactivos')}>Inactivos</button>
            <button className={filtroEstado === '' ? 'selected' : ''} onClick={() => setFiltroEstado('')}>Todos</button>
          </div>
        </div>

        <div className="tabla-wrap">
          <table className="usuarios-table">
            <thead>
              <tr>
                <th>USUARIO</th>
                <th>CORREO</th>
                <th>TIPO</th>
                <th>ROL</th>
                <th>ESTADO</th>
                <th>ACCIONES</th>
              </tr>
            </thead>
            <tbody>
              {cargando ? (
                <tr><td colSpan="6" className="empty">Cargando usuarios...</td></tr>
              ) : usuariosFiltrados.length === 0 ? (
                <tr><td colSpan="6" className="empty">No hay usuarios que coincidan con los filtros.</td></tr>
              ) : (
                usuariosFiltrados.map((u) => (
                  <tr key={u.id}>
                    <td>
                      <div className="user-cell">
                        <div className="avatar">
                          {`${u.nombres?.[0] || ''}${u.apellidos?.[0] || ''}`.toUpperCase()}
                        </div>
                        <div>
                          <strong>{u.apellidos}</strong>
                          <span>{u.nombres}</span>
                        </div>
                      </div>
                    </td>
                    <td>{u.email}</td>
                    <td>
                      <span className={`type-badge ${u.tipo}`}>
                        {u.tipo === 'docente' ? 'Docente' : 'Usuario'}
                      </span>
                    </td>
                    <td>
                      <span className={`role-badge ${u.rol}`}>
                        {u.rol === 'administrador' ? 'Administrador' : 'Usuario'}
                      </span>
                    </td>
                    <td>
                      <span className={`status-badge ${u.activo ? 'active' : 'inactive'}`}>
                        {u.activo ? 'Activo' : 'Inactivo'}
                      </span>
                    </td>
                    <td>
                      <div className="actions">
                        <button title="Editar" onClick={() => abrirEditar(u)}>
                          <Pencil size={17} />
                        </button>
                        <button
                          title={u.activo ? 'Desactivar' : 'Activar'}
                          onClick={() => cambiarEstado(u)}
                        >
                          {u.activo ? <UserX size={17} /> : <UserCheck size={17} />}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {modal && (
        <div className="modal-backdrop">
          <div className="modal-card">
            <div className="modal-header">
              <div>
                <h2>{modo === 'crear' ? 'Nuevo usuario' : 'Editar usuario'}</h2>
                <p>
                  {modo === 'crear'
                    ? 'Crea una cuenta de acceso para el SGCE.'
                    : 'Actualiza los datos y permisos del usuario.'}
                </p>
              </div>
              <button className="close-btn" onClick={cerrarModal}><X size={20} /></button>
            </div>

            {error && <div className="alert error">{error}</div>}
            {mensaje && <div className="alert success">{mensaje}</div>}

            <form onSubmit={guardarUsuario}>
              <div className="form-grid">
                <label>
                  <span>Nombres *</span>
                  <input value={form.nombres} onChange={(e) => cambiarCampo('nombres', e.target.value)} required />
                </label>

                <label>
                  <span>Apellidos *</span>
                  <input value={form.apellidos} onChange={(e) => cambiarCampo('apellidos', e.target.value)} required />
                </label>

                <label className="full">
                  <span>Correo de acceso *</span>
                  <input
                    type="email"
                    value={form.email}
                    onChange={(e) => cambiarCampo('email', e.target.value)}
                    required
                    disabled={modo === 'editar'}
                  />
                </label>

                <label>
                  <span>Rol *</span>
                  <select value={form.rol} onChange={(e) => cambiarCampo('rol', e.target.value)}>
                    {ROLES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                  </select>
                </label>

                <label className="switch-field">
                  <span>Estado</span>
                  <button
                    type="button"
                    className={`switch ${form.activo ? 'on' : ''}`}
                    onClick={() => cambiarCampo('activo', !form.activo)}
                  >
                    <span />
                  </button>
                  <small>{form.activo ? 'Activo' : 'Inactivo'}</small>
                </label>

                {modo === 'crear' && (
                  <label className="full password-field">
                    <span>Contraseña inicial *</span>
                    <div>
                      <LockKeyhole size={18} />
                      <input
                        type="password"
                        value={form.password}
                        onChange={(e) => cambiarCampo('password', e.target.value)}
                        minLength={8}
                        required
                        placeholder="Mínimo 8 caracteres"
                      />
                    </div>
                    <small>Para docentes, la contraseña inicial será su DNI y no será necesario crearlos manualmente aquí.</small>
                  </label>
                )}
              </div>

              <div className="modal-footer">
                <button type="button" className="btn-secondary" onClick={cerrarModal}>Cancelar</button>
                <button type="submit" className="btn-primary" disabled={guardando}>
                  {guardando ? 'Guardando...' : modo === 'crear' ? 'Crear usuario' : 'Guardar cambios'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {resultadoCuentas && (
        <div className="modal-backdrop">
          <div className="modal-card result-modal">
            <div className="modal-header">
              <div>
                <h2>{resultadoCuentas.prueba ? 'Cuenta de prueba' : 'Cuentas docentes'}</h2>
                <p>{resultadoCuentas.prueba ? 'Se creó un solo acceso para verificar el flujo.' : 'Resultado de la creación automática de accesos.'}</p>
              </div>
              <button className="close-btn" onClick={() => setResultadoCuentas(null)}><X size={20} /></button>
            </div>

            <div className="result-grid">
              <div><strong>{resultadoCuentas.creadas || 0}</strong><span>Creadas</span></div>
              <div><strong>{resultadoCuentas.ya_existian || 0}</strong><span>Ya tenían cuenta</span></div>
              <div><strong>{resultadoCuentas.sin_correo || 0}</strong><span>Sin correo</span></div>
              <div><strong>{resultadoCuentas.errores || 0}</strong><span>Errores</span></div>
            </div>

            {Array.isArray(resultadoCuentas.detalles) && resultadoCuentas.detalles.length > 0 && (
              <div className="result-details">
                <strong>Observaciones</strong>
                {resultadoCuentas.detalles.slice(0, 20).map((item, index) => (
                  <div key={`${item.dni || item.email || index}-${index}`}>
                    <b>{item.dni || item.email || 'Registro'}</b>: {item.mensaje}
                  </div>
                ))}
              </div>
            )}

            <div className="modal-footer">
              <button className="btn-primary" onClick={() => setResultadoCuentas(null)}>Cerrar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default Usuarios
