import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  AlertTriangle,
  ArrowRight,
  Bell,
  CalendarDays,
  CheckCircle2,
  Clock3,
  FileWarning,
  MessageSquare,
  RefreshCw,
  Send,
  UserRound,
} from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import './Dashboard.css'

const ZONA_HORARIA = 'America/Lima'

function fechaPeru() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: ZONA_HORARIA,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())
}

function inicioFinDiaPeru() {
  const fecha = fechaPeru()
  return {
    inicio: `${fecha}T00:00:00-05:00`,
    fin: `${fecha}T23:59:59.999-05:00`,
  }
}

function formatearHora(fecha) {
  if (!fecha) return '—'
  return new Intl.DateTimeFormat('es-PE', {
    timeZone: ZONA_HORARIA,
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(fecha))
}

function formatearFechaCompleta(fecha) {
  return new Intl.DateTimeFormat('es-PE', {
    timeZone: ZONA_HORARIA,
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(fecha)
}

function Dashboard() {
  const { user, profile } = useAuth()
  const navigate = useNavigate()

  const [cargando, setCargando] = useState(true)
  const [actualizando, setActualizando] = useState(false)
  const [error, setError] = useState('')
  const [docente, setDocente] = useState(null)
  const [añoEscolar, setAñoEscolar] = useState(null)
  const [periodoActual, setPeriodoActual] = useState(null)
  const [estadisticas, setEstadisticas] = useState({
    salidasHoy: 0,
    salidasAbiertas: 0,
    solicitudesPendientes: 0,
    incidenciasHoy: 0,
    mensajesNoLeidos: 0,
  })
  const [actividad, setActividad] = useState([])

  const fechaActual = useMemo(() => new Date(), [])

  async function cargarDashboard(esRefresco = false) {
    if (!user?.id || !profile?.institucion_id) return

    try {
      if (esRefresco) setActualizando(true)
      else setCargando(true)

      setError('')

      const { inicio, fin } = inicioFinDiaPeru()

      const { data: docenteData, error: docenteError } = await supabase
        .from('docentes')
        .select('id, nombres, apellidos, especialidad, correo, activo')
        .eq('institucion_id', profile.institucion_id)
        .eq('perfil_id', user.id)
        .eq('activo', true)
        .maybeSingle()

      if (docenteError) throw docenteError
      setDocente(docenteData)

      const { data: añoData, error: añoError } = await supabase
        .from('años_escolares')
        .select('id, nombre, fecha_inicio, fecha_fin, estado')
        .eq('institucion_id', profile.institucion_id)
        .eq('estado', 'activo')
        .order('fecha_inicio', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (añoError) throw añoError
      setAñoEscolar(añoData)

      let periodoData = null

      if (añoData?.id) {
        const { data, error: periodoError } = await supabase
          .from('periodos_academicos')
          .select('id, numero, nombre, fecha_inicio, fecha_fin, estado')
          .eq('año_escolar_id', añoData.id)
          .gte('fecha_fin', fechaActual.toISOString().slice(0, 10))
          .lte('fecha_inicio', fechaActual.toISOString().slice(0, 10))
          .maybeSingle()

        if (periodoError && periodoError.code !== 'PGRST116') {
          throw periodoError
        }

        periodoData = data

        if (!periodoData) {
          const { data: periodoActivo, error: periodoActivoError } = await supabase
            .from('periodos_academicos')
            .select('id, numero, nombre, fecha_inicio, fecha_fin, estado')
            .eq('año_escolar_id', añoData.id)
            .eq('estado', 'activo')
            .order('numero')
            .limit(1)
            .maybeSingle()

          if (periodoActivoError) throw periodoActivoError
          periodoData = periodoActivo
        }
      }

      setPeriodoActual(periodoData)

      const docenteId = docenteData?.id

      const [
        salidasHoyResult,
        salidasAbiertasResult,
        solicitudesPendientesResult,
        incidenciasHoyResult,
        mensajesNoLeidosResult,
        salidasRecientesResult,
        incidenciasRecientesResult,
      ] = await Promise.all([
        docenteId && añoData?.id
          ? supabase
              .from('salidas')
              .select('id', { count: 'exact', head: true })
              .eq('institucion_id', profile.institucion_id)
              .eq('año_escolar_id', añoData.id)
              .eq('docente_id', docenteId)
              .eq('permiso_autorizado', true)
              .gte('hora_salida', inicio)
              .lte('hora_salida', fin)
          : Promise.resolve({ count: 0, error: null }),

        docenteId
          ? supabase
              .from('salidas')
              .select('id', { count: 'exact', head: true })
              .eq('institucion_id', profile.institucion_id)
              .eq('docente_id', docenteId)
              .eq('permiso_autorizado', true)
              .not('hora_salida', 'is', null)
              .is('hora_regreso', null)
          : Promise.resolve({ count: 0, error: null }),

        docenteId
          ? supabase
              .from('salidas')
              .select('id', { count: 'exact', head: true })
              .eq('institucion_id', profile.institucion_id)
              .eq('docente_id', docenteId)
              .eq('alerta_frecuencia', true)
              .is('permiso_autorizado', null)
          : Promise.resolve({ count: 0, error: null }),

        docenteId && añoData?.id
          ? supabase
              .from('incidencias')
              .select('id', { count: 'exact', head: true })
              .eq('institucion_id', profile.institucion_id)
              .eq('año_escolar_id', añoData.id)
              .eq('docente_id', docenteId)
              .gte('fecha_hora', inicio)
              .lte('fecha_hora', fin)
          : Promise.resolve({ count: 0, error: null }),

        supabase
          .from('mensajes')
          .select('id', { count: 'exact', head: true })
          .eq('institucion_id', profile.institucion_id)
          .eq('destinatario_id', user.id)
          .eq('leido', false),

        docenteId && añoData?.id
          ? supabase
              .from('salidas')
              .select('id, estudiante_id, hora_salida, hora_regreso, permiso_autorizado')
              .eq('institucion_id', profile.institucion_id)
              .eq('año_escolar_id', añoData.id)
              .eq('docente_id', docenteId)
              .gte('hora_salida', inicio)
              .lte('hora_salida', fin)
              .order('hora_salida', { ascending: false })
              .limit(5)
          : Promise.resolve({ data: [], error: null }),

        docenteId && añoData?.id
          ? supabase
              .from('incidencias')
              .select('id, estudiante_id, fecha_hora, estado, descripcion')
              .eq('institucion_id', profile.institucion_id)
              .eq('año_escolar_id', añoData.id)
              .eq('docente_id', docenteId)
              .gte('fecha_hora', inicio)
              .lte('fecha_hora', fin)
              .order('fecha_hora', { ascending: false })
              .limit(5)
          : Promise.resolve({ data: [], error: null }),
      ])

      const resultados = [
        salidasHoyResult,
        salidasAbiertasResult,
        solicitudesPendientesResult,
        incidenciasHoyResult,
        mensajesNoLeidosResult,
        salidasRecientesResult,
        incidenciasRecientesResult,
      ]

      const primerError = resultados.find((item) => item?.error)
      if (primerError?.error) throw primerError.error

      const salidasRecientes = salidasRecientesResult.data || []
      const incidenciasRecientes = incidenciasRecientesResult.data || []

      const estudianteIds = [
        ...new Set([
          ...salidasRecientes.map((item) => item.estudiante_id),
          ...incidenciasRecientes.map((item) => item.estudiante_id),
        ]),
      ]

      let estudiantesMap = new Map()

      if (estudianteIds.length) {
        const { data: estudiantes, error: estudiantesError } = await supabase
          .from('estudiantes')
          .select('id, nombres, apellidos')
          .in('id', estudianteIds)

        if (estudiantesError) throw estudiantesError

        estudiantesMap = new Map(
          (estudiantes || []).map((item) => [
            item.id,
            `${item.nombres} ${item.apellidos}`.trim(),
          ])
        )
      }

      const actividadSalidas = salidasRecientes.map((item) => ({
        id: `salida-${item.id}`,
        tipo: 'salida',
        hora: item.hora_salida,
        titulo: estudiantesMap.get(item.estudiante_id) || 'Estudiante',
        descripcion: item.hora_regreso
          ? 'Salida registrada y retorno registrado'
          : 'Estudiante actualmente fuera del aula',
        icono: item.hora_regreso ? CheckCircle2 : Clock3,
        estado: item.hora_regreso ? 'completada' : 'abierta',
      }))

      const actividadIncidencias = incidenciasRecientes.map((item) => ({
        id: `incidencia-${item.id}`,
        tipo: 'incidencia',
        hora: item.fecha_hora,
        titulo: estudiantesMap.get(item.estudiante_id) || 'Estudiante',
        descripcion: item.descripcion,
        icono: AlertTriangle,
        estado: item.estado,
      }))

      const actividadOrdenada = [...actividadSalidas, ...actividadIncidencias]
        .sort((a, b) => new Date(b.hora) - new Date(a.hora))
        .slice(0, 8)

      setActividad(actividadOrdenada)

      setEstadisticas({
        salidasHoy: salidasHoyResult.count || 0,
        salidasAbiertas: salidasAbiertasResult.count || 0,
        solicitudesPendientes: solicitudesPendientesResult.count || 0,
        incidenciasHoy: incidenciasHoyResult.count || 0,
        mensajesNoLeidos: mensajesNoLeidosResult.count || 0,
      })
    } catch (err) {
      console.error('Error cargando dashboard docente:', err)
      setError(err.message || 'No se pudo cargar el dashboard.')
    } finally {
      setCargando(false)
      setActualizando(false)
    }
  }

  useEffect(() => {
    cargarDashboard()
  }, [user?.id, profile?.institucion_id])

  const nombreDocente = docente
    ? `${docente.nombres} ${docente.apellidos}`.trim()
    : `${profile?.nombres || ''} ${profile?.apellidos || ''}`.trim()

  if (cargando) {
    return (
      <div className="dashboard-docente-loading">
        <RefreshCw className="spin" size={24} />
        <span>Cargando panel del docente...</span>
      </div>
    )
  }

  return (
    <div className="dashboard-docente">
      <section className="dashboard-docente-header">
        <div>
          <span className="dashboard-eyebrow">SGCE · Colegio Vancouver</span>
          <h1>Bienvenido, {nombreDocente || 'docente'}</h1>
          <p>
            Este es tu resumen operativo del día. Desde aquí puedes acceder
            rápidamente a las funciones que utilizas durante la jornada.
          </p>
        </div>

        <div className="dashboard-fecha">
          <CalendarDays size={20} />
          <div>
            <strong>{formatearFechaCompleta(fechaActual)}</strong>
            <span>
              {añoEscolar?.nombre || 'Año escolar'} ·{' '}
              {periodoActual?.nombre || 'Periodo no determinado'}
            </span>
          </div>
        </div>
      </section>

      {error && (
        <div className="dashboard-alert dashboard-alert-error">
          <AlertTriangle size={19} />
          <div>
            <strong>No se pudo cargar toda la información.</strong>
            <span>{error}</span>
          </div>
          <button type="button" onClick={() => cargarDashboard(true)}>
            Reintentar
          </button>
        </div>
      )}

      {estadisticas.solicitudesPendientes > 0 && (
        <button
          type="button"
          className="dashboard-alert dashboard-alert-warning"
          onClick={() => navigate('/app/salidas')}
        >
          <Bell size={21} />
          <div>
            <strong>
              Tienes {estadisticas.solicitudesPendientes}{' '}
              {estadisticas.solicitudesPendientes === 1
                ? 'solicitud pendiente'
                : 'solicitudes pendientes'}{' '}
              de autorización.
            </strong>
            <span>
              Corresponden a salidas que activaron la alerta de frecuencia.
            </span>
          </div>
          <ArrowRight size={20} />
        </button>
      )}

      <section className="dashboard-stats">
        <button
          type="button"
          className="dashboard-stat stat-blue"
          onClick={() => navigate('/app/salidas')}
        >
          <div className="dashboard-stat-icon">
            <Send size={23} />
          </div>
          <div>
            <span>Salidas de hoy</span>
            <strong>{estadisticas.salidasHoy}</strong>
            <small>Registradas por ti</small>
          </div>
        </button>

        <button
          type="button"
          className={`dashboard-stat ${
            estadisticas.salidasAbiertas > 0 ? 'stat-orange' : 'stat-green'
          }`}
          onClick={() => navigate('/app/salidas')}
        >
          <div className="dashboard-stat-icon">
            <Clock3 size={23} />
          </div>
          <div>
            <span>Fuera del aula</span>
            <strong>{estadisticas.salidasAbiertas}</strong>
            <small>Salidas actualmente abiertas</small>
          </div>
        </button>

        <button
          type="button"
          className="dashboard-stat stat-red"
          onClick={() => navigate('/app/incidencias')}
        >
          <div className="dashboard-stat-icon">
            <FileWarning size={23} />
          </div>
          <div>
            <span>Incidencias de hoy</span>
            <strong>{estadisticas.incidenciasHoy}</strong>
            <small>Registradas por ti</small>
          </div>
        </button>

        <button
          type="button"
          className={`dashboard-stat ${
            estadisticas.mensajesNoLeidos > 0 ? 'stat-purple unread' : 'stat-purple'
          }`}
          onClick={() => navigate('/app/mensajes')}
        >
          <div className="dashboard-stat-icon">
            <MessageSquare size={23} />
          </div>
          <div>
            <span>Mensajes no leídos</span>
            <strong>{estadisticas.mensajesNoLeidos}</strong>
            <small>
              {estadisticas.mensajesNoLeidos > 0
                ? 'Tienes mensajes por revisar'
                : 'Bandeja al día'}
            </small>
          </div>
          {estadisticas.mensajesNoLeidos > 0 && <span className="unread-dot" />}
        </button>
      </section>

      <section className="dashboard-main-grid">
        <div className="dashboard-panel">
          <div className="dashboard-panel-header">
            <div>
              <h2>Acciones rápidas</h2>
              <p>Accede directamente a las funciones principales.</p>
            </div>
          </div>

          <div className="dashboard-actions">
            <button type="button" onClick={() => navigate('/app/salidas')}>
              <span className="action-icon action-blue">
                <Send size={20} />
              </span>
              <span>
                <strong>Registrar salida</strong>
                <small>Autoriza y controla salidas de estudiantes.</small>
              </span>
              <ArrowRight size={18} />
            </button>

            <button type="button" onClick={() => navigate('/app/incidencias')}>
              <span className="action-icon action-orange">
                <AlertTriangle size={20} />
              </span>
              <span>
                <strong>Registrar incidencia</strong>
                <small>Registra situaciones ocurridas durante la jornada.</small>
              </span>
              <ArrowRight size={18} />
            </button>

            <button type="button" onClick={() => navigate('/app/mensajes')}>
              <span className="action-icon action-purple">
                <MessageSquare size={20} />
              </span>
              <span>
                <strong>Mensajes</strong>
                <small>Consulta, responde o redacta mensajes internos.</small>
              </span>
              {estadisticas.mensajesNoLeidos > 0 ? (
                <span className="action-badge">
                  {estadisticas.mensajesNoLeidos} nuevos
                </span>
              ) : (
                <ArrowRight size={18} />
              )}
            </button>
          </div>
        </div>

        <div className="dashboard-panel">
          <div className="dashboard-panel-header">
            <div>
              <h2>Actividad reciente</h2>
              <p>Últimos movimientos registrados hoy.</p>
            </div>
            <button
              type="button"
              className="dashboard-refresh"
              onClick={() => cargarDashboard(true)}
              disabled={actualizando}
              title="Actualizar"
            >
              <RefreshCw size={18} className={actualizando ? 'spin' : ''} />
            </button>
          </div>

          {actividad.length === 0 ? (
            <div className="dashboard-empty">
              <CheckCircle2 size={27} />
              <strong>Sin actividad registrada</strong>
              <span>Aún no tienes movimientos registrados hoy.</span>
            </div>
          ) : (
            <div className="dashboard-activity">
              {actividad.map((item) => {
                const Icono = item.icono
                return (
                  <div className="dashboard-activity-item" key={item.id}>
                    <div className={`activity-icon ${item.tipo}`}>
                      <Icono size={17} />
                    </div>
                    <div className="activity-info">
                      <strong>{item.titulo}</strong>
                      <span>{item.descripcion}</span>
                    </div>
                    <time>{formatearHora(item.hora)}</time>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </section>

      <section className="dashboard-profile-card">
        <div className="profile-card-icon">
          <UserRound size={23} />
        </div>
        <div>
          <strong>{nombreDocente || 'Usuario'}</strong>
          <span>
            {docente?.especialidad || 'Docente'} · {profile?.email || user?.email || ''}
          </span>
        </div>
        <div className="profile-card-status">
          <CheckCircle2 size={16} />
          Cuenta activa
        </div>
      </section>
    </div>
  )
}

export default Dashboard
