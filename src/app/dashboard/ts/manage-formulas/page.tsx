// ─────────────────────────────────────────────────────────────────────────────
// Aavin Dashboard – Manage Formulas Configuration Page
// Displays mathematical formulas and lets users configure their variables
// ─────────────────────────────────────────────────────────────────────────────

'use client';

import { useState, useEffect } from 'react';
import Header from '@/components/layout/Header';
import Link from 'next/link';

interface FormulaConfigItem {
  key: string;
  path: string;
  name: string;
  value: number;
  description: string;
  category: string;
  isCustom?: boolean;
}

export default function ManageFormulasPage() {
  const [flatConfig, setFlatConfig] = useState<FormulaConfigItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Load configuration from API on mount
  useEffect(() => {
    async function loadConfig() {
      try {
        const res = await fetch('/api/formulas');
        if (!res.ok) {
          throw new Error('Failed to load formulas configuration');
        }
        const json = await res.json();
        if (json.data && json.data.flat) {
          setFlatConfig(json.data.flat);
        }
      } catch (err: unknown) {
        console.error('Error loading config:', err);
        setError(err instanceof Error ? err.message : 'Failed to load configuration');
      } finally {
        setLoading(false);
      }
    }
    loadConfig();
  }, []);

  const handleSave = async () => {
    // Validation
    const hasEmptyFields = flatConfig.some(
      item => item.key.trim() === '' || item.name.trim() === '' || isNaN(Number(item.value))
    );

    if (hasEmptyFields) {
      setError('Please make sure all fields are filled and values are valid numbers.');
      return;
    }

    // Check duplicate keys
    const keys = flatConfig.map(i => i.key.trim().toUpperCase());
    const uniqueKeys = new Set(keys);
    if (uniqueKeys.size !== keys.length) {
      setError('Duplicate key codes are not allowed.');
      return;
    }

    setSaving(true);
    setError('');
    setSuccess('');

    try {
      const res = await fetch('/api/formulas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ flatConfig }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to save formula configuration.');
      }

      setSuccess('Formulas configuration saved successfully!');
      window.alert('Formulas configuration saved successfully!');
      setTimeout(() => setSuccess(''), 4000);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const addCustomVariable = () => {
    setFlatConfig(prev => [
      ...prev,
      {
        key: 'CUSTOM_' + Math.random().toString(36).substr(2, 6).toUpperCase(),
        path: '',
        name: 'New Custom Variable',
        value: 0,
        description: 'User-defined calculation helper',
        category: 'Custom Formulas',
        isCustom: true,
      },
    ]);
  };

  const deleteVariable = (key: string, name: string) => {
    const ok = window.confirm(`Are you sure you want to delete "${name || 'Unnamed Variable'}"?`);
    if (!ok) return;
    setFlatConfig(prev => prev.filter(i => i.key !== key));
  };

  const updateItem = (key: string, field: keyof FormulaConfigItem, val: any) => {
    setFlatConfig(prev => {
      const idx = prev.findIndex(item => item.key === key);
      if (idx === -1) return prev;
      const copy = [...prev];
      copy[idx] = { ...copy[idx], [field]: val };
      return copy;
    });
  };

  const renderFormulaInputs = (keys: string[]) => {
    return keys.map(key => {
      const item = flatConfig.find(i => i.key === key);
      if (!item) return null;

      return (
        <div key={item.key} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 3fr', gap: 16, alignItems: 'center', padding: '10px 0', borderBottom: '1px solid #f1f5f9' }}>
          <div>
            <div style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-primary)' }}>{item.name}</div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontFamily: 'monospace' }}>Code: {item.key}</div>
          </div>
          <div>
            <input
              type="number"
              step="any"
              className="form-input"
              style={{ textAlign: 'right', fontWeight: 600, color: 'var(--brand-primary)', padding: '6px 10px' }}
              value={item.value}
              onChange={e => updateItem(item.key, 'value', e.target.value === '' ? '' : Number(e.target.value))}
            />
          </div>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
            {item.description}
          </div>
        </div>
      );
    });
  };

  return (
    <>
      <Header
        title="Manage Formulas & Constants"
        subtitle="View and edit the mathematical equations and rounding rules used across the dairy dashboard reports"
        actions={
          <Link href="/dashboard/ts" className="btn btn-secondary btn-sm">
            ← Back to TS Dashboard
          </Link>
        }
      />

      <div className="page-body animate-fade-in" style={{ maxWidth: 900, paddingBottom: 60 }}>
        {error && <div className="alert alert-error">⚠️ {error}</div>}
        {success && <div className="alert alert-success">✅ {success}</div>}

        {loading ? (
          <div className="card" style={{ padding: 32, display: 'flex', alignItems: 'center', gap: 12 }}>
            <span className="spinner" /> Loading calculations formulas...
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            
            {/* Specific Gravity Block */}
            <div className="card">
              <h3 style={{ margin: '0 0 6px 0', color: 'var(--brand-primary)' }}>1. Specific Gravity (Sp. Gr) Calculation</h3>
              <p style={{ margin: '0 0 12px 0', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Calculates the density multiplier of milk based on Fat and SNF percentages.</p>
              <div style={{ background: '#f8fafc', borderLeft: '4px solid var(--brand-primary)', padding: '12px 16px', borderRadius: '0 8px 8px 0', fontFamily: 'monospace', fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: 16 }}>
                {"New Solid Balance (STG) Entry -> Receipts -> Sp. Gr = Formula: Base + (SNF % - (Fat % × Fat Factor + Offset)) / Divisor"}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                {renderFormulaInputs(['SP_GR_BASE', 'SP_GR_FAT_FACTOR', 'SP_GR_OFFSET', 'SP_GR_DIVISOR', 'SP_GR_DECIMALS'])}
              </div>
            </div>

            {/* Qty Kg Weight Block */}
            <div className="card">
              <h3 style={{ margin: '0 0 6px 0', color: 'var(--brand-primary)' }}>2. Weight conversion (Qty Kg)</h3>
              <p style={{ margin: '0 0 12px 0', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Converts volumetric milk (Liters) to mass weight (Kilograms) using density.</p>
              <div style={{ background: '#f8fafc', borderLeft: '4px solid var(--brand-primary)', padding: '12px 16px', borderRadius: '0 8px 8px 0', fontFamily: 'monospace', fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: 16 }}>
                {"New Solid Balance (STG) Entry -> Receipts -> Qty (Kg) = Formula: Qty (Lts) × Sp. Gr"}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                {renderFormulaInputs(['QTY_KG_DECIMALS'])}
              </div>
            </div>

            {/* Kg Fat Block */}
            <div className="card">
              <h3 style={{ margin: '0 0 6px 0', color: 'var(--brand-primary)' }}>3. Weight of Butterfat (Kg Fat)</h3>
              <p style={{ margin: '0 0 12px 0', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Calculates total fat content weight in kilograms for receipts and disposals.</p>
              <div style={{ background: '#f8fafc', borderLeft: '4px solid var(--brand-primary)', padding: '12px 16px', borderRadius: '0 8px 8px 0', fontFamily: 'monospace', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: 16, lineHeight: 1.5 }}>
                {"New Solid Balance (STG) Entry -> Receipts -> Kg. Fat = Formula: Qty (Lts) × Sp. Gr × Fat % / 100"} <br/>
                {"SMP: Kg. Fat = Formula: Qty (Kg) × Fat % / 100"}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                {renderFormulaInputs(['KG_FAT_DIVISOR', 'KG_FAT_DECIMALS', 'KG_FAT_TS_DECIMALS'])}
              </div>
            </div>

            {/* Kg SNF Block */}
            <div className="card">
              <h3 style={{ margin: '0 0 6px 0', color: 'var(--brand-primary)' }}>4. Weight of Solids-Not-Fat (Kg SNF)</h3>
              <p style={{ margin: '0 0 12px 0', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Calculates SNF content weight in kilograms for receipts and disposals.</p>
              <div style={{ background: '#f8fafc', borderLeft: '4px solid var(--brand-primary)', padding: '12px 16px', borderRadius: '0 8px 8px 0', fontFamily: 'monospace', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: 16, lineHeight: 1.5 }}>
                {"New Solid Balance (STG) Entry -> Receipts -> Kg. SNF = Formula: Qty (Lts) × Sp. Gr × SNF % / 100"} <br/>
                {"SMP: Kg. SNF = Formula: Qty (Kg) × SNF % / 100"}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                {renderFormulaInputs(['KG_SNF_DIVISOR', 'KG_SNF_DECIMALS', 'KG_SNF_TS_DECIMALS'])}
              </div>
            </div>

            {/* TS Reports Layout decimals & loss */}
            <div className="card">
              <h3 style={{ margin: '0 0 6px 0', color: 'var(--brand-primary)' }}>5. Daily TS Report Totals & Loss Norms</h3>
              <p style={{ margin: '0 0 12px 0', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Defines rounding precision for display sums and dairy loss limit guidelines.</p>
              <div style={{ background: '#f8fafc', borderLeft: '4px solid var(--brand-primary)', padding: '12px 16px', borderRadius: '0 8px 8px 0', fontFamily: 'monospace', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: 16, lineHeight: 1.5 }}>
                Arrival Total = O/B + Receipts <br/>
                Disposal Total = Despatches + Local Sales + Other Disposals + C/B <br/>
                Variance (Loss) = Arrival Total - Disposal Total <br/>
                Variance % = (Loss / Arrival Total) × 100
              </div>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                {renderFormulaInputs(['TS_REPORT_QTY_LTS_DECIMALS', 'TS_REPORT_QTY_KG_DECIMALS', 'TS_REPORT_LOSS_PERCENTAGE_DECIMALS', 'TS_REPORT_CMPDD_NORM_PCT'])}
              </div>
            </div>

            {/* Custom parameters block */}
            <div className="card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <h3 style={{ margin: 0, color: 'var(--brand-primary)' }}>6. Custom Variables</h3>
                <button type="button" className="btn btn-secondary btn-sm" onClick={addCustomVariable}>
                  ➕ Add Custom Variable
                </button>
              </div>

              {flatConfig.filter(i => i.isCustom).length === 0 ? (
                <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)', background: '#fafafa', borderRadius: 8, border: '1px dashed var(--border)' }}>
                  No custom variables defined. Click "Add Custom Variable" to create one.
                </div>
              ) : (
                <div className="table-wrapper">
                  <table className="inline-table">
                    <thead>
                      <tr>
                        <th style={{ minWidth: 120 }}>Variable Code</th>
                        <th style={{ minWidth: 180 }}>Display Name</th>
                        <th style={{ width: 100 }}>Value</th>
                        <th style={{ minWidth: 260 }}>Description</th>
                        <th style={{ width: 80 }} className="no-print">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {flatConfig
                        .map((item, originalIdx) => ({ item, originalIdx }))
                        .filter(x => x.item.isCustom)
                        .map(({ item, originalIdx }) => (
                          <tr key={item.key}>
                            <td>
                              <input
                                type="text"
                                className="form-input"
                                style={{
                                  fontFamily: 'monospace',
                                  fontWeight: 600,
                                  fontSize: '0.85rem',
                                  textTransform: 'uppercase',
                                }}
                                value={item.key}
                                onChange={e => updateItem(item.key, 'key', e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, ''))}
                                placeholder="VARIABLE_CODE"
                              />
                            </td>
                            <td>
                              <input
                                type="text"
                                className="form-input"
                                style={{ fontWeight: 500 }}
                                value={item.name}
                                onChange={e => updateItem(item.key, 'name', e.target.value)}
                                placeholder="e.g. Factor Name"
                              />
                            </td>
                            <td>
                              <input
                                type="number"
                                step="any"
                                className="form-input"
                                style={{ textAlign: 'right', fontWeight: 600, color: 'var(--brand-primary)' }}
                                value={item.value}
                                onChange={e => updateItem(item.key, 'value', e.target.value === '' ? '' : Number(e.target.value))}
                                placeholder="0.00"
                              />
                            </td>
                            <td>
                              <input
                                type="text"
                                className="form-input"
                                style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}
                                value={item.description}
                                onChange={e => updateItem(item.key, 'description', e.target.value)}
                                placeholder="Explain this variable..."
                              />
                            </td>
                            <td className="no-print" style={{ textAlign: 'center' }}>
                              <button
                                type="button"
                                className="btn btn-ghost btn-sm"
                                style={{ color: '#ef4444', border: '1px solid #fca5a5', padding: '4px 8px' }}
                                onClick={() => deleteVariable(item.key, item.name)}
                                title="Delete variable"
                              >
                                ❌ Delete
                              </button>
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Bottom Actions Card */}
            <div className="card" style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
              <Link href="/dashboard/ts" className="btn btn-secondary" style={{ padding: '10px 24px' }}>
                Cancel
              </Link>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleSave}
                disabled={saving}
                style={{ padding: '10px 24px' }}
              >
                {saving ? 'Saving changes...' : '💾 Save Formula Configurations'}
              </button>
            </div>

          </div>
        )}
      </div>
    </>
  );
}
