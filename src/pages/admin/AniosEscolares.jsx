import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  CalendarDays,
  Plus,
  Pencil,
  X,
} from 'lucide-react'
import { supabase } from '../../lib/supabase'
import './AniosEscolares.css'

function AniosEscolares() {
  const navigate = useNavigate()

  const [anios, setAnios] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [showForm, setShowForm] = useState(false)

  const [form, setForm] = useState({
    nombre: '',
    fecha_inicio: '',
    fecha_fin: '',
    estado: 'planificado',
  })

  const cargarAnios = async () => {
    setLoading(true)
    setError('')

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      setError('No hay una sesión activa.')
      setLoading(false)
      return
    }

    const { data: perfil, error: perfilError } =
      await supabase
        .from('perfiles')
        .select('institucion_id')
        .eq('id', user.id)
        .single()

    if (perfilError) {
      console.error(
        'ERROR CARGANDO PERFIL:',
        perfilError
      )

      setError(
        'No se pudo obtener la institución del usuario.'
      )

      setLoading(false)
      return
    }

    const { data, error: aniosError } =
      await supabase
        .from('años_escolares')
        .select(
          'id, nombre, fecha_inicio, fecha_fin, estado, created_at'
        )
        .eq(
          'institucion_id',
          perfil.institucion_id
        )
        .order('fecha_inicio', {
          ascending: false,
        })

    if (aniosError) {
      console.error(
        'ERROR CARGANDO AÑOS ESCOLARES:',
        aniosError
      )

      setError(
        'No se pudieron cargar los años escolares.'
      )

      setLoading(false)
      return
    }

    setAnios(data ?? [])
    setLoading(false)
  }

  useEffect(() => {
    cargarAnios()
  }, [])

  const abrirNuevo = () => {
    setForm({
      nombre: '',
      fecha_inicio: '',
      fecha_fin: '',
      estado: 'planificado',
    })

    setError('')
    setShowForm(true)
  }

  const cerrarFormulario = () => {
    if (saving) return

    setShowForm(false)
    setError('')
  }

  const handleChange = (event) => {
    const { name, value } = event.target

    setForm((actual) => ({
      ...actual,
      [name]: value,
    }))

    setError('')
  }

  const guardarAnio = async (event) => {
    event.preventDefault()
    setError('')

    if (!form.nombre.trim()) {
      setError(
        'Ingresa el nombre del año escolar.'
      )
      return
    }

    if (
      !form.fecha_inicio ||
      !form.fecha_fin
    ) {
      setError(
        'Ingresa las fechas de inicio y fin.'
      )
      return
    }

    if (
      form.fecha_fin <
      form.fecha_inicio
    ) {
      setError(
        'La fecha de fin no puede ser anterior a la fecha de inicio.'
      )
      return
    }

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      setError('La sesión ha expirado.')
      return
    }

    const {
      data: perfil,
      error: perfilError,
    } = await supabase
      .from('perfiles')
      .select('institucion_id')
      .eq('id', user.id)
      .single()

    if (perfilError) {
      console.error(
        'ERROR CARGANDO PERFIL:',
        perfilError
      )

      setError(
        'No se pudo determinar la institución.'
      )

      return
    }

    setSaving(true)

    const {
      data: anioId,
      error: crearError,
    } = await supabase.rpc(
      'crear_anio_escolar_completo',
      {
        p_institucion_id:
          perfil.institucion_id,
        p_nombre:
          form.nombre.trim(),
        p_fecha_inicio:
          form.fecha_inicio,
        p_fecha_fin:
          form.fecha_fin,
        p_estado:
          form.estado,
      }
    )

    if (crearError) {
      console.error(
        'ERROR CREANDO AÑO ESCOLAR COMPLETO:',
        crearError
      )

      setError(
        crearError.message ||
          'No se pudo crear el año escolar.'
      )

      setSaving(false)
      return
    }

    console.log(
      'AÑO ESCOLAR CREADO CORRECTAMENTE:',
      anioId
    )

    setShowForm(false)
    setSaving(false)

    await cargarAnios()
  }

  const estadoTexto = (estado) => {
    const estados = {
      planificado: 'Planificado',
      activo: 'Activo',
      cerrado: 'Cerrado',
    }

    return estados[estado] ?? estado
  }

  return (
    <div className="anios-page">

      <div className="anios-header">
        <div>
          <h1>Años escolares</h1>

          <p>
            Administra los periodos académicos
            del centro educativo.
          </p>
        </div>

        <button
          type="button"
          className="anios-primary-button"
          onClick={abrirNuevo}
          disabled={saving}
        >
          <Plus size={18} />
          Nuevo año escolar
        </button>
      </div>

      {error && (
        <div className="anios-error">
          {error}
        </div>
      )}

      {showForm && (
        <section className="anios-card anios-form-card">

          <div className="anios-card-header">
            <div>
              <h2>
                Nuevo año escolar
              </h2>

              <p>
                Registra un nuevo periodo
                académico.
              </p>
            </div>

            <button
              type="button"
              className="anios-close-button"
              onClick={cerrarFormulario}
              disabled={saving}
              aria-label="Cerrar"
            >
              <X size={20} />
            </button>
          </div>

          <form onSubmit={guardarAnio}>

            <div className="anios-form-grid">

              <div className="anios-field">
                <label htmlFor="nombre">
                  Nombre del año escolar *
                </label>

                <input
                  id="nombre"
                  name="nombre"
                  type="text"
                  value={form.nombre}
                  onChange={handleChange}
                  placeholder="Ej. 2027"
                  disabled={saving}
                />
              </div>

              <div className="anios-field">
                <label htmlFor="estado">
                  Estado
                </label>

                <select
                  id="estado"
                  name="estado"
                  value={form.estado}
                  onChange={handleChange}
                  disabled={saving}
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
              </div>

              <div className="anios-field">
                <label htmlFor="fecha_inicio">
                  Fecha de inicio *
                </label>

                <input
                  id="fecha_inicio"
                  name="fecha_inicio"
                  type="date"
                  value={form.fecha_inicio}
                  onChange={handleChange}
                  disabled={saving}
                />
              </div>

              <div className="anios-field">
                <label htmlFor="fecha_fin">
                  Fecha de fin *
                </label>

                <input
                  id="fecha_fin"
                  name="fecha_fin"
                  type="date"
                  value={form.fecha_fin}
                  onChange={handleChange}
                  disabled={saving}
                />
              </div>

            </div>

            <div className="anios-form-actions">

              <button
                type="button"
                className="anios-secondary-button"
                onClick={cerrarFormulario}
                disabled={saving}
              >
                Cancelar
              </button>

              <button
                type="submit"
                className="anios-primary-button"
                disabled={saving}
              >
                {saving
                  ? 'Creando año escolar...'
                  : 'Guardar año escolar'}
              </button>

            </div>

          </form>

        </section>
      )}

      <section className="anios-card">

        <div className="anios-card-header">
          <div>
            <h2>
              Periodos académicos
            </h2>

            <p>
              Años escolares registrados
              en la institución.
            </p>
          </div>
        </div>

        {loading ? (
          <div className="anios-empty">
            Cargando años escolares...
          </div>
        ) : anios.length === 0 ? (
          <div className="anios-empty">
            <CalendarDays size={42} />

            <strong>
              No hay años escolares registrados.
            </strong>

            <span>
              Crea el primer año escolar
              para comenzar.
            </span>
          </div>
        ) : (
          <div className="anios-table-wrapper">

            <table className="anios-table">

              <thead>
                <tr>
                  <th>Año escolar</th>
                  <th>Inicio</th>
                  <th>Fin</th>
                  <th>Estado</th>
                  <th></th>
                </tr>
              </thead>

              <tbody>

                {anios.map((anio) => (
                  <tr key={anio.id}>

                    <td>
                      <strong>
                        {anio.nombre}
                      </strong>
                    </td>

                    <td>
                      {anio.fecha_inicio}
                    </td>

                    <td>
                      {anio.fecha_fin}
                    </td>

                    <td>
                      <span
                        className={`anios-status anios-status-${anio.estado}`}
                      >
                        {estadoTexto(
                          anio.estado
                        )}
                      </span>
                    </td>

                    <td>
                      <button
                        type="button"
                        className="anios-icon-button"
                        title="Ver estructura académica"
                        onClick={() =>
                          navigate(
                            `/admin/anios-escolares/${anio.id}`
                          )
                        }
                      >
                        <Pencil size={17} />
                      </button>
                    </td>

                  </tr>
                ))}

              </tbody>

            </table>

          </div>
        )}

      </section>

    </div>
  )
}

export default AniosEscolares