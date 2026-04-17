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
            <svg width="20" height="20" viewBox="0 0 30 30" fill="none" aria-hidden="true">
              <rect x="3" y="12" width="9" height="15" rx="2" fill="#2563eb" opacity="0.45" />
              <rect x="11" y="6" width="9" height="21" rx="2" fill="#2563eb" opacity="0.7" />
              <rect x="19" y="3" width="9" height="24" rx="2" fill="#2563eb" />
            </svg>
            <span>CommonGround</span>
          </div>
          <button className="landing-nav-cta" onClick={() => navigate('/dashboard')}>
            View live demo
          </button>
        </div>
      </nav>

      {/* ── Hero ── */}
      <section className="landing-hero">
        <div className="landing-eyebrow">Household underwriting for property managers</div>
        <h1 className="landing-h1">
          Group applications,<br /><em>fully underwritten.</em>
        </h1>
        <p className="landing-sub">
          CommonGround evaluates co-applicant households as a single financial unit. Combined DTI, income correlation, resilience modeling, and split allocation, so you can fill units faster without relaxing standards.
        </p>
        <div className="landing-cta-row">
          <button className="landing-cta" onClick={() => navigate('/dashboard')}>
            View live demo
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M5 12h14M12 5l7 7-7 7" /></svg>
          </button>
          <a className="landing-cta landing-cta--secondary" href="mailto:hello@breakingcommonground.tech?subject=CommonGround%20access%20request">
            Request access
          </a>
        </div>
      </section>

      {/* ── Context ── */}
      <section className="landing-context">
        <div className="landing-vs">
          {/* Individual */}
          <div className="landing-vs-col">
            <div className="landing-vs-label">Individual screening</div>
            <div className="landing-vs-profile">
              <div className="landing-av" style={{ background: '#7c3aed' }}>C</div>
              <div>
                <div className="landing-vs-name">Creed B.</div>
                <div className="landing-vs-meta">Retired QA director · $5,100/mo · 745 credit</div>
              </div>
            </div>
            <div className="landing-vs-checks">
              <div className="landing-vs-check fail">
                <span>&#10005;</span>
                Income $5,100 below 3× rent minimum of $10,800
              </div>
              <div className="landing-vs-check fail">
                <span>&#10005;</span>
                Household context not evaluated
              </div>
            </div>
            <div className="landing-vs-verdict fail">Rejected</div>
          </div>

          <div className="landing-vs-divider">
            <span>vs</span>
          </div>

          {/* Group */}
          <div className="landing-vs-col">
            <div className="landing-vs-label">Household underwriting</div>
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
                Aggregate DTI 31%, below 36% front-end threshold
              </div>
              <div className="landing-vs-check pass">
                <span>&#10003;</span>
                5.5× monthly rent coverage
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
          Individual screening evaluates Creed against a 3× rent threshold he can't clear alone. Household underwriting evaluates the combined $19,900 monthly income against the same unit. One vacancy avoided; one qualified household placed.
        </p>
      </section>

      {/* ── What the platform produces ── */}
      <section className="landing-platform">
        <div className="landing-platform-head">
          <h2 className="landing-h2">What the platform<br />produces.</h2>
          <p className="landing-h2-sub">
            Every screen maps to a document. A lease addendum, a deal memo, a compliance-aware safety review. No screens for their own sake.
          </p>
        </div>
        <div className="landing-pillars">
          <div className="landing-pillar">
            <div className="landing-pillar-icon">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4-4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 00-3-3.87" /><path d="M16 3.13a4 4 0 010 7.75" />
              </svg>
            </div>
            <h3>Household underwriting</h3>
            <p>Combined income, aggregate DTI, and tradeline concentration across all co-applicants in a single underwriting view.</p>
          </div>

          <div className="landing-pillar">
            <div className="landing-pillar-icon">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                <line x1="12" y1="1" x2="12" y2="23" /><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" />
              </svg>
            </div>
            <h3>Allocation modeling</h3>
            <p>Three allocation methods (pro-rata, equal, blended hybrid) calculated against each applicant's income. Export as lease addendum.</p>
          </div>

          <div className="landing-pillar">
            <div className="landing-pillar-icon">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                <line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
            </div>
            <h3>Departure scenarios</h3>
            <p>Model the household's viability if any co-applicant exits the lease. Identifies load-bearing tenants before you countersign.</p>
          </div>

          <div className="landing-pillar">
            <div className="landing-pillar-icon">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              </svg>
            </div>
            <h3>FCRA-aligned screening</h3>
            <p>Criminal, eviction, and identity (CVI) checks with individualized-assessment prompts consistent with HUD 2016 guidance.</p>
          </div>

          <div className="landing-pillar">
            <div className="landing-pillar-icon">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
              </svg>
            </div>
            <h3>Underwriter's narrative</h3>
            <p>Auto-generated written assessments at the applicant, household, and portfolio level. Attach to deal files.</p>
          </div>

          <div className="landing-pillar">
            <div className="landing-pillar-icon">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" />
              </svg>
            </div>
            <h3>Lender-ready packets</h3>
            <p>Per-applicant PDF reports with credit detail, employment, and allocation terms. Suitable for lender or owner review.</p>
          </div>
        </div>
      </section>

      {/* ── Built for ── */}
      <section className="landing-builtfor">
        <div className="landing-builtfor-inner">
          <div className="landing-builtfor-label">Built for</div>
          <div className="landing-builtfor-text">
            Independent landlords, boutique property-management firms, and brokerages managing five to five hundred units.
          </div>
        </div>
      </section>

      {/* ── Footer CTA ── */}
      <footer className="landing-footer">
        <div className="landing-footer-cta">
          <div className="landing-footer-title">See it running.</div>
          <button className="landing-cta lg" onClick={() => navigate('/dashboard')}>
            View live demo
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M5 12h14M12 5l7 7-7 7" /></svg>
          </button>
          <p className="landing-footer-note">Fully interactive environment with sample Scranton-area portfolio data.</p>
        </div>
        <div className="landing-footer-bottom">
          <span className="landing-footer-brand">CommonGround</span>
          <span className="landing-footer-hackathon">Built at SFHacks 2026</span>
        </div>
      </footer>
    </div>
  );
}
