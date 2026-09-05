import { useEffect, useMemo, useState } from 'react'
import {
  BarChart3,
  CalendarDays,
  Search,
  RefreshCw,
  Download,
  FileText,
  Send,
  AlertTriangle,
  Users,
  X,
} from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import * as XLSX from 'xlsx'
import './Reportes.css'

const TIME_ZONE = 'America/Lima'

function fechaPeru() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())
}

function formatearFecha(valor) {
  if (!valor) return '—'
  return new Intl.DateTimeFormat('es-PE', {
    timeZone: TIME_ZONE,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(valor))
}

function formatearHora(valor) {
  if (!valor) return '—'
  return new Intl.DateTimeFormat('es-PE', {
    timeZone: TIME_ZONE,
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(valor))
}

function rangoPeriodo(periodo) {
  if (!periodo) return null
  return {
    inicio: `${periodo.fecha_inicio}T00:00:00-05:00`,
    fin: `${periodo.fecha_fin}T23:59:59.999-05:00`,
  }
}

export default function Reportes() {
  const { user } = useAuth()

  const [perfil, setPerfil] = useState(null)
  const [añoEscolar, setAñoEscolar] = useState(null)
  const [periodos, setPeriodos] = useState([])
  const [periodoId, setPeriodoId] = useState('')
  const [tipo, setTipo] = useState('salidas')
  const [salidas, setSalidas] = useState([])
  const [incidencias, setIncidencias] = useState([])
  const [estudiantes, setEstudiantes] = useState([])
  const [secciones, setSecciones] = useState([])
  const [busqueda, setBusqueda] = useState('')
  const [seccionFiltro, setSeccionFiltro] = useState('')
  const [estudianteSeleccionado, setEstudianteSeleccionado] = useState(null)
  const [detalleEstudiante, setDetalleEstudiante] = useState([])
  const [cargando, setCargando] = useState(true)
  const [actualizando, setActualizando] = useState(false)
  const [cargandoDetalle, setCargandoDetalle] = useState(false)
  const [error, setError] = useState('')

  const esAdmin = perfil?.rol === 'administrador'

  async function cargarBase() {
    if (!user?.id) return

    setCargando(true)
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

      const { data: añoData, error: añoError } = await supabase
        .from('años_escolares')
        .select('id, nombre, fecha_inicio, fecha_fin, estado')
        .eq('institucion_id', perfilData.institucion_id)
        .order('fecha_inicio', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (añoError) throw añoError
      setAñoEscolar(añoData)

      if (!añoData?.id) return

      const { data: periodosData, error: periodosError } = await supabase
        .from('periodos_academicos')
        .select('id, numero, nombre, fecha_inicio, fecha_fin, estado')
        .eq('año_escolar_id', añoData.id)
        .order('numero', { ascending: true })

      if (periodosError) throw periodosError

      setPeriodos(periodosData || [])

      const hoy = fechaPeru()
      const periodoActual =
        (periodosData || []).find(
          (item) => item.fecha_inicio <= hoy && item.fecha_fin >= hoy
        ) || (periodosData || [])[0]

      setPeriodoId(periodoActual?.id || '')

      const { data: estudiantesData, error: estudiantesError } = await supabase
        .from('estudiantes')
        .select('id, dni, nombres, apellidos, activo')
        .eq('institucion_id', perfilData.institucion_id)
        .eq('activo', true)
        .order('apellidos', { ascending: true })
        .order('nombres', { ascending: true })

      if (estudiantesError) throw estudiantesError
      setEstudiantes(estudiantesData || [])

      const { data: seccionesData, error: seccionesError } = await supabase
        .from('secciones')
        .select(`
          id,
          nombre,
          grado_id,
          grados (nivel, numero, nombre)
        `)
        .eq('institucion_id', perfilData.institucion_id)
        .eq('año_escolar_id', añoData.id)
        .eq('activa', true)
        .order('grado_id', { ascending: true })
        .order('nombre', { ascending: true })

      if (seccionesError) throw seccionesError
      setSecciones(seccionesData || [])
    } catch (err) {
      console.error('Error cargando reportes:', err)
      setError(err.message || 'No se pudo cargar el módulo de reportes.')
    } finally {
      setCargando(false)
    }
  }

  async function cargarDatos(periodoSeleccionado = periodoId, refresco = false) {
    if (!perfil?.institucion_id || !añoEscolar?.id || !periodoSeleccionado) return

    if (refresco) setActualizando(true)
    setError('')

    try {
      const periodo = periodos.find((item) => item.id === periodoSeleccionado)
      const rango = rangoPeriodo(periodo)

      if (!rango) return

      let salidasQuery = supabase
        .from('salidas')
        .select(`
          id,
          estudiante_id,
          seccion_id,
          docente_id,
          motivo_id,
          hora_salida,
          hora_regreso,
          permiso_autorizado,
          alerta_frecuencia,
          numero_salida_dia,
          observacion,
          estudiantes (nombres, apellidos, dni),
          secciones (
            nombre,
            grados (nivel, numero, nombre)
          ),
          motivos_salida (nombre)
        `)
        .eq('institucion_id', perfil.institucion_id)
        .gte('hora_salida', rango.inicio)
        .lte('hora_salida', rango.fin)
        .order('hora_salida', { ascending: false })

      if (!esAdmin) {
        const { data: docente } = await supabase
          .from('docentes')
          .select('id')
          .eq('institucion_id', perfil.institucion_id)
          .eq('perfil_id', user.id)
          .eq('activo', true)
          .maybeSingle()

        if (docente?.id) {
          salidasQuery = salidasQuery.eq('docente_id', docente.id)
        } else {
          salidasQuery = salidasQuery.eq('docente_id', '00000000-0000-0000-0000-000000000000')
        }
      }

      const { data: salidasData, error: salidasError } = await salidasQuery
      if (salidasError) throw salidasError

      let incidenciasQuery = supabase
        .from('incidencias')
        .select(`
          id,
          estudiante_id,
          seccion_id,
          docente_id,
          tipo_incidencia_id,
          descripcion,
          observacion,
          fecha_hora,
          estado,
          estudiantes (nombres, apellidos, dni),
          secciones (
            nombre,
            grados (nivel, numero, nombre)
          ),
          tipos_incidencia (
            nombre,
            categoria_id,
            categorias_incidencia (nombre)
          )
        `)
        .eq('institucion_id', perfil.institucion_id)
        .gte('fecha_hora', rango.inicio)
        .lte('fecha_hora', rango.fin)
        .order('fecha_hora', { ascending: false })

      if (!esAdmin) {
        const { data: docente } = await supabase
          .from('docentes')
          .select('id')
          .eq('institucion_id', perfil.institucion_id)
          .eq('perfil_id', user.id)
          .eq('activo', true)
          .maybeSingle()

        if (docente?.id) {
          incidenciasQuery = incidenciasQuery.eq('docente_id', docente.id)
        } else {
          incidenciasQuery = incidenciasQuery.eq('docente_id', '00000000-0000-0000-0000-000000000000')
        }
      }

      const { data: incidenciasData, error: incidenciasError } = await incidenciasQuery
      if (incidenciasError) throw incidenciasError

      setSalidas(salidasData || [])
      setIncidencias(incidenciasData || [])
    } catch (err) {
      console.error('Error cargando datos de reportes:', err)
      setError(err.message || 'No se pudieron cargar los datos del reporte.')
    } finally {
      setActualizando(false)
    }
  }

  useEffect(() => {
    cargarBase()
  }, [user?.id])

  useEffect(() => {
    if (perfil && añoEscolar && periodoId) {
      cargarDatos(periodoId)
    }
  }, [perfil?.id, añoEscolar?.id, periodoId, esAdmin])

  const seccionesOrdenadas = useMemo(() => {
    return [...secciones].sort((a, b) => {
      const ga = a.grados?.numero ?? 999
      const gb = b.grados?.numero ?? 999
      const na = a.grados?.nivel || ''
      const nb = b.grados?.nivel || ''
      return `${na}${String(ga).padStart(2, '0')}${a.nombre}`.localeCompare(
        `${nb}${String(gb).padStart(2, '0')}${b.nombre}`
      )
    })
  }, [secciones])

  const datosActuales = tipo === 'salidas' ? salidas : incidencias

  const estudiantesRanking = useMemo(() => {
    const mapa = new Map()

    datosActuales.forEach((item) => {
      if (tipo === 'salidas' && item.permiso_autorizado !== true) return

      const estudiante = item.estudiantes
      if (!estudiante?.id && !item.estudiante_id) return

      const id = item.estudiante_id
      const actual = mapa.get(id) || {
        estudiante_id: id,
        dni: estudiante?.dni || '',
        nombres: estudiante?.nombres || '',
        apellidos: estudiante?.apellidos || '',
        seccion: item.secciones?.nombre || '—',
        grado: item.secciones?.grados?.nombre || '—',
        nivel: item.secciones?.grados?.nivel || '',
        total: 0,
      }

      actual.total += 1
      mapa.set(id, actual)
    })

    return [...mapa.values()].sort((a, b) => {
      if (b.total !== a.total) return b.total - a.total
      return `${a.apellidos} ${a.nombres}`.localeCompare(
        `${b.apellidos} ${b.nombres}`
      )
    })
  }, [datosActuales, tipo])

  const rankingFiltrado = useMemo(() => {
    const termino = busqueda.trim().toLowerCase()

    return estudiantesRanking.filter((item) => {
      const texto = `${item.nombres} ${item.apellidos} ${item.dni}`.toLowerCase()
      const coincideBusqueda = !termino || texto.includes(termino)

      const seccionCompleta = `${item.grado} ${item.seccion}`.toLowerCase()
      const coincideSeccion =
        !seccionFiltro || seccionCompleta === seccionFiltro.toLowerCase()

      return coincideBusqueda && coincideSeccion
    })
  }, [estudiantesRanking, busqueda, seccionFiltro])

  const totalRegistros = datosActuales.length
  const totalAutorizadas = salidas.filter((item) => item.permiso_autorizado === true).length
  const totalAbiertas = salidas.filter(
    (item) => item.permiso_autorizado === true && item.hora_salida && !item.hora_regreso
  ).length

  async function verDetalle(item) {
    setEstudianteSeleccionado(item)
    setDetalleEstudiante([])
    setCargandoDetalle(true)

    try {
      const periodo = periodos.find((p) => p.id === periodoId)
      const rango = rangoPeriodo(periodo)
      if (!rango) return

      if (tipo === 'salidas') {
        let query = supabase
          .from('salidas')
          .select(`
            id,
            hora_salida,
            hora_regreso,
            permiso_autorizado,
            alerta_frecuencia,
            numero_salida_dia,
            observacion,
            estudiantes (nombres, apellidos, dni),
            secciones (nombre, grados (nivel, numero, nombre)),
            motivos_salida (nombre)
          `)
          .eq('institucion_id', perfil.institucion_id)
          .eq('estudiante_id', item.estudiante_id)
          .gte('created_at', rango.inicio)
          .lte('created_at', rango.fin)
          .order('created_at', { ascending: false })

        if (!esAdmin) {
          const { data: docente } = await supabase
            .from('docentes')
            .select('id')
            .eq('institucion_id', perfil.institucion_id)
            .eq('perfil_id', user.id)
            .eq('activo', true)
            .maybeSingle()

          if (docente?.id) query = query.eq('docente_id', docente.id)
        }

        const { data, error: detalleError } = await query
        if (detalleError) throw detalleError
        setDetalleEstudiante(data || [])
      } else {
        let query = supabase
          .from('incidencias')
          .select(`
            id,
            fecha_hora,
            descripcion,
            observacion,
            estado,
            estudiantes (nombres, apellidos, dni),
            secciones (nombre, grados (nivel, numero, nombre)),
            tipos_incidencia (nombre, categorias_incidencia (nombre))
          `)
          .eq('institucion_id', perfil.institucion_id)
          .eq('estudiante_id', item.estudiante_id)
          .gte('fecha_hora', rango.inicio)
          .lte('fecha_hora', rango.fin)
          .order('fecha_hora', { ascending: false })

        if (!esAdmin) {
          const { data: docente } = await supabase
            .from('docentes')
            .select('id')
            .eq('institucion_id', perfil.institucion_id)
            .eq('perfil_id', user.id)
            .eq('activo', true)
            .maybeSingle()

          if (docente?.id) query = query.eq('docente_id', docente.id)
        }

        const { data, error: detalleError } = await query
        if (detalleError) throw detalleError
        setDetalleEstudiante(data || [])
      }
    } catch (err) {
      setError(err.message || 'No se pudo cargar el detalle del estudiante.')
    } finally {
      setCargandoDetalle(false)
    }
  }

  function exportarExcel() {
    const periodo = periodos.find((p) => p.id === periodoId)
    const filas = rankingFiltrado.map((item, index) => ({
      Puesto: index + 1,
      DNI: item.dni,
      Estudiante: `${item.apellidos}, ${item.nombres}`,
      Nivel: item.nivel,
      Grado: item.grado,
      Seccion: item.seccion,
      Cantidad: item.total,
    }))

    const libro = XLSX.utils.book_new()
    const hoja = XLSX.utils.json_to_sheet(filas)
    XLSX.utils.book_append_sheet(libro, hoja, tipo === 'salidas' ? 'Salidas' : 'Incidencias')

    const nombrePeriodo = (periodo?.nombre || 'Periodo').replace(/\s+/g, '_')
    XLSX.writeFile(
      libro,
      `Reporte_${tipo}_${nombrePeriodo}.xlsx`
    )
  }

  function exportarDetalle() {
    if (!estudianteSeleccionado) return

    const filas = detalleEstudiante.map((item) => {
      if (tipo === 'salidas') {
        return {
          Fecha: formatearFecha(item.hora_salida),
          Salida: formatearHora(item.hora_salida),
          Retorno: formatearHora(item.hora_regreso),
          Destino: item.motivos_salida?.nombre || '—',
          Grado: item.secciones?.grados?.nombre || '—',
          Seccion: item.secciones?.nombre || '—',
          Estado: item.permiso_autorizado === true
            ? 'Autorizada'
            : item.permiso_autorizado === false
              ? 'Rechazada'
              : 'Pendiente',
          Observacion: item.observacion || '',
        }
      }

      return {
        Fecha: formatearFecha(item.fecha_hora),
        Hora: formatearHora(item.fecha_hora),
        Categoria: item.tipos_incidencia?.categorias_incidencia?.nombre || '—',
        Tipo: item.tipos_incidencia?.nombre || '—',
        Descripcion: item.descripcion,
        Estado: item.estado,
        Observacion: item.observacion || '',
        Grado: item.secciones?.grados?.nombre || '—',
        Seccion: item.secciones?.nombre || '—',
      }
    })

    const libro = XLSX.utils.book_new()
    const hoja = XLSX.utils.json_to_sheet(filas)
    XLSX.utils.book_append_sheet(libro, hoja, 'Detalle')

    const apellido = estudianteSeleccionado.apellidos.replace(/\s+/g, '_')
    const periodo = periodos.find((p) => p.id === periodoId)
    const nombrePeriodo = (periodo?.nombre || 'Periodo').replace(/\s+/g, '_')

    XLSX.writeFile(
      libro,
      `Detalle_${tipo}_${apellido}_${nombrePeriodo}.xlsx`
    )
  }

  if (cargando) {
    return (
      <div className="reportes-cargando">
        <RefreshCw size={24} className="girando" />
        <span>Cargando reportes...</span>
      </div>
    )
  }

  const periodoSeleccionado = periodos.find((p) => p.id === periodoId)

  return (
    <div className="reportes">
      <header className="reportes-header">
        <div>
          <div className="reportes-eyebrow">
            SGCE · {esAdmin ? 'ADMINISTRACIÓN' : 'DOCENTE'}
          </div>
          <h1>Reportes</h1>
          <p>
            {esAdmin
              ? 'Consulta y descarga información operativa de toda la institución.'
              : 'Consulta y descarga tu información operativa registrada.'}
          </p>
        </div>

        <div className="reportes-contexto">
          <CalendarDays size={20} />
          <div>
            <strong>{añoEscolar?.nombre || 'Sin año escolar'}</strong>
            <span>{periodoSeleccionado?.nombre || 'Sin periodo seleccionado'}</span>
          </div>
        </div>
      </header>

      {error && (
        <div className="reportes-error">
          <AlertTriangle size={18} />
          <span>{error}</span>
        </div>
      )}

      <div className="reportes-toolbar">
        <div className="reportes-tipo">
          <button
            type="button"
            className={tipo === 'salidas' ? 'activo' : ''}
            onClick={() => {
              setTipo('salidas')
              setBusqueda('')
              setSeccionFiltro('')
              setEstudianteSeleccionado(null)
            }}
          >
            <Send size={17} />
            Salidas
          </button>

          <button
            type="button"
            className={tipo === 'incidencias' ? 'activo' : ''}
            onClick={() => {
              setTipo('incidencias')
              setBusqueda('')
              setSeccionFiltro('')
              setEstudianteSeleccionado(null)
            }}
          >
            <AlertTriangle size={17} />
            Incidencias
          </button>
        </div>

        <select
          value={periodoId}
          onChange={(e) => setPeriodoId(e.target.value)}
          aria-label="Periodo académico"
        >
          {periodos.map((periodo) => (
            <option key={periodo.id} value={periodo.id}>
              {periodo.nombre}
            </option>
          ))}
        </select>

        <div className="reportes-busqueda">
          <Search size={17} />
          <input
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar estudiante o DNI..."
          />
        </div>

        <select
          value={seccionFiltro}
          onChange={(e) => setSeccionFiltro(e.target.value)}
          aria-label="Filtrar sección"
        >
          <option value="">Todas las secciones</option>
          {seccionesOrdenadas.map((seccion) => (
            <option
              key={seccion.id}
              value={`${seccion.grados?.nombre || ''} ${seccion.nombre || ''}`}
            >
              {seccion.grados?.nombre || 'Grado'} — Sección {seccion.nombre}
            </option>
          ))}
        </select>

        <button
          type="button"
          className="reportes-boton-secundario"
          onClick={() => cargarDatos(periodoId, true)}
          disabled={actualizando}
          title="Actualizar"
        >
          <RefreshCw size={17} className={actualizando ? 'girando' : ''} />
        </button>

        <button
          type="button"
          className="reportes-boton-exportar"
          onClick={exportarExcel}
          disabled={rankingFiltrado.length === 0}
        >
          <Download size={17} />
          Excel
        </button>
      </div>

      <section className="reportes-resumen">
        <div>
          <span>{tipo === 'salidas' ? 'Salidas registradas' : 'Incidencias registradas'}</span>
          <strong>{totalRegistros}</strong>
        </div>

        {tipo === 'salidas' && (
          <>
            <div>
              <span>Salidas autorizadas</span>
              <strong>{totalAutorizadas}</strong>
            </div>
            <div>
              <span>Actualmente fuera</span>
              <strong>{totalAbiertas}</strong>
            </div>
          </>
        )}

        <div>
          <span>Estudiantes involucrados</span>
          <strong>{estudiantesRanking.length}</strong>
        </div>
      </section>

      <section className="reportes-panel">
        <div className="reportes-panel-header">
          <div>
            <h2>
              <BarChart3 size={19} />
              Ranking por {tipo === 'salidas' ? 'salidas' : 'incidencias'}
            </h2>
            <p>
              {periodoSeleccionado?.nombre || 'Periodo'} · {añoEscolar?.nombre || ''}
            </p>
          </div>

          <span className="reportes-total">
            {rankingFiltrado.length} estudiante(s)
          </span>
        </div>

        {rankingFiltrado.length === 0 ? (
          <div className="reportes-vacio">
            <FileText size={34} />
            <strong>No hay datos para mostrar</strong>
            <span>Prueba otro periodo o cambia los filtros.</span>
          </div>
        ) : (
          <div className="reportes-tabla-wrap">
            <table className="reportes-tabla">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Estudiante</th>
                  <th>DNI</th>
                  <th>Grado</th>
                  <th>Sección</th>
                  <th>Cantidad</th>
                  <th></th>
                </tr>
              </thead>

              <tbody>
                {rankingFiltrado.map((item, index) => (
                  <tr key={item.estudiante_id}>
                    <td className="puesto">{index + 1}</td>
                    <td>
                      <strong>{item.apellidos}, {item.nombres}</strong>
                    </td>
                    <td>{item.dni || '—'}</td>
                    <td>{item.grado}</td>
                    <td>{item.seccion}</td>
                    <td>
                      <span className="cantidad">{item.total}</span>
                    </td>
                    <td>
                      <button
                        type="button"
                        className="btn-detalle"
                        onClick={() => verDetalle(item)}
                      >
                        Ver detalle
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {estudianteSeleccionado && (
        <section className="reportes-detalle">
          <div className="reportes-detalle-header">
            <div>
              <div className="reportes-eyebrow">DETALLE DEL ESTUDIANTE</div>
              <h2>
                {estudianteSeleccionado.apellidos}, {estudianteSeleccionado.nombres}
              </h2>
              <p>
                DNI: {estudianteSeleccionado.dni || '—'} ·
                {' '}{estudianteSeleccionado.grado} ·
                {' '}Sección {estudianteSeleccionado.seccion}
              </p>
            </div>

            <div className="reportes-detalle-acciones">
              <button
                type="button"
                className="reportes-boton-exportar"
                onClick={exportarDetalle}
                disabled={cargandoDetalle || detalleEstudiante.length === 0}
              >
                <Download size={17} />
                Descargar detalle
              </button>

              <button
                type="button"
                className="reportes-boton-cerrar"
                onClick={() => setEstudianteSeleccionado(null)}
                title="Cerrar detalle"
              >
                <X size={18} />
              </button>
            </div>
          </div>

          {cargandoDetalle ? (
            <div className="reportes-detalle-cargando">
              <RefreshCw size={21} className="girando" />
              Cargando detalle...
            </div>
          ) : detalleEstudiante.length === 0 ? (
            <div className="reportes-detalle-vacio">
              No hay registros para este estudiante en el periodo seleccionado.
            </div>
          ) : (
            <div className="reportes-tabla-wrap">
              <table className="reportes-tabla">
                <thead>
                  {tipo === 'salidas' ? (
                    <tr>
                      <th>Fecha</th>
                      <th>Salida</th>
                      <th>Retorno</th>
                      <th>Destino</th>
                      <th>Sección</th>
                      <th>Estado</th>
                      <th>Observación</th>
                    </tr>
                  ) : (
                    <tr>
                      <th>Fecha</th>
                      <th>Hora</th>
                      <th>Categoría</th>
                      <th>Tipo</th>
                      <th>Descripción</th>
                      <th>Estado</th>
                      <th>Sección</th>
                    </tr>
                  )}
                </thead>

                <tbody>
                  {detalleEstudiante.map((item) =>
                    tipo === 'salidas' ? (
                      <tr key={item.id}>
                        <td>{formatearFecha(item.hora_salida)}</td>
                        <td>{formatearHora(item.hora_salida)}</td>
                        <td>{formatearHora(item.hora_regreso)}</td>
                        <td>{item.motivos_salida?.nombre || '—'}</td>
                        <td>
                          {item.secciones?.grados?.nombre || '—'} — {item.secciones?.nombre || '—'}
                        </td>
                        <td>
                          <span className={`estado ${item.permiso_autorizado === true ? 'ok' : item.permiso_autorizado === false ? 'rechazado' : 'pendiente'}`}>
                            {item.permiso_autorizado === true
                              ? 'Autorizada'
                              : item.permiso_autorizado === false
                                ? 'Rechazada'
                                : 'Pendiente'}
                          </span>
                        </td>
                        <td>{item.observacion || '—'}</td>
                      </tr>
                    ) : (
                      <tr key={item.id}>
                        <td>{formatearFecha(item.fecha_hora)}</td>
                        <td>{formatearHora(item.fecha_hora)}</td>
                        <td>{item.tipos_incidencia?.categorias_incidencia?.nombre || '—'}</td>
                        <td>{item.tipos_incidencia?.nombre || '—'}</td>
                        <td>{item.descripcion}</td>
                        <td>
                          <span className="estado seguimiento">
                            {item.estado}
                          </span>
                        </td>
                        <td>
                          {item.secciones?.grados?.nombre || '—'} — {item.secciones?.nombre || '—'}
                        </td>
                      </tr>
                    )
                  )}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      <div className="reportes-nota">
        <Users size={16} />
        <span>
          {esAdmin
            ? 'Como administrador, este reporte muestra la actividad institucional del periodo seleccionado.'
            : 'Como docente, este reporte muestra únicamente tus registros.'}
        </span>
      </div>
    </div>
  )
}
