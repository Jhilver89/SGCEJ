import { useEffect, useState } from 'react'
import { Save } from 'lucide-react'

import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import './Institucion.css'

function Institucion() {
  const { profile } = useAuth()

  const [form, setForm] = useState({
    nombre: '',
    codigo_modular: '',
    direccion: '',
    telefono: '',
    correo: '',
  })

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    const loadInstitution = async () => {
      if (!profile?.institucion_id) {
        setError('El usuario no tiene una institución asignada.')
        setLoading(false)
        return
      }

      const { data, error: queryError } = await supabase
        .from('instituciones')
        .select(`
          id,
          nombre,
          codigo_modular,
          direccion,
          telefono,
          correo
        `)
        .eq('id', profile.institucion_id)
        .single()

      if (queryError) {
        console.error('ERROR CARGANDO INSTITUCIÓN:', queryError)
        setError('No se pudo cargar la información de la institución.')
        setLoading(false)
        return
      }

      setForm({
        nombre: data.nombre ?? '',
        codigo_modular: data.codigo_modular ?? '',
        direccion: data.direccion ?? '',
        telefono: data.telefono ?? '',
        correo: data.correo ?? '',
      })

      setLoading(false)
    }

    loadInstitution()
  }, [profile?.institucion_id])

  const handleChange = (event) => {
    const { name, value } = event.target

    setForm((current) => ({
      ...current,
      [name]: value,
    }))

    setMessage('')
    setError('')
  }

  const handleSubmit = async (event) => {
    event.preventDefault()

    setMessage('')
    setError('')

    if (!form.nombre.trim()) {
      setError('El nombre de la institución es obligatorio.')
      return
    }

    if (!profile?.institucion_id) {
      setError('No se encontró la institución del usuario.')
      return
    }

    setSaving(true)

    const { error: updateError } = await supabase
      .from('instituciones')
      .update({
        nombre: form.nombre.trim(),
        codigo_modular: form.codigo_modular.trim() || null,
        direccion: form.direccion.trim() || null,
        telefono: form.telefono.trim() || null,
        correo: form.correo.trim() || null,
      })
      .eq('id', profile.institucion_id)

    if (updateError) {
      console.error('ERROR ACTUALIZANDO INSTITUCIÓN:', updateError)
      setError('No se pudo guardar la información.')
      setSaving(false)
      return
    }

    setMessage('Información de la institución guardada correctamente.')
    setSaving(false)
  }

  if (loading) {
    return (
      <div className="institution-loading">
        Cargando información de la institución...
      </div>
    )
  }

  return (
    <div className="institution-page">
      <div className="institution-title">
        <div>
          <h2>Institución educativa</h2>
          <p>
            Administra los datos generales del centro educativo.
          </p>
        </div>
      </div>

      <form
        className="institution-card"
        onSubmit={handleSubmit}
      >
        <div className="institution-card-header">
          <div>
            <h3>Datos generales</h3>
            <p>
              Esta información será utilizada en diferentes
              módulos y reportes del SGCE.
            </p>
          </div>
        </div>

        <div className="institution-form-grid">
          <div className="institution-field institution-field-full">
            <label htmlFor="nombre">
              Nombre de la institución *
            </label>

            <input
              id="nombre"
              name="nombre"
              type="text"
              value={form.nombre}
              onChange={handleChange}
              placeholder="Nombre de la institución"
            />
          </div>

          <div className="institution-field">
            <label htmlFor="codigo_modular">
              Código modular
            </label>

            <input
              id="codigo_modular"
              name="codigo_modular"
              type="text"
              value={form.codigo_modular}
              onChange={handleChange}
              placeholder="Código modular"
            />
          </div>

          <div className="institution-field">
            <label htmlFor="telefono">
              Teléfono
            </label>

            <input
              id="telefono"
              name="telefono"
              type="text"
              value={form.telefono}
              onChange={handleChange}
              placeholder="Número telefónico"
            />
          </div>

          <div className="institution-field institution-field-full">
            <label htmlFor="direccion">
              Dirección
            </label>

            <input
              id="direccion"
              name="direccion"
              type="text"
              value={form.direccion}
              onChange={handleChange}
              placeholder="Dirección de la institución"
            />
          </div>

          <div className="institution-field institution-field-full">
            <label htmlFor="correo">
              Correo institucional
            </label>

            <input
              id="correo"
              name="correo"
              type="email"
              value={form.correo}
              onChange={handleChange}
              placeholder="correo@institucion.edu.pe"
            />
          </div>
        </div>

        {error && (
          <div className="institution-message institution-error">
            {error}
          </div>
        )}

        {message && (
          <div className="institution-message institution-success">
            {message}
          </div>
        )}

        <div className="institution-actions">
          <button
            type="submit"
            className="institution-save"
            disabled={saving}
          >
            <Save size={18} />

            {saving
              ? 'Guardando...'
              : 'Guardar cambios'}
          </button>
        </div>
      </form>
    </div>
  )
}

export default Institucion