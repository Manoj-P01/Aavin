'use client';

import { useState, useEffect } from 'react';
import { useSidebar } from '@/context/SidebarContext';

interface ShiftConfig {
  key: 'D' | 'N';
  label: string;
  start: string;
  end: string;
}

export default function ConfigPanel() {
  const { configOpen, setConfigOpen } = useSidebar();
  const [shifts, setShifts] = useState<ShiftConfig[]>([
    { key: 'D', label: 'Day Shift', start: '06:00', end: '18:00' },
    { key: 'N', label: 'Night Shift', start: '18:00', end: '06:00' },
  ]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Load shifts configuration from 1970-01-01 STOCK entry notes
  useEffect(() => {
    if (!configOpen) return;
    let active = true;

    async function loadConfig() {
      setLoading(true);
      setError('');
      try {
        const res = await fetch('/api/entries?report_type=STOCK&date=1970-01-01');
        if (!res.ok) {
          throw new Error('Failed to fetch shift configuration.');
        }
        const json = await res.json();
        const configEntry = json.data?.[0];
        if (configEntry && configEntry.notes) {
          const parsed = JSON.parse(configEntry.notes);
          if (Array.isArray(parsed) && parsed.length === 2 && active) {
            setShifts(parsed);
          }
        }
      } catch (e) {
        console.error('Error loading shift config:', e);
      } finally {
        if (active) setLoading(false);
      }
    }

    loadConfig();
    return () => {
      active = false;
    };
  }, [configOpen]);

  const handleSave = async () => {
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      const res = await fetch('/api/entries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          entry_date: '1970-01-01',
          report_type: 'STOCK',
          shift: null,
          notes: JSON.stringify(shifts),
        }),
      });
      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.error || 'Failed to save shift configuration.');
      }
      setSuccess('Settings saved successfully!');
      setTimeout(() => {
        setSuccess('');
        setConfigOpen(false);
      }, 1500);
    } catch (e: any) {
      setError(e.message || 'Save failed.');
    } finally {
      setSaving(false);
    }
  };

  const handleTimeChange = (key: 'D' | 'N', field: 'start' | 'end', val: string) => {
    setShifts(prev =>
      prev.map(s => (s.key === key ? { ...s, [field]: val } : s))
    );
  };

  const handleLabelChange = (key: 'D' | 'N', val: string) => {
    setShifts(prev =>
      prev.map(s => (s.key === key ? { ...s, label: val } : s))
    );
  };

  return (
    <>
      {/* Overlay backdrop */}
      <div
        className={`config-overlay ${configOpen ? 'open' : ''}`}
        onClick={() => setConfigOpen(false)}
      />

      {/* Drawer */}
      <div className={`config-drawer ${configOpen ? 'open' : ''}`}>
        <div className="config-drawer-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: '1.25rem' }}>⚙️</span>
            <div style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--text-primary)' }}>System Settings</div>
          </div>
          <button
            type="button"
            className="sidebar-toggle-btn"
            style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: '1.15rem' }}
            onClick={() => setConfigOpen(false)}
          >
            ✕
          </button>
        </div>

        <div className="config-drawer-body">
          {error && <div className="alert alert-error">⚠️ {error}</div>}
          {success && <div className="alert alert-success">✅ {success}</div>}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div className="config-section-title">🕒 Shifts Configuration</div>
            
            {loading ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 0' }}>
                <span className="spinner" /> Loading shift settings...
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                {/* Day Shift */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 600, fontSize: '0.85rem' }}>
                    ☀️ Day Shift Settings
                  </div>
                  <div className="form-group" style={{ marginBottom: 8 }}>
                    <label className="form-label">Shift Name</label>
                    <input
                      type="text"
                      className="form-input"
                      value={shifts.find(s => s.key === 'D')?.label || ''}
                      onChange={e => handleLabelChange('D', e.target.value)}
                    />
                  </div>
                  <div className="form-row form-row-2">
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label">Start Time</label>
                      <input
                        type="time"
                        className="form-input"
                        value={shifts.find(s => s.key === 'D')?.start || ''}
                        onChange={e => handleTimeChange('D', 'start', e.target.value)}
                      />
                    </div>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label">End Time</label>
                      <input
                        type="time"
                        className="form-input"
                        value={shifts.find(s => s.key === 'D')?.end || ''}
                        onChange={e => handleTimeChange('D', 'end', e.target.value)}
                      />
                    </div>
                  </div>
                </div>

                {/* Night Shift */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 600, fontSize: '0.85rem' }}>
                    🌙 Night Shift Settings
                  </div>
                  <div className="form-group" style={{ marginBottom: 8 }}>
                    <label className="form-label">Shift Name</label>
                    <input
                      type="text"
                      className="form-input"
                      value={shifts.find(s => s.key === 'N')?.label || ''}
                      onChange={e => handleLabelChange('N', e.target.value)}
                    />
                  </div>
                  <div className="form-row form-row-2">
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label">Start Time</label>
                      <input
                        type="time"
                        className="form-input"
                        value={shifts.find(s => s.key === 'N')?.start || ''}
                        onChange={e => handleTimeChange('N', 'start', e.target.value)}
                      />
                    </div>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label">End Time</label>
                      <input
                        type="time"
                        className="form-input"
                        value={shifts.find(s => s.key === 'N')?.end || ''}
                        onChange={e => handleTimeChange('N', 'end', e.target.value)}
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="config-drawer-footer">
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => setConfigOpen(false)}
            disabled={saving}
          >
            Cancel
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={handleSave}
            disabled={saving || loading}
          >
            {saving ? 'Saving...' : '💾 Save Settings'}
          </button>
        </div>
      </div>
    </>
  );
}
