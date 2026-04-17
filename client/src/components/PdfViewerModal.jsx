import { useEffect } from 'react';

/**
 * Full-screen PDF preview. Displays a generated PDF (blob URL) inline in an
 * iframe instead of forcing a download. A secondary action still lets the
 * operator download a local copy.
 */
export default function PdfViewerModal({ url, filename, title, onClose }) {
  useEffect(() => {
    function onKey(e) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [onClose]);

  // Revoke the blob url on unmount
  useEffect(() => {
    return () => {
      try { URL.revokeObjectURL(url); } catch { /* noop */ }
    };
  }, [url]);

  function handleDownload() {
    const a = document.createElement('a');
    a.href = url;
    a.download = filename || 'document.pdf';
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  return (
    <div className="pdfviewer-overlay" role="dialog" aria-modal="true" aria-label={title || 'PDF preview'}>
      <div className="pdfviewer-frame">
        <div className="pdfviewer-topbar">
          <div className="pdfviewer-title">{title || 'Document preview'}</div>
          <div className="pdfviewer-actions">
            <button className="ui-btn ui-btn--secondary ui-btn--sm" onClick={handleDownload}>
              Download PDF
            </button>
            <button className="ui-btn ui-btn--ghost ui-btn--sm" onClick={onClose}>
              Close
            </button>
          </div>
        </div>
        <div className="pdfviewer-body">
          <iframe
            className="pdfviewer-iframe"
            title={title || 'PDF preview'}
            src={url}
          />
        </div>
      </div>
    </div>
  );
}
