const MEMBER_COLORS = ['#2563eb', '#3b82f6', '#7c3aed', '#6366f1', '#1d4ed8'];

const fmt = (n) => (n < 0 ? '-' : '') + '$' + Math.abs(Math.round(n)).toLocaleString();
const scoreColor = (s) => s >= 740 ? '#16a34a' : s >= 670 ? '#ca8a04' : '#dc2626';
const cviLabel = (s) => s >= 80 ? 'strong' : s >= 60 ? 'moderate' : 'weak';
const cviDotColor = (s) => s >= 80 ? '#16a34a' : s >= 60 ? '#ca8a04' : '#dc2626';

const STATUS_COLORS = { approved: '#16a34a', flagged: '#ca8a04', ineligible: '#dc2626' };

function CheckIcon({ clear, label, count }) {
  if (clear) {
    return (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
        <svg width="14" height="14" viewBox="0 0 16 16">
          <circle cx="8" cy="8" r="8" fill="#16a34a" opacity="0.12" />
          <path d="M5 8l2 2 4-4" fill="none" stroke="#16a34a" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <span style={{ fontSize: 10, color: '#64748b' }}>{label}</span>
      </span>
    );
  }
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
      <svg width="14" height="14" viewBox="0 0 16 16">
        <circle cx="8" cy="8" r="8" fill="#dc2626" opacity="0.12" />
        <path d="M5.5 5.5l5 5M10.5 5.5l-5 5" fill="none" stroke="#dc2626" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
      <span style={{ fontSize: 10, color: '#dc2626', fontWeight: 600 }}>{label}{count > 0 ? ` (${count})` : ''}</span>
    </span>
  );
}

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

function hasFlags(m) {
  return (
    m.delinquencyCount > 0 ||
    m.evictionRecordCount > 0 ||
    (m.creditScore != null && m.creditScore < 670) ||
    m.employmentType === 'gig' ||
    m.criminalRecordCount > 0
  );
}

function generateRiskInsight(m, allMembers) {
  const parts = [];
  const name = m.firstName;

  // Calculate group weighted credit average for context
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

function PersonRow({ m, i, onClick, allMembers }) {
  const color = MEMBER_COLORS[i % MEMBER_COLORS.length];
  const flagged = hasFlags(m);
  const riskText = flagged ? generateRiskInsight(m, allMembers) : null;

  return (
    <div className="people-row" onClick={onClick}>
      {/* Layer 1: Identity + Key Numbers */}
      <div className="people-row-main">
        <div className="people-row-identity">
          <div className="people-avatar" style={{ background: color }}>{m.firstName[0]}</div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 13, fontWeight: 700 }}>{m.firstName} {m.lastInitial}.</span>
              {m.orgStatus && STATUS_COLORS[m.orgStatus] && (
                <span style={{ fontSize: 9, fontWeight: 700, color: STATUS_COLORS[m.orgStatus], textTransform: 'capitalize' }}>{m.orgStatus}</span>
              )}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, color: 'var(--text-muted)' }}>
              <EmploymentIcon type={m.employmentType} />
              <span>{m.employmentType} · {(m.incomeShare * 100).toFixed(0)}% of group income</span>
            </div>
          </div>
        </div>
        <div className="people-row-stats">
          <div className="people-stat">
            <span className="people-stat-value">{fmt(m.monthlyIncome)}/mo</span>
            <span className="people-stat-label">income</span>
          </div>
          <div className="people-stat credit-stat">
            <span className="people-stat-value" style={{ color: m.creditScore != null ? scoreColor(m.creditScore) : 'var(--text-muted)' }}>
              {m.creditScore ?? '—'}
            </span>
            <span className="people-stat-label">credit</span>
          </div>
          <div className="people-stat">
            <span className="people-stat-value">{fmt(m.monthlyObligations)}/mo</span>
            <span className="people-stat-label">{m.personalDTI != null ? `${(m.personalDTI * 100).toFixed(1)}% DTI` : 'debt'}</span>
          </div>
          <svg className="people-chevron" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2" strokeLinecap="round"><polyline points="9 18 15 12 9 6" /></svg>
        </div>
      </div>

      {/* Layer 2: Screening Sections */}
      <div className="people-screening">
        <div className="people-screen-col">
          <span className="people-screen-label">Credit</span>
          <span className="people-screen-value">
            {m.creditStatus === 'complete' ? (
              <>
                {m.creditScore} score, {m.paymentHistoryPct ?? '—'}% on-time,{' '}
                {m.delinquencyCount > 0 ? (
                  <span style={{ background: '#fef2f2', color: '#dc2626', fontWeight: 700, padding: '1px 5px', borderRadius: 4, fontSize: 10, border: '1px solid rgba(220,38,38,0.15)' }}>
                    {m.delinquencyCount} delinq.
                  </span>
                ) : (
                  <>{m.delinquencyCount} delinq.,</>
                )}
                {' '}{m.openTradelinesCount} tradelines
              </>
            ) : m.creditStatus === 'failed' ? <span style={{ color: 'var(--error)' }}>Check failed</span> : 'Processing...'}
          </span>
        </div>
        <div className="people-screen-col">
          <span className="people-screen-label">Background</span>
          <span className="people-screen-value">
            {m.criminalStatus === 'complete' && m.evictionStatus === 'complete' ? (
              <span style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <CheckIcon clear={m.criminalRecordCount === 0} label="Criminal" count={m.criminalRecordCount} />
                <CheckIcon clear={m.evictionRecordCount === 0} label="Eviction" count={m.evictionRecordCount} />
              </span>
            ) : 'Processing...'}
          </span>
        </div>
        <div className="people-screen-col">
          <span className="people-screen-label">Identity</span>
          <span className="people-screen-value">
            {m.identityStatus === 'complete' && m.cviScore != null ? (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                <span style={{ width: 7, height: 7, borderRadius: '50%', background: cviDotColor(m.cviScore), flexShrink: 0 }} />
                <span style={{ fontSize: 11, fontWeight: 700, color: '#0f172a' }}>{m.cviScore}</span>
                <span style={{ fontSize: 10, color: '#94a3b8' }}>{cviLabel(m.cviScore)}</span>
              </span>
            ) : m.identityStatus === 'failed' ? <span style={{ color: 'var(--error)' }}>Check failed</span> : 'Processing...'}
          </span>
        </div>
      </div>

      {/* Layer 3: Risk Insight (conditional) */}
      {riskText && (
        <div className="people-risk-line">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#92400e" strokeWidth="2.5" strokeLinecap="round" style={{ flexShrink: 0, marginTop: 1 }}>
            <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
            <line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
          <span>{riskText}</span>
        </div>
      )}
    </div>
  );
}

export default function MembersTab({ members, groupAssessment, onSelectMember }) {
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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {groupInsight && (
        <AiCallout label="Group Composition">{groupInsight}</AiCallout>
      )}

      <div className="breakdown-card people-list-card">
        {members.map((m, i) => (
          <PersonRow
            key={m._id}
            m={m}
            i={i}
            onClick={() => onSelectMember(m._id)}
            allMembers={members}
          />
        ))}
      </div>
    </div>
  );
}
