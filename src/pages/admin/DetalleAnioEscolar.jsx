import { useEffect, useState } from 'react'
import {
  ArrowLeft,
  CalendarDays,
  ChevronDown,
  ChevronRight,
  Pencil,
  Save,
  X,
} from 'lucide-react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import './DetalleAnioEscolar.css'

function DetalleAnioEscolar() {
  const navigate = useNavigate()
  const { id } = useParams()

  const [anio, setAnio] = useState(null)
  const [periodos, setPeriodos] = useState([])

  const [loading, setLoading] = useState(true)
  const [guardando, setGuardando] = useState(false)

  const [error, setError] = useState('')
  const [mensaje, setMensaje] = useState('')

  const [abiertos, setAbiertos] = useState({})

  const [editando, setEditando] = useState(null)

  const [fechaInicio, setFechaInicio] = useState('')
  const [fechaFin, setFechaFin] = useState('')
  const [estadoEdicion, setEstadoEdicion] =
    useState('planificado')

  useEffect(() => {
    cargarDatos()
  }, [id])

  const cargarDatos = async () => {
    setLoading(true)
    setError('')

    const { data: anioData, error: anioError } =
      await supabase
        .from('años_escolares')
        .select(
          'id, nombre, fecha_inicio, fecha_fin, estado'
        )
        .eq('id', id)
        .single()

    if (anioError) {
      console.error(
        'ERROR CARGANDO AÑO:',
        anioError
      )

      setError(
        'No se pudo cargar el año escolar.'
      )

      setLoading(false)
      return
    }

    const {
      data: periodosData,
      error: periodosError,
    } = await supabase
      .from('periodos_academicos')
      .select(
        'id, numero, nombre, fecha_inicio, fecha_fin, estado'
      )
      .eq('año_escolar_id', id)
      .order('numero', {
        ascending: true,
      })

    if (periodosError) {
      console.error(
        'ERROR CARGANDO PERIODOS:',
        periodosError
      )

      setError(
        'No se pudieron cargar los bimestres.'
      )

      setLoading(false)
      return
    }

    const periodoIds =
      (periodosData ?? []).map(
        (periodo) => periodo.id
      )

    let unidadesData = []

    if (periodoIds.length > 0) {
      const {
        data,
        error: unidadesError,
      } = await supabase
        .from('unidades_academicas')
        .select(
          'id, periodo_id, numero, nombre, fecha_inicio, fecha_fin, estado'
        )
        .in(
          'periodo_id',
          periodoIds
        )
        .order('numero', {
          ascending: true,
        })

      if (unidadesError) {
        console.error(
          'ERROR CARGANDO UNIDADES:',
          unidadesError
        )

        setError(
          'No se pudieron cargar las unidades.'
        )

        setLoading(false)
        return
      }

      unidadesData = data ?? []
    }

    const periodosConUnidades =
      (periodosData ?? []).map(
        (periodo) => ({
          ...periodo,
          unidades:
            unidadesData.filter(
              (unidad) =>
                unidad.periodo_id ===
                periodo.id
            ),
        })
      )

    setAnio(anioData)
    setPeriodos(periodosConUnidades)

    const estadoInicial = {}

    periodosConUnidades.forEach(
      (periodo) => {
        estadoInicial[periodo.id] = true
      }
    )

    setAbiertos(estadoInicial)

    setLoading(false)
  }

  const alternarPeriodo = (
    periodoId
  ) => {
    setAbiertos((actual) => ({
      ...actual,
      [periodoId]:
        !actual[periodoId],
    }))
  }

  const formatoFecha = (fecha) => {
    if (!fecha) return '-'

    const [
      anioFecha,
      mes,
      dia,
    ] = fecha.split('-')

    return `${dia}/${mes}/${anioFecha}`
  }

  const estadoTexto = (estado) => {
    const estados = {
      planificado: 'Planificado',
      activo: 'Activo',
      cerrado: 'Cerrado',
    }

    return (
      estados[estado] ?? estado
    )
  }

  const iniciarEdicion = (
    tipo,
    item,
    periodo = null
  ) => {
    setError('')
    setMensaje('')

    setEditando({
      tipo,
      id: item.id,
      periodoId:
        periodo?.id ?? null,
    })

    setFechaInicio(
      item.fecha_inicio
    )

    setFechaFin(
      item.fecha_fin
    )

    setEstadoEdicion(
      item.estado
    )
  }

  const cancelarEdicion = () => {
    setEditando(null)
    setFechaInicio('')
    setFechaFin('')
    setEstadoEdicion(
      'planificado'
    )
    setError('')
  }

  const guardarCambios = async () => {
    if (!editando) return

    setError('')
    setMensaje('')

    if (
      !fechaInicio ||
      !fechaFin
    ) {
      setError(
        'Debes ingresar la fecha de inicio y la fecha de fin.'
      )
      return
    }

    if (fechaFin < fechaInicio) {
      setError(
        'La fecha de fin no puede ser anterior a la fecha de inicio.'
      )
      return
    }

    if (
      ![
        'planificado',
        'activo',
        'cerrado',
      ].includes(
        estadoEdicion
      )
    ) {
      setError(
        'El estado seleccionado no es válido.'
      )
      return
    }

    /* ========================================
       EDITAR UNIDAD
    ======================================== */

    if (
      editando.tipo ===
      'unidad'
    ) {
      const periodo =
        periodos.find(
          (item) =>
            item.id ===
            editando.periodoId
        )

      if (!periodo) {
        setError(
          'No se encontró el bimestre de la unidad.'
        )
        return
      }

      /*
       * La unidad debe estar
       * completamente dentro
       * de su bimestre.
       */

      if (
        fechaInicio <
          periodo.fecha_inicio ||
        fechaFin >
          periodo.fecha_fin
      ) {
        setError(
          `La unidad debe estar dentro del bimestre (${formatoFecha(
            periodo.fecha_inicio
          )} — ${formatoFecha(
            periodo.fecha_fin
          )}).`
        )

        return
      }

      /*
       * Evitar solapamiento
       * con otra unidad.
       */

      const otrasUnidades =
        periodo.unidades.filter(
          (unidad) =>
            unidad.id !==
            editando.id
        )

      const haySolapamiento =
        otrasUnidades.some(
          (unidad) =>
            fechaInicio <=
              unidad.fecha_fin &&
            fechaFin >=
              unidad.fecha_inicio
        )

      if (
        haySolapamiento
      ) {
        setError(
          'Las fechas se cruzan con otra unidad del mismo bimestre.'
        )

        return
      }

      /*
       * Una unidad activa
       * necesita un bimestre activo.
       */

      if (
        estadoEdicion ===
          'activo' &&
        periodo.estado !==
          'activo'
      ) {
        setError(
          'Una unidad solo puede estar activa cuando su bimestre está activo.'
        )

        return
      }

      /*
       * Si el bimestre está cerrado,
       * la unidad no puede quedar activa.
       */

      if (
        periodo.estado ===
          'cerrado' &&
        estadoEdicion ===
          'activo'
      ) {
        setError(
          'Una unidad no puede estar activa dentro de un bimestre cerrado.'
        )

        return
      }
    }

    /* ========================================
       EDITAR BIMESTRE
    ======================================== */

    if (
      editando.tipo ===
      'periodo'
    ) {
      /*
       * El bimestre debe estar
       * dentro del año escolar.
       */

      if (
        fechaInicio <
          anio.fecha_inicio ||
        fechaFin >
          anio.fecha_fin
      ) {
        setError(
          `El bimestre debe estar dentro del año escolar (${formatoFecha(
            anio.fecha_inicio
          )} — ${formatoFecha(
            anio.fecha_fin
          )}).`
        )

        return
      }

      const indicePeriodo =
        periodos.findIndex(
          (periodo) =>
            periodo.id ===
            editando.id
        )

      const periodoAnterior =
        periodos[
          indicePeriodo - 1
        ]

      const periodoSiguiente =
        periodos[
          indicePeriodo + 1
        ]

      /*
       * No puede cruzarse
       * con el anterior.
       */

      if (
        periodoAnterior &&
        fechaInicio <=
          periodoAnterior.fecha_fin
      ) {
        setError(
          'El bimestre no puede cruzarse con el bimestre anterior.'
        )

        return
      }

      /*
       * No puede cruzarse
       * con el siguiente.
       */

      if (
        periodoSiguiente &&
        fechaFin >=
          periodoSiguiente.fecha_inicio
      ) {
        setError(
          'El bimestre no puede cruzarse con el siguiente bimestre.'
        )

        return
      }

      /*
       * Las unidades deben
       * continuar dentro
       * del bimestre.
       */

      const unidadesFuera =
        periodos[
          indicePeriodo
        ].unidades.some(
          (unidad) =>
            unidad.fecha_inicio <
              fechaInicio ||
            unidad.fecha_fin >
              fechaFin
        )

      if (unidadesFuera) {
        setError(
          'No puedes establecer esas fechas porque dejarían una unidad fuera del bimestre.'
        )

        return
      }

      /*
       * Un bimestre cerrado
       * no puede tener una
       * unidad activa.
       */

      if (
        estadoEdicion ===
        'cerrado'
      ) {
        const tieneUnidadActiva =
          periodos[
            indicePeriodo
          ].unidades.some(
            (unidad) =>
              unidad.estado ===
              'activo'
          )

        if (
          tieneUnidadActiva
        ) {
          setError(
            'Primero debes cambiar el estado de las unidades activas antes de cerrar el bimestre.'
          )

          return
        }
      }
    }

    setGuardando(true)

    const tabla =
      editando.tipo ===
      'periodo'
        ? 'periodos_academicos'
        : 'unidades_academicas'

    const {
      error: updateError,
    } = await supabase
      .from(tabla)
      .update({
        fecha_inicio:
          fechaInicio,
        fecha_fin:
          fechaFin,
        estado:
          estadoEdicion,
      })
      .eq(
        'id',
        editando.id
      )

    if (updateError) {
      console.error(
        'ERROR ACTUALIZANDO:',
        updateError
      )

      setError(
        'No se pudieron guardar los cambios.'
      )

      setGuardando(false)
      return
    }

    setMensaje(
      editando.tipo ===
        'periodo'
        ? 'Bimestre actualizado correctamente.'
        : 'Unidad actualizada correctamente.'
    )

    setGuardando(false)

    cancelarEdicion()

    await cargarDatos()
  }

  if (loading) {
    return (
      <div className="detalle-anio-page">
        <div className="detalle-anio-loading">
          Cargando información académica...
        </div>
      </div>
    )
  }

  if (error && !anio) {
    return (
      <div className="detalle-anio-page">

        <button
          type="button"
          className="detalle-anio-back"
          onClick={() =>
            navigate(
              '/admin/anios-escolares'
            )
          }
        >
          <ArrowLeft
            size={18}
          />

          Volver a años escolares
        </button>

        <div className="detalle-anio-error">
          {error}
        </div>

      </div>
    )
  }

  return (
    <div className="detalle-anio-page">

      <button
        type="button"
        className="detalle-anio-back"
        onClick={() =>
          navigate(
            '/admin/anios-escolares'
          )
        }
      >
        <ArrowLeft
          size={18}
        />

        Volver a años escolares
      </button>

      {/* ======================================
          ENCABEZADO
      ====================================== */}

      <div className="detalle-anio-header">

        <div>

          <div className="detalle-anio-title-row">

            <CalendarDays
              size={30}
            />

            <h1>
              Año escolar{' '}
              {anio?.nombre}
            </h1>

          </div>

          <p>
            Administración de
            bimestres y unidades
            académicas.
          </p>

        </div>

        <span
          className={`detalle-anio-status detalle-anio-status-${anio?.estado}`}
        >
          {estadoTexto(
            anio?.estado
          )}
        </span>

      </div>

      {/* ======================================
          MENSAJES
      ====================================== */}

      {mensaje && (
        <div className="detalle-anio-success">
          {mensaje}
        </div>
      )}

      {error && (
        <div className="detalle-anio-error">
          {error}
        </div>
      )}

      {/* ======================================
          RESUMEN
      ====================================== */}

      <div className="detalle-anio-summary">

        <div>
          <span>
            Fecha de inicio
          </span>

          <strong>
            {formatoFecha(
              anio?.fecha_inicio
            )}
          </strong>
        </div>

        <div>
          <span>
            Fecha de fin
          </span>

          <strong>
            {formatoFecha(
              anio?.fecha_fin
            )}
          </strong>
        </div>

        <div>
          <span>
            Bimestres
          </span>

          <strong>
            {periodos.length}
          </strong>
        </div>

        <div>
          <span>
            Unidades
          </span>

          <strong>
            {periodos.reduce(
              (
                total,
                periodo
              ) =>
                total +
                periodo.unidades
                  .length,
              0
            )}
          </strong>
        </div>

      </div>

      {/* ======================================
          ESTRUCTURA ACADÉMICA
      ====================================== */}

      <section className="detalle-anio-card">

        <div className="detalle-anio-card-header">

          <div>

            <h2>
              Estructura académica
            </h2>

            <p>
              Configura las fechas y
              estados de cada bimestre
              y unidad.
            </p>

          </div>

        </div>

        <div className="detalle-periodos">

          {periodos.map(
            (periodo) => {

              const abierto =
                abiertos[
                  periodo.id
                ]

              const editandoPeriodo =
                editando?.tipo ===
                  'periodo' &&
                editando?.id ===
                  periodo.id

              return (
                <div
                  className="detalle-periodo"
                  key={
                    periodo.id
                  }
                >

                  {/* ==================================
                      CABECERA DEL BIMESTRE
                  ================================== */}

                  {!editandoPeriodo ? (

                    <div className="detalle-periodo-header">

                      <button
                        type="button"
                        className="detalle-periodo-toggle"
                        onClick={() =>
                          alternarPeriodo(
                            periodo.id
                          )
                        }
                      >

                        {abierto ? (
                          <ChevronDown
                            size={21}
                          />
                        ) : (
                          <ChevronRight
                            size={21}
                          />
                        )}

                        <div>

                          <strong>
                            {
                              periodo.nombre
                            }
                          </strong>

                          <span>
                            {
                              formatoFecha(
                                periodo.fecha_inicio
                              )
                            }{' '}
                            —{' '}
                            {
                              formatoFecha(
                                periodo.fecha_fin
                              )
                            }
                          </span>

                        </div>

                      </button>

                      <div className="detalle-periodo-right">

                        <span
                          className={`detalle-anio-status detalle-anio-status-${periodo.estado}`}
                        >
                          {estadoTexto(
                            periodo.estado
                          )}
                        </span>

                        <span className="detalle-unidades-count">
                          {
                            periodo
                              .unidades
                              .length
                          }{' '}
                          {periodo
                            .unidades
                            .length ===
                          1
                            ? 'unidad'
                            : 'unidades'}
                        </span>

                        <button
                          type="button"
                          className="detalle-edit-button"
                          title="Editar bimestre"
                          onClick={() =>
                            iniciarEdicion(
                              'periodo',
                              periodo
                            )
                          }
                        >
                          <Pencil
                            size={16}
                          />
                        </button>

                      </div>

                    </div>

                  ) : (

                    /* ================================
                       EDICIÓN DEL BIMESTRE
                    ================================= */

                    <div className="detalle-edicion-container">

                      <div className="detalle-edicion-title">
                        <strong>
                          {periodo.nombre}
                        </strong>

                        <span>
                          Editar bimestre
                        </span>
                      </div>

                      <div className="detalle-edicion-fechas">

                        <label>
                          Inicio

                          <input
                            type="date"
                            value={
                              fechaInicio
                            }
                            onChange={(
                              e
                            ) =>
                              setFechaInicio(
                                e.target.value
                              )
                            }
                          />
                        </label>

                        <label>
                          Fin

                          <input
                            type="date"
                            value={
                              fechaFin
                            }
                            onChange={(
                              e
                            ) =>
                              setFechaFin(
                                e.target.value
                              )
                            }
                          />
                        </label>

                        <label>
                          Estado

                          <select
                            value={
                              estadoEdicion
                            }
                            onChange={(
                              e
                            ) =>
                              setEstadoEdicion(
                                e.target.value
                              )
                            }
                          >
                            <option value="planificado">
                              Planificado
                            </option>

                            <option value="activo">
                              Activo
                            </option>

                            <option value="cerrado">
                              Cerrado
                            </option>
                          </select>
                        </label>

                        <button
                          type="button"
                          className="detalle-save-button"
                          title="Guardar cambios"
                          disabled={
                            guardando
                          }
                          onClick={
                            guardarCambios
                          }
                        >
                          <Save
                            size={16}
                          />
                        </button>

                        <button
                          type="button"
                          className="detalle-cancel-button"
                          title="Cancelar"
                          disabled={
                            guardando
                          }
                          onClick={
                            cancelarEdicion
                          }
                        >
                          <X
                            size={16}
                          />
                        </button>

                      </div>

                    </div>

                  )}

                  {/* ==================================
                      UNIDADES
                  ================================== */}

                  {abierto &&
                    !editandoPeriodo && (
                      <div className="detalle-unidades">

                        {periodo.unidades.map(
                          (
                            unidad
                          ) => {

                            const editandoUnidad =
                              editando?.tipo ===
                                'unidad' &&
                              editando?.id ===
                                unidad.id

                            if (
                              editandoUnidad
                            ) {
                              return (
                                <div
                                  className="detalle-unidad detalle-unidad-editando"
                                  key={
                                    unidad.id
                                  }
                                >

                                  <div className="detalle-unidad-number">
                                    {
                                      unidad.numero
                                    }
                                  </div>

                                  <div className="detalle-unidad-info">

                                    <strong>
                                      {
                                        unidad.nombre
                                      }
                                    </strong>

                                    <span>
                                      Editar unidad
                                    </span>

                                  </div>

                                  <div className="detalle-edicion-fechas">

                                    <label>
                                      Inicio

                                      <input
                                        type="date"
                                        value={
                                          fechaInicio
                                        }
                                        onChange={(
                                          e
                                        ) =>
                                          setFechaInicio(
                                            e.target.value
                                          )
                                        }
                                      />
                                    </label>

                                    <label>
                                      Fin

                                      <input
                                        type="date"
                                        value={
                                          fechaFin
                                        }
                                        onChange={(
                                          e
                                        ) =>
                                          setFechaFin(
                                            e.target.value
                                          )
                                        }
                                      />
                                    </label>

                                    <label>
                                      Estado

                                      <select
                                        value={
                                          estadoEdicion
                                        }
                                        onChange={(
                                          e
                                        ) =>
                                          setEstadoEdicion(
                                            e.target.value
                                          )
                                        }
                                      >
                                        <option value="planificado">
                                          Planificado
                                        </option>

                                        <option value="activo">
                                          Activo
                                        </option>

                                        <option value="cerrado">
                                          Cerrado
                                        </option>
                                      </select>
                                    </label>

                                    <button
                                      type="button"
                                      className="detalle-save-button"
                                      title="Guardar cambios"
                                      disabled={
                                        guardando
                                      }
                                      onClick={
                                        guardarCambios
                                      }
                                    >
                                      <Save
                                        size={15}
                                      />
                                    </button>

                                    <button
                                      type="button"
                                      className="detalle-cancel-button"
                                      title="Cancelar"
                                      disabled={
                                        guardando
                                      }
                                      onClick={
                                        cancelarEdicion
                                      }
                                    >
                                      <X
                                        size={15}
                                      />
                                    </button>

                                  </div>

                                </div>
                              )
                            }

                            return (
                              <div
                                className="detalle-unidad"
                                key={
                                  unidad.id
                                }
                              >

                                <div className="detalle-unidad-number">
                                  {
                                    unidad.numero
                                  }
                                </div>

                                <div className="detalle-unidad-info">

                                  <strong>
                                    {
                                      unidad.nombre
                                    }
                                  </strong>

                                  <span>
                                    {
                                      formatoFecha(
                                        unidad.fecha_inicio
                                      )
                                    }{' '}
                                    —{' '}
                                    {
                                      formatoFecha(
                                        unidad.fecha_fin
                                      )
                                    }
                                  </span>

                                </div>

                                <span
                                  className={`detalle-anio-status detalle-anio-status-${unidad.estado}`}
                                >
                                  {estadoTexto(
                                    unidad.estado
                                  )}
                                </span>

                                <button
                                  type="button"
                                  className="detalle-edit-button"
                                  title="Editar unidad"
                                  onClick={() =>
                                    iniciarEdicion(
                                      'unidad',
                                      unidad,
                                      periodo
                                    )
                                  }
                                >
                                  <Pencil
                                    size={15}
                                  />
                                </button>

                              </div>
                            )
                          }
                        )}

                      </div>
                    )}

                </div>
              )
            }
          )}

        </div>

      </section>

    </div>
  )
}

export default DetalleAnioEscolar