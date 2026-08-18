// ─────────────────────────────────────────────────────────────────────────────
// Aavin Dashboard – Statement Mapping Configuration Page
// Supports:
// 1. Internal Stock Mappings (Disposals ➔ Receipts auto-calculation rules e.g. Disposals "To DLT Milk" row total ➔ Receipts "DLT.Milk")
// 2. Cross-Statement Mappings (Stock Statement Entry ⇄ Solid Balance / STG Entry)
// ─────────────────────────────────────────────────────────────────────────────

'use client';

import { useState, useEffect } from 'react';
import Header from '@/components/layout/Header';
import Link from 'next/link';

// ─── Interfaces ───────────────────────────────────────────────────────────────

export interface InternalStockMappingRule {
  id: string;
  sourceDisposalParticular: string;  // e.g. 'To DLT Milk' or 'To Separation'
  targetReceiptProductKey?: string;   // e.g. 'dlt_milk'
  targetReceiptProductLabel?: string; // e.g. 'DLT.Milk'
  partitions?: Array<{
    targetReceiptProductKey: string;
    targetReceiptProductLabel: string;
    value?: string | number;
  }>;
  enabled: boolean;
}

export interface MappingRule {
  id: string;
  stockProductKey: string;
  stockProductLabel: string;
  stockSection: 'OB' | 'RECEIPT' | 'DISPOSAL';
  stockParticular: string;
  stgBlockKey: string;
  stgBlockLabel: string;
  stgSection: 'OB' | 'RECEIPT' | 'DISPOSAL' | 'CB';
  stgItemName: string;
  stgTargetField: 'qty_lts' | 'qty_kg' | 'fat_pct' | 'snf_pct' | 'kg_fat' | 'kg_snf';
}



const DEFAULT_MAPPINGS: MappingRule[] = [
  {
    id: 'map_wm_ob',
    stockProductKey: 'wh_milk',
    stockProductLabel: 'WH.Milk',
    stockSection: 'OB',
    stockParticular: 'Opening Balance',
    stgBlockKey: 'WM',
    stgBlockLabel: 'TENTATIVE WHOLE MILK - RECEIPT AND DISPOSAL STATEMENT',
    stgSection: 'OB',
    stgItemName: 'OB',
    stgTargetField: 'qty_lts',
  },
  {
    id: 'map_wm_receipts',
    stockProductKey: 'wh_milk',
    stockProductLabel: 'WH.Milk',
    stockSection: 'RECEIPT',
    stockParticular: 'Receipts:',
    stgBlockKey: 'WM',
    stgBlockLabel: 'TENTATIVE WHOLE MILK - RECEIPT AND DISPOSAL STATEMENT',
    stgSection: 'RECEIPT',
    stgItemName: 'Receipt',
    stgTargetField: 'qty_lts',
  },
  {
    id: 'map_wm_disposals_dlt',
    stockProductKey: 'wh_milk',
    stockProductLabel: 'WH.Milk',
    stockSection: 'DISPOSAL',
    stockParticular: 'To DLT Milk',
    stgBlockKey: 'WM',
    stgBlockLabel: 'TENTATIVE WHOLE MILK - RECEIPT AND DISPOSAL STATEMENT',
    stgSection: 'DISPOSAL',
    stgItemName: 'To DLT Milk',
    stgTargetField: 'qty_lts',
  },
  {
    id: 'map_wm_disposals_fc',
    stockProductKey: 'wh_milk',
    stockProductLabel: 'WH.Milk',
    stockSection: 'DISPOSAL',
    stockParticular: 'To FC Milk',
    stgBlockKey: 'WM',
    stgBlockLabel: 'TENTATIVE WHOLE MILK - RECEIPT AND DISPOSAL STATEMENT',
    stgSection: 'DISPOSAL',
    stgItemName: 'To FC Milk',
    stgTargetField: 'qty_lts',
  },
  {
    id: 'map_wm_disposals_std',
    stockProductKey: 'wh_milk',
    stockProductLabel: 'WH.Milk',
    stockSection: 'DISPOSAL',
    stockParticular: 'To STD Milk',
    stgBlockKey: 'WM',
    stgBlockLabel: 'TENTATIVE WHOLE MILK - RECEIPT AND DISPOSAL STATEMENT',
    stgSection: 'DISPOSAL',
    stgItemName: 'To STD Milk',
    stgTargetField: 'qty_lts',
  },
  {
    id: 'map_wm_disposals_mkt',
    stockProductKey: 'wh_milk',
    stockProductLabel: 'WH.Milk',
    stockSection: 'DISPOSAL',
    stockParticular: 'To MKT',
    stgBlockKey: 'WM',
    stgBlockLabel: 'TENTATIVE WHOLE MILK - RECEIPT AND DISPOSAL STATEMENT',
    stgSection: 'DISPOSAL',
    stgItemName: 'To MKT',
    stgTargetField: 'qty_lts',
  },
  {
    id: 'map_ssm_ob',
    stockProductKey: 'skim_milk',
    stockProductLabel: 'Skim Milk',
    stockSection: 'OB',
    stockParticular: 'Opening Balance',
    stgBlockKey: 'SSM',
    stgBlockLabel: 'SKIM MILK STATEMENT',
    stgSection: 'OB',
    stgItemName: 'OB',
    stgTargetField: 'qty_lts',
  },
  {
    id: 'map_ssm_receipts',
    stockProductKey: 'skim_milk',
    stockProductLabel: 'Skim Milk',
    stockSection: 'RECEIPT',
    stockParticular: 'Receipts:',
    stgBlockKey: 'SSM',
    stgBlockLabel: 'SKIM MILK STATEMENT',
    stgSection: 'RECEIPT',
    stgItemName: 'Receipt',
    stgTargetField: 'qty_lts',
  },
  {
    id: 'map_cream_ob',
    stockProductKey: 'cream',
    stockProductLabel: 'Cream',
    stockSection: 'OB',
    stockParticular: 'Opening Balance',
    stgBlockKey: 'CREAM',
    stgBlockLabel: 'CREAM STATEMENT',
    stgSection: 'OB',
    stgItemName: 'OB',
    stgTargetField: 'qty_kg',
  },
  {
    id: 'map_smp_ob',
    stockProductKey: 'smp',
    stockProductLabel: 'SMP',
    stockSection: 'OB',
    stockParticular: 'Opening Balance',
    stgBlockKey: 'SMP',
    stgBlockLabel: 'SMP STATEMENT',
    stgSection: 'OB',
    stgItemName: 'OB',
    stgTargetField: 'qty_kg',
  },
];

export default function StatementMappingConfigPage() {
  const [activeTab, setActiveTab] = useState<'INTERNAL' | 'STG'>('INTERNAL');

  // Internal Mappings State (Disposals ➔ Receipts)
  const [internalRules, setInternalRules] = useState<InternalStockMappingRule[]>([]);
  const [isInternalEditing, setIsInternalEditing] = useState<boolean>(false);
  const [internalEditingId, setInternalEditingId] = useState<string | null>(null);
  const [formSourceParticular, setFormSourceParticular] = useState<string>('To DLT Milk');
  const [formTargetReceiptKey, setFormTargetReceiptKey] = useState<string>('dlt_milk');

  // STG Mappings State
  const [mappings, setMappings] = useState<MappingRule[]>([]);
  const [filterProduct, setFilterProduct] = useState<string>('ALL');

  // Global Config Lists
  const [stockProducts, setStockProducts] = useState<Array<{ key: string; label: string }>>([
    { key: 'wh_milk', label: 'WH.Milk' },
    { key: 'dlt_milk', label: 'DLT.Milk' },
    { key: 'fc_milk', label: 'FC. Milk' },
    { key: 'std_milk', label: 'STD.Milk' },
    { key: 'toned_curd', label: 'Toned Milk CURD' },
    { key: 'dtm', label: 'DTM' },
    { key: 'skim_milk', label: 'Skim Milk' },
    { key: 'cream', label: 'Cream' },
    { key: 'butter_milk', label: 'Butter Milk' },
    { key: 'r_con', label: 'R.Con' },
    { key: 'smp', label: 'SMP' },
    { key: 'water', label: 'Water' },
  ]);
  const [stgStatements, setStgStatements] = useState<Array<{ key: string; label: string }>>([
    { key: 'WM', label: 'TENTATIVE WHOLE MILK - RECEIPT AND DISPOSAL STATEMENT' },
    { key: 'SSM', label: 'SKIM MILK STATEMENT' },
    { key: 'CREAM', label: 'CREAM STATEMENT' },
    { key: 'SMP', label: 'SMP STATEMENT' },
  ]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // STG Form modal state
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formStockProductKey, setFormStockProductKey] = useState<string>('wh_milk');
  const [formStockSection, setFormStockSection] = useState<'OB' | 'RECEIPT' | 'DISPOSAL'>('OB');
  const [formStockParticular, setFormStockParticular] = useState<string>('Opening Balance');
  const [formStgBlockKey, setFormStgBlockKey] = useState<string>('WM');
  const [formStgSection, setFormStgSection] = useState<'OB' | 'RECEIPT' | 'DISPOSAL' | 'CB'>('OB');
  const [formStgItemName, setFormStgItemName] = useState<string>('OB');
  const [formStgTargetField, setFormStgTargetField] = useState<'qty_lts' | 'qty_kg' | 'fat_pct' | 'snf_pct' | 'kg_fat' | 'kg_snf'>('qty_lts');

  // Load configuration on mount
  useEffect(() => {
    let active = true;
    async function loadData() {
      setLoading(true);
      setError('');
      try {
        // 1. Load stock products config
        const stockConfigRes = await fetch('/api/entries?report_type=STOCK');
        if (stockConfigRes.ok) {
          const json = await stockConfigRes.json();
          const entries: any[] = json.data || [];
          const entry = entries.find((e: any) => {
            if (!e.notes || e.notes.includes('__METADATA__:')) return false;
            try {
              const parsed = JSON.parse(e.notes);
              return parsed && typeof parsed === 'object' && !Array.isArray(parsed);
            } catch { return false; }
          });
          if (entry && entry.notes) {
            try {
              const parsed = JSON.parse(entry.notes);
              if (parsed.products && Array.isArray(parsed.products)) setStockProducts(parsed.products);
            } catch (e) {
              console.error('Failed parsing stock products config:', e);
            }
          }
        }

        // 2. Load STG statements config
        const stgConfigRes = await fetch('/api/entries?report_type=TS');
        if (stgConfigRes.ok) {
          const json = await stgConfigRes.json();
          const entries: any[] = json.data || [];
          const entry = entries.find((e: any) => {
            if (!e.notes || e.notes.includes('__METADATA__:')) return false;
            try {
              const parsed = JSON.parse(e.notes);
              return Array.isArray(parsed) && (parsed.length === 0 || parsed[0]?.key !== undefined);
            } catch { return false; }
          });
          if (entry && entry.notes) {
            try {
              const list = JSON.parse(entry.notes);
              if (Array.isArray(list) && list.length > 0) setStgStatements(list);
            } catch (e) {
              console.error('Failed parsing STG statements config:', e);
            }
          }
        }

        // 3. Load Internal Stock Mappings (Disposals ➔ Receipts)
        const internalRes = await fetch('/api/entries?report_type=INTERNAL_STOCK_MAPPING');
        if (internalRes.ok) {
          const json = await internalRes.json();
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
                if (active) setInternalRules(savedList);
              }
            } catch (e) {
              console.error('Failed parsing internal mappings:', e);
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
              if (Array.isArray(savedList) && savedList.length > 0) {
                if (active) setMappings(savedList);
              } else if (active) {
                setMappings(DEFAULT_MAPPINGS);
              }
            } catch (e) {
              console.error('Failed parsing saved mappings:', e);
              if (active) setMappings(DEFAULT_MAPPINGS);
            }
          } else if (active) {
            setMappings(DEFAULT_MAPPINGS);
          }
        } else if (active) {
          setMappings(DEFAULT_MAPPINGS);
        }
      } catch (err) {
        console.error('Error loading mapping configuration:', err);
        if (active) {
          setError('Failed to load mapping rules.');
        }
      } finally {
        if (active) setLoading(false);
      }
    }
    loadData();
    return () => { active = false; };
  }, []);

  // Save Internal Stock Mappings to API
  const saveInternalToApi = async (listToSave: InternalStockMappingRule[], alertSuccess: boolean = false) => {
    setSaving(true);
    setError('');
    try {
      const res = await fetch('/api/entries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          report_type: 'INTERNAL_STOCK_MAPPING',
          notes: JSON.stringify(listToSave),
        }),
      });

      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.error || 'Failed to save Disposals ➔ Receipts mappings.');
      }

      setSuccess('Disposals ➔ Receipts mapping saved successfully!');
      if (alertSuccess) window.alert('Disposals ➔ Receipts mapping saved successfully!');
      setTimeout(() => setSuccess(''), 4000);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

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
        throw new Error(json.error || 'Failed to save statement mapping configuration.');
      }

      setSuccess('Statement Mapping configuration saved successfully!');
      if (alertSuccess) window.alert('Statement Mapping configuration saved successfully!');
      setTimeout(() => setSuccess(''), 4000);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  // ─── Internal Mapping Helpers (Disposals ➔ Receipts) ─────────────────────────

  const openNewInternalForm = () => {
    setInternalEditingId(null);
    setFormSourceParticular('To DLT Milk');
    setFormTargetReceiptKey(stockProducts[1]?.key || 'dlt_milk');
    setIsInternalEditing(true);
  };

  const openEditInternalForm = (rule: InternalStockMappingRule) => {
    setInternalEditingId(rule.id);
    setFormSourceParticular(rule.sourceDisposalParticular);
    setFormTargetReceiptKey(rule.targetReceiptProductKey || 'dlt_milk');
    setIsInternalEditing(true);
  };

  const handleInternalFormSave = (e: React.FormEvent) => {
    e.preventDefault();
    const targetProd = stockProducts.find(p => p.key === formTargetReceiptKey);
    const targetLabel = targetProd ? targetProd.label : formTargetReceiptKey;

    let updated: InternalStockMappingRule[];
    if (internalEditingId) {
      updated = internalRules.map(r => {
        if (r.id === internalEditingId) {
          return {
            ...r,
            sourceDisposalParticular: formSourceParticular.trim() || 'To DLT Milk',
            targetReceiptProductKey: formTargetReceiptKey,
            targetReceiptProductLabel: targetLabel,
          };
        }
        return r;
      });
    } else {
      const newRule: InternalStockMappingRule = {
        id: 'imap_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
        sourceDisposalParticular: formSourceParticular.trim() || 'To DLT Milk',
        targetReceiptProductKey: formTargetReceiptKey,
        targetReceiptProductLabel: targetLabel,
        enabled: true,
      };
      updated = [...internalRules, newRule];
    }

    setInternalRules(updated);
    setIsInternalEditing(false);
    saveInternalToApi(updated);
  };

  const toggleInternalRuleEnabled = (id: string) => {
    const updated = internalRules.map(r => r.id === id ? { ...r, enabled: !r.enabled } : r);
    setInternalRules(updated);
    saveInternalToApi(updated);
  };

  const deleteInternalRule = (id: string) => {
    if (!window.confirm('Delete this mapping rule?')) return;
    const updated = internalRules.filter(r => r.id !== id);
    setInternalRules(updated);
    saveInternalToApi(updated);
  };



  // ─── STG Mapping Helpers ──────────────────────────────────────────────────

  const openNewStgForm = () => {
    setEditingId(null);
    setFormStockProductKey(stockProducts[0]?.key || 'wh_milk');
    setFormStockSection('OB');
    setFormStockParticular('Opening Balance');
    setFormStgBlockKey(stgStatements[0]?.key || 'WM');
    setFormStgSection('OB');
    setFormStgItemName('OB');
    setFormStgTargetField('qty_lts');
    setIsEditing(true);
  };

  const openEditStgForm = (rule: MappingRule) => {
    setEditingId(rule.id);
    setFormStockProductKey(rule.stockProductKey);
    setFormStockSection(rule.stockSection);
    setFormStockParticular(rule.stockParticular);
    setFormStgBlockKey(rule.stgBlockKey);
    setFormStgSection(rule.stgSection);
    setFormStgItemName(rule.stgItemName);
    setFormStgTargetField(rule.stgTargetField);
    setIsEditing(true);
  };

  const handleStgFormSave = (e: React.FormEvent) => {
    e.preventDefault();
    const selectedProduct = stockProducts.find(p => p.key === formStockProductKey);
    const selectedStgBlock = stgStatements.find(s => s.key === formStgBlockKey);

    const productLabel = selectedProduct ? selectedProduct.label : formStockProductKey;
    const stgLabel = selectedStgBlock ? selectedStgBlock.label : formStgBlockKey;

    let updated: MappingRule[];
    if (editingId) {
      updated = mappings.map(r => {
        if (r.id === editingId) {
          return {
            id: editingId,
            stockProductKey: formStockProductKey,
            stockProductLabel: productLabel,
            stockSection: formStockSection,
            stockParticular: formStockParticular.trim() || 'Particular',
            stgBlockKey: formStgBlockKey,
            stgBlockLabel: stgLabel,
            stgSection: formStgSection,
            stgItemName: formStgItemName.trim() || 'Item',
            stgTargetField: formStgTargetField,
          };
        }
        return r;
      });
    } else {
      const newRule: MappingRule = {
        id: 'map_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
        stockProductKey: formStockProductKey,
        stockProductLabel: productLabel,
        stockSection: formStockSection,
        stockParticular: formStockParticular.trim() || 'Particular',
        stgBlockKey: formStgBlockKey,
        stgBlockLabel: stgLabel,
        stgSection: formStgSection,
        stgItemName: formStgItemName.trim() || 'Item',
        stgTargetField: formStgTargetField,
      };
      updated = [...mappings, newRule];
    }
    setMappings(updated);
    setIsEditing(false);
    saveStgToApi(updated);
  };

  const deleteStgRule = (id: string) => {
    if (!window.confirm('Delete this mapping rule?')) return;
    const updated = mappings.filter(r => r.id !== id);
    setMappings(updated);
    saveStgToApi(updated);
  };

  const handleResetStgDefault = () => {
    if (!window.confirm('Reset STG statement mappings to default standard configurations?')) return;
    setMappings(DEFAULT_MAPPINGS);
    saveStgToApi(DEFAULT_MAPPINGS, true);
  };

  const filteredStgMappings = filterProduct === 'ALL'
    ? mappings
    : mappings.filter(m => m.stockProductKey === filterProduct || m.stgBlockKey === filterProduct);

  return (
    <>
      <Header
        title="Stock Statement Mapping Configuration"
        subtitle="Configure auto-calculation rules between Disposals & Receipts and STG Statements"
        actions={
          <div style={{ display: 'flex', gap: 8 }}>
            <Link href="/dashboard/stock/new" className="btn btn-primary btn-sm">
              ➕ New Stock Entry
            </Link>
            <Link href="/dashboard/stock" className="btn btn-secondary btn-sm">
              ← Back to Register
            </Link>
          </div>
        }
      />

      <div className="page-body animate-fade-in" style={{ maxWidth: 1150 }}>
        {error && <div className="alert alert-error">⚠️ {error}</div>}
        {success && <div className="alert alert-success">✅ {success}</div>}

        {/* Navigation Tabs */}
        <div style={{ display: 'flex', gap: 12, marginBottom: 20, borderBottom: '1px solid var(--border)', paddingBottom: 8 }}>
          <button
            type="button"
            className={`btn ${activeTab === 'INTERNAL' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setActiveTab('INTERNAL')}
            style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}
          >
            <span>🔄 Disposals ➔ Receipts Mappings</span>
            <span style={{ background: activeTab === 'INTERNAL' ? 'rgba(255,255,255,0.25)' : 'var(--border)', padding: '2px 8px', borderRadius: 12, fontSize: '0.75rem' }}>
              {internalRules.length}
            </span>
          </button>

          <button
            type="button"
            className={`btn ${activeTab === 'STG' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setActiveTab('STG')}
            style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}
          >
            <span>🔗 Stock Statement ⇄ STG Entry Mappings</span>
            <span style={{ background: activeTab === 'STG' ? 'rgba(255,255,255,0.25)' : 'var(--border)', padding: '2px 8px', borderRadius: 12, fontSize: '0.75rem' }}>
              {mappings.length}
            </span>
          </button>
        </div>

        {/* ════════════════════════════════════════════════════════════════════ */}
        {/* TAB 1: DISPOSALS ➔ RECEIPTS INTERNAL MAPPINGS                       */}
        {/* ════════════════════════════════════════════════════════════════════ */}
        {activeTab === 'INTERNAL' && (
          <div>
            {/* Description Card */}
            <div
              className="card"
              style={{
                marginBottom: 20,
                background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.08) 0%, rgba(16, 185, 129, 0.06) 100%)',
                borderColor: 'rgba(245, 158, 11, 0.3)',
              }}
            >
              <div style={{ fontWeight: 700, fontSize: '1.05rem', color: '#d97706', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
                <span>🥛 Disposals ➔ Receipts Auto-Calculation Rules</span>
              </div>
              <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                <div>
                  • In <strong>New Stock Statement Entry</strong>, the total value of row of <strong>Disposals</strong> (e.g. <code>To DLT Milk</code>) will automatically show as the value in <strong>Receipts</strong> of <code>DLT.Milk</code>.
                </div>
                <div style={{ marginTop: 6, fontWeight: 600, color: 'var(--brand-primary)' }}>
                  Sample mapping rules can be loaded or customized below.
                </div>
              </div>
            </div>

            {/* Action Bar */}
            <div className="card" style={{ marginBottom: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
                <div style={{ fontWeight: 600, fontSize: '0.95rem' }}>
                  Configured Auto-Fill Mappings ({internalRules.length})
                </div>

                <div style={{ display: 'flex', gap: 10 }}>
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    onClick={openNewInternalForm}
                    disabled={loading || saving}
                  >
                    ➕ Add Disposals ➔ Receipts Rule
                  </button>
                </div>
              </div>
            </div>

            {/* Inline Form */}
            {isInternalEditing && (
              <div
                className="card animate-fade-in"
                style={{
                  marginBottom: 24,
                  border: '2px solid #f59e0b',
                  background: '#fffbeb',
                }}
              >
                <div style={{ fontWeight: 700, fontSize: '1rem', color: '#b45309', marginBottom: 16 }}>
                  {internalEditingId ? '✏️ Edit Disposals ➔ Receipts Mapping Rule' : '➕ Add Disposals ➔ Receipts Mapping Rule'}
                </div>
                <form onSubmit={handleInternalFormSave} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
                    {/* Source Disposals Side */}
                    <div style={{ background: '#fff', padding: 16, borderRadius: 8, border: '1px solid var(--border)' }}>
                      <div style={{ fontWeight: 700, color: '#f59e0b', marginBottom: 12, fontSize: '0.9rem' }}>
                        📥 Source: Disposals Row (Total Value)
                      </div>
                      <div>
                        <label className="form-label" style={{ fontSize: '0.78rem', marginBottom: 4 }}>
                          Disposals Row Particular Label *
                        </label>
                        <select
                          className="form-select"
                          value={formSourceParticular}
                          onChange={e => setFormSourceParticular(e.target.value)}
                          style={{ width: '100%' }}
                        >
                          {[
                            'To DLT Milk',
                            'To FC Milk',
                            'To STD Milk',
                            'To MKT',
                            'To R.CON Milk',
                            'To Separation',
                            'To HMST',
                            'To Convension',
                            'To Khoa',
                            'To Curd',
                            'To CUP Curd',
                            'To Lab Sampling',
                            'To other Dairies',
                          ].map(dRow => (
                            <option key={dRow} value={dRow}>
                              Disposals Row: {dRow}
                            </option>
                          ))}
                        </select>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 4 }}>
                          Select the Disposals row whose total value will be calculated.
                        </div>
                      </div>
                    </div>

                    {/* Target Receipts Side */}
                    <div style={{ background: '#fff', padding: 16, borderRadius: 8, border: '1px solid var(--border)' }}>
                      <div style={{ fontWeight: 700, color: '#10b981', marginBottom: 12, fontSize: '0.9rem' }}>
                        📤 Target: Receipts Product Column
                      </div>
                      <div>
                        <label className="form-label" style={{ fontSize: '0.78rem', marginBottom: 4 }}>
                          Target Receipt Product Column *
                        </label>
                        <select
                          className="form-select"
                          value={formTargetReceiptKey}
                          onChange={e => setFormTargetReceiptKey(e.target.value)}
                          style={{ width: '100%' }}
                        >
                          {stockProducts.map(p => (
                            <option key={p.key} value={p.key}>
                              {p.label} ({p.key})
                            </option>
                          ))}
                        </select>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 4 }}>
                          Receipt value of this product will show the Disposals row total.
                        </div>
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 8 }}>
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={() => setIsInternalEditing(false)}
                    >
                      Cancel
                    </button>
                    <button type="submit" className="btn btn-primary btn-sm" style={{ background: '#f59e0b', borderColor: '#d97706' }}>
                      {internalEditingId ? '💾 Update Rule' : '➕ Save Rule'}
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* Internal Mappings Table */}
            <div className="card">
              {loading ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 40 }}>
                  <span className="spinner" /> Loading mapping rules...
                </div>
              ) : internalRules.length === 0 ? (
                <div className="empty-state" style={{ padding: 40, textAlign: 'center' }}>
                  <div style={{ fontSize: '2.5rem', marginBottom: 12 }}>🔄</div>
                  <div style={{ fontWeight: 600, fontSize: '1.1rem', marginBottom: 6 }}>
                    No Disposals ➔ Receipts mapping rules configured yet
                  </div>
                  <div style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginBottom: 16 }}>
                    Click "Add Disposals ➔ Receipts Rule" to create a mapping rule.
                  </div>
                  <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
                    <button type="button" className="btn btn-primary btn-sm" onClick={openNewInternalForm}>
                      ➕ Add Rule
                    </button>
                  </div>
                </div>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table className="data-table" style={{ width: '100%' }}>
                    <thead>
                      <tr>
                        <th style={{ width: 40 }}>#</th>
                        <th style={{ textAlign: 'left', minWidth: 280 }}>
                          📥 Disposals Source (Row Total Value)
                        </th>
                        <th style={{ width: 40, textAlign: 'center' }}>➔</th>
                        <th style={{ textAlign: 'left', minWidth: 280 }}>
                          📤 Receipts Target (Auto-Populates Value)
                        </th>
                        <th style={{ width: 90, textAlign: 'center' }}>Status</th>
                        <th style={{ width: 120, textAlign: 'center' }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {internalRules.map((rule, idx) => (
                        <tr key={rule.id} style={{ opacity: rule.enabled !== false ? 1 : 0.6 }}>
                          <td style={{ fontWeight: 600, color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                            {idx + 1}
                          </td>

                          {/* Source Disposals */}
                          <td>
                            <div style={{ fontWeight: 700, fontSize: '0.875rem', color: '#d97706' }}>
                              Disposals Row: "{rule.sourceDisposalParticular}"
                            </div>
                          </td>

                          {/* Arrow */}
                          <td style={{ textAlign: 'center', fontSize: '1.2rem', color: '#f59e0b', fontWeight: 700 }}>
                            ➔
                          </td>

                          {/* Target Receipts */}
                          <td>
                            {Array.isArray(rule.partitions) && rule.partitions.length > 0 ? (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                                {rule.partitions.map((p, pIdx) => (
                                  <div key={pIdx} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                    <span style={{ background: '#d1fae5', color: '#065f46', fontWeight: 700, padding: '2px 8px', borderRadius: 4, fontSize: '0.82rem' }}>
                                      Receipts: {p.targetReceiptProductLabel || p.targetReceiptProductKey}
                                    </span>
                                    {p.value !== undefined && p.value !== '' && (
                                      <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#059669', fontFamily: 'var(--font-numbers)' }}>
                                        ({Number(p.value).toLocaleString('en-IN')})
                                      </span>
                                    )}
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <span style={{ background: '#d1fae5', color: '#065f46', fontWeight: 700, padding: '2px 8px', borderRadius: 4, fontSize: '0.85rem' }}>
                                  Receipts: {rule.targetReceiptProductLabel || rule.targetReceiptProductKey}
                                </span>
                                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                  ({rule.targetReceiptProductKey})
                                </span>
                              </div>
                            )}
                          </td>

                          {/* Enabled Toggle */}
                          <td style={{ textAlign: 'center' }}>
                            <button
                              type="button"
                              className={`btn btn-sm ${rule.enabled !== false ? 'btn-success' : 'btn-secondary'}`}
                              onClick={() => toggleInternalRuleEnabled(rule.id)}
                              style={{ padding: '2px 8px', fontSize: '0.72rem', borderRadius: 12 }}
                            >
                              {rule.enabled !== false ? 'Active' : 'Disabled'}
                            </button>
                          </td>

                          {/* Actions */}
                          <td style={{ textAlign: 'center' }}>
                            <div style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
                              <button
                                type="button"
                                className="btn btn-ghost btn-sm"
                                style={{ padding: '4px 8px', fontSize: '0.75rem', color: 'var(--brand-primary)' }}
                                onClick={() => openEditInternalForm(rule)}
                              >
                                ✏️ Edit
                              </button>
                              <button
                                type="button"
                                className="btn btn-ghost btn-sm"
                                style={{ padding: '4px 8px', fontSize: '0.75rem', color: '#ef4444' }}
                                onClick={() => deleteInternalRule(rule.id)}
                              >
                                ❌
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ════════════════════════════════════════════════════════════════════ */}
        {/* TAB 2: STOCK STATEMENT ⇄ STG ENTRY MAPPINGS                          */}
        {/* ════════════════════════════════════════════════════════════════════ */}
        {activeTab === 'STG' && (
          <div>
            {/* Explanation Card */}
            <div
              className="card"
              style={{
                marginBottom: 20,
                background: 'linear-gradient(135deg, rgba(14, 165, 233, 0.08) 0%, rgba(99, 102, 241, 0.05) 100%)',
                borderColor: 'rgba(14, 165, 233, 0.25)',
              }}
            >
              <div style={{ fontWeight: 700, fontSize: '1.05rem', color: 'var(--brand-primary)', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
                <span>🔗 Stock Statement Entry ⇄ Solid Balance (STG) Entry Mapping Rules</span>
              </div>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                <div>
                  • <strong>New Stock Statement Entry</strong>: Products are represented as columns (e.g. <code>WH.Milk</code>, <code>Skim Milk</code>, <code>Cream</code>), with sections for <code>Opening Balance</code>, <code>Receipts</code>, and <code>Disposals</code>.
                </div>
                <div>
                  • <strong>New Solid Balance (STG) Entry</strong>: Products are individual statement blocks (e.g. <code>TENTATIVE WHOLE MILK STATEMENT</code>), with row particulars for <code>OB</code>, <code>Receipts</code>, <code>Disposals</code>, and <code>CB</code>.
                </div>
              </div>
            </div>

            {/* Controls & Filter */}
            <div className="card" style={{ marginBottom: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <label className="form-label" style={{ margin: 0, fontWeight: 600 }}>
                    Filter by Product / Block:
                  </label>
                  <select
                    className="form-select"
                    style={{ minWidth: 220, padding: '6px 12px' }}
                    value={filterProduct}
                    onChange={e => setFilterProduct(e.target.value)}
                  >
                    <option value="ALL">All Products & Statements ({mappings.length})</option>
                    <optgroup label="Stock Product Columns">
                      {stockProducts.map(p => (
                        <option key={p.key} value={p.key}>
                          Stock Column: {p.label}
                        </option>
                      ))}
                    </optgroup>
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
                    className="btn btn-secondary btn-sm"
                    onClick={handleResetStgDefault}
                    disabled={loading || saving}
                  >
                    🔄 Reset Default Mappings
                  </button>
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
                <div style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--brand-primary)', marginBottom: 16 }}>
                  {editingId ? '✏️ Edit STG Mapping Rule' : '➕ Add New STG Statement Mapping Rule'}
                </div>
                <form onSubmit={handleStgFormSave} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
                    {/* Stock Side */}
                    <div style={{ background: '#fff', padding: 16, borderRadius: 8, border: '1px solid var(--border)' }}>
                      <div style={{ fontWeight: 700, color: '#0284c7', marginBottom: 12, fontSize: '0.9rem' }}>
                        📦 Stock Statement Source
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
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
                          <label className="form-label" style={{ fontSize: '0.75rem', marginBottom: 4 }}>Stock Statement Section</label>
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
                          <label className="form-label" style={{ fontSize: '0.75rem', marginBottom: 4 }}>Stock Row Particular Label</label>
                          <input
                            type="text"
                            className="form-input"
                            value={formStockParticular}
                            onChange={e => setFormStockParticular(e.target.value)}
                            placeholder="e.g. Opening Balance, Receipts:, To DLT Milk..."
                            style={{ width: '100%' }}
                            required
                          />
                        </div>
                      </div>
                    </div>

                    {/* STG Side */}
                    <div style={{ background: '#fff', padding: 16, borderRadius: 8, border: '1px solid var(--border)' }}>
                      <div style={{ fontWeight: 700, color: '#10b981', marginBottom: 12, fontSize: '0.9rem' }}>
                        ⚖️ Solid Balance (STG) Target
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                        <div>
                          <label className="form-label" style={{ fontSize: '0.75rem', marginBottom: 4 }}>STG Statement Block</label>
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
                          <label className="form-label" style={{ fontSize: '0.75rem', marginBottom: 4 }}>STG Section</label>
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
                            <label className="form-label" style={{ fontSize: '0.75rem', marginBottom: 4 }}>STG Item Name</label>
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
                  <span className="spinner" /> Loading statement mapping rules...
                </div>
              ) : filteredStgMappings.length === 0 ? (
                <div className="empty-state" style={{ padding: 40, textAlign: 'center' }}>
                  <div style={{ fontSize: '2.5rem', marginBottom: 12 }}>🔗</div>
                  <div style={{ fontWeight: 600, fontSize: '1.1rem', marginBottom: 6 }}>
                    No STG mapping rules match filter
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
                        <th style={{ textAlign: 'left', minWidth: 260 }}>
                          📦 Stock Statement Entry (Source)
                        </th>
                        <th style={{ width: 40, textAlign: 'center' }}>⇄</th>
                        <th style={{ textAlign: 'left', minWidth: 320 }}>
                          ⚖️ Solid Balance (STG) Entry (Target)
                        </th>
                        <th style={{ width: 100, textAlign: 'center' }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredStgMappings.map((m, idx) => {
                        const sectionBadgeColor =
                          m.stockSection === 'OB' ? '#0284c7' : m.stockSection === 'RECEIPT' ? '#10b981' : '#f59e0b';

                        return (
                          <tr key={m.id}>
                            <td style={{ fontWeight: 600, color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                              {idx + 1}
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

                                <span
                                  style={{
                                    fontSize: '0.7rem',
                                    fontWeight: 700,
                                    color: '#fff',
                                    background: sectionBadgeColor,
                                    padding: '2px 6px',
                                    borderRadius: 4,
                                    textTransform: 'uppercase',
                                  }}
                                >
                                  {m.stockSection}
                                </span>

                                <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                                  "{m.stockParticular}"
                                </span>
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
                                    Field: {m.stgTargetField === 'qty_lts' ? 'Qty (Lts)' : m.stgTargetField === 'qty_kg' ? 'Qty (Kg)' : m.stgTargetField}
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
                                  ❌
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
        )}
      </div>
    </>
  );
}
