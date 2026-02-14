import { useState, useEffect } from 'react';
import { api } from '../api';

const MODEL_OPTIONS = [
  { value: '', label: 'None — general summary' },
  { value: 'equal', label: 'Even Split' },
  { value: 'proportional', label: 'Income-Based' },
  { value: 'hybrid', label: 'Balanced' },
  { value: 'custom', label: 'Custom' },
];

export default function ReportTab({ projectId }) {
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState('');
  const [selectedModel, setSelectedModel] = useState('proportional');

  useEffect(() => {
    api.getReport(projectId)
      .then(setReport)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [projectId]);

  async function handleGenerate() {
    setGenerating(true);
    setError('');
    try {
      const result = await api.createReport(projectId, selectedModel || undefined);
      setReport(result);
    } catch (err) {
      setError(err.data?.message || err.message);
    } finally {
      setGenerating(false);
    }
  }

  function handleDownload() {
    if (!report?.narrative) return;
    const blob = new Blob([report.narrative], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'CommonGround_Readiness_Report.txt';
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  if (loading) {
    return (
      <div className="loading-container">
        <div className="spinner" />
        <p>Checking for existing report...</p>
      </div>
    );
  }

  return (
    <div className="report-content">
      <div className="report-header">
        <div>
          <h3 className="section-title">Financial Summary</h3>
          <p className="section-desc">
            Generate a professional summary for lenders or landlords
          </p>
        </div>
        <div className="report-actions">
          {report?.narrative && (
            <button className="btn btn-secondary" onClick={handleDownload}>
              Download
            </button>
          )}
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
            ) : report?.narrative ? (
              'Regenerate Report'
            ) : (
              'Generate Report'
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

      {report?.narrative ? (
        <div className="report-body">
          <div className="report-narrative">
            {report.narrative}
          </div>
          <div className="report-footer">
            <span className="ai-timestamp">
              Generated {new Date(report.generatedAt).toLocaleString()}
            </span>
            {report.selectedModelName && (
              <span className="report-model-tag">
                Model: {report.selectedModelName}
              </span>
            )}
          </div>
        </div>
      ) : !generating ? (
        <div className="empty-state">
          <div className="empty-icon">&#128196;</div>
          <h3>No report generated yet</h3>
          <p>
            Run the Financials tab first, then generate a summary for your records.
          </p>
        </div>
      ) : null}
    </div>
  );
}
