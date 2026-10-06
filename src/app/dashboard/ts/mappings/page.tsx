// ─────────────────────────────────────────────────────────────────────────────
// Aavin Dashboard – Solid Balance STG Mapping Configuration Page
// Configures mapping rules for Stage 1 (Preparation Charts) ➔ Stage 3 (Solid Balance STG)
// and Stage 2 (Stock Statement Entry) ➔ Stage 3 (Solid Balance STG)
// ─────────────────────────────────────────────────────────────────────────────

'use client';

import { useState, useEffect, useMemo } from 'react';
import Header from '@/components/layout/Header';
import Link from 'next/link';
import { useConfirm } from '@/context/ConfirmContext';

export interface MappingRule {
  id: string;
  sourceStage: 'STAGE_1' | 'STAGE_2'; // STAGE_1 = Prep Charts, STAGE_2 = Stock Entry
  stockProductKey: string; // Stock product key OR Prep chart master key
  stockProductLabel: string;
  stockSection: 'OB' | 'RECEIPT' | 'DISPOSAL';
  stockParticular: string; // Variant name for STAGE_1, or Particular name for STAGE_2
  sourceVariant?: string;
  sourceField?: 'qty_lts' | 'qty_kg' | 'fat_pct' | 'snf_pct' | 'kg_fat' | 'kg_snf' | 'sp_gr';
  stgBlockKey: string;
  stgBlockLabel: string;
  stgSection: 'OB' | 'RECEIPT' | 'DISPOSAL' | 'CB';
  stgItemName: string;
  stgTargetField: 'qty_lts' | 'qty_kg' | 'fat_pct' | 'snf_pct' | 'kg_fat' | 'kg_snf';
}

export default function STGStatementMappingPage() {
  const [mappings, setMappings] = useState<MappingRule[]>([]);
  const [filterSource, setFilterSource] = useState<string>('ALL');

  const [stockProducts, setStockProducts] = useState<Array<{ key: string; label: string }>>([]);
  const [prepMasters, setPrepMasters] = useState<Array<{ key: string; label: string }>>([]);
  const [rawPrepMasters, setRawPrepMasters] = useState<any[]>([]);
  const [prepTemplates, setPrepTemplates] = useState<Record<string, any>>({});

  const [receiptRows, setReceiptRows] = useState<Array<{ full_name: string; short_name: string }>>([]);
  const [disposalRows, setDisposalRows] = useState<Array<{ full_name: string; short_name: string }>>([]);
  const [stgStatements, setStgStatements] = useState<Array<{ key: string; label: string }>>([]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // STG Form modal state
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [formSourceStage, setFormSourceStage] = useState<'STAGE_1' | 'STAGE_2'>('STAGE_1');
  const [formStockProductKey, setFormStockProductKey] = useState<string>('delite_prep');
  const [formStockSection, setFormStockSection] = useState<'OB' | 'RECEIPT' | 'DISPOSAL'>('RECEIPT');
  const [formStockParticular, setFormStockParticular] = useState<string>('DELITE');
  const [formSourceField, setFormSourceField] = useState<'qty_lts' | 'qty_kg' | 'fat_pct' | 'snf_pct' | 'kg_fat' | 'kg_snf' | 'sp_gr'>('qty_lts');

  const [formStgBlockKey, setFormStgBlockKey] = useState<string>('WM');
  const [formStgSection, setFormStgSection] = useState<'OB' | 'RECEIPT' | 'DISPOSAL' | 'CB'>('RECEIPT');
  const [formStgItemName, setFormStgItemName] = useState<string>('Receipt');
  const [formStgTargetField, setFormStgTargetField] = useState<'qty_lts' | 'qty_kg' | 'fat_pct' | 'snf_pct' | 'kg_fat' | 'kg_snf'>('qty_lts');

  const { confirm } = useConfirm();

  // Load configuration on mount
  useEffect(() => {
    let active = true;
    async function loadData() {
      setLoading(true);
      setError('');
      try {
        // 1. Load stock products config from database
        const stockConfigRes = await fetch('/api/stock/config');
        if (stockConfigRes.ok) {
          const stockCfg = await stockConfigRes.json();
          if (Array.isArray(stockCfg.products) && stockCfg.products.length > 0) {
            if (active) {
              setStockProducts(stockCfg.products.map((p: any) => ({
                key: p.key || p.product_key,
                label: p.short_name || p.full_name || p.key,
              })));
            }
          }
          if (active && Array.isArray(stockCfg.receiptRows)) {
            setReceiptRows(stockCfg.receiptRows);
          }
          if (active && Array.isArray(stockCfg.disposalRows)) {
            setDisposalRows(stockCfg.disposalRows);
          }
        }

        // 2. Load preparation chart masters & templates from DB
        const prepRes = await fetch('/api/stock/preparation-charts');
        if (prepRes.ok) {
          const prepJson = await prepRes.json();
          if (Array.isArray(prepJson.masters) && prepJson.masters.length > 0) {
            if (active) {
              setRawPrepMasters(prepJson.masters);
              setPrepMasters(prepJson.masters.map((m: any) => ({
                key: m.key,
                label: m.name || m.label || m.key,
              })));
            }
          }
          if (prepJson.templates && typeof prepJson.templates === 'object') {
            if (active) setPrepTemplates(prepJson.templates);
          }
        }

        // 3. Load STG statement masters strictly from DB prep_chart_configs table
        const stgConfigRes = await fetch('/api/ts/masters');
        if (stgConfigRes.ok) {
          const json = await stgConfigRes.json();
          if (Array.isArray(json.masters) && json.masters.length > 0) {
            if (active) {
              setStgStatements(json.masters.map((m: any) => ({
                key: m.key,
                label: m.label || m.name || m.key,
              })));
            }
          }
        }

        // 4. Load STG Statement Mappings
        const mapRes = await fetch('/api/entries?report_type=STOCK_MAPPING');
        if (mapRes.ok) {
          const json = await mapRes.json();
          const entries: any[] = json.data || [];
          const entry = entries.find((e: any) => {
            if (!e.notes) return false;
            try {
              const parsed = JSON.parse(e.notes);
              return Array.isArray(parsed);
            } catch { return false; }
          }) || entries[0];

          if (entry && entry.notes) {
            try {
              const savedList = JSON.parse(entry.notes);
              if (Array.isArray(savedList)) {
                if (active) setMappings(savedList);
              }
            } catch (e) {
              console.error('Failed parsing saved mappings:', e);
              if (active) setMappings([]);
            }
          } else if (active) {
            setMappings([]);
          }
        }
      } catch (err) {
        console.error('Error loading STG mapping configuration:', err);
        if (active) setError('Failed to load mapping rules from database.');
      } finally {
        if (active) setLoading(false);
      }
    }
    loadData();
    return () => { active = false; };
  }, []);

  // Dynamically compute non-empty available variants from DB masters & templates for selected chart
  const availablePrepVariants = useMemo(() => {
    const set = new Set<string>();

    const extractVariantsFromRow = (r: any) => {
      const v1 = typeof r.variant === 'string' ? r.variant.trim() : '';
      const v2 = typeof r.values?.variant === 'string' ? r.values.variant.trim() : '';
      [v1, v2].forEach(v => {
        if (v && v.toLowerCase() !== 'new ingredient' && v.toLowerCase() !== 'sample' && v.toLowerCase() !== 'diff') {
          set.add(v);
        }
      });
    };

    if (formStockProductKey && formStockProductKey !== '*') {
      const m = rawPrepMasters.find(x => x.key === formStockProductKey);
      if (m?.product_variant) set.add(m.product_variant.trim());

      const tmpl = prepTemplates[formStockProductKey];
      if (tmpl && Array.isArray(tmpl.rows)) {
        tmpl.rows.forEach(extractVariantsFromRow);
      }
    } else {
      rawPrepMasters.forEach(m => {
        if (m.product_variant) set.add(m.product_variant.trim());
      });
      Object.values(prepTemplates).forEach((tmpl: any) => {
        if (tmpl && Array.isArray(tmpl.rows)) {
          tmpl.rows.forEach(extractVariantsFromRow);
        }
      });
    }

    return Array.from(set).filter(v => v !== '');
  }, [formStockProductKey, rawPrepMasters, prepTemplates]);

  // Save STG Mappings to API
  const saveStgToApi = async (listToSave: MappingRule[], alertSuccess: boolean = false) => {
    setSaving(true);
    setError('');
    try {
      const res = await fetch('/api/entries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          report_type: 'STOCK_MAPPING',
          notes: JSON.stringify(listToSave),
        }),
      });

      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.error || 'Failed to save STG statement mapping configuration.');
      }

      setSuccess('Solid Balance STG Mapping configuration saved successfully!');
      setTimeout(() => setSuccess(''), 4000);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const handleClearAllMappings = async () => {
    const ok = await confirm({
      title: 'Clear All Mappings',
      message: 'Are you sure you want to clear ALL mapping rules? All Stage 1 ➔ Stage 3 and Stage 2 ➔ Stage 3 mappings will be removed.',
      confirmText: 'Clear All Mappings',
      cancelText: 'Cancel',
      type: 'danger',
    });
    if (!ok) return;

    setMappings([]);
    await saveStgToApi([], true);
  };

  const openNewStgForm = () => {
    setEditingId(null);
    setError('');

    const isStage1 = formSourceStage === 'STAGE_1';
    const initialKey = isStage1 ? (prepMasters[0]?.key || 'delite_prep') : (stockProducts[0]?.key || 'wh_milk');

    setFormStockProductKey(initialKey);
    setFormStockSection('RECEIPT');
    setFormStockParticular(isStage1 ? (availablePrepVariants[0] || 'DELITE') : 'Receipts:');
    setFormSourceField('qty_lts');

    setFormStgBlockKey(stgStatements[0]?.key || 'WM');
    setFormStgSection('RECEIPT');
    setFormStgItemName('Receipt');
    setFormStgTargetField('qty_lts');
    setIsEditing(true);
  };

  const openEditStgForm = (rule: MappingRule) => {
    setEditingId(rule.id);
    setError('');
    setFormSourceStage(rule.sourceStage || 'STAGE_2');
    setFormStockProductKey(rule.stockProductKey);
    setFormStockSection(rule.stockSection);
    setFormStockParticular(rule.stockParticular || rule.sourceVariant || '');
    setFormSourceField(rule.sourceField || 'qty_lts');

    setFormStgBlockKey(rule.stgBlockKey);
    setFormStgSection(rule.stgSection);
    setFormStgItemName(rule.stgItemName);
    setFormStgTargetField(rule.stgTargetField);
    setIsEditing(true);
  };

  const handleStgFormSave = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const isStage1 = formSourceStage === 'STAGE_1';
    const selectedSourceObj = isStage1
      ? prepMasters.find(p => p.key === formStockProductKey)
      : stockProducts.find(p => p.key === formStockProductKey);

    const sourceLabel = selectedSourceObj ? selectedSourceObj.label : formStockProductKey;
    const selectedStgBlock = stgStatements.find(s => s.key === formStgBlockKey);
    const stgLabel = selectedStgBlock ? selectedStgBlock.label : formStgBlockKey;

    let updated: MappingRule[];
    const ruleObj: MappingRule = {
      id: editingId || ('map_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6)),
      sourceStage: formSourceStage,
      stockProductKey: formStockProductKey,
      stockProductLabel: sourceLabel,
      stockSection: formStockSection,
      stockParticular: formStockParticular.trim() || (isStage1 ? 'VARIANT' : 'Particular'),
      sourceVariant: isStage1 ? formStockParticular.trim() : undefined,
      sourceField: formSourceField,
      stgBlockKey: formStgBlockKey,
      stgBlockLabel: stgLabel,
      stgSection: formStgSection,
      stgItemName: formStgItemName.trim() || 'Item',
      stgTargetField: formStgTargetField,
    };

    if (editingId) {
      updated = mappings.map(r => (r.id === editingId ? ruleObj : r));
    } else {
      updated = [...mappings, ruleObj];
    }

    setMappings(updated);
    setIsEditing(false);
    saveStgToApi(updated);
  };

  const deleteStgRule = async (id: string) => {
    const ok = await confirm({
      title: 'Delete STG Rule',
      message: 'Are you sure you want to delete this mapping rule?',
      confirmText: 'Delete Rule',
      cancelText: 'Cancel',
      type: 'danger',
    });
    if (!ok) return;

    const updated = mappings.filter(r => r.id !== id);
    setMappings(updated);
    saveStgToApi(updated);
  };

  const filteredMappings = mappings.filter(m => {
    if (filterSource === 'ALL') return true;
    if (filterSource === 'STAGE_1') return m.sourceStage === 'STAGE_1';
    if (filterSource === 'STAGE_2') return m.sourceStage === 'STAGE_2';
    return m.stockProductKey === filterSource || m.stgBlockKey === filterSource;
  });

  return (
    <>
      <Header
        title="Solid Balance STG Mapping"
        subtitle="Configure auto-sync mapping rules for Stage 1 (Preparation Charts) ➔ Stage 3 (Solid Balance STG) and Stage 2 (Stock Statement Entry) ➔ Stage 3 (Solid Balance STG)"
        actions={
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={handleClearAllMappings}
              disabled={loading || saving || mappings.length === 0}
              style={{ color: '#dc2626', borderColor: '#fca5a5', background: '#fef2f2', fontWeight: 700 }}
              title="Clear all mapping rules from database"
            >
              🗑️ Clear All Mappings
            </button>
            <button
              type="button"
              className="btn btn-success btn-sm"
              onClick={() => saveStgToApi(mappings, true)}
              disabled={loading || saving}
              title="Save all mapping rules directly to Database"
              style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700 }}
            >
              💾 Save Mappings to DB
            </button>
            <Link href="/dashboard/stock/preparation-charts/mappings" className="btn btn-secondary btn-sm" style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#0369a1', borderColor: '#bae6fd', background: '#f0f9ff', fontWeight: 700 }}>
              🔀 Stage 1 ➔ Stage 2 Rules
            </Link>
            <Link href="/dashboard/ts/new-stg" className="btn btn-primary btn-sm">
              ⚖️ Solid Balance Details (STG)
            </Link>
          </div>
        }
      />

      <div className="page-body animate-fade-in" style={{ maxWidth: 1150 }}>
        {error && <div className="alert alert-error">⚠️ {error}</div>}
        {success && <div className="alert alert-success">✅ {success}</div>}

        {/* Info Banner */}
        <div
          className="card"
          style={{
            marginBottom: 20,
            background: 'linear-gradient(135deg, rgba(14, 165, 233, 0.08) 0%, rgba(99, 102, 241, 0.05) 100%)',
            borderColor: 'rgba(14, 165, 233, 0.25)',
          }}
        >
          <div style={{ fontWeight: 700, fontSize: '1.05rem', color: 'var(--brand-primary)', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
            <span>🔗 Stage 1 ➔ Stage 3 & Stage 2 ➔ Stage 3 Mapping Engine</span>
          </div>
          <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
            <div>
              • <strong>Stage 1 ➔ Stage 3 (Preparation Charts ➔ Solid Balance STG)</strong>: Maps formulation batch quantities, fat%, snf%, and sp_gr directly from non-empty product variants in Preparation Charts (Stage 1) into Solid Balance Details STG (Stage 3).
            </div>
            <div>
              • <strong>Stage 2 ➔ Stage 3 (Stock Statement Entry ➔ Solid Balance STG)</strong>: Maps daily stock statement row entries (e.g. <code>WH.Milk</code>, <code>Skim Milk</code>, <code>BMC's</code>, <code>Separation</code>, <code>Sachet Filling</code>) into Solid Balance Details STG (Stage 3).
            </div>
          </div>
        </div>

        {/* Controls & Filter */}
        <div className="card" style={{ marginBottom: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <label className="form-label" style={{ margin: 0, fontWeight: 600 }}>
                Filter Mappings:
              </label>
              <select
                className="form-select"
                style={{ minWidth: 260, padding: '6px 12px' }}
                value={filterSource}
                onChange={e => setFilterSource(e.target.value)}
              >
                <option value="ALL">All Mapping Rules ({mappings.length})</option>
                <option value="STAGE_1">Stage 1 ➔ Stage 3 (Prep Charts)</option>
                <option value="STAGE_2">Stage 2 ➔ Stage 3 (Stock Entry)</option>
                <optgroup label="STG Statement Blocks">
                  {stgStatements.map(s => (
                    <option key={s.key} value={s.key}>
                      STG Block: {s.key} - {s.label}
                    </option>
                  ))}
                </optgroup>
              </select>
            </div>

            <div style={{ display: 'flex', gap: 10 }}>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={openNewStgForm}
                disabled={loading || saving}
              >
                ➕ Add STG Mapping Rule
              </button>
            </div>
          </div>
        </div>

        {/* Inline Add / Edit Form Modal Card */}
        {isEditing && (
          <div
            className="card animate-fade-in"
            style={{
              marginBottom: 24,
              border: '2px solid var(--brand-primary)',
              background: '#f8fafc',
            }}
          >
            <div style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--brand-primary)', marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>{editingId ? '✏️ Edit STG Mapping Rule' : '➕ Add New STG Statement Mapping Rule'}</span>
              <button type="button" onClick={() => setIsEditing(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.1rem', color: '#64748b' }}>✕</button>
            </div>
            <form onSubmit={handleStgFormSave} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              
              {/* Source Stage Switcher */}
              <div style={{ padding: 14, background: '#ffffff', borderRadius: 8, border: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 20 }}>
                <span style={{ fontWeight: 700, fontSize: '0.88rem', color: 'var(--brand-primary)' }}>Source Stage Type:</span>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: '0.85rem', fontWeight: 700, color: '#0369a1' }}>
                  <input
                    type="radio"
                    name="sourceStage"
                    checked={formSourceStage === 'STAGE_1'}
                    onChange={() => {
                      setFormSourceStage('STAGE_1');
                      if (prepMasters.length > 0) setFormStockProductKey(prepMasters[0].key);
                    }}
                  />
                  <span>📋 Stage 1: Preparation Charts</span>
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: '0.85rem', fontWeight: 700, color: '#059669' }}>
                  <input
                    type="radio"
                    name="sourceStage"
                    checked={formSourceStage === 'STAGE_2'}
                    onChange={() => {
                      setFormSourceStage('STAGE_2');
                      if (stockProducts.length > 0) setFormStockProductKey(stockProducts[0].key);
                    }}
                  />
                  <span>📦 Stage 2: Stock Statement Entry</span>
                </label>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
                {/* Source Side */}
                <div style={{ background: '#fff', padding: 16, borderRadius: 8, border: '1px solid var(--border)' }}>
                  <div style={{ fontWeight: 700, color: formSourceStage === 'STAGE_1' ? '#0369a1' : '#0284c7', marginBottom: 12, fontSize: '0.9rem' }}>
                    {formSourceStage === 'STAGE_1' ? '📋 Stage 1 Source (Preparation Charts)' : '📦 Stage 2 Source (Stock Statement Entry)'}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {formSourceStage === 'STAGE_1' ? (
                      <>
                        <div>
                          <label className="form-label" style={{ fontSize: '0.75rem', marginBottom: 4 }}>Preparation Chart Master</label>
                          <select
                            className="form-select"
                            value={formStockProductKey}
                            onChange={e => {
                              const key = e.target.value;
                              setFormStockProductKey(key);
                            }}
                            style={{ width: '100%' }}
                          >
                            <option value="*">⭐ All Preparation Charts (*)</option>
                            {prepMasters.map(m => (
                              <option key={m.key} value={m.key}>{m.label} ({m.key})</option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="form-label" style={{ fontSize: '0.75rem', marginBottom: 4 }}>
                            Product Variant (Non-Empty Variant)
                          </label>
                          {availablePrepVariants.length > 0 ? (
                            <select
                              className="form-select"
                              value={formStockParticular}
                              onChange={e => setFormStockParticular(e.target.value)}
                              style={{ width: '100%' }}
                            >
                              {availablePrepVariants.map(v => (
                                <option key={v} value={v}>{v}</option>
                              ))}
                            </select>
                          ) : (
                            <input
                              type="text"
                              className="form-input"
                              value={formStockParticular}
                              onChange={e => setFormStockParticular(e.target.value)}
                              placeholder="Type non-empty variant name..."
                              style={{ width: '100%' }}
                              required
                            />
                          )}
                        </div>

                        <div>
                          <label className="form-label" style={{ fontSize: '0.75rem', marginBottom: 4 }}>
                            Source Chart Field (Variant Value)
                          </label>
                          <select
                            className="form-select"
                            value={formSourceField}
                            onChange={e => setFormSourceField(e.target.value as any)}
                            style={{ width: '100%' }}
                          >
                            <option value="qty_lts">Qty (Lts)</option>
                            <option value="qty_kg">Qty (Kg)</option>
                            <option value="fat_pct">Fat %</option>
                            <option value="snf_pct">SNF %</option>
                            <option value="kg_fat">Kg Fat</option>
                            <option value="kg_snf">Kg SNF</option>
                            <option value="sp_gr">Sp. Gravity</option>
                          </select>
                        </div>
                      </>
                    ) : (
                      <>
                        <div>
                          <label className="form-label" style={{ fontSize: '0.75rem', marginBottom: 4 }}>Stock Product Column</label>
                          <select
                            className="form-select"
                            value={formStockProductKey}
                            onChange={e => setFormStockProductKey(e.target.value)}
                            style={{ width: '100%' }}
                          >
                            {stockProducts.map(p => (
                              <option key={p.key} value={p.key}>{p.label} ({p.key})</option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="form-label" style={{ fontSize: '0.75rem', marginBottom: 4 }}>Stock Section</label>
                          <select
                            className="form-select"
                            value={formStockSection}
                            onChange={e => {
                              const sec = e.target.value as 'OB' | 'RECEIPT' | 'DISPOSAL';
                              setFormStockSection(sec);
                              if (sec === 'OB') setFormStockParticular('Opening Balance');
                              else if (sec === 'RECEIPT') setFormStockParticular('Receipts:');
                              else setFormStockParticular('To DLT Milk');
                            }}
                            style={{ width: '100%' }}
                          >
                            <option value="OB">Opening Balance (OB)</option>
                            <option value="RECEIPT">Receipts</option>
                            <option value="DISPOSAL">Disposals</option>
                          </select>
                        </div>

                        <div>
                          <label className="form-label" style={{ fontSize: '0.75rem', marginBottom: 4 }}>Stock Particular Label</label>
                          <input
                            type="text"
                            className="form-input"
                            value={formStockParticular}
                            onChange={e => setFormStockParticular(e.target.value)}
                            placeholder="e.g. Opening Balance, From MDU-SSM, To DLT Milk..."
                            style={{ width: '100%' }}
                            required
                          />
                        </div>
                      </>
                    )}
                  </div>
                </div>

                {/* STG Target Side */}
                <div style={{ background: '#fff', padding: 16, borderRadius: 8, border: '1px solid var(--border)' }}>
                  <div style={{ fontWeight: 700, color: '#10b981', marginBottom: 12, fontSize: '0.9rem' }}>
                    ⚖️ Target Solid Balance (STG)
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <div>
                      <label className="form-label" style={{ fontSize: '0.75rem', marginBottom: 4 }}>STG Statement Master Block</label>
                      <select
                        className="form-select"
                        value={formStgBlockKey}
                        onChange={e => setFormStgBlockKey(e.target.value)}
                        style={{ width: '100%' }}
                      >
                        {stgStatements.map(s => (
                          <option key={s.key} value={s.key}>{s.key} - {s.label}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="form-label" style={{ fontSize: '0.75rem', marginBottom: 4 }}>STG Target Section</label>
                      <select
                        className="form-select"
                        value={formStgSection}
                        onChange={e => {
                          const sec = e.target.value as 'OB' | 'RECEIPT' | 'DISPOSAL' | 'CB';
                          setFormStgSection(sec);
                          if (sec === 'OB') setFormStgItemName('OB');
                          else if (sec === 'CB') setFormStgItemName('CB');
                          else if (sec === 'RECEIPT') setFormStgItemName('Receipt');
                          else setFormStgItemName('Disposal');
                        }}
                        style={{ width: '100%' }}
                      >
                        <option value="OB">Opening Balance (OB)</option>
                        <option value="RECEIPT">Receipts</option>
                        <option value="DISPOSAL">Disposals</option>
                        <option value="CB">Physical Count / Closing (CB)</option>
                      </select>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                      <div>
                        <label className="form-label" style={{ fontSize: '0.75rem', marginBottom: 4 }}>STG Item / Particular</label>
                        <input
                          type="text"
                          className="form-input"
                          value={formStgItemName}
                          onChange={e => setFormStgItemName(e.target.value)}
                          placeholder="e.g. OB, Receipt, To DLT..."
                          style={{ width: '100%' }}
                          required
                        />
                      </div>

                      <div>
                        <label className="form-label" style={{ fontSize: '0.75rem', marginBottom: 4 }}>STG Target Field</label>
                        <select
                          className="form-select"
                          value={formStgTargetField}
                          onChange={e => setFormStgTargetField(e.target.value as any)}
                          style={{ width: '100%' }}
                        >
                          <option value="qty_lts">Qty (Lts)</option>
                          <option value="qty_kg">Qty (Kg)</option>
                          <option value="fat_pct">Fat %</option>
                          <option value="snf_pct">SNF %</option>
                          <option value="kg_fat">Kg Fat</option>
                          <option value="kg_snf">Kg SNF</option>
                        </select>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 8 }}>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => setIsEditing(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary btn-sm">
                  {editingId ? '💾 Update Rule' : '➕ Add Rule'}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Mappings Table */}
        <div className="card">
          {loading ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 40 }}>
              <span className="spinner" /> Loading STG statement mapping rules...
            </div>
          ) : filteredMappings.length === 0 ? (
            <div className="empty-state" style={{ padding: 40, textAlign: 'center' }}>
              <div style={{ fontSize: '2.5rem', marginBottom: 12 }}>🔗</div>
              <div style={{ fontWeight: 600, fontSize: '1.1rem', marginBottom: 6 }}>
                No Solid Balance STG mapping rules configured
              </div>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: 16 }}>
                Click "Add STG Mapping Rule" above to create mapping rules from Stage 1 or Stage 2 into Stage 3 Solid Balance Details.
              </div>
              <button type="button" className="btn btn-primary btn-sm" onClick={openNewStgForm}>
                ➕ Add First STG Rule
              </button>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table className="data-table" style={{ width: '100%' }}>
                <thead>
                  <tr>
                    <th style={{ width: 40 }}>#</th>
                    <th style={{ textAlign: 'left', width: 140 }}>Stage Type</th>
                    <th style={{ textAlign: 'left', minWidth: 280 }}>Source Column / Variant</th>
                    <th style={{ width: 40, textAlign: 'center' }}>➔</th>
                    <th style={{ textAlign: 'left', minWidth: 320 }}>Target Solid Balance STG</th>
                    <th style={{ width: 100, textAlign: 'center' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredMappings.map((m, idx) => {
                    const isStage1 = m.sourceStage === 'STAGE_1';

                    return (
                      <tr key={m.id}>
                        <td style={{ fontWeight: 600, color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                          {idx + 1}
                        </td>

                        <td>
                          <span
                            style={{
                              fontSize: '0.68rem',
                              fontWeight: 800,
                              color: '#ffffff',
                              background: isStage1 ? '#0284c7' : '#059669',
                              padding: '2px 8px',
                              borderRadius: 4,
                            }}
                          >
                            {isStage1 ? 'STAGE 1 (PREP)' : 'STAGE 2 (STOCK)'}
                          </span>
                        </td>

                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                            <span
                              style={{
                                fontWeight: 700,
                                fontSize: '0.85rem',
                                color: 'var(--text-primary)',
                                background: '#f1f5f9',
                                padding: '2px 8px',
                                borderRadius: 4,
                                border: '1px solid var(--border)',
                              }}
                            >
                              {m.stockProductLabel}
                            </span>

                            <span style={{ fontSize: '0.85rem', fontWeight: 700, color: isStage1 ? '#0369a1' : 'var(--text-secondary)' }}>
                              Variant: "{m.stockParticular}"
                            </span>

                            {m.sourceField && (
                              <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#0369a1', background: '#e0f2fe', padding: '1px 5px', borderRadius: 4 }}>
                                Value Field: {m.sourceField}
                              </span>
                            )}
                          </div>
                        </td>

                        <td style={{ textAlign: 'center', fontSize: '1.2rem', color: 'var(--brand-primary)' }}>
                          ➔
                        </td>

                        <td>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                            <div style={{ fontWeight: 600, fontSize: '0.825rem', color: 'var(--brand-primary)' }}>
                              <span style={{ background: '#e0f2fe', padding: '1px 6px', borderRadius: 4, marginRight: 6, fontWeight: 700 }}>
                                {m.stgBlockKey}
                              </span>
                              {m.stgBlockLabel}
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                              <span>
                                Section: <strong>{m.stgSection}</strong>
                              </span>
                              <span>•</span>
                              <span>
                                Item: <strong>"{m.stgItemName}"</strong>
                              </span>
                              <span>•</span>
                              <span style={{ color: '#059669', fontWeight: 700, background: '#d1fae5', padding: '1px 6px', borderRadius: 4 }}>
                                Target: {m.stgTargetField}
                              </span>
                            </div>
                          </div>
                        </td>

                        <td style={{ textAlign: 'center' }}>
                          <div style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
                            <button
                              type="button"
                              className="btn btn-ghost btn-sm"
                              style={{ padding: '4px 8px', fontSize: '0.75rem', color: 'var(--brand-primary)' }}
                              onClick={() => openEditStgForm(m)}
                            >
                              ✏️ Edit
                            </button>
                            <button
                              type="button"
                              className="btn btn-ghost btn-sm"
                              style={{ padding: '4px 8px', fontSize: '0.75rem', color: '#ef4444' }}
                              onClick={() => deleteStgRule(m.id)}
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
    </>
  );
}
