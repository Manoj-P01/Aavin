// ─────────────────────────────────────────────────────────────────────────────
// Aavin Dashboard – Stock Statement ⇄ STG Entry Mapping Configuration Page
// Dedicated configuration page in Daily Reports for mapping Stock Statement ⇄ STG Entry
// ─────────────────────────────────────────────────────────────────────────────

'use client';

import { useState, useEffect } from 'react';
import Header from '@/components/layout/Header';
import Link from 'next/link';
import { useConfirm } from '@/context/ConfirmContext';
import { buildStgStatementsFromProducts } from '@/lib/calculations';

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

export default function STGStatementMappingPage() {
  const [mappings, setMappings] = useState<MappingRule[]>([]);
  const [filterProduct, setFilterProduct] = useState<string>('ALL');

  const [stockProducts, setStockProducts] = useState<Array<{ key: string; label: string }>>([]);
  const [receiptRows, setReceiptRows] = useState<Array<{ full_name: string; short_name: string }>>([]);
  const [disposalRows, setDisposalRows] = useState<Array<{ full_name: string; short_name: string }>>([]);
  const [stgStatements, setStgStatements] = useState<Array<{ key: string; label: string }>>([
    { key: 'WM', label: 'WHOLE MILK - RECEIPT AND DISPOSAL STATEMENT' },
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

  const { confirm } = useConfirm();

  // Load configuration on mount
  useEffect(() => {
    let active = true;
    async function loadData() {
      setLoading(true);
      setError('');
      try {
        // 1. Load stock products config from database
        let loadedProductsFromDb: any[] = [];
        const stockConfigRes = await fetch('/api/stock/config');
        if (stockConfigRes.ok) {
          const stockCfg = await stockConfigRes.json();
          if (Array.isArray(stockCfg.products) && stockCfg.products.length > 0) {
            loadedProductsFromDb = stockCfg.products;
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

        // 2. Load STG statements config from DB
        let hasCustomStgConfig = false;
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
              if (Array.isArray(list) && list.length > 0) {
                if (active) setStgStatements(list);
                hasCustomStgConfig = true;
              }
            } catch (e) {
              console.error('Failed parsing STG statements config:', e);
            }
          }
        }

        if (!hasCustomStgConfig && loadedProductsFromDb.length > 0) {
          const dynamicStgList = buildStgStatementsFromProducts(loadedProductsFromDb);
          if (dynamicStgList.length > 0 && active) {
            setStgStatements(dynamicStgList);
          }
        }

        // 3. Load STG Statement Mappings
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
                setMappings([]);
              }
            } catch (e) {
              console.error('Failed parsing saved mappings:', e);
              if (active) setMappings([]);
            }
          } else if (active) {
            setMappings([]);
          }
        } else if (active) {
          setMappings([]);
        }
      } catch (err) {
        console.error('Error loading STG mapping configuration:', err);
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

      setSuccess('STG Statement Mapping configuration saved successfully!');
      setTimeout(() => setSuccess(''), 4000);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const ALL_RECEIPT_PARTICULARS = [
    'Receipts:',
    'From MDU-SSM',
    'From SNR-SSM',
    'From Erode-SSM',
    'From CBE-SSM',
    'From AMBATTUR-SSM',
    'From DCPP-SSM',
    'From Tiruppur-SSM',
    'From Salem-SSM',
    'From Other Dairies',
    'R.CON',
  ];

  const ALL_DISPOSAL_PARTICULARS = [
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
  ];

  // ─── STG Mapping Helpers & Unmapped Particulars ────────────────────────────

  const candidateStockParticulars = formStockSection === 'OB'
    ? ['Opening Balance']
    : formStockSection === 'RECEIPT'
    ? (receiptRows.length > 0 ? receiptRows.map(r => r.full_name) : ALL_RECEIPT_PARTICULARS)
    : (disposalRows.length > 0 ? disposalRows.map(r => r.full_name) : ALL_DISPOSAL_PARTICULARS);

  const mappedStockParticulars = new Set(
    mappings
      .filter(r => r.id !== editingId && r.stockProductKey === formStockProductKey && r.stockSection === formStockSection)
      .map(r => (r.stockParticular || '').trim().toLowerCase())
  );

  const availableStockParticulars = candidateStockParticulars.filter(
    p => !mappedStockParticulars.has(p.trim().toLowerCase())
  );

  const selectableStockParticulars = (editingId && formStockParticular)
    ? Array.from(new Set([formStockParticular, ...availableStockParticulars]))
    : availableStockParticulars;

  const ALL_STG_FIELDS: Array<{ key: 'qty_lts' | 'qty_kg' | 'fat_pct' | 'snf_pct' | 'kg_fat' | 'kg_snf'; label: string }> = [
    { key: 'qty_lts', label: 'Qty (Lts)' },
    { key: 'qty_kg', label: 'Qty (Kg)' },
    { key: 'fat_pct', label: 'Fat %' },
    { key: 'snf_pct', label: 'SNF %' },
    { key: 'kg_fat', label: 'Kg Fat' },
    { key: 'kg_snf', label: 'Kg SNF' },
  ];

  const mappedStgTargetFields = new Set(
    mappings
      .filter(
        r => r.id !== editingId &&
             r.stgBlockKey === formStgBlockKey &&
             r.stgSection === formStgSection &&
             r.stgItemName.trim().toLowerCase() === formStgItemName.trim().toLowerCase()
      )
      .map(r => r.stgTargetField)
  );

  const availableStgTargetFields = ALL_STG_FIELDS.filter(
    f => !mappedStgTargetFields.has(f.key) || f.key === formStgTargetField
  );

  const openNewStgForm = () => {
    setEditingId(null);
    setError('');

    let initialProd = stockProducts[0]?.key || 'wh_milk';
    let initialSection: 'OB' | 'RECEIPT' | 'DISPOSAL' = 'OB';
    let initialParticular = 'Opening Balance';

    const obMapped = mappings.some(r => r.stockProductKey === initialProd && r.stockSection === 'OB');
    if (obMapped) {
      const recCandidates = receiptRows.length > 0 ? receiptRows.map(r => r.full_name) : ALL_RECEIPT_PARTICULARS;
      const recMapped = new Set(mappings.filter(r => r.stockProductKey === initialProd && r.stockSection === 'RECEIPT').map(r => (r.stockParticular || '').trim().toLowerCase()));
      const availRec = recCandidates.filter(p => !recMapped.has(p.trim().toLowerCase()));

      if (availRec.length > 0) {
        initialSection = 'RECEIPT';
        initialParticular = availRec[0];
      } else {
        const dispCandidates = disposalRows.length > 0 ? disposalRows.map(r => r.full_name) : ALL_DISPOSAL_PARTICULARS;
        const dispMapped = new Set(mappings.filter(r => r.stockProductKey === initialProd && r.stockSection === 'DISPOSAL').map(r => (r.stockParticular || '').trim().toLowerCase()));
        const availDisp = dispCandidates.filter(p => !dispMapped.has(p.trim().toLowerCase()));

        if (availDisp.length > 0) {
          initialSection = 'DISPOSAL';
          initialParticular = availDisp[0];
        }
      }
    }

    setFormStockProductKey(initialProd);
    setFormStockSection(initialSection);
    setFormStockParticular(initialParticular);
    setFormStgBlockKey(stgStatements[0]?.key || 'WM');
    setFormStgSection(initialSection === 'OB' ? 'OB' : initialSection === 'RECEIPT' ? 'RECEIPT' : 'DISPOSAL');
    setFormStgItemName(initialSection === 'OB' ? 'OB' : initialSection === 'RECEIPT' ? 'Receipt' : 'Disposal');
    setFormStgTargetField('qty_lts');
    setIsEditing(true);
  };

  const openEditStgForm = (rule: MappingRule) => {
    setEditingId(rule.id);
    setError('');
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
    setError('');

    const targetParticular = formStockParticular.trim() || 'Particular';

    // Duplicate checks
    const isParticularAlreadyMapped = mappings.some(
      r => r.id !== editingId &&
           r.stockProductKey === formStockProductKey &&
           r.stockSection === formStockSection &&
           r.stockParticular.trim().toLowerCase() === targetParticular.toLowerCase()
    );

    if (isParticularAlreadyMapped) {
      setError(`⚠️ The row particular "${targetParticular}" for product "${formStockProductKey}" (${formStockSection}) is already mapped in another rule. Duplicate mappings are not allowed.`);
      return;
    }

    const isStgTargetAlreadyMapped = mappings.some(
      r => r.id !== editingId &&
           r.stgBlockKey === formStgBlockKey &&
           r.stgSection === formStgSection &&
           r.stgItemName.trim().toLowerCase() === formStgItemName.trim().toLowerCase() &&
           r.stgTargetField === formStgTargetField
    );

    if (isStgTargetAlreadyMapped) {
      setError(`⚠️ The STG target field "${formStgTargetField}" for STG Block "${formStgBlockKey}" (${formStgItemName}) is already mapped in another rule. Duplicate mappings are not allowed.`);
      return;
    }

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
            stockParticular: targetParticular,
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
        stockParticular: targetParticular,
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

  const deleteStgRule = async (id: string) => {
    const ok = await confirm({
      title: 'Delete STG Rule',
      message: 'Are you sure you want to delete this STG mapping rule?',
      confirmText: 'Delete Rule',
      cancelText: 'Cancel',
      type: 'danger',
    });
    if (!ok) return;
    const updated = mappings.filter(r => r.id !== id);
    setMappings(updated);
    saveStgToApi(updated);
  };

  const handleResetStgDefault = async () => {
    const ok = await confirm({
      title: 'Clear STG Rules',
      message: 'Are you sure you want to clear all STG statement mapping rules?',
      confirmText: 'Clear All Rules',
      cancelText: 'Cancel',
      type: 'danger',
    });
    if (!ok) return;
    setMappings([]);
    saveStgToApi([], true);
  };

  const filteredStgMappings = filterProduct === 'ALL'
    ? mappings
    : mappings.filter(m => m.stockProductKey === filterProduct || m.stgBlockKey === filterProduct);

  return (
    <>
      <Header
        title="Stock Statement ⇄ STG Entry Mappings"
        subtitle="Configure auto-sync mapping rules between Stock Statement Entries and Solid Balance / STG Reports"
        actions={
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              type="button"
              className="btn btn-success btn-sm"
              onClick={() => saveStgToApi(mappings, true)}
              disabled={loading || saving}
              title="Save all STG mapping configurations directly to Database"
              style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700 }}
            >
              💾 Save STG Mappings to DB
            </button>
            <Link href="/dashboard/stock/mappings" className="btn btn-secondary btn-sm" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              🔄 Disposals ➔ Receipts Mappings
            </Link>
            <Link href="/dashboard/ts/new-stg" className="btn btn-primary btn-sm">
              ⚖️ New STG Entry
            </Link>
          </div>
        }
      />

      <div className="page-body animate-fade-in" style={{ maxWidth: 1150 }}>
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
              • <strong>Stock Statement Entry</strong>: Products are represented as columns (e.g. <code>WH.Milk</code>, <code>Skim Milk</code>, <code>Cream</code>), with sections for <code>Opening Balance</code>, <code>Receipts</code>, and <code>Disposals</code>.
            </div>
            <div>
              • <strong>Solid Balance (STG) Entry</strong>: Products are individual statement blocks (e.g. <code>WHOLE MILK STATEMENT</code>), with row particulars for <code>OB</code>, <code>Receipts</code>, <code>Disposals</code>, and <code>CB</code>.
            </div>
            <div style={{ marginTop: 6, fontWeight: 600, color: 'var(--brand-primary)' }}>
              Configure how row entries in Stock Statements correspond to fields in STG Reports.
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
                      {selectableStockParticulars.length > 0 ? (
                        <select
                          className="form-select"
                          value={formStockParticular}
                          onChange={e => setFormStockParticular(e.target.value)}
                          style={{ width: '100%' }}
                        >
                          {selectableStockParticulars.map(p => (
                            <option key={p} value={p}>{p}</option>
                          ))}
                        </select>
                      ) : (
                        <input
                          type="text"
                          className="form-input"
                          value={formStockParticular}
                          onChange={e => setFormStockParticular(e.target.value)}
                          placeholder="Type custom particular name..."
                          style={{ width: '100%' }}
                          required
                        />
                      )}
                      {availableStockParticulars.length === 0 && !editingId && (
                        <div style={{ fontSize: '0.75rem', color: '#b45309', marginTop: 4, fontWeight: 600 }}>
                          ⚠️ All standard row particulars for this product section are already mapped below.
                        </div>
                      )}
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 3 }}>
                        Already mapped particulars for this product section are hidden from the selection list.
                      </div>
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
                          {availableStgTargetFields.map(f => (
                            <option key={f.key} value={f.key}>{f.label}</option>
                          ))}
                        </select>
                        {availableStgTargetFields.length === 0 && !editingId && (
                          <div style={{ fontSize: '0.75rem', color: '#b45309', marginTop: 4, fontWeight: 600 }}>
                            ⚠️ All fields for this STG item are already mapped.
                          </div>
                        )}
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
          ) : filteredStgMappings.length === 0 ? (
            <div className="empty-state" style={{ padding: 40, textAlign: 'center' }}>
              <div style={{ fontSize: '2.5rem', marginBottom: 12 }}>🔗</div>
              <div style={{ fontWeight: 600, fontSize: '1.1rem', marginBottom: 6 }}>
                No STG mapping rules configured or match filter
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
    </>
  );
}
