import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Users,
  GraduationCap,
  ClipboardList,
  School,
  Send,
  AlertTriangle,
  Clock3,
  ArrowRight,
  RefreshCw,
  CalendarDays,
  Settings2,
  UserCog,
  FileText,
} from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import './DashboardAdmin.css'

const TIME_ZONE = 'America/Lima'

function fechaPeru() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())
}

function inicioFinDiaPeru(fecha) {
  return {
    inicio: `${fecha}T00:00:00-05:00`,
    fin: `${fecha}T23:59:59.999-05:00`,
  }
}

function formatearHora(valor) {
  if (!valor) return '—'
  return new Intl.DateTimeFormat('es-PE', {
    timeZone: TIME_ZONE,
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(valor))
}

function formatearFechaCompleta(valor) {
  if (!valor) return '—'
  return new Intl.DateTimeFormat('es-PE', {
    timeZone: TIME_ZONE,
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  }).format(new Date(valor))
}

export default function DashboardAdmin() {
  const { user } = useAuth()
  const navigate = useNavigate()

  const [perfil, setPerfil] = useState(null)
  const [institucion, setInstitucion] = useState(null)
  const [añoEscolar, setAñoEscolar] = useState(null)
  const [periodoActual, setPeriodoActual] = useState(null)
  const [estadisticas, setEstadisticas] = useState({
    estudiantes: 0,
    docentes: 0,
    matriculas: 0,
    secciones: 0,
    salidasHoy: 0,
    fueraAula: 0,
    incidenciasHoy: 0,
  })
  const [actividad, setActividad] = useState([])
  const [cargando, setCargando] = useState(true)
  const [actualizando, setActualizando] = useState(false)
  const [error, setError] = useState('')

  const fechaActual = useMemo(() => new Date(), [])
  const fecha = useMemo(() => fechaPeru(), [])
  const rangoDia = useMemo(() => inicioFinDiaPeru(fecha), [fecha])

  async function cargarDashboard(esRefresco = false) {
    if (!user?.id) return

    if (esRefresco) setActualizando(true)
    else setCargando(true)

    setError('')

    try {
      const { data: perfilData, error: perfilError } = await supabase
        .from('perfiles')
        .select('id, institucion_id, nombres, apellidos, rol, activo')
        .eq('id', user.id)
        .maybeSingle()

      if (perfilError) throw perfilError
      if (!perfilData?.institucion_id) {
        throw new Error('No se encontró la institución del usuario.')
      }

      setPerfil(perfilData)

      const { data: institucionData, error: institucionError } = await supabase
        .from('instituciones')
        .select('id, nombre, codigo_modular')
        .eq('id', perfilData.institucion_id)
        .maybeSingle()

      if (institucionError) throw institucionError
      setInstitucion(institucionData)

      const { data: añoData, error: añoError } = await supabase
        .from('años_escolares')
        .select('id, nombre, fecha_inicio, fecha_fin, estado')
        .eq('institucion_id', perfilData.institucion_id)
        .order('fecha_inicio', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (añoError) throw añoError
      setAñoEscolar(añoData)

      let periodoData = null

      if (añoData?.id) {
        const { data: periodoActivo, error: periodoError } = await supabase
          .from('periodos_academicos')
          .select('id, numero, nombre, fecha_inicio, fecha_fin, estado')
          .eq('año_escolar_id', añoData.id)
          .lte('fecha_inicio', fecha)
          .gte('fecha_fin', fecha)
          .maybeSingle()

        if (periodoError) throw periodoError
        periodoData = periodoActivo

        if (!periodoData) {
          const { data: periodoFallback, error: fallbackError } = await supabase
            .from('periodos_academicos')
            .select('id, numero, nombre, fecha_inicio, fecha_fin, estado')
            .eq('año_escolar_id', añoData.id)
            .order('numero', { ascending: true })
            .limit(1)
            .maybeSingle()

          if (fallbackError) throw fallbackError
          periodoData = periodoFallback
        }
      }

      setPeriodoActual(periodoData)

      const queries = [
        supabase
          .from('estudiantes')
          .select('id', { count: 'exact', head: true })
          .eq('institucion_id', perfilData.institucion_id)
          .eq('activo', true),

        supabase
          .from('docentes')
          .select('id', { count: 'exact', head: true })
          .eq('institucion_id', perfilData.institucion_id)
          .eq('activo', true),

        añoData?.id
          ? supabase
              .from('matriculas')
              .select('id', { count: 'exact', head: true })
              .eq('año_escolar_id', añoData.id)
              .eq('estado', 'matriculado')
          : Promise.resolve({ count: 0, error: null }),

        añoData?.id
          ? supabase
              .from('secciones')
              .select('id', { count: 'exact', head: true })
              .eq('institucion_id', perfilData.institucion_id)
              .eq('año_escolar_id', añoData.id)
              .eq('activa', true)
          : Promise.resolve({ count: 0, error: null }),

        supabase
          .from('salidas')
          .select('id', { count: 'exact', head: true })
          .eq('institucion_id', perfilData.institucion_id)
          .eq('permiso_autorizado', true)
          .gte('hora_salida', rangoDia.inicio)
          .lte('hora_salida', rangoDia.fin),

        supabase
          .from('salidas')
          .select('id', { count: 'exact', head: true })
          .eq('institucion_id', perfilData.institucion_id)
          .eq('permiso_autorizado', true)
          .is('hora_regreso', null)
          .not('hora_salida', 'is', null),

        supabase
          .from('incidencias')
          .select('id', { count: 'exact', head: true })
          .eq('institucion_id', perfilData.institucion_id)
          .gte('fecha_hora', rangoDia.inicio)
          .lte('fecha_hora', rangoDia.fin),
      ]

      const resultados = await Promise.all(queries)
      const primerError = resultados.find((resultado) => resultado?.error)

      if (primerError?.error) throw primerError.error

      setEstadisticas({
        estudiantes: resultados[0].count ?? 0,
        docentes: resultados[1].count ?? 0,
        matriculas: resultados[2].count ?? 0,
        secciones: resultados[3].count ?? 0,
        salidasHoy: resultados[4].count ?? 0,
        fueraAula: resultados[5].count ?? 0,
        incidenciasHoy: resultados[6].count ?? 0,
      })

      const actividadSalidas = await supabase
        .from('salidas')
        .select(`
          id,
          estudiante_id,
          docente_id,
          hora_salida,
          hora_regreso,
          permiso_autorizado,
          observacion,
          estudiantes (nombres, apellidos)
        `)
        .eq('institucion_id', perfilData.institucion_id)
        .gte('hora_salida', rangoDia.inicio)
        .lte('hora_salida', rangoDia.fin)
        .eq('permiso_autorizado', true)
        .order('hora_salida', { ascending: false })
        .limit(5)

      if (actividadSalidas.error) throw actividadSalidas.error

      const actividadIncidencias = await supabase
        .from('incidencias')
        .select(`
          id,
          estudiante_id,
          descripcion,
          fecha_hora,
          estado,
          estudiantes (nombres, apellidos)
        `)
        .eq('institucion_id', perfilData.institucion_id)
        .gte('fecha_hora', rangoDia.inicio)
        .lte('fecha_hora', rangoDia.fin)
        .order('fecha_hora', { ascending: false })
        .limit(5)

      if (actividadIncidencias.error) throw actividadIncidencias.error

      const movimientos = [
        ...(actividadSalidas.data || []).map((item) => ({
          id: `salida-${item.id}`,
          tipo: 'salida',
          hora: item.hora_salida,
          estudiante: `${item.estudiantes?.nombres || ''} ${item.estudiantes?.apellidos || ''}`.trim(),
          detalle: item.hora_regreso ? 'Salida registrada y retorno registrado' : 'Estudiante actualmente fuera del aula',
          abierta: !item.hora_regreso,
        })),
        ...(actividadIncidencias.data || []).map((item) => ({
          id: `incidencia-${item.id}`,
          tipo: 'incidencia',
          hora: item.fecha_hora,
          estudiante: `${item.estudiantes?.nombres || ''} ${item.estudiantes?.apellidos || ''}`.trim(),
          detalle: item.descripcion,
          estado: item.estado,
        })),
      ]
        .sort((a, b) => new Date(b.hora) - new Date(a.hora))
        .slice(0, 8)

      setActividad(movimientos)
    } catch (err) {
      console.error('Error cargando Dashboard administrativo:', err)
      setError(err.message || 'No se pudo cargar el dashboard.')
    } finally {
      setCargando(false)
      setActualizando(false)
    }
  }

  useEffect(() => {
    cargarDashboard()
  }, [user?.id])

  if (cargando) {
    return (
      <div className="dashboard-admin-cargando">
        <RefreshCw size={24} className="girando" />
        <span>Cargando dashboard administrativo...</span>
      </div>
    )
  }

  return (
    <div className="dashboard-admin">
      <header className="dashboard-admin-header">
        <div>
          <div className="dashboard-admin-eyebrow">
            SGCE · {institucion?.nombre || 'Colegio Vancouver'}
          </div>
          <h1>Panel administrativo</h1>
          <p>Resumen operativo general de la institución educativa.</p>
        </div>

        <div className="dashboard-admin-fecha">
          <CalendarDays size={21} />
          <div>
            <strong>{formatearFechaCompleta(fechaActual)}</strong>
            <span>
              {añoEscolar?.nombre || 'Sin año escolar'}
              {periodoActual ? ` · ${periodoActual.nombre}` : ''}
            </span>
          </div>
        </div>
      </header>

      {error && (
        <div className="dashboard-admin-error">
          <AlertTriangle size={19} />
          <span>{error}</span>
        </div>
      )}

      {estadisticas.fueraAula > 0 && (
        <div className="dashboard-admin-alerta">
          <Clock3 size={20} />
          <div>
            <strong>{estadisticas.fueraAula} estudiante(s) fuera del aula</strong>
            <span>Hay salidas autorizadas que todavía no tienen registrado el retorno.</span>
          </div>
          <button type="button" onClick={() => navigate('/admin/reportes')}>
            Revisar
            <ArrowRight size={17} />
          </button>
        </div>
      )}

      <section className="dashboard-admin-stats">
        <article className="dashboard-admin-stat">
          <div className="dashboard-admin-stat-icon azul">
            <Users size={23} />
          </div>
          <div>
            <span>Estudiantes activos</span>
            <strong>{estadisticas.estudiantes}</strong>
            <small>Registro institucional</small>
          </div>
        </article>

        <article className="dashboard-admin-stat">
          <div className="dashboard-admin-stat-icon morado">
            <GraduationCap size={23} />
          </div>
          <div>
            <span>Docentes activos</span>
            <strong>{estadisticas.docentes}</strong>
            <small>Personal docente</small>
          </div>
        </article>

        <article className="dashboard-admin-stat">
          <div className="dashboard-admin-stat-icon verde">
            <ClipboardList size={23} />
          </div>
          <div>
            <span>Matrículas</span>
            <strong>{estadisticas.matriculas}</strong>
            <small>{añoEscolar?.nombre || 'Año actual'}</small>
          </div>
        </article>

        <article className="dashboard-admin-stat">
          <div className="dashboard-admin-stat-icon naranja">
            <School size={23} />
          </div>
          <div>
            <span>Secciones activas</span>
            <strong>{estadisticas.secciones}</strong>
            <small>Configuradas para el año</small>
          </div>
        </article>

        <article className="dashboard-admin-stat">
          <div className="dashboard-admin-stat-icon celeste">
            <Send size={23} />
          </div>
          <div>
            <span>Salidas de hoy</span>
            <strong>{estadisticas.salidasHoy}</strong>
            <small>Autorizadas</small>
          </div>
        </article>

        <article className="dashboard-admin-stat">
          <div className="dashboard-admin-stat-icon rojo">
            <AlertTriangle size={23} />
          </div>
          <div>
            <span>Incidencias de hoy</span>
            <strong>{estadisticas.incidenciasHoy}</strong>
            <small>Registradas</small>
          </div>
        </article>
      </section>

      <section className="dashboard-admin-grid">
        <div className="dashboard-admin-card">
          <div className="dashboard-admin-card-header">
            <div>
              <h2>Accesos administrativos</h2>
              <p>Gestiona rápidamente los principales módulos del sistema.</p>
            </div>
          </div>

          <div className="dashboard-admin-actions">
            <button type="button" onClick={() => navigate('/admin/estudiantes')}>
              <span className="accion-icon azul"><Users size={19} /></span>
              <span>
                <strong>Estudiantes</strong>
                <small>Consultar y gestionar estudiantes</small>
              </span>
              <ArrowRight size={18} />
            </button>

            <button type="button" onClick={() => navigate('/admin/docentes')}>
              <span className="accion-icon morado"><GraduationCap size={19} /></span>
              <span>
                <strong>Docentes</strong>
                <small>Gestionar personal docente</small>
              </span>
              <ArrowRight size={18} />
            </button>

            <button type="button" onClick={() => navigate('/admin/matriculas')}>
              <span className="accion-icon verde"><ClipboardList size={19} /></span>
              <span>
                <strong>Matrículas</strong>
                <small>Consultar el estado de matrícula</small>
              </span>
              <ArrowRight size={18} />
            </button>

            <button type="button" onClick={() => navigate('/admin/grados-secciones')}>
              <span className="accion-icon naranja"><School size={19} /></span>
              <span>
                <strong>Grados y secciones</strong>
                <small>Organización académica del año</small>
              </span>
              <ArrowRight size={18} />
            </button>

            <button type="button" onClick={() => navigate('/admin/años-escolares')}>
              <span className="accion-icon celeste"><CalendarDays size={19} /></span>
              <span>
                <strong>Años escolares</strong>
                <small>Bimestres y unidades académicas</small>
              </span>
              <ArrowRight size={18} />
            </button>

            <button type="button" onClick={() => navigate('/admin/usuarios')}>
              <span className="accion-icon gris"><UserCog size={19} /></span>
              <span>
                <strong>Usuarios</strong>
                <small>Cuentas y accesos al sistema</small>
              </span>
              <ArrowRight size={18} />
            </button>
          </div>
        </div>

        <div className="dashboard-admin-card">
          <div className="dashboard-admin-card-header">
            <div>
              <h2>Actividad institucional</h2>
              <p>Últimos movimientos registrados durante la jornada.</p>
            </div>

            <button
              type="button"
              className="dashboard-admin-refresh"
              onClick={() => cargarDashboard(true)}
              disabled={actualizando}
              title="Actualizar"
            >
              <RefreshCw size={18} className={actualizando ? 'girando' : ''} />
            </button>
          </div>

          <div className="dashboard-admin-actividad">
            {actividad.length === 0 ? (
              <div className="dashboard-admin-vacio">
                <FileText size={28} />
                <span>No hay movimientos registrados hoy.</span>
              </div>
            ) : (
              actividad.map((item) => (
                <div className="dashboard-admin-actividad-item" key={item.id}>
                  <div className={`actividad-icono ${item.tipo}`}>
                    {item.tipo === 'salida'
                      ? <Send size={17} />
                      : <AlertTriangle size={17} />}
                  </div>

                  <div className="actividad-contenido">
                    <strong>{item.estudiante || 'Estudiante'}</strong>
                    <span>{item.detalle}</span>
                  </div>

                  <time>{formatearHora(item.hora)}</time>
                </div>
              ))
            )}
          </div>
        </div>
      </section>

      <section className="dashboard-admin-resumen">
        <div>
          <span>Institución</span>
          <strong>{institucion?.nombre || 'Colegio Vancouver'}</strong>
        </div>
        <div>
          <span>Código modular</span>
          <strong>{institucion?.codigo_modular || 'No registrado'}</strong>
        </div>
        <div>
          <span>Responsable</span>
          <strong>{`${perfil?.nombres || ''} ${perfil?.apellidos || ''}`.trim() || 'Administrador'}</strong>
        </div>
        <div>
          <span>Estado del año</span>
          <strong>{añoEscolar?.estado || 'Sin configurar'}</strong>
        </div>
      </section>
    </div>
  )
}
