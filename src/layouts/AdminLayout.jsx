import { NavLink, Outlet } from 'react-router-dom'
import {
  AlertTriangle,
  BarChart3,
  BookOpen,
  Building2,
  CalendarDays,
  GraduationCap,
  LayoutDashboard,
  LogOut,
  MessageSquare,
  ShieldCheck,
  Users,
  UserRoundCog,
} from 'lucide-react'

import { useAuth } from '../context/AuthContext'
import './AdminLayout.css'

const adminMenu = [
  {
    section: 'PRINCIPAL',
    items: [
      {
        label: 'Dashboard',
        path: '/admin',
        icon: LayoutDashboard,
      },
    ],
  },

  {
    section: 'GESTIÓN ACADÉMICA',
    items: [
      {
        label: 'Años escolares',
        path: '/admin/años-escolares',
        icon: CalendarDays,
      },
      {
        label: 'Grados y secciones',
        path: '/admin/grados-secciones',
        icon: BookOpen,
      },
      {
        label: 'Estudiantes',
        path: '/admin/estudiantes',
        icon: GraduationCap,
      },
      {
        label: 'Docentes',
        path: '/admin/docentes',
        icon: Users,
      },
      {
        label: 'Matrículas',
        path: '/admin/matriculas',
        icon: BarChart3,
      },
    ],
  },

  {
    section: 'GESTIÓN OPERATIVA',
    items: [
      {
        label: 'Salidas',
        path: '/admin/salidas',
        icon: LogOut,
      },
      {
        label: 'Incidencias',
        path: '/admin/incidencias',
        icon: AlertTriangle,
      },
      {
        label: 'Mensajes',
        path: '/admin/mensajes',
        icon: MessageSquare,
      },
    ],
  },

  {
    section: 'ADMINISTRACIÓN',
    items: [
      {
        label: 'Usuarios',
        path: '/admin/usuarios',
        icon: UserRoundCog,
      },
      {
        label: 'Institución',
        path: '/admin/institucion',
        icon: Building2,
      },
      {
        label: 'Reportes',
        path: '/admin/reportes',
        icon: BarChart3,
      },
    ],
  },
]

function AdminLayout() {
  const { profile, logout } = useAuth()

  const handleLogout = async () => {
    await logout()
  }

  return (
    <div className="admin-layout">
      <aside className="admin-sidebar">
        <div className="admin-brand">
          <div className="admin-logo">
            <ShieldCheck size={30} strokeWidth={2} />
          </div>

          <div>
            <h1>SGCE</h1>
            <span>Administración</span>
          </div>
        </div>

        <nav className="admin-navigation">
          {adminMenu.map((group) => (
            <div
              className="admin-nav-group"
              key={group.section}
            >
              <div className="admin-nav-section">
                {group.section}
              </div>

              {group.items.map((item) => {
                const Icon = item.icon

                return (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    end={item.path === '/admin'}
                    className={({ isActive }) =>
                      `admin-nav-link ${
                        isActive ? 'active' : ''
                      }`
                    }
                  >
                    <Icon
                      size={20}
                      strokeWidth={1.9}
                    />

                    <span>{item.label}</span>
                  </NavLink>
                )
              })}
            </div>
          ))}
        </nav>

        <div className="admin-sidebar-bottom">
          <div className="admin-user">
            <div className="admin-user-avatar">
              <ShieldCheck size={19} />
            </div>

            <div className="admin-user-info">
              <strong>
                {profile?.nombres || 'Administrador'}
              </strong>

              <span>
                {profile?.email || ''}
              </span>
            </div>
          </div>

          <button
            type="button"
            className="admin-logout"
            onClick={handleLogout}
          >
            <LogOut size={19} />
            <span>Cerrar sesión</span>
          </button>
        </div>
      </aside>

      <main className="admin-main">
        <header className="admin-header">
          <div>
            <h2>Administración</h2>

            <p>
              Gestión y configuración del centro educativo
            </p>
          </div>

          <div className="admin-header-role">
            <ShieldCheck size={17} />
            Administrador
          </div>
        </header>

        <section className="admin-content">
          <Outlet />
        </section>
      </main>
    </div>
  )
}

export default AdminLayout