import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Eye,
  EyeOff,
  LockKeyhole,
  Mail,
  ShieldCheck,
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import './Login.css'

function Login() {
  const navigate = useNavigate()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (event) => {
    event.preventDefault()

    setError('')

    if (!email.trim() || !password) {
      setError('Ingresa tu correo electrónico y contraseña.')
      return
    }

    setLoading(true)

    const { error: loginError } =
      await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      })

    if (loginError) {
      console.error('ERROR LOGIN SUPABASE:', loginError)

      setError(loginError.message)
      setLoading(false)

      return
    }

    console.log('LOGIN CORRECTO')

    navigate('/app')
  }

  return (
    <main className="login-page">
      <section className="login-card">
        <div className="login-brand">
          <div className="login-logo">
            <ShieldCheck size={30} strokeWidth={2} />
          </div>

          <div>
            <h1>SGCE</h1>
            <span>
              Sistema de Gestión del Centro Educativo
            </span>
          </div>
        </div>

        <div className="login-heading">
          <h2>Bienvenido</h2>
          <p>Ingresa tus credenciales para continuar.</p>
        </div>

        <form onSubmit={handleSubmit} className="login-form">
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
                onChange={(event) =>
                  setEmail(event.target.value)
                }
                placeholder="correo@ejemplo.com"
                autoComplete="email"
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
                onChange={(event) =>
                  setPassword(event.target.value)
                }
                placeholder="Ingresa tu contraseña"
                autoComplete="current-password"
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
            {loading ? 'Ingresando...' : 'Iniciar sesión'}
          </button>
        </form>

        <div className="login-footer">
          SGCE · Gestión educativa
          <span>Desarrollado por Jhilver</span>
        </div>
      </section>
    </main>
  )
}

export default Login