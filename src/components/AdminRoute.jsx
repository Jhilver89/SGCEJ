import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

function AdminRoute({ children }) {
  const { user, profile, loading } = useAuth()

  if (loading) {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: 'Arial, sans-serif',
        }}
      >
        Cargando...
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/login" replace />
  }

  if (!profile) {
    return <Navigate to="/app" replace />
  }

  if (profile.rol !== 'administrador') {
    return <Navigate to="/app" replace />
  }

  if (!profile.activo) {
    return <Navigate to="/login" replace />
  }

  return children
}

export default AdminRoute