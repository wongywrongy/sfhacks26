import { useState, useEffect, useCallback } from 'react';
import { api } from '../api';

const fmt = (n) => '$' + Math.abs(Math.round(n)).toLocaleString();

const SEVERITY_COLORS = {
  none: '#16a34a',
  low: '#94a3b8',
  moderate: '#ca8a04',
  elevated: '#dc2626',
};
const VERIFICATION_COLORS = {
  verified: '#16a34a',
  uncertain: '#ca8a04',
  failed: '#dc2626',
  unknown: '#94a3b8',
};
const DISPOSITION_COLORS = {
  convicted: '#dc2626',
  pending: '#ca8a04',
  dismissed: '#16a34a',
  acquitted: '#16a34a',
  expunged: '#16a34a',
  deferred: '#94a3b8',
};
const OFFENSE_TYPE_COLORS = {
  felony: '#dc2626',
  misdemeanor: '#ca8a04',
  infraction: '#94a3b8',
};
const OUTCOME_COLORS = {
  'judgment for plaintiff': '#dc2626',
  judgment: '#dc2626',
  settled: '#ca8a04',
  pending: '#ca8a04',
  dismissed: '#16a34a',
  withdrawn: '#16a34a',
};

function Badge({ label, color }) {
  return (
    <span style={{
      fontSize: 11, fontWeight: 700, padding: '1px 6px', borderRadius: 4, textTransform: 'capitalize',
      background: `${color}15`, color, border: `1px solid ${color}30`,
    }}>
      {label}
    </span>
  );
}

function AiCallout({ label, children }) {
  if (!children) return null;
  return (
    <div className="breakdown-ai-callout" style={{ marginTop: 8 }}>
      <div className="breakdown-ai-header">
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="2.5" strokeLinecap="round">
          <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
        </svg>
        <span className="breakdown-ai-label">{label}</span>
      </div>
      <div className="breakdown-ai-text">{children}</div>
    </div>
  );
}

// Shield icon for criminal
function ShieldIcon({ color }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  );
}

// Home icon for eviction
function HomeIcon({ color }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
      <polyline points="9 22 9 12 15 12 15 22" />
    </svg>
  );
}

// Fingerprint icon for identity
function FingerprintIcon({ color }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 12C2 6.5 6.5 2 12 2a10 10 0 018 4" />
      <path d="M5 19.5C5.5 18 6 15 6 12c0-3.5 2.5-6 6-6 3 0 5.5 2 6 5" />
      <path d="M12 12v8" />
      <path d="M8 21c.5-2.5 1-5 1-9" />
      <path d="M20 8c.5 1 1 2 1 4 0 4-1 7-3 10" />
      <path d="M16 21c.5-1.5 1-4 1-7" />
    </svg>
  );
}

function OverviewCard({ member }) {
  const crimSeverity = member.criminalStructured?.summary?.overallSeverity || 'none';
  const evicSeverity = member.evictionStructured?.summary?.overallSeverity || 'none';
  const idStatus = member.identityStructured?.verificationStatus || 'unknown';

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
      padding: '10px 14px', borderRadius: 8, background: 'rgba(0,0,0,0.02)',
      border: '1px solid rgba(0,0,0,0.06)', minWidth: 80,
    }}>
      <span style={{ fontSize: 13, fontWeight: 700 }}>{member.firstName} {member.lastInitial}.</span>
      <div style={{ display: 'flex', gap: 8 }}>
        <div title={`Criminal: ${crimSeverity}`}><ShieldIcon color={SEVERITY_COLORS[crimSeverity]} /></div>
        <div title={`Eviction: ${evicSeverity}`}><HomeIcon color={SEVERITY_COLORS[evicSeverity]} /></div>
        <div title={`Identity: ${idStatus}`}><FingerprintIcon color={VERIFICATION_COLORS[idStatus]} /></div>
      </div>
    </div>
  );
}

function CriminalSection({ data }) {
  if (!data || data.records.length === 0) {
    return <div style={{ fontSize: 12, color: 'var(--text-muted)', fontStyle: 'italic', padding: '6px 0' }}>No criminal records found.</div>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {data.records.map((r, i) => (
        <div key={i} style={{ padding: '8px 10px', borderRadius: 8, background: 'rgba(0,0,0,0.02)', border: '1px solid rgba(0,0,0,0.06)', fontSize: 11 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginBottom: 4 }}>
            <span style={{ fontWeight: 700, fontSize: 12 }}>{r.offense}</span>
            <Badge label={r.offenseType} color={OFFENSE_TYPE_COLORS[r.offenseType] || '#94a3b8'} />
            <Badge label={r.disposition} color={DISPOSITION_COLORS[r.disposition] || '#94a3b8'} />
            <Badge label={r.severity} color={SEVERITY_COLORS[r.severity] || '#94a3b8'} />
          </div>
          <div style={{ display: 'flex', gap: 12, color: 'var(--text-muted)', fontSize: 11 }}>
            {r.jurisdiction && <span>{r.jurisdiction}</span>}
            {r.recencyLabel && <span>{r.recencyLabel} — {r.recencyCategory}</span>}
          </div>
        </div>
      ))}
    </div>
  );
}

function EvictionSection({ data }) {
  if (!data || data.records.length === 0) {
    return <div style={{ fontSize: 12, color: 'var(--text-muted)', fontStyle: 'italic', padding: '6px 0' }}>No eviction filings found.</div>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {data.records.map((r, i) => (
        <div key={i} style={{ padding: '8px 10px', borderRadius: 8, background: 'rgba(0,0,0,0.02)', border: '1px solid rgba(0,0,0,0.06)', fontSize: 11 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginBottom: 4 }}>
            <Badge label={r.outcome || 'unknown'} color={OUTCOME_COLORS[r.outcome] || '#94a3b8'} />
            {r.amount != null && <span style={{ fontWeight: 700, fontSize: 12 }}>{fmt(r.amount)}</span>}
            <Badge label={r.severity} color={SEVERITY_COLORS[r.severity] || '#94a3b8'} />
          </div>
          <div style={{ display: 'flex', gap: 12, color: 'var(--text-muted)', fontSize: 11 }}>
            {r.jurisdiction && <span>{r.jurisdiction}</span>}
            {r.recencyLabel && <span>{r.recencyLabel} — {r.recencyCategory}</span>}
          </div>
        </div>
      ))}
    </div>
  );
}

function IdentitySection({ data }) {
  if (!data) {
    return <div style={{ fontSize: 12, color: 'var(--text-muted)', fontStyle: 'italic', padding: '6px 0' }}>Identity data not available.</div>;
  }

  const statusColor = VERIFICATION_COLORS[data.verificationStatus] || '#94a3b8';

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '6px 0' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ fontSize: 20, fontWeight: 900, color: statusColor, letterSpacing: '-0.02em' }}>{data.cviScore ?? '—'}</span>
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: statusColor, textTransform: 'capitalize' }}>{data.verificationStatus}</div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>CVI Score</div>
        </div>
      </div>
      {data.matchDetails && (
        <div style={{ display: 'flex', gap: 8, fontSize: 11, color: 'var(--text-muted)' }}>
          {data.matchDetails.ssnMatch != null && <span>SSN: {data.matchDetails.ssnMatch ? 'Match' : 'No match'}</span>}
          {data.matchDetails.dobMatch != null && <span>DOB: {data.matchDetails.dobMatch ? 'Match' : 'No match'}</span>}
          {data.matchDetails.addressMatch != null && <span>Addr: {data.matchDetails.addressMatch ? 'Match' : 'No match'}</span>}
          {data.matchDetails.nameMatch != null && <span>Name: {data.matchDetails.nameMatch ? 'Match' : 'No match'}</span>}
        </div>
      )}
    </div>
  );
}

function CollapsibleSection({ title, icon, defaultOpen = false, children }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div style={{ borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
      <button
        onClick={() => setOpen(!open)}
        style={{
          display: 'flex', alignItems: 'center', gap: 6, width: '100%', padding: '8px 0',
          background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 700,
          color: 'var(--text-primary)', textAlign: 'left',
        }}
      >
        {icon}
        <span>{title}</span>
        <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--text-muted)' }}>{open ? '▲' : '▼'}</span>
      </button>
      {open && <div style={{ paddingBottom: 8 }}>{children}</div>}
    </div>
  );
}

function MemberCard({ member }) {
  const crimSeverity = member.criminalStructured?.summary?.overallSeverity || 'none';
  const evicSeverity = member.evictionStructured?.summary?.overallSeverity || 'none';
  const hasCrim = (member.criminalStructured?.summary?.totalRecords || 0) > 0;
  const hasEvic = (member.evictionStructured?.summary?.totalFilings || 0) > 0;

  return (
    <div className="breakdown-card" style={{ padding: '12px 14px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
        <span style={{ fontWeight: 800, fontSize: 14 }}>{member.firstName} {member.lastInitial}.</span>
        <div style={{ display: 'flex', gap: 6 }}>
          <ShieldIcon color={SEVERITY_COLORS[crimSeverity]} />
          <HomeIcon color={SEVERITY_COLORS[evicSeverity]} />
          <FingerprintIcon color={VERIFICATION_COLORS[member.identityStructured?.verificationStatus || 'unknown']} />
        </div>
      </div>

      <CollapsibleSection
        title={`Criminal Records${hasCrim ? ` (${member.criminalStructured.summary.totalRecords})` : ''}`}
        icon={<ShieldIcon color={SEVERITY_COLORS[crimSeverity]} />}
        defaultOpen={false}
      >
        <CriminalSection data={member.criminalStructured} />
      </CollapsibleSection>

      <CollapsibleSection
        title={`Eviction Records${hasEvic ? ` (${member.evictionStructured.summary.totalFilings})` : ''}`}
        icon={<HomeIcon color={SEVERITY_COLORS[evicSeverity]} />}
        defaultOpen={false}
      >
        <EvictionSection data={member.evictionStructured} />
      </CollapsibleSection>

      <CollapsibleSection
        title="Identity Verification"
        icon={<FingerprintIcon color={VERIFICATION_COLORS[member.identityStructured?.verificationStatus || 'unknown']} />}
        defaultOpen={false}
      >
        <IdentitySection data={member.identityStructured} />
      </CollapsibleSection>

      {member.aiSafetySummary?.summary && (
        <AiCallout label="Safety Assessment">{member.aiSafetySummary.summary}</AiCallout>
      )}
    </div>
  );
}

export default function SafetyTab({ projectId }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  const fetchSafety = useCallback(() => {
    setLoading(true);
    setError('');
    api.getSafety(projectId)
      .then(setData)
      .catch((err) => setError(err.data?.message || err.message))
      .finally(() => setLoading(false));
  }, [projectId]);

  useEffect(() => { fetchSafety(); }, [fetchSafety]);

  if (loading) {
    return (
      <div className="loading-container">
        <div className="spinner" />
        <p>Loading safety data...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="tab-error-container">
        <div className="tab-error"><p>{error}</p></div>
        <button className="btn btn-secondary btn-sm" onClick={fetchSafety} style={{ marginTop: 12 }}>Retry</button>
      </div>
    );
  }

  if (!data) return null;

  const q = searchQuery.toLowerCase().trim();
  const filtered = q
    ? data.members.filter((m) =>
        `${m.firstName} ${m.lastInitial}`.toLowerCase().includes(q)
      )
    : data.members;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {/* Disclaimer bar */}
      <div style={{
        padding: '10px 14px', borderRadius: 10, fontSize: 11, lineHeight: 1.5,
        background: '#fffbeb', color: '#92400e', border: '1px solid #fde68a',
      }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#92400e" strokeWidth="2" strokeLinecap="round" style={{ flexShrink: 0, marginTop: 1 }}>
            <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
            <line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
          <span>{data.disclaimer}</span>
        </div>
      </div>

      {/* Group overview row + AI Safety Overview */}
      <div className="breakdown-card" style={{ padding: '12px 14px' }}>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {data.members.map((m) => (
            <OverviewCard key={m._id} member={m} />
          ))}
        </div>
        {data.aiSafetyOverview?.overview && (
          <div style={{ marginTop: 8 }}>
            <AiCallout label="Group Safety Overview">{data.aiSafetyOverview.overview}</AiCallout>
          </div>
        )}
      </div>

      {/* Search bar */}
      {data.members.length > 1 && (
        <div className="search-bar">
          <svg className="search-bar-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>
          <input
            type="text"
            placeholder="Search by name..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {q && <span className="search-bar-count">{filtered.length} of {data.members.length}</span>}
          {q && <button className="search-bar-clear" onClick={() => setSearchQuery('')}>&times;</button>}
        </div>
      )}

      {/* Per-person expandable cards */}
      {q && filtered.length === 0 ? (
        <div className="search-empty-state">
          <span>&#128269;</span>
          <span>No results for &ldquo;{searchQuery}&rdquo;</span>
        </div>
      ) : (
        filtered.map((m) => (
          <MemberCard key={m._id} member={m} />
        ))
      )}
    </div>
  );
}
