function StatCard({ icon: Icon, label, value, description, className = '' }) {
  return (
    <div className={`stat-card ${className}`}>
      <div className="stat-icon">
        <Icon size={22} />
      </div>

      <div className="stat-content">
        <span>{label}</span>
        <strong>{value}</strong>
        <small>{description}</small>
      </div>
    </div>
  )
}

export default StatCard