'use client';

import { useState, useEffect, useMemo } from 'react';
import Header from '@/components/layout/Header';
import Link from 'next/link';
import MasterDetailLayout from '@/components/ui/MasterDetailLayout';
import type { PrepToStockMappingRule, ChartMasterDef, ChartColumnDef } from '@/app/api/stock/preparation-charts/route';
import { useConfirm } from '@/context/ConfirmContext';

interface ChartSidebarItem {
  key: string;
  name: string;
  product_variant: string;
  isUniversal: boolean;
  description?: string;
}

export default function PrepToStockMappingsConfigPage() {
  const { confirm } = useConfirm();
  const [mappings, setMappings] = useState<PrepToStockMappingRule[]>([]);
  const [masters, setMasters] = useState<ChartMasterDef[]>([]);
  const [chartColumns, setChartColumns] = useState<ChartColumnDef[]>([]);
  const [templates, setTemplates] = useState<Record<string, any>>({});
  const [productOptions, setProductOptions] = useState<Array<{ key: string; label: string }>>([]);
  const [dbReceiptRows, setDbReceiptRows] = useState<string[]>([]);
  const [dbDisposalRows, setDbDisposalRows] = useState<string[]>([]);

  // Selected Chart on the left panel (chart key, e.g. 'delite_milk' or '*')
  const [selectedChartKey, setSelectedChartKey] = useState<string>('*');
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Modal State for Adding / Editing a Mapping Rule
  const [isRuleModalOpen, setIsRuleModalOpen] = useState<boolean>(false);
  const [editingRuleId, setEditingRuleId] = useState<string | null>(null);

  // Form Fields inside Add/Edit Modal
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
          if (Array.isArray(json.masters)) {
            setMasters(json.masters);
            // Default selection to first master if available, otherwise '*'
            if (json.masters.length > 0) {
              setSelectedChartKey(json.masters[0].key);
            }
          }
          if (Array.isArray(json.columns)) setChartColumns(json.columns);
          if (json.templates && typeof json.templates === 'object') setTemplates(json.templates);
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

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  // Preparation Chart items for the Left Sidebar
  const chartSidebarItems: ChartSidebarItem[] = useMemo(() => {
    const list: ChartSidebarItem[] = [
      {
        key: '*',
        name: '⭐ Universal Rules (All Charts)',
        product_variant: 'All Preparation Charts (*)',
        isUniversal: true,
        description: 'Rules applied globally across every preparation chart',
      },
      ...masters.map(m => ({
        key: m.key,
        name: m.name,
        product_variant: m.product_variant || m.name,
        isUniversal: false,
        description: `Preparation formulation chart for ${m.product_variant || m.name}`,
      })),
    ];
    return list;
  }, [masters]);

  // Extract ingredients for a given chart from templates & master
  const getChartIngredients = (chartKey: string): string[] => {
    const set = new Set<string>();
    const extractVariantsFromRow = (r: any) => {
      const v1 = typeof r.variant === 'string' ? r.variant.trim() : '';
      const v2 = typeof r.values?.variant === 'string' ? r.values.variant.trim() : '';
      const name = typeof r.name === 'string' ? r.name.trim() : '';
      [v1, v2, name].forEach(v => {
        if (v && !['new ingredient', 'sample', 'diff', 'difference', 'total'].includes(v.toLowerCase())) {
          set.add(v);
        }
      });
    };

    if (chartKey && chartKey !== '*') {
      const m = masters.find(x => x.key === chartKey);
      if (m?.product_variant) set.add(m.product_variant);

      const tmpl = templates[chartKey];
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
  };

  // Currently selected chart object
  const currentSelectedChart = useMemo(() => {
    return chartSidebarItems.find(c => c.key === selectedChartKey) || chartSidebarItems[0] || null;
  }, [chartSidebarItems, selectedChartKey]);

  // Rules specifically mapped to the active chart
  const currentChartRules = useMemo(() => {
    return mappings.filter(r => r.sourceChartKey === selectedChartKey);
  }, [mappings, selectedChartKey]);

  // Ingredients for the currently selected chart
  const currentChartIngredients = useMemo(() => {
    if (!selectedChartKey) return [];
    return getChartIngredients(selectedChartKey);
  }, [selectedChartKey, masters, templates]);

  // Available variants for the form modal based on formSourceChartKey
  const modalAvailableVariants = useMemo(() => {
    return getChartIngredients(formSourceChartKey);
  }, [formSourceChartKey, masters, templates]);

  // Open modal to create a new rule
  const handleOpenAddRuleModal = (prefillVariant?: string) => {
    const targetChartKey = selectedChartKey || '*';
    const chartIngredients = getChartIngredients(targetChartKey);
    const chosenVariant = prefillVariant || (chartIngredients.length > 0 ? chartIngredients[0] : '');

    const defaultProdKey = productOptions.length > 0 ? productOptions[0].key : '';
    const defaultRowLabel = dbReceiptRows.length > 0 ? dbReceiptRows[0] : '';
    const defaultColKey = chartColumns.length > 0 ? chartColumns[0].key : 'qty_lit';

    setEditingRuleId(null);
    setFormSourceChartKey(targetChartKey);
    setFormSourceVariant(chosenVariant);
    setFormSourceColKey(defaultColKey);
    setFormTargetRowType('RECEIPT');
    setFormTargetRowLabel(defaultRowLabel);
    setFormTargetProductKey(defaultProdKey);
    setFormEnabled(true);

    const chartTitle = masters.find(m => m.key === targetChartKey)?.name || (targetChartKey === '*' ? 'All Charts' : targetChartKey);
    setFormDescription(`${chartTitle} (${chosenVariant || 'Qty'}) ➔ Receipts: ${defaultRowLabel} (${defaultProdKey})`);

    setIsRuleModalOpen(true);
  };

  // Open modal to edit an existing rule
  const handleOpenEditRuleModal = (rule: PrepToStockMappingRule) => {
    setEditingRuleId(rule.id);
    setFormSourceChartKey(rule.sourceChartKey || '*');
    setFormSourceVariant(rule.sourceVariant || '');
    setFormSourceColKey(rule.sourceColKey || 'qty_lit');
    setFormTargetRowType(rule.targetRowType || 'RECEIPT');
    setFormTargetRowLabel(rule.targetRowLabel || '');
    setFormTargetProductKey(rule.targetProductKey || '');
    setFormEnabled(rule.enabled !== false);
    setFormDescription(rule.description || '');

    setIsRuleModalOpen(true);
  };

  // Auto-generate a readable description for the rule
  const handleAutoGenerateDesc = () => {
    const chartTitle = masters.find(m => m.key === formSourceChartKey)?.name || (formSourceChartKey === '*' ? 'All Charts' : formSourceChartKey);
    const targetLabel = productOptions.find(p => p.key === formTargetProductKey)?.label || formTargetProductKey;
    const desc = `${chartTitle} (${formSourceVariant || 'Variant'}) [${formSourceColKey}] ➔ ${formTargetRowType === 'RECEIPT' ? 'Receipts' : 'Disposals'}: ${formTargetRowLabel || 'Row'} (${targetLabel})`;
    setFormDescription(desc);
  };

  // Save/Submit the rule in the modal
  const handleSaveModalRule = (e: React.FormEvent) => {
    e.preventDefault();

    if (!formSourceVariant.trim()) {
      alert('Please select or specify a source product variant or ingredient.');
      return;
    }

    if (editingRuleId) {
      // Update existing rule
      setMappings(prev =>
        prev.map(r =>
          r.id === editingRuleId
            ? {
                ...r,
                sourceChartKey: formSourceChartKey,
                sourceVariant: formSourceVariant,
                sourceColKey: formSourceColKey,
                targetRowType: formTargetRowType,
                targetRowLabel: formTargetRowLabel,
                targetProductKey: formTargetProductKey,
                enabled: formEnabled,
                description: formDescription.trim(),
              }
            : r
        )
      );
      showToast('✏️ Mapping rule updated in table. Remember to click "Save Rules to Database".');
    } else {
      // Create new rule
      const newId = `rule_${Date.now()}`;
      const newRule: PrepToStockMappingRule = {
        id: newId,
        sourceChartKey: formSourceChartKey,
        sourceVariant: formSourceVariant,
        sourceColKey: formSourceColKey,
        targetRowType: formTargetRowType,
        targetRowLabel: formTargetRowLabel,
        targetProductKey: formTargetProductKey,
        enabled: formEnabled,
        description: formDescription.trim(),
      };
      setMappings(prev => [...prev, newRule]);
      showToast('➕ New mapping rule added! Click "Save Rules to Database" to commit to DB.');
    }

    setIsRuleModalOpen(false);
  };

  // Delete a mapping rule
  const handleDeleteRule = async (id: string) => {
    const isConfirmed = await confirm({
      title: 'Delete Mapping Rule',
      message: 'Are you sure you want to delete this mapping rule from the database?',
      confirmText: 'Delete Rule',
      cancelText: 'Cancel',
      type: 'danger',
    });

    if (!isConfirmed) return;

    setMappings(prev => prev.filter(m => m.id !== id));
    showToast('🗑️ Mapping rule removed. Click "Save Rules to Database" to finalize changes.');
  };

  // Toggle active/disabled status directly in the list
  const handleToggleRuleStatus = (id: string, newStatus: boolean) => {
    setMappings(prev =>
      prev.map(r => (r.id === id ? { ...r, enabled: newStatus } : r))
    );
  };

  // Save all mappings to the database via API
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

  // Helper column names
  const getColumnName = (colKey: string) => {
    const col = chartColumns.find(c => c.key === colKey);
    if (col) return `${col.name} (${col.key})`;
    if (colKey === 'qty_lit') return 'Qty(Lit)';
    if (colKey === 'qty_kg') return 'Qty(Kg)';
    if (colKey === 'kg_fat') return 'Kg Fat';
    if (colKey === 'kg_snf') return 'Kg SNF';
    return colKey;
  };

  return (
    <>
      <Header
        title="Stage 1 (Preparation Chart) ➔ Stage 2 (Stock Statement Entry) Mapping Rules"
        subtitle="Select a Preparation Chart on the left to configure how batch formulation quantities map into Stock Statement Entry particulars"
        actions={
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <Link href="/dashboard/stock/preparation-charts" className="btn btn-secondary btn-sm">
              ← Back to Preparation Charts
            </Link>
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={handleSaveAllMappings}
              disabled={saving}
              style={{ fontWeight: 700 }}
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
              boxShadow: '0 2px 6px rgba(0,0,0,0.04)',
            }}
          >
            <span>{toastMessage}</span>
            <button
              type="button"
              onClick={() => setToastMessage(null)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1rem', color: 'inherit' }}
            >
              ✕
            </button>
          </div>
        )}

        {/* ─── MASTER-DETAIL LAYOUT (LEFT SIDEBAR: PREPARATION CHARTS) ─────────── */}
        {loading ? (
          <div className="card" style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
            <span className="spinner" /> Loading preparation charts & mapping rules...
          </div>
        ) : (
          <MasterDetailLayout<ChartSidebarItem>
            items={chartSidebarItems}
            getItemKey={c => c.key}
            selectedKey={selectedChartKey}
            onSelectKey={key => setSelectedChartKey(key)}
            leftPanelTitle="Preparation Charts"
            leftPanelWidth={350}
            searchPlaceholder="🔍 Search chart name or variant..."
            filterPredicate={(c, q) =>
              c.name.toLowerCase().includes(q) ||
              c.product_variant.toLowerCase().includes(q) ||
              c.key.toLowerCase().includes(q)
            }
            emptyListMessage="No preparation charts found"
            emptyDetailMessage="Select a Preparation Chart on the left to view and configure its mapping rules"
            headerExtra={
              <button
                type="button"
                className="btn btn-primary btn-xs"
                onClick={() => handleOpenAddRuleModal()}
                style={{ fontSize: '0.75rem', padding: '3px 8px', background: '#0284c7', borderColor: '#0284c7' }}
                title="Create a new mapping rule"
              >
                ➕ Add Rule
              </button>
            }
            renderListItem={(chart, isSelected) => {
              const chartRules = mappings.filter(r => r.sourceChartKey === chart.key);
              const activeCount = chartRules.filter(r => r.enabled !== false).length;

              return (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {/* Top row: Name & Badge */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div
                      style={{
                        fontWeight: 800,
                        fontSize: '0.88rem',
                        color: isSelected ? 'var(--brand-primary)' : 'var(--text-primary)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                      }}
                    >
                      <span>{chart.isUniversal ? '⭐' : '🥛'}</span>
                      <span>{chart.name}</span>
                    </div>

                    <span
                      style={{
                        padding: '2px 7px',
                        borderRadius: 10,
                        fontSize: '0.68rem',
                        fontWeight: 700,
                        background: chartRules.length > 0 ? (activeCount > 0 ? '#dcfce7' : '#fef3c7') : '#f1f5f9',
                        color: chartRules.length > 0 ? (activeCount > 0 ? '#15803d' : '#b45309') : '#64748b',
                      }}
                    >
                      {chartRules.length} {chartRules.length === 1 ? 'Rule' : 'Rules'}
                    </span>
                  </div>

                  {/* Subtitle / Variant badge */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    <span>
                      Variant: <strong style={{ color: isSelected ? '#0369a1' : 'var(--text-secondary)' }}>{chart.product_variant}</strong>
                    </span>
                    {activeCount > 0 && (
                      <span style={{ fontSize: '0.68rem', color: '#16a34a', fontWeight: 600 }}>
                        ● {activeCount} Active
                      </span>
                    )}
                  </div>
                </div>
              );
            }}
            renderDetail={chart => {
              if (!chart) return null;

              const isUniversal = chart.key === '*';
              const chartRules = currentChartRules;
              const universalRulesCount = mappings.filter(r => r.sourceChartKey === '*').length;

              return (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  {/* ─── DETAIL HEADER BANNER ────────────────────────────────────────── */}
                  <div
                    className="card"
                    style={{
                      border: '1px solid var(--border)',
                      padding: '18px 24px',
                      background: 'linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%)',
                      borderRadius: 12,
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      flexWrap: 'wrap',
                      gap: 16,
                      boxShadow: '0 2px 6px rgba(0,0,0,0.03)',
                    }}
                  >
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                        <span style={{ fontSize: '1.4rem' }}>{isUniversal ? '⭐' : '🥛'}</span>
                        <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800, color: '#0369a1' }}>
                          {chart.name}
                        </h2>
                        <span
                          style={{
                            padding: '3px 10px',
                            borderRadius: 12,
                            fontSize: '0.75rem',
                            fontWeight: 700,
                            background: '#0284c7',
                            color: '#ffffff',
                          }}
                        >
                          {chart.product_variant}
                        </span>
                        <span
                          style={{
                            padding: '3px 10px',
                            borderRadius: 12,
                            fontSize: '0.75rem',
                            fontWeight: 700,
                            background: chartRules.length > 0 ? '#dcfce7' : '#f1f5f9',
                            color: chartRules.length > 0 ? '#15803d' : '#64748b',
                            border: chartRules.length > 0 ? '1px solid #86efac' : '1px solid #cbd5e1',
                          }}
                        >
                          {chartRules.length} Configured {chartRules.length === 1 ? 'Rule' : 'Rules'}
                        </span>
                      </div>
                      <div style={{ fontSize: '0.82rem', color: '#0c4a6e', marginTop: 4 }}>
                        {isUniversal
                          ? 'Global mapping rules applied universally across all preparation formulation charts.'
                          : `Stage 1 Preparation Chart key: <code>${chart.key}</code>. Configure how batch rows map to Stage 2 Stock Statement Entry.`}
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                      <button
                        type="button"
                        className="btn btn-primary btn-sm"
                        onClick={() => handleOpenAddRuleModal()}
                        style={{ background: '#0284c7', borderColor: '#0284c7', fontWeight: 700 }}
                      >
                        ➕ Add Mapping Rule
                      </button>
                      <button
                        type="button"
                        className="btn btn-primary btn-sm"
                        onClick={handleSaveAllMappings}
                        disabled={saving}
                        style={{ fontWeight: 700 }}
                      >
                        {saving ? 'Saving...' : '💾 Save to DB'}
                      </button>
                    </div>
                  </div>

                  {/* ─── QUICK-MAPPING HELPER: INGREDIENTS FROM FORMULATION TEMPLATE ─── */}
                  {!isUniversal && currentChartIngredients.length > 0 && (
                    <div
                      className="card"
                      style={{
                        padding: '16px 20px',
                        background: '#ffffff',
                        border: '1px solid var(--border)',
                        borderRadius: 12,
                        boxShadow: '0 1px 4px rgba(0,0,0,0.02)',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                        <div>
                          <div style={{ fontWeight: 800, fontSize: '0.9rem', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span>📋</span>
                            <span>Formulation Ingredients & Quick Mapping Status</span>
                          </div>
                          <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)', marginTop: 2 }}>
                            Ingredients found in this chart's template. Click "+ Map" on unmapped ingredients to quickly configure them.
                          </div>
                        </div>
                      </div>

                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                        {currentChartIngredients.map(ing => {
                          const matchingRule = chartRules.find(r => r.sourceVariant.toLowerCase() === ing.toLowerCase());
                          const isMapped = !!matchingRule;
                          const targetLabel = matchingRule ? (productOptions.find(p => p.key === matchingRule.targetProductKey)?.label || matchingRule.targetProductKey) : '';

                          return (
                            <div
                              key={`ing_chip_${ing}`}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 6,
                                padding: '6px 12px',
                                borderRadius: 8,
                                background: isMapped ? '#f0fdf4' : '#fffbeb',
                                border: isMapped ? '1px solid #86efac' : '1px solid #fde68a',
                                fontSize: '0.8rem',
                              }}
                            >
                              <span style={{ fontWeight: 700, color: isMapped ? '#166534' : '#92400e' }}>
                                {isMapped ? '✅' : '⚠️'} {ing}
                              </span>

                              {isMapped && matchingRule && (
                                <span style={{ fontSize: '0.72rem', color: '#15803d', fontWeight: 600 }}>
                                  ➔ {matchingRule.targetRowType === 'RECEIPT' ? 'Receipts' : 'Disposals'}: {matchingRule.targetRowLabel || 'Row'} ({targetLabel})
                                </span>
                              )}

                              {!isMapped && (
                                <button
                                  type="button"
                                  onClick={() => handleOpenAddRuleModal(ing)}
                                  style={{
                                    marginLeft: 4,
                                    padding: '2px 8px',
                                    borderRadius: 6,
                                    fontSize: '0.72rem',
                                    fontWeight: 700,
                                    background: '#fef3c7',
                                    border: '1px solid #d97706',
                                    color: '#b45309',
                                    cursor: 'pointer',
                                  }}
                                  title={`Create mapping rule for ${ing}`}
                                >
                                  + Map
                                </button>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* ─── RULES LIST / TABLE FOR SELECTED CHART ───────────────────────── */}
                  <div
                    className="card"
                    style={{
                      padding: 0,
                      background: '#ffffff',
                      border: '1px solid var(--border)',
                      borderRadius: 12,
                      overflow: 'hidden',
                      boxShadow: '0 2px 8px rgba(0,0,0,0.03)',
                    }}
                  >
                    <div
                      style={{
                        padding: '14px 20px',
                        background: '#f8fafc',
                        borderBottom: '1px solid var(--border)',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                      }}
                    >
                      <div style={{ fontWeight: 800, fontSize: '0.92rem', color: 'var(--text-primary)' }}>
                        Stage 1 ➔ Stage 2 Mapping Rules for {chart.name}
                      </div>
                      <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                        Showing <strong>{chartRules.length}</strong> rules
                      </div>
                    </div>

                    {chartRules.length === 0 ? (
                      <div style={{ padding: '50px 20px', textAlign: 'center', color: 'var(--text-muted)' }}>
                        <div style={{ fontSize: '2.5rem', marginBottom: 10 }}>🔀</div>
                        <div style={{ fontWeight: 700, fontSize: '1.05rem', color: 'var(--text-primary)', marginBottom: 6 }}>
                          No mapping rules configured for {chart.name}
                        </div>
                        <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', maxWidth: 480, margin: '0 auto 16px' }}>
                          Add mapping rules to connect batch quantities (such as SMP, White Butter, or finished milk) from this Preparation Chart into specific Stage 2 Stock Statement Entry particulars and product columns.
                        </div>
                        <button
                          type="button"
                          className="btn btn-primary btn-sm"
                          onClick={() => handleOpenAddRuleModal()}
                          style={{ background: '#0284c7', borderColor: '#0284c7', fontWeight: 700 }}
                        >
                          ➕ Create First Rule for {chart.name}
                        </button>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        {chartRules.map((rule, idx) => {
                          const targetLabel = productOptions.find(p => p.key === rule.targetProductKey)?.label || rule.targetProductKey;
                          const isReceipt = rule.targetRowType === 'RECEIPT';

                          return (
                            <div
                              key={rule.id}
                              style={{
                                padding: '16px 20px',
                                borderBottom: idx < chartRules.length - 1 ? '1px solid var(--border)' : 'none',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                gap: 16,
                                background: rule.enabled !== false ? '#ffffff' : '#fafafa',
                                transition: 'background 0.15s ease',
                              }}
                            >
                              {/* Left: Transformation Pipeline */}
                              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
                                {/* Rule description & active tag */}
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                                  <span style={{ fontWeight: 800, fontSize: '0.92rem', color: 'var(--text-primary)' }}>
                                    {rule.description || `${rule.sourceVariant} ➔ ${targetLabel}`}
                                  </span>
                                  <span
                                    style={{
                                      padding: '2px 8px',
                                      borderRadius: 10,
                                      fontSize: '0.68rem',
                                      fontWeight: 700,
                                      background: rule.enabled !== false ? '#dcfce7' : '#f1f5f9',
                                      color: rule.enabled !== false ? '#15803d' : '#64748b',
                                    }}
                                  >
                                    {rule.enabled !== false ? 'Active' : 'Disabled'}
                                  </span>
                                </div>

                                {/* Flow representation: Stage 1 -> Stage 2 */}
                                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginTop: 4 }}>
                                  {/* Stage 1 Source Chip */}
                                  <div
                                    style={{
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: 6,
                                      padding: '4px 10px',
                                      borderRadius: 6,
                                      background: '#f0f9ff',
                                      border: '1px solid #bae6fd',
                                      fontSize: '0.8rem',
                                      color: '#0369a1',
                                    }}
                                  >
                                    <span style={{ fontWeight: 800 }}>Stage 1:</span>
                                    <span>Variant: <strong>{rule.sourceVariant}</strong></span>
                                    <span>|</span>
                                    <span>Col: <code>{getColumnName(rule.sourceColKey)}</code></span>
                                  </div>

                                  <div style={{ color: '#0284c7', fontWeight: 800, fontSize: '1.1rem' }}>➔</div>

                                  {/* Stage 2 Target Chip */}
                                  <div
                                    style={{
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: 6,
                                      padding: '4px 10px',
                                      borderRadius: 6,
                                      background: isReceipt ? '#f0fdf4' : '#fff7ed',
                                      border: isReceipt ? '1px solid #86efac' : '1px solid #ffedd5',
                                      fontSize: '0.8rem',
                                      color: isReceipt ? '#15803d' : '#c2410c',
                                    }}
                                  >
                                    <span style={{ fontWeight: 800 }}>Stage 2:</span>
                                    <span
                                      style={{
                                        padding: '1px 6px',
                                        borderRadius: 4,
                                        fontSize: '0.7rem',
                                        fontWeight: 800,
                                        background: isReceipt ? '#dcfce7' : '#ffedd5',
                                        color: isReceipt ? '#166534' : '#9a3412',
                                      }}
                                    >
                                      {isReceipt ? 'RECEIPTS' : 'DISPOSALS'}
                                    </span>
                                    <span>Row: <strong>{rule.targetRowLabel || 'Row'}</strong></span>
                                    <span>|</span>
                                    <span>Product: <strong>{targetLabel}</strong></span>
                                  </div>
                                </div>
                              </div>

                              {/* Right: Actions */}
                              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                {/* Quick status toggle */}
                                <label
                                  style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 6,
                                    cursor: 'pointer',
                                    fontSize: '0.78rem',
                                    fontWeight: 700,
                                    color: rule.enabled !== false ? '#15803d' : '#64748b',
                                  }}
                                  title="Toggle rule active status"
                                >
                                  <input
                                    type="checkbox"
                                    checked={rule.enabled !== false}
                                    onChange={e => handleToggleRuleStatus(rule.id, e.target.checked)}
                                    style={{ cursor: 'pointer', width: 16, height: 16 }}
                                  />
                                  <span>{rule.enabled !== false ? 'Enabled' : 'Disabled'}</span>
                                </label>

                                <button
                                  type="button"
                                  className="btn btn-secondary btn-xs"
                                  onClick={() => handleOpenEditRuleModal(rule)}
                                  style={{ fontSize: '0.75rem', padding: '4px 8px' }}
                                  title="Edit Rule"
                                >
                                  ✏️ Edit
                                </button>

                                <button
                                  type="button"
                                  className="btn btn-secondary btn-xs"
                                  onClick={() => handleDeleteRule(rule.id)}
                                  style={{ fontSize: '0.75rem', padding: '4px 8px', color: '#dc2626', borderColor: '#fca5a5', background: '#fef2f2' }}
                                  title="Delete Rule"
                                >
                                  ✕
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* ─── INHERITED UNIVERSAL RULES BANNER (when viewing a specific chart) ─── */}
                  {!isUniversal && universalRulesCount > 0 && (
                    <div
                      style={{
                        padding: '12px 18px',
                        borderRadius: 10,
                        background: '#f8fafc',
                        border: '1px solid #e2e8f0',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        fontSize: '0.82rem',
                        color: 'var(--text-secondary)',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span>⭐</span>
                        <span>
                          This chart also inherits <strong>{universalRulesCount}</strong> universal rule(s) configured under &quot;All Preparation Charts&quot;.
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setSelectedChartKey('*')}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: 'var(--brand-primary)',
                          fontWeight: 700,
                          cursor: 'pointer',
                          fontSize: '0.8rem',
                          textDecoration: 'underline',
                        }}
                      >
                        View Universal Rules →
                      </button>
                    </div>
                  )}
                </div>
              );
            }}
          />
        )}
      </div>

      {/* ─── ADD / EDIT RULE MODAL ───────────────────────────────────────────── */}
      {isRuleModalOpen && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(15, 23, 42, 0.65)',
            backdropFilter: 'blur(3px)',
            zIndex: 1000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 20,
          }}
          onClick={() => setIsRuleModalOpen(false)}
        >
          <div
            className="card animate-scale-up"
            style={{
              width: '100%',
              maxWidth: 720,
              maxHeight: '90vh',
              overflowY: 'auto',
              background: '#ffffff',
              borderRadius: 14,
              border: '1px solid var(--border)',
              padding: 0,
              boxShadow: '0 20px 40px rgba(0, 0, 0, 0.2)',
            }}
            onClick={e => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div
              style={{
                padding: '16px 24px',
                background: 'linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%)',
                borderBottom: '1px solid var(--border)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div>
                <div style={{ fontWeight: 800, fontSize: '1.1rem', color: '#0369a1', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span>{editingRuleId ? '✏️ Edit Mapping Rule' : '➕ Add Mapping Rule'}</span>
                </div>
                <div style={{ fontSize: '0.8rem', color: '#0c4a6e', marginTop: 3 }}>
                  Map Stage 1 Preparation Chart batch quantities into Stage 2 Stock Statement Entry particulars
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsRuleModalOpen(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: '1.3rem',
                  color: '#64748b',
                  cursor: 'pointer',
                }}
              >
                ✕
              </button>
            </div>

            {/* Modal Body Form */}
            <form onSubmit={handleSaveModalRule} style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 18 }}>
              {/* Rule Name / Description with Auto-generate helper */}
              <div className="form-group" style={{ margin: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <label className="form-label" style={{ fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
                    Rule Name / Description *
                  </label>
                  <button
                    type="button"
                    onClick={handleAutoGenerateDesc}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: 'var(--brand-primary)',
                      fontSize: '0.75rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                      padding: 0,
                    }}
                  >
                    ⚡ Auto-generate
                  </button>
                </div>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. Delite Milk (SMP) ➔ Receipts: BMC's (DLT.Milk)"
                  value={formDescription}
                  onChange={e => setFormDescription(e.target.value)}
                  required
                  style={{ fontWeight: 600, fontSize: '0.9rem' }}
                />
              </div>

              {/* Side-by-Side: Stage 1 (Source) vs Stage 2 (Target) */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
                {/* ── STAGE 1 SOURCE ── */}
                <div style={{ background: '#f0f9ff', borderRadius: 10, border: '1px solid #bae6fd', padding: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <div style={{ fontWeight: 800, fontSize: '0.85rem', color: '#0369a1', textTransform: 'uppercase', letterSpacing: '0.04em', borderBottom: '1px solid #bae6fd', paddingBottom: 6 }}>
                    Stage 1: Source (Preparation Chart)
                  </div>

                  {/* Chart Selection */}
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label" style={{ fontWeight: 700, color: '#0c4a6e', fontSize: '0.82rem' }}>
                      Preparation Chart *
                    </label>
                    <select
                      className="form-select"
                      value={formSourceChartKey}
                      onChange={e => {
                        const val = e.target.value;
                        setFormSourceChartKey(val);
                        if (val !== '*') {
                          const m = masters.find(x => x.key === val);
                          if (m?.product_variant) setFormSourceVariant(m.product_variant);
                        }
                      }}
                    >
                      <option value="*">⭐ All Preparation Charts (*)</option>
                      {masters.map(m => (
                        <option key={m.key} value={m.key}>
                          {m.name} ({m.product_variant})
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Variant / Ingredient Selection */}
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label" style={{ fontWeight: 700, color: '#0c4a6e', fontSize: '0.82rem' }}>
                      Source Product Variant / Ingredient *
                    </label>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <select
                        className="form-select"
                        value={formSourceVariant}
                        onChange={e => setFormSourceVariant(e.target.value)}
                        style={{ flex: 1 }}
                      >
                        {modalAvailableVariants.map(v => (
                          <option key={`opt_${v}`} value={v}>
                            {v}
                          </option>
                        ))}
                        {formSourceVariant && !modalAvailableVariants.includes(formSourceVariant) && (
                          <option value={formSourceVariant}>{formSourceVariant} (Custom)</option>
                        )}
                      </select>
                    </div>
                    <div style={{ fontSize: '0.72rem', color: '#0284c7', marginTop: 4 }}>
                      Loaded from formulation chart ingredients and variants
                    </div>
                  </div>

                  {/* Source Column */}
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label" style={{ fontWeight: 700, color: '#0c4a6e', fontSize: '0.82rem' }}>
                      Source Quantity Column *
                    </label>
                    <select
                      className="form-select"
                      value={formSourceColKey}
                      onChange={e => setFormSourceColKey(e.target.value)}
                    >
                      {chartColumns.map(c => (
                        <option key={c.key} value={c.key}>
                          {c.name} ({c.key})
                        </option>
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
                  </div>
                </div>

                {/* ── STAGE 2 TARGET ── */}
                <div style={{ background: '#f0fdf4', borderRadius: 10, border: '1px solid #86efac', padding: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <div style={{ fontWeight: 800, fontSize: '0.85rem', color: '#15803d', textTransform: 'uppercase', letterSpacing: '0.04em', borderBottom: '1px solid #86efac', paddingBottom: 6 }}>
                    Stage 2: Target (Stock Statement Entry)
                  </div>

                  {/* Target Section: Receipts or Disposals */}
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label" style={{ fontWeight: 700, color: '#14532d', fontSize: '0.82rem' }}>
                      Target Stock Section *
                    </label>
                    <select
                      className="form-select"
                      value={formTargetRowType}
                      onChange={e => {
                        const val = e.target.value as 'RECEIPT' | 'DISPOSAL';
                        setFormTargetRowType(val);
                        const availableRows = val === 'DISPOSAL' ? dbDisposalRows : dbReceiptRows;
                        if (availableRows.length > 0) {
                          setFormTargetRowLabel(availableRows[0]);
                        }
                      }}
                    >
                      <option value="RECEIPT">📥 Receipts Section</option>
                      <option value="DISPOSAL">📤 Disposals Section</option>
                    </select>
                  </div>

                  {/* Particulars Row */}
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label" style={{ fontWeight: 700, color: '#14532d', fontSize: '0.82rem' }}>
                      Target Particulars Row *
                    </label>
                    <select
                      className="form-select"
                      value={formTargetRowLabel}
                      onChange={e => setFormTargetRowLabel(e.target.value)}
                    >
                      {(formTargetRowType === 'DISPOSAL' ? dbDisposalRows : dbReceiptRows).map(r => (
                        <option key={`row_${r}`} value={r}>
                          {r}
                        </option>
                      ))}
                    </select>
                    <div style={{ fontSize: '0.72rem', color: '#15803d', marginTop: 4 }}>
                      From Database <code>particulars_master</code> ({formTargetRowType})
                    </div>
                  </div>

                  {/* Target Product Column */}
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label" style={{ fontWeight: 700, color: '#14532d', fontSize: '0.82rem' }}>
                      Target Product Column *
                    </label>
                    <select
                      className="form-select"
                      value={formTargetProductKey}
                      onChange={e => setFormTargetProductKey(e.target.value)}
                    >
                      {productOptions.map(p => (
                        <option key={p.key} value={p.key}>
                          {p.label} ({p.key})
                        </option>
                      ))}
                    </select>
                    <div style={{ fontSize: '0.72rem', color: '#15803d', marginTop: 4 }}>
                      From Database <code>products_master</code>
                    </div>
                  </div>
                </div>
              </div>

              {/* Status Switch */}
              <div style={{ padding: '12px 16px', background: '#f8fafc', borderRadius: 8, border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: '0.88rem', color: 'var(--text-primary)' }}>Rule Status</div>
                  <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>
                    Active rules will automatically map batch quantities during Stock Statement Entry.
                  </div>
                </div>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontWeight: 700, fontSize: '0.88rem' }}>
                  <input
                    type="checkbox"
                    checked={formEnabled}
                    onChange={e => setFormEnabled(e.target.checked)}
                    style={{ width: 18, height: 18, cursor: 'pointer' }}
                  />
                  <span>{formEnabled ? 'Active' : 'Disabled'}</span>
                </label>
              </div>

              {/* Modal Footer Buttons */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 6 }}>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => setIsRuleModalOpen(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary btn-sm"
                  style={{ fontWeight: 700, background: '#0284c7', borderColor: '#0284c7' }}
                >
                  {editingRuleId ? '💾 Update Rule' : '➕ Add Rule'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
