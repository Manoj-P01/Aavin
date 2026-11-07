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

interface FormMappingRow {
  id: string;
  sourceVariant: string;
  sourceColKey: string;
  targetRowLabel: string;
  targetProductKey: string;
  enabled: boolean;
  description?: string;
}

export default function PrepToStockMappingsConfigPage() {
  const { confirm } = useConfirm();
  const [mappings, setMappings] = useState<PrepToStockMappingRule[]>([]);
  const [masters, setMasters] = useState<ChartMasterDef[]>([]);
  const [chartColumns, setChartColumns] = useState<ChartColumnDef[]>([]);
  const [templates, setTemplates] = useState<Record<string, any>>({});
  const [productOptions, setProductOptions] = useState<Array<{ key: string; label: string }>>([]);
  const [dbRawProducts, setDbRawProducts] = useState<any[]>([]);
  const [dbReceiptRows, setDbReceiptRows] = useState<string[]>([]);
  const [dbDisposalRows, setDbDisposalRows] = useState<string[]>([]);

  // Selected Chart on the left panel (chart key, e.g. 'delite_milk' or '*')
  const [selectedChartKey, setSelectedChartKey] = useState<string>('*');
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Modal State for Adding / Editing Mapping Rules
  const [isRuleModalOpen, setIsRuleModalOpen] = useState<boolean>(false);
  const [editingRuleId, setEditingRuleId] = useState<string | null>(null);

  // Form Master Scope (configured once at top)
  const [formSourceChartKey, setFormSourceChartKey] = useState<string>('*');
  const [formTargetRowType, setFormTargetRowType] = useState<'RECEIPT' | 'DISPOSAL'>('RECEIPT');

  // Multi-Row Mappings inside of this Scope
  const [formMappingRows, setFormMappingRows] = useState<FormMappingRow[]>([]);

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
            setDbRawProducts(prods);
            const opts = prods.map((p: any) => ({
              key: p.product_key || p.key || (p.short_name || p.product_name || p.full_name).toLowerCase().replace(/[^a-z0-9_]/g, '_'),
              label: p.short_name || p.product_name || p.full_name || p.key,
            }));
            setProductOptions(opts);
          } else {
            setDbRawProducts([]);
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

  // Extract ingredients for a given chart from templates & master dynamically without duplicate variant aliases
  const getChartIngredients = (chartKey: string): string[] => {
    const rawList: string[] = [];

    const addVariant = (val?: string) => {
      if (typeof val !== 'string') return;
      const trimmed = val.trim();
      if (!trimmed) return;
      const lower = trimmed.toLowerCase();
      if (['new ingredient', 'sample', 'diff', 'difference', 'total'].includes(lower)) return;
      rawList.push(trimmed);
    };

    if (chartKey && chartKey !== '*') {
      const m = masters.find(x => x.key === chartKey);
      if (m?.product_variant) addVariant(m.product_variant);

      const tmpl = templates[chartKey];
      if (tmpl && Array.isArray(tmpl.rows)) {
        tmpl.rows.forEach((r: any) => addVariant(r.variant));
      }
    } else {
      masters.forEach(m => {
        if (m.product_variant) addVariant(m.product_variant);
      });
      Object.values(templates).forEach((tmpl: any) => {
        if (tmpl && Array.isArray(tmpl.rows)) {
          tmpl.rows.forEach((r: any) => addVariant(r.variant));
        }
      });
    }

    // Canonicalization map: maps normalized strings (e.g. 'std', 'stdmilk') to one unified display name
    const canonicalMap = new Map<string, string>();

    // 1. Chart master product_variants take precedence
    masters.forEach(m => {
      if (m.product_variant && m.product_variant.trim()) {
        const pv = m.product_variant.trim();
        const normKey = pv.toLowerCase().replace(/[\s._-]/g, '');
        canonicalMap.set(normKey, pv);
        if (normKey === 'std' || normKey === 'stdmilk') {
          canonicalMap.set('std', pv);
          canonicalMap.set('stdmilk', pv);
        }
        if (normKey === 'dlt' || normKey === 'dltmilk' || normKey === 'delite') {
          canonicalMap.set('dlt', pv);
          canonicalMap.set('dltmilk', pv);
          canonicalMap.set('delite', pv);
        }
        if (normKey === 'fc' || normKey === 'fcm' || normKey === 'fcmilk') {
          canonicalMap.set('fc', pv);
          canonicalMap.set('fcm', pv);
          canonicalMap.set('fcmilk', pv);
        }
      }
    });

    // 2. Map database product names & short names
    dbRawProducts.forEach((p: any) => {
      const sName = (p.short_name || '').trim();
      const pName = (p.product_name || p.full_name || '').trim();
      const sNorm = sName.toLowerCase().replace(/[\s._-]/g, '');
      const pNorm = pName.toLowerCase().replace(/[\s._-]/g, '');
      const preferred = canonicalMap.get(sNorm) || canonicalMap.get(pNorm) || sName || pName;
      if (sNorm) canonicalMap.set(sNorm, preferred);
      if (pNorm) canonicalMap.set(pNorm, preferred);
    });

    // Deduplicate preserving unique ingredients
    const resultList: string[] = [];
    const seen = new Set<string>();

    rawList.forEach(v => {
      const normKey = v.toLowerCase().replace(/[\s._-]/g, '');
      const canonical = canonicalMap.get(normKey) || v;
      const seenKey = canonical.toLowerCase();
      if (!seen.has(seenKey)) {
        seen.add(seenKey);
        resultList.push(canonical);
      }
    });

    return resultList;
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
  }, [selectedChartKey, masters, templates, dbRawProducts]);

  // Available variants for the form modal based on formSourceChartKey
  const modalAvailableVariants = useMemo(() => {
    return getChartIngredients(formSourceChartKey);
  }, [formSourceChartKey, masters, templates, dbRawProducts]);

  // Helper to find closest product match for a variant
  const findBestProductMatch = (variant: string): string => {
    if (!variant || productOptions.length === 0) return productOptions[0]?.key || '';
    const vNorm = variant.toLowerCase().replace(/[\s._-]/g, '');
    const exact = productOptions.find(p => {
      const kNorm = p.key.toLowerCase().replace(/[\s._-]/g, '');
      const lNorm = p.label.toLowerCase().replace(/[\s._-]/g, '');
      return kNorm === vNorm || lNorm === vNorm;
    });
    if (exact) return exact.key;
    const partial = productOptions.find(p => {
      const kNorm = p.key.toLowerCase().replace(/[\s._-]/g, '');
      const lNorm = p.label.toLowerCase().replace(/[\s._-]/g, '');
      return kNorm.includes(vNorm) || vNorm.includes(kNorm) || lNorm.includes(vNorm) || vNorm.includes(lNorm);
    });
    return partial?.key || productOptions[0]?.key || '';
  };

  // Add a new row to formMappingRows
  const handleAddMappingRow = (prefillVariant?: string) => {
    const ingredients = getChartIngredients(formSourceChartKey);
    const chosenVariant = prefillVariant || (ingredients.length > 0 ? ingredients[0] : '');
    const defaultColKey = chartColumns.length > 0 ? (chartColumns.find(c => c.key === 'qty_lit')?.key || chartColumns[0].key) : 'qty_lit';
    const availableRows = formTargetRowType === 'DISPOSAL' ? dbDisposalRows : dbReceiptRows;
    const defaultRowLabel = availableRows.length > 0 ? availableRows[0] : '';
    const defaultProdKey = findBestProductMatch(chosenVariant);

    const newRow: FormMappingRow = {
      id: `row_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      sourceVariant: chosenVariant,
      sourceColKey: defaultColKey,
      targetRowLabel: defaultRowLabel,
      targetProductKey: defaultProdKey,
      enabled: true,
    };
    setFormMappingRows(prev => [...prev, newRow]);
  };

  // Duplicate an existing row in formMappingRows
  const handleDuplicateMappingRow = (id: string) => {
    const target = formMappingRows.find(r => r.id === id);
    if (!target) return;
    const cloned: FormMappingRow = {
      ...target,
      id: `row_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    };
    const idx = formMappingRows.findIndex(r => r.id === id);
    setFormMappingRows(prev => {
      const next = [...prev];
      next.splice(idx + 1, 0, cloned);
      return next;
    });
  };

  // Remove a row from formMappingRows
  const handleRemoveMappingRow = (id: string) => {
    if (formMappingRows.length <= 1) return;
    setFormMappingRows(prev => prev.filter(r => r.id !== id));
  };

  // Update a single property on a row
  const handleUpdateMappingRow = (id: string, updates: Partial<FormMappingRow>) => {
    setFormMappingRows(prev => prev.map(r => (r.id === id ? { ...r, ...updates } : r)));
  };

  // Auto-populate all chart ingredients into the mapping table
  const handleMapAllChartIngredients = () => {
    const ingredients = getChartIngredients(formSourceChartKey);
    if (ingredients.length === 0) {
      alert('No ingredients found for this preparation chart.');
      return;
    }

    const defaultColKey = chartColumns.length > 0 ? (chartColumns.find(c => c.key === 'qty_lit')?.key || chartColumns[0].key) : 'qty_lit';
    const availableRows = formTargetRowType === 'DISPOSAL' ? dbDisposalRows : dbReceiptRows;
    const defaultRowLabel = availableRows.length > 0 ? availableRows[0] : '';

    const newRows: FormMappingRow[] = ingredients.map((v, idx) => ({
      id: `row_all_${idx}_${Date.now()}`,
      sourceVariant: v,
      sourceColKey: defaultColKey,
      targetRowLabel: defaultRowLabel,
      targetProductKey: findBestProductMatch(v),
      enabled: true,
    }));

    setFormMappingRows(newRows);
  };

  // Handle switching source chart in modal
  const handleSourceChartChange = (newChartKey: string) => {
    setFormSourceChartKey(newChartKey);
    const newIngredients = getChartIngredients(newChartKey);
    const firstIngredient = newIngredients[0] || '';
    setFormMappingRows(prev =>
      prev.map(r => {
        const stillValid = newIngredients.some(
          v => v.toLowerCase().replace(/[\s._-]/g, '') === r.sourceVariant.toLowerCase().replace(/[\s._-]/g, '')
        );
        if (!stillValid && firstIngredient) {
          return {
            ...r,
            sourceVariant: firstIngredient,
            targetProductKey: findBestProductMatch(firstIngredient),
          };
        }
        return r;
      })
    );
  };

  // Handle switching target stock section in modal
  const handleTargetRowTypeChange = (newType: 'RECEIPT' | 'DISPOSAL') => {
    setFormTargetRowType(newType);
    const availableRows = newType === 'DISPOSAL' ? dbDisposalRows : dbReceiptRows;
    const defaultLabel = availableRows.length > 0 ? availableRows[0] : '';
    setFormMappingRows(prev =>
      prev.map(r => ({
        ...r,
        targetRowLabel: defaultLabel,
      }))
    );
  };

  // Open modal to create a new rule (or batch of rules)
  const handleOpenAddRuleModal = (prefillVariant?: string) => {
    const targetChartKey = selectedChartKey || '*';
    const chartIngredients = getChartIngredients(targetChartKey);
    const chosenVariant = prefillVariant || (chartIngredients.length > 0 ? chartIngredients[0] : '');

    const defaultProdKey = findBestProductMatch(chosenVariant);
    const defaultRowLabel = dbReceiptRows.length > 0 ? dbReceiptRows[0] : '';
    const defaultColKey = chartColumns.length > 0 ? (chartColumns.find(c => c.key === 'qty_lit')?.key || chartColumns[0].key) : 'qty_lit';

    setEditingRuleId(null);
    setFormSourceChartKey(targetChartKey);
    setFormTargetRowType('RECEIPT');

    setFormMappingRows([
      {
        id: `row_${Date.now()}`,
        sourceVariant: chosenVariant,
        sourceColKey: defaultColKey,
        targetRowLabel: defaultRowLabel,
        targetProductKey: defaultProdKey,
        enabled: true,
      },
    ]);

    setIsRuleModalOpen(true);
  };

  // Open modal to edit an existing rule
  const handleOpenEditRuleModal = (rule: PrepToStockMappingRule) => {
    setEditingRuleId(rule.id);
    setFormSourceChartKey(rule.sourceChartKey || '*');
    setFormTargetRowType(rule.targetRowType || 'RECEIPT');

    setFormMappingRows([
      {
        id: rule.id,
        sourceVariant: rule.sourceVariant || '',
        sourceColKey: rule.sourceColKey || 'qty_lit',
        targetRowLabel: rule.targetRowLabel || '',
        targetProductKey: rule.targetProductKey || '',
        enabled: rule.enabled !== false,
        description: rule.description || '',
      },
    ]);

    setIsRuleModalOpen(true);
  };

  // Save/Submit the rules in the modal
  const handleSaveModalRule = (e: React.FormEvent) => {
    e.preventDefault();

    if (formMappingRows.length === 0) {
      alert('Please configure at least one mapping row.');
      return;
    }

    for (let i = 0; i < formMappingRows.length; i++) {
      const row = formMappingRows[i];
      if (!row.sourceVariant.trim()) {
        alert(`Row #${i + 1}: Please select a Source Product Variant / Ingredient.`);
        return;
      }
      if (!row.targetRowLabel.trim()) {
        alert(`Row #${i + 1}: Please select a Target Particulars Row.`);
        return;
      }
      if (!row.targetProductKey.trim()) {
        alert(`Row #${i + 1}: Please select a Target Product Column.`);
        return;
      }
    }

    const chartTitle = masters.find(m => m.key === formSourceChartKey)?.name || (formSourceChartKey === '*' ? 'All Charts' : formSourceChartKey);
    const sectionName = formTargetRowType === 'RECEIPT' ? 'Receipts' : 'Disposals';

    if (editingRuleId) {
      // Single edit mode
      const primaryRow = formMappingRows[0];
      const prodLabel = productOptions.find(p => p.key === primaryRow.targetProductKey)?.label || primaryRow.targetProductKey;
      const primaryDesc = primaryRow.description?.trim() || `${chartTitle} (${primaryRow.sourceVariant}) [${primaryRow.sourceColKey}] ➔ ${sectionName}: ${primaryRow.targetRowLabel} (${prodLabel})`;

      const updatedRule: PrepToStockMappingRule = {
        id: editingRuleId,
        sourceChartKey: formSourceChartKey,
        sourceVariant: primaryRow.sourceVariant,
        sourceColKey: primaryRow.sourceColKey,
        targetRowType: formTargetRowType,
        targetRowLabel: primaryRow.targetRowLabel,
        targetProductKey: primaryRow.targetProductKey,
        enabled: primaryRow.enabled !== false,
        description: primaryDesc,
      };

      const extraRules: PrepToStockMappingRule[] = formMappingRows.slice(1).map((row, idx) => {
        const extraLabel = productOptions.find(p => p.key === row.targetProductKey)?.label || row.targetProductKey;
        return {
          id: `rule_${Date.now()}_${idx}_${Math.random().toString(36).substring(2, 6)}`,
          sourceChartKey: formSourceChartKey,
          sourceVariant: row.sourceVariant,
          sourceColKey: row.sourceColKey,
          targetRowType: formTargetRowType,
          targetRowLabel: row.targetRowLabel,
          targetProductKey: row.targetProductKey,
          enabled: row.enabled !== false,
          description: row.description?.trim() || `${chartTitle} (${row.sourceVariant}) [${row.sourceColKey}] ➔ ${sectionName}: ${row.targetRowLabel} (${extraLabel})`,
        };
      });

      setMappings(prev => [
        ...prev.map(r => (r.id === editingRuleId ? updatedRule : r)),
        ...extraRules,
      ]);
      showToast('✏️ Mapping rule updated in table! Remember to click "Save Rules to Database".');
    } else {
      // Multi-row add mode
      const newRules: PrepToStockMappingRule[] = formMappingRows.map((row, idx) => {
        const prodLabel = productOptions.find(p => p.key === row.targetProductKey)?.label || row.targetProductKey;
        return {
          id: `rule_${Date.now()}_${idx}_${Math.random().toString(36).substring(2, 6)}`,
          sourceChartKey: formSourceChartKey,
          sourceVariant: row.sourceVariant,
          sourceColKey: row.sourceColKey,
          targetRowType: formTargetRowType,
          targetRowLabel: row.targetRowLabel,
          targetProductKey: row.targetProductKey,
          enabled: row.enabled !== false,
          description: row.description?.trim() || `${chartTitle} (${row.sourceVariant}) [${row.sourceColKey}] ➔ ${sectionName}: ${row.targetRowLabel} (${prodLabel})`,
        };
      });

      setMappings(prev => [...prev, ...newRules]);
      showToast(`➕ Added ${newRules.length} mapping rule(s)! Remember to click "Save Rules to Database".`);
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
              maxWidth: 1060,
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
                  <span>{editingRuleId ? '✏️ Edit Mapping Rule' : '➕ Add Mapping Rules'}</span>
                </div>
                <div style={{ fontSize: '0.8rem', color: '#0c4a6e', marginTop: 3 }}>
                  Configure Stage 1 Preparation Chart batch quantities mapping into Stage 2 Stock Statement Entry particulars
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
            <form onSubmit={handleSaveModalRule} style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* ── 1. MASTER SCOPE (Configured ONCE at Top) ── */}
              <div
                style={{
                  background: 'linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%)',
                  borderRadius: 10,
                  border: '1px solid #bae6fd',
                  padding: '16px 20px',
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
                  gap: 16,
                  boxShadow: '0 2px 4px rgba(3, 105, 161, 0.04)',
                }}
              >
                {/* 1. Preparation Chart * */}
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label" style={{ fontWeight: 800, color: '#0369a1', fontSize: '0.84rem', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span>📋</span> Stage 1: Preparation Chart *
                  </label>
                  <select
                    className="form-select"
                    value={formSourceChartKey}
                    onChange={e => handleSourceChartChange(e.target.value)}
                    style={{ fontWeight: 700, borderColor: '#7dd3fc', background: '#ffffff', color: '#0369a1' }}
                  >
                    <option value="*">⭐ All Preparation Charts (*)</option>
                    {masters.map(m => (
                      <option key={m.key} value={m.key}>
                        {m.name} ({m.product_variant || 'DEFAULT'})
                      </option>
                    ))}
                  </select>
                  <div style={{ fontSize: '0.72rem', color: '#0369a1', marginTop: 3 }}>
                    Ingredients for this chart will be mapped below
                  </div>
                </div>

                {/* 2. Target Stock Section * */}
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label" style={{ fontWeight: 800, color: '#15803d', fontSize: '0.84rem', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span>📦</span> Stage 2: Target Stock Section *
                  </label>
                  <select
                    className="form-select"
                    value={formTargetRowType}
                    onChange={e => handleTargetRowTypeChange(e.target.value as 'RECEIPT' | 'DISPOSAL')}
                    style={{ fontWeight: 700, borderColor: '#86efac', background: '#ffffff', color: '#15803d' }}
                  >
                    <option value="RECEIPT">📥 Receipts Section</option>
                    <option value="DISPOSAL">📤 Disposals Section</option>
                  </select>
                  <div style={{ fontSize: '0.72rem', color: '#15803d', marginTop: 3 }}>
                    Particulars rows will load dynamically from <code>{formTargetRowType}</code>
                  </div>
                </div>
              </div>

              {/* ── 2. MAPPINGS CONTROL BAR ── */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
                <div>
                  <div style={{ fontWeight: 800, fontSize: '0.95rem', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span>🔀</span>
                    <span>Inside Mapping Rows ({formMappingRows.length})</span>
                  </div>
                  <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>
                    Map each source variant & column directly into target particulars rows & product columns
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  {!editingRuleId && (
                    <button
                      type="button"
                      onClick={handleMapAllChartIngredients}
                      className="btn btn-secondary btn-sm"
                      style={{
                        background: '#f0f9ff',
                        borderColor: '#bae6fd',
                        color: '#0369a1',
                        fontWeight: 700,
                        fontSize: '0.78rem',
                        padding: '4px 10px',
                      }}
                      title="Automatically create a mapping row for every ingredient available in this chart"
                    >
                      ⚡ Map All Chart Ingredients ({modalAvailableVariants.length})
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => handleAddMappingRow()}
                    className="btn btn-primary btn-sm"
                    style={{
                      background: '#0284c7',
                      borderColor: '#0284c7',
                      fontWeight: 700,
                      fontSize: '0.78rem',
                      padding: '4px 12px',
                    }}
                    title="Add another mapping row"
                  >
                    ➕ Add Row
                  </button>
                </div>
              </div>

              {/* ── 3. MAPPINGS TABLE ── */}
              <div
                style={{
                  border: '1px solid var(--border)',
                  borderRadius: 8,
                  overflowX: 'auto',
                  maxHeight: '420px',
                  background: '#ffffff',
                  boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.02)',
                }}
              >
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem', minWidth: 840 }}>
                  <thead style={{ background: '#f8fafc', borderBottom: '1px solid var(--border)', position: 'sticky', top: 0, zIndex: 2 }}>
                    <tr>
                      <th style={{ padding: '8px 10px', textAlign: 'center', width: 40, color: 'var(--text-secondary)' }}>#</th>
                      <th style={{ padding: '8px 10px', textAlign: 'left', minWidth: 200, color: 'var(--text-primary)' }}>
                        Source Product Variant / Ingredient *
                      </th>
                      <th style={{ padding: '8px 10px', textAlign: 'left', width: 150, color: 'var(--text-primary)' }}>
                        Source Quantity Column *
                      </th>
                      <th style={{ padding: '8px 10px', textAlign: 'left', minWidth: 200, color: 'var(--text-primary)' }}>
                        Target Particulars Row *
                      </th>
                      <th style={{ padding: '8px 10px', textAlign: 'left', minWidth: 170, color: 'var(--text-primary)' }}>
                        Target Product Column *
                      </th>
                      <th style={{ padding: '8px 10px', textAlign: 'center', width: 60, color: 'var(--text-primary)' }}>Active</th>
                      <th style={{ padding: '8px 10px', textAlign: 'center', width: 75, color: 'var(--text-primary)' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {formMappingRows.map((row, rIdx) => {
                      const availableParticulars = formTargetRowType === 'DISPOSAL' ? dbDisposalRows : dbReceiptRows;
                      return (
                        <tr
                          key={row.id}
                          style={{
                            borderBottom: '1px solid var(--border)',
                            background: rIdx % 2 === 0 ? '#ffffff' : '#fcfcfd',
                          }}
                        >
                          {/* # */}
                          <td style={{ textAlign: 'center', fontWeight: 700, color: 'var(--text-muted)' }}>
                            {rIdx + 1}
                          </td>

                          {/* Source Product Variant / Ingredient */}
                          <td style={{ padding: '6px 8px' }}>
                            <select
                              className="form-select"
                              value={row.sourceVariant}
                              onChange={e => {
                                const v = e.target.value;
                                handleUpdateMappingRow(row.id, {
                                  sourceVariant: v,
                                  targetProductKey: findBestProductMatch(v),
                                });
                              }}
                              style={{ fontSize: '0.8rem', padding: '4px 8px', fontWeight: 700, color: '#0369a1' }}
                              required
                            >
                              <option value="" disabled>-- Select Variant / Ingredient --</option>
                              {modalAvailableVariants.map(v => (
                                <option key={`opt_${row.id}_${v}`} value={v}>
                                  {v}
                                </option>
                              ))}
                              {row.sourceVariant &&
                                !modalAvailableVariants.some(
                                  v => v.toLowerCase().replace(/[\s._-]/g, '') === row.sourceVariant.toLowerCase().replace(/[\s._-]/g, '')
                                ) && (
                                <option value={row.sourceVariant}>{row.sourceVariant} (Custom)</option>
                              )}
                            </select>
                          </td>

                          {/* Source Quantity Column */}
                          <td style={{ padding: '6px 8px' }}>
                            <select
                              className="form-select"
                              value={row.sourceColKey}
                              onChange={e => handleUpdateMappingRow(row.id, { sourceColKey: e.target.value })}
                              style={{ fontSize: '0.8rem', padding: '4px 8px' }}
                              required
                            >
                              {chartColumns.map(c => (
                                <option key={`col_${row.id}_${c.key}`} value={c.key}>
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
                          </td>

                          {/* Target Particulars Row */}
                          <td style={{ padding: '6px 8px' }}>
                            <select
                              className="form-select"
                              value={row.targetRowLabel}
                              onChange={e => handleUpdateMappingRow(row.id, { targetRowLabel: e.target.value })}
                              style={{ fontSize: '0.8rem', padding: '4px 8px', fontWeight: 600 }}
                              required
                            >
                              {availableParticulars.map(r => (
                                <option key={`row_${row.id}_${r}`} value={r}>
                                  {r}
                                </option>
                              ))}
                              {row.targetRowLabel && !availableParticulars.includes(row.targetRowLabel) && (
                                <option value={row.targetRowLabel}>{row.targetRowLabel}</option>
                              )}
                            </select>
                          </td>

                          {/* Target Product Column */}
                          <td style={{ padding: '6px 8px' }}>
                            <select
                              className="form-select"
                              value={row.targetProductKey}
                              onChange={e => handleUpdateMappingRow(row.id, { targetProductKey: e.target.value })}
                              style={{ fontSize: '0.8rem', padding: '4px 8px', fontWeight: 600 }}
                              required
                            >
                              {productOptions.map(p => (
                                <option key={`prod_${row.id}_${p.key}`} value={p.key}>
                                  {p.label} ({p.key})
                                </option>
                              ))}
                            </select>
                          </td>

                          {/* Status Active */}
                          <td style={{ padding: '6px 8px', textAlign: 'center' }}>
                            <input
                              type="checkbox"
                              checked={row.enabled !== false}
                              onChange={e => handleUpdateMappingRow(row.id, { enabled: e.target.checked })}
                              title={row.enabled !== false ? 'Active' : 'Disabled'}
                              style={{ width: 16, height: 16, cursor: 'pointer' }}
                            />
                          </td>

                          {/* Actions */}
                          <td style={{ padding: '6px 8px', textAlign: 'center' }}>
                            <div style={{ display: 'flex', gap: 4, justifyContent: 'center' }}>
                              <button
                                type="button"
                                onClick={() => handleDuplicateMappingRow(row.id)}
                                className="btn btn-secondary btn-xs"
                                style={{ padding: '2px 6px', fontSize: '0.72rem' }}
                                title="Duplicate this row"
                              >
                                📋
                              </button>
                              <button
                                type="button"
                                onClick={() => handleRemoveMappingRow(row.id)}
                                disabled={formMappingRows.length <= 1}
                                className="btn btn-secondary btn-xs"
                                style={{
                                  padding: '2px 6px',
                                  fontSize: '0.72rem',
                                  color: formMappingRows.length <= 1 ? '#cbd5e1' : '#dc2626',
                                  cursor: formMappingRows.length <= 1 ? 'not-allowed' : 'pointer',
                                }}
                                title="Remove this row"
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

              {/* Bottom helper: Add another row & counts */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <button
                  type="button"
                  onClick={() => handleAddMappingRow()}
                  className="btn btn-secondary btn-xs"
                  style={{ fontWeight: 700, color: '#0369a1', background: '#f0f9ff', borderColor: '#bae6fd' }}
                >
                  ➕ Add Another Mapping Row
                </button>

                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                  Total Rows: <strong>{formMappingRows.length}</strong>
                </div>
              </div>

              {/* Modal Footer Buttons */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  borderTop: '1px solid var(--border)',
                  paddingTop: 14,
                  marginTop: 4,
                  flexWrap: 'wrap',
                  gap: 10,
                }}
              >
                <div style={{ fontSize: '0.8rem', color: '#0369a1' }}>
                  Target: <strong>{masters.find(m => m.key === formSourceChartKey)?.name || (formSourceChartKey === '*' ? 'All Charts' : formSourceChartKey)}</strong> ➔ <strong>{formTargetRowType === 'RECEIPT' ? 'Receipts' : 'Disposals'}</strong>
                </div>

                <div style={{ display: 'flex', gap: 10 }}>
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
                    style={{ fontWeight: 700, background: '#0284c7', borderColor: '#0284c7', minWidth: 140 }}
                  >
                    {editingRuleId ? '💾 Update Rule' : `➕ Add ${formMappingRows.length} Rule(s)`}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
