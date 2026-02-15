import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../api';
import './ApplicantReport.css';

function getCreditCategory(score) {
  if (!score) return 'N/A';
  if (score >= 740) return 'Excellent';
  if (score >= 670) return 'Good';
  if (score >= 580) return 'Fair';
  return 'Building';
}

function getDtiLabel(dti) {
  if (dti === null || dti === undefined) return 'N/A';
  const pct = dti * 100;
  if (pct <= 30) return 'Healthy';
  if (pct <= 36) return 'Moderate';
  if (pct <= 43) return 'Elevated';
  return 'High';
}

function getTrendLabel(trend) {
  if (!trend) return 'N/A';
  if (trend === 'improving') return 'Improving';
  if (trend === 'stable') return 'Stable';
  if (trend === 'declining') return 'Declining';
  return trend.charAt(0).toUpperCase() + trend.slice(1);
}

function formatCurrency(amount) {
  if (amount === null || amount === undefined) return '$0';
  return '$' + Math.round(amount).toLocaleString();
}

export default function ApplicantReport({ previewData }) {
  const params = useParams();
  const reportToken = params.reportToken;

  const [data, setData] = useState(previewData || null);
  const [loading, setLoading] = useState(!previewData);
  const [error, setError] = useState('');

  useEffect(() => {
    if (previewData || !reportToken) return;
    api.getPublicReport(reportToken)
      .then(setData)
      .catch(() => setError('This report is not available. It may not have been released yet.'))
      .finally(() => setLoading(false));
  }, [reportToken, previewData]);

  if (loading) {
    return (
      <div className="applicant-report">
        <div className="ar-container ar-loading">
          <div className="ar-loading-spinner" />
          <p style={{ color: '#52525b' }}>Loading your financial profile...</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="applicant-report">
        <div className="ar-container ar-error">
          <h2>{error || 'Report not found'}</h2>
        </div>
      </div>
    );
  }

  const rd = data.reportData || {};
  const score = data.creditScore;
  const scoreCategory = getCreditCategory(score);
  const income = data.monthlyIncome || 0;
  const personalDTI = data.personalDTI;
  const dtiLabel = getDtiLabel(personalDTI);
  const trajectory = data.paymentTrajectory;
  const trendLabel = getTrendLabel(trajectory?.trend);
  const composition = data.tradelineComposition;
  const revUtil = composition?.revolvingUtilization;
  const payment = data.paymentAmount || 0;
  const projDTI = data.projectedDTI;
  const breathingRoom = data.breathingRoom || 0;
  const obligations = data.monthlyObligations || 0;

  // Scale bar position: 300 = 0%, 850 = 100%
  const scalePos = score ? Math.max(0, Math.min(100, ((score - 300) / 550) * 100)) : 50;

  // Allocation bar segments
  const debtPct = income > 0 ? (obligations / income) * 100 : 0;
  const housingPct = income > 0 ? (payment / income) * 100 : 0;
  const remainingPct = Math.max(0, 100 - debtPct - housingPct);

  // Composition bar
  const cats = composition?.categories || {};
  const totalTradelines = Object.values(cats).reduce((s, c) => s + (c?.count || 0), 0) || 1;

  return (
    <div className="applicant-report">
      <div className="ar-container">
        {/* Header */}
        <div className="ar-header">
          <div className="ar-brand">CommonGround</div>
          <h1 className="ar-title">Your Financial Profile</h1>
          {data.projectName && (
            <p className="ar-subtitle">{data.projectName}{data.projectLocation ? ` \u2014 ${data.projectLocation}` : ''}</p>
          )}
          <p className="ar-subtitle">Prepared for {data.memberName}</p>
          <p className="ar-date">
            {data.generatedAt ? new Date(data.generatedAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : ''}
          </p>
        </div>

        {/* 1. Financial Snapshot */}
        <div className="ar-card">
          <h2 className="ar-card-title">Financial Snapshot</h2>
          <div className="ar-metrics">
            <div className="ar-metric">
              <div className="ar-metric-value">{score ?? 'N/A'}</div>
              <div className="ar-metric-label">Credit Score</div>
              <div className="ar-metric-sub">{scoreCategory}</div>
            </div>
            <div className="ar-metric">
              <div className="ar-metric-value">{formatCurrency(income)}</div>
              <div className="ar-metric-label">Monthly Income</div>
            </div>
            <div className="ar-metric">
              <div className="ar-metric-value">{formatCurrency(obligations)}</div>
              <div className="ar-metric-label">Monthly Debt</div>
            </div>
            <div className="ar-metric">
              <div className="ar-metric-value">{personalDTI !== null ? (personalDTI * 100).toFixed(1) + '%' : 'N/A'}</div>
              <div className="ar-metric-label">Debt-to-Income</div>
              <div className="ar-metric-sub">{dtiLabel}</div>
            </div>
            <div className="ar-metric">
              <div className="ar-metric-value">{trendLabel}</div>
              <div className="ar-metric-label">Payment Trend</div>
            </div>
          </div>
          {rd.snapshot && <p className="ar-narrative">{rd.snapshot}</p>}
        </div>

        {/* 2. Credit Profile */}
        <div className="ar-card">
          <h2 className="ar-card-title">Credit Profile</h2>
          <div className="ar-scale-bar">
            <div className="ar-scale-indicator" style={{ left: `${scalePos}%` }} />
          </div>
          <div className="ar-scale-labels">
            <span>300</span>
            <span>580</span>
            <span>670</span>
            <span>740</span>
            <span>850</span>
          </div>

          {revUtil !== null && revUtil !== undefined && (
            <div style={{ marginTop: '1rem' }}>
              <div style={{ fontSize: '0.8rem', color: '#52525b', marginBottom: '0.25rem' }}>
                Revolving Utilization (30% target)
              </div>
              <div className="ar-util-row">
                <div className="ar-util-bar-track">
                  <div className="ar-util-bar-fill" style={{
                    width: `${Math.min(100, revUtil)}%`,
                    background: revUtil <= 30 ? '#2563eb' : revUtil <= 50 ? '#f59e0b' : '#ef4444',
                  }} />
                  <div className="ar-util-bar-target" />
                </div>
                <span className="ar-util-label">{revUtil}%</span>
              </div>
            </div>
          )}

          {Object.keys(cats).length > 0 && (
            <div style={{ marginTop: '0.75rem' }}>
              <div style={{ fontSize: '0.8rem', color: '#52525b', marginBottom: '0.25rem' }}>
                Credit Composition
              </div>
              <div className="ar-composition-bar">
                {cats.revolving?.count > 0 && (
                  <div style={{ width: `${(cats.revolving.count / totalTradelines) * 100}%`, background: '#2563eb' }} />
                )}
                {cats.installment?.count > 0 && (
                  <div style={{ width: `${(cats.installment.count / totalTradelines) * 100}%`, background: '#7c3aed' }} />
                )}
                {cats.mortgage?.count > 0 && (
                  <div style={{ width: `${(cats.mortgage.count / totalTradelines) * 100}%`, background: '#f59e0b' }} />
                )}
                {cats.other?.count > 0 && (
                  <div style={{ width: `${(cats.other.count / totalTradelines) * 100}%`, background: '#a78bfa' }} />
                )}
              </div>
              <div style={{ display: 'flex', gap: '1rem', fontSize: '0.7rem', color: '#71717a', flexWrap: 'wrap' }}>
                {cats.revolving?.count > 0 && <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><span style={{ width: 8, height: 8, borderRadius: 2, background: '#2563eb', display: 'inline-block' }} /> Revolving ({cats.revolving.count})</span>}
                {cats.installment?.count > 0 && <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><span style={{ width: 8, height: 8, borderRadius: 2, background: '#7c3aed', display: 'inline-block' }} /> Installment ({cats.installment.count})</span>}
                {cats.mortgage?.count > 0 && <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><span style={{ width: 8, height: 8, borderRadius: 2, background: '#f59e0b', display: 'inline-block' }} /> Mortgage ({cats.mortgage.count})</span>}
                {cats.other?.count > 0 && <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><span style={{ width: 8, height: 8, borderRadius: 2, background: '#a78bfa', display: 'inline-block' }} /> Other ({cats.other.count})</span>}
              </div>
            </div>
          )}

          {rd.creditProfile && <p className="ar-narrative" style={{ marginTop: '1rem' }}>{rd.creditProfile}</p>}
        </div>

        {/* 3. Payment History */}
        <div className="ar-card">
          <h2 className="ar-card-title">Payment History</h2>
          <div className="ar-metrics" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
            <div className="ar-metric">
              <div className="ar-metric-value">{trajectory?.recentLateCount ?? 0}</div>
              <div className="ar-metric-label">Recent Late</div>
              <div className="ar-metric-sub">Last {Math.round((trajectory?.windowMonths || 24) / 2)} months</div>
            </div>
            <div className="ar-metric">
              <div className="ar-metric-value">{trajectory?.olderLateCount ?? 0}</div>
              <div className="ar-metric-label">Older Late</div>
              <div className="ar-metric-sub">Prior period</div>
            </div>
            <div className="ar-metric">
              <div className="ar-metric-value">{trajectory?.windowMonths ?? 'N/A'}</div>
              <div className="ar-metric-label">Months Analyzed</div>
            </div>
          </div>
          {rd.paymentHistory && <p className="ar-narrative">{rd.paymentHistory}</p>}
        </div>

        {/* 4. Housing Cost & You */}
        <div className="ar-card">
          <h2 className="ar-card-title">Housing Cost & You</h2>
          <div className="ar-metrics" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
            <div className="ar-metric">
              <div className="ar-metric-value">{formatCurrency(payment)}</div>
              <div className="ar-metric-label">Your Payment</div>
            </div>
            <div className="ar-metric">
              <div className="ar-metric-value">{projDTI !== null ? (projDTI * 100).toFixed(1) + '%' : 'N/A'}</div>
              <div className="ar-metric-label">Projected DTI</div>
              <div className="ar-metric-sub">With housing</div>
            </div>
            <div className="ar-metric">
              <div className="ar-metric-value">{formatCurrency(breathingRoom)}</div>
              <div className="ar-metric-label">Breathing Room</div>
              <div className="ar-metric-sub">After all costs</div>
            </div>
          </div>

          <div style={{ marginTop: '0.75rem' }}>
            <div style={{ fontSize: '0.8rem', color: '#52525b', marginBottom: '0.25rem' }}>
              Income Allocation
            </div>
            <div className="ar-allocation-bar">
              {debtPct > 0 && (
                <div style={{ width: `${debtPct}%`, background: '#7c3aed', minWidth: debtPct > 3 ? undefined : 0 }}>
                  {debtPct > 8 ? `${formatCurrency(obligations)} debt` : ''}
                </div>
              )}
              {housingPct > 0 && (
                <div style={{ width: `${housingPct}%`, background: '#2563eb', minWidth: housingPct > 3 ? undefined : 0 }}>
                  {housingPct > 8 ? `${formatCurrency(payment)} housing` : ''}
                </div>
              )}
              <div style={{ width: `${remainingPct}%`, background: '#d4d4d8', color: '#52525b', minWidth: remainingPct > 3 ? undefined : 0 }}>
                {remainingPct > 10 ? `${formatCurrency(breathingRoom)} remaining` : ''}
              </div>
            </div>
            <div style={{ display: 'flex', gap: '1rem', fontSize: '0.7rem', color: '#71717a' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><span style={{ width: 8, height: 8, borderRadius: 2, background: '#7c3aed', display: 'inline-block' }} /> Debt</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><span style={{ width: 8, height: 8, borderRadius: 2, background: '#2563eb', display: 'inline-block' }} /> Housing</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><span style={{ width: 8, height: 8, borderRadius: 2, background: '#d4d4d8', display: 'inline-block' }} /> Remaining</span>
            </div>
          </div>

          {rd.housingCost && <p className="ar-narrative" style={{ marginTop: '1rem' }}>{rd.housingCost}</p>}
        </div>

        {/* 5. Next Steps */}
        <div className="ar-card ar-card-accent">
          <h2 className="ar-card-title">Your Next Steps</h2>
          {rd.nextSteps && <p className="ar-narrative">{rd.nextSteps}</p>}
        </div>

        {/* 6. Background & Identity */}
        <div className="ar-card">
          <h2 className="ar-card-title">Background & Identity</h2>
          <div className="ar-status-grid">
            <div className="ar-status-card">
              <div className="ar-status-icon">{data.criminalRecordCount === 0 ? '\u2705' : '\u26A0\uFE0F'}</div>
              <div className="ar-status-value">
                {data.criminalRecordCount === 0 ? 'Clear' : `${data.criminalRecordCount} record${data.criminalRecordCount !== 1 ? 's' : ''}`}
              </div>
              <div className="ar-status-label">Criminal</div>
            </div>
            <div className="ar-status-card">
              <div className="ar-status-icon">{data.evictionRecordCount === 0 ? '\u2705' : '\u26A0\uFE0F'}</div>
              <div className="ar-status-value">
                {data.evictionRecordCount === 0 ? 'Clear' : `${data.evictionRecordCount} filing${data.evictionRecordCount !== 1 ? 's' : ''}`}
              </div>
              <div className="ar-status-label">Eviction</div>
            </div>
            <div className="ar-status-card">
              <div className="ar-status-icon">{data.identityVerified ? '\u2705' : '\u26A0\uFE0F'}</div>
              <div className="ar-status-value">{data.identityVerified ? 'Verified' : 'Pending'}</div>
              <div className="ar-status-label">Identity</div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="ar-footer">
          <p>
            This report is for educational purposes only and does not constitute financial advice.
            For questions about your application, please contact your property manager.
          </p>
          <p className="ar-footer-brand" style={{ marginTop: '0.75rem' }}>
            CommonGround
          </p>
        </div>
      </div>
    </div>
  );
}
