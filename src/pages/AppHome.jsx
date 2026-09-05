import { useAuth } from '../context/AuthContext'

function AppHome() {
  const { user, logout } = useAuth()

  return (
    <div
      style={{
        minHeight: '100vh',
        padding: '40px',
        background: '#f4f6f9',
        fontFamily: 'Arial, sans-serif',
      }}
    >
      <h1>SGCE</h1>

      <p>Sesión iniciada correctamente.</p>

      <p>
        Usuario: <strong>{user?.email}</strong>
      </p>

      <button onClick={logout}>
        Cerrar sesión
      </button>
    </div>
  )
}

export default AppHome