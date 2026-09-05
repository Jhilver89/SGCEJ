import { useEffect, useMemo, useState } from 'react'
import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  FileText,
  MapPin,
  RefreshCw,
  Search,
  UserRound,
  X,
} from 'lucide-react'
import * as XLSX from 'xlsx'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import './Incidencias.css'

const PERU_TIMEZONE = 'America/Lima'

function fechaPeru() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: PERU_TIMEZONE }).format(new Date())
}

function formatearFechaHora(valor) {
  if (!valor) return '-'
  return new Intl.DateTimeFormat('es-PE', {
    timeZone: PERU_TIMEZONE,
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(valor))
}

function formatearHora(valor) {
  if (!valor) return '-'
  return new Intl.DateTimeFormat('es-PE', {
    timeZone: PERU_TIMEZONE,
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(valor))
}

function nombreEstudiante(estudiante) {
  return `${estudiante?.apellidos || ''}, ${estudiante?.nombres || ''}`.trim().replace(/^,\s*/, '')
}

function nombreSeccion(seccion, grados) {
  if (!seccion) return '-'
  const grado = grados.find((g) => g.id === seccion.grado_id)
  if (!grado) return seccion.nombre
  if (grado.nivel === 'inicial') return `${grado.numero} años ${seccion.nombre}`
  const nivel = grado.nivel === 'primaria' ? 'Primaria' : 'Secundaria'
  return `${grado.numero}.º ${nivel} ${seccion.nombre}`
}

function Incidencias() {
  const { profile } = useAuth()

  const [añoEscolar, setAñoEscolar] = useState(null)
  const [docenteActualId, setDocenteActualId] = useState(null)
  const [estudiantes, setEstudiantes] = useState([])
  const [matriculas, setMatriculas] = useState([])
  const [grados, setGrados] = useState([])
  const [secciones, setSecciones] = useState([])
  const [categorias, setCategorias] = useState([])
  const [tipos, setTipos] = useState([])
  const [ambientes, setAmbientes] = useState([])
  const [periodos, setPeriodos] = useState([])
  const [unidades, setUnidades] = useState([])

  const [pestaña, setPestaña] = useState('registrar')
  const [fechaHistorial, setFechaHistorial] = useState(fechaPeru())
  const [historial, setHistorial] = useState([])
  const [misIncidencias, setMisIncidencias] = useState([])

  const [busqueda, setBusqueda] = useState('')
  const [mostrarResultados, setMostrarResultados] = useState(false)
  const [estudianteSeleccionado, setEstudianteSeleccionado] = useState(null)
  const [categoriaId, setCategoriaId] = useState('')
  const [tipoId, setTipoId] = useState('')
  const [ambienteId, setAmbienteId] = useState('')
  const [descripcion, setDescripcion] = useState('')
  const [observacion, setObservacion] = useState('')

  const [periodoSeleccionado, setPeriodoSeleccionado] = useState('')
  const [ranking, setRanking] = useState([])
  const [busquedaRanking, setBusquedaRanking] = useState('')
  const [detalleEstudiante, setDetalleEstudiante] = useState(null)
  const [detalleIncidencias, setDetalleIncidencias] = useState([])

  const [cargando, setCargando] = useState(true)
  const [procesando, setProcesando] = useState(false)
  const [cargandoHistorial, setCargandoHistorial] = useState(false)
  const [cargandoRanking, setCargandoRanking] = useState(false)
  const [cargandoDetalle, setCargandoDetalle] = useState(false)
  const [mensaje, setMensaje] = useState('')
  const [error, setError] = useState('')

  const seccionesMap = useMemo(
    () => new Map(secciones.map((item) => [item.id, item])),
    [secciones]
  )

  const gradosMap = useMemo(
    () => new Map(grados.map((item) => [item.id, item])),
    [grados]
  )

  const estudiantesFiltrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase()
    if (!q) return []
    return estudiantes
      .filter((e) => `${e.nombres} ${e.apellidos} ${e.dni || ''}`.toLowerCase().includes(q))
      .slice(0, 12)
  }, [estudiantes, busqueda])

  const tiposFiltrados = useMemo(
    () =>
      tipos
        .filter((t) => t.activo && (!categoriaId || t.categoria_id === categoriaId))
        .sort((a, b) => (a.orden || 999) - (b.orden || 999) || a.nombre.localeCompare(b.nombre)),
    [tipos, categoriaId]
  )

  const seccionEstudiante = estudianteSeleccionado
    ? matriculas.find((m) => m.estudiante_id === estudianteSeleccionado.id)?.seccion_id
    : null

  useEffect(() => {
    cargarDatos()
  }, [profile?.institucion_id])

  useEffect(() => {
    if (categoriaId && tipoId) {
      const valido = tipos.some((t) => t.id === tipoId && t.categoria_id === categoriaId)
      if (!valido) setTipoId('')
    }
  }, [categoriaId, tipoId, tipos])

  useEffect(() => {
    if (pestaña === 'historial' && añoEscolar?.id) cargarHistorial(fechaHistorial)
  }, [pestaña, fechaHistorial, añoEscolar?.id])

  useEffect(() => {
    if (pestaña === 'ranking' && periodoSeleccionado) cargarRanking(periodoSeleccionado)
  }, [pestaña, periodoSeleccionado])

  async function cargarDatos() {
    if (!profile?.institucion_id) return

    setCargando(true)
    setError('')

    try {
      const [
        anioResult,
        docentesResult,
        estudiantesResult,
        matriculasResult,
        gradosResult,
        seccionesResult,
        categoriasResult,
        tiposResult,
        ambientesResult,
        periodosResult,
        unidadesResult,
      ] = await Promise.all([
        supabase
          .from('años_escolares')
          .select('id, nombre, estado')
          .eq('institucion_id', profile.institucion_id)
          .eq('estado', 'activo')
          .order('fecha_inicio', { ascending: false })
          .limit(1)
          .maybeSingle(),

        supabase
          .from('docentes')
          .select('id, perfil_id, nombres, apellidos, activo')
          .eq('institucion_id', profile.institucion_id)
          .eq('perfil_id', profile.id)
          .eq('activo', true)
          .maybeSingle(),

        supabase
          .from('estudiantes')
          .select('id, dni, nombres, apellidos, activo')
          .eq('institucion_id', profile.institucion_id)
          .eq('activo', true)
          .order('apellidos')
          .order('nombres'),

        supabase
          .from('matriculas')
          .select('id, estudiante_id, año_escolar_id, seccion_id, estado')
          .in('estado', ['matriculado', 'promovido']),

        supabase.from('grados').select('id, nivel, numero, nombre').order('nivel').order('numero'),

        supabase
          .from('secciones')
          .select('id, institucion_id, año_escolar_id, grado_id, nombre, activa')
          .eq('institucion_id', profile.institucion_id)
          .eq('activa', true),

        supabase
          .from('categorias_incidencia')
          .select('id, nombre, orden, activo')
          .eq('activo', true)
          .order('orden'),

        supabase
          .from('tipos_incidencia')
          .select('id, nombre, descripcion, categoria_id, orden, activo')
          .eq('activo', true)
          .order('orden'),

        supabase
          .from('ambientes_institucion')
          .select('id, nombre, tipo, seccion_id, activo')
          .eq('institucion_id', profile.institucion_id)
          .eq('activo', true)
          .order('tipo')
          .order('nombre'),

        supabase
          .from('periodos_academicos')
          .select('id, año_escolar_id, numero, nombre, fecha_inicio, fecha_fin, estado')
          .order('numero'),

        supabase
          .from('unidades_academicas')
          .select('id, periodo_id, numero, nombre, fecha_inicio, fecha_fin, estado')
          .order('numero'),
      ])

      const resultados = [
        anioResult,
        docentesResult,
        estudiantesResult,
        matriculasResult,
        gradosResult,
        seccionesResult,
        categoriasResult,
        tiposResult,
        ambientesResult,
        periodosResult,
        unidadesResult,
      ]
      const fallo = resultados.find((r) => r.error)
      if (fallo) throw fallo.error

      const anio = anioResult.data
      if (!anio) throw new Error('No existe un año escolar activo.')

      setAñoEscolar(anio)
      setDocenteActualId(docentesResult.data?.id || null)

      setEstudiantes(estudiantesResult.data || [])
      setMatriculas(
        (matriculasResult.data || []).filter((m) => m.año_escolar_id === anio.id)
      )
      setGrados(gradosResult.data || [])
      setSecciones(
        (seccionesResult.data || []).filter((s) => s.año_escolar_id === anio.id)
      )
      setCategorias(categoriasResult.data || [])
      setTipos(tiposResult.data || [])
      setAmbientes(ambientesResult.data || [])

      const periodosDelAnio = (periodosResult.data || []).filter(
        (p) => p.año_escolar_id === anio.id
      )
      const unidadesDelAnio = (unidadesResult.data || []).filter((u) =>
        periodosDelAnio.some((p) => p.id === u.periodo_id)
      )

      setPeriodos(periodosDelAnio)
      setUnidades(unidadesDelAnio)

      const hoy = fechaPeru()
      const periodoActual =
        periodosDelAnio.find((p) => hoy >= p.fecha_inicio && hoy <= p.fecha_fin) ||
        periodosDelAnio.find((p) => p.estado === 'activo') ||
        periodosDelAnio[0]

      if (periodoActual) setPeriodoSeleccionado(periodoActual.id)

      await cargarMisIncidencias(
        anio.id,
        docentesResult.data?.id || null,
        hoy
      )
    } catch (err) {
      setError(err.message || 'No se pudieron cargar los datos de incidencias.')
    } finally {
      setCargando(false)
    }
  }

  async function cargarMisIncidencias(anioId = añoEscolar?.id, docenteId = docenteActualId, fecha = fechaPeru()) {
    if (!anioId || !docenteId) {
      setMisIncidencias([])
      return
    }

    const inicio = `${fecha}T00:00:00-05:00`
    const fin = `${fecha}T23:59:59.999-05:00`

    const { data, error: errorConsulta } = await supabase
      .from('incidencias')
      .select('id, estudiante_id, seccion_id, docente_id, tipo_incidencia_id, ambiente_id, descripcion, observacion, fecha_hora, estado')
      .eq('institucion_id', profile.institucion_id)
      .eq('año_escolar_id', anioId)
      .eq('docente_id', docenteId)
      .gte('fecha_hora', inicio)
      .lte('fecha_hora', fin)
      .order('fecha_hora', { ascending: false })

    if (errorConsulta) {
      setError(errorConsulta.message)
      return
    }

    setMisIncidencias(enriquecerIncidencias(data || []))
  }

  function enriquecerIncidencias(registros) {
    return registros.map((item) => {
      const estudiante = estudiantes.find((e) => e.id === item.estudiante_id)
      const tipo = tipos.find((t) => t.id === item.tipo_incidencia_id)
      const categoria = categorias.find((c) => c.id === tipo?.categoria_id)
      const ambiente = ambientes.find((a) => a.id === item.ambiente_id)
      const seccion = seccionesMap.get(item.seccion_id)
      const grado = seccion ? gradosMap.get(seccion.grado_id) : null
      return { ...item, estudiante, tipo, categoria, ambiente, seccion, grado }
    })
  }

  function seleccionarEstudiante(estudiante) {
    setEstudianteSeleccionado(estudiante)
    setBusqueda(nombreEstudiante(estudiante))
    setMostrarResultados(false)

    const matricula = matriculas.find((m) => m.estudiante_id === estudiante.id)
    const ambienteAula = ambientes.find(
      (a) => a.tipo === 'aula' && a.seccion_id === matricula?.seccion_id
    )
    setAmbienteId(ambienteAula?.id || '')
  }

  async function registrarIncidencia(e) {
    e.preventDefault()
    setMensaje('')
    setError('')

    if (!estudianteSeleccionado) {
      setError('Selecciona un estudiante.')
      return
    }
    if (!categoriaId) {
      setError('Selecciona una categoría.')
      return
    }
    if (!tipoId) {
      setError('Selecciona una situación.')
      return
    }
    if (!ambienteId) {
      setError('Selecciona el lugar donde ocurrió la incidencia.')
      return
    }
    if (!descripcion.trim()) {
      setError('Describe brevemente la incidencia.')
      return
    }
    if (!docenteActualId) {
      setError('No se encontró el docente asociado a tu usuario.')
      return
    }

    const matricula = matriculas.find((m) => m.estudiante_id === estudianteSeleccionado.id)
    if (!matricula) {
      setError('El estudiante no tiene una matrícula activa en el año escolar.')
      return
    }

    const hoy = fechaPeru()
    const periodo =
      periodos.find((p) => hoy >= p.fecha_inicio && hoy <= p.fecha_fin) ||
      periodos.find((p) => p.estado === 'activo')

    if (!periodo) {
      setError('No se encontró un bimestre vigente para la fecha actual.')
      return
    }

    const unidad =
      unidades.find(
        (u) =>
          u.periodo_id === periodo.id &&
          hoy >= u.fecha_inicio &&
          hoy <= u.fecha_fin
      ) || null

    setProcesando(true)

    try {
      const payload = {
        institucion_id: profile.institucion_id,
        estudiante_id: estudianteSeleccionado.id,
        año_escolar_id: añoEscolar.id,
        periodo_id: periodo.id,
        unidad_id: unidad?.id || null,
        seccion_id: matricula.seccion_id,
        docente_id: docenteActualId,
        tipo_incidencia_id: tipoId,
        ambiente_id: ambienteId,
        descripcion: descripcion.trim(),
        observacion: observacion.trim() || null,
        estado: 'registrada',
      }

      const { error: insertError } = await supabase
        .from('incidencias')
        .insert(payload)

      if (insertError) throw insertError

      setMensaje('Incidencia registrada correctamente.')
      setEstudianteSeleccionado(null)
      setBusqueda('')
      setCategoriaId('')
      setTipoId('')
      setAmbienteId('')
      setDescripcion('')
      setObservacion('')

      await cargarMisIncidencias(añoEscolar.id, docenteActualId, hoy)
    } catch (err) {
      setError(err.message || 'No se pudo registrar la incidencia.')
    } finally {
      setProcesando(false)
    }
  }

  async function cargarHistorial(fecha = fechaHistorial) {
    if (!añoEscolar?.id) return
    setCargandoHistorial(true)
    setError('')

    const inicio = `${fecha}T00:00:00-05:00`
    const fin = `${fecha}T23:59:59.999-05:00`

    try {
      const { data, error: consultaError } = await supabase
        .from('incidencias')
        .select('id, estudiante_id, seccion_id, docente_id, tipo_incidencia_id, ambiente_id, descripcion, observacion, fecha_hora, estado')
        .eq('institucion_id', profile.institucion_id)
        .eq('año_escolar_id', añoEscolar.id)
        .gte('fecha_hora', inicio)
        .lte('fecha_hora', fin)
        .order('fecha_hora', { ascending: false })

      if (consultaError) throw consultaError
      setHistorial(enriquecerIncidencias(data || []))
    } catch (err) {
      setError(err.message || 'No se pudo cargar el historial.')
    } finally {
      setCargandoHistorial(false)
    }
  }

  async function cargarRanking(periodoId) {
    if (!añoEscolar?.id || !periodoId) return

    const periodo = periodos.find((p) => p.id === periodoId)
    if (!periodo) return

    setCargandoRanking(true)
    setError('')

    try {
      const inicio = `${periodo.fecha_inicio}T00:00:00-05:00`
      const fin = `${periodo.fecha_fin}T23:59:59.999-05:00`

      const { data, error: consultaError } = await supabase
        .from('incidencias')
        .select('id, estudiante_id, seccion_id, tipo_incidencia_id, ambiente_id, fecha_hora, estado')
        .eq('institucion_id', profile.institucion_id)
        .eq('año_escolar_id', añoEscolar.id)
        .gte('fecha_hora', inicio)
        .lte('fecha_hora', fin)

      if (consultaError) throw consultaError

      const agrupado = new Map()

      for (const registro of data || []) {
        if (!agrupado.has(registro.estudiante_id)) {
          agrupado.set(registro.estudiante_id, {
            estudiante_id: registro.estudiante_id,
            total_incidencias: 0,
            ultima_incidencia: registro.fecha_hora,
            seccion_id: registro.seccion_id,
          })
        }

        const item = agrupado.get(registro.estudiante_id)
        item.total_incidencias += 1
        if (new Date(registro.fecha_hora) > new Date(item.ultima_incidencia)) {
          item.ultima_incidencia = registro.fecha_hora
          item.seccion_id = registro.seccion_id
        }
      }

      const resultado = [...agrupado.values()]
        .map((item) => {
          const estudiante = estudiantes.find((e) => e.id === item.estudiante_id)
          const seccion = seccionesMap.get(item.seccion_id)
          const grado = seccion ? gradosMap.get(seccion.grado_id) : null
          return { ...item, estudiante, seccion, grado }
        })
        .filter((item) => item.estudiante)
        .sort((a, b) => {
          if (b.total_incidencias !== a.total_incidencias) {
            return b.total_incidencias - a.total_incidencias
          }
          return nombreEstudiante(a.estudiante).localeCompare(nombreEstudiante(b.estudiante))
        })
        .map((item, index) => ({ ...item, posicion: index + 1 }))

      setRanking(resultado)
      setDetalleEstudiante(null)
      setDetalleIncidencias([])
    } catch (err) {
      setError(err.message || 'No se pudo cargar el ranking.')
    } finally {
      setCargandoRanking(false)
    }
  }

  async function cargarDetalleEstudiante(item) {
    const periodo = periodos.find((p) => p.id === periodoSeleccionado)
    if (!periodo || !item?.estudiante_id) return

    setDetalleEstudiante(item)
    setCargandoDetalle(true)
    setError('')

    try {
      const inicio = `${periodo.fecha_inicio}T00:00:00-05:00`
      const fin = `${periodo.fecha_fin}T23:59:59.999-05:00`

      const { data, error: consultaError } = await supabase
        .from('incidencias')
        .select('id, estudiante_id, seccion_id, docente_id, tipo_incidencia_id, ambiente_id, descripcion, observacion, fecha_hora, estado')
        .eq('institucion_id', profile.institucion_id)
        .eq('año_escolar_id', añoEscolar.id)
        .eq('estudiante_id', item.estudiante_id)
        .gte('fecha_hora', inicio)
        .lte('fecha_hora', fin)
        .order('fecha_hora', { ascending: false })

      if (consultaError) throw consultaError

      const docentesIds = [...new Set((data || []).map((x) => x.docente_id).filter(Boolean))]
      let docentes = []

      if (docentesIds.length) {
        const { data: docentesData, error: docentesError } = await supabase
          .from('docentes')
          .select('id, nombres, apellidos')
          .in('id', docentesIds)
        if (docentesError) throw docentesError
        docentes = docentesData || []
      }

      const enriquecidas = enriquecerIncidencias(data || []).map((incidencia) => ({
        ...incidencia,
        docente: docentes.find((d) => d.id === incidencia.docente_id),
      }))

      setDetalleIncidencias(enriquecidas)
    } catch (err) {
      setError(err.message || 'No se pudo cargar el detalle del estudiante.')
    } finally {
      setCargandoDetalle(false)
    }
  }

  function exportarRankingExcel() {
    const periodo = periodos.find((p) => p.id === periodoSeleccionado)
    if (!periodo || !ranking.length) return

    const filas = ranking.map((item) => ({
      Posición: item.posicion,
      DNI: item.estudiante?.dni || '',
      Estudiante: nombreEstudiante(item.estudiante),
      Grado: item.grado?.nombre || item.grado?.numero || '',
      Sección: item.seccion?.nombre || '',
      Incidencias: item.total_incidencias,
      'Última incidencia': formatearFechaHora(item.ultima_incidencia),
    }))

    const hoja = XLSX.utils.json_to_sheet(filas)
    const libro = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(libro, hoja, 'Ranking')
    XLSX.writeFile(libro, `Ranking_incidencias_${periodo.nombre.replace(/\s+/g, '_')}.xlsx`)
  }

  function exportarDetalleExcel() {
    const periodo = periodos.find((p) => p.id === periodoSeleccionado)
    if (!periodo || !detalleEstudiante || !detalleIncidencias.length) return

    const filas = detalleIncidencias.map((item) => ({
      Fecha: formatearFechaHora(item.fecha_hora),
      DNI: item.estudiante?.dni || '',
      Estudiante: nombreEstudiante(item.estudiante),
      Categoría: item.categoria?.nombre || '',
      Situación: item.tipo?.nombre || '',
      Lugar: item.ambiente?.nombre || '',
      'Docente que registró': item.docente
        ? `${item.docente.apellidos}, ${item.docente.nombres}`
        : '',
      Descripción: item.descripcion || '',
      Observación: item.observacion || '',
      Estado: item.estado || '',
    }))

    const hoja = XLSX.utils.json_to_sheet(filas)
    const libro = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(libro, hoja, 'Detalle')
    const apellido = (detalleEstudiante.estudiante?.apellidos || 'estudiante')
      .replace(/\s+/g, '_')
      .replace(/[^a-zA-Z0-9_áéíóúÁÉÍÓÚñÑ]/g, '')
    XLSX.writeFile(libro, `Incidencias_${apellido}_${periodo.nombre.replace(/\s+/g, '_')}.xlsx`)
  }

  function cerrarDetalle() {
    setDetalleEstudiante(null)
    setDetalleIncidencias([])
  }

  if (cargando) {
    return (
      <div className="incidencias-page">
        <div className="incidencias-card incidencias-loading">Cargando módulo de incidencias...</div>
      </div>
    )
  }

  return (
    <div className="incidencias-page">
      <div className="incidencias-header">
        <div>
          <div className="incidencias-kicker">
            <ClipboardList size={17} />
            Convivencia escolar
          </div>
          <h1>Incidencias</h1>
          <p>
            Registro y seguimiento de situaciones ocurridas durante la jornada escolar.
            Año escolar: <strong>{añoEscolar?.nombre}</strong>
          </p>
        </div>
        <button
          type="button"
          className="incidencias-refresh"
          onClick={cargarDatos}
          disabled={cargando}
        >
          <RefreshCw size={17} /> Actualizar
        </button>
      </div>

      {(mensaje || error) && (
        <div className={`incidencias-alert ${error ? 'error' : 'success'}`}>
          {error ? <AlertTriangle size={18} /> : <CheckCircle2 size={18} />}
          <span>{error || mensaje}</span>
          <button type="button" onClick={() => { setError(''); setMensaje('') }} aria-label="Cerrar">
            <X size={17} />
          </button>
        </div>
      )}

      <div className="incidencias-tabs">
        <button
          type="button"
          className={pestaña === 'registrar' ? 'active' : ''}
          onClick={() => setPestaña('registrar')}
        >
          <ClipboardList size={17} /> Registrar incidencia
        </button>
        <button
          type="button"
          className={pestaña === 'historial' ? 'active' : ''}
          onClick={() => setPestaña('historial')}
        >
          <CalendarDays size={17} /> Historial diario
        </button>
        <button
          type="button"
          className={pestaña === 'ranking' ? 'active' : ''}
          onClick={() => setPestaña('ranking')}
        >
          <FileText size={17} /> Ranking por bimestre
        </button>
      </div>

      {pestaña === 'registrar' && (
        <div className="incidencias-grid">
          <section className="incidencias-card">
            <div className="incidencias-card-title">
              <div>
                <h2>Registrar incidencia</h2>
                <p>Selecciona al estudiante y describe objetivamente la situación observada.</p>
              </div>
            </div>

            <form onSubmit={registrarIncidencia} className="incidencias-form">
              <div className="incidencias-field">
                <label>Estudiante</label>
                <div className="incidencias-search">
                  <Search size={18} />
                  <input
                    value={busqueda}
                    onChange={(e) => {
                      setBusqueda(e.target.value)
                      setMostrarResultados(true)
                      if (!e.target.value.trim()) setEstudianteSeleccionado(null)
                    }}
                    onFocus={() => setMostrarResultados(true)}
                    placeholder="Buscar por nombre, apellido o DNI..."
                    autoComplete="off"
                  />
                  {estudianteSeleccionado && (
                    <button
                      type="button"
                      onClick={() => {
                        setEstudianteSeleccionado(null)
                        setBusqueda('')
                        setAmbienteId('')
                      }}
                      aria-label="Quitar estudiante"
                    >
                      <X size={17} />
                    </button>
                  )}
                </div>

                {mostrarResultados && busqueda.trim() && !estudianteSeleccionado && (
                  <div className="incidencias-resultados">
                    {estudiantesFiltrados.map((estudiante) => (
                      <button
                        type="button"
                        key={estudiante.id}
                        onClick={() => seleccionarEstudiante(estudiante)}
                      >
                        <UserRound size={17} />
                        <span>
                          <strong>{nombreEstudiante(estudiante)}</strong>
                          <small>DNI: {estudiante.dni || 'Sin DNI'}</small>
                        </span>
                      </button>
                    ))}
                    {!estudiantesFiltrados.length && <div className="incidencias-sin-resultados">No se encontraron estudiantes.</div>}
                  </div>
                )}
              </div>

              {estudianteSeleccionado && (
                <div className="incidencias-estudiante-resumen">
                  <div>
                    <span>Estudiante</span>
                    <strong>{nombreEstudiante(estudianteSeleccionado)}</strong>
                  </div>
                  <div>
                    <span>Sección</span>
                    <strong>
                      {nombreSeccion(
                        seccionesMap.get(seccionEstudiante),
                        grados
                      )}
                    </strong>
                  </div>
                </div>
              )}

              <div className="incidencias-form-grid">
                <div className="incidencias-field">
                  <label>Categoría</label>
                  <select value={categoriaId} onChange={(e) => setCategoriaId(e.target.value)}>
                    <option value="">Seleccionar categoría...</option>
                    {categorias.map((categoria) => (
                      <option key={categoria.id} value={categoria.id}>
                        {categoria.nombre}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="incidencias-field">
                  <label>Situación</label>
                  <select value={tipoId} onChange={(e) => setTipoId(e.target.value)} disabled={!categoriaId}>
                    <option value="">
                      {categoriaId ? 'Seleccionar situación...' : 'Primero selecciona una categoría'}
                    </option>
                    {tiposFiltrados.map((tipo) => (
                      <option key={tipo.id} value={tipo.id}>
                        {tipo.nombre}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="incidencias-field">
                <label>Lugar donde ocurrió</label>
                <div className="incidencias-lugar-help">
                  <MapPin size={16} />
                  <span>
                    El aula del estudiante se selecciona automáticamente cuando corresponde.
                    Puedes cambiarla si la situación ocurrió en otro ambiente.
                  </span>
                </div>
                <select value={ambienteId} onChange={(e) => setAmbienteId(e.target.value)}>
                  <option value="">Seleccionar lugar...</option>
                  <optgroup label="Aulas">
                    {ambientes
                      .filter((a) => a.tipo === 'aula')
                      .map((ambiente) => (
                        <option key={ambiente.id} value={ambiente.id}>
                          {ambiente.nombre}
                        </option>
                      ))}
                  </optgroup>
                  <optgroup label="Otros ambientes">
                    {ambientes
                      .filter((a) => a.tipo !== 'aula')
                      .map((ambiente) => (
                        <option key={ambiente.id} value={ambiente.id}>
                          {ambiente.nombre}
                        </option>
                      ))}
                  </optgroup>
                </select>
              </div>

              <div className="incidencias-field">
                <label>Descripción de la incidencia</label>
                <textarea
                  value={descripcion}
                  onChange={(e) => setDescripcion(e.target.value)}
                  rows={4}
                  placeholder="Describe de manera objetiva qué ocurrió..."
                />
              </div>

              <div className="incidencias-field">
                <label>Observación <span>(opcional)</span></label>
                <textarea
                  value={observacion}
                  onChange={(e) => setObservacion(e.target.value)}
                  rows={3}
                  placeholder="Información adicional, acciones realizadas u observaciones..."
                />
              </div>

              <button type="submit" className="incidencias-primary" disabled={procesando}>
                <ClipboardList size={18} />
                {procesando ? 'Registrando...' : 'Registrar incidencia'}
              </button>
            </form>
          </section>

          <section className="incidencias-card">
            <div className="incidencias-card-title">
              <div>
                <h2>Mis incidencias de hoy</h2>
                <p>Solo aparecen las incidencias registradas por tu usuario.</p>
              </div>
              <span className="incidencias-count">{misIncidencias.length}</span>
            </div>

            <div className="incidencias-lista">
              {!misIncidencias.length && (
                <div className="incidencias-vacio">
                  <ClipboardList size={30} />
                  <strong>No tienes incidencias registradas hoy.</strong>
                  <span>Las nuevas incidencias aparecerán aquí.</span>
                </div>
              )}

              {misIncidencias.map((item) => (
                <article className="incidencia-item" key={item.id}>
                  <div className="incidencia-item-top">
                    <div>
                      <strong>{nombreEstudiante(item.estudiante)}</strong>
                      <small>{formatearHora(item.fecha_hora)} · {item.ambiente?.nombre || 'Sin lugar'}</small>
                    </div>
                    <span className="incidencia-estado">{item.estado}</span>
                  </div>
                  <div className="incidencia-tags">
                    <span>{item.categoria?.nombre || 'Sin categoría'}</span>
                    <span>{item.tipo?.nombre || 'Sin situación'}</span>
                  </div>
                  <p>{item.descripcion}</p>
                  {item.observacion && <div className="incidencia-observacion">{item.observacion}</div>}
                </article>
              ))}
            </div>
          </section>
        </div>
      )}

      {pestaña === 'historial' && (
        <section className="incidencias-card">
          <div className="incidencias-toolbar">
            <div>
              <h2>Historial diario</h2>
              <p>Consulta todas las incidencias registradas en la institución para la fecha seleccionada.</p>
            </div>
            <div className="incidencias-toolbar-actions">
              <label>
                Fecha
                <input
                  type="date"
                  value={fechaHistorial}
                  onChange={(e) => setFechaHistorial(e.target.value)}
                />
              </label>
              <button
                type="button"
                className="incidencias-secondary"
                onClick={() => cargarHistorial(fechaHistorial)}
                disabled={cargandoHistorial}
              >
                <RefreshCw size={17} /> Actualizar
              </button>
            </div>
          </div>

          {cargandoHistorial ? (
            <div className="incidencias-loading">Cargando historial...</div>
          ) : (
            <div className="incidencias-tabla-wrap">
              <table className="incidencias-tabla">
                <thead>
                  <tr>
                    <th>Hora</th>
                    <th>Estudiante</th>
                    <th>Sección</th>
                    <th>Categoría</th>
                    <th>Situación</th>
                    <th>Lugar</th>
                    <th>Docente</th>
                    <th>Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {!historial.length && (
                    <tr>
                      <td colSpan="8" className="incidencias-tabla-vacia">No hay incidencias registradas para esta fecha.</td>
                    </tr>
                  )}
                  {historial.map((item) => (
                    <tr key={item.id}>
                      <td>{formatearHora(item.fecha_hora)}</td>
                      <td>
                        <strong>{nombreEstudiante(item.estudiante)}</strong>
                        <small>{item.estudiante?.dni || 'Sin DNI'}</small>
                      </td>
                      <td>{nombreSeccion(item.seccion, grados)}</td>
                      <td>{item.categoria?.nombre || '-'}</td>
                      <td>{item.tipo?.nombre || '-'}</td>
                      <td>{item.ambiente?.nombre || '-'}</td>
                      <td>{item.docente_id ? 'Docente registrado' : '-'}</td>
                      <td><span className="incidencia-estado">{item.estado}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {pestaña === 'ranking' && (
        <div className="incidencias-ranking">
          <section className="incidencias-card">
            <div className="incidencias-toolbar">
              <div>
                <h2>Ranking de incidencias</h2>
                <p>Ranking de estudiantes según la cantidad de incidencias registradas en el bimestre.</p>
              </div>
              <div className="incidencias-toolbar-actions">
                <label>
                  Bimestre
                  <select value={periodoSeleccionado} onChange={(e) => setPeriodoSeleccionado(e.target.value)}>
                    {periodos.map((periodo) => (
                      <option key={periodo.id} value={periodo.id}>{periodo.nombre}</option>
                    ))}
                  </select>
                </label>
                <button
                  type="button"
                  className="incidencias-secondary"
                  onClick={() => cargarRanking(periodoSeleccionado)}
                  disabled={cargandoRanking}
                >
                  <RefreshCw size={17} /> Actualizar
                </button>
                <button
                  type="button"
                  className="incidencias-primary compact"
                  onClick={exportarRankingExcel}
                  disabled={!ranking.length}
                >
                  <FileText size={17} /> Descargar ranking
                </button>
              </div>
            </div>

            <div className="incidencias-ranking-summary">
              <strong>{ranking.length}</strong>
              <span>estudiantes con incidencias en este bimestre</span>
            </div>

            <div className="incidencias-search ranking">
              <Search size={18} />
              <input
                value={busquedaRanking}
                onChange={(e) => setBusquedaRanking(e.target.value)}
                placeholder="Buscar estudiante por nombre, apellido o DNI..."
              />
            </div>

            {cargandoRanking ? (
              <div className="incidencias-loading">Cargando ranking...</div>
            ) : (
              <div className="incidencias-ranking-table">
                <div className="ranking-row header">
                  <span>#</span>
                  <span>Estudiante</span>
                  <span>Sección</span>
                  <span>Incidencias</span>
                  <span>Acción</span>
                </div>

                {ranking
                  .filter((item) => {
                    const q = busquedaRanking.trim().toLowerCase()
                    if (!q) return true
                    return `${item.estudiante?.nombres || ''} ${item.estudiante?.apellidos || ''} ${item.estudiante?.dni || ''}`
                      .toLowerCase()
                      .includes(q)
                  })
                  .map((item) => (
                    <div className="ranking-row" key={item.estudiante_id}>
                      <span className="ranking-posicion">{item.posicion}</span>
                      <span>
                        <strong>{nombreEstudiante(item.estudiante)}</strong>
                        <small>DNI: {item.estudiante?.dni || 'Sin DNI'}</small>
                      </span>
                      <span>{nombreSeccion(item.seccion, grados)}</span>
                      <span className="ranking-total">{item.total_incidencias}</span>
                      <button type="button" onClick={() => cargarDetalleEstudiante(item)}>
                        Ver detalle
                      </button>
                    </div>
                  ))}

                {!ranking.length && (
                  <div className="incidencias-tabla-vacia">No hay incidencias registradas en este bimestre.</div>
                )}
              </div>
            )}
          </section>

          {detalleEstudiante && (
            <section className="incidencias-card detalle-card">
              <div className="incidencias-toolbar">
                <div>
                  <h2>Detalle del estudiante</h2>
                  <p>{nombreEstudiante(detalleEstudiante.estudiante)}</p>
                </div>
                <div className="incidencias-toolbar-actions">
                  <button
                    type="button"
                    className="incidencias-primary compact"
                    onClick={exportarDetalleExcel}
                    disabled={!detalleIncidencias.length}
                  >
                    <FileText size={17} /> Descargar detalle
                  </button>
                  <button type="button" className="incidencias-icon-button" onClick={cerrarDetalle} aria-label="Cerrar detalle">
                    <X size={18} />
                  </button>
                </div>
              </div>

              <div className="detalle-estudiante-resumen">
                <div><span>DNI</span><strong>{detalleEstudiante.estudiante?.dni || 'Sin DNI'}</strong></div>
                <div><span>Sección</span><strong>{nombreSeccion(detalleEstudiante.seccion, grados)}</strong></div>
                <div><span>Total</span><strong>{detalleIncidencias.length}</strong></div>
              </div>

              {cargandoDetalle ? (
                <div className="incidencias-loading">Cargando detalle...</div>
              ) : (
                <div className="detalle-lista">
                  {detalleIncidencias.map((item) => (
                    <article className="detalle-incidencia" key={item.id}>
                      <div className="detalle-incidencia-top">
                        <strong>{item.tipo?.nombre || '-'}</strong>
                        <span>{formatearFechaHora(item.fecha_hora)}</span>
                      </div>
                      <div className="incidencias-tags">
                        <span>{item.categoria?.nombre || '-'}</span>
                        <span><MapPin size={13} /> {item.ambiente?.nombre || '-'}</span>
                      </div>
                      <p>{item.descripcion}</p>
                      {item.observacion && <div className="incidencia-observacion">{item.observacion}</div>}
                      <small>
                        Registrado por:{' '}
                        {item.docente ? `${item.docente.apellidos}, ${item.docente.nombres}` : 'Docente no identificado'}
                      </small>
                    </article>
                  ))}
                </div>
              )}
            </section>
          )}
        </div>
      )}
    </div>
  )
}

export default Incidencias
