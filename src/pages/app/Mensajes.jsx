import { useEffect, useMemo, useState } from 'react'
import {
  AlertCircle,
  ArrowLeft,
  Check,
  Clock,
  Mail,
  MailOpen,
  MessageCircle,
  Plus,
  RefreshCw,
  Reply,
  Search,
  Send,
  User,
  X,
} from 'lucide-react'
import { supabase } from '../../lib/supabase'
import './Mensajes.css'

const PRIORIDADES = {
  normal: 'Normal',
  importante: 'Importante',
  urgente: 'Urgente',
}

function Mensajes() {
  const [usuario, setUsuario] = useState(null)
  const [perfil, setPerfil] = useState(null)

  const [pestaña, setPestaña] = useState('recibidos')
  const [mensajesRecibidos, setMensajesRecibidos] = useState([])
  const [mensajesEnviados, setMensajesEnviados] = useState([])
  const [usuarios, setUsuarios] = useState([])
  const [perfilesMensajes, setPerfilesMensajes] = useState([])

  const [mensajeSeleccionado, setMensajeSeleccionado] = useState(null)
  const [modoRespuesta, setModoRespuesta] = useState(false)

  const [asunto, setAsunto] = useState('')
  const [contenido, setContenido] = useState('')
  const [prioridad, setPrioridad] = useState('normal')
  const [destinatarioId, setDestinatarioId] = useState('')
  const [busquedaUsuario, setBusquedaUsuario] = useState('')
  const [mostrarSugerencias, setMostrarSugerencias] = useState(false)

  const [busqueda, setBusqueda] = useState('')

  const [cargando, setCargando] = useState(true)
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState('')
  const [mensajeExito, setMensajeExito] = useState('')

  useEffect(() => {
    inicializar()
  }, [])

  async function inicializar() {
    setCargando(true)
    setError('')

    const {
      data: { user },
      error: errorUsuario,
    } = await supabase.auth.getUser()

    if (errorUsuario || !user) {
      setError('No se pudo identificar al usuario actual.')
      setCargando(false)
      return
    }

    setUsuario(user)

    const { data: perfilData, error: errorPerfil } = await supabase
      .from('perfiles')
      .select('id, institucion_id, nombres, apellidos, email, rol, activo')
      .eq('id', user.id)
      .single()

    if (errorPerfil) {
      setError(errorPerfil.message)
      setCargando(false)
      return
    }

    setPerfil(perfilData)

    const [recibidos, enviados] = await Promise.all([
      cargarMensajesRecibidos(user.id),
      cargarMensajesEnviados(user.id),
      cargarUsuarios(perfilData.institucion_id, user.id),
    ])

    await cargarPerfilesMensajes(
      [...(recibidos || []), ...(enviados || [])],
      perfilData.institucion_id
    )

    setCargando(false)
  }

  async function cargarMensajesRecibidos(usuarioId = usuario?.id) {
    if (!usuarioId) return

    const { data, error: errorConsulta } = await supabase
      .from('mensajes')
      .select(`
        id,
        institucion_id,
        remitente_id,
        destinatario_id,
        mensaje_padre_id,
        asunto,
        contenido,
        prioridad,
        leido,
        fecha_lectura,
        created_at,
        updated_at
      `)
      .eq('destinatario_id', usuarioId)
      .order('created_at', { ascending: false })

    if (errorConsulta) {
      setError(errorConsulta.message)
      return
    }

    setMensajesRecibidos(data || [])
    return data || []
  }

  async function cargarMensajesEnviados(usuarioId = usuario?.id) {
    if (!usuarioId) return

    const { data, error: errorConsulta } = await supabase
      .from('mensajes')
      .select(`
        id,
        institucion_id,
        remitente_id,
        destinatario_id,
        mensaje_padre_id,
        asunto,
        contenido,
        prioridad,
        leido,
        fecha_lectura,
        created_at,
        updated_at
      `)
      .eq('remitente_id', usuarioId)
      .order('created_at', { ascending: false })

    if (errorConsulta) {
      setError(errorConsulta.message)
      return
    }

    setMensajesEnviados(data || [])
    return data || []
  }

  async function cargarUsuarios(institucionId, usuarioId) {
    if (!institucionId || !usuarioId) return

    const { data, error: errorConsulta } = await supabase
      .from('perfiles')
      .select('id, nombres, apellidos, email, rol')
      .eq('institucion_id', institucionId)
      .eq('activo', true)
      .neq('id', usuarioId)
      .order('nombres', { ascending: true })

    if (errorConsulta) {
      setError(errorConsulta.message)
      return
    }

    setUsuarios(data || [])
  }

  async function cargarPerfilesMensajes(mensajes = [], institucionId) {
    if (!institucionId || !mensajes.length) {
      setPerfilesMensajes([])
      return
    }

    const ids = [...new Set(
      mensajes
        .flatMap((mensaje) => [mensaje.remitente_id, mensaje.destinatario_id])
        .filter(Boolean)
    )]

    if (!ids.length) {
      setPerfilesMensajes([])
      return
    }

    const { data, error: errorConsulta } = await supabase.rpc(
      'obtener_perfiles_mensajes',
      {
        p_ids: ids,
      }
    )

    if (errorConsulta) {
      setError(errorConsulta.message)
      return
    }

    setPerfilesMensajes(data || [])
  }

  const noLeidos = useMemo(
    () => mensajesRecibidos.filter((mensaje) => !mensaje.leido).length,
    [mensajesRecibidos]
  )

  const usuariosSugeridos = useMemo(() => {
    const termino = busquedaUsuario.trim().toLowerCase()

    if (!termino || destinatarioId) return []

    return usuarios
      .filter((item) => {
        const texto = [
          item.nombres,
          item.apellidos,
          item.email,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()

        return texto.includes(termino)
      })
      .slice(0, 8)
  }, [usuarios, busquedaUsuario, destinatarioId])

  const destinatarioSeleccionado = useMemo(
    () =>
      usuarios.find((item) => item.id === destinatarioId) ||
      perfilesMensajes.find((item) => item.id === destinatarioId) ||
      null,
    [usuarios, perfilesMensajes, destinatarioId]
  )

  const mensajesMostrados = useMemo(() => {
    const lista =
      pestaña === 'recibidos'
        ? mensajesRecibidos
        : mensajesEnviados

    const termino = busqueda.trim().toLowerCase()

    if (!termino) return lista

    return lista.filter((mensaje) => {
      const texto = [
        mensaje.asunto,
        mensaje.contenido,
        obtenerNombreUsuario(
          pestaña === 'recibidos'
            ? mensaje.remitente_id
            : mensaje.destinatario_id
        ),
      ]
        .join(' ')
        .toLowerCase()

      return texto.includes(termino)
    })
  }, [
    pestaña,
    mensajesRecibidos,
    mensajesEnviados,
    busqueda,
    usuarios,
    perfilesMensajes,
  ])

  function obtenerNombreUsuario(id) {
    if (id === usuario?.id && perfil) {
      return `${perfil.nombres} ${perfil.apellidos}`
    }

    const encontrado =
      perfilesMensajes.find((item) => item.id === id) ||
      usuarios.find((item) => item.id === id)

    if (!encontrado) return 'Usuario'

    return `${encontrado.nombres} ${encontrado.apellidos}`.trim() || 'Usuario'
  }

  function obtenerIniciales(id) {
    const nombre = obtenerNombreUsuario(id)

    return nombre
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((parte) => parte[0])
      .join('')
      .toUpperCase()
  }

  function formatearFecha(fecha) {
    if (!fecha) return ''

    return new Intl.DateTimeFormat('es-PE', {
      dateStyle: 'short',
      timeStyle: 'short',
      timeZone: 'America/Lima',
    }).format(new Date(fecha))
  }

  async function abrirMensaje(mensaje) {
    setMensajeSeleccionado(mensaje)
    setModoRespuesta(false)
    setError('')
    setMensajeExito('')

    if (!mensaje.leido && mensaje.destinatario_id === usuario?.id) {
      const { data, error: errorUpdate } = await supabase.rpc(
        'marcar_mensaje_leido',
        {
          p_mensaje_id: mensaje.id,
        }
      )

      if (errorUpdate) {
        setError(errorUpdate.message)
        return
      }

      const fechaLectura =
        data?.fecha_lectura || new Date().toISOString()

      setMensajesRecibidos((actuales) =>
        actuales.map((item) =>
          item.id === mensaje.id
            ? {
                ...item,
                leido: true,
                fecha_lectura: fechaLectura,
              }
            : item
        )
      )

      setMensajeSeleccionado({
        ...mensaje,
        leido: true,
        fecha_lectura: fechaLectura,
      })
    }
  }

  function prepararRespuesta() {
    if (!mensajeSeleccionado) return

    setDestinatarioId(mensajeSeleccionado.remitente_id)

    const asuntoOriginal = mensajeSeleccionado.asunto || ''

    setAsunto(
      asuntoOriginal.toLowerCase().startsWith('re:')
        ? asuntoOriginal
        : `RE: ${asuntoOriginal}`
    )

    setContenido('')
    setPrioridad(mensajeSeleccionado.prioridad || 'normal')
    setModoRespuesta(true)
    setPestaña('redactar')
  }

  function iniciarNuevoMensaje() {
    setMensajeSeleccionado(null)
    setModoRespuesta(false)
    setDestinatarioId('')
    setAsunto('')
    setContenido('')
    setPrioridad('normal')
    setBusquedaUsuario('')
    setMostrarSugerencias(false)
    setError('')
    setMensajeExito('')
    setPestaña('redactar')
  }

  function seleccionarDestinatario(usuarioSeleccionado) {
    setDestinatarioId(usuarioSeleccionado.id)
    setBusquedaUsuario('')
    setMostrarSugerencias(false)
    setError('')
  }

  function limpiarDestinatario() {
    if (modoRespuesta) return

    setDestinatarioId('')
    setBusquedaUsuario('')
    setMostrarSugerencias(false)
  }

  async function enviarMensaje(event) {
    event.preventDefault()

    if (!usuario || !perfil) return

    setError('')
    setMensajeExito('')

    if (!destinatarioId) {
      setError('Selecciona un destinatario.')
      return
    }

    if (!asunto.trim()) {
      setError('Ingresa un asunto.')
      return
    }

    if (!contenido.trim()) {
      setError('Escribe el contenido del mensaje.')
      return
    }

    setEnviando(true)

    const mensajePadreId = modoRespuesta
      ? mensajeSeleccionado?.id || null
      : null

    const { data, error: errorInsert } = await supabase
      .from('mensajes')
      .insert({
        institucion_id: perfil.institucion_id,
        remitente_id: usuario.id,
        destinatario_id: destinatarioId,
        mensaje_padre_id: mensajePadreId,
        asunto: asunto.trim(),
        contenido: contenido.trim(),
        prioridad,
      })
      .select()
      .single()

    if (errorInsert) {
      setError(errorInsert.message)
      setEnviando(false)
      return
    }

    setMensajesEnviados((actuales) => [data, ...actuales])

    setDestinatarioId('')
    setAsunto('')
    setContenido('')
    setPrioridad('normal')
    setModoRespuesta(false)
    setMensajeSeleccionado(null)
    setBusquedaUsuario('')
    setMostrarSugerencias(false)

    setMensajeExito('Mensaje enviado correctamente.')
    setPestaña('enviados')

    setEnviando(false)
  }

  async function recargar() {
    if (!usuario || !perfil) return

    setError('')
    setMensajeExito('')

    const [recibidos, enviados] = await Promise.all([
      cargarMensajesRecibidos(usuario.id),
      cargarMensajesEnviados(usuario.id),
      cargarUsuarios(perfil.institucion_id, usuario.id),
    ])

    await cargarPerfilesMensajes(
      [...(recibidos || []), ...(enviados || [])],
      perfil.institucion_id
    )
  }

  function cancelarRedaccion() {
    setModoRespuesta(false)
    setMensajeSeleccionado(null)
    setDestinatarioId('')
    setAsunto('')
    setContenido('')
    setPrioridad('normal')
    setBusquedaUsuario('')
    setMostrarSugerencias(false)
    setError('')
    setMensajeExito('')
    setPestaña('recibidos')
  }

  if (cargando) {
    return (
      <div className="mensajes-page">
        <div className="mensajes-loading">
          <RefreshCw size={22} className="mensajes-spin" />
          <span>Cargando mensajes...</span>
        </div>
      </div>
    )
  }

  return (
    <div className="mensajes-page">

      <div className="mensajes-header">
        <div>
          <div className="mensajes-title-row">
            <div className="mensajes-icon">
              <MessageCircle size={24} />
            </div>

            <div>
              <h1>Mensajes</h1>
              <p>Comunicación interna del Colegio Vancouver</p>
            </div>
          </div>
        </div>

        <div className="mensajes-header-actions">
          <button
            type="button"
            className="mensajes-btn mensajes-btn-secondary"
            onClick={recargar}
            title="Actualizar"
          >
            <RefreshCw size={17} />
            Actualizar
          </button>

          <button
            type="button"
            className="mensajes-btn mensajes-btn-primary"
            onClick={iniciarNuevoMensaje}
          >
            <Plus size={17} />
            Nuevo mensaje
          </button>
        </div>
      </div>

      {noLeidos > 0 && (
        <div className="mensajes-alerta">
          <div className="mensajes-alerta-icon">
            <Mail size={21} />
          </div>

          <div className="mensajes-alerta-texto">
            <strong>
              Tienes {noLeidos} mensaje{noLeidos === 1 ? '' : 's'} nuevo{noLeidos === 1 ? '' : 's'}
            </strong>
            <span>
              Hay mensajes pendientes de lectura en tu bandeja.
            </span>
          </div>

          <button
            type="button"
            onClick={() => setPestaña('recibidos')}
          >
            Ver recibidos
          </button>
        </div>
      )}

      {error && (
        <div className="mensajes-error">
          <AlertCircle size={18} />
          <span>{error}</span>
          <button type="button" onClick={() => setError('')}>
            <X size={16} />
          </button>
        </div>
      )}

      {mensajeExito && (
        <div className="mensajes-exito">
          <Check size={18} />
          <span>{mensajeExito}</span>
        </div>
      )}

      <div className="mensajes-tabs">
        <button
          type="button"
          className={pestaña === 'recibidos' ? 'active' : ''}
          onClick={() => {
            setPestaña('recibidos')
            setMensajeSeleccionado(null)
          }}
        >
          <Mail size={17} />
          Recibidos

          {noLeidos > 0 && (
            <span className="mensajes-badge">
              {noLeidos}
            </span>
          )}
        </button>

        <button
          type="button"
          className={pestaña === 'enviados' ? 'active' : ''}
          onClick={() => {
            setPestaña('enviados')
            setMensajeSeleccionado(null)
          }}
        >
          <Send size={17} />
          Enviados
        </button>

        <button
          type="button"
          className={pestaña === 'redactar' ? 'active' : ''}
          onClick={iniciarNuevoMensaje}
        >
          <Plus size={17} />
          Redactar
        </button>
      </div>

      {pestaña !== 'redactar' ? (
        <div className="mensajes-panel">

          <div className="mensajes-toolbar">
            <div className="mensajes-search">
              <Search size={18} />
              <input
                type="text"
                placeholder="Buscar por asunto, contenido o usuario..."
                value={busqueda}
                onChange={(event) => setBusqueda(event.target.value)}
              />
            </div>

            <div className="mensajes-count">
              {mensajesMostrados.length} mensaje
              {mensajesMostrados.length === 1 ? '' : 's'}
            </div>
          </div>

          {mensajesMostrados.length === 0 ? (
            <div className="mensajes-vacio">
              <div className="mensajes-vacio-icon">
                <MailOpen size={28} />
              </div>

              <h3>
                {busqueda
                  ? 'No se encontraron mensajes'
                  : pestaña === 'recibidos'
                    ? 'No tienes mensajes recibidos'
                    : 'No tienes mensajes enviados'}
              </h3>

              <p>
                {busqueda
                  ? 'Prueba con otro término de búsqueda.'
                  : 'Los mensajes aparecerán aquí cuando exista actividad.'}
              </p>
            </div>
          ) : (
            <div className="mensajes-lista">
              {mensajesMostrados.map((mensaje) => {
                const otroUsuarioId =
                  pestaña === 'recibidos'
                    ? mensaje.remitente_id
                    : mensaje.destinatario_id

                return (
                  <button
                    type="button"
                    key={mensaje.id}
                    className={`mensaje-item ${
                      !mensaje.leido && pestaña === 'recibidos'
                        ? 'no-leido'
                        : ''
                    }`}
                    onClick={() => abrirMensaje(mensaje)}
                  >
                    <div className="mensaje-avatar">
                      {obtenerIniciales(otroUsuarioId)}
                    </div>

                    <div className="mensaje-item-main">
                      <div className="mensaje-item-top">
                        <strong>
                          {obtenerNombreUsuario(otroUsuarioId)}
                        </strong>

                        <span>
                          {formatearFecha(mensaje.created_at)}
                        </span>
                      </div>

                      <div className="mensaje-item-subject">
                        <span>{mensaje.asunto}</span>

                        {mensaje.prioridad !== 'normal' && (
                          <span
                            className={`mensaje-prioridad ${mensaje.prioridad}`}
                          >
                            {PRIORIDADES[mensaje.prioridad]}
                          </span>
                        )}
                      </div>

                      <p>
                        {mensaje.contenido.length > 130
                          ? `${mensaje.contenido.substring(0, 130)}...`
                          : mensaje.contenido}
                      </p>
                    </div>

                    {!mensaje.leido && pestaña === 'recibidos' && (
                      <span className="mensaje-punto" />
                    )}
                  </button>
                )
              })}
            </div>
          )}
        </div>
      ) : (
        <form
          className="mensajes-panel mensajes-form"
          onSubmit={enviarMensaje}
        >
          <div className="mensajes-form-header">
            <div>
              <h2>
                {modoRespuesta
                  ? 'Responder mensaje'
                  : 'Nuevo mensaje'}
              </h2>

              <p>
                {modoRespuesta
                  ? 'Tu respuesta quedará vinculada al mensaje original.'
                  : 'Envía una comunicación a otro usuario del SGCE.'}
              </p>
            </div>

            {modoRespuesta && (
              <button
                type="button"
                className="mensajes-btn mensajes-btn-secondary"
                onClick={cancelarRedaccion}
              >
                <ArrowLeft size={17} />
                Cancelar respuesta
              </button>
            )}
          </div>

          {modoRespuesta && mensajeSeleccionado && (
            <div className="mensaje-original">
              <div className="mensaje-original-header">
                <div className="mensaje-avatar pequeño">
                  {obtenerIniciales(mensajeSeleccionado.remitente_id)}
                </div>

                <div>
                  <strong>
                    {obtenerNombreUsuario(
                      mensajeSeleccionado.remitente_id
                    )}
                  </strong>

                  <span>
                    {formatearFecha(
                      mensajeSeleccionado.created_at
                    )}
                  </span>
                </div>
              </div>

              <strong className="mensaje-original-asunto">
                {mensajeSeleccionado.asunto}
              </strong>

              <p>{mensajeSeleccionado.contenido}</p>
            </div>
          )}

          <div className="mensajes-form-grid">

            <div className="mensajes-field mensajes-field-full">
              <label>
                <User size={16} />
                Destinatario
              </label>

              {destinatarioSeleccionado ? (
                <div className={`destinatario-seleccionado ${
                  modoRespuesta ? 'bloqueado' : ''
                }`}>
                  <div className="destinatario-seleccionado-icon">
                    <User size={17} />
                  </div>

                  <div className="destinatario-seleccionado-info">
                    <strong>
                      {destinatarioSeleccionado.nombres}{' '}
                      {destinatarioSeleccionado.apellidos}
                    </strong>
                    <span>
                      {destinatarioSeleccionado.email || 'Usuario del SGCE'}
                    </span>
                  </div>

                  {!modoRespuesta && (
                    <button
                      type="button"
                      className="destinatario-quitar"
                      onClick={limpiarDestinatario}
                      title="Cambiar destinatario"
                    >
                      <X size={17} />
                    </button>
                  )}
                </div>
              ) : (
                <div className="destinatario-autocomplete">
                  <div className="destinatario-search">
                    <Search size={17} />

                    <input
                      type="text"
                      placeholder="Escribe el nombre, apellido o correo..."
                      value={busquedaUsuario}
                      onChange={(event) => {
                        setBusquedaUsuario(event.target.value)
                        setMostrarSugerencias(
                          event.target.value.trim().length > 0
                        )
                      }}
                      onFocus={() => {
                        if (busquedaUsuario.trim()) {
                          setMostrarSugerencias(true)
                        }
                      }}
                      autoComplete="off"
                    />
                  </div>

                  {mostrarSugerencias && (
                    <div className="destinatario-sugerencias">
                      {usuariosSugeridos.length > 0 ? (
                        usuariosSugeridos.map((item) => (
                          <button
                            key={item.id}
                            type="button"
                            className="destinatario-sugerencia"
                            onMouseDown={(event) => event.preventDefault()}
                            onClick={() => seleccionarDestinatario(item)}
                          >
                            <div className="destinatario-sugerencia-avatar">
                              {`${item.nombres?.[0] || ''}${item.apellidos?.[0] || ''}`.toUpperCase()}
                            </div>

                            <div className="destinatario-sugerencia-info">
                              <strong>
                                {item.nombres} {item.apellidos}
                              </strong>
                              <span>
                                {item.email || 'Usuario del SGCE'}
                              </span>
                            </div>
                          </button>
                        ))
                      ) : (
                        <div className="destinatario-sin-resultados">
                          No se encontraron usuarios con esa búsqueda.
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="mensajes-field">
              <label>Asunto</label>

              <input
                type="text"
                value={asunto}
                onChange={(event) =>
                  setAsunto(event.target.value)
                }
                placeholder="Asunto del mensaje"
              />
            </div>

            <div className="mensajes-field">
              <label>Prioridad</label>

              <select
                value={prioridad}
                onChange={(event) =>
                  setPrioridad(event.target.value)
                }
              >
                <option value="normal">
                  Normal
                </option>

                <option value="importante">
                  Importante
                </option>

                <option value="urgente">
                  Urgente
                </option>
              </select>
            </div>

            <div className="mensajes-field mensajes-field-full">
              <label>Mensaje</label>

              <textarea
                rows="9"
                value={contenido}
                onChange={(event) =>
                  setContenido(event.target.value)
                }
                placeholder="Escribe el mensaje..."
              />
            </div>

          </div>

          <div className="mensajes-form-footer">
            <span>
              {modoRespuesta
                ? 'Respuesta al mensaje seleccionado'
                : 'Mensaje interno del SGCE'}
            </span>

            <button
              type="submit"
              className="mensajes-btn mensajes-btn-primary"
              disabled={enviando}
            >
              {enviando ? (
                <>
                  <RefreshCw
                    size={17}
                    className="mensajes-spin"
                  />
                  Enviando...
                </>
              ) : (
                <>
                  {modoRespuesta ? (
                    <Reply size={17} />
                  ) : (
                    <Send size={17} />
                  )}
                  {modoRespuesta
                    ? 'Enviar respuesta'
                    : 'Enviar mensaje'}
                </>
              )}
            </button>
          </div>
        </form>
      )}

      {mensajeSeleccionado && pestaña !== 'redactar' && (
        <div className="mensaje-modal-backdrop">
          <div className="mensaje-modal">

            <div className="mensaje-modal-header">
              <div className="mensaje-modal-user">
                <div className="mensaje-avatar">
                  {obtenerIniciales(
                    pestaña === 'recibidos'
                      ? mensajeSeleccionado.remitente_id
                      : mensajeSeleccionado.destinatario_id
                  )}
                </div>

                <div>
                  <strong>
                    {obtenerNombreUsuario(
                      pestaña === 'recibidos'
                        ? mensajeSeleccionado.remitente_id
                        : mensajeSeleccionado.destinatario_id
                    )}
                  </strong>

                  <span>
                    {pestaña === 'recibidos'
                      ? 'Remitente'
                      : 'Destinatario'}
                  </span>
                </div>
              </div>

              <button
                type="button"
                className="mensaje-modal-close"
                onClick={() => setMensajeSeleccionado(null)}
              >
                <X size={20} />
              </button>
            </div>

            <div className="mensaje-modal-content">

              <div className="mensaje-modal-meta">
                <span>
                  <Clock size={15} />
                  {formatearFecha(
                    mensajeSeleccionado.created_at
                  )}
                </span>

                <span
                  className={`mensaje-prioridad ${mensajeSeleccionado.prioridad}`}
                >
                  {PRIORIDADES[mensajeSeleccionado.prioridad]}
                </span>

                {mensajeSeleccionado.leido && (
                  <span className="mensaje-leido">
                    <Check size={15} />
                    Leído
                  </span>
                )}
              </div>

              <h2>{mensajeSeleccionado.asunto}</h2>

              <div className="mensaje-contenido">
                {mensajeSeleccionado.contenido}
              </div>

              {pestaña === 'recibidos' && (
                <div className="mensaje-modal-footer">
                  <button
                    type="button"
                    className="mensajes-btn mensajes-btn-primary"
                    onClick={prepararRespuesta}
                  >
                    <Reply size={17} />
                    Responder
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  )
}

export default Mensajes