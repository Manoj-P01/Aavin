'use client';

import { useState, useEffect } from 'react';
import Header from '@/components/layout/Header';
import Link from 'next/link';
import type { PrepToStockMappingRule, ChartMasterDef, ChartColumnDef } from '@/app/api/stock/preparation-charts/route';

export default function PrepToStockMappingsConfigPage() {
  const [mappings, setMappings] = useState<PrepToStockMappingRule[]>([]);
  const [masters, setMasters] = useState<ChartMasterDef[]>([]);
  const [chartColumns, setChartColumns] = useState<ChartColumnDef[]>([]);
  const [productOptions, setProductOptions] = useState<Array<{ key: string; label: string }>>([
    { key: 'dlt_milk', label: 'DLT.Milk' },
    { key: 'fcm', label: 'FCM' },
    { key: 'std_milk', label: 'STD.Milk' },
    { key: 'skim_milk', label: 'SKIM MILK' },
    { key: 'toned_milk', label: 'TONED MILK' },
    { key: 'dtm', label: 'DOUBLE TONED MILK' },
    { key: 'cream', label: 'CREAM' },
    { key: 'smp', label: 'SMP' },
    { key: 'raw_milk', label: 'RAW MILK' },
  ]);

  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Modal / Form state for Add / Edit Rule
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [formSourceChartKey, setFormSourceChartKey] = useState<string>('*');
  const [formSourceVariant, setFormSourceVariant] = useState<string>('DELITE');
  const [formSourceColKey, setFormSourceColKey] = useState<string>('qty_lit');
  const [formTargetRowType, setFormTargetRowType] = useState<'RECEIPT' | 'DISPOSAL'>('RECEIPT');
  const [formTargetProductKey, setFormTargetProductKey] = useState<string>('dlt_milk');
  const [formEnabled, setFormEnabled] = useState<boolean>(true);
  const [formDescription, setFormDescription] = useState<string>('');

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      try {
        const res = await fetch('/api/stock/preparation-charts');
        if (res.ok) {
          const json = await res.json();
          if (Array.isArray(json.mappings)) setMappings(json.mappings);
          if (Array.isArray(json.masters)) setMasters(json.masters);
          if (Array.isArray(json.columns)) setChartColumns(json.columns);
        }
      } catch (err) {
        console.error('Failed to load mappings:', err);
      }

      try {
        const pRes = await fetch('/api/master/products');
        if (pRes.ok) {
          const json = await pRes.json();
          const prods = json.data || json.products || [];
          if (Array.isArray(prods) && prods.length > 0) {
            const opts = prods.map((p: any) => ({
              key: p.key || (p.short_name || p.product_name).toLowerCase().replace(/[^a-z0-9_]/g, '_'),
              label: p.short_name || p.product_name || p.full_name || p.key,
            }));
            setProductOptions(opts);
          }
        }
      } catch (e) {
        console.error('Error fetching products master:', e);
      }

      setLoading(false);
    }
    loadData();
  }, []);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const handleOpenAdd = () => {
    setEditingId(null);
    setFormSourceChartKey('*');
    setFormSourceVariant('DELITE');
    setFormSourceColKey('qty_lit');
    setFormTargetRowType('RECEIPT');
    setFormTargetProductKey('dlt_milk');
    setFormEnabled(true);
    setFormDescription('');
    setIsModalOpen(true);
  };

  const handleOpenEdit = (rule: PrepToStockMappingRule) => {
    setEditingId(rule.id);
    setFormSourceChartKey(rule.sourceChartKey || '*');
    setFormSourceVariant(rule.sourceVariant || '');
    setFormSourceColKey(rule.sourceColKey || 'qty_lit');
    setFormTargetRowType(rule.targetRowType || 'RECEIPT');
    setFormTargetProductKey(rule.targetProductKey || '');
    setFormEnabled(rule.enabled !== false);
    setFormDescription(rule.description || '');
    setIsModalOpen(true);
  };

  const handleSaveModal = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formSourceVariant.trim()) {
      alert('Please select or enter a Source Variant');
      return;
    }
    if (!formTargetProductKey.trim()) {
      alert('Please select a Target Product Column');
      return;
    }

    const autoDesc = `${formSourceVariant} (${formSourceColKey}) ➔ ${productOptions.find(p => p.key === formTargetProductKey)?.label || formTargetProductKey} (${formTargetRowType})`;

    const newRule: PrepToStockMappingRule = {
      id: editingId || `rule_${Date.now()}`,
      sourceChartKey: formSourceChartKey,
      sourceVariant: formSourceVariant.toUpperCase(),
      sourceColKey: formSourceColKey,
      targetRowType: formTargetRowType,
      targetProductKey: formTargetProductKey,
      enabled: formEnabled,
      description: formDescription.trim() || autoDesc,
    };

    setMappings(prev => {
      if (editingId) {
        return prev.map(m => (m.id === editingId ? newRule : m));
      }
      return [...prev, newRule];
    });

    setIsModalOpen(false);
    showToast(editingId ? 'Updated mapping rule locally' : 'Added new mapping rule locally');
  };

  const handleDeleteRule = (id: string) => {
    if (!window.confirm('Are you sure you want to delete this mapping rule?')) return;
    setMappings(prev => prev.filter(m => m.id !== id));
    showToast('Deleted mapping rule');
  };

  const handleToggleRule = (id: string) => {
    setMappings(prev => prev.map(m => (m.id === id ? { ...m, enabled: !m.enabled } : m)));
  };

  const handleSaveAllMappings = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/stock/preparation-charts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mappings }),
      });

      if (res.ok) {
        showToast('✅ Saved custom mapping rules to Database!');
      } else {
        showToast('❌ Failed to save mapping rules');
      }
    } catch (err) {
      console.error('Save mapping error:', err);
      showToast('❌ Error connecting to server');
    }
    setSaving(false);
  };

  return (
    <>
      <Header
        title="Preparation Chart ➔ Stock Statement Custom Mapping Rules"
        subtitle="Configure custom rules to convert Preparation Chart formulation quantities into Stock Statement Entry receipt/disposal columns"
        actions={
          <div style={{ display: 'flex', gap: 10 }}>
            <Link href="/dashboard/stock/preparation-charts" className="btn btn-secondary btn-sm">
              ← Back to Preparation Charts
            </Link>
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={handleSaveAllMappings}
              disabled={saving}
            >
              {saving ? 'Saving...' : '💾 Save Mapping Rules'}
            </button>
          </div>
        }
      />

      <div className="page-body animate-fade-in">
        {toastMessage && (
          <div
            style={{
              padding: '12px 18px',
              borderRadius: 8,
              background: toastMessage.includes('❌') ? '#fef2f2' : '#f0fdf4',
              border: toastMessage.includes('❌') ? '1px solid #fca5a5' : '1px solid #86efac',
              color: toastMessage.includes('❌') ? '#991b1b' : '#166534',
              fontWeight: 700,
              fontSize: '0.85rem',
              marginBottom: 16,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <span>{toastMessage}</span>
            <button type="button" onClick={() => setToastMessage(null)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>✕</button>
          </div>
        )}

        {/* Info Card */}
        <div className="card" style={{ marginBottom: 20, background: 'linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%)', border: '1px solid #bae6fd' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
            <div>
              <div style={{ fontWeight: 800, fontSize: '1rem', color: '#0369a1', marginBottom: 4 }}>
                🔀 Custom Stage 1 ➔ Stage 2 Rule Engine
              </div>
              <div style={{ fontSize: '0.83rem', color: '#0c4a6e', lineHeight: 1.4 }}>
                Define how batch quantities from Preparation Charts map into Stock Statement Entry. For instance, map <strong>DELITE Qty(Lit) ➔ DLT.Milk Receipts</strong>, <strong>FCM Qty(Lit) ➔ FCM Receipts</strong>, or any custom variant/column pairing.
              </div>
            </div>
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={handleOpenAdd}
              style={{ background: '#0284c7', borderColor: '#0284c7', fontWeight: 700 }}
            >
              ➕ Add New Mapping Rule
            </button>
          </div>
        </div>

        {/* Rules Table */}
        <div className="card" style={{ padding: 0, border: '1px solid var(--border)', overflow: 'hidden' }}>
          <div style={{ padding: '14px 20px', background: '#f8fafc', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text-primary)' }}>
              📋 Active Mapping Rules ({mappings.length})
            </div>
            <button
              type="button"
              className="btn btn-secondary btn-xs"
              onClick={handleSaveAllMappings}
              disabled={saving}
            >
              {saving ? 'Saving...' : '💾 Save Changes'}
            </button>
          </div>

          {loading ? (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
              <span className="spinner" /> Loading mapping rules...
            </div>
          ) : mappings.length === 0 ? (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
              No custom mapping rules configured yet. Click "Add New Mapping Rule" above to create one.
            </div>
          ) : (
            <div className="table-wrapper" style={{ overflowX: 'auto' }}>
              <table className="data-table" style={{ width: '100%', fontSize: '0.85rem' }}>
                <thead>
                  <tr style={{ background: '#f1f5f9' }}>
                    <th style={{ width: 60, textAlign: 'center' }}>Status</th>
                    <th>Source Chart</th>
                    <th>Source Variant</th>
                    <th>Source Column</th>
                    <th>Target Section</th>
                    <th>Target Product Column</th>
                    <th>Description</th>
                    <th style={{ width: 100, textAlign: 'center' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {mappings.map((rule, idx) => {
                    const chartName = rule.sourceChartKey === '*'
                      ? '⭐ All Charts (*)'
                      : (masters.find(m => m.key === rule.sourceChartKey)?.name || rule.sourceChartKey);

                    const targetProdLabel = productOptions.find(p => p.key === rule.targetProductKey)?.label || rule.targetProductKey;

                    return (
                      <tr key={rule.id} style={{ opacity: rule.enabled ? 1 : 0.55, background: idx % 2 === 0 ? '#ffffff' : '#f8fafc' }}>
                        <td style={{ textAlign: 'center' }}>
                          <input
                            type="checkbox"
                            checked={rule.enabled !== false}
                            onChange={() => handleToggleRule(rule.id)}
                            title="Toggle Rule Active/Inactive"
                            style={{ cursor: 'pointer', width: 16, height: 16 }}
                          />
                        </td>
                        <td style={{ fontWeight: 600 }}>{chartName}</td>
                        <td>
                          <span style={{ padding: '2px 8px', borderRadius: 6, background: '#e0f2fe', color: '#0369a1', fontWeight: 700, fontSize: '0.78rem' }}>
                            {rule.sourceVariant}
                          </span>
                        </td>
                        <td style={{ fontFamily: 'monospace', fontWeight: 600 }}>{rule.sourceColKey}</td>
                        <td>
                          <span style={{ padding: '2px 8px', borderRadius: 6, background: rule.targetRowType === 'RECEIPT' ? '#dcfce7' : '#ffedd5', color: rule.targetRowType === 'RECEIPT' ? '#15803d' : '#c2410c', fontWeight: 700, fontSize: '0.78rem' }}>
                            {rule.targetRowType}
                          </span>
                        </td>
                        <td style={{ fontWeight: 700, color: 'var(--brand-primary)' }}>{targetProdLabel}</td>
                        <td style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>{rule.description || '—'}</td>
                        <td style={{ textAlign: 'center' }}>
                          <div style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
                            <button
                              type="button"
                              className="btn btn-secondary btn-xs"
                              onClick={() => handleOpenEdit(rule)}
                              title="Edit Mapping Rule"
                            >
                              ✏️
                            </button>
                            <button
                              type="button"
                              className="btn btn-secondary btn-xs"
                              onClick={() => handleDeleteRule(rule.id)}
                              style={{ color: '#dc2626', borderColor: '#fca5a5' }}
                              title="Delete Mapping Rule"
                            >
                              ✕
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Modal for Creating / Editing Mapping Rule */}
      {isModalOpen && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(15, 23, 42, 0.55)',
          backdropFilter: 'blur(4px)',
          zIndex: 10050,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 16,
        }}>
          <div style={{
            background: '#ffffff',
            borderRadius: 12,
            border: '1px solid var(--border)',
            boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)',
            width: '100%',
            maxWidth: 500,
            overflow: 'hidden',
          }}>
            <div style={{ padding: '16px 20px', background: '#f8fafc', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontWeight: 700, fontSize: '1.05rem', color: 'var(--text-primary)' }}>
                {editingId ? '✏️ Edit Mapping Rule' : '➕ Add Custom Mapping Rule'}
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                style={{ background: 'none', border: 'none', fontSize: '1.1rem', color: '#64748b', cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveModal} style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label className="form-label" style={{ fontWeight: 600 }}>Source Preparation Chart</label>
                <select
                  className="form-select"
                  value={formSourceChartKey}
                  onChange={e => setFormSourceChartKey(e.target.value)}
                >
                  <option value="*">⭐ All Preparation Charts (*)</option>
                  {masters.map(m => (
                    <option key={m.key} value={m.key}>{m.name} ({m.product_variant})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="form-label" style={{ fontWeight: 600 }}>Source Product Variant *</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. DELITE, FCM, STD MILK, SKIM MILK"
                  value={formSourceVariant}
                  onChange={e => setFormSourceVariant(e.target.value)}
                  required
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label className="form-label" style={{ fontWeight: 600 }}>Source Column</label>
                  <select
                    className="form-select"
                    value={formSourceColKey}
                    onChange={e => setFormSourceColKey(e.target.value)}
                  >
                    <option value="qty_lit">Qty(Lit) / qty_lit</option>
                    <option value="qty_kg">Qty(Kg) / qty_kg</option>
                    <option value="kg_fat">Kg Fat / kg_fat</option>
                    <option value="kg_snf">Kg SNF / kg_snf</option>
                    {chartColumns.map(c => (
                      <option key={c.key} value={c.key}>{c.name} ({c.key})</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="form-label" style={{ fontWeight: 600 }}>Target Stock Section</label>
                  <select
                    className="form-select"
                    value={formTargetRowType}
                    onChange={e => setFormTargetRowType(e.target.value as any)}
                  >
                    <option value="RECEIPT">Receipts</option>
                    <option value="DISPOSAL">Disposals</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="form-label" style={{ fontWeight: 600 }}>Target Product Column (Stock Statement Entry) *</label>
                <select
                  className="form-select"
                  value={formTargetProductKey}
                  onChange={e => setFormTargetProductKey(e.target.value)}
                >
                  {productOptions.map(p => (
                    <option key={p.key} value={p.key}>{p.label} ({p.key})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="form-label" style={{ fontWeight: 600 }}>Rule Description / Notes</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. DELITE Formulation Qty(Lit) ➔ DLT.Milk Receipt"
                  value={formDescription}
                  onChange={e => setFormDescription(e.target.value)}
                />
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <input
                  type="checkbox"
                  id="form-rule-enabled"
                  checked={formEnabled}
                  onChange={e => setFormEnabled(e.target.checked)}
                  style={{ cursor: 'pointer', width: 16, height: 16 }}
                />
                <label htmlFor="form-rule-enabled" style={{ fontSize: '0.88rem', fontWeight: 600, cursor: 'pointer' }}>
                  Enable this mapping rule
                </label>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, paddingTop: 10, borderTop: '1px solid var(--border)' }}>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => setIsModalOpen(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary btn-sm"
                >
                  {editingId ? '💾 Save Rule Changes' : '➕ Add Mapping Rule'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
