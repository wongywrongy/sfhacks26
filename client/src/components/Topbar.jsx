import { useNavigate } from 'react-router-dom';

export default function Topbar({ backTo, backLabel, actions, children }) {
  const navigate = useNavigate();

  return (
    <header className="topbar">
      <div className="topbar-inner">
        <div className="topbar-left">
          <div className="topbar-brand" onClick={() => navigate('/dashboard')} role="button" tabIndex={0}>
            <svg width="26" height="26" viewBox="0 0 30 30" fill="none">
              <rect x="3" y="12" width="9" height="15" rx="2" fill="#2563eb" opacity="0.45" />
              <rect x="11" y="6" width="9" height="21" rx="2" fill="#2563eb" opacity="0.7" />
              <rect x="19" y="3" width="9" height="24" rx="2" fill="#2563eb" />
            </svg>
            <span className="topbar-brand-name">CommonGround</span>
          </div>
          {backTo && (
            <>
              <span className="topbar-sep" />
              <button className="topbar-back" onClick={() => navigate(backTo)}>
                <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
                  <path d="M10.354 3.354a.5.5 0 00-.708-.708l-5 5a.5.5 0 000 .708l5 5a.5.5 0 00.708-.708L5.707 8l4.647-4.646z" />
                </svg>
                {backLabel}
              </button>
            </>
          )}
          {children}
        </div>
        <div className="topbar-right">
          {actions}
          <div className="topbar-org">
            <span className="topbar-org-dot" />
            <span className="topbar-org-label">org-001</span>
          </div>
        </div>
      </div>
    </header>
  );
}
