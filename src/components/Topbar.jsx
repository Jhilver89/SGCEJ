import { Menu, Bell, ChevronDown } from 'lucide-react'

function Topbar({ onMenuClick, title }) {
  return (
    <header className="topbar">
      <button className="menu-button" onClick={onMenuClick}>
        <Menu size={22} />
      </button>

      <div className="topbar-title">
        {title}
      </div>

      <div className="topbar-actions">
        <button className="icon-button">
          <Bell size={19} />
          <span className="notification-dot" />
        </button>

        <div className="user-menu">
          <div className="user-avatar">
            J
          </div>

          <div className="user-info">
            <strong>Usuario</strong>
            <span>Administrador</span>
          </div>

          <ChevronDown size={16} />
        </div>
      </div>
    </header>
  )
}

export default Topbar