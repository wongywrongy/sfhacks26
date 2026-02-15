import { useState, useEffect, useRef, useCallback } from 'react';
import { api } from '../api';
import ReportPreviewModal from './ReportPreviewModal';

const MODEL_OPTIONS = [
  { value: '', label: 'None -- general summary' },
  { value: 'equal', label: 'Even Split' },
  { value: 'proportional', label: 'Income-Based' },
  { value: 'hybrid', label: 'Balanced' },
  { value: 'custom', label: 'Custom' },
];

const STATUS_STYLES = {
  generated: { label: 'Generated', className: 'badge-gray' },
  released: { label: 'Released', className: 'badge-blue' },
  viewed: { label: 'Viewed', className: 'badge-green' },
  failed: { label: 'Failed', className: 'badge-red' },
};

const POLL_INTERVAL_MS = 3000;

export default function ReportTab({ projectId }) {
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState('');
  const [selectedModel, setSelectedModel] = useState('proportional');

  // Applicant reports state
  const [applicantReports, setApplicantReports] = useState([]);
  const [previewMemberId, setPreviewMemberId] = useState(null);
  const [releasingId, setReleasingId] = useState(null);
  const [releasingAll, setReleasingAll] = useState(false);
  const [reportSearch, setReportSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const pollRef = useRef(null);

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  const startPolling = useCallback(() => {
    stopPolling();
    pollRef.current = setInterval(async () => {
      try {
        const [rep, appRep] = await Promise.all([
          api.getReport(projectId).catch(() => null),
          api.getApplicantReports(projectId).catch(() => ({ applicantReports: [] })),
        ]);
        if (rep) {
          setReport(rep);
          if (appRep.applicantReports?.length) setApplicantReports(appRep.applicantReports);
          if (rep.status !== 'generating') {
            stopPolling();
            setGenerating(false);
          }
        }
      } catch {
        // ignore poll errors
      }
    }, POLL_INTERVAL_MS);
  }, [projectId, stopPolling]);

  useEffect(() => () => stopPolling(), [stopPolling]);

  useEffect(() => {
    Promise.all([
      api.getReport(projectId).catch(() => null),
      api.getApplicantReports(projectId).catch(() => ({ applicantReports: [] })),
    ]).then(([rep, appRep]) => {
      if (rep) {
        setReport(rep);
        if (rep.status === 'generating') {
          setGenerating(true);
          startPolling();
        }
      }
      setApplicantReports(appRep.applicantReports || []);
      setLoading(false);
    });
  }, [projectId, startPolling]);

  async function handleGenerate() {
    setGenerating(true);
    setError('');
    try {
      const result = await api.createReport(projectId, selectedModel || undefined);
      setReport({
        status: result.status,
        narrative: result.narrative,
        generatedAt: result.generatedAt,
        selectedModelName: result.selectedModelName,
      });
      if (result.status === 'generating') {
        startPolling();
      } else {
        if (result.applicantReports) setApplicantReports(result.applicantReports);
        setGenerating(false);
      }
    } catch (err) {
      setError(err.data?.message || err.message);
      setGenerating(false);
    }
  }

  async function handleRelease(memberId) {
    setReleasingId(memberId);
    try {
      const result = await api.releaseReports(projectId, [memberId]);
      setApplicantReports(result.applicantReports || []);
    } catch (err) {
      setError(err.data?.message || err.message);
    } finally {
      setReleasingId(null);
    }
  }

  async function handleReleaseAll() {
    setReleasingAll(true);
    try {
      const result = await api.releaseAllReports(projectId);
      setApplicantReports(result.applicantReports || []);
    } catch (err) {
      setError(err.data?.message || err.message);
    } finally {
      setReleasingAll(false);
    }
  }

  if (loading) {
    return (
      <div className="loading-container">
        <div className="spinner" />
        <p>Loading reports...</p>
      </div>
    );
  }

  const hasUnreleased = applicantReports.some((r) => r.status === 'generated');
  const generated = report?.status === 'complete';

  const rq = reportSearch.toLowerCase().trim();
  const filteredReports = applicantReports.filter((r) => {
    const matchesText = !rq ||
      (r.memberName || '').toLowerCase().includes(rq) ||
      (r.employmentType || '').toLowerCase().includes(rq);
    const matchesStatus = !statusFilter || r.status === statusFilter;
    return matchesText && matchesStatus;
  });
  const hasActiveFilter = rq || statusFilter;

  return (
    <div className="report-content">
      {/* Generate controls */}
      <div className="report-header">
        <div>
          <h3 className="section-title">Applicant Reports</h3>
          <p className="section-desc">
            Generate personalized financial literacy reports for each applicant
          </p>
        </div>
        <div className="report-actions">
          <button
            className="btn btn-primary"
            onClick={handleGenerate}
            disabled={generating}
          >
            {generating ? (
              <>
                <span className="spinner sm inline" />
                Generating...
              </>
            ) : generated ? (
              'Regenerate'
            ) : (
              'Generate Reports'
            )}
          </button>
        </div>
      </div>

      <div className="report-config">
        <div className="report-model-select">
          <label>Split Model</label>
          <select value={selectedModel} onChange={(e) => setSelectedModel(e.target.value)}>
            {MODEL_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {error && <div className="form-error">{error}</div>}

      {/* Brief insight after generation */}
      {generated && (
        <div className="glass-card" style={{ padding: '0.75rem 1rem', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: '0.85rem', opacity: 0.7 }}>
            {applicantReports.length} report{applicantReports.length !== 1 ? 's' : ''} generated
            {report.selectedModelName ? ` using ${report.selectedModelName} split` : ''}
            {' \u2014 '}
            {new Date(report.generatedAt).toLocaleString()}
          </span>
        </div>
      )}

      {/* Applicant report list */}
      {applicantReports.length > 0 ? (
        <>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem', gap: 8, flexWrap: 'wrap' }}>
            {applicantReports.length > 1 && (
              <div className="search-filter-row" style={{ flex: 1, minWidth: 200, marginBottom: 0 }}>
                <div className="search-bar" style={{ flex: 1 }}>
                  <svg className="search-bar-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>
                  <input
                    type="text"
                    placeholder="Search by name..."
                    value={reportSearch}
                    onChange={(e) => setReportSearch(e.target.value)}
                  />
                  {hasActiveFilter && <span className="search-bar-count">{filteredReports.length} of {applicantReports.length}</span>}
                  {(rq || statusFilter) && <button className="search-bar-clear" onClick={() => { setReportSearch(''); setStatusFilter(''); }}>&times;</button>}
                </div>
                {['generated', 'released', 'viewed'].map((s) => {
                  const count = applicantReports.filter((r) => r.status === s).length;
                  if (count === 0) return null;
                  return (
                    <button
                      key={s}
                      className={`filter-pill ${statusFilter === s ? 'filter-pill-active' : ''}`}
                      onClick={() => setStatusFilter(statusFilter === s ? '' : s)}
                    >
                      {STATUS_STYLES[s].label}
                      <span style={{ opacity: 0.5 }}>{count}</span>
                    </button>
                  );
                })}
              </div>
            )}
            {hasUnreleased && (
              <button
                className="btn btn-primary"
                onClick={handleReleaseAll}
                disabled={releasingAll}
                style={{ flexShrink: 0 }}
              >
                {releasingAll ? (
                  <>
                    <span className="spinner sm inline" />
                    Sending...
                  </>
                ) : 'Release All'}
              </button>
            )}
          </div>

          {hasActiveFilter && filteredReports.length === 0 ? (
            <div className="search-empty-state">
              <span>&#128269;</span>
              <span>No results for &ldquo;{reportSearch || statusFilter}&rdquo;</span>
            </div>
          ) : (
          <div className="applicant-report-list">
            {filteredReports.map((r) => {
              const style = STATUS_STYLES[r.status] || STATUS_STYLES.generated;
              return (
                <div key={r.memberId} className="applicant-report-row glass-card" style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '1rem 1.25rem',
                  marginBottom: '0.75rem',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flex: 1 }}>
                    <div className="member-avatar" style={{
                      width: 36, height: 36, borderRadius: '50%',
                      background: 'rgba(99, 102, 241, 0.15)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: '0.875rem', fontWeight: 600, color: '#818cf8',
                    }}>
                      {r.memberName?.[0]?.toUpperCase() || '?'}
                    </div>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '0.925rem' }}>{r.memberName}</div>
                      <div style={{ fontSize: '0.8rem', opacity: 0.6 }}>{r.employmentType}</div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <span className={`status-badge ${style.className}`}>
                      {style.label}
                    </span>
                    <button
                      className="btn btn-secondary"
                      style={{ padding: '0.4rem 0.75rem', fontSize: '0.8rem' }}
                      onClick={() => setPreviewMemberId(r.memberId)}
                    >
                      Preview
                    </button>
                    {r.status === 'generated' && (
                      <button
                        className="btn btn-primary"
                        style={{ padding: '0.4rem 0.75rem', fontSize: '0.8rem' }}
                        onClick={() => handleRelease(r.memberId)}
                        disabled={releasingId === r.memberId}
                      >
                        {releasingId === r.memberId ? 'Sending...' : 'Release'}
                      </button>
                    )}
                    {(r.status === 'released' || r.status === 'viewed') && r.reportToken && (
                      <button
                        className="btn btn-secondary"
                        style={{ padding: '0.4rem 0.75rem', fontSize: '0.8rem' }}
                        onClick={() => {
                          navigator.clipboard.writeText(`${window.location.origin}/report/${r.reportToken}`);
                        }}
                        title="Copy report link"
                      >
                        Copy Link
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          )}
        </>
      ) : !generating ? (
        <div className="empty-state">
          <div className="empty-icon">&#128196;</div>
          <h3>No reports yet</h3>
          <p>
            Select a split model above and click Generate to create individual reports for each applicant.
          </p>
        </div>
      ) : null}

      {/* Preview Modal */}
      {previewMemberId && (
        <ReportPreviewModal
          projectId={projectId}
          memberId={previewMemberId}
          onClose={() => setPreviewMemberId(null)}
        />
      )}
    </div>
  );
}
