import { useState, useEffect } from 'react';
import { api } from '../api';

const MEMBER_COLORS = ['#2563eb', '#3b82f6', '#7c3aed', '#6366f1', '#1d4ed8'];

const ORG_STATUSES = [
  { value: 'approved', label: 'Approved', bg: 'var(--success-bg)', color: 'var(--success)', border: 'rgba(22,163,74,0.2)' },
  { value: 'flagged', label: 'Flagged', bg: 'var(--warning-bg)', color: 'var(--warning)', border: 'rgba(217,119,6,0.2)' },
  { value: 'ineligible', label: 'Ineligible', bg: 'var(--error-bg)', color: 'var(--error)', border: 'rgba(220,38,38,0.2)' },
];

const fmt = (n) => '$' + Math.abs(Math.round(n)).toLocaleString();
const scoreColor = (s) => s >= 740 ? 'var(--success)' : s >= 670 ? 'var(--warning)' : 'var(--error)';
const cviLabel = (s) => s >= 80 ? 'Strong match' : s >= 50 ? 'Moderate' : 'Weak';
const cviColor = (s) => s >= 80 ? 'var(--success)' : s >= 50 ? 'var(--warning)' : 'var(--error)';

function MetricCard({ label, value, sub, valueColor }) {
  return (
    <div className="overlay-metric">
      <span className="overlay-metric-label">{label}</span>
      <span className="overlay-metric-value" style={valueColor ? { color: valueColor } : undefined}>{value}</span>
      {sub && <span className="overlay-metric-sub">{sub}</span>}
    </div>
  );
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

export default function MemberProfile({ projectId, memberId, memberIndex = 0, onClose, onStatusUpdate }) {
  const [member, setMember] = useState(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const [notes, setNotes] = useState('');
  const [fetchError, setFetchError] = useState('');
  const [showTradelines, setShowTradelines] = useState(false);

  const color = MEMBER_COLORS[memberIndex % MEMBER_COLORS.length];

  function fetchMember() {
    setLoading(true);
    setFetchError('');
    api.getMember(projectId, memberId)
      .then((data) => { setMember(data); setNotes(data.orgNotes || ''); })
      .catch((err) => setFetchError(err.message || 'Failed to load'))
      .finally(() => setLoading(false));
  }

  useEffect(() => { fetchMember(); }, [projectId, memberId]);

  async function handleStatusChange(newStatus) {
    setUpdating(true);
    try {
      await api.updateMemberStatus(projectId, memberId, newStatus, notes);
      setMember((prev) => ({ ...prev, orgStatus: newStatus, orgNotes: notes }));
      onStatusUpdate?.();
    } catch {} finally { setUpdating(false); }
  }

  async function handleRetryChecks() {
    setRetrying(true);
    try { await api.retryChecks(projectId, memberId); fetchMember(); }
    catch {} finally { setRetrying(false); }
  }

  const hasFailedChecks = member && (
    member.credit?.status === 'failed' || member.criminal?.status === 'failed' ||
    member.eviction?.status === 'failed' || member.identity?.status === 'failed'
  );
  const hasPendingChecks = member && (
    member.credit?.status === 'pending' || member.criminal?.status === 'pending' ||
    member.eviction?.status === 'pending' || member.identity?.status === 'pending'
  );

  const tradelines = member?.credit?.tradelines || [];
  const cviScore = member?.identity?.cviScore;
  const aiText = member?.aiAssessment?.full || member?.aiAssessment?.text;
  const creditComplete = member?.credit?.status === 'complete';

  return (
    <>
      {/* Backdrop */}
      <div className="overlay-backdrop" onClick={onClose} />

      {/* Panel */}
      <div className="overlay-panel">
        {/* Color accent */}
        <div style={{ height: 3, background: color, flexShrink: 0, borderRadius: '16px 16px 0 0' }} />

        {/* Sticky header */}
        <div className="overlay-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: color, display: 'grid', placeItems: 'center', color: 'white', fontSize: 16, fontWeight: 800, flexShrink: 0 }}>
              {member?.firstName?.[0]?.toUpperCase()}
            </div>
            <div>
              <div style={{ fontSize: 17, fontWeight: 800, letterSpacing: '-0.02em' }}>
                {member ? `${member.firstName} ${member.lastInitial}.` : 'Loading...'}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                {member?.ssnLast4 && <>***-**-{member.ssnLast4}</>}
                {member?.dateSubmitted && <> · Submitted {new Date(member.dateSubmitted).toLocaleDateString()}</>}
              </div>
            </div>
          </div>
          <button className="overlay-close" onClick={onClose}>&times;</button>
        </div>

        {/* Body */}
        <div className="overlay-body">
          {loading ? (
            <div className="loading-container" style={{ padding: '48px 0' }}>
              <div className="spinner" /><p>Loading applicant data...</p>
            </div>
          ) : fetchError ? (
            <div style={{ padding: 20 }}>
              <div className="tab-error"><p>{fetchError}</p></div>
              <button className="btn btn-secondary btn-sm" onClick={fetchMember} style={{ marginTop: 10 }}>Retry</button>
            </div>
          ) : !member ? (
            <p style={{ padding: 20, color: 'var(--error)' }}>Applicant not found</p>
          ) : (
            <>
              {/* Key Metrics Row */}
              <div className="overlay-metrics-row">
                <MetricCard
                  label="Credit Score"
                  value={creditComplete ? member.credit.score : '—'}
                  valueColor={creditComplete ? scoreColor(member.credit.score) : undefined}
                  sub={creditComplete ? `${member.credit.paymentHistoryPercentage ?? '—'}% on-time` : undefined}
                />
                <MetricCard
                  label="Monthly Income"
                  value={fmt(member.monthlyIncome)}
                  sub={member.employmentType}
                />
                <MetricCard
                  label="Monthly Debt"
                  value={creditComplete ? fmt(member.credit.monthlyObligations) : '—'}
                  sub={member.personalDTI != null ? `${(member.personalDTI * 100).toFixed(1)}% DTI` : undefined}
                />
                <MetricCard
                  label="Total Outstanding"
                  value={creditComplete ? fmt(member.credit.totalDebt) : '—'}
                  sub={creditComplete ? `${member.credit.openTradelinesCount} tradelines` : undefined}
                />
                <MetricCard
                  label="Identity (CVI)"
                  value={cviScore != null ? cviScore : '—'}
                  valueColor={cviScore != null ? cviColor(cviScore) : undefined}
                  sub={cviScore != null ? cviLabel(cviScore) : undefined}
                />
              </div>

              {/* Two-column detail */}
              <div className="overlay-detail-grid">
                {/* Left: Credit + Tradelines */}
                <div>
                  {creditComplete ? (
                    <div className="overlay-section">
                      <div className="overlay-section-title">Credit Report</div>
                      <div className="overlay-kv-grid">
                        <div className="overlay-kv"><span>Payment History</span><span>{member.credit.paymentHistoryPercentage ?? 'N/A'}%</span></div>
                        <div className="overlay-kv"><span>Delinquencies</span><span style={member.credit.delinquencyCount > 0 ? { color: 'var(--error)', fontWeight: 700 } : undefined}>{member.credit.delinquencyCount}</span></div>
                        <div className="overlay-kv"><span>Open Tradelines</span><span>{member.credit.openTradelinesCount}</span></div>
                        <div className="overlay-kv"><span>Public Records</span><span style={member.credit.publicRecordsCount > 0 ? { color: 'var(--error)', fontWeight: 700 } : undefined}>{member.credit.publicRecordsCount}</span></div>
                        <div className="overlay-kv"><span>Disposable Income</span><span>{member.disposableIncome != null ? fmt(member.disposableIncome) : 'N/A'}</span></div>
                      </div>
                    </div>
                  ) : (
                    <div className="overlay-section">
                      <div className="overlay-section-title">Credit Report</div>
                      <div className={member.credit?.status === 'failed' ? 'check-failed-banner' : 'check-pending-banner'}>
                        {member.credit?.status === 'failed' ? `Credit pull failed${member.credit.error ? `: ${member.credit.error}` : ''}` : <><div className="spinner sm" /> Processing...</>}
                      </div>
                    </div>
                  )}

                  {tradelines.length > 0 && (
                    <div className="overlay-section">
                      <button className="tradelines-toggle" onClick={() => setShowTradelines(!showTradelines)} style={{ marginBottom: showTradelines ? 6 : 0 }}>
                        {showTradelines ? 'Hide' : 'Show'} Tradelines ({tradelines.length})
                        <span style={{ fontSize: 10 }}>{showTradelines ? '▲' : '▼'}</span>
                      </button>
                      {showTradelines && (
                        <table className="overlay-tradelines">
                          <thead>
                            <tr><th>Creditor</th><th>Balance</th><th>Payment</th><th>Type</th></tr>
                          </thead>
                          <tbody>
                            {tradelines.map((t, i) => (
                              <tr key={i}>
                                <td>{t.creditor || 'Unknown'}</td>
                                <td>{fmt(t.balance ?? 0)}</td>
                                <td>{fmt(t.monthlyPayment ?? 0)}</td>
                                <td>{t.type || '—'}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                    </div>
                  )}
                </div>

                {/* Right: Background + Status + Notes */}
                <div>
                  <div className="overlay-section">
                    <div className="overlay-section-title">Background Screening</div>
                    <div className="overlay-bg-checks">
                      <div className="overlay-bg-row">
                        <span>Criminal Records</span>
                        {member.criminal?.status === 'complete' ? (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                            {(member.criminal.records || []).length === 0 ? (
                              <>
                                <svg width="14" height="14" viewBox="0 0 16 16"><circle cx="8" cy="8" r="8" fill="#16a34a" opacity="0.12" /><path d="M5 8l2 2 4-4" fill="none" stroke="#16a34a" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
                                <span style={{ fontWeight: 700, color: 'var(--success)' }}>Clear</span>
                              </>
                            ) : (
                              <>
                                <svg width="14" height="14" viewBox="0 0 16 16"><circle cx="8" cy="8" r="8" fill="#dc2626" opacity="0.12" /><path d="M5.5 5.5l5 5M10.5 5.5l-5 5" fill="none" stroke="#dc2626" strokeWidth="1.8" strokeLinecap="round" /></svg>
                                <span style={{ fontWeight: 700, color: 'var(--error)' }}>{(member.criminal.records || []).length} found</span>
                              </>
                            )}
                          </span>
                        ) : (
                          <span style={{ fontWeight: 700, color: 'var(--text-muted)' }}>{member.criminal?.status === 'failed' ? 'Failed' : 'Pending'}</span>
                        )}
                      </div>
                      <div className="overlay-bg-row">
                        <span>Eviction Records</span>
                        {member.eviction?.status === 'complete' ? (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                            {(member.eviction.records || []).length === 0 ? (
                              <>
                                <svg width="14" height="14" viewBox="0 0 16 16"><circle cx="8" cy="8" r="8" fill="#16a34a" opacity="0.12" /><path d="M5 8l2 2 4-4" fill="none" stroke="#16a34a" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
                                <span style={{ fontWeight: 700, color: 'var(--success)' }}>Clear</span>
                              </>
                            ) : (
                              <>
                                <svg width="14" height="14" viewBox="0 0 16 16"><circle cx="8" cy="8" r="8" fill="#dc2626" opacity="0.12" /><path d="M5.5 5.5l5 5M10.5 5.5l-5 5" fill="none" stroke="#dc2626" strokeWidth="1.8" strokeLinecap="round" /></svg>
                                <span style={{ fontWeight: 700, color: 'var(--error)' }}>{(member.eviction.records || []).length} found</span>
                              </>
                            )}
                          </span>
                        ) : (
                          <span style={{ fontWeight: 700, color: 'var(--text-muted)' }}>{member.eviction?.status === 'failed' ? 'Failed' : 'Pending'}</span>
                        )}
                      </div>
                      <div className="overlay-bg-row">
                        <span>Identity CVI</span>
                        <span style={{ fontWeight: 700, color: cviScore != null ? cviColor(cviScore) : 'var(--text-muted)' }}>
                          {cviScore != null ? `${cviScore}/100` : member.identity?.status === 'failed' ? 'Failed' : 'Pending'}
                        </span>
                      </div>
                    </div>
                    {hasFailedChecks && (
                      <button className="btn btn-secondary btn-sm" onClick={handleRetryChecks} disabled={retrying} style={{ marginTop: 8 }}>
                        {retrying ? 'Retrying...' : 'Retry Failed Checks'}
                      </button>
                    )}
                    {hasPendingChecks && (
                      <button className="btn btn-secondary btn-sm" onClick={fetchMember} style={{ marginTop: 8 }}>Refresh Status</button>
                    )}
                  </div>

                  <div className="overlay-section">
                    <div className="overlay-section-title">Status</div>
                    <div style={{ display: 'flex', gap: 4 }}>
                      {ORG_STATUSES.map((s) => {
                        const active = member.orgStatus === s.value;
                        return (
                          <button
                            key={s.value}
                            className="overlay-status-btn"
                            style={active ? { background: s.bg, color: s.color, borderColor: s.border } : undefined}
                            onClick={() => handleStatusChange(s.value)}
                            disabled={updating}
                          >{s.label}</button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="overlay-section">
                    <div className="overlay-section-title">Notes</div>
                    <textarea
                      className="overlay-notes"
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="Internal notes about this applicant..."
                      rows={3}
                    />
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={() => handleStatusChange(member.orgStatus)}
                      disabled={updating}
                      style={{ marginTop: 4 }}
                    >{updating ? 'Saving...' : 'Save Notes'}</button>
                  </div>
                </div>
              </div>

              {/* AI Assessment */}
              {aiText && <AiCallout label="Assessment">{aiText}</AiCallout>}
              {!aiText && creditComplete && (
                <div style={{ fontSize: 12, color: 'var(--text-muted)', fontStyle: 'italic' }}>AI assessment temporarily unavailable</div>
              )}
            </>
          )}
        </div>
      </div>
    </>
  );
}
