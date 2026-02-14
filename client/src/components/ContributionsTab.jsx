import { useState, useEffect, useCallback, useMemo } from 'react';
import { api } from '../api';

const MEMBER_COLORS = ['#2563eb', '#3b82f6', '#7c3aed', '#6366f1', '#1d4ed8'];

const MODEL_KEYS = ['equal', 'proportional', 'hybrid'];
const MODEL_NAMES = { equal: 'Even Split', proportional: 'Income-Based', hybrid: 'Balanced' };
const MODEL_DESC = { equal: 'Same dollar amount', proportional: 'Same % of income', hybrid: '50/50 blend' };

const fmt = (n) => (n < 0 ? '-' : '') + '$' + Math.abs(Math.round(n)).toLocaleString();
const pctFmt = (n) => (n * 100).toFixed(1) + '%';
const roomColor = (r) => r >= 1000 ? '#16a34a' : r >= 500 ? '#ca8a04' : '#dc2626';

function generateModelDistribution(model, modelKey) {
  if (!model?.members?.length) return null;
  const sorted = [...model.members].sort((a, b) => b.paymentAmount - a.paymentAmount);
  const top = sorted[0];
  const bottom = sorted[sorted.length - 1];

  // Calculate total obligation ratios (housing + existing debt / income)
  const ratios = sorted.map((m) => ({
    name: m.displayName,
    ratio: m.monthlyIncome > 0 ? ((m.monthlyObligations || 0) + m.paymentAmount) / m.monthlyIncome : 0,
  }));
  const atRisk = ratios.filter((r) => r.ratio > 0.40);
  const above36 = ratios.filter((r) => r.ratio > 0.36);

  if (modelKey === 'equal') {
    const bottomRatio = ratios.find((r) => r.name === bottom.displayName);
    const topRatio = ratios.find((r) => r.name === top.displayName);
    return `${bottom.displayName}'s total obligation ratio reaches ${(bottomRatio.ratio * 100).toFixed(1)}% under equal split, breaching the 36% caution threshold ${bottomRatio.ratio > 0.43 ? 'and the 43% lending wall' : `with ${(43 - bottomRatio.ratio * 100).toFixed(1)} points of clearance to the 43% lending wall`}. ${top.displayName} carries a ${(topRatio.ratio * 100).toFixed(1)}% total obligation ratio at the same dollar amount, a ${fmt(Math.round((bottomRatio.ratio - topRatio.ratio) * top.monthlyIncome))} effective subsidy gap that income-based models eliminate.`;
  }
  if (modelKey === 'proportional') {
    if (atRisk.length > 0) {
      const r = atRisk[0];
      return `${r.name}'s total obligation ratio reaches ${(r.ratio * 100).toFixed(1)}% under income-based allocation, placing them ${(43 - r.ratio * 100).toFixed(1)} points from the 43% lending wall even with proportional distribution. Adding a no-new-credit clause for ${r.name} during the lease term is the only way to prevent this ratio from breaching the hard limit.`;
    }
    return `Income-based allocation keeps all total obligation ratios below 36%: ${top.displayName} at ${(ratios[0].ratio * 100).toFixed(1)}% and ${bottom.displayName} at ${(ratios[ratios.length - 1].ratio * 100).toFixed(1)}%. The ${fmt(top.paymentAmount - bottom.paymentAmount)} spread between highest and lowest payment reflects earning capacity and keeps everyone clear of the 43% lending wall.`;
  }
  // hybrid
  if (atRisk.length > 0) {
    const r = atRisk[0];
    return `${r.name}'s total obligation ratio hits ${(r.ratio * 100).toFixed(1)}% under balanced split, combining ${fmt(sorted.find((m) => m.displayName === r.name)?.monthlyObligations || 0)}/mo existing debt with their housing share to sit ${(43 - r.ratio * 100).toFixed(1)} points from the 43% lending wall. The group needs a contingency clause for redistributing ${r.name}'s share if their total obligations breach 43%.`;
  }
  const spread = ratios[0].ratio - ratios[ratios.length - 1].ratio;
  return `Balanced split produces a ${(spread * 100).toFixed(1)} percentage-point spread in total obligation ratios across the group, with ${above36.length > 0 ? `${above36.length} member${above36.length > 1 ? 's' : ''} above the 36% caution threshold` : 'all members below the 36% caution threshold'}. ${bottom.displayName}'s ${(ratios[ratios.length - 1].ratio * 100).toFixed(1)}% total obligation ratio provides ${(43 - ratios[ratios.length - 1].ratio * 100).toFixed(1)} points of buffer to the lending wall, the tightest margin in the group.`;
}

function generateModelAffordability(model) {
  if (!model?.members?.length) return null;
  const sorted = [...model.members].sort((a, b) => b.paymentAmount - a.paymentAmount);

  const vulnerable = [...sorted].sort((a, b) => a.breathingRoom - b.breathingRoom);
  const weakest = vulnerable[0];
  const strongest = vulnerable[vulnerable.length - 1];
  const totalBreathing = sorted.reduce((s, m) => s + m.breathingRoom, 0);
  const onePayment = sorted[0]?.paymentAmount || 0;
  const overMembers = sorted.filter((m) => m.exceedsAffordability);

  if (overMembers.length > 0) {
    const o = overMembers[0];
    const totalRatio = o.monthlyIncome > 0 ? (((o.monthlyObligations || 0) + o.paymentAmount) / o.monthlyIncome * 100).toFixed(1) : 'N/A';
    return `${o.displayName} exceeds the 30% HUD affordability threshold with a total obligation ratio of ${totalRatio}%, and the group's combined breathing room of ${fmt(totalBreathing)} ${totalBreathing >= onePayment * 2 ? 'covers' : 'falls short of'} the industry-standard 2-month emergency reserve of ${fmt(onePayment * 2)}. Require a shared reserve fund of ${fmt(Math.round(onePayment * 2))} before lease signing to cover one missed payment from ${o.displayName}.`;
  }

  return `${weakest.displayName} holds the group's tightest position at ${fmt(weakest.breathingRoom)} monthly breathing room, while the group's combined ${fmt(totalBreathing)} ${totalBreathing >= onePayment * 2 ? 'meets' : 'falls below'} the 2-month reserve benchmark of ${fmt(onePayment * 2)}. Build a shared emergency fund equal to ${fmt(Math.round(onePayment * 2))} into the group agreement to ensure one missed payment from any member does not cascade into a group default.`;
}

function Checkbox({ checked, color }) {
  return (
    <div
      className={`risk-checkbox${checked ? ' checked' : ''}`}
      style={{ borderColor: checked ? color : undefined, background: checked ? color : undefined }}
    >
      {checked && (
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="20 6 9 17 4 12" />
        </svg>
      )}
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

export default function ContributionsTab({ projectId, members, estimatedMonthlyCost }) {
  const [contributions, setContributions] = useState(null);
  const [excludeIds, setExcludeIds] = useState([]);
  const [activeModel, setActiveModel] = useState('hybrid');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const eligibleMembers = members.filter(
    (m) => m.orgStatus === 'approved' && m.creditStatus === 'complete'
  );

  const fetchContributions = useCallback(() => {
    setLoading(true);
    setError('');
    api.getContributions(projectId, excludeIds)
      .then(setContributions)
      .catch((err) => setError(err.data?.message || err.message))
      .finally(() => setLoading(false));
  }, [projectId, excludeIds]);

  useEffect(() => {
    fetchContributions();
  }, [fetchContributions]);

  function toggleMember(memberId) {
    const included = eligibleMembers.filter((m) => !excludeIds.includes(m._id));
    if (!excludeIds.includes(memberId) && included.length <= 2) return;
    setExcludeIds((prev) =>
      prev.includes(memberId)
        ? prev.filter((id) => id !== memberId)
        : [...prev, memberId]
    );
  }

  const model = contributions?.[activeModel];
  const modelMembers = model?.members
    ? [...model.members].sort((a, b) => b.paymentAmount - a.paymentAmount)
    : [];
  const allModelMembers = contributions?.[MODEL_KEYS.find((k) => contributions[k])]?.members || [];
  const availableModels = MODEL_KEYS.filter((k) => contributions?.[k]);

  // Per-model AI insights — use server text if available, otherwise generate client-side
  const distributionText = useMemo(() => {
    if (excludeIds.length > 0) return null;
    const serverText = contributions?.aiAnalysis?.distribution;
    if (serverText) return serverText;
    return generateModelDistribution(model, activeModel);
  }, [contributions, model, activeModel, excludeIds.length]);

  const affordabilityText = useMemo(() => {
    if (excludeIds.length > 0) return null;
    const serverText = contributions?.aiAnalysis?.affordability;
    if (serverText) return serverText;
    return generateModelAffordability(model);
  }, [contributions, model, activeModel, excludeIds.length]);

  const recommendationText = useMemo(() => {
    if (excludeIds.length > 0) return null;
    return contributions?.aiAnalysis?.recommendation || null;
  }, [contributions, excludeIds.length]);

  if (loading && !contributions) {
    return (
      <div className="loading-container">
        <div className="spinner" />
        <p>Calculating breakdown...</p>
      </div>
    );
  }

  if (error && !contributions) {
    return (
      <div className="tab-error-container">
        <div className="tab-error"><p>{error}</p></div>
        <button className="btn btn-secondary btn-sm" onClick={fetchContributions} style={{ marginTop: 12 }}>Retry</button>
      </div>
    );
  }

  if (!contributions) return null;

  const totalPayment = modelMembers.reduce((s, m) => s + m.paymentAmount, 0);

  function getColor(memberId, fallback) {
    const idx = eligibleMembers.findIndex((em) => em._id === memberId);
    return MEMBER_COLORS[(idx >= 0 ? idx : fallback) % MEMBER_COLORS.length];
  }

  return (
    <div className="contributions-content">
      {/* CONTROLS */}
      <div className="breakdown-card breakdown-controls">
        <div className="breakdown-controls-left">
          <span className="breakdown-include-label">Include</span>
          {eligibleMembers.map((m, i) => {
            const color = MEMBER_COLORS[i % MEMBER_COLORS.length];
            const isIn = !excludeIds.includes(m._id);
            return (
              <button
                key={m._id}
                className={`breakdown-include-btn${isIn ? '' : ' excluded'}`}
                style={isIn ? { borderColor: `${color}25` } : undefined}
                onClick={() => toggleMember(m._id)}
                type="button"
                disabled={loading}
              >
                <Checkbox checked={isIn} color={color} />
                <div style={{ width: 16, height: 16, borderRadius: 4, background: color, display: 'grid', placeItems: 'center', color: 'white', fontSize: 8, fontWeight: 800, flexShrink: 0 }}>{m.firstName[0]}</div>
                <span style={{ fontSize: 11, fontWeight: 700 }}>{m.firstName}</span>
              </button>
            );
          })}
        </div>
        <div className="breakdown-model-pills">
          {availableModels.map((key) => (
            <button
              key={key}
              className={`breakdown-model-pill${activeModel === key ? ' active' : ''}`}
              onClick={() => setActiveModel(key)}
            >{MODEL_NAMES[key]}</button>
          ))}
        </div>
      </div>

      {loading && contributions && (
        <div className="loading-inline">
          <div className="spinner sm" /><span>Recalculating...</span>
        </div>
      )}

      {error && contributions && (
        <div className="tab-error" style={{ marginBottom: 0 }}><p>{error}</p></div>
      )}

      {/* COST BAR */}
      <div className={`breakdown-card breakdown-cost-card${loading ? ' section-loading' : ''}`}>
        <div className="breakdown-cost-header">
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
            <span style={{ fontWeight: 800, fontSize: 14, letterSpacing: '-0.02em' }}>{MODEL_NAMES[activeModel]}</span>
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{MODEL_DESC[activeModel]}</span>
          </div>
          <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)' }}>{modelMembers.length} people · {fmt(estimatedMonthlyCost || totalPayment)}/mo total</span>
        </div>
        <div className="breakdown-cost-bar">
          {modelMembers.map((m, i) => {
            const color = getColor(m.memberId, i);
            const w = totalPayment > 0 ? (m.paymentAmount / totalPayment) * 100 : 0;
            return (
              <div
                key={m.memberId}
                className="breakdown-cost-segment"
                style={{
                  width: `${w}%`,
                  background: `linear-gradient(160deg, ${color}20, ${color}45)`,
                  borderRight: i < modelMembers.length - 1 ? '1.5px solid white' : 'none',
                }}
              >
                {w > 11 && (
                  <span style={{ fontSize: 10, fontWeight: 700, color, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', padding: '0 6px' }}>
                    {m.displayName} · {fmt(m.paymentAmount)} · {pctFmt(m.percentageOfIncome || 0)}
                  </span>
                )}
              </div>
            );
          })}
        </div>
        {/* AI: DISTRIBUTION */}
        {distributionText && (
          <div style={{ marginTop: 8 }}>
            <AiCallout label="Distribution">{distributionText}</AiCallout>
          </div>
        )}
      </div>

      {/* PER-PERSON BREAKDOWN */}
      <div className={`breakdown-card breakdown-persons-card${loading ? ' section-loading' : ''}`}>
        <div className="breakdown-persons-header">
          <span style={{ fontWeight: 800, fontSize: 14, letterSpacing: '-0.02em' }}>Per-Person Breakdown</span>
          <div className="breakdown-bar-legend">
            <span><span className="breakdown-legend-dot" style={{ background: '#f87171' }} />Debt</span>
            <span><span className="breakdown-legend-dot" style={{ background: '#60a5fa' }} />Housing</span>
            <span><span className="breakdown-legend-dot" style={{ background: '#4ade80' }} />Room</span>
          </div>
        </div>

        {modelMembers.map((m, i) => {
          const color = getColor(m.memberId, i);
          const income = m.monthlyIncome || 0;
          const debt = m.monthlyObligations || 0;
          const over = m.exceedsAffordability;
          const room = m.breathingRoom;
          const rc = roomColor(room);

          const debtW = income > 0 ? (debt / income) * 100 : 0;
          const housingW = income > 0 ? (room < 0 ? (100 - debtW) : (m.paymentAmount / income) * 100) : 0;
          const roomW = income > 0 ? Math.max(0, (room / income) * 100) : 0;

          return (
            <div key={m.memberId} style={{ padding: '8px 0', borderBottom: i < modelMembers.length - 1 ? '1px solid #f1f5f9' : 'none' }}>
              {/* Info row */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                  <div style={{ width: 22, height: 22, borderRadius: 6, background: color, display: 'grid', placeItems: 'center', color: 'white', fontSize: 10, fontWeight: 800, flexShrink: 0 }}>{m.displayName[0]}</div>
                  <span style={{ fontWeight: 700, fontSize: 13 }}>{m.displayName}</span>
                  <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{fmt(income)}/mo</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 18, fontWeight: 900, letterSpacing: '-0.03em', fontVariantNumeric: 'tabular-nums' }}>{fmt(m.paymentAmount)}</span>
                  {m.percentageOfIncome != null && (
                    <span style={{ fontSize: 10, fontWeight: 600, color: over ? 'var(--error)' : 'var(--text-secondary)' }}>{pctFmt(m.percentageOfIncome)}</span>
                  )}
                  {over && <span className="breakdown-over-badge">30%+</span>}
                  <span style={{ fontSize: 10, fontWeight: 700, color: rc, minWidth: 48, textAlign: 'right' }}>{fmt(room)} left</span>
                </div>
              </div>
              {/* Allocation bar */}
              {income > 0 && (
                <div className="alloc-bar" style={{ height: 22, borderRadius: 6 }}>
                  <div className="alloc-segment alloc-debt" style={{ width: `${debtW}%` }}>
                    {debtW > 8 && <span style={{ fontSize: 8, fontWeight: 700, color: '#991b1b', whiteSpace: 'nowrap' }}>{fmt(debt)}</span>}
                  </div>
                  <div className="alloc-segment" style={{ width: `${housingW}%`, background: `linear-gradient(90deg, ${color}25, ${color}45)` }}>
                    {housingW > 10 && (
                      <span style={{ fontSize: 8, fontWeight: 700, color, whiteSpace: 'nowrap' }}>{room < 0 ? `${fmt(room)} short` : fmt(m.paymentAmount)}</span>
                    )}
                  </div>
                  {room > 0 && (
                    <div className="alloc-segment" style={{ width: `${roomW}%`, background: `linear-gradient(90deg, ${rc}20, ${rc}40)` }}>
                      {roomW > 12 && <span style={{ fontSize: 8, fontWeight: 700, color: rc, whiteSpace: 'nowrap' }}>{fmt(room)}</span>}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
        {/* AI: AFFORDABILITY */}
        {affordabilityText && (
          <div style={{ marginTop: 8 }}>
            <AiCallout label="Affordability">{affordabilityText}</AiCallout>
          </div>
        )}
      </div>

      {/* RECOMMENDATION */}
      {recommendationText && (
        <AiCallout label="Recommendation">{recommendationText}</AiCallout>
      )}

      {/* ALL MODELS TABLE — full width */}
      <div className="breakdown-card breakdown-glance-card">
        <div style={{ fontWeight: 800, fontSize: 14, letterSpacing: '-0.02em', marginBottom: 8 }}>All Models</div>
        <table className="breakdown-glance-table">
          <thead>
            <tr>
              <th />
              {availableModels.map((key) => (
                <th key={key} className={activeModel === key ? 'active' : ''}>{MODEL_NAMES[key]}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {allModelMembers.map((row, i) => {
              const color = getColor(row.memberId, i);
              return (
                <tr key={row.memberId}>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                      <div style={{ width: 16, height: 16, borderRadius: 4, background: color, display: 'grid', placeItems: 'center', color: 'white', fontSize: 8, fontWeight: 800 }}>{row.displayName[0]}</div>
                      <span style={{ fontSize: 11, fontWeight: 600 }}>{row.displayName}</span>
                    </div>
                  </td>
                  {availableModels.map((key) => {
                    const e = contributions[key]?.members?.find((m) => m.memberId === row.memberId);
                    if (!e) return <td key={key}>-</td>;
                    const over = e.exceedsAffordability;
                    return (
                      <td key={key} className={`${activeModel === key ? 'active' : ''}${over ? ' over' : ''}`}>
                        <span className="breakdown-glance-amount" style={over ? { color: 'var(--error)' } : undefined}>{fmt(e.paymentAmount)}</span>
                        <span className="breakdown-glance-sub">{pctFmt(e.percentageOfIncome || 0)} · {fmt(e.breathingRoom)}</span>
                      </td>
                    );
                  })}
                </tr>
              );
            })}
            <tr className="breakdown-glance-totals">
              <td>Total</td>
              {availableModels.map((key) => {
                const total = contributions[key]?.members?.reduce((s, m) => s + m.paymentAmount, 0) || 0;
                return (
                  <td key={key} className={activeModel === key ? 'active' : ''}>
                    <span className="breakdown-glance-amount">{fmt(total)}</span>
                  </td>
                );
              })}
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
