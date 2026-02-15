import { useState, useEffect } from 'react';
import { api } from '../api';
import ApplicantReport from '../pages/ApplicantReport';

export default function ReportPreviewModal({ projectId, memberId, onClose }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    api.previewReport(projectId, memberId)
      .then(setData)
      .catch((err) => setError(err.data?.message || err.message))
      .finally(() => setLoading(false));
  }, [projectId, memberId]);

  return (
    <div
      className="modal-overlay"
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        background: 'rgba(0,0,0,0.7)',
        display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
        overflow: 'auto', padding: '2rem',
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{
        position: 'relative', width: '100%', maxWidth: 800,
        minHeight: '80vh', borderRadius: 16,
        overflow: 'hidden',
      }}>
        <button
          onClick={onClose}
          style={{
            position: 'fixed', top: 24, right: 24, zIndex: 10000,
            background: 'rgba(0,0,0,0.6)', color: '#fff',
            border: 'none', borderRadius: '50%',
            width: 40, height: 40, fontSize: '1.25rem',
            cursor: 'pointer', display: 'flex',
            alignItems: 'center', justifyContent: 'center',
          }}
        >
          &times;
        </button>
        {loading ? (
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            minHeight: 400, background: '#fefce8',
          }}>
            <div className="spinner" />
          </div>
        ) : error ? (
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            minHeight: 400, background: '#fefce8', color: '#991b1b',
          }}>
            {error}
          </div>
        ) : (
          <ApplicantReport previewData={data} />
        )}
      </div>
    </div>
  );
}
