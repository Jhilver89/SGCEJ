import { useEffect, useMemo, useState } from 'react'
import {
  CheckCircle2,
  ChevronDown,
  Filter,
  Pencil,
  RefreshCw,
  Search,
  X,
} from 'lucide-react'
import { supabase } from '../../lib/supabase'
import './Matriculas.css'

const ESTADOS = [
  ['pendiente', 'Pendiente'],
  ['matriculado', 'Matriculado'],
  ['promovido', 'Promovido'],
  ['no_promovido', 'No promovido'],
  ['retirado', 'Retirado'],
  ['trasladado', 'Trasladado'],
  ['egresado', 'Egresado'],
]

function Matriculas() {
  const [anios, setAnios] = useState([])
  const [anioId, setAnioId] = useState('')
  const [propuestas, setPropuestas] = useState([])
  const [grados, setGrados] = useState([])
  const [secciones, setSecciones] = useState([])

  const [loading, setLoading] = useState(true)
  const [guardando, setGuardando] = useState(false)
  const [procesandoMasivo, setProcesandoMasivo] = useState(false)
  const [mostrarConfirmacionMasiva, setMostrarConfirmacionMasiva] = useState(false)
  const [resultadoMasivo, setResultadoMasivo] = useState(null)
  const [error, setError] = useState('')
  const [mensaje, setMensaje] = useState('')

  const [busqueda, setBusqueda] = useState('')
  const [filtroNivel, setFiltroNivel] = useState('')
  const [filtroGrado, setFiltroGrado] = useState('')
  const [filtroSeccion, setFiltroSeccion] = useState('')
  const [filtroEstado, setFiltroEstado] = useState('pendiente')

  const [editando, setEditando] = useState(null)
  const [form, setForm] = useState({
    año_escolar_id: '',
    grado_id: '',
    seccion_id: '',
    estado_matricula: 'matriculado',
  })

  const cargarAnios = async () => {
    const { data: aniosData, error: aniosError } = await supabase
      .from('años_escolares')
      .select('id, nombre, fecha_inicio, fecha_fin, estado')
      .order('nombre', { ascending: false })

    if (aniosError) throw aniosError

    setAnios(aniosData ?? [])

    const activo = (aniosData ?? []).find((a) => a.estado === 'activo')
    setAnioId((actual) => actual || activo?.id || aniosData?.[0]?.id || '')
  }

  const cargarGrados = async () => {
    const { data, error: gradosError } = await supabase
      .from('grados')
      .select('id, nivel, numero, nombre')
      .order('nivel', { ascending: true })
      .order('numero', { ascending: true })

    if (gradosError) throw gradosError
    setGrados(data ?? [])
  }

  const cargarSecciones = async (id = anioId) => {
    if (!id) {
      setSecciones([])
      return
    }

    const { data, error: seccionesError } = await supabase
      .from('secciones')
      .select(`
        id,
        año_escolar_id,
        grado_id,
        nombre,
        capacidad,
        activa,
        grados (
          id,
          nivel,
          numero,
          nombre
        )
      `)
      .eq('año_escolar_id', id)
      .eq('activa', true)
      .order('grado_id', { ascending: true })
      .order('nombre', { ascending: true })

    if (seccionesError) throw seccionesError
    setSecciones(data ?? [])
  }

  const cargarPropuestas = async (id = anioId) => {
    if (!id) {
      setPropuestas([])
      return
    }

    const { data, error: propuestasError } = await supabase
      .from('propuestas_matricula')
      .select(`
        id,
        estudiante_id,
        año_escolar_id,
        nivel,
        grado_numero,
        grado_id,
        seccion_nombre,
        seccion_id,
        estado_matricula,
        estado_propuesta,
        created_at,
        estudiantes (
          id,
          dni,
          nombres,
          apellidos,
          activo
        ),
        grados (
          id,
          nivel,
          numero,
          nombre
        ),
        secciones (
          id,
          nombre,
          capacidad,
          activa
        )
      `)
      .eq('año_escolar_id', id)
      .order('created_at', { ascending: true })

    if (propuestasError) throw propuestasError
    setPropuestas(data ?? [])
  }

  const cargarTodo = async () => {
    setLoading(true)
    setError('')

    try {
      await cargarAnios()
      await cargarGrados()
    } catch (err) {
      console.error(err)
      setError(err.message || 'No se pudo cargar la configuración académica.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    cargarTodo()
  }, [])

  useEffect(() => {
    if (!anioId) return

    const cargarAnio = async () => {
      setLoading(true)
      setError('')

      try {
        await Promise.all([
          cargarSecciones(anioId),
          cargarPropuestas(anioId),
        ])
      } catch (err) {
        console.error(err)
        setError(err.message || 'No se pudieron cargar las matrículas.')
      } finally {
        setLoading(false)
      }
    }

    cargarAnio()
  }, [anioId])

  const niveles = useMemo(() => {
    return [...new Set(grados.map((g) => g.nivel))]
  }, [grados])

  const gradosFiltrados = useMemo(() => {
    if (!filtroNivel) return grados
    return grados.filter((g) => g.nivel === filtroNivel)
  }, [grados, filtroNivel])

  const seccionesFiltro = useMemo(() => {
    return secciones.filter((s) => {
      if (filtroGrado && s.grado_id !== filtroGrado) return false
      if (filtroNivel && s.grados?.nivel !== filtroNivel) return false
      return true
    })
  }, [secciones, filtroGrado, filtroNivel])

  const propuestasFiltradas = useMemo(() => {
    const texto = busqueda.trim().toLowerCase()

    return propuestas.filter((p) => {
      const estudiante = p.estudiantes
      const grado = p.grados

      if (texto) {
        const contenido = [
          estudiante?.dni,
          estudiante?.nombres,
          estudiante?.apellidos,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()

        if (!contenido.includes(texto)) return false
      }

      if (filtroNivel && (grado?.nivel || p.nivel) !== filtroNivel) {
        return false
      }

      if (
        filtroGrado &&
        (p.grado_id || grado?.id) !== filtroGrado
      ) {
        return false
      }

      if (filtroSeccion && p.seccion_id !== filtroSeccion) {
        return false
      }

      if (filtroEstado) {
  if (filtroEstado === 'pendiente') {
    if (p.estado_propuesta !== 'pendiente') {
      return false
    }
  } else if (filtroEstado === 'confirmada') {
    if (p.estado_propuesta !== 'confirmada') {
      return false
    }
  } else {
    if (p.estado_matricula !== filtroEstado) {
      return false
    }
  }
}

      return true
    })
  }, [
    propuestas,
    busqueda,
    filtroNivel,
    filtroGrado,
    filtroSeccion,
    filtroEstado,
  ])

  const estadisticas = useMemo(() => {
    return {
      total: propuestas.length,
      pendientes: propuestas.filter((p) => p.estado_propuesta === 'pendiente').length,
      confirmadas: propuestas.filter((p) => p.estado_propuesta === 'confirmada').length,
      rechazadas: propuestas.filter((p) => p.estado_propuesta === 'rechazada').length,
      incompletas: propuestas.filter((p) => !p.grado_id || !p.seccion_id).length,
    }
  }, [propuestas])

  const abrirEdicion = (propuesta) => {
    setEditando(propuesta)
    setForm({
      año_escolar_id: propuesta.año_escolar_id || anioId,
      grado_id: propuesta.grado_id || '',
      seccion_id: propuesta.seccion_id || '',
      estado_matricula: propuesta.estado_matricula || 'matriculado',
    })
    setError('')
    setMensaje('')
  }

  const cerrarEdicion = () => {
    if (guardando) return
    setEditando(null)
    setError('')
    setMensaje('')
  }

  const cambiarForm = (campo, valor) => {
    setForm((actual) => {
      const siguiente = { ...actual, [campo]: valor }

      if (campo === 'grado_id') {
        siguiente.seccion_id = ''
      }

      return siguiente
    })
  }

  const seccionesFormulario = useMemo(() => {
    return secciones.filter((s) => s.grado_id === form.grado_id)
  }, [secciones, form.grado_id])

  const guardarYConfirmar = async () => {
    if (!editando) return

    setError('')
    setMensaje('')

    if (!form.año_escolar_id || !form.grado_id || !form.seccion_id) {
      setError('Debes seleccionar año escolar, grado y sección.')
      return
    }

    setGuardando(true)

    try {
      const { error: rpcError } = await supabase.rpc(
        'confirmar_propuesta_matricula',
        {
          p_propuesta_id: editando.id,
          p_año_escolar_id: form.año_escolar_id,
          p_seccion_id: form.seccion_id,
          p_estado_matricula: form.estado_matricula,
        }
      )

      if (rpcError) throw rpcError

      setMensaje('La matrícula fue confirmada correctamente.')
      await cargarPropuestas(anioId)

      setTimeout(() => {
        setEditando(null)
        setMensaje('')
      }, 700)
    } catch (err) {
      console.error(err)
      setError(err.message || 'No se pudo confirmar la matrícula.')
    } finally {
      setGuardando(false)
    }
  }

  const matricularTodosLosValidos = async () => {
    if (!anioId || procesandoMasivo) return

    setProcesandoMasivo(true)
    setError('')
    setMensaje('')
    setResultadoMasivo(null)

    try {
      const { data, error: rpcError } = await supabase.rpc(
        'matricular_todas_las_propuestas_validas',
        {
          p_año_escolar_id: anioId,
        }
      )

      if (rpcError) throw rpcError

      setResultadoMasivo(data)
      setMostrarConfirmacionMasiva(false)
      await cargarPropuestas(anioId)

      if (data?.matriculados > 0) {
        setMensaje(
          `${data.matriculados} estudiante(s) fueron matriculados correctamente.`
        )
      } else {
        setMensaje('No se encontró ninguna propuesta apta para matricular.')
      }
    } catch (err) {
      console.error(err)
      setError(err.message || 'No se pudo realizar la matrícula masiva.')
      setMostrarConfirmacionMasiva(false)
    } finally {
      setProcesandoMasivo(false)
    }
  }

  const recargar = async () => {
    setError('')
    setMensaje('')

    try {
      await Promise.all([
        cargarSecciones(anioId),
        cargarPropuestas(anioId),
      ])
    } catch (err) {
      console.error(err)
      setError(err.message || 'No se pudieron actualizar los datos.')
    }
  }

  const estadoTexto = (estado) => {
    const encontrado = ESTADOS.find(([valor]) => valor === estado)
    return encontrado?.[1] || estado || '-'
  }

  const nivelTexto = (nivel) => {
    const valores = {
      inicial: 'Inicial',
      primaria: 'Primaria',
      secundaria: 'Secundaria',
    }
    return valores[nivel] || nivel || '-'
  }

  return (
    <div className="matriculas-page">
      <div className="matriculas-header">
        <div>
          <h1>Matrículas</h1>
          <p>
            Revisa y confirma las propuestas de matrícula de los estudiantes.
          </p>
        </div>

        <div className="matriculas-header-actions">
          <button
            type="button"
            className="matriculas-boton-masivo"
            onClick={() => {
              setResultadoMasivo(null)
              setMostrarConfirmacionMasiva(true)
              setError('')
              setMensaje('')
            }}
            disabled={!anioId || estadisticas.pendientes === 0 || procesandoMasivo}
          >
            <CheckCircle2 size={17} />
            Matricular todos los válidos
          </button>

          <button
            type="button"
            className="matriculas-refresh"
            onClick={recargar}
            title="Actualizar"
          >
            <RefreshCw size={18} />
          </button>

          <div className="matriculas-anio-selector">
            <label>Año escolar</label>
            <div className="select-icon-wrap">
              <select
                value={anioId}
                onChange={(e) => setAnioId(e.target.value)}
              >
                <option value="">Seleccionar año</option>
                {anios.map((anio) => (
                  <option key={anio.id} value={anio.id}>
                    {anio.nombre}
                  </option>
                ))}
              </select>
              <ChevronDown size={17} />
            </div>
          </div>
        </div>
      </div>

      {error && (
        <div className="matriculas-alert matriculas-alert-error">
          {error}
        </div>
      )}

      {mensaje && (
        <div className="matriculas-alert matriculas-alert-success">
          <CheckCircle2 size={18} />
          {mensaje}
        </div>
      )}

      <div className="matriculas-stats">
        <div className="matriculas-stat">
          <span>Total propuestas</span>
          <strong>{estadisticas.total}</strong>
        </div>
        <div className="matriculas-stat pendiente">
          <span>Pendientes</span>
          <strong>{estadisticas.pendientes}</strong>
        </div>
        <div className="matriculas-stat confirmada">
          <span>Confirmadas</span>
          <strong>{estadisticas.confirmadas}</strong>
        </div>
        <div className="matriculas-stat incompleta">
          <span>Por revisar</span>
          <strong>{estadisticas.incompletas}</strong>
        </div>
      </div>

      <div className="matriculas-card">
        <div className="matriculas-filtros">
          <div className="matriculas-buscador">
            <Search size={18} />
            <input
              type="text"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar por DNI, nombres o apellidos..."
            />
          </div>

          <div className="matriculas-filtro">
            <Filter size={16} />
            <select
              value={filtroNivel}
              onChange={(e) => {
                setFiltroNivel(e.target.value)
                setFiltroGrado('')
                setFiltroSeccion('')
              }}
            >
              <option value="">Todos los niveles</option>
              {niveles.map((nivel) => (
                <option key={nivel} value={nivel}>
                  {nivelTexto(nivel)}
                </option>
              ))}
            </select>
          </div>

          <div className="matriculas-filtro">
            <select
              value={filtroGrado}
              onChange={(e) => {
                setFiltroGrado(e.target.value)
                setFiltroSeccion('')
              }}
            >
              <option value="">Todos los grados</option>
              {gradosFiltrados.map((grado) => (
                <option key={grado.id} value={grado.id}>
                  {grado.nombre}
                </option>
              ))}
            </select>
          </div>

          <div className="matriculas-filtro">
            <select
              value={filtroSeccion}
              onChange={(e) => setFiltroSeccion(e.target.value)}
            >
              <option value="">Todas las secciones</option>
              {seccionesFiltro.map((seccion) => (
                <option key={seccion.id} value={seccion.id}>
                  {seccion.grados?.nombre || 'Grado'} — {seccion.nombre}
                </option>
              ))}
            </select>
          </div>

          <div className="matriculas-filtro">
            <select
              value={filtroEstado}
              onChange={(e) => setFiltroEstado(e.target.value)}
            >
              <option value="">Todos los estados</option>
              {ESTADOS.map(([valor, texto]) => (
                <option key={valor} value={valor}>
                  {texto}
                </option>
              ))}
              <option value="rechazada">Rechazada</option>
            </select>
          </div>
        </div>

        {loading ? (
          <div className="matriculas-empty">Cargando matrículas...</div>
        ) : propuestasFiltradas.length === 0 ? (
          <div className="matriculas-empty">
            <CheckCircle2 size={42} />
            <h3>No hay propuestas para mostrar</h3>
            <p>
              Prueba con otro filtro o verifica que existan propuestas para el
              año escolar seleccionado.
            </p>
          </div>
        ) : (
          <div className="matriculas-table-wrap">
            <table className="matriculas-table">
              <thead>
                <tr>
                  <th>DNI</th>
                  <th>Apellidos y nombres</th>
                  <th>Nivel</th>
                  <th>Grado</th>
                  <th>Sección</th>
                  <th>Estado</th>
                  <th>Propuesta</th>
                  <th>Acción</th>
                </tr>
              </thead>

              <tbody>
                {propuestasFiltradas.map((propuesta) => {
                  const estudiante = propuesta.estudiantes
                  const grado = propuesta.grados
                  const seccion = propuesta.secciones

                  return (
                    <tr key={propuesta.id}>
                      <td className="dni-cell">{estudiante?.dni || '-'}</td>
                      <td>
                        <div className="estudiante-nombre">
                          <strong>
                            {estudiante?.apellidos || ''}{' '}
                            {estudiante?.nombres || ''}
                          </strong>
                        </div>
                      </td>
                      <td>{nivelTexto(grado?.nivel || propuesta.nivel)}</td>
                      <td>{grado?.nombre || propuesta.grado_numero || '-'}</td>
                      <td>{seccion?.nombre || propuesta.seccion_nombre || '-'}</td>
                      <td>
                        <span className={`estado-badge estado-${propuesta.estado_matricula}`}>
                          {estadoTexto(propuesta.estado_matricula)}
                        </span>
                      </td>
                      <td>
                        <span className={`propuesta-badge propuesta-${propuesta.estado_propuesta}`}>
                          {propuesta.estado_propuesta === 'pendiente'
                            ? 'Pendiente'
                            : propuesta.estado_propuesta === 'confirmada'
                              ? 'Confirmada'
                              : 'Rechazada'}
                        </span>
                      </td>
                      <td>
                        <button
                          type="button"
                          className="matriculas-action"
                          onClick={() => abrirEdicion(propuesta)}
                        >
                          <Pencil size={16} />
                          {propuesta.estado_propuesta === 'confirmada'
                            ? 'Editar'
                            : 'Revisar'}
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {mostrarConfirmacionMasiva && (
        <div className="matriculas-modal-fondo">
          <div className="matriculas-modal matriculas-modal-masivo">
            <div className="matriculas-modal-header">
              <div>
                <h2>Matricular todos los válidos</h2>
                <p>Proceso automático para el año escolar seleccionado.</p>
              </div>

              <button
                type="button"
                className="matriculas-modal-close"
                onClick={() => !procesandoMasivo && setMostrarConfirmacionMasiva(false)}
                disabled={procesandoMasivo}
              >
                <X size={20} />
              </button>
            </div>

            <div className="matriculas-modal-body">
              <div className="matricula-masiva-resumen">
                <strong>{estadisticas.pendientes}</strong>
                <span>propuestas pendientes serán validadas.</span>
              </div>

              <p className="matricula-masiva-texto">
                El sistema matriculará automáticamente únicamente las propuestas
                que tengan año, grado y sección válidos y que no generen
                conflictos. Los registros con errores, secciones inexistentes,
                capacidad excedida o conflictos de matrícula permanecerán
                pendientes para revisión.
              </p>

              <div className="matricula-modal-nota">
                No se duplicarán matrículas existentes. Al finalizar se mostrará
                cuántos estudiantes fueron matriculados y cuáles quedaron para
                revisión.
              </div>
            </div>

            <div className="matriculas-modal-footer">
              <button
                type="button"
                className="matriculas-btn-cancelar"
                onClick={() => setMostrarConfirmacionMasiva(false)}
                disabled={procesandoMasivo}
              >
                Cancelar
              </button>

              <button
                type="button"
                className="matriculas-btn-confirmar"
                onClick={matricularTodosLosValidos}
                disabled={procesandoMasivo}
              >
                <CheckCircle2 size={17} />
                {procesandoMasivo
                  ? 'Procesando...'
                  : 'Sí, matricular todos los válidos'}
              </button>
            </div>
          </div>
        </div>
      )}

      {resultadoMasivo && (
        <div className="matriculas-modal-fondo">
          <div className="matriculas-modal matriculas-modal-masivo">
            <div className="matriculas-modal-header">
              <div>
                <h2>Proceso de matrícula terminado</h2>
                <p>Resultado de la validación automática.</p>
              </div>

              <button
                type="button"
                className="matriculas-modal-close"
                onClick={() => setResultadoMasivo(null)}
              >
                <X size={20} />
              </button>
            </div>

            <div className="matriculas-modal-body">
              <div className="matricula-resultados-grid">
                <div>
                  <strong>{resultadoMasivo.matriculados ?? 0}</strong>
                  <span>Matriculados</span>
                </div>
                <div>
                  <strong>{resultadoMasivo.revisar ?? 0}</strong>
                  <span>Para revisar</span>
                </div>
                <div>
                  <strong>{resultadoMasivo.ya_matriculados ?? 0}</strong>
                  <span>Ya matriculados</span>
                </div>
              </div>

              {(resultadoMasivo.errores?.length ?? 0) > 0 && (
                <div className="matricula-errores">
                  <h3>Registros que requieren revisión</h3>
                  <div className="matricula-errores-lista">
                    {resultadoMasivo.errores.slice(0, 12).map((item, index) => (
                      <div key={`${item.propuesta_id}-${index}`}>
                        <strong>{item.dni || 'Sin DNI'}</strong>
                        <span>{item.motivo}</span>
                      </div>
                    ))}
                  </div>
                  {resultadoMasivo.errores.length > 12 && (
                    <p>
                      Se muestran los primeros 12. Los demás permanecen como
                      pendientes en la tabla.
                    </p>
                  )}
                </div>
              )}
            </div>

            <div className="matriculas-modal-footer">
              <button
                type="button"
                className="matriculas-btn-confirmar"
                onClick={() => setResultadoMasivo(null)}
              >
                Entendido
              </button>
            </div>
          </div>
        </div>
      )}

      {editando && (
        <div className="matriculas-modal-fondo">
          <div className="matriculas-modal">
            <div className="matriculas-modal-header">
              <div>
                <h2>Revisar matrícula</h2>
                <p>
                  {editando.estudiantes?.apellidos}{' '}
                  {editando.estudiantes?.nombres}
                </p>
              </div>

              <button
                type="button"
                className="matriculas-modal-close"
                onClick={cerrarEdicion}
                disabled={guardando}
              >
                <X size={20} />
              </button>
            </div>

            <div className="matriculas-modal-body">
              <div className="matricula-dato">
                <span>DNI</span>
                <strong>{editando.estudiantes?.dni || '-'}</strong>
              </div>

              <div className="matricula-dato">
                <span>Nivel propuesto</span>
                <strong>
                  {nivelTexto(editando.grados?.nivel || editando.nivel)}
                </strong>
              </div>

              <div className="matricula-form-grid">
                <label>
                  Año escolar
                  <select
                    value={form.año_escolar_id}
                    onChange={(e) =>
                      cambiarForm('año_escolar_id', e.target.value)
                    }
                    disabled={guardando}
                  >
                    {anios.map((anio) => (
                      <option key={anio.id} value={anio.id}>
                        {anio.nombre}
                      </option>
                    ))}
                  </select>
                </label>

                <label>
                  Grado
                  <select
                    value={form.grado_id}
                    onChange={(e) =>
                      cambiarForm('grado_id', e.target.value)
                    }
                    disabled={guardando}
                  >
                    <option value="">Seleccionar grado</option>
                    {grados.map((grado) => (
                      <option key={grado.id} value={grado.id}>
                        {grado.nombre}
                      </option>
                    ))}
                  </select>
                </label>

                <label>
                  Sección
                  <select
                    value={form.seccion_id}
                    onChange={(e) =>
                      cambiarForm('seccion_id', e.target.value)
                    }
                    disabled={guardando || !form.grado_id}
                  >
                    <option value="">Seleccionar sección</option>
                    {seccionesFormulario.map((seccion) => (
                      <option key={seccion.id} value={seccion.id}>
                        {seccion.nombre}
                      </option>
                    ))}
                  </select>
                </label>

                <label>
                  Estado de matrícula
                  <select
                    value={form.estado_matricula}
                    onChange={(e) =>
                      cambiarForm('estado_matricula', e.target.value)
                    }
                    disabled={guardando}
                  >
                    {ESTADOS.map(([valor, texto]) => (
                      <option key={valor} value={valor}>
                        {texto}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="matricula-modal-nota">
                Al confirmar, el sistema creará o actualizará la matrícula
                oficial del estudiante para el año seleccionado y marcará esta
                propuesta como confirmada.
              </div>
            </div>

            <div className="matriculas-modal-footer">
              <button
                type="button"
                className="matriculas-btn-cancelar"
                onClick={cerrarEdicion}
                disabled={guardando}
              >
                Cancelar
              </button>

              <button
                type="button"
                className="matriculas-btn-confirmar"
                onClick={guardarYConfirmar}
                disabled={guardando}
              >
                <CheckCircle2 size={17} />
                {guardando ? 'Guardando...' : 'Confirmar matrícula'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default Matriculas
