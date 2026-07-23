'use client';

import { useState, useEffect, useRef } from 'react';
import Header from '@/components/layout/Header';
import Link from 'next/link';
import { STOCK_PRODUCT_COLUMNS } from '@/lib/types';

interface ProductConfig {
  key: string;
  label: string;
  full_name?: string;
  short_name?: string;
}

interface RowParticularConfig {
  full_name: string;
  short_name: string;
}

export default function StockProductsPage() {
  const [products, setProducts] = useState<ProductConfig[]>([]);
  const [shifts, setShifts] = useState<any[]>([]);
  const [mode, setMode] = useState<string>('full_day');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [newProdFullName, setNewProdFullName] = useState('');
  const [newProdShortName, setNewProdShortName] = useState('');
  const productInputRef = useRef<HTMLInputElement>(null);
  
  const [receiptRows, setReceiptRows] = useState<RowParticularConfig[]>([]);
  const [disposalRows, setDisposalRows] = useState<RowParticularConfig[]>([]);
  const [newReceiptFull, setNewReceiptFull] = useState('');
  const [newReceiptShort, setNewReceiptShort] = useState('');
  const [newDisposalFull, setNewDisposalFull] = useState('');
  const [newDisposalShort, setNewDisposalShort] = useState('');

  const receiptInputRef = useRef<HTMLInputElement>(null);
  const disposalInputRef = useRef<HTMLInputElement>(null);

  const normalizeProducts = (list: any[]): ProductConfig[] => {
    return list.map(p => ({
      key: p.key,
      label: p.short_name || p.label || p.key,
      full_name: p.full_name || p.label || p.key,
      short_name: p.short_name || p.label || p.key,
    }));
  };

  const normalizeRows = (list: any[]): RowParticularConfig[] => {
    return list.map(r => {
      if (typeof r === 'string') {
        return { full_name: r, short_name: r };
      }
      return {
        full_name: r.full_name || r.short_name || '',
        short_name: r.short_name || r.full_name || '',
      };
    });
  };

  useEffect(() => {
    let active = true;
    async function loadConfig() {
      setLoading(true);
      setError('');
      try {
        const res = await fetch('/api/entries?report_type=STOCK');
        if (!res.ok) {
          throw new Error('Failed to fetch product configuration.');
        }
        const json = await res.json();
        const entries: any[] = json.data || [];
        const configEntry = entries.find((e: any) => {
          if (!e.notes || e.notes.includes('__METADATA__:')) return false;
          try {
            const parsed = JSON.parse(e.notes);
            return parsed && typeof parsed === 'object' && !Array.isArray(parsed);
          } catch { return false; }
        });
        if (configEntry && configEntry.notes) {
          try {
            const parsed = JSON.parse(configEntry.notes);
            if (parsed && typeof parsed === 'object' && active) {
              if (parsed.mode) setMode(parsed.mode);
              if (Array.isArray(parsed.shifts)) setShifts(parsed.shifts);
              if (Array.isArray(parsed.products)) {
                setProducts(normalizeProducts(parsed.products));
              } else {
                setProducts(normalizeProducts(STOCK_PRODUCT_COLUMNS));
              }
              if (Array.isArray(parsed.receipt_rows)) {
                setReceiptRows(normalizeRows(parsed.receipt_rows));
              } else {
                setReceiptRows(normalizeRows(["Receipts:"]));
              }
              if (Array.isArray(parsed.disposal_rows)) {
                setDisposalRows(normalizeRows(parsed.disposal_rows));
              } else {
                setDisposalRows(normalizeRows(["To DLT Milk", "To FC Milk", "To STD Milk", "To MKT"]));
              }
            }
          } catch (e) {
            console.error('Failed parsing product config notes:', e);
          }
        } else if (active) {
          setProducts(normalizeProducts(STOCK_PRODUCT_COLUMNS));
          setReceiptRows(normalizeRows(["Receipts:"]));
          setDisposalRows(normalizeRows(["To DLT Milk", "To FC Milk", "To STD Milk", "To MKT"]));
        }
      } catch (err) {
        console.error('Error loading config:', err);
        if (active) setError('Failed to load products configuration.');
      } finally {
        if (active) setLoading(false);
      }
    }
    loadConfig();
    return () => { active = false; };
  }, []);

  const handleProductChange = (key: string, field: 'full_name' | 'short_name', value: string) => {
    setProducts(prev => prev.map(p => {
      if (p.key !== key) return p;
      const updated = { ...p, [field]: value };
      if (field === 'short_name') updated.label = value;
      return updated;
    }));
  };

  const handleAddProductInline = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const shortVal = newProdShortName.trim() || newProdFullName.trim();
    const fullVal = newProdFullName.trim() || newProdShortName.trim();
    if (!shortVal) return;
    const key = 'custom_prod_' + Date.now();
    setProducts(prev => [...prev, { key, label: shortVal, full_name: fullVal, short_name: shortVal }]);
    setNewProdFullName('');
    setNewProdShortName('');
  };

  const focusInput = () => {
    productInputRef.current?.focus();
  };

  const removeProduct = (key: string) => {
    const ok = window.confirm("Are you sure you want to remove this product column? This may cause existing data for this product to be hidden from views.");
    if (!ok) return;
    setProducts(prev => prev.filter(p => p.key !== key));
  };

  const moveUp = (idx: number) => {
    if (idx === 0) return;
    setProducts(prev => {
      const next = [...prev];
      const temp = next[idx];
      next[idx] = next[idx - 1];
      next[idx - 1] = temp;
      return next;
    });
  };

  const moveDown = (idx: number) => {
    if (idx === products.length - 1) return;
    setProducts(prev => {
      const next = [...prev];
      const temp = next[idx];
      next[idx] = next[idx + 1];
      next[idx + 1] = temp;
      return next;
    });
  };

  const handleSave = async () => {
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      const res = await fetch('/api/entries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          report_type: 'STOCK',
          shift: null,
          notes: JSON.stringify({
            mode,
            shifts,
            products: products.map(p => ({
              key: p.key,
              label: p.short_name || p.label,
              full_name: p.full_name || p.short_name || p.label,
              short_name: p.short_name || p.label,
            })),
            receipt_rows: receiptRows,
            disposal_rows: disposalRows,
          }),
        }),
      });
      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.error || 'Failed to save product configuration.');
      }
      setSuccess('Product settings saved successfully!');
    } catch (err: any) {
      setError(err.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Header
        title="Stock Products Configuration"
        subtitle="Manage statement columns, display labels, and product orders"
        actions={
          <Link href="/dashboard/stock" className="btn btn-secondary btn-sm">
            ← Back to Register
          </Link>
        }
      />
      <div className="page-body animate-fade-in" style={{ maxWidth: 800 }}>
        {error && <div className="alert alert-error">⚠️ {error}</div>}
        {success && <div className="alert alert-success">✅ {success}</div>}

        {/* Products Column Config */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 20, marginBottom: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontWeight: 600, fontSize: '1rem', color: 'var(--text-primary)' }}>
              📦 Product Columns (Stock Statement Columns)
            </div>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={focusInput}
              disabled={loading || saving}
            >
              ➕ Add New Product
            </button>
          </div>

          {loading ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '24px 0' }}>
              <span className="spinner" /> Loading products configuration...
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '32px 1fr 1fr 110px', gap: 12, padding: '0 8px', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)' }}>
                <div>#</div>
                <div>Full Form (Full Product Name)</div>
                <div>Short Form (Column Name in Entry)</div>
                <div style={{ textAlign: 'right' }}>Actions</div>
              </div>
              {products.length === 0 ? (
                <div style={{ textAlign: 'center', padding: 24, color: 'var(--text-muted)' }}>
                  No products configured. Click Add New Product to start.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {products.map((p, idx) => (
                    <div
                      key={p.key}
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '32px 1fr 1fr 110px',
                        alignItems: 'center',
                        gap: 12,
                        padding: 8,
                        background: 'rgba(255, 255, 255, 0.03)',
                        border: '1px solid var(--border)',
                        borderRadius: 'var(--radius-sm)',
                      }}
                    >
                      <div
                        style={{
                          width: 28,
                          height: 28,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          background: 'rgba(14, 165, 233, 0.1)',
                          color: 'var(--brand-primary)',
                          borderRadius: 4,
                          fontSize: '0.78rem',
                          fontWeight: 700,
                        }}
                      >
                        {idx + 1}
                      </div>

                      <div>
                        <input
                          type="text"
                          className="form-input"
                          value={p.full_name || ''}
                          onChange={e => handleProductChange(p.key, 'full_name', e.target.value)}
                          placeholder="e.g. TENTATIVE WHOLE MILK"
                          style={{ margin: 0, padding: '6px 10px', fontSize: '0.875rem' }}
                        />
                      </div>

                      <div>
                        <input
                          type="text"
                          className="form-input"
                          value={p.short_name || ''}
                          onChange={e => handleProductChange(p.key, 'short_name', e.target.value)}
                          placeholder="e.g. WH.Milk"
                          style={{ margin: 0, padding: '6px 10px', fontSize: '0.875rem', fontWeight: 600 }}
                        />
                      </div>

                      <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          style={{ padding: '6px 8px', height: 28 }}
                          onClick={() => moveUp(idx)}
                          disabled={idx === 0 || saving}
                          title="Move Up"
                        >
                          ▲
                        </button>
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          style={{ padding: '6px 8px', height: 28 }}
                          onClick={() => moveDown(idx)}
                          disabled={idx === products.length - 1 || saving}
                          title="Move Down"
                        >
                          ▼
                        </button>
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          style={{
                            color: '#ef4444',
                            borderColor: '#fca5a5',
                            padding: '6px 8px',
                            height: 28,
                          }}
                          onClick={() => removeProduct(p.key)}
                          disabled={saving}
                          title="Delete Product"
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <form
                onSubmit={handleAddProductInline}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '32px 1fr 1fr 110px',
                  alignItems: 'center',
                  gap: 12,
                  padding: '12px 8px 0 8px',
                  borderTop: '1px dashed var(--border)',
                  marginTop: 8,
                }}
              >
                <div>➕</div>
                <div>
                  <input
                    ref={productInputRef}
                    type="text"
                    className="form-input"
                    value={newProdFullName}
                    onChange={e => setNewProdFullName(e.target.value)}
                    placeholder="Full Form (e.g. WHOLE MILK)"
                    style={{ margin: 0, padding: '8px 12px', fontSize: '0.875rem' }}
                  />
                </div>
                <div>
                  <input
                    type="text"
                    className="form-input"
                    value={newProdShortName}
                    onChange={e => setNewProdShortName(e.target.value)}
                    placeholder="Short Form (e.g. WH.Milk)"
                    style={{ margin: 0, padding: '8px 12px', fontSize: '0.875rem' }}
                  />
                </div>
                <button
                  type="submit"
                  className="btn btn-secondary btn-sm"
                  style={{ height: 36, whiteSpace: 'nowrap', padding: '0 12px' }}
                  disabled={loading || saving}
                >
                  ➕ Add
                </button>
              </form>
            </div>
          )}
        </div>

        {/* Receipt Row Particulars Config */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 20, marginBottom: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontWeight: 600, fontSize: '1rem', color: 'var(--text-primary)' }}>
              📥 Default Receipt Rows (Particulars)
            </div>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => receiptInputRef.current?.focus()}
              disabled={loading || saving}
            >
              ➕ Add Receipt Particular
            </button>
          </div>

          {loading ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '24px 0' }}>
              <span className="spinner" /> Loading receipt rows...
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '32px 1fr 1fr 110px', gap: 12, padding: '0 8px', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)' }}>
                <div>#</div>
                <div>Full Form (Full Particular)</div>
                <div>Short Form (Row Label in Entry)</div>
                <div style={{ textAlign: 'right' }}>Actions</div>
              </div>
              {receiptRows.length === 0 ? (
                <div style={{ textAlign: 'center', padding: 24, color: 'var(--text-muted)' }}>
                  No receipt row particulars configured.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {receiptRows.map((r, idx) => (
                    <div
                      key={idx}
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '32px 1fr 1fr 110px',
                        alignItems: 'center',
                        gap: 12,
                        padding: 8,
                        background: 'rgba(255, 255, 255, 0.03)',
                        border: '1px solid var(--border)',
                        borderRadius: 'var(--radius-sm)',
                      }}
                    >
                      <div
                        style={{
                          width: 28,
                          height: 28,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          background: 'rgba(16, 185, 129, 0.1)',
                          color: '#10b981',
                          borderRadius: 4,
                          fontSize: '0.78rem',
                          fontWeight: 700,
                        }}
                      >
                        {idx + 1}
                      </div>

                      <div>
                        <input
                          type="text"
                          className="form-input"
                          value={r.full_name}
                          onChange={e => {
                            const val = e.target.value;
                            setReceiptRows(prev => prev.map((item, i) => i === idx ? { ...item, full_name: val } : item));
                          }}
                          placeholder="Full Form e.g. Receipts from BMCs"
                          style={{ margin: 0, padding: '6px 10px', fontSize: '0.875rem' }}
                        />
                      </div>

                      <div>
                        <input
                          type="text"
                          className="form-input"
                          value={r.short_name}
                          onChange={e => {
                            const val = e.target.value;
                            setReceiptRows(prev => prev.map((item, i) => i === idx ? { ...item, short_name: val } : item));
                          }}
                          placeholder="Short Form e.g. Receipts:"
                          style={{ margin: 0, padding: '6px 10px', fontSize: '0.875rem', fontWeight: 600 }}
                        />
                      </div>

                      <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          style={{ padding: '6px 8px', height: 28 }}
                          onClick={() => {
                            if (idx === 0) return;
                            setReceiptRows(prev => {
                              const next = [...prev];
                              const temp = next[idx];
                              next[idx] = next[idx - 1];
                              next[idx - 1] = temp;
                              return next;
                            });
                          }}
                          disabled={idx === 0 || saving}
                          title="Move Up"
                        >
                          ▲
                        </button>
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          style={{ padding: '6px 8px', height: 28 }}
                          onClick={() => {
                            if (idx === receiptRows.length - 1) return;
                            setReceiptRows(prev => {
                              const next = [...prev];
                              const temp = next[idx];
                              next[idx] = next[idx + 1];
                              next[idx + 1] = temp;
                              return next;
                            });
                          }}
                          disabled={idx === receiptRows.length - 1 || saving}
                          title="Move Down"
                        >
                          ▼
                        </button>
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          style={{
                            color: '#ef4444',
                            borderColor: '#fca5a5',
                            padding: '6px 8px',
                            height: 28,
                          }}
                          onClick={() => {
                            const ok = window.confirm("Are you sure you want to remove this receipt row?");
                            if (!ok) return;
                            setReceiptRows(prev => prev.filter((_, i) => i !== idx));
                          }}
                          disabled={saving}
                          title="Delete Row"
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const s = newReceiptShort.trim() || newReceiptFull.trim();
                  const f = newReceiptFull.trim() || newReceiptShort.trim();
                  if (!s) return;
                  setReceiptRows(prev => [...prev, { full_name: f, short_name: s }]);
                  setNewReceiptFull('');
                  setNewReceiptShort('');
                }}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '32px 1fr 1fr 110px',
                  alignItems: 'center',
                  gap: 12,
                  padding: '12px 8px 0 8px',
                  borderTop: '1px dashed var(--border)',
                  marginTop: 8,
                }}
              >
                <div>➕</div>
                <div>
                  <input
                    ref={receiptInputRef}
                    type="text"
                    className="form-input"
                    value={newReceiptFull}
                    onChange={e => setNewReceiptFull(e.target.value)}
                    placeholder="Full Form e.g. Receipts from BMCs"
                    style={{ margin: 0, padding: '8px 12px', fontSize: '0.875rem' }}
                  />
                </div>
                <div>
                  <input
                    type="text"
                    className="form-input"
                    value={newReceiptShort}
                    onChange={e => setNewReceiptShort(e.target.value)}
                    placeholder="Short Form e.g. Receipts:"
                    style={{ margin: 0, padding: '8px 12px', fontSize: '0.875rem' }}
                  />
                </div>
                <button
                  type="submit"
                  className="btn btn-secondary btn-sm"
                  style={{ height: 36, whiteSpace: 'nowrap', padding: '0 12px' }}
                  disabled={loading || saving}
                >
                  ➕ Add
                </button>
              </form>
            </div>
          )}
        </div>

        {/* Disposal Row Particulars Config */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 20, marginBottom: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontWeight: 600, fontSize: '1rem', color: 'var(--text-primary)' }}>
              📤 Default Disposal Rows (Particulars)
            </div>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => disposalInputRef.current?.focus()}
              disabled={loading || saving}
            >
              ➕ Add Disposal Particular
            </button>
          </div>

          {loading ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '24px 0' }}>
              <span className="spinner" /> Loading disposal rows...
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '32px 1fr 1fr 110px', gap: 12, padding: '0 8px', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)' }}>
                <div>#</div>
                <div>Full Form (Full Particular)</div>
                <div>Short Form (Row Label in Entry)</div>
                <div style={{ textAlign: 'right' }}>Actions</div>
              </div>
              {disposalRows.length === 0 ? (
                <div style={{ textAlign: 'center', padding: 24, color: 'var(--text-muted)' }}>
                  No disposal row particulars configured.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {disposalRows.map((d, idx) => (
                    <div
                      key={idx}
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '32px 1fr 1fr 110px',
                        alignItems: 'center',
                        gap: 12,
                        padding: 8,
                        background: 'rgba(255, 255, 255, 0.03)',
                        border: '1px solid var(--border)',
                        borderRadius: 'var(--radius-sm)',
                      }}
                    >
                      <div
                        style={{
                          width: 28,
                          height: 28,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          background: 'rgba(245, 158, 11, 0.1)',
                          color: '#f59e0b',
                          borderRadius: 4,
                          fontSize: '0.78rem',
                          fontWeight: 700,
                        }}
                      >
                        {idx + 1}
                      </div>

                      <div>
                        <input
                          type="text"
                          className="form-input"
                          value={d.full_name}
                          onChange={e => {
                            const val = e.target.value;
                            setDisposalRows(prev => prev.map((item, i) => i === idx ? { ...item, full_name: val } : item));
                          }}
                          placeholder="Full Form e.g. To Double Toned Milk"
                          style={{ margin: 0, padding: '6px 10px', fontSize: '0.875rem' }}
                        />
                      </div>

                      <div>
                        <input
                          type="text"
                          className="form-input"
                          value={d.short_name}
                          onChange={e => {
                            const val = e.target.value;
                            setDisposalRows(prev => prev.map((item, i) => i === idx ? { ...item, short_name: val } : item));
                          }}
                          placeholder="Short Form e.g. To DLT Milk"
                          style={{ margin: 0, padding: '6px 10px', fontSize: '0.875rem', fontWeight: 600 }}
                        />
                      </div>

                      <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          style={{ padding: '6px 8px', height: 28 }}
                          onClick={() => {
                            if (idx === 0) return;
                            setDisposalRows(prev => {
                              const next = [...prev];
                              const temp = next[idx];
                              next[idx] = next[idx - 1];
                              next[idx - 1] = temp;
                              return next;
                            });
                          }}
                          disabled={idx === 0 || saving}
                          title="Move Up"
                        >
                          ▲
                        </button>
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          style={{ padding: '6px 8px', height: 28 }}
                          onClick={() => {
                            if (idx === disposalRows.length - 1) return;
                            setDisposalRows(prev => {
                              const next = [...prev];
                              const temp = next[idx];
                              next[idx] = next[idx + 1];
                              next[idx + 1] = temp;
                              return next;
                            });
                          }}
                          disabled={idx === disposalRows.length - 1 || saving}
                          title="Move Down"
                        >
                          ▼
                        </button>
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          style={{
                            color: '#ef4444',
                            borderColor: '#fca5a5',
                            padding: '6px 8px',
                            height: 28,
                          }}
                          onClick={() => {
                            const ok = window.confirm("Are you sure you want to remove this disposal row?");
                            if (!ok) return;
                            setDisposalRows(prev => prev.filter((_, i) => i !== idx));
                          }}
                          disabled={saving}
                          title="Delete Row"
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const s = newDisposalShort.trim() || newDisposalFull.trim();
                  const f = newDisposalFull.trim() || newDisposalShort.trim();
                  if (!s) return;
                  setDisposalRows(prev => [...prev, { full_name: f, short_name: s }]);
                  setNewDisposalFull('');
                  setNewDisposalShort('');
                }}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '32px 1fr 1fr 110px',
                  alignItems: 'center',
                  gap: 12,
                  padding: '12px 8px 0 8px',
                  borderTop: '1px dashed var(--border)',
                  marginTop: 8,
                }}
              >
                <div>➕</div>
                <div>
                  <input
                    ref={disposalInputRef}
                    type="text"
                    className="form-input"
                    value={newDisposalFull}
                    onChange={e => setNewDisposalFull(e.target.value)}
                    placeholder="Full Form e.g. To Double Toned Milk"
                    style={{ margin: 0, padding: '8px 12px', fontSize: '0.875rem' }}
                  />
                </div>
                <div>
                  <input
                    type="text"
                    className="form-input"
                    value={newDisposalShort}
                    onChange={e => setNewDisposalShort(e.target.value)}
                    placeholder="Short Form e.g. To DLT Milk"
                    style={{ margin: 0, padding: '8px 12px', fontSize: '0.875rem' }}
                  />
                </div>
                <button
                  type="submit"
                  className="btn btn-secondary btn-sm"
                  style={{ height: 36, whiteSpace: 'nowrap', padding: '0 12px' }}
                  disabled={loading || saving}
                >
                  ➕ Add
                </button>
              </form>
            </div>
          )}
        </div>

        {/* Global Save Button */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'flex-end',
            paddingTop: 10,
            paddingBottom: 20,
          }}
        >
          <button
            type="button"
            className="btn btn-primary"
            onClick={handleSave}
            disabled={loading || saving}
            style={{ width: '100%', padding: '12px 24px', fontSize: '1rem', fontWeight: 600 }}
          >
            {saving ? 'Saving Config...' : '💾 Save Configuration'}
          </button>
        </div>

        <div className="card" style={{ marginTop: 20, background: 'rgba(14, 165, 233, 0.05)', borderColor: 'rgba(14, 165, 233, 0.15)' }}>
          <div style={{ fontWeight: 600, color: 'var(--brand-primary)', marginBottom: 8 }}>
            💡 Short Form & Full Form Usage Notice
          </div>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
            The <strong>Short Form</strong> is displayed directly as column headers and row particulars in the <strong>New Stock Statement Entry</strong> table. The <strong>Full Form</strong> provides the descriptive title shown in configuration lists and tooltip hovers.
          </div>
        </div>
      </div>
    </>
  );
}
