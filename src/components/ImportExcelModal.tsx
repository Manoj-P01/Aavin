'use client';

import { useState } from 'react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (count: number) => void;
}

export default function ImportExcelModal({ isOpen, onClose, onSuccess }: Props) {
  const [reportType, setReportType] = useState<'TS' | 'STOCK'>('TS');
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) { setError('Please select a file to upload'); return; }

    setUploading(true);
    setError('');
    setStatus('Parsing sheet rows and cells...');

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('report_type', reportType);

      const res = await fetch('/api/entries/import', {
        method: 'POST',
        body: formData,
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to import workbook');

      setStatus('Success!');
      onSuccess(json.count || 0);
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Import failed');
      setStatus('');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="modal-backdrop" style={{
      position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.4)',
      backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center',
      justifyContent: 'center', zIndex: 1000,
    }}>
      <div className="card animate-fade-in" style={{
        maxWidth: 500, width: '100%', padding: '28px',
        boxShadow: 'var(--shadow-lg)', border: '1px solid var(--border)',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <div style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--text-primary)' }}>
            📥 Import Excel Workbook
          </div>
          <button onClick={onClose} style={{
            background: 'none', border: 'none', fontSize: '1.25rem',
            color: 'var(--text-muted)', cursor: 'pointer',
          }}>
            &times;
          </button>
        </div>

        <form onSubmit={handleUpload}>
          <div className="form-group" style={{ marginBottom: 16 }}>
            <label className="form-label">Excel Template Format</label>
            <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
              <button
                type="button"
                className={`btn ${reportType === 'TS' ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setReportType('TS')}
                style={{ flex: 1 }}
              >
                🧪 Daily TS Sheet
              </button>
              <button
                type="button"
                className={`btn ${reportType === 'STOCK' ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setReportType('STOCK')}
                style={{ flex: 1 }}
              >
                📦 Monthly Stock Workbook
              </button>
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 6, lineHeight: 1.4 }}>
              {reportType === 'TS'
                ? 'Reads date and values from the "TS" tab in the daily workbook.'
                : 'Scans all tab names matching date+shift (e.g. "1-06-2026D") to import the entire workbook.'}
            </div>
          </div>

          <div className="form-group" style={{ marginBottom: 24 }}>
            <label className="form-label">Select Excel File (.xlsx)</label>
            <input
              type="file"
              accept=".xlsx"
              className="form-input"
              style={{ padding: '8px 12px' }}
              onChange={e => setFile(e.target.files?.[0] || null)}
            />
          </div>

          {status && (
            <div className="alert alert-info" style={{ padding: '10px 12px', fontSize: '0.8125rem' }}>
              <span className="spinner" style={{ width: 14, height: 14, marginRight: 8 }} />
              {status}
            </div>
          )}

          {error && (
            <div className="alert alert-error" style={{ padding: '10px 12px', fontSize: '0.8125rem' }}>
              ⚠️ {error}
            </div>
          )}

          <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', marginTop: 12 }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={onClose}
              disabled={uploading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={uploading || !file}
            >
              {uploading ? 'Importing...' : '📥 Start Import'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
