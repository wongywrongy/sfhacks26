import { useState } from 'react';

const MEMBER_COLORS = ['#2563eb', '#3b82f6', '#7c3aed', '#6366f1', '#1d4ed8'];

const fmt = (n) => (n < 0 ? '-' : '') + '$' + Math.abs(Math.round(n)).toLocaleString();
const scoreColor = (s) => s >= 740 ? '#16a34a' : s >= 670 ? '#ca8a04' : '#dc2626';

function EmploymentIcon({ type }) {
  const s = { flexShrink: 0, opacity: 0.5 };
  if (type === 'salaried' || type === 'salary') return (
    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={s}>
      <rect x="2" y="7" width="20" height="14" rx="2" /><path d="M16 7V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v2" />
    </svg>
  );
  if (type === 'government') return (
    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={s}>
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  );
  if (type === 'gig') return (
    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={s}>
      <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
    </svg>
  );
  if (type === 'freelance') return (
    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={s}>
      <path d="M12 20h9" /><path d="M16.5 3.5a2.12 2.12 0 013 3L7 19l-4 1 1-4L16.5 3.5z" />
    </svg>
  );
  if (type === 'retired') return (
    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={s}>
      <circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" />
    </svg>
  );
  return null;
}

function AiCallout({ label, children }) {
  if (!children) return null;
  return (
    <div className="breakdown-ai-callout">
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

function getOverallStatus(m) {
  const allComplete =
    m.creditStatus === 'complete' &&
    m.criminalStatus === 'complete' &&
    m.evictionStatus === 'complete' &&
    m.identityStatus === 'complete';

  if (m.orgStatus === 'ineligible')
    return { label: 'Declined', color: '#dc2626', bg: 'rgba(220, 38, 38, 0.08)' };

  if (!allComplete)
    return { label: 'Pending', color: '#ca8a04', bg: 'rgba(202, 138, 4, 0.08)' };

  if (
    m.criminalRecordCount > 0 ||
    m.evictionRecordCount > 0 ||
    (m.creditScore != null && m.creditScore < 580)
  )
    return { label: 'Flagged', color: '#dc2626', bg: 'rgba(220, 38, 38, 0.08)' };

  return { label: 'Cleared', color: '#16a34a', bg: 'rgba(22, 163, 74, 0.08)' };
}

function generateRiskInsight(m, allMembers) {
  const parts = [];
  const name = m.firstName;

  const scored = allMembers.filter((x) => x.creditScore != null);
  const totalIncome = scored.reduce((s, x) => s + x.monthlyIncome, 0);
  const weightedAvg = totalIncome > 0
    ? Math.round(scored.reduce((s, x) => s + x.creditScore * x.monthlyIncome, 0) / totalIncome)
    : null;
  const sub670Count = scored.filter((x) => x.creditScore < 670).length;

  if (m.evictionRecordCount > 0) {
    parts.push(`${name} has ${m.evictionRecordCount} eviction record${m.evictionRecordCount > 1 ? 's' : ''} on file, which triggers mandatory full-group review under standard landlord screening criteria.`);
  }
  if (m.criminalRecordCount > 0) {
    parts.push(`${m.criminalRecordCount} criminal record${m.criminalRecordCount > 1 ? 's' : ''} on file for ${name} requires review under fair housing guidelines before any adverse decision.`);
  }
  if (m.delinquencyCount > 0 && m.evictionRecordCount === 0) {
    parts.push(`${name}'s ${m.creditScore != null ? m.creditScore + ' score and ' : ''}${m.delinquencyCount} delinquenc${m.delinquencyCount > 1 ? 'ies' : 'y'} place ${m.creditScore != null && m.creditScore < 670 ? 'them below' : 'them at'} the 670 threshold used by most landlords for standard approval.`);
  }
  if (m.creditScore != null && m.creditScore < 670 && parts.length < 2) {
    const gap = 670 - m.creditScore;
    const avgText = weightedAvg != null ? ` The group's weighted credit average ${weightedAvg >= 670 ? `sits at ${weightedAvg} with ${name}'s score pulling it down` : `drops to ${weightedAvg}`}.` : '';
    parts.push(`${name}'s ${m.creditScore} score is ${gap} points below the 670 standard approval threshold.${sub670Count > 1 ? ` ${sub670Count} of ${scored.length} applicants fall below this line, the primary factor for additional screening.` : avgText}`);
  }
  if (m.employmentType === 'gig' && parts.length < 2) {
    const dtiText = m.personalDTI != null ? `${(m.personalDTI * 100).toFixed(0)}%` : 'current';
    parts.push(`${name}'s gig employment requires 12-24 months of income documentation for verification, and the ${dtiText} DTI is calculated on reported figures without W-2 confirmation.`);
  }
  return parts.slice(0, 2).join(' ') || null;
}

function PersonRow({ m, i, onNavigate, allMembers }) {
  const [expanded, setExpanded] = useState(false);
  const color = MEMBER_COLORS[i % MEMBER_COLORS.length];
  const status = getOverallStatus(m);

  // Summary indicators for Layer 2
  const creditText =
    m.creditStatus === 'complete' && m.creditScore != null
      ? `${m.creditScore} · ${m.paymentHistoryPct ?? '—'}% on-time`
      : m.creditStatus === 'failed' ? 'Failed' : 'Pending';

  const bgComplete = m.criminalStatus === 'complete' && m.evictionStatus === 'complete';
  const bgClean = bgComplete && m.criminalRecordCount === 0 && m.evictionRecordCount === 0;
  const recordCount = (m.criminalRecordCount || 0) + (m.evictionRecordCount || 0);
  const bgText = !bgComplete
    ? 'Pending'
    : bgClean ? 'Clean' : `${recordCount} record${recordCount !== 1 ? 's' : ''}`;

  const idText =
    m.identityStatus === 'complete' && m.cviScore != null
      ? (m.cviScore > 30 ? 'Verified' : `Failed (${m.cviScore})`)
      : m.identityStatus === 'failed' ? 'Failed' : 'Pending';

  const insight = generateRiskInsight(m, allMembers);

  return (
    <div className={`people-row ${expanded ? 'people-row-expanded' : ''}`}>
      {/* Layer 1: Scan row */}
      <div className="people-row-main" onClick={() => setExpanded(!expanded)}>
        <div className="people-row-identity">
          <div className="people-avatar" style={{ background: color }}>{m.firstName[0]}</div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 13, fontWeight: 700 }}>{m.firstName} {m.lastInitial}.</span>
              <span
                className="people-status-pill"
                style={{ color: status.color, background: status.bg }}
              >
                {status.label}
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--text-muted)' }}>
              <EmploymentIcon type={m.employmentType} />
              <span>{m.jobTitle || m.employmentType}</span>
            </div>
          </div>
        </div>
        <div className="people-row-stats">
          <div className="people-stat">
            <span className="people-stat-value">{fmt(m.monthlyIncome)}/mo</span>
            <span className="people-stat-label">income</span>
          </div>
          <div className="people-stat credit-stat">
            <span className="people-stat-value" style={{ color: m.creditScore != null ? scoreColor(m.creditScore) : 'var(--text-muted)', display: 'inline-flex', alignItems: 'center', gap: 3 }}>
              {m.creditScore ?? '\u2014'}
              {m.paymentTrajectory?.trend === 'improving' && <span style={{ color: '#16a34a', fontSize: 11, fontWeight: 800, lineHeight: 1 }} title="Improving">&#9650;</span>}
              {m.paymentTrajectory?.trend === 'stable' && <span style={{ color: '#94a3b8', fontSize: 11, fontWeight: 800, lineHeight: 1 }} title="Stable">&mdash;</span>}
              {m.paymentTrajectory?.trend === 'declining' && <span style={{ color: '#dc2626', fontSize: 11, fontWeight: 800, lineHeight: 1 }} title="Declining">&#9660;</span>}
            </span>
            <span className="people-stat-label">credit</span>
          </div>
          <div className="people-stat">
            <span className="people-stat-value">{fmt(m.monthlyObligations)}/mo</span>
            <span className="people-stat-label">debt</span>
          </div>
          <svg
            className={`people-chevron ${expanded ? 'people-chevron-down' : ''}`}
            width="14" height="14" viewBox="0 0 24 24"
            fill="none" stroke="var(--text-muted)" strokeWidth="2" strokeLinecap="round"
          >
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </div>
      </div>

      {/* Layer 2: Expanded summary */}
      {expanded && (
        <div className="people-expanded">
          <div className="people-summary-indicators">
            <div className="people-indicator">
              <span className="people-indicator-label">Credit</span>
              <span className="people-indicator-value">{creditText}</span>
            </div>
            <span className="people-indicator-sep" />
            <div className="people-indicator">
              <span className="people-indicator-label">Background</span>
              <span className={`people-indicator-value ${!bgClean && bgComplete ? 'people-indicator-alert' : ''}`}>{bgText}</span>
            </div>
            <span className="people-indicator-sep" />
            <div className="people-indicator">
              <span className="people-indicator-label">Identity</span>
              <span className={`people-indicator-value ${idText.startsWith('Failed') ? 'people-indicator-alert' : ''}`}>{idText}</span>
            </div>
          </div>

          {insight && (
            <div className="people-insight">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#92400e" strokeWidth="2.5" strokeLinecap="round" style={{ flexShrink: 0, marginTop: 1 }}>
                <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                <line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
              <span>{insight}</span>
            </div>
          )}

          <button
            className="people-detail-link"
            onClick={(e) => { e.stopPropagation(); onNavigate(); }}
          >
            View full profile
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </button>
        </div>
      )}
    </div>
  );
}

export default function MembersTab({ members, groupAssessment, onSelectMember }) {
  const [searchQuery, setSearchQuery] = useState('');

  if (members.length === 0) {
    return (
      <div className="empty-state">
        <div className="empty-icon">&#128101;</div>
        <h3>No people yet</h3>
        <p>Share the invite link with your group to get started.</p>
      </div>
    );
  }

  const groupInsight = groupAssessment?.overview || null;

  const q = searchQuery.toLowerCase().trim();
  const filtered = q
    ? members.filter((m) =>
        `${m.firstName} ${m.lastInitial}`.toLowerCase().includes(q) ||
        (m.employmentType || '').toLowerCase().includes(q)
      )
    : members;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {members.length > 1 && (
        <div className="search-bar">
          <svg className="search-bar-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>
          <input
            type="text"
            placeholder="Search by name or employment type..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {q && <span className="search-bar-count">{filtered.length} of {members.length}</span>}
          {q && <button className="search-bar-clear" onClick={() => setSearchQuery('')}>&times;</button>}
        </div>
      )}

      {q && filtered.length === 0 ? (
        <div className="search-empty-state">
          <span>&#128269;</span>
          <span>No results for &ldquo;{searchQuery}&rdquo;</span>
        </div>
      ) : (
        <div className="breakdown-card people-list-card">
          {filtered.map((m, i) => (
            <PersonRow
              key={m._id}
              m={m}
              i={i}
              onNavigate={() => onSelectMember(m._id)}
              allMembers={members}
            />
          ))}
          {groupInsight && (
            <div style={{ padding: '8px 14px 12px' }}>
              <AiCallout label="Group Composition">{groupInsight}</AiCallout>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
