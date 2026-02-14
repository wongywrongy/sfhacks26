import { useState, useEffect, useCallback, useMemo } from 'react';
import { api } from '../api';

const MEMBER_COLORS = ['#2563eb', '#3b82f6', '#7c3aed', '#6366f1', '#1d4ed8'];

const fmt = (n) => (n < 0 ? '-' : '') + '$' + Math.abs(Math.round(n)).toLocaleString();
const pctFmt = (n) => (n * 100).toFixed(1) + '%';
const dtiColor = (d) => d < 0.36 ? '#16a34a' : d <= 0.43 ? '#ca8a04' : '#dc2626';
const dtiLabel = (d) => d < 0.36 ? 'Healthy' : d <= 0.43 ? 'Tight' : 'Fails';
const roomColor = (r) => r >= 3000 ? '#16a34a' : r >= 1000 ? '#ca8a04' : '#dc2626';

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

function AllocationBar({ income, debt, housing, room, height = 30 }) {
  if (income <= 0) {
    return (
      <div className="alloc-bar alloc-bar-empty" style={{ height }}>
        <span className="alloc-bar-label">No income</span>
      </div>
    );
  }
  const debtW = (debt / income) * 100;
  const housingW = (housing / income) * 100;
  const roomW = Math.max(0, (room / income) * 100);
  const overflow = room < 0;
  return (
    <div className="alloc-bar" style={{ height }}>
      <div className="alloc-segment alloc-debt" style={{ width: `${debtW}%` }}>
        {debtW > 8 && <span className="alloc-bar-label">Debt {fmt(debt)}</span>}
      </div>
      <div className="alloc-segment alloc-housing" style={{ width: overflow ? `${100 - debtW}%` : `${housingW}%` }}>
        {(overflow ? (100 - debtW) : housingW) > 10 && (
          <span className="alloc-bar-label">{overflow ? `Housing (${fmt(room)} short)` : `Housing ${fmt(housing)}`}</span>
        )}
      </div>
      {!overflow && room > 0 && (
        <div className="alloc-segment alloc-room" style={{ width: `${roomW}%` }}>
          {roomW > 8 && <span className="alloc-bar-label alloc-room-label">Room {fmt(room)}</span>}
        </div>
      )}
    </div>
  );
}

function DtiGauge({ value, classification }) {
  const p = Math.min(value * 100, 60);
  const barColor = classification === 'healthy' ? '#10b981' : classification === 'acceptable' ? '#f59e0b' : '#ef4444';
  return (
    <div style={{ marginBottom: 4 }}>
      <div className="dti-bar-track" style={{ height: 10 }}>
        <div className="dti-bar-fill" style={{ width: `${(p / 60) * 100}%`, backgroundColor: barColor }} />
        <div className="dti-marker" style={{ left: '60%' }} />
        <div className="dti-marker dti-marker-warn" style={{ left: '71.7%' }} />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, color: 'var(--text-muted)', marginTop: 2, fontWeight: 500 }}>
        <span>0%</span>
        <span style={{ fontWeight: 600 }}>36%</span>
        <span style={{ fontWeight: 600 }}>43%</span>
        <span>60%</span>
      </div>
    </div>
  );
}

function RiskAnalysis({ analytics, dependencyInsight, removedIds, setRemovedIds }) {
  const breakdown = analytics.memberBreakdown || [];
  const monthlyCost = analytics.estimatedMonthlyCost || 0;
  const totalIncome = analytics.combinedIncome;
  const totalDebt = analytics.combinedObligations;
  const baselineDTI = analytics.groupDTI || 0;
  const baselineRoom = totalIncome - totalDebt - monthlyCost;

  const toggle = (id) => {
    setRemovedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) { next.delete(id); }
      else { if (next.size >= breakdown.length - 1) return prev; next.add(id); }
      return next;
    });
  };

  const allIncluded = removedIds.size === 0;

  const scenario = useMemo(() => {
    if (removedIds.size === 0) return null;
    const removed = breakdown.filter((m) => removedIds.has(m.memberId));
    const removedIncome = removed.reduce((s, m) => s + m.monthlyIncome, 0);
    const removedObligations = removed.reduce((s, m) => s + m.monthlyObligations, 0);
    const newIncome = totalIncome - removedIncome;
    const newDebt = totalDebt - removedObligations;
    const newDTI = newIncome > 0 ? (newDebt + monthlyCost) / newIncome : 1;
    const room = newIncome - newDebt - monthlyCost;
    const fails = newDTI > 0.43;
    return { removed, removedIncome, removedObligations, income: newIncome, debt: newDebt, dti: newDTI, room, fails };
  }, [removedIds, breakdown, totalIncome, totalDebt, monthlyCost]);

  return (
    <div className="breakdown-card" style={{ padding: '12px 14px', flex: 1.6, minHeight: 220 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
        <span style={{ fontWeight: 800, fontSize: 14, letterSpacing: '-0.02em' }}>Risk Analysis</span>
      </div>

      {/* Compact inline checkboxes */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 10 }}>
        {breakdown.map((m, i) => {
          const color = MEMBER_COLORS[i % MEMBER_COLORS.length];
          const isIn = !removedIds.has(m.memberId);
          return (
            <button
              key={m.memberId}
              className={`breakdown-include-btn${isIn ? '' : ' excluded'}`}
              style={isIn ? { borderColor: `${color}25` } : undefined}
              onClick={() => toggle(m.memberId)}
              type="button"
            >
              <Checkbox checked={isIn} color={color} />
              <div style={{ width: 16, height: 16, borderRadius: 4, background: color, display: 'grid', placeItems: 'center', color: 'white', fontSize: 8, fontWeight: 800, flexShrink: 0 }}>{m.displayName[0]}</div>
              <span style={{ fontSize: 11, fontWeight: 700 }}>{m.displayName}</span>
            </button>
          );
        })}
      </div>

      {/* Content area */}
      {allIncluded ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px 0', color: '#94a3b8', fontSize: 12, fontStyle: 'italic' }}>
          Uncheck a member to simulate their departure
        </div>
      ) : scenario && (
        <>
          <div style={{ padding: '10px 12px', borderRadius: 8, background: scenario.fails ? 'rgba(254,202,202,0.12)' : 'rgba(187,247,208,0.12)', border: scenario.fails ? '1px solid #fecaca' : '1px solid #bbf7d0' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
              <div>
                <span style={{ fontSize: 13, fontWeight: 800, letterSpacing: '-0.02em' }}>
                  Without {scenario.removed.map((r) => r.displayName).join(' & ')}
                </span>
                <span style={{ fontSize: 10, color: 'var(--text-secondary)', marginLeft: 8 }}>
                  -{fmt(scenario.removedIncome)}/mo
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ fontSize: 22, fontWeight: 900, letterSpacing: '-0.03em', fontVariantNumeric: 'tabular-nums', color: dtiColor(scenario.dti) }}>
                  {pctFmt(scenario.dti)}
                </span>
                <span style={{ fontSize: 10, fontWeight: 700, color: dtiColor(scenario.dti) }}>
                  {dtiLabel(scenario.dti)}
                </span>
              </div>
            </div>

            <AllocationBar income={scenario.income} debt={scenario.debt} housing={monthlyCost} room={scenario.room} height={22} />

            {/* DTI + Room with deltas */}
            <div style={{ display: 'flex', gap: 16, marginTop: 6, fontSize: 11 }}>
              <span style={{ display: 'flex', gap: 4, alignItems: 'baseline' }}>
                <span style={{ fontWeight: 800 }}>{pctFmt(scenario.dti)} DTI</span>
                {(() => { const d = scenario.dti - baselineDTI; return d !== 0 ? (
                  <span style={{ fontWeight: 700, fontSize: 10, color: d > 0 ? 'var(--error)' : 'var(--success)' }}>({d > 0 ? '+' : ''}{pctFmt(d)})</span>
                ) : null; })()}
              </span>
              <span style={{ display: 'flex', gap: 4, alignItems: 'baseline' }}>
                <span style={{ fontWeight: 800, color: roomColor(scenario.room) }}>{fmt(scenario.room)} room</span>
                {(() => { const d = scenario.room - baselineRoom; return d !== 0 ? (
                  <span style={{ fontWeight: 700, fontSize: 10, color: d < 0 ? 'var(--error)' : 'var(--success)' }}>({d > 0 ? '+' : ''}{fmt(d)})</span>
                ) : null; })()}
              </span>
            </div>
          </div>

          {dependencyInsight && <AiCallout label="Dependencies">{dependencyInsight}</AiCallout>}
        </>
      )}
    </div>
  );
}

export default function AnalyticsTab({ projectId }) {
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [removedIds, setRemovedIds] = useState(new Set());

  const fetchAnalytics = useCallback(() => {
    setLoading(true);
    setError('');
    api.getAnalytics(projectId)
      .then(setAnalytics)
      .catch((err) => setError(err.data?.message || err.message))
      .finally(() => setLoading(false));
  }, [projectId]);

  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  if (loading) {
    return (
      <div className="loading-container">
        <div className="spinner" />
        <p>Running group financials...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="tab-error-container">
        <div className="tab-error"><p>{error}</p></div>
        <button className="btn btn-secondary btn-sm" onClick={fetchAnalytics} style={{ marginTop: 12 }}>Retry</button>
      </div>
    );
  }

  if (!analytics) return null;

  const dtiPct = analytics.groupDTI != null ? (analytics.groupDTI * 100).toFixed(1) : 'N/A';
  const dtiClass = analytics.dtiClassification;

  const ai = analytics.aiAssessment;
  const overviewInsight = ai?.overview || null;
  const affordabilityInsight = ai?.affordability || null;
  const diversityInsight = ai?.incomeDiversity || null;
  const dependencyInsight = ai?.dependencies || null;

  const totalIncome = analytics.combinedIncome;
  const totalDebt = analytics.combinedObligations;
  const monthlyCost = analytics.estimatedMonthlyCost || 0;
  const groupRoom = totalIncome - totalDebt - monthlyCost;

  return (
    <div className="analytics-content">
      {/* STAT STRIP */}
      <div className="breakdown-card fin-stat-strip">
        {[
          { label: 'Combined Income', value: `$${analytics.combinedIncome.toLocaleString()}` },
          { label: 'Obligations', value: `$${analytics.combinedObligations.toLocaleString()}` },
          { label: 'Total Debt', value: `$${analytics.combinedDebt.toLocaleString()}` },
          { label: 'Buying Power', value: `$${analytics.estimatedLoanAmount.toLocaleString()}` },
          { label: 'Max Payment', value: `$${analytics.maxMonthlyPayment.toLocaleString()}` },
          { label: 'People Ready', value: analytics.memberCount },
        ].map((s, i, arr) => (
          <div key={s.label} className="fin-stat-cell" style={i < arr.length - 1 ? { borderRight: '1px solid rgba(0,0,0,0.06)' } : undefined}>
            <span className="fin-stat-value">{s.value}</span>
            <span className="fin-stat-label">{s.label}</span>
          </div>
        ))}
      </div>

      {/* DTI */}
      <div className="breakdown-card" style={{ padding: '10px 14px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
          <span style={{ fontWeight: 800, fontSize: 14, letterSpacing: '-0.02em' }}>Group DTI</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 24, fontWeight: 900, letterSpacing: '-0.03em', fontVariantNumeric: 'tabular-nums', color: dtiColor(analytics.groupDTI) }}>
              {dtiPct}%
            </span>
            <span className={`status-badge badge-${dtiClass === 'healthy' ? 'green' : dtiClass === 'acceptable' ? 'amber' : 'red'}`}>
              {dtiClass}
            </span>
          </div>
        </div>
        <DtiGauge value={analytics.groupDTI || 0} classification={dtiClass} />
        {affordabilityInsight && <AiCallout label="Affordability">{affordabilityInsight}</AiCallout>}
      </div>

      {/* GROUP AFFORDABILITY */}
      <div className="breakdown-card" style={{ padding: '10px 14px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
          <span style={{ fontWeight: 800, fontSize: 14, letterSpacing: '-0.02em' }}>Group Affordability</span>
          <div className="breakdown-bar-legend">
            <span><span className="breakdown-legend-dot" style={{ background: '#f87171' }} />Debt</span>
            <span><span className="breakdown-legend-dot" style={{ background: '#60a5fa' }} />Housing</span>
            <span><span className="breakdown-legend-dot" style={{ background: '#4ade80' }} />Room</span>
          </div>
        </div>
        <AllocationBar income={totalIncome} debt={totalDebt} housing={monthlyCost} room={groupRoom} height={34} />
        <div style={{ display: 'flex', gap: 14, marginTop: 4, fontSize: 10, color: 'var(--text-muted)' }}>
          <span>{fmt(totalIncome)} income</span>
          <span>{pctFmt(analytics.groupDTI)} DTI</span>
          <span style={{ color: roomColor(groupRoom), fontWeight: 700 }}>{fmt(groupRoom)} room</span>
        </div>
        {overviewInsight && <AiCallout label="Overview">{overviewInsight}</AiCallout>}
      </div>

      {/* INCOME DIVERSITY + RISK ANALYSIS */}
      <div className="fin-row">
        <div className="breakdown-card" style={{ padding: '12px 14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
            <span style={{ fontWeight: 800, fontSize: 14, letterSpacing: '-0.02em' }}>Income Diversity</span>
            <span style={{ fontSize: 24, fontWeight: 900, color: 'var(--primary)', letterSpacing: '-0.03em' }}>{analytics.incomeDiversityScore}</span>
            <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
              {analytics.incomeDiversityScore >= 0.8 ? 'High — low correlated risk' : analytics.incomeDiversityScore >= 0.5 ? 'Moderate diversity' : 'Low — correlated risk'}
            </span>
          </div>
          {diversityInsight && <AiCallout label="Diversity">{diversityInsight}</AiCallout>}
        </div>

        <RiskAnalysis analytics={analytics} dependencyInsight={dependencyInsight} removedIds={removedIds} setRemovedIds={setRemovedIds} />
      </div>
    </div>
  );
}
