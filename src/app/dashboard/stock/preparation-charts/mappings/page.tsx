'use client';

import { useState, useEffect, useMemo } from 'react';
import Header from '@/components/layout/Header';
import Link from 'next/link';
import MasterDetailLayout from '@/components/ui/MasterDetailLayout';
import type { PrepToStockMappingRule, ChartMasterDef, ChartColumnDef } from '@/app/api/stock/preparation-charts/route';
import { useConfirm } from '@/context/ConfirmContext';

export default function PrepToStockMappingsConfigPage() {
  const { confirm } = useConfirm();
  const [mappings, setMappings] = useState<PrepToStockMappingRule[]>([]);
  const [masters, setMasters] = useState<ChartMasterDef[]>([]);
  const [chartColumns, setChartColumns] = useState<ChartColumnDef[]>([]);
  const [templates, setTemplates] = useState<Record<string, any>>({});
  const [productOptions, setProductOptions] = useState<Array<{ key: string; label: string }>>([]);
  const [dbReceiptRows, setDbReceiptRows] = useState<string[]>([]);
  const [dbDisposalRows, setDbDisposalRows] = useState<string[]>([]);

  const [activeRuleId, setActiveRuleId] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Form State for editing the active rule
  const [formSourceChartKey, setFormSourceChartKey] = useState<string>('*');
  const [formSourceVariant, setFormSourceVariant] = useState<string>('');
  const [formSourceColKey, setFormSourceColKey] = useState<string>('qty_lit');
  const [formTargetRowType, setFormTargetRowType] = useState<'RECEIPT' | 'DISPOSAL'>('RECEIPT');
  const [formTargetRowLabel, setFormTargetRowLabel] = useState<string>('');
  const [formTargetProductKey, setFormTargetProductKey] = useState<string>('');
  const [formEnabled, setFormEnabled] = useState<boolean>(true);
  const [formDescription, setFormDescription] = useState<string>('');

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      try {
        const res = await fetch('/api/stock/preparation-charts');
        if (res.ok) {
          const json = await res.json();
          const loadedMappings: PrepToStockMappingRule[] = json.mappings || [];
          setMappings(loadedMappings);
          if (Array.isArray(json.masters)) setMasters(json.masters);
          if (Array.isArray(json.columns)) setChartColumns(json.columns);
          if (json.templates && typeof json.templates === 'object') setTemplates(json.templates);

          if (loadedMappings.length > 0) {
            setActiveRuleId(loadedMappings[0].id);
            populateForm(loadedMappings[0]);
          }
        }
      } catch (err) {
        console.error('Failed to load preparation charts config from DB:', err);
      }

      // Fetch Product Master dynamically strictly from Database
      try {
        const pRes = await fetch('/api/master/products');
        if (pRes.ok) {
          const json = await pRes.json();
          const prods = json.data || json.products || [];
          if (Array.isArray(prods) && prods.length > 0) {
            const opts = prods.map((p: any) => ({
              key: p.product_key || p.key || (p.short_name || p.product_name || p.full_name).toLowerCase().replace(/[^a-z0-9_]/g, '_'),
              label: p.short_name || p.product_name || p.full_name || p.key,
            }));
            setProductOptions(opts);
          } else {
            setProductOptions([]);
          }
        }
      } catch (e) {
        console.error('Error fetching products master from DB:', e);
      }

      // Fetch Particulars Rows dynamically strictly from Database particulars_master
      try {
        const partRes = await fetch('/api/master/particulars');
        if (partRes.ok) {
          const json = await partRes.json();
          const list = json.data || [];
          if (Array.isArray(list) && list.length > 0) {
            const recs = list
              .filter((r: any) => (r.section_type || '').toUpperCase() === 'RECEIPT')
              .map((r: any) => r.particular_name || r.code || r.full_name);
            const disps = list
              .filter((r: any) => (r.section_type || '').toUpperCase() === 'DISPOSAL')
              .map((r: any) => r.particular_name || r.code || r.full_name);

            setDbReceiptRows(recs);
            setDbDisposalRows(disps);
          } else {
            setDbReceiptRows([]);
            setDbDisposalRows([]);
          }
        }
      } catch (e) {
        console.error('Error fetching particulars master from DB:', e);
      }

      setLoading(false);
    }
    loadData();
  }, []);

  const populateForm = (rule: PrepToStockMappingRule) => {
    setFormSourceChartKey(rule.sourceChartKey || '*');
    setFormSourceVariant(rule.sourceVariant || '');
    setFormSourceColKey(rule.sourceColKey || 'qty_lit');
    setFormTargetRowType(rule.targetRowType || 'RECEIPT');
    setFormTargetRowLabel(rule.targetRowLabel || '');
    setFormTargetProductKey(rule.targetProductKey || '');
    setFormEnabled(rule.enabled !== false);
    setFormDescription(rule.description || '');
  };

  const handleSelectRule = (ruleId: string) => {
    setActiveRuleId(ruleId);
    const rule = mappings.find(m => m.id === ruleId);
    if (rule) populateForm(rule);
  };

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Dynamically compute available variants from DB masters & templates for selected chart
  const availableVariants = useMemo(() => {
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

    if (formSourceChartKey && formSourceChartKey !== '*') {
      const m = masters.find(x => x.key === formSourceChartKey);
      if (m?.product_variant) set.add(m.product_variant);

      const tmpl = templates[formSourceChartKey];
      if (tmpl && Array.isArray(tmpl.rows)) {
        tmpl.rows.forEach(extractVariantsFromRow);
      }
    } else {
      masters.forEach(m => {
        if (m.product_variant) set.add(m.product_variant);
      });
      Object.values(templates).forEach((tmpl: any) => {
        if (tmpl && Array.isArray(tmpl.rows)) {
          tmpl.rows.forEach(extractVariantsFromRow);
        }
      });
    }

    return Array.from(set);
  }, [formSourceChartKey, masters, templates]);

  const handleAddNewRule = () => {
    const defaultProdKey = productOptions.length > 0 ? productOptions[0].key : '';
    const defaultRowLabel = dbReceiptRows.length > 0 ? dbReceiptRows[0] : '';
    const newId = `rule_${Date.now()}`;
    const newRule: PrepToStockMappingRule = {
      id: newId,
      sourceChartKey: '*',
      sourceVariant: availableVariants.length > 0 ? availableVariants[0] : '',
      sourceColKey: chartColumns.length > 0 ? chartColumns[0].key : 'qty_lit',
      targetRowType: 'RECEIPT',
      targetRowLabel: defaultRowLabel,
      targetProductKey: defaultProdKey,
      enabled: true,
      description: 'New Stage 1 ➔ Stage 2 Mapping Rule',
    };

    setMappings(prev => [...prev, newRule]);
    setActiveRuleId(newId);
    populateForm(newRule);
    showToast('➕ Created new mapping rule. Configure rule fields and click Save.');
  };

  const handleDeleteRule = async (id: string) => {
    const isConfirmed = await confirm({
      title: 'Delete Mapping Rule',
      message: 'Are you sure you want to delete this mapping rule from Database?',
      confirmText: 'Delete Rule',
      cancelText: 'Cancel',
      type: 'danger',
    });

    if (!isConfirmed) return;

    const remaining = mappings.filter(m => m.id !== id);
    setMappings(remaining);
    if (activeRuleId === id) {
      const nextActive = remaining[0];
      setActiveRuleId(nextActive ? nextActive.id : null);
      if (nextActive) populateForm(nextActive);
    }
    showToast('Deleted mapping rule locally. Click Save Rules to persist to Database.');
  };

  const handleUpdateActiveRule = (field: keyof PrepToStockMappingRule, val: any) => {
    if (!activeRuleId) return;

    setMappings(prev =>
      prev.map(rule => {
        if (rule.id !== activeRuleId) return rule;
        return { ...rule, [field]: val };
      })
    );
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
        showToast('✅ Saved mapping rules to Database table (prep_to_stock_mapping_rules)!');
      } else {
        showToast('❌ Failed to save mapping rules to Database');
      }
    } catch (err) {
      console.error('Save mapping error:', err);
      showToast('❌ Server error saving rules');
    }
    setSaving(false);
  };

  return (
    <>
      <Header
        title="Stage 1 (Preparation Chart) ➔ Stage 2 (Stock Statement Entry) Mapping Rules"
        subtitle="Configure database-driven custom mapping rules converting Stage 1 Preparation Chart batch quantities into Stage 2 Stock Statement Entry columns"
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
              {saving ? 'Saving...' : '💾 Save Rules to Database'}
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

        {/* ─── MASTER-DETAIL LAYOUT (LEFT SIDEBAR: Rule) ────────────────────────── */}
        {loading ? (
          <div className="card" style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
            <span className="spinner" /> Loading mapping rules & DB masters...
          </div>
        ) : (
          <MasterDetailLayout<PrepToStockMappingRule>
            items={mappings}
            getItemKey={r => r.id}
            selectedKey={activeRuleId}
            onSelectKey={handleSelectRule}
            leftPanelTitle="Rule"
            leftPanelWidth={360}
            searchPlaceholder="🔍 Search rule variant, chart or target..."
            filterPredicate={(r, q) =>
              (r.description || '').toLowerCase().includes(q) ||
              (r.sourceVariant || '').toLowerCase().includes(q) ||
              (r.sourceChartKey || '').toLowerCase().includes(q) ||
              (r.targetProductKey || '').toLowerCase().includes(q) ||
              (r.targetRowLabel || '').toLowerCase().includes(q)
            }
            emptyListMessage="No mapping rules in database"
            emptyDetailMessage="Select a rule from the left sidebar to edit details"
            headerExtra={
              <button
                type="button"
                className="btn btn-primary btn-xs"
                onClick={handleAddNewRule}
                style={{ fontSize: '0.75rem', padding: '3px 8px', background: '#0284c7', borderColor: '#0284c7' }}
                title="Create a new mapping rule"
              >
                ➕ Add Rule
              </button>
            }
            renderListItem={(r, isSelected) => {
              const targetLabel = productOptions.find(p => p.key === r.targetProductKey)?.label || r.targetProductKey;
              const chartName = r.sourceChartKey === '*'
                ? 'All Charts'
                : (masters.find(m => m.key === r.sourceChartKey)?.name || r.sourceChartKey);

              return (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ fontWeight: 800, fontSize: '0.88rem', color: isSelected ? 'var(--brand-primary)' : 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span>🔀 {r.sourceVariant || 'Unnamed Rule'}</span>
                      {isSelected && <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--brand-primary)', display: 'inline-block' }} />}
                    </div>
                    <span
                      style={{
                        padding: '2px 7px',
                        borderRadius: 10,
                        fontSize: '0.68rem',
                        fontWeight: 700,
                        background: r.enabled !== false ? '#dcfce7' : '#f1f5f9',
                        color: r.enabled !== false ? '#15803d' : '#64748b',
                      }}
                    >
                      {r.enabled !== false ? 'Active' : 'Disabled'}
                    </span>
                  </div>

                  {/* Stage 1 -> Stage 2 Visual Path */}
                  <div style={{ fontSize: '0.76rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
                    <span style={{ fontWeight: 600, color: '#0369a1' }}>Stage 1 ({chartName})</span>
                    <span>➔</span>
                    <span style={{ fontWeight: 700, color: r.targetRowType === 'RECEIPT' ? '#16a34a' : '#ea580c' }}>
                      Stage 2 ({targetLabel} {r.targetRowLabel ? `[${r.targetRowLabel}]` : ''})
                    </span>
                  </div>

                  {r.description && (
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {r.description}
                    </div>
                  )}
                </div>
              );
            }}
            renderDetail={rule => {
              if (!rule) return null;

              const targetLabel = productOptions.find(p => p.key === formTargetProductKey)?.label || formTargetProductKey;
              const activeChartName = formSourceChartKey === '*'
                ? 'All Preparation Charts (*)'
                : (masters.find(m => m.key === formSourceChartKey)?.name || formSourceChartKey);

              const targetRowOptions = formTargetRowType === 'DISPOSAL' ? dbDisposalRows : dbReceiptRows;

              return (
                <div className="card" style={{ border: '1px solid var(--border)', padding: 0, overflow: 'hidden' }}>
                  {/* Card Header Banner (Stage 1 -> Stage 2) */}
                  <div style={{ padding: '16px 20px', background: 'linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%)', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
                    <div>
                      <div style={{ fontWeight: 800, fontSize: '1.05rem', color: '#0369a1', display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span>🔀 Stage 1 ({activeChartName} / {formSourceVariant}) ➔ Stage 2 ({targetLabel} [{formTargetRowType} - {formTargetRowLabel || 'Row'}])</span>
                      </div>
                      <div style={{ fontSize: '0.8rem', color: '#0c4a6e', marginTop: 3 }}>
                        Database Mapping Rule ID: <code>{rule.id}</code>
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={() => handleDeleteRule(rule.id)}
                        style={{ color: '#dc2626', borderColor: '#fca5a5', background: '#fef2f2' }}
                        title="Delete Rule"
                      >
                        ✕ Delete Rule
                      </button>
                      <button
                        type="button"
                        className="btn btn-primary btn-sm"
                        onClick={handleSaveAllMappings}
                        disabled={saving}
                      >
                        {saving ? 'Saving...' : '💾 Save Rules to DB'}
                      </button>
                    </div>
                  </div>

                  {/* Stage 1 -> Stage 2 Visual Workflow Indicator */}
                  <div style={{ padding: '14px 20px', background: '#ffffff', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
                    <div style={{ flex: 1, minWidth: 200, padding: 12, borderRadius: 8, background: '#f0f9ff', border: '1px solid #bae6fd' }}>
                      <div style={{ fontSize: '0.72rem', fontWeight: 800, color: '#0284c7', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 2 }}>
                        STAGE 1: PREPARATION CHART (SOURCE)
                      </div>
                      <div style={{ fontSize: '0.88rem', fontWeight: 700, color: '#0c4a6e' }}>
                        {activeChartName}
                      </div>
                      <div style={{ fontSize: '0.8rem', color: '#0369a1', marginTop: 2 }}>
                        Variant: <strong>{formSourceVariant || 'Variant'}</strong> | Column: <code>{formSourceColKey}</code>
                      </div>
                    </div>

                    <div style={{ fontSize: '1.4rem', color: '#0284c7', fontWeight: 800 }}>➔</div>

                    <div style={{ flex: 1, minWidth: 200, padding: 12, borderRadius: 8, background: '#f0fdf4', border: '1px solid #86efac' }}>
                      <div style={{ fontSize: '0.72rem', fontWeight: 800, color: '#16a34a', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 2 }}>
                        STAGE 2: STOCK STATEMENT ENTRY (TARGET)
                      </div>
                      <div style={{ fontSize: '0.88rem', fontWeight: 700, color: '#14532d' }}>
                        {targetLabel} ({formTargetRowType})
                      </div>
                      <div style={{ fontSize: '0.8rem', color: '#15803d', marginTop: 2 }}>
                        Target Section: <strong>{formTargetRowType}</strong> | Row: <strong>{formTargetRowLabel || ""}</strong> | Column Key: <code>{formTargetProductKey}</code>
                      </div>
                    </div>
                  </div>

                  {/* Rule Details Form */}
                  <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 20 }}>
                    {/* CENTER SECTION: Rule Name / Description * */}
                    <div style={{ background: '#f8fafc', padding: 16, borderRadius: 8, border: '1px solid var(--border)' }}>
                      <div className="form-group" style={{ margin: 0 }}>
                        <label className="form-label" style={{ fontWeight: 800, fontSize: '0.9rem', color: 'var(--brand-primary)', marginBottom: 6, display: 'block', textAlign: 'center' }}>
                          Rule Name / Description *
                        </label>
                        <input
                          type="text"
                          className="form-input"
                          placeholder="e.g. DELITE Preparation Chart Qty(Lit) ➔ DLT.Milk (Receipts - BMC's)"
                          value={formDescription}
                          onChange={e => {
                            setFormDescription(e.target.value);
                            handleUpdateActiveRule('description', e.target.value);
                          }}
                          required
                          style={{
                            textAlign: 'center',
                            fontWeight: 600,
                            fontSize: '0.92rem',
                            padding: '8px 12px',
                            borderColor: formDescription ? 'var(--border)' : '#fca5a5',
                          }}
                        />
                      </div>
                    </div>

                    {/* SIDE-BY-SIDE 2-COLUMN GRID: Stage 1 (Left) vs Stage 2 (Right) */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 20 }}>
                      
                      {/* ─── LEFT SIDE: Stage 1 Source Configuration ─── */}
                      <div style={{ background: '#f0f9ff', borderRadius: 10, border: '1px solid #bae6fd', padding: 18, display: 'flex', flexDirection: 'column', gap: 16 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, borderBottom: '1px solid #93c5fd', paddingBottom: 10 }}>
                          <span style={{ fontSize: '1.1rem' }}>📋</span>
                          <div>
                            <div style={{ fontWeight: 800, fontSize: '0.88rem', color: '#0369a1', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                              Stage 1: Source (Preparation Chart)
                            </div>
                            <div style={{ fontSize: '0.75rem', color: '#0284c7' }}>Strictly selected from Database masters</div>
                          </div>
                        </div>

                        {/* Stage 1: Source Preparation Chart * [Strictly from DB prep_chart_configs] */}
                        <div className="form-group">
                          <label className="form-label" style={{ fontWeight: 700, color: '#0c4a6e' }}>Stage 1: Source Preparation Chart *</label>
                          <select
                            className="form-select"
                            value={formSourceChartKey}
                            onChange={e => {
                              const val = e.target.value;
                              setFormSourceChartKey(val);
                              handleUpdateActiveRule('sourceChartKey', val);
                              if (val !== '*') {
                                const chartMaster = masters.find(m => m.key === val);
                                if (chartMaster?.product_variant) {
                                  setFormSourceVariant(chartMaster.product_variant);
                                  handleUpdateActiveRule('sourceVariant', chartMaster.product_variant);
                                }
                              }
                            }}
                          >
                            <option value="*">⭐ All Preparation Charts (*)</option>
                            {masters.map(m => (
                              <option key={m.key} value={m.key}>{m.name} ({m.product_variant})</option>
                            ))}
                          </select>
                          <div style={{ fontSize: '0.72rem', color: '#0284c7', marginTop: 4 }}>
                            🔒 Loaded strictly from Database table <code>prep_chart_configs</code> (Masters)
                          </div>
                        </div>

                        {/* Stage 1: Source Product Variant * [Strictly from DB prep_chart_configs & templates] */}
                        <div className="form-group">
                          <label className="form-label" style={{ fontWeight: 700, color: '#0c4a6e' }}>Stage 1: Source Product Variant *</label>
                          <select
                            className="form-select"
                            value={formSourceVariant}
                            onChange={e => {
                              const val = e.target.value;
                              setFormSourceVariant(val);
                              handleUpdateActiveRule('sourceVariant', val);
                            }}
                          >
                            {availableVariants.map(v => (
                              <option key={`var_opt_${v}`} value={v}>{v}</option>
                            ))}
                          </select>
                          <div style={{ fontSize: '0.72rem', color: '#0284c7', marginTop: 4 }}>
                            🔒 Loaded strictly from Database Preparation Chart Masters & Row Variants
                          </div>
                        </div>

                        {/* Stage 1: Source Quantity Column * [Strictly from DB prep_chart_configs columns] */}
                        <div className="form-group">
                          <label className="form-label" style={{ fontWeight: 700, color: '#0c4a6e' }}>Stage 1: Source Quantity Column *</label>
                          <select
                            className="form-select"
                            value={formSourceColKey}
                            onChange={e => {
                              setFormSourceColKey(e.target.value);
                              handleUpdateActiveRule('sourceColKey', e.target.value);
                            }}
                          >
                            {chartColumns.map(c => (
                              <option key={c.key} value={c.key}>{c.name} ({c.key})</option>
                            ))}
                            {chartColumns.length === 0 && (
                              <>
                                <option value="qty_lit">Qty(Lit) / qty_lit</option>
                                <option value="qty_kg">Qty(Kg) / qty_kg</option>
                                <option value="kg_fat">Kg Fat / kg_fat</option>
                                <option value="kg_snf">Kg SNF / kg_snf</option>
                              </>
                            )}
                          </select>
                          <div style={{ fontSize: '0.72rem', color: '#0284c7', marginTop: 4 }}>
                            🔒 Loaded strictly from Database table <code>prep_chart_configs</code> (Columns)
                          </div>
                        </div>
                      </div>

                      {/* ─── RIGHT SIDE: Stage 2 Target Configuration ─── */}
                      <div style={{ background: '#f0fdf4', borderRadius: 10, border: '1px solid #86efac', padding: 18, display: 'flex', flexDirection: 'column', gap: 16 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, borderBottom: '1px solid #86efac', paddingBottom: 10 }}>
                          <span style={{ fontSize: '1.1rem' }}>📊</span>
                          <div>
                            <div style={{ fontWeight: 800, fontSize: '0.88rem', color: '#15803d', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                              Stage 2: Target (Stock Statement Entry)
                            </div>
                            <div style={{ fontSize: '0.75rem', color: '#166534' }}>Strictly selected from Database masters</div>
                          </div>
                        </div>

                        {/* Stage 2: Target Stock Section * */}
                        <div className="form-group">
                          <label className="form-label" style={{ fontWeight: 700, color: '#14532d' }}>Stage 2: Target Stock Section *</label>
                          <select
                            className="form-select"
                            value={formTargetRowType}
                            onChange={e => {
                              const val = e.target.value as 'RECEIPT' | 'DISPOSAL';
                              setFormTargetRowType(val);
                              handleUpdateActiveRule('targetRowType', val);
                              const availableRows = val === 'DISPOSAL' ? dbDisposalRows : dbReceiptRows;
                              if (availableRows.length > 0) {
                                setFormTargetRowLabel(availableRows[0]);
                                handleUpdateActiveRule('targetRowLabel', availableRows[0]);
                              }
                            }}
                          >
                            <option value="RECEIPT">Receipts</option>
                            <option value="DISPOSAL">Disposals</option>
                          </select>
                        </div>

                        {/* Stage 2: Target Product Row (Stock Statement Entry) * [Strictly from DB particulars_master] */}
                        <div className="form-group">
                          <label className="form-label" style={{ fontWeight: 700, color: '#14532d' }}>
                            Stage 2: Target Product Row (Stock Statement Entry) *
                          </label>
                          <select
                            className="form-select"
                            value={formTargetRowLabel}
                            onChange={e => {
                              const val = e.target.value;
                              setFormTargetRowLabel(val);
                              handleUpdateActiveRule('targetRowLabel', val);
                            }}
                          >
                            {targetRowOptions.map(r => (
                              <option key={`db_row_${r}`} value={r}>{r}</option>
                            ))}
                          </select>
                          <div style={{ fontSize: '0.72rem', color: '#15803d', marginTop: 4 }}>
                            🔒 Loaded strictly from Database table <code>particulars_master</code> ({formTargetRowType} section)
                          </div>
                        </div>

                        {/* Stage 2: Target Product Column (Stock Statement Entry) * [Strictly from DB products_master] */}
                        <div className="form-group">
                          <label className="form-label" style={{ fontWeight: 700, color: '#14532d' }}>
                            Stage 2: Target Product Column (Stock Statement Entry) *
                          </label>
                          <select
                            className="form-select"
                            value={formTargetProductKey}
                            onChange={e => {
                              setFormTargetProductKey(e.target.value);
                              handleUpdateActiveRule('targetProductKey', e.target.value);
                            }}
                          >
                            {productOptions.map(p => (
                              <option key={p.key} value={p.key}>{p.label} ({p.key})</option>
                            ))}
                          </select>
                          <div style={{ fontSize: '0.72rem', color: '#15803d', marginTop: 4 }}>
                            🔒 Loaded strictly from Database table <code>products_master</code>
                          </div>
                        </div>
                      </div>

                    </div>

                    {/* Active Status Switcher */}
                    <div style={{ padding: 14, background: '#f8fafc', borderRadius: 8, border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: '0.88rem', color: 'var(--text-primary)' }}>Rule Active Status</div>
                        <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Enable or disable this database mapping rule without deleting it.</div>
                      </div>
                      <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontWeight: 700, fontSize: '0.9rem' }}>
                        <input
                          type="checkbox"
                          checked={formEnabled}
                          onChange={e => {
                            setFormEnabled(e.target.checked);
                            handleUpdateActiveRule('enabled', e.target.checked);
                          }}
                          style={{ width: 18, height: 18, cursor: 'pointer' }}
                        />
                        {formEnabled ? 'Active' : 'Disabled'}
                      </label>
                    </div>
                  </div>

                  {/* Footer Bar */}
                  <div style={{ padding: '12px 20px', background: '#f8fafc', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                    <button
                      type="button"
                      className="btn btn-primary btn-sm"
                      onClick={handleSaveAllMappings}
                      disabled={saving}
                    >
                      {saving ? 'Saving...' : '💾 Save Rule & Update Database'}
                    </button>
                  </div>
                </div>
              );
            }}
          />
        )}
      </div>
    </>
  );
}

