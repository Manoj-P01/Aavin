// ─────────────────────────────────────────────────────────────────────────────
// Aavin Dashboard – STG Calculation Settings Page
// Configure bi-directional calculation rules for Fat %, Kg.Fat, SNF %, and Kg.SNF
// ─────────────────────────────────────────────────────────────────────────────

'use client';

import { useState, useEffect } from 'react';
import Header from '@/components/layout/Header';
import Link from 'next/link';

export interface STGCalcConfig {
  fatCalcMode: 'FROM_PCT' | 'FROM_KG';
  snfCalcMode: 'FROM_PCT' | 'FROM_KG';
  densityFactor: number;
}

export const DEFAULT_STG_CALC_CONFIG: STGCalcConfig = {
  fatCalcMode: 'FROM_PCT',
  snfCalcMode: 'FROM_PCT',
  densityFactor: 1.0275,
};

export default function STGConfigPage() {
  const [config, setConfig] = useState<STGCalcConfig>(DEFAULT_STG_CALC_CONFIG);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    async function loadConfig() {
      try {
        const res = await fetch('/api/entries?report_type=STG_CALC_CONFIG');
        if (res.ok) {
          const json = await res.json();
          const entries: any[] = json.data || [];
          const configEntry = entries.find((e: any) => e.notes && !e.notes.includes('__METADATA__:'));
          if (configEntry && configEntry.notes) {
            try {
              const parsed = JSON.parse(configEntry.notes);
              if (parsed && typeof parsed === 'object') {
                setConfig({
                  fatCalcMode: parsed.fatCalcMode === 'FROM_KG' ? 'FROM_KG' : 'FROM_PCT',
                  snfCalcMode: parsed.snfCalcMode === 'FROM_KG' ? 'FROM_KG' : 'FROM_PCT',
                  densityFactor: parseFloat(parsed.densityFactor) || 1.0275,
                });
              }
            } catch (e) {
              console.error('Failed to parse STG calc config notes:', e);
            }
          }
        }
      } catch (err: unknown) {
        console.error('Error loading STG calc config:', err);
        setError('Failed to load calculation settings');
      } finally {
        setLoading(false);
      }
    }
    loadConfig();
  }, []);

  const handleSave = async () => {
    if (isNaN(config.densityFactor) || config.densityFactor <= 0) {
      setError('Density factor must be a positive number (e.g. 1.0275)');
      return;
    }

    setSaving(true);
    setError('');
    setSuccess('');

    try {
      const res = await fetch('/api/entries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          entry_date: '1970-01-04',
          shift: null,
          report_type: 'STG_CALC_CONFIG',
          notes: JSON.stringify(config),
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to save STG calculation settings.');
      }

      setSuccess('STG calculation settings saved successfully!');
      setTimeout(() => setSuccess(''), 4000);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Header
        title="Solid Balance (STG) Calculation Settings"
        subtitle="Configure column calculation direction and density factors for Daily Reports"
        actions={
          <Link href="/dashboard/ts" className="btn btn-secondary btn-sm">
            ← Back to Daily Reports
          </Link>
        }
      />

      <div className="page-body animate-fade-in" style={{ maxWidth: 850, paddingBottom: 60 }}>
        {error && <div className="alert alert-error">⚠️ {error}</div>}
        {success && <div className="alert alert-success">✅ {success}</div>}

        {loading ? (
          <div className="card" style={{ padding: 32, display: 'flex', alignItems: 'center', gap: 12 }}>
            <span className="spinner" /> Loading calculation settings...
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            
            {/* Fat Calculation Direction */}
            <div className="card">
              <h3 style={{ margin: '0 0 6px 0', color: 'var(--brand-primary)' }}>
                1. Fat % & Kg.Fat Calculation Mode
              </h3>
              <p style={{ margin: '0 0 16px 0', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                Choose which parameter is entered manually and which parameter is calculated automatically.
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <label
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 12,
                    padding: '12px 16px',
                    borderRadius: 8,
                    border: '1px solid var(--border)',
                    backgroundColor: config.fatCalcMode === 'FROM_PCT' ? '#f0f9ff' : 'transparent',
                    borderColor: config.fatCalcMode === 'FROM_PCT' ? '#0ea5e9' : 'var(--border)',
                    cursor: 'pointer',
                  }}
                >
                  <input
                    type="radio"
                    name="fatCalcMode"
                    checked={config.fatCalcMode === 'FROM_PCT'}
                    onChange={() => setConfig(prev => ({ ...prev, fatCalcMode: 'FROM_PCT' }))}
                    style={{ marginTop: 3 }}
                  />
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-primary)' }}>
                      Standard: Calculate Kg.Fat from Fat %
                    </div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: 2, fontFamily: 'monospace' }}>
                      Kg.Fat = ROUND(Sp. Gr × Fat % × Qty (Lts) / 100, 3)
                    </div>
                  </div>
                </label>

                <label
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 12,
                    padding: '12px 16px',
                    borderRadius: 8,
                    border: '1px solid var(--border)',
                    backgroundColor: config.fatCalcMode === 'FROM_KG' ? '#f0f9ff' : 'transparent',
                    borderColor: config.fatCalcMode === 'FROM_KG' ? '#0ea5e9' : 'var(--border)',
                    cursor: 'pointer',
                  }}
                >
                  <input
                    type="radio"
                    name="fatCalcMode"
                    checked={config.fatCalcMode === 'FROM_KG'}
                    onChange={() => setConfig(prev => ({ ...prev, fatCalcMode: 'FROM_KG' }))}
                    style={{ marginTop: 3 }}
                  />
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-primary)' }}>
                      Reverse: Calculate Fat % from Kg.Fat
                    </div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: 2, fontFamily: 'monospace' }}>
                      Fat % = (Kg.Fat / Qty (Lts) / {config.densityFactor}) × 100
                    </div>
                  </div>
                </label>
              </div>
            </div>

            {/* SNF Calculation Direction */}
            <div className="card">
              <h3 style={{ margin: '0 0 6px 0', color: 'var(--brand-primary)' }}>
                2. SNF % & Kg.SNF Calculation Mode
              </h3>
              <p style={{ margin: '0 0 16px 0', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                Choose which parameter is entered manually and which parameter is calculated automatically.
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <label
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 12,
                    padding: '12px 16px',
                    borderRadius: 8,
                    border: '1px solid var(--border)',
                    backgroundColor: config.snfCalcMode === 'FROM_PCT' ? '#f0f9ff' : 'transparent',
                    borderColor: config.snfCalcMode === 'FROM_PCT' ? '#0ea5e9' : 'var(--border)',
                    cursor: 'pointer',
                  }}
                >
                  <input
                    type="radio"
                    name="snfCalcMode"
                    checked={config.snfCalcMode === 'FROM_PCT'}
                    onChange={() => setConfig(prev => ({ ...prev, snfCalcMode: 'FROM_PCT' }))}
                    style={{ marginTop: 3 }}
                  />
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-primary)' }}>
                      Standard: Calculate Kg.SNF from SNF %
                    </div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: 2, fontFamily: 'monospace' }}>
                      Kg.SNF = ROUND(Sp. Gr × SNF % × Qty (Lts) / 100, 3)
                    </div>
                  </div>
                </label>

                <label
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 12,
                    padding: '12px 16px',
                    borderRadius: 8,
                    border: '1px solid var(--border)',
                    backgroundColor: config.snfCalcMode === 'FROM_KG' ? '#f0f9ff' : 'transparent',
                    borderColor: config.snfCalcMode === 'FROM_KG' ? '#0ea5e9' : 'var(--border)',
                    cursor: 'pointer',
                  }}
                >
                  <input
                    type="radio"
                    name="snfCalcMode"
                    checked={config.snfCalcMode === 'FROM_KG'}
                    onChange={() => setConfig(prev => ({ ...prev, snfCalcMode: 'FROM_KG' }))}
                    style={{ marginTop: 3 }}
                  />
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-primary)' }}>
                      Reverse: Calculate SNF % from Kg.SNF
                    </div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: 2, fontFamily: 'monospace' }}>
                      SNF % = (Kg.SNF / Qty (Lts) / {config.densityFactor}) × 100
                    </div>
                  </div>
                </label>
              </div>
            </div>

            {/* Reverse Density Factor Constant */}
            <div className="card">
              <h3 style={{ margin: '0 0 6px 0', color: 'var(--brand-primary)' }}>
                3. Density Multiplier Constant
              </h3>
              <p style={{ margin: '0 0 12px 0', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                Constant factor used when converting weight back to percentage composition in reverse mode.
              </p>
              <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                <label style={{ fontWeight: 600, fontSize: '0.85rem' }}>Density Factor:</label>
                <input
                  type="number"
                  step="0.0001"
                  className="form-input"
                  style={{ width: 140, fontWeight: 700, textAlign: 'right', color: 'var(--brand-primary)' }}
                  value={config.densityFactor}
                  onChange={e => setConfig(prev => ({ ...prev, densityFactor: parseFloat(e.target.value) || 1.0275 }))}
                />
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Standard Default: 1.0275</span>
              </div>
            </div>

            {/* Action Bar */}
            <div className="card" style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
              <Link href="/dashboard/ts" className="btn btn-secondary">
                Cancel
              </Link>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleSave}
                disabled={saving}
              >
                {saving ? 'Saving Settings...' : '💾 Save Calculation Settings'}
              </button>
            </div>

          </div>
        )}
      </div>
    </>
  );
}
