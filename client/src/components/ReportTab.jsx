import { useState, useEffect, useRef, useCallback } from 'react';
import { api } from '../api';
import ReportPreviewModal from './ReportPreviewModal';

const MEMBER_COLORS = ['#2563eb', '#3b82f6', '#7c3aed', '#6366f1', '#1d4ed8'];

const MODEL_OPTIONS = [
  { value: '', label: 'None — general summary' },
  { value: 'equal', label: 'Even Split' },
  { value: 'proportional', label: 'Income-Based' },
  { value: 'hybrid', label: 'Balanced' },
  { value: 'custom', label: 'Custom' },
];

const MODEL_LABELS = { equal: 'Even Split', proportional: 'Income-Based', hybrid: 'Balanced', custom: 'Custom' };

const STATUS_CONFIG = {
  generated: { label: 'Not Sent', color: '#94a3b8', bg: 'rgba(0, 0, 0, 0.05)' },
  released:  { label: 'Sent',     color: '#2563eb', bg: 'rgba(37, 99, 235, 0.08)' },
  viewed:    { label: 'Viewed',   color: '#16a34a', bg: 'rgba(22, 163, 74, 0.08)' },
  failed:    { label: 'Failed',   color: '#dc2626', bg: 'rgba(220, 38, 38, 0.08)' },
};

const POLL_INTERVAL_MS = 3000;

function useFlash(duration = 3000) {
  const [text, setText] = useState(null);
  const timer = useRef(null);
  const flash = useCallback((msg, after) => {
    if (timer.current) clearTimeout(timer.current);
    setText(msg);
    timer.current = setTimeout(() => { setText(after ?? null); timer.current = null; }, duration);
  }, [duration]);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  return [text, flash];
}

function ReportRow({ r, index, projectId, onUpdate, onPreview }) {
  const cfg = STATUS_CONFIG[r.status] || STATUS_CONFIG.generated;
  const wasSent = r.status === 'released' || r.status === 'viewed';
  const color = MEMBER_COLORS[index % MEMBER_COLORS.length];

  const [sendFlash, flashSend] = useFlash();
  const [copyFlash, flashCopy] = useFlash();
  const [sending, setSending] = useState(false);

  const sendLabel = sendFlash || (sending ? 'Sending...' : wasSent ? 'Resend' : 'Send');

  async function handleSend() {
    setSending(true);
    try {
      const result = await api.releaseReports(projectId, [r.memberId]);
      onUpdate(result.applicantReports || []);
      flashSend('Sent \u2713', null);
    } catch {
      flashSend('Failed');
    } finally {
      setSending(false);
    }
  }

  function handleCopy() {
    if (r.reportToken) {
      navigator.clipboard.writeText(`${window.location.origin}/report/${r.reportToken}`);
      flashCopy('Copied \u2713');
    }
  }

  return (
    <div className="report-row">
      <div className="report-row-identity">
        <div className="people-avatar" style={{ background: color }}>{r.memberName?.[0]?.toUpperCase() || '?'}</div>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 13, fontWeight: 700 }}>{r.memberName}</span>
            <span className="people-status-pill" style={{ color: cfg.color, background: cfg.bg }}>{cfg.label}</span>
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{r.jobTitle || r.employmentType}</div>
        </div>
      </div>
      <div className="report-row-actions">
        <button className="btn btn-primary btn-sm" onClick={handleSend} disabled={sending} style={{ minWidth: 68 }}>
          {sendLabel}
        </button>
        <button className="btn btn-secondary btn-sm report-btn-subtle" onClick={() => onPreview(r.memberId)}>Preview</button>
        {r.reportToken && (
          <button className="btn btn-secondary btn-sm report-btn-subtle" onClick={handleCopy} style={{ minWidth: 76 }}>
            {copyFlash || 'Copy Link'}
          </button>
        )}
      </div>
    </div>
  );
}

export default function ReportTab({ projectId }) {
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState('');
  const [selectedModel, setSelectedModel] = useState('proportional');

  const [applicantReports, setApplicantReports] = useState([]);
  const [previewMemberId, setPreviewMemberId] = useState(null);
  const [reportSearch, setReportSearch] = useState('');
  const pollRef = useRef(null);

  const [regenFlash, flashRegen] = useFlash();
  const [sendAllFlash, flashSendAll] = useFlash();
  const [sendingAll, setSendingAll] = useState(false);

  const stopPolling = useCallback(() => {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
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
          if (rep.status !== 'generating') { stopPolling(); setGenerating(false); flashRegen(rep.status === 'failed' ? 'Failed' : 'Done \u2713'); }
        }
      } catch { /* ignore */ }
    }, POLL_INTERVAL_MS);
  }, [projectId, stopPolling, flashRegen]);

  useEffect(() => () => stopPolling(), [stopPolling]);

  useEffect(() => {
    Promise.all([
      api.getReport(projectId).catch(() => null),
      api.getApplicantReports(projectId).catch(() => ({ applicantReports: [] })),
    ]).then(([rep, appRep]) => {
      if (rep) {
        setReport(rep);
        if (rep.status === 'generating') { setGenerating(true); startPolling(); }
        if (rep.selectedModelName && MODEL_LABELS[rep.selectedModelName]) {
          setSelectedModel(rep.selectedModelName);
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
      setReport({ status: result.status, narrative: result.narrative, generatedAt: result.generatedAt, selectedModelName: result.selectedModelName });
      if (result.status === 'generating') {
        startPolling();
      } else {
        if (result.applicantReports) setApplicantReports(result.applicantReports);
        setGenerating(false);
        flashRegen('Done \u2713');
      }
    } catch (err) {
      setError(err.data?.message || err.message);
      setGenerating(false);
    }
  }

  async function handleSendAll() {
    setSendingAll(true);
    try {
      const result = await api.releaseAllReports(projectId);
      setApplicantReports(result.applicantReports || []);
      flashSendAll('All Sent \u2713');
    } catch (err) {
      setError(err.data?.message || err.message);
    } finally {
      setSendingAll(false);
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

  const generated = report?.status === 'complete';
  const hasUnsent = applicantReports.some((r) => r.status === 'generated');

  const usedModelKey = report?.selectedModelName;
  const usedModelLabel = MODEL_LABELS[usedModelKey] || null;
  const modelMismatch = generated && selectedModel && usedModelKey && selectedModel !== usedModelKey;

  const regenLabel = generating ? 'Regenerating...' : regenFlash || (generated ? 'Regenerate' : 'Generate Reports');

  const rq = reportSearch.toLowerCase().trim();
  const filteredReports = applicantReports.filter((r) => {
    return !rq || (r.memberName || '').toLowerCase().includes(rq) || (r.employmentType || '').toLowerCase().includes(rq);
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {error && <div className="form-error">{error}</div>}

      {applicantReports.length > 1 && (
        <div className="search-filter-row">
          <div className="search-bar">
            <svg className="search-bar-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>
            <input type="text" placeholder="Search by name..." value={reportSearch} onChange={(e) => setReportSearch(e.target.value)} />
            {rq && <span className="search-bar-count">{filteredReports.length} of {applicantReports.length}</span>}
            {rq && <button className="search-bar-clear" onClick={() => setReportSearch('')}>&times;</button>}
          </div>
        </div>
      )}

      {/* Report card */}
      {applicantReports.length > 0 ? (
        <div className="breakdown-card people-list-card">
          {/* Card header: model + generate + send all on one row, status below */}
          <div className="report-card-header">
            <div className="report-card-header-row">
              <select className="report-model-dropdown" value={selectedModel} onChange={(e) => setSelectedModel(e.target.value)}>
                {MODEL_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
              <button className="btn btn-primary btn-sm" onClick={() => alert('Disabled for public use')} style={{ minWidth: 128 }}>
                {generated ? 'Regenerate' : 'Generate Reports'}
              </button>
              {hasUnsent && (
                <button className="btn btn-secondary btn-sm" onClick={() => alert('Disabled for public use')}>
                  Send All
                </button>
              )}
            </div>
            {generated && (
              <div className="report-status-line">
                <span>
                  {applicantReports.length} report{applicantReports.length !== 1 ? 's' : ''} generated
                  {usedModelLabel ? ` using ${usedModelLabel}` : ''}
                  {' \u2014 '}
                  {new Date(report.generatedAt).toLocaleString()}
                </span>
                {modelMismatch && (
                  <span className="report-model-mismatch">Regenerate to use {MODEL_LABELS[selectedModel]}</span>
                )}
              </div>
            )}
          </div>

          {/* Rows */}
          {rq && filteredReports.length === 0 ? (
            <div className="search-empty-state" style={{ margin: '16px 0' }}>
              <span>&#128269;</span>
              <span>No results for &ldquo;{reportSearch}&rdquo;</span>
            </div>
          ) : (
            filteredReports.map((r, i) => (
              <ReportRow key={r.memberId} r={r} index={i} projectId={projectId} onUpdate={setApplicantReports} onPreview={setPreviewMemberId} />
            ))
          )}
        </div>
      ) : (
        <div className="breakdown-card" style={{ padding: 0 }}>
          <div className="report-card-header" style={{ borderBottom: 'none' }}>
            <div className="report-card-header-row">
              <select className="report-model-dropdown" value={selectedModel} onChange={(e) => setSelectedModel(e.target.value)} >
                {MODEL_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
              <button className="btn btn-primary btn-sm" onClick={() => alert('Disabled for public use')} style={{ minWidth: 128 }}>
                Generate Reports
              </button>
            </div>
          </div>
          {!generating && (
            <div style={{ textAlign: 'center', padding: '8px 16px 20px', color: 'var(--text-muted)', fontSize: 13 }}>
              Select a split model and click Generate to create individual reports for each applicant.
            </div>
          )}
        </div>
      )}

      {previewMemberId && (
        <ReportPreviewModal projectId={projectId} memberId={previewMemberId} onClose={() => setPreviewMemberId(null)} />
      )}
    </div>
  );
}
