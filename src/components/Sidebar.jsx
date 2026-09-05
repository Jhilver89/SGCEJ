import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard,
  GraduationCap,
  Users,
  ClipboardList,
  CalendarDays,
  UserCog,
  Settings,
  LogOut,
  DoorOpen,
  AlertTriangle,
  MessageSquare,
  BarChart3,
  X,
} from 'lucide-react'

const adminItems = [
  { label: 'Dashboard', path: '/admin', icon: LayoutDashboard },
  { label: 'Año escolar', path: '/admin/anio-escolar', icon: CalendarDays },
  { label: 'Estudiantes', path: '/admin/estudiantes', icon: GraduationCap },
  { label: 'Docentes', path: '/admin/docentes', icon: Users },
  { label: 'Matrículas', path: '/admin/matriculas', icon: ClipboardList },
  { label: 'Grados y secciones', path: '/admin/grados', icon: LayoutDashboard },
  { label: 'Usuarios', path: '/admin/usuarios', icon: UserCog },
  { label: 'Configuración', path: '/admin/configuracion', icon: Settings },
]

const appItems = [
  { label: 'Dashboard', path: '/app', icon: LayoutDashboard },
  { label: 'Estudiantes', path: '/app/estudiantes', icon: GraduationCap },
  { label: 'Salidas', path: '/app/salidas', icon: DoorOpen },
  { label: 'Incidencias', path: '/app/incidencias', icon: AlertTriangle },
  { label: 'Mensajes', path: '/app/mensajes', icon: MessageSquare },
  { label: 'Reportes', path: '/app/reportes', icon: BarChart3 },
]

function Sidebar({ type = 'app', open, onClose }) {
  const items = type === 'admin' ? adminItems : appItems
  const title = type === 'admin' ? 'Administración' : 'Área operativa'

  return (
    <>
      {open && <div className="sidebar-overlay" onClick={onClose} />}

      <aside className={`sidebar ${open ? 'sidebar-open' : ''}`}>
        <div className="sidebar-header">
          <div className="sidebar-brand">
            <div className="sidebar-logo">SG</div>

            <div>
              <strong>SGCE</strong>
              <span>Sistema Escolar</span>
            </div>
          </div>

          <button className="sidebar-close" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <div className="sidebar-section-title">
          {title}
        </div>

        <nav className="sidebar-nav">
          {items.map((item) => {
            const Icon = item.icon

            return (
              <NavLink
                key={item.path}
                to={item.path}
                end={item.path === '/admin' || item.path === '/app'}
                className={({ isActive }) =>
                  `sidebar-link ${isActive ? 'active' : ''}`
                }
                onClick={onClose}
              >
                <Icon size={19} />
                <span>{item.label}</span>
              </NavLink>
            )
          })}
        </nav>

        <div className="sidebar-footer">
          <button className="sidebar-link logout-button">
            <LogOut size={19} />
            <span>Cerrar sesión</span>
          </button>

          <div className="sidebar-author">
            SGCE · Jhilver
          </div>
        </div>
      </aside>
    </>
  )
}

export default Sidebar