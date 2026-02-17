import { useNavigate } from 'react-router-dom';
import '../styles/landing.css';

export default function LandingPage() {
  const navigate = useNavigate();

  return (
    <div className="landing">
      {/* Nav */}
      <nav className="landing-nav">
        <div className="landing-nav-inner">
          <div className="landing-logo">
            <svg width="22" height="22" viewBox="0 0 30 30" fill="none">
              <rect x="3" y="12" width="9" height="15" rx="2" fill="#2563eb" opacity="0.45" />
              <rect x="11" y="6" width="9" height="21" rx="2" fill="#2563eb" opacity="0.7" />
              <rect x="19" y="3" width="9" height="24" rx="2" fill="#2563eb" />
            </svg>
            <span>CommonGround</span>
          </div>
          <button className="landing-nav-cta" onClick={() => navigate('/dashboard')}>
            Explore Prototype
          </button>
        </div>
      </nav>

      {/* ── BEAT 1: Hero ── */}
      <section className="landing-hero">
        <h1 className="landing-h1">
          Screen housing groups,<br />not just individuals.
        </h1>
        <p className="landing-sub">
          Traditional screening rejects qualified people because it only looks at one applicant at a time. CommonGround evaluates the group as a unit so property managers get the full financial picture before making a decision.
        </p>
        <button className="landing-cta" onClick={() => navigate('/dashboard')}>
          Explore the Prototype
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M5 12h14M12 5l7 7-7 7" /></svg>
        </button>
      </section>

      {/* ── BEAT 2: Context ── */}
      <section className="landing-context">
        <div className="landing-vs">
          {/* Individual */}
          <div className="landing-vs-col">
            <div className="landing-vs-label">Individual Screening</div>
            <div className="landing-vs-profile">
              <div className="landing-av" style={{ background: '#7c3aed' }}>C</div>
              <div>
                <div className="landing-vs-name">Creed B.</div>
                <div className="landing-vs-meta">Retired QA Director · $5,100/mo · 745 credit</div>
              </div>
            </div>
            <div className="landing-vs-checks">
              <div className="landing-vs-check fail">
                <span>&#10005;</span>
                Income $5,100 &lt; $10,800 required (3x rent)
              </div>
              <div className="landing-vs-check fail">
                <span>&#10005;</span>
                Group financial context not evaluated
              </div>
            </div>
            <div className="landing-vs-verdict fail">Rejected</div>
          </div>

          <div className="landing-vs-divider">
            <span>vs</span>
          </div>

          {/* Group */}
          <div className="landing-vs-col">
            <div className="landing-vs-label">Group Screening</div>
            <div className="landing-vs-profile">
              <div style={{ display: 'flex' }}>
                <div className="landing-av" style={{ background: '#2563eb' }}>S</div>
                <div className="landing-av" style={{ background: '#3b82f6', marginLeft: -6 }}>D</div>
                <div className="landing-av" style={{ background: '#7c3aed', marginLeft: -6 }}>C</div>
              </div>
              <div>
                <div className="landing-vs-name">Dunder Mifflin Commons</div>
                <div className="landing-vs-meta">3 applicants · $19,900/mo combined</div>
              </div>
            </div>
            <div className="landing-vs-checks">
              <div className="landing-vs-check pass">
                <span>&#10003;</span>
                31% group DTI, well within healthy range
              </div>
              <div className="landing-vs-check pass">
                <span>&#10003;</span>
                5.5x monthly rent coverage
              </div>
              <div className="landing-vs-check pass">
                <span>&#10003;</span>
                Three uncorrelated income sources
              </div>
            </div>
            <div className="landing-vs-verdict pass">Approved</div>
          </div>
        </div>
        <p className="landing-punch">
          Same person. Same unit. Different answer because the analysis changed.
        </p>
      </section>

      {/* ── BEAT 3: Core Platform ── */}
      <section className="landing-platform">
        <h2 className="landing-h2">What the platform does</h2>
        <div className="landing-pillars">
          <div className="landing-pillar">
            <div className="landing-pillar-icon">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2" strokeLinecap="round">
                <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4-4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 00-3-3.87" /><path d="M16 3.13a4 4 0 010 7.75" />
              </svg>
            </div>
            <h3>Group Screening</h3>
            <p>Evaluates all applicants as a single financial unit. Combined income, shared obligations, and group level debt to income ratios replace per person thresholds.</p>
          </div>

          <div className="landing-pillar">
            <div className="landing-pillar-icon">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2" strokeLinecap="round">
                <line x1="12" y1="1" x2="12" y2="23" /><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" />
              </svg>
            </div>
            <h3>Smart Rent Splitting</h3>
            <p>Three models out of the box: equal split, income proportional, and a balanced hybrid. Each shows exactly what percentage of income goes to housing per member.</p>
          </div>

          <div className="landing-pillar">
            <div className="landing-pillar-icon">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2" strokeLinecap="round">
                <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                <line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
            </div>
            <h3>Resilience Analysis</h3>
            <p>Simulates what happens if any member leaves. Flags single points of failure and shows how group DTI shifts under each scenario so managers see risk before it materializes.</p>
          </div>

          <div className="landing-pillar">
            <div className="landing-pillar-icon">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2" strokeLinecap="round">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              </svg>
            </div>
            <h3>Background Safety</h3>
            <p>Full credit reports, criminal records, eviction history, and identity verification for every applicant. Flags real issues with context instead of blanket rejections.</p>
          </div>

          <div className="landing-pillar">
            <div className="landing-pillar-icon">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2" strokeLinecap="round">
                <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
              </svg>
            </div>
            <h3>AI Summaries</h3>
            <p>Gemini generates plain language explanations for every analysis. No jargon, no guesswork. Managers get clear context on what the numbers mean and what to watch for.</p>
          </div>

          <div className="landing-pillar">
            <div className="landing-pillar-icon">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2" strokeLinecap="round">
                <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" />
              </svg>
            </div>
            <h3>Applicant Reports</h3>
            <p>One click PDF reports for each applicant with credit summary, background checks, and group context. Ready to share with co-signers, guarantors, or compliance review.</p>
          </div>
        </div>
      </section>

      {/* ── Tech Stack ── */}
      <section className="landing-stack">
        <div className="landing-stack-row">
          <span className="landing-stack-item">React</span>
          <span className="landing-stack-dot" />
          <span className="landing-stack-item">Express</span>
          <span className="landing-stack-dot" />
          <span className="landing-stack-item">MongoDB</span>
          <span className="landing-stack-dot" />
          <span className="landing-stack-item">Gemini AI</span>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="landing-footer">
        <div className="landing-footer-cta">
          <button className="landing-cta lg" onClick={() => navigate('/dashboard')}>
            Explore the Prototype
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M5 12h14M12 5l7 7-7 7" /></svg>
          </button>
          <p className="landing-footer-note">Fully interactive demo with sample data.</p>
        </div>
        <div className="landing-footer-bottom">
          <span className="landing-footer-brand">CommonGround</span>
          <span className="landing-footer-hackathon">SFHacks 2026</span>
        </div>
      </footer>
    </div>
  );
}
