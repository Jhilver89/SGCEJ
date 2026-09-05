import { useEffect, useState } from 'react'
import {
  Settings,
  Save,
  RefreshCw,
  Clock3,
  DoorOpen,
  AlertTriangle,
  MessageSquare,
  ShieldCheck,
} from 'lucide-react'
import { supabase } from '../../lib/supabase'
import './Configuracion.css'

const valoresIniciales = {
  zona_horaria: 'America/Lima',
  hora_inicio_jornada: '07:30',
  hora_fin_jornada: '15:30',
  salidas_habilitadas: true,
  max_salidas_simultaneas: 1,
  observacion_salida_obligatoria: false,
  incidencias_habilitadas: true,
  mensajes_habilitados: true,
  permitir_mensajes_usuarios: true,
}

function Configuracion() {
  const [config, setConfig] = useState(valoresIniciales)
  const [institucionId, setInstitucionId] = useState(null)
  const [cargando, setCargando] = useState(true)
  const [guardando, setGuardando] = useState(false)
  const [mensaje, setMensaje] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    cargarConfiguracion()
  }, [])

  async function cargarConfiguracion() {
    setCargando(true)
    setError('')
    setMensaje('')

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser()

      if (userError) throw userError
      if (!user) throw new Error('No hay una sesión autenticada.')

      const { data: perfil, error: perfilError } = await supabase
        .from('perfiles')
        .select('institucion_id, rol, activo')
        .eq('id', user.id)
        .single()

      if (perfilError) throw perfilError

      if (perfil.rol !== 'administrador' || perfil.activo !== true) {
        throw new Error('Solo un administrador activo puede gestionar la configuración.')
      }

      setInstitucionId(perfil.institucion_id)

      const { data, error: configError } = await supabase
        .from('configuracion_sistema')
        .select(
          'zona_horaria, hora_inicio_jornada, hora_fin_jornada, salidas_habilitadas, max_salidas_simultaneas, observacion_salida_obligatoria, incidencias_habilitadas, mensajes_habilitados, permitir_mensajes_usuarios'
        )
        .eq('institucion_id', perfil.institucion_id)
        .maybeSingle()

      if (configError) throw configError

      if (data) {
        setConfig({
          zona_horaria: data.zona_horaria ?? valoresIniciales.zona_horaria,
          hora_inicio_jornada: data.hora_inicio_jornada?.slice(0, 5) ?? valoresIniciales.hora_inicio_jornada,
          hora_fin_jornada: data.hora_fin_jornada?.slice(0, 5) ?? valoresIniciales.hora_fin_jornada,
          salidas_habilitadas: data.salidas_habilitadas ?? true,
          max_salidas_simultaneas: data.max_salidas_simultaneas ?? 1,
          observacion_salida_obligatoria: data.observacion_salida_obligatoria ?? false,
          incidencias_habilitadas: data.incidencias_habilitadas ?? true,
          mensajes_habilitados: data.mensajes_habilitados ?? true,
          permitir_mensajes_usuarios: data.permitir_mensajes_usuarios ?? true,
        })
      }
    } catch (err) {
      console.error(err)
      setError(err.message || 'No se pudo cargar la configuración.')
    } finally {
      setCargando(false)
    }
  }

  function cambiar(campo, valor) {
    setConfig((actual) => ({
      ...actual,
      [campo]: valor,
    }))
    setMensaje('')
    setError('')
  }

  async function guardarConfiguracion(event) {
    event.preventDefault()

    if (!institucionId) {
      setError('No se encontró la institución del usuario.')
      return
    }

    if (config.hora_fin_jornada <= config.hora_inicio_jornada) {
      setError('La hora de fin de jornada debe ser posterior a la hora de inicio.')
      return
    }

    if (Number(config.max_salidas_simultaneas) < 1) {
      setError('El máximo de salidas simultáneas debe ser como mínimo 1.')
      return
    }

    setGuardando(true)
    setError('')
    setMensaje('')

    try {
      const { error: saveError } = await supabase
        .from('configuracion_sistema')
        .upsert(
          {
            institucion_id: institucionId,
            zona_horaria: config.zona_horaria,
            hora_inicio_jornada: config.hora_inicio_jornada,
            hora_fin_jornada: config.hora_fin_jornada,
            salidas_habilitadas: Boolean(config.salidas_habilitadas),
            max_salidas_simultaneas: Number(config.max_salidas_simultaneas),
            observacion_salida_obligatoria: Boolean(config.observacion_salida_obligatoria),
            incidencias_habilitadas: Boolean(config.incidencias_habilitadas),
            mensajes_habilitados: Boolean(config.mensajes_habilitados),
            permitir_mensajes_usuarios: Boolean(config.permitir_mensajes_usuarios),
          },
          { onConflict: 'institucion_id' }
        )

      if (saveError) throw saveError

      setMensaje('Configuración guardada correctamente.')
    } catch (err) {
      console.error(err)
      setError(err.message || 'No se pudo guardar la configuración.')
    } finally {
      setGuardando(false)
    }
  }

  if (cargando) {
    return (
      <div className="configuracion-page">
        <div className="configuracion-loading">
          <RefreshCw className="spin" size={22} />
          <span>Cargando configuración...</span>
        </div>
      </div>
    )
  }

  return (
    <div className="configuracion-page">
      <div className="configuracion-header">
        <div className="configuracion-title">
          <div className="configuracion-title-icon">
            <Settings size={28} />
          </div>
          <div>
            <h1>Configuración</h1>
            <p>Define los parámetros generales de funcionamiento del SGCE.</p>
          </div>
        </div>
      </div>

      {error && <div className="config-alert error">{error}</div>}
      {mensaje && <div className="config-alert success">{mensaje}</div>}

      <form onSubmit={guardarConfiguracion}>
        <section className="config-card">
          <div className="config-card-header">
            <div className="config-section-icon blue">
              <Clock3 size={21} />
            </div>
            <div>
              <h2>Jornada y horario</h2>
              <p>Parámetros generales de horario utilizados por los módulos operativos.</p>
            </div>
          </div>

          <div className="config-grid">
            <label>
              <span>Zona horaria</span>
              <select
                value={config.zona_horaria}
                onChange={(e) => cambiar('zona_horaria', e.target.value)}
              >
                <option value="America/Lima">America/Lima (Perú)</option>
              </select>
            </label>

            <label>
              <span>Hora de inicio</span>
              <input
                type="time"
                value={config.hora_inicio_jornada}
                onChange={(e) => cambiar('hora_inicio_jornada', e.target.value)}
              />
            </label>

            <label>
              <span>Hora de fin</span>
              <input
                type="time"
                value={config.hora_fin_jornada}
                onChange={(e) => cambiar('hora_fin_jornada', e.target.value)}
              />
            </label>
          </div>
        </section>

        <section className="config-card">
          <div className="config-card-header">
            <div className="config-section-icon green">
              <DoorOpen size={21} />
            </div>
            <div>
              <h2>Salidas</h2>
              <p>Controla el comportamiento general del registro de salidas.</p>
            </div>
          </div>

          <div className="config-options">
            <div className="config-option">
              <div>
                <strong>Habilitar registro de salidas</strong>
                <small>Permite utilizar el módulo de Salidas.</small>
              </div>
              <button
                type="button"
                className={`config-switch ${config.salidas_habilitadas ? 'on' : ''}`}
                onClick={() => cambiar('salidas_habilitadas', !config.salidas_habilitadas)}
                aria-label="Habilitar registro de salidas"
              >
                <span />
              </button>
            </div>

            <div className="config-option">
              <div>
                <strong>Observación obligatoria</strong>
                <small>Exige una observación al registrar una salida.</small>
              </div>
              <button
                type="button"
                className={`config-switch ${config.observacion_salida_obligatoria ? 'on' : ''}`}
                onClick={() =>
                  cambiar(
                    'observacion_salida_obligatoria',
                    !config.observacion_salida_obligatoria
                  )
                }
                aria-label="Observación obligatoria"
              >
                <span />
              </button>
            </div>

            <label className="config-number">
              <span>Máximo de salidas simultáneas</span>
              <input
                type="number"
                min="1"
                max="20"
                value={config.max_salidas_simultaneas}
                onChange={(e) =>
                  cambiar('max_salidas_simultaneas', e.target.value)
                }
              />
            </label>
          </div>
        </section>

        <section className="config-card">
          <div className="config-card-header">
            <div className="config-section-icon orange">
              <AlertTriangle size={21} />
            </div>
            <div>
              <h2>Incidencias</h2>
              <p>Activa o desactiva el registro de incidencias del sistema.</p>
            </div>
          </div>

          <div className="config-options">
            <div className="config-option">
              <div>
                <strong>Habilitar incidencias</strong>
                <small>Permite registrar y consultar incidencias.</small>
              </div>
              <button
                type="button"
                className={`config-switch ${config.incidencias_habilitadas ? 'on' : ''}`}
                onClick={() =>
                  cambiar('incidencias_habilitadas', !config.incidencias_habilitadas)
                }
                aria-label="Habilitar incidencias"
              >
                <span />
              </button>
            </div>
          </div>
        </section>

        <section className="config-card">
          <div className="config-card-header">
            <div className="config-section-icon purple">
              <MessageSquare size={21} />
            </div>
            <div>
              <h2>Mensajes</h2>
              <p>Controla el sistema interno de comunicación entre usuarios.</p>
            </div>
          </div>

          <div className="config-options">
            <div className="config-option">
              <div>
                <strong>Habilitar mensajes</strong>
                <small>Permite utilizar el módulo de Mensajes.</small>
              </div>
              <button
                type="button"
                className={`config-switch ${config.mensajes_habilitados ? 'on' : ''}`}
                onClick={() =>
                  cambiar('mensajes_habilitados', !config.mensajes_habilitados)
                }
                aria-label="Habilitar mensajes"
              >
                <span />
              </button>
            </div>

            <div className="config-option">
              <div>
                <strong>Permitir mensajes entre usuarios</strong>
                <small>Los usuarios podrán comunicarse mediante el sistema.</small>
              </div>
              <button
                type="button"
                className={`config-switch ${config.permitir_mensajes_usuarios ? 'on' : ''}`}
                onClick={() =>
                  cambiar(
                    'permitir_mensajes_usuarios',
                    !config.permitir_mensajes_usuarios
                  )
                }
                aria-label="Permitir mensajes entre usuarios"
              >
                <span />
              </button>
            </div>
          </div>
        </section>

        <section className="config-card security-card">
          <div className="config-card-header">
            <div className="config-section-icon slate">
              <ShieldCheck size={21} />
            </div>
            <div>
              <h2>Seguridad</h2>
              <p>La configuración es administrada desde el panel del administrador y protegida mediante las políticas de Supabase.</p>
            </div>
          </div>
        </section>

        <div className="config-footer">
          <button type="button" className="btn-secondary" onClick={cargarConfiguracion} disabled={guardando}>
            <RefreshCw size={17} />
            Recargar
          </button>

          <button type="submit" className="btn-primary" disabled={guardando}>
            {guardando ? <RefreshCw className="spin" size={17} /> : <Save size={17} />}
            {guardando ? 'Guardando...' : 'Guardar configuración'}
          </button>
        </div>
      </form>
    </div>
  )
}

export default Configuracion
