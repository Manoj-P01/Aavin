// ─────────────────────────────────────────────────────────────────────────────
// Aavin Dashboard – Statement Mapping Configuration Page
// Configures cross-field mappings between Stock Statement Entry and Solid Balance (STG) Entry
// ─────────────────────────────────────────────────────────────────────────────

'use client';

import { useState, useEffect } from 'react';
import Header from '@/components/layout/Header';
import Link from 'next/link';

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
  const [mappings, setMappings] = useState<MappingRule[]>([]);
  const [stockProducts, setStockProducts] = useState<Array<{ key: string; label: string }>>([
    { key: 'wh_milk', label: 'WH.Milk' },
    { key: 'dlt_milk', label: 'DLT Milk' },
    { key: 'fc_milk', label: 'FC Milk' },
    { key: 'std_milk', label: 'STD Milk' },
    { key: 'toned_curd', label: 'Toned Curd' },
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
  const [receiptRows, setReceiptRows] = useState<string[]>(['Receipts:']);
  const [disposalRows, setDisposalRows] = useState<string[]>([
    'To DLT Milk',
    'To FC Milk',
    'To STD Milk',
    'To MKT',
  ]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [filterProduct, setFilterProduct] = useState<string>('ALL');

  // Form modal/drawer state for adding/editing a mapping rule
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
              if (parsed.receipt_rows && Array.isArray(parsed.receipt_rows)) setReceiptRows(parsed.receipt_rows);
              if (parsed.disposal_rows && Array.isArray(parsed.disposal_rows)) setDisposalRows(parsed.disposal_rows);
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

        // 3. Load saved Statement Mappings
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
          setMappings(DEFAULT_MAPPINGS);
        }
      } finally {
        if (active) setLoading(false);
      }
    }
    loadData();
    return () => { active = false; };
  }, []);

  const saveConfigToApi = async (listToSave: MappingRule[], alertSuccess: boolean = false) => {
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

  const openNewForm = () => {
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

  const openEditForm = (rule: MappingRule) => {
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

  const handleFormSave = (e: React.FormEvent) => {
    e.preventDefault();

    const selectedProduct = stockProducts.find(p => p.key === formStockProductKey);
    const selectedStgBlock = stgStatements.find(s => s.key === formStgBlockKey);

    const productLabel = selectedProduct ? selectedProduct.label : formStockProductKey;
    const stgLabel = selectedStgBlock ? selectedStgBlock.label : formStgBlockKey;

    let updated: MappingRule[];
    if (editingId) {
      // Edit existing
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
      // Add new
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
    saveConfigToApi(updated);
  };

  const deleteRule = (id: string) => {
    const ok = window.confirm('Are you sure you want to delete this mapping rule?');
    if (!ok) return;
    const updated = mappings.filter(r => r.id !== id);
    setMappings(updated);
    saveConfigToApi(updated);
  };

  const handleResetDefault = () => {
    const ok = window.confirm('Reset all statement mappings to default standard configurations?');
    if (!ok) return;
    setMappings(DEFAULT_MAPPINGS);
    saveConfigToApi(DEFAULT_MAPPINGS, true);
  };

  const handleSaveConfig = async () => {
    await saveConfigToApi(mappings, true);
  };

  const filteredMappings = filterProduct === 'ALL'
    ? mappings
    : mappings.filter(m => m.stockProductKey === filterProduct || m.stgBlockKey === filterProduct);

  return (
    <>
      <Header
        title="Statement Mapping Configuration"
        subtitle="Configure field mappings between Stock Statement Entry and Solid Balance (STG) Entry"
        actions={
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={handleResetDefault}
              disabled={loading || saving}
            >
              🔄 Reset Default Mappings
            </button>
            <Link href="/dashboard/stock" className="btn btn-secondary btn-sm">
              ← Back to Register
            </Link>
          </div>
        }
      />

      <div className="page-body animate-fade-in" style={{ maxWidth: 1100 }}>
        {error && <div className="alert alert-error">⚠️ {error}</div>}
        {success && <div className="alert alert-success">✅ {success}</div>}

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
              • <strong>New Stock Statement Entry</strong>: Products are represented as columns (e.g., <code>WH.Milk</code>, <code>Skim Milk</code>, <code>Cream</code>), with sections for <code>Opening Balance</code>, <code>Receipts</code>, and <code>Disposals</code>.
            </div>
            <div>
              • <strong>New Solid Balance (STG) Entry</strong>: Products are individual statement blocks (e.g., <code>TENTATIVE WHOLE MILK - RECEIPT AND DISPOSAL STATEMENT</code>), with row particulars for <code>OB</code>, <code>Receipts</code>, <code>Disposals</code>, and <code>CB</code>.
            </div>
            <div style={{ marginTop: 4, fontWeight: 600, color: 'var(--brand-primary)' }}>
              Configure below how row particulars & columns in Stock Entry map to STG Statement blocks, sections, and item fields.
            </div>
          </div>
        </div>

        {/* Mapping Controls & Filter */}
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

            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={openNewForm}
              disabled={loading || saving}
              style={{ padding: '8px 16px' }}
            >
              ➕ Add New Mapping Rule
            </button>
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
              {editingId ? '✏️ Edit Mapping Rule' : '➕ Add New Statement Mapping Rule'}
            </div>
            <form onSubmit={handleFormSave} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
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
                          else if (sec === 'RECEIPT') setFormStockParticular(receiptRows[0] || 'Receipts:');
                          else setFormStockParticular(disposalRows[0] || 'To DLT Milk');
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
          ) : filteredMappings.length === 0 ? (
            <div className="empty-state" style={{ padding: 40, textAlign: 'center' }}>
              <div style={{ fontSize: '2.5rem', marginBottom: 12 }}>🔗</div>
              <div style={{ fontWeight: 600, fontSize: '1.1rem', marginBottom: 6 }}>
                No mapping rules match filter
              </div>
              <div style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginBottom: 16 }}>
                Click "Add New Mapping Rule" above to create a rule or reset to defaults.
              </div>
              <button type="button" className="btn btn-primary btn-sm" onClick={openNewForm}>
                ➕ Add First Mapping Rule
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
                  {filteredMappings.map((m, idx) => {
                    const sectionBadgeColor =
                      m.stockSection === 'OB' ? '#0284c7' : m.stockSection === 'RECEIPT' ? '#10b981' : '#f59e0b';

                    return (
                      <tr key={m.id}>
                        <td style={{ fontWeight: 600, color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                          {idx + 1}
                        </td>

                        {/* Stock Side */}
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

                        {/* Arrow */}
                        <td style={{ textAlign: 'center', fontSize: '1.2rem', color: 'var(--brand-primary)' }}>
                          ➔
                        </td>

                        {/* STG Side */}
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

                        {/* Actions */}
                        <td style={{ textAlign: 'center' }}>
                          <div style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
                            <button
                              type="button"
                              className="btn btn-ghost btn-sm"
                              style={{ padding: '4px 8px', fontSize: '0.75rem', color: 'var(--brand-primary)' }}
                              onClick={() => openEditForm(m)}
                              title="Edit Mapping"
                            >
                              ✏️ Edit
                            </button>
                            <button
                              type="button"
                              className="btn btn-ghost btn-sm"
                              style={{ padding: '4px 8px', fontSize: '0.75rem', color: '#ef4444' }}
                              onClick={() => deleteRule(m.id)}
                              title="Delete Mapping"
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

        {/* Global Save Button */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 24 }}>
          <button
            type="button"
            className="btn btn-primary"
            onClick={handleSaveConfig}
            disabled={loading || saving}
            style={{ padding: '12px 32px', fontSize: '1rem', fontWeight: 600 }}
          >
            {saving ? 'Saving Mappings...' : '💾 Save Configurations'}
          </button>
        </div>
      </div>
    </>
  );
}
