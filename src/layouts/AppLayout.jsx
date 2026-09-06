import { NavLink, Outlet } from 'react-router-dom'
import {
  BookOpen,
  LayoutDashboard,
  LogOut,
  MessageSquare,
  ShieldCheck,
  UserRound,
  AlertTriangle,
} from 'lucide-react'

import { useAuth } from '../context/AuthContext'
import './AppLayout.css'

function AppLayout() {
  const { user, profile, logout } = useAuth()

  const menuItems = [
    {
      label: 'Dashboard',
      path: '/app',
      icon: LayoutDashboard,
    },
    {
      label: 'Salidas',
      path: '/app/salidas',
      icon: BookOpen,
    },
    {
      label: 'Incidencias',
      path: '/app/incidencias',
      icon: AlertTriangle,
    },
    {
      label: 'Mensajes',
      path: '/app/mensajes',
      icon: MessageSquare,
    },
  ]

  return (
    <div className="app-layout">

      <aside className="sidebar">

        {/* ==================================================
            MARCA
        ================================================== */}

        <div className="sidebar-brand">

          <div className="sidebar-logo">
            <ShieldCheck size={25} />
          </div>

          <div>
            <strong>SGCE</strong>
            <span>Gestión educativa</span>
          </div>

        </div>


        {/* ==================================================
            MENÚ
        ================================================== */}

        <nav className="sidebar-nav">

          <p className="sidebar-section-title">
            PRINCIPAL
          </p>

          {menuItems.map((item) => {

            const Icon = item.icon

            return (
              <NavLink
                key={item.path}
                to={item.path}
                end={item.path === '/app'}
                className={({ isActive }) =>
                  `sidebar-link ${
                    isActive ? 'active' : ''
                  }`
                }
              >

                <Icon size={19} />

                <span>
                  {item.label}
                </span>

              </NavLink>
            )

          })}

        </nav>


        {/* ==================================================
            USUARIO / CERRAR SESIÓN
        ================================================== */}

        <div className="sidebar-bottom">

          <div className="sidebar-user">

            <div className="user-avatar">
              <UserRound size={18} />
            </div>

            <div className="user-info">

              <strong>
                {profile
                  ? `${profile.nombres || ''} ${profile.apellidos || ''}`.trim()
                  : 'Usuario'}
              </strong>

              <span>
                {user?.email || ''}
              </span>

            </div>

          </div>


          <button
            type="button"
            className="logout-button"
            onClick={logout}
          >

            <LogOut size={18} />

            <span>
              Cerrar sesión
            </span>

          </button>

        </div>

      </aside>


      {/* ==================================================
          CONTENIDO
      ================================================== */}

      <main className="app-main">

        <header className="app-header">

          <div>

            <h1>
              Dashboard
            </h1>

            <p>
              Resumen general del centro educativo
            </p>

          </div>

        </header>


        <section className="app-content">
          <Outlet />
        </section>

      </main>

    </div>
  )
}

export default AppLayout