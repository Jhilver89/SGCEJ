import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Eye, EyeOff, LockKeyhole, Mail, ShieldCheck } from 'lucide-react'

import { supabase } from '../lib/supabase'
import './Login.css'

function Login() {
  const navigate = useNavigate()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()

    setError('')
    setLoading(true)

    try {
      const { data, error: loginError } =
        await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        })

      if (loginError) {
        setError('Correo o contraseña incorrectos.')
        return
      }

      if (!data?.user) {
        setError('No se pudo iniciar la sesión.')
        return
      }

      // ==================================================
      // OBTENER PERFIL Y ROL
      // ==================================================

      const { data: perfil, error: perfilError } =
        await supabase
          .from('perfiles')
          .select(`
            id,
            nombres,
            apellidos,
            email,
            rol,
            activo,
            institucion_id
          `)
          .eq('id', data.user.id)
          .single()

      if (perfilError || !perfil) {
        await supabase.auth.signOut()
        setError('No se encontró el perfil del usuario.')
        return
      }

      // ==================================================
      // VALIDAR USUARIO ACTIVO
      // ==================================================

      if (!perfil.activo) {
        await supabase.auth.signOut()
        setError('El usuario se encuentra inactivo.')
        return
      }

      // ==================================================
      // REDIRECCIÓN SEGÚN ROL
      // ==================================================

      if (perfil.rol === 'administrador') {
        navigate('/admin', { replace: true })
        return
      }

      if (perfil.rol === 'usuario') {
        navigate('/app', { replace: true })
        return
      }

      // ==================================================
      // ROL NO VÁLIDO
      // ==================================================

      await supabase.auth.signOut()
      setError('El rol del usuario no es válido.')

    } catch (err) {
      console.error(err)
      setError('Ocurrió un error al iniciar sesión.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="login-page">

      <div className="login-card">

        <div className="login-brand">

          <div className="login-logo">
            <ShieldCheck size={30} />
          </div>

          <div>
            <strong>SGCE</strong>
            <span>Gestión educativa</span>
          </div>

        </div>

        <div className="login-header">

          <h1>Bienvenido</h1>

          <p>
            Ingresa tus credenciales para continuar
          </p>

        </div>

        <form
          className="login-form"
          onSubmit={handleSubmit}
        >

          <div className="form-group">

            <label htmlFor="email">
              Correo electrónico
            </label>

            <div className="input-wrapper">

              <Mail size={19} />

              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="correo@vancouver.edu.pe"
                autoComplete="email"
                required
              />

            </div>

          </div>


          <div className="form-group">

            <label htmlFor="password">
              Contraseña
            </label>

            <div className="input-wrapper">

              <LockKeyhole size={19} />

              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Ingresa tu contraseña"
                autoComplete="current-password"
                required
              />

              <button
                type="button"
                className="password-toggle"
                onClick={() =>
                  setShowPassword(!showPassword)
                }
                aria-label={
                  showPassword
                    ? 'Ocultar contraseña'
                    : 'Mostrar contraseña'
                }
              >

                {showPassword ? (
                  <EyeOff size={19} />
                ) : (
                  <Eye size={19} />
                )}

              </button>

            </div>

          </div>


          {error && (
            <div className="login-error">
              {error}
            </div>
          )}


          <button
            type="submit"
            className="login-button"
            disabled={loading}
          >
            {loading
              ? 'Ingresando...'
              : 'Iniciar sesión'}
          </button>

        </form>


        <div className="login-footer">
          Colegio Vancouver
        </div>

      </div>

    </div>
  )
}

export default Login