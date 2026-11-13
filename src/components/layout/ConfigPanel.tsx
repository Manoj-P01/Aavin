'use client';

import { useState, useEffect } from 'react';
import { useSidebar } from '@/context/SidebarContext';
import { useConfirm } from '@/context/ConfirmContext';
import { useShiftConfig } from '@/hooks/useSettings';

interface ShiftConfig {
  key: 'D' | 'N';
  label: string;
  start: string;
  end: string;
}

interface ProductConfig {
  key: string;
  label: string;
}

export default function ConfigPanel() {
  const { configOpen, setConfigOpen } = useSidebar();
  const { confirm } = useConfirm();
  const [shifts, setShifts] = useState<ShiftConfig[]>([
    { key: 'D', label: 'Day Shift', start: '06:00', end: '18:00' },
    { key: 'N', label: 'Night Shift', start: '18:00', end: '06:00' },
  ]);
  const [mode, setMode] = useState<'full_day' | 'shift'>('full_day');
  const [products, setProducts] = useState<ProductConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleProductLabelChange = (key: string, label: string) => {
    setProducts(prev => prev.map(p => p.key === key ? { ...p, label } : p));
  };

  const addProduct = () => {
    const label = window.prompt("Enter new product name:");
    if (!label || label.trim() === '') return;
    const key = 'custom_prod_' + Date.now();
    setProducts(prev => [...prev, { key, label: label.trim() }]);
  };

  const removeProduct = async (key: string) => {
    const ok = await confirm({
      title: 'Remove Product Column',
      message: 'Are you sure you want to remove this product column?',
      confirmText: 'Remove',
      cancelText: 'Cancel',
      type: 'danger',
    });
    if (!ok) return;
    setProducts(prev => prev.filter(p => p.key !== key));
  };

  const moveProductUp = (idx: number) => {
    if (idx === 0) return;
    setProducts(prev => {
      const next = [...prev];
      const temp = next[idx];
      next[idx] = next[idx - 1];
      next[idx - 1] = temp;
      return next;
    });
  };

  const moveProductDown = (idx: number) => {
    if (idx === products.length - 1) return;
    setProducts(prev => {
      const next = [...prev];
      const temp = next[idx];
      next[idx] = next[idx + 1];
      next[idx + 1] = temp;
      return next;
    });
  };

  const { shiftConfig, isLoading: configLoading, saveShiftConfig } = useShiftConfig();

  // Sync state with shift configuration from app_settings
  useEffect(() => {
    if (shiftConfig) {
      if (shiftConfig.mode) setMode(shiftConfig.mode);
      if (Array.isArray(shiftConfig.shifts) && shiftConfig.shifts.length > 0) {
        setShifts(shiftConfig.shifts as any);
      }
      if (Array.isArray(shiftConfig.products)) {
        setProducts(shiftConfig.products as any);
      }
      setLoading(false);
    }
  }, [shiftConfig, configOpen]);

  const handleSave = async () => {
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      await saveShiftConfig({ mode, shifts: shifts as any, products: products as any });
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
                {/* Reporting Mode Selection */}
                <div className="form-group" style={{ marginBottom: 8 }}>
                  <label className="form-label" style={{ fontWeight: 600 }}>Reporting Mode</label>
                  <div style={{ display: 'flex', gap: 16, marginTop: 6 }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.85rem', cursor: 'pointer' }}>
                      <input
                        type="radio"
                        name="reportMode"
                        value="full_day"
                        checked={mode === 'full_day'}
                        onChange={() => setMode('full_day')}
                      />
                      🗓️ Full Day
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.85rem', cursor: 'pointer' }}>
                      <input
                        type="radio"
                        name="reportMode"
                        value="shift"
                        checked={mode === 'shift'}
                        onChange={() => setMode('shift')}
                      />
                      ⏱️ Shift-wise
                    </label>
                  </div>
                </div>

                {/* Show Shift configuration inputs only if shift-wise mode is active */}
                {mode === 'shift' && (
                  <>
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
                  </>
                )}
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
