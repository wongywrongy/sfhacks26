import { useNavigate } from 'react-router-dom';

export function Sidebar({ children }) {
  const navigate = useNavigate();

  return (
    <aside className="sidebar">
      <div className="sidebar-brand" onClick={() => navigate('/dashboard')} role="button" tabIndex={0}>
        <div className="sidebar-logo-mark">
          <svg width="30" height="30" viewBox="0 0 30 30" fill="none">
            <rect x="3" y="12" width="9" height="15" rx="2" fill="#2563eb" opacity="0.45" />
            <rect x="11" y="6" width="9" height="21" rx="2" fill="#2563eb" opacity="0.7" />
            <rect x="19" y="3" width="9" height="24" rx="2" fill="#2563eb" />
          </svg>
        </div>
        <div className="sidebar-brand-text">
          <span className="sidebar-brand-name">CommonGround</span>
          <span className="sidebar-brand-tagline">Housing Co-op Platform</span>
        </div>
      </div>

      <div className="sidebar-body">
        {children}
      </div>

      <div className="sidebar-footer">
        <div className="sidebar-org-badge">
          <span className="sidebar-org-dot" />
          <span className="sidebar-org-label">org-001</span>
        </div>
      </div>
    </aside>
  );
}

export function SidebarSection({ label, children }) {
  return (
    <div className="sidebar-section">
      {label && <span className="sidebar-section-label">{label}</span>}
      {children}
    </div>
  );
}

export function SidebarNavItem({ active, onClick, badge, children }) {
  return (
    <button
      className={`sidebar-nav-item ${active ? 'active' : ''}`}
      onClick={onClick}
    >
      <span className="sidebar-nav-label">{children}</span>
      {badge != null && <span className="sidebar-nav-badge">{badge}</span>}
    </button>
  );
}

export function SidebarBackLink({ onClick, children }) {
  return (
    <button className="sidebar-back-link" onClick={onClick}>
      <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
        <path d="M10.354 3.354a.5.5 0 00-.708-.708l-5 5a.5.5 0 000 .708l5 5a.5.5 0 00.708-.708L5.707 8l4.647-4.646z" />
      </svg>
      <span>{children}</span>
    </button>
  );
}

export function SidebarProjectInfo({ name, location, cost }) {
  return (
    <div className="sidebar-project-info">
      <h3 className="sidebar-project-name">{name}</h3>
      <div className="sidebar-project-meta">
        {location && <span>{location}</span>}
        {cost != null && <span>${cost.toLocaleString()}/mo</span>}
      </div>
    </div>
  );
}
