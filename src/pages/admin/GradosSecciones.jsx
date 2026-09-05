import { useEffect, useState } from 'react'
import {
  GraduationCap,
  Plus,
  Pencil,
  X,
  Save,
} from 'lucide-react'

import { supabase } from '../../lib/supabase'
import './GradosSecciones.css'

function GradosSecciones() {
  const [anios, setAnios] = useState([])
  const [anioSeleccionado, setAnioSeleccionado] = useState('')

  const [grados, setGrados] = useState([])
  const [secciones, setSecciones] = useState([])

  const [loading, setLoading] = useState(true)
  const [guardando, setGuardando] = useState(false)

  const [error, setError] = useState('')
  const [mensaje, setMensaje] = useState('')

  const [formularioAbierto, setFormularioAbierto] =
    useState(false)

  const [editando, setEditando] = useState(null)

  const [formulario, setFormulario] = useState({
    grado_id: '',
    nombre: '',
    capacidad: 30,
    activa: true,
  })

  useEffect(() => {
    cargarAnios()
    cargarGrados()
  }, [])

  useEffect(() => {
    if (anioSeleccionado) {
      cargarSecciones()
    } else {
      setSecciones([])
    }
  }, [anioSeleccionado])

  const cargarAnios = async () => {
    const { data, error } = await supabase
      .from('años_escolares')
      .select(
        'id, nombre, fecha_inicio, fecha_fin, estado'
      )
      .order('fecha_inicio', {
        ascending: false,
      })

    if (error) {
      console.error(
        'ERROR CARGANDO AÑOS:',
        error
      )

      setError(
        'No se pudieron cargar los años escolares.'
      )

      setLoading(false)
      return
    }

    setAnios(data ?? [])

    const activo = (data ?? []).find(
      (anio) => anio.estado === 'activo'
    )

    if (activo) {
      setAnioSeleccionado(activo.id)
    } else if (data && data.length > 0) {
      setAnioSeleccionado(data[0].id)
    }

    setLoading(false)
  }

  const cargarGrados = async () => {
    const { data, error } = await supabase
      .from('grados')
      .select(
        'id, nivel, numero, nombre'
      )
      .order('nivel', {
        ascending: true,
      })
      .order('numero', {
        ascending: true,
      })

    if (error) {
      console.error(
        'ERROR CARGANDO GRADOS:',
        error
      )

      setError(
        'No se pudieron cargar los grados.'
      )

      return
    }

    setGrados(data ?? [])
  }

  const cargarSecciones = async () => {
    if (!anioSeleccionado) return

    setError('')

    const { data, error } = await supabase
      .from('secciones')
      .select(
        `
          id,
          institucion_id,
          año_escolar_id,
          grado_id,
          nombre,
          capacidad,
          activa,
          tutor_id,
          grados (
            id,
            nivel,
            numero,
            nombre
          )
        `
      )
      .eq(
        'año_escolar_id',
        anioSeleccionado
      )
      .order('grado_id', {
        ascending: true,
      })
      .order('nombre', {
        ascending: true,
      })

    if (error) {
      console.error(
        'ERROR CARGANDO SECCIONES:',
        error
      )

      setError(
        'No se pudieron cargar las secciones.'
      )

      return
    }

    setSecciones(data ?? [])
  }

  const abrirNuevaSeccion = (
    gradoId = ''
  ) => {
    setError('')
    setMensaje('')
    setEditando(null)

    setFormulario({
      grado_id: gradoId,
      nombre: '',
      capacidad: 30,
      activa: true,
    })

    setFormularioAbierto(true)
  }

  const abrirEdicion = (
    seccion
  ) => {
    setError('')
    setMensaje('')
    setEditando(seccion)

    setFormulario({
      grado_id: seccion.grado_id,
      nombre: seccion.nombre,
      capacidad: seccion.capacidad ?? 30,
      activa: seccion.activa,
    })

    setFormularioAbierto(true)
  }

  const cerrarFormulario = () => {
    if (guardando) return

    setFormularioAbierto(false)
    setEditando(null)

    setFormulario({
      grado_id: '',
      nombre: '',
      capacidad: 30,
      activa: true,
    })
  }

  const actualizarCampo = (
    campo,
    valor
  ) => {
    setFormulario(
      (actual) => ({
        ...actual,
        [campo]: valor,
      })
    )
  }

  const guardarSeccion = async () => {
    setError('')
    setMensaje('')

    if (!anioSeleccionado) {
      setError(
        'Selecciona un año escolar.'
      )
      return
    }

    if (!formulario.grado_id) {
      setError(
        'Selecciona un grado.'
      )
      return
    }

    const nombre =
      formulario.nombre
        .trim()
        .toUpperCase()

    if (!nombre) {
      setError(
        'Ingresa el nombre de la sección.'
      )
      return
    }

    const capacidad =
      Number(formulario.capacidad)

    if (
      !Number.isInteger(capacidad) ||
      capacidad < 1
    ) {
      setError(
        'La capacidad debe ser un número entero mayor que cero.'
      )
      return
    }

    setGuardando(true)

    try {
      /*
       * Obtenemos la institución del usuario
       * administrador.
       */
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser()

      if (userError) {
        throw userError
      }

      if (!user) {
        throw new Error(
          'No hay un usuario autenticado.'
        )
      }

      const { data: perfil, error: perfilError } =
        await supabase
          .from('perfiles')
          .select('institucion_id')
          .eq('id', user.id)
          .single()

      if (perfilError) {
        throw perfilError
      }

      if (!perfil?.institucion_id) {
        throw new Error(
          'El usuario no tiene una institución asociada.'
        )
      }

      /*
       * La tabla secciones exige:
       * institucion_id
       * año_escolar_id
       * grado_id
       * nombre
       *
       * La columna de estado se llama "activa".
       */
      const datos = {
        institucion_id:
          perfil.institucion_id,

        año_escolar_id:
          anioSeleccionado,

        grado_id:
          formulario.grado_id,

        nombre,

        capacidad,

        activa:
          formulario.activa,
      }

      let resultado

      if (editando) {
        resultado = await supabase
          .from('secciones')
          .update(datos)
          .eq(
            'id',
            editando.id
          )
      } else {
        resultado = await supabase
          .from('secciones')
          .insert(datos)
      }

      if (resultado.error) {
        console.error(
          'ERROR GUARDANDO SECCIÓN:',
          resultado.error
        )

        if (
          resultado.error.code ===
          '23505'
        ) {
          throw new Error(
            'Ya existe esa sección para el grado seleccionado en este año escolar.'
          )
        }

        throw resultado.error
      }

      setMensaje(
        editando
          ? 'Sección actualizada correctamente.'
          : 'Sección creada correctamente.'
      )

      cerrarFormulario()

      await cargarSecciones()
    } catch (error) {
      console.error(
        'ERROR GUARDANDO SECCIÓN:',
        error
      )

      setError(
        error.message ||
        'No se pudo guardar la sección.'
      )
    } finally {
      setGuardando(false)
    }
  }

  const agruparGrados = () => {
    const niveles = {
      inicial: [],
      primaria: [],
      secundaria: [],
    }

    grados.forEach(
      (grado) => {
        if (
          niveles[grado.nivel]
        ) {
          niveles[
            grado.nivel
          ].push(grado)
        }
      }
    )

    return niveles
  }

  const obtenerSecciones = (
    gradoId
  ) => {
    return secciones.filter(
      (seccion) =>
        seccion.grado_id ===
        gradoId
    )
  }

  const nombreNivel = (
    nivel
  ) => {
    const nombres = {
      inicial: 'Inicial',
      primaria: 'Primaria',
      secundaria: 'Secundaria',
    }

    return (
      nombres[nivel] ??
      nivel
    )
  }

  const niveles =
    agruparGrados()

  if (loading) {
    return (
      <div className="grados-page">
        <div className="grados-loading">
          Cargando grados y secciones...
        </div>
      </div>
    )
  }

  return (
    <div className="grados-page">

      {/* ENCABEZADO */}

      <div className="grados-header">

        <div>

          <div className="grados-title-row">

            <div className="grados-title-icon">
              <GraduationCap
                size={28}
              />
            </div>

            <div>

              <h1>
                Grados y secciones
              </h1>

              <p>
                Organiza los grados y
                secciones de cada año
                escolar.
              </p>

            </div>

          </div>

        </div>

        <button
          type="button"
          className="grados-primary-button"
          onClick={() =>
            abrirNuevaSeccion()
          }
        >
          <Plus
            size={18}
          />

          Nueva sección
        </button>

      </div>


      {/* MENSAJES */}

      {mensaje && (
        <div className="grados-success">
          {mensaje}
        </div>
      )}

      {error && (
        <div className="grados-error">
          {error}
        </div>
      )}


      {/* SELECTOR DE AÑO */}

      <div className="grados-year-card">

        <div>

          <label>
            Año escolar
          </label>

          <p>
            Selecciona el año que deseas
            administrar.
          </p>

        </div>

        <select
          value={
            anioSeleccionado
          }
          onChange={(e) =>
            setAnioSeleccionado(
              e.target.value
            )
          }
        >

          <option value="">
            Seleccionar año
          </option>

          {anios.map(
            (anio) => (
              <option
                key={anio.id}
                value={anio.id}
              >
                {anio.nombre}

                {anio.estado ===
                  'activo'
                  ? ' — Activo'
                  : ''}
              </option>
            )
          )}

        </select>

      </div>


      {/* GRADOS */}

      <div className="grados-content">

        {Object.entries(
          niveles
        ).map(
          ([
            nivel,
            gradosNivel,
          ]) => {

            if (
              gradosNivel.length ===
              0
            ) {
              return null
            }

            return (
              <section
                className="grados-level"
                key={nivel}
              >

                <div className="grados-level-header">

                  <div>

                    <h2>
                      {nombreNivel(
                        nivel
                      )}
                    </h2>

                    <span>
                      {
                        gradosNivel.length
                      } grados
                    </span>

                  </div>

                </div>


                <div className="grados-grid">

                  {gradosNivel.map(
                    (grado) => {

                      const seccionesGrado =
                        obtenerSecciones(
                          grado.id
                        )

                      return (
                        <div
                          className="grado-card"
                          key={
                            grado.id
                          }
                        >

                          <div className="grado-card-header">

                            <div>

                              <span className="grado-card-level">
                                {nombreNivel(
                                  grado.nivel
                                )}
                              </span>

                              <h3>
                                {
                                  grado.nombre
                                }
                              </h3>

                            </div>

                            <button
                              type="button"
                              className="grado-add-button"
                              title="Agregar sección"
                              onClick={() =>
                                abrirNuevaSeccion(
                                  grado.id
                                )
                              }
                            >
                              <Plus
                                size={17}
                              />
                            </button>

                          </div>


                          <div className="grado-secciones">

                            {seccionesGrado.length ===
                            0 ? (

                              <div className="grado-empty">

                                <span>
                                  No hay secciones
                                  registradas.
                                </span>

                                <button
                                  type="button"
                                  onClick={() =>
                                    abrirNuevaSeccion(
                                      grado.id
                                    )
                                  }
                                >
                                  Crear sección
                                </button>

                              </div>

                            ) : (

                              seccionesGrado.map(
                                (
                                  seccion
                                ) => (

                                  <div
                                    className={`seccion-row ${
                                      seccion.activa
                                        ? ''
                                        : 'seccion-inactiva'
                                    }`}
                                    key={
                                      seccion.id
                                    }
                                  >

                                    <div className="seccion-main">

                                      <div className="seccion-letter">
                                        {
                                          seccion.nombre
                                        }
                                      </div>

                                      <div className="seccion-info">

                                        <strong>
                                          Sección{' '}
                                          {
                                            seccion.nombre
                                          }
                                        </strong>

                                        <span>
                                          Capacidad:{' '}
                                          {
                                            seccion.capacidad
                                          }
                                        </span>

                                      </div>

                                    </div>


                                    <div className="seccion-actions">

                                      <span
                                        className={
                                          seccion.activa
                                            ? 'seccion-status activo'
                                            : 'seccion-status inactivo'
                                        }
                                      >
                                        {seccion.activa
                                          ? 'Activa'
                                          : 'Inactiva'}
                                      </span>

                                      <button
                                        type="button"
                                        className="seccion-edit-button"
                                        title="Editar sección"
                                        onClick={() =>
                                          abrirEdicion(
                                            seccion
                                          )
                                        }
                                      >
                                        <Pencil
                                          size={16}
                                        />
                                      </button>

                                    </div>

                                  </div>

                                )
                              )

                            )}

                          </div>

                        </div>
                      )
                    }
                  )}

                </div>

              </section>
            )
          }
        )}

      </div>


      {/* FORMULARIO */}

      {formularioAbierto && (
        <div className="grados-modal-overlay">

          <div className="grados-modal">

            <div className="grados-modal-header">

              <div>

                <h2>
                  {editando
                    ? 'Editar sección'
                    : 'Nueva sección'}
                </h2>

                <p>
                  Configura la sección
                  para el año escolar
                  seleccionado.
                </p>

              </div>

              <button
                type="button"
                className="grados-modal-close"
                onClick={
                  cerrarFormulario
                }
                disabled={
                  guardando
                }
              >
                <X
                  size={20}
                />
              </button>

            </div>


            <div className="grados-form">

              <label>
                Año escolar

                <input
                  type="text"
                  value={
                    anios.find(
                      (anio) =>
                        anio.id ===
                        anioSeleccionado
                    )?.nombre ??
                    ''
                  }
                  disabled
                />
              </label>


              <label>
                Grado

                <select
                  value={
                    formulario.grado_id
                  }
                  onChange={(e) =>
                    actualizarCampo(
                      'grado_id',
                      e.target.value
                    )
                  }
                >

                  <option value="">
                    Seleccionar grado
                  </option>

                  {grados.map(
                    (grado) => (
                      <option
                        key={
                          grado.id
                        }
                        value={
                          grado.id
                        }
                      >
                        {grado.nombre}
                      </option>
                    )
                  )}

                </select>
              </label>


              <label>
                Nombre de sección

                <input
                  type="text"
                  value={
                    formulario.nombre
                  }
                  onChange={(e) =>
                    actualizarCampo(
                      'nombre',
                      e.target.value
                    )
                  }
                  placeholder="Ejemplo: A"
                  maxLength={20}
                />
              </label>


              <label>
                Capacidad

                <input
                  type="number"
                  min="1"
                  value={
                    formulario.capacidad
                  }
                  onChange={(e) =>
                    actualizarCampo(
                      'capacidad',
                      e.target.value
                    )
                  }
                />
              </label>


              <label className="grados-checkbox">

                <input
                  type="checkbox"
                  checked={
                    formulario.activa
                  }
                  onChange={(e) =>
                    actualizarCampo(
                      'activa',
                      e.target.checked
                    )
                  }
                />

                <span>
                  Sección activa
                </span>

              </label>

            </div>


            <div className="grados-modal-footer">

              <button
                type="button"
                className="grados-cancel-button"
                onClick={
                  cerrarFormulario
                }
                disabled={
                  guardando
                }
              >
                Cancelar
              </button>

              <button
                type="button"
                className="grados-save-button"
                onClick={
                  guardarSeccion
                }
                disabled={
                  guardando
                }
              >

                <Save
                  size={17}
                />

                {guardando
                  ? 'Guardando...'
                  : 'Guardar sección'}

              </button>

            </div>

          </div>

        </div>
      )}

    </div>
  )
}

export default GradosSecciones