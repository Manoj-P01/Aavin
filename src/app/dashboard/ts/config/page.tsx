// ─────────────────────────────────────────────────────────────────────────────
// Aavin Dashboard – STG Calculation Settings Page
// Configure bi-directional calculation rules for Fat %, Kg.Fat, SNF %, and Kg.SNF
// ─────────────────────────────────────────────────────────────────────────────

'use client';

import { useState, useEffect } from 'react';
import Header from '@/components/layout/Header';
import Link from 'next/link';
import { useStgCalcConfig } from '@/hooks/useSettings';
import { DEFAULT_STG_CALC_CONFIG } from '@/lib/settingsDefaults';
import type { StgCalcConfig } from '@/lib/types';

export type { StgCalcConfig as STGCalcConfig };
export { DEFAULT_STG_CALC_CONFIG };

export default function STGConfigPage() {
  const { calcConfig, isLoading, saveStgCalcConfig } = useStgCalcConfig();
  const [config, setConfig] = useState<StgCalcConfig>(DEFAULT_STG_CALC_CONFIG);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    if (calcConfig) {
      setConfig(calcConfig);
    }
  }, [calcConfig]);

  const handleSave = async () => {
    if (isNaN(config.densityFactor) || config.densityFactor <= 0) {
      setError('Density factor must be a positive number (e.g. 1.0275)');
      return;
    }

    setSaving(true);
    setError('');
    setSuccess('');

    try {
      await saveStgCalcConfig(config);
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
        title="STG Calculation Settings"
        subtitle="Configure bi-directional calculation rules and default density for STG Statement entries"
        actions={
          <div style={{ display: 'flex', gap: 8 }}>
            <Link href="/dashboard/stock/new?step=stg" className="btn btn-secondary btn-sm">
              ← Back to STG Entry
            </Link>
            <button
              className="btn btn-primary btn-sm"
              onClick={handleSave}
              disabled={saving || isLoading}
            >
              {saving ? 'Saving...' : '💾 Save Settings'}
            </button>
          </div>
        }
      />

      <div className="page-body animate-fade-in" style={{ maxWidth: 860, margin: '0 auto' }}>
        {error && (
          <div className="card mb-4" style={{ borderLeft: '4px solid var(--brand-danger)', padding: '12px 16px' }}>
            <div style={{ color: 'var(--brand-danger)', fontWeight: 600 }}>{error}</div>
          </div>
        )}

        {success && (
          <div className="card mb-4" style={{ borderLeft: '4px solid var(--brand-success)', padding: '12px 16px' }}>
            <div style={{ color: 'var(--brand-success)', fontWeight: 600 }}>{success}</div>
          </div>
        )}

        {isLoading ? (
          <div className="card p-6" style={{ textAlign: 'center' }}>
            <div className="spinner" style={{ margin: '20px auto' }} />
            <p style={{ color: 'var(--text-muted)' }}>Loading calculation settings...</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            {/* Card 1: Fat Calculation Direction */}
            <div className="card p-6">
              <div style={{ marginBottom: 16 }}>
                <h3 style={{ fontSize: '1.05rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>
                  🧈 Fat Calculation Rule
                </h3>
                <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
                  Choose which value drives the calculation when editing milk and cream rows.
                </p>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <label
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 8,
                    padding: 16,
                    borderRadius: 8,
                    border: `2px solid ${config.fatCalcMode === 'FROM_PCT' ? 'var(--brand-primary)' : 'var(--border)'}`,
                    backgroundColor: config.fatCalcMode === 'FROM_PCT' ? 'rgba(14, 165, 233, 0.05)' : 'var(--bg-card)',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <input
                      type="radio"
                      name="fatCalcMode"
                      value="FROM_PCT"
                      checked={config.fatCalcMode === 'FROM_PCT'}
                      onChange={() => setConfig(prev => ({ ...prev, fatCalcMode: 'FROM_PCT' }))}
                    />
                    <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>Calculate from Fat %</span>
                  </div>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', paddingLeft: 24 }}>
                    Entering <strong>Fat %</strong> automatically calculates <strong>Kg.Fat = (Qty.Kg × Fat%) / 100</strong>.
                  </span>
                </label>

                <label
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 8,
                    padding: 16,
                    borderRadius: 8,
                    border: `2px solid ${config.fatCalcMode === 'FROM_KG' ? 'var(--brand-primary)' : 'var(--border)'}`,
                    backgroundColor: config.fatCalcMode === 'FROM_KG' ? 'rgba(14, 165, 233, 0.05)' : 'var(--bg-card)',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <input
                      type="radio"
                      name="fatCalcMode"
                      value="FROM_KG"
                      checked={config.fatCalcMode === 'FROM_KG'}
                      onChange={() => setConfig(prev => ({ ...prev, fatCalcMode: 'FROM_KG' }))}
                    />
                    <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>Calculate from Kg.Fat</span>
                  </div>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', paddingLeft: 24 }}>
                    Entering <strong>Kg.Fat</strong> automatically back-calculates <strong>Fat% = (Kg.Fat × 100) / Qty.Kg</strong>.
                  </span>
                </label>
              </div>
            </div>

            {/* Card 2: SNF Calculation Direction */}
            <div className="card p-6">
              <div style={{ marginBottom: 16 }}>
                <h3 style={{ fontSize: '1.05rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>
                  🥛 SNF Calculation Rule
                </h3>
                <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
                  Choose which value drives the SNF calculation when editing rows.
                </p>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <label
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 8,
                    padding: 16,
                    borderRadius: 8,
                    border: `2px solid ${config.snfCalcMode === 'FROM_PCT' ? 'var(--brand-primary)' : 'var(--border)'}`,
                    backgroundColor: config.snfCalcMode === 'FROM_PCT' ? 'rgba(14, 165, 233, 0.05)' : 'var(--bg-card)',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <input
                      type="radio"
                      name="snfCalcMode"
                      value="FROM_PCT"
                      checked={config.snfCalcMode === 'FROM_PCT'}
                      onChange={() => setConfig(prev => ({ ...prev, snfCalcMode: 'FROM_PCT' }))}
                    />
                    <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>Calculate from SNF %</span>
                  </div>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', paddingLeft: 24 }}>
                    Entering <strong>SNF %</strong> automatically calculates <strong>Kg.SNF = (Qty.Kg × SNF%) / 100</strong>.
                  </span>
                </label>

                <label
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 8,
                    padding: 16,
                    borderRadius: 8,
                    border: `2px solid ${config.snfCalcMode === 'FROM_KG' ? 'var(--brand-primary)' : 'var(--border)'}`,
                    backgroundColor: config.snfCalcMode === 'FROM_KG' ? 'rgba(14, 165, 233, 0.05)' : 'var(--bg-card)',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <input
                      type="radio"
                      name="snfCalcMode"
                      value="FROM_KG"
                      checked={config.snfCalcMode === 'FROM_KG'}
                      onChange={() => setConfig(prev => ({ ...prev, snfCalcMode: 'FROM_KG' }))}
                    />
                    <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>Calculate from Kg.SNF</span>
                  </div>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', paddingLeft: 24 }}>
                    Entering <strong>Kg.SNF</strong> automatically back-calculates <strong>SNF% = (Kg.SNF × 100) / Qty.Kg</strong>.
                  </span>
                </label>
              </div>
            </div>

            {/* Card 3: Default Density Factor */}
            <div className="card p-6">
              <div style={{ marginBottom: 16 }}>
                <h3 style={{ fontSize: '1.05rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>
                  ⚖️ Default Milk Density Factor (Sp.Gr)
                </h3>
                <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
                  Standard density used to convert Liters to Kilograms when Sp.Gr is not explicitly entered: <code>Qty.Kg = Qty.Lts × Density</code>.
                </p>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <input
                  type="number"
                  step="0.0001"
                  min="0.9"
                  max="1.2"
                  className="form-input"
                  style={{ width: 140, fontWeight: 600, fontSize: '0.9375rem' }}
                  value={config.densityFactor}
                  onChange={e => setConfig(prev => ({ ...prev, densityFactor: parseFloat(e.target.value) || 0 }))}
                />
                <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
                  Configured density factor (e.g. from laboratory standards)
                </span>
              </div>
            </div>

            {/* Action Bar */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 8 }}>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleSave}
                disabled={saving || isLoading}
              >
                {saving ? 'Saving...' : '💾 Save Settings'}
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
