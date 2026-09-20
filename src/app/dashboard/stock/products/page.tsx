'use client';

import { useState, useEffect, useRef } from 'react';
import Header from '@/components/layout/Header';
import Link from 'next/link';
import { useConfirm } from '@/context/ConfirmContext';

interface ProductConfig {
  id?: string;
  key: string;
  label?: string;
  full_name: string;
  short_name: string;
  category?: string;
  sort_order?: number;
  is_active?: boolean;
}

interface RowParticularConfig {
  id?: string;
  full_name: string;
  short_name: string;
  sort_order?: number;
  is_active?: boolean;
}

export default function StockProductsPage() {
  const { confirm, showSuccess, showError } = useConfirm();
  const [products, setProducts] = useState<ProductConfig[]>([]);
  const [receiptRows, setReceiptRows] = useState<RowParticularConfig[]>([]);
  const [disposalRows, setDisposalRows] = useState<RowParticularConfig[]>([]);

  // Selected section in left sidebar: 'products' | 'receipts' | 'disposals'
  const [selectedSection, setSelectedSection] = useState<'products' | 'receipts' | 'disposals'>('products');

  // Left sidebar category collapsible state
  const [expandProductsNav, setExpandProductsNav] = useState(true);
  const [expandReceiptsNav, setExpandReceiptsNav] = useState(false);
  const [expandDisposalsNav, setExpandDisposalsNav] = useState(false);

  // Search filter query
  const [filterQuery, setFilterQuery] = useState('');

  // Soft-deleted item IDs tracking for DB sync
  const [removedProductIds, setRemovedProductIds] = useState<string[]>([]);
  const [removedReceiptIds, setRemovedReceiptIds] = useState<string[]>([]);
  const [removedDisposalIds, setRemovedDisposalIds] = useState<string[]>([]);

  // Product categories list state from DB table product_categories_master
  const [categoriesList, setCategoriesList] = useState<{ id: string; category_name: string; code?: string; sort_order?: number }[]>([]);
  const [showManageCategoryModal, setShowManageCategoryModal] = useState(false);
  const [newCatNameInput, setNewCatNameInput] = useState('');
  const [newCatCodeInput, setNewCatCodeInput] = useState('');
  const [editingCatId, setEditingCatId] = useState<string | null>(null);
  const [editingCatName, setEditingCatName] = useState('');
  const [catActionMsg, setCatActionMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [newProdFullName, setNewProdFullName] = useState('');
  const [newProdShortName, setNewProdShortName] = useState('');
  const [newProdCategory, setNewProdCategory] = useState('Liquid Milk');
  const productInputRef = useRef<HTMLInputElement>(null);

  const [newReceiptFull, setNewReceiptFull] = useState('');
  const [newReceiptShort, setNewReceiptShort] = useState('');
  const [newDisposalFull, setNewDisposalFull] = useState('');
  const [newDisposalShort, setNewDisposalShort] = useState('');

  const receiptInputRef = useRef<HTMLInputElement>(null);
  const disposalInputRef = useRef<HTMLInputElement>(null);

  const fetchCategoriesList = async () => {
    try {
      const res = await fetch('/api/master/categories');
      const json = await res.json();
      if (res.ok && Array.isArray(json.data) && json.data.length > 0) {
        setCategoriesList(json.data);
      }
    } catch {
      // fallback handled in UI
    }
  };

  // Normalize initial data
  const normalizeProducts = (list: any[]): ProductConfig[] => {
    return list.map((p, idx) => ({
      id: p.id,
      key: p.key || p.product_key || ('prod_' + Date.now() + '_' + idx),
      full_name: p.full_name || p.product_name || p.label || p.key || '',
      short_name: p.short_name || p.code || p.label || p.key || '',
      category: p.category || 'Liquid Milk',
      sort_order: p.sort_order || idx + 1,
      is_active: p.is_active !== undefined ? p.is_active : true,
    }));
  };

  const normalizeRows = (list: any[]): RowParticularConfig[] => {
    return list.map((r, idx) => {
      if (typeof r === 'string') {
        return { full_name: r, short_name: r, sort_order: idx + 1, is_active: true };
      }
      return {
        id: r.id,
        full_name: r.full_name || r.particular_name || r.short_name || '',
        short_name: r.short_name || r.code || r.full_name || '',
        sort_order: r.sort_order || idx + 1,
        is_active: r.is_active !== undefined ? r.is_active : true,
      };
    });
  };

  const loadConfig = async () => {
    setLoading(true);
    setError('');
    try {
      await fetchCategoriesList();
      const res = await fetch('/api/stock/config');
      if (!res.ok) throw new Error('Failed to load stock configuration');
      const json = await res.json();

      let fetchedProducts = json.products;
      if (!Array.isArray(fetchedProducts)) {
        fetchedProducts = [];
      }
      setProducts(normalizeProducts(fetchedProducts));

      let fetchedReceipts = json.receipt_rows;
      if (!Array.isArray(fetchedReceipts)) {
        fetchedReceipts = [];
      }
      setReceiptRows(normalizeRows(fetchedReceipts));

      let fetchedDisposals = json.disposal_rows;
      if (!Array.isArray(fetchedDisposals)) {
        fetchedDisposals = [];
      }
      setDisposalRows(normalizeRows(fetchedDisposals));
      setRemovedProductIds([]);
      setRemovedReceiptIds([]);
      setRemovedDisposalIds([]);
    } catch (err: any) {
      console.error('Error loading config:', err);
      setError(err.message || 'Failed to load configuration.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadConfig();
  }, []);

  const handleAddCategoryModalSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCatNameInput.trim()) return;
    setCatActionMsg(null);
    try {
      const res = await fetch('/api/master/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          category_name: newCatNameInput.trim(),
          code: newCatCodeInput.trim() || newCatNameInput.trim().substring(0, 4).toUpperCase(),
          sort_order: categoriesList.length + 1,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed adding category');
      setCatActionMsg({ type: 'success', text: `Category "${newCatNameInput}" declared successfully!` });
      setNewCatNameInput('');
      setNewCatCodeInput('');
      await fetchCategoriesList();
    } catch (err: any) {
      setCatActionMsg({ type: 'error', text: err.message || 'Error adding category' });
    }
  };

  const handleUpdateCategoryModalSubmit = async (id: string, name: string) => {
    if (!name.trim()) return;
    setCatActionMsg(null);
    try {
      const res = await fetch('/api/master/categories', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, category_name: name.trim() }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed updating category');
      setCatActionMsg({ type: 'success', text: `Category updated to "${name}"!` });
      setEditingCatId(null);
      await fetchCategoriesList();
    } catch (err: any) {
      setCatActionMsg({ type: 'error', text: err.message || 'Error updating category' });
    }
  };

  const handleDeleteCategoryModal = async (id: string, name: string) => {
    const ok = await confirm({
      title: 'Delete Category',
      message: `Are you sure you want to delete category "${name}"?`,
      type: 'danger',
    });
    if (!ok) return;
    setCatActionMsg(null);
    try {
      const res = await fetch(`/api/master/categories?id=${id}`, { method: 'DELETE' });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed deleting category');
      setCatActionMsg({ type: 'success', text: `Category "${name}" deleted!` });
      await fetchCategoriesList();
    } catch (err: any) {
      setCatActionMsg({ type: 'error', text: err.message || 'Error deleting category' });
    }
  };

  // Filtered views based on filterQuery
  const q = filterQuery.trim().toLowerCase();
  const filteredProducts = products.filter(p => !q || p.full_name.toLowerCase().includes(q) || p.short_name.toLowerCase().includes(q) || (p.category && p.category.toLowerCase().includes(q)));
  const filteredReceipts = receiptRows.filter(r => !q || r.full_name.toLowerCase().includes(q) || r.short_name.toLowerCase().includes(q));
  const filteredDisposals = disposalRows.filter(d => !q || d.full_name.toLowerCase().includes(q) || d.short_name.toLowerCase().includes(q));

  // Product Row Handling
  const handleProductChange = (key: string, field: 'full_name' | 'short_name' | 'category', value: string) => {
    setProducts(prev => prev.map(p => (p.key === key ? { ...p, [field]: value } : p)));
  };

  const handleAddProductInline = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const shortVal = newProdShortName.trim() || newProdFullName.trim();
    const fullVal = newProdFullName.trim() || newProdShortName.trim();
    const catVal = newProdCategory.trim() || (categoriesList[0]?.category_name || 'Liquid Milk');
    if (!shortVal) return;

    const lowerFull = fullVal.toLowerCase();
    const lowerShort = shortVal.toLowerCase();

    // Check if item already exists in active list case-insensitively
    const existingIndex = products.findIndex(p => p.full_name.toLowerCase() === lowerFull || p.short_name.toLowerCase() === lowerShort);
    if (existingIndex !== -1) {
      // Re-enable / update existing
      setProducts(prev => prev.map((p, idx) => idx === existingIndex ? { ...p, full_name: fullVal, short_name: shortVal, category: catVal, is_active: true } : p));
      setNewProdFullName('');
      setNewProdShortName('');
      setSelectedSection('products');
      return;
    }

    const key = shortVal.toLowerCase().replace(/\s+/g, '_');
    setProducts(prev => [
      ...prev,
      { key, full_name: fullVal, short_name: shortVal, category: catVal, sort_order: prev.length + 1, is_active: true }
    ]);
    setNewProdFullName('');
    setNewProdShortName('');
    setSelectedSection('products');
  };

  const removeProduct = async (key: string) => {
    const target = products.find(p => p.key === key);
    if (!target) return;

    const ok = await confirm({
      title: 'Remove Product',
      message: `Are you sure you want to remove product "${target.full_name || target.short_name}"?`,
      type: 'danger',
    });
    if (!ok) return;

    const deleteId = target.id || target.key;
    if (deleteId) {
      try {
        const res = await fetch(`/api/master/products?id=${encodeURIComponent(deleteId)}`, {
          method: 'DELETE',
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || 'Failed to delete product from database');
      } catch (err: any) {
        console.error('Error deleting product:', err);
        await showError(err.message || 'Failed to delete product', 'Delete Error');
        return;
      }
    }

    if (target.id) {
      setRemovedProductIds(prev => [...prev, target.id!]);
    }
    setProducts(prev => prev.filter(p => p.key !== key));
    await showSuccess(`Product "${target.full_name || target.short_name}" removed successfully!`, 'Product Removed');
  };

  const moveProdUp = (idx: number) => {
    if (idx === 0) return;
    setProducts(prev => {
      const next = [...prev];
      const temp = next[idx];
      next[idx] = next[idx - 1];
      next[idx - 1] = temp;
      return next;
    });
  };

  const moveProdDown = (idx: number) => {
    if (idx === products.length - 1) return;
    setProducts(prev => {
      const next = [...prev];
      const temp = next[idx];
      next[idx] = next[idx + 1];
      next[idx + 1] = temp;
      return next;
    });
  };

  // Receipt Row Handling
  const handleAddReceiptInline = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const s = newReceiptShort.trim() || newReceiptFull.trim();
    const f = newReceiptFull.trim() || newReceiptShort.trim();
    if (!s) return;

    const lowerF = f.toLowerCase();
    const lowerS = s.toLowerCase();
    const existingIdx = receiptRows.findIndex(r => r.full_name.toLowerCase() === lowerF || r.short_name.toLowerCase() === lowerS);

    if (existingIdx !== -1) {
      setReceiptRows(prev => prev.map((r, i) => i === existingIdx ? { ...r, full_name: f, short_name: s, is_active: true } : r));
    } else {
      setReceiptRows(prev => [...prev, { full_name: f, short_name: s, sort_order: prev.length + 1, is_active: true }]);
    }
    setNewReceiptFull('');
    setNewReceiptShort('');
    setSelectedSection('receipts');
  };

  const removeReceiptRow = async (idx: number) => {
    const target = receiptRows[idx];
    if (!target) return;

    const ok = await confirm({
      title: 'Remove Receipt Particular',
      message: `Are you sure you want to remove receipt row "${target.full_name || target.short_name}"?`,
      type: 'danger',
    });
    if (!ok) return;

    const deleteId = target.id || target.full_name;
    if (deleteId) {
      try {
        const res = await fetch(`/api/master/particulars?id=${encodeURIComponent(deleteId)}`, {
          method: 'DELETE',
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || 'Failed to delete receipt row from database');
      } catch (err: any) {
        console.error('Error deleting receipt row:', err);
        await showError(err.message || 'Failed to delete receipt row', 'Delete Error');
        return;
      }
    }

    if (target.id) {
      setRemovedReceiptIds(prev => [...prev, target.id!]);
    }
    setReceiptRows(prev => prev.filter((_, i) => i !== idx));
    await showSuccess(`Receipt particular "${target.full_name || target.short_name}" removed successfully!`, 'Receipt Row Removed');
  };

  // Disposal Row Handling
  const handleAddDisposalInline = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const s = newDisposalShort.trim() || newDisposalFull.trim();
    const f = newDisposalFull.trim() || newDisposalShort.trim();
    if (!s) return;

    const lowerF = f.toLowerCase();
    const lowerS = s.toLowerCase();
    const existingIdx = disposalRows.findIndex(d => d.full_name.toLowerCase() === lowerF || d.short_name.toLowerCase() === lowerS);

    if (existingIdx !== -1) {
      setDisposalRows(prev => prev.map((d, i) => i === existingIdx ? { ...d, full_name: f, short_name: s, is_active: true } : d));
    } else {
      setDisposalRows(prev => [...prev, { full_name: f, short_name: s, sort_order: prev.length + 1, is_active: true }]);
    }
    setNewDisposalFull('');
    setNewDisposalShort('');
    setSelectedSection('disposals');
  };

  const removeDisposalRow = async (idx: number) => {
    const target = disposalRows[idx];
    if (!target) return;

    const ok = await confirm({
      title: 'Remove Disposal Particular',
      message: `Are you sure you want to remove disposal row "${target.full_name || target.short_name}"?`,
      type: 'danger',
    });
    if (!ok) return;

    const deleteId = target.id || target.full_name;
    if (deleteId) {
      try {
        const res = await fetch(`/api/master/particulars?id=${encodeURIComponent(deleteId)}`, {
          method: 'DELETE',
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || 'Failed to delete disposal row from database');
      } catch (err: any) {
        console.error('Error deleting disposal row:', err);
        await showError(err.message || 'Failed to delete disposal row', 'Delete Error');
        return;
      }
    }

    if (target.id) {
      setRemovedDisposalIds(prev => [...prev, target.id!]);
    }
    setDisposalRows(prev => prev.filter((_, i) => i !== idx));
    await showSuccess(`Disposal particular "${target.full_name || target.short_name}" removed successfully!`, 'Disposal Row Removed');
  };

  // Save Configuration to Backend Database
  const handleSave = async () => {
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      const res = await fetch('/api/stock/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          products: products.map((p, i) => ({
            id: p.id,
            key: p.key,
            full_name: p.full_name,
            short_name: p.short_name,
            category: p.category,
            sort_order: i + 1,
          })),
          receipt_rows: receiptRows.map((r, i) => ({
            id: r.id,
            full_name: r.full_name,
            short_name: r.short_name,
            sort_order: i + 1,
          })),
          disposal_rows: disposalRows.map((d, i) => ({
            id: d.id,
            full_name: d.full_name,
            short_name: d.short_name,
            sort_order: i + 1,
          })),
          removed_product_ids: removedProductIds,
          removed_receipt_ids: removedReceiptIds,
          removed_disposal_ids: removedDisposalIds,
        }),
      });

      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.error || 'Failed to save configuration.');
      }

      setSuccess('Products saved successfully in database!');
      await showSuccess('Products saved successfully in database!', 'Database Updated');
      await loadConfig();
    } catch (err: any) {
      const errMsg = err.message || 'Save failed';
      setError(errMsg);
      await showError(errMsg, 'Save Error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Header
        title="Products List"
        subtitle="Manage statement columns, display labels, particulars, and product orders"
        actions={
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={handleSave}
              disabled={loading || saving}
            >
              {saving ? '💾 Saving...' : '💾 Save'}
            </button>
            <Link href="/dashboard/stock" className="btn btn-secondary btn-sm">
              ← Back to Register
            </Link>
          </div>
        }
      />

      <div className="page-body animate-fade-in" style={{ padding: '0 20px 40px 20px' }}>
        {error && <div className="alert alert-error" style={{ marginBottom: 16 }}>⚠️ {error}</div>}
        {success && <div className="alert alert-success" style={{ marginBottom: 16 }}>✅ {success}</div>}

        {/* Master-Detail Split Container */}
        <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start' }}>

          {/* LEFT SIDEBAR: Collapsible Category Filter Panel */}
          <div
            className="card"
            style={{
              width: 300,
              minWidth: 280,
              padding: 0,
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: 'var(--shadow-md)',
              border: '1px solid var(--border)',
            }}
          >
            {/* Sidebar Title */}
            <div
              style={{
                padding: '14px 16px',
                background: 'rgba(255, 255, 255, 0.03)',
                borderBottom: '1px solid var(--border)',
                fontSize: '0.825rem',
                fontWeight: 700,
                letterSpacing: '0.05em',
                textTransform: 'uppercase',
                color: 'var(--text-secondary)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <span>CONFIGURATION FILTERS</span>
              <span
                style={{
                  fontSize: '0.725rem',
                  padding: '2px 8px',
                  borderRadius: 10,
                  background: 'rgba(14, 165, 233, 0.1)',
                  color: 'var(--brand-primary)',
                  fontWeight: 600,
                }}
              >
                {products.length + receiptRows.length + disposalRows.length} Items
              </span>
            </div>

            {/* Quick Search Input */}
            <div style={{ padding: 12, borderBottom: '1px solid var(--border)' }}>
              <input
                type="text"
                className="form-input"
                value={filterQuery}
                onChange={e => setFilterQuery(e.target.value)}
                placeholder="🔍 Search items..."
                style={{ margin: 0, padding: '7px 10px', fontSize: '0.8rem' }}
              />
            </div>

            {/* Sidebar Navigation Items */}
            <div style={{ display: 'flex', flexDirection: 'column' }}>

              {/* 1. PRODUCTS CATEGORY */}
              <div style={{ borderBottom: '1px solid var(--border)' }}>
                <div
                  onClick={() => {
                    setSelectedSection('products');
                    setExpandProductsNav(!expandProductsNav);
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '12px 16px',
                    background: selectedSection === 'products' ? 'rgba(14, 165, 233, 0.12)' : 'transparent',
                    color: selectedSection === 'products' ? 'var(--brand-primary)' : 'var(--text-primary)',
                    fontWeight: selectedSection === 'products' ? 700 : 600,
                    fontSize: '0.85rem',
                    cursor: 'pointer',
                    userSelect: 'none',
                    borderLeft: selectedSection === 'products' ? '3px solid var(--brand-primary)' : '3px solid transparent',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span>📦</span>
                    <span>PRODUCTS</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span
                      style={{
                        fontSize: '0.725rem',
                        fontWeight: 700,
                        padding: '2px 6px',
                        borderRadius: 8,
                        background: 'rgba(14, 165, 233, 0.15)',
                        color: 'var(--brand-primary)',
                      }}
                    >
                      {products.length} {products.length === 1 ? 'product' : 'products'}
                    </span>
                    <span
                      style={{
                        fontSize: '0.8rem',
                        color: 'var(--text-secondary)',
                        transition: 'transform 0.2s',
                        display: 'inline-block',
                      }}
                    >
                      {expandProductsNav ? '▲' : '▼'}
                    </span>
                  </div>
                </div>

                {/* Sub-item list under Products */}
                {expandProductsNav && (
                  <div style={{ background: 'rgba(0, 0, 0, 0.15)', padding: '4px 0' }}>
                    {filteredProducts.map((p, idx) => (
                      <div
                        key={p.key || idx}
                        onClick={() => setSelectedSection('products')}
                        style={{
                          padding: '6px 16px 6px 40px',
                          fontSize: '0.78rem',
                          color: 'var(--text-secondary)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          cursor: 'pointer',
                        }}
                      >
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {idx + 1}. {p.short_name || p.full_name}
                        </span>
                        <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{p.key}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* 2. RECEIPTS CATEGORY */}
              <div style={{ borderBottom: '1px solid var(--border)' }}>
                <div
                  onClick={() => {
                    setSelectedSection('receipts');
                    setExpandReceiptsNav(!expandReceiptsNav);
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '12px 16px',
                    background: selectedSection === 'receipts' ? 'rgba(16, 185, 129, 0.12)' : 'transparent',
                    color: selectedSection === 'receipts' ? '#10b981' : 'var(--text-primary)',
                    fontWeight: selectedSection === 'receipts' ? 700 : 600,
                    fontSize: '0.85rem',
                    cursor: 'pointer',
                    userSelect: 'none',
                    borderLeft: selectedSection === 'receipts' ? '3px solid #10b981' : '3px solid transparent',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span>📥</span>
                    <span>RECEIPTS</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span
                      style={{
                        fontSize: '0.725rem',
                        fontWeight: 700,
                        padding: '2px 6px',
                        borderRadius: 8,
                        background: 'rgba(16, 185, 129, 0.15)',
                        color: '#10b981',
                      }}
                    >
                      {receiptRows.length} {receiptRows.length === 1 ? 'item' : 'items'}
                    </span>
                    <span
                      style={{
                        fontSize: '0.8rem',
                        color: 'var(--text-secondary)',
                        transition: 'transform 0.2s',
                        display: 'inline-block',
                      }}
                    >
                      {expandReceiptsNav ? '▲' : '▼'}
                    </span>
                  </div>
                </div>

                {/* Sub-item list under Receipts */}
                {expandReceiptsNav && (
                  <div style={{ background: 'rgba(0, 0, 0, 0.15)', padding: '4px 0' }}>
                    {filteredReceipts.map((r, idx) => (
                      <div
                        key={idx}
                        onClick={() => setSelectedSection('receipts')}
                        style={{
                          padding: '6px 16px 6px 40px',
                          fontSize: '0.78rem',
                          color: 'var(--text-secondary)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          cursor: 'pointer',
                        }}
                      >
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {idx + 1}. {r.short_name || r.full_name}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* 3. DISPOSALS CATEGORY */}
              <div>
                <div
                  onClick={() => {
                    setSelectedSection('disposals');
                    setExpandDisposalsNav(!expandDisposalsNav);
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '12px 16px',
                    background: selectedSection === 'disposals' ? 'rgba(245, 158, 11, 0.12)' : 'transparent',
                    color: selectedSection === 'disposals' ? '#f59e0b' : 'var(--text-primary)',
                    fontWeight: selectedSection === 'disposals' ? 700 : 600,
                    fontSize: '0.85rem',
                    cursor: 'pointer',
                    userSelect: 'none',
                    borderLeft: selectedSection === 'disposals' ? '3px solid #f59e0b' : '3px solid transparent',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span>📤</span>
                    <span>DISPOSALS</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span
                      style={{
                        fontSize: '0.725rem',
                        fontWeight: 700,
                        padding: '2px 6px',
                        borderRadius: 8,
                        background: 'rgba(245, 158, 11, 0.15)',
                        color: '#f59e0b',
                      }}
                    >
                      {disposalRows.length} {disposalRows.length === 1 ? 'item' : 'items'}
                    </span>
                    <span
                      style={{
                        fontSize: '0.8rem',
                        color: 'var(--text-secondary)',
                        transition: 'transform 0.2s',
                        display: 'inline-block',
                      }}
                    >
                      {expandDisposalsNav ? '▲' : '▼'}
                    </span>
                  </div>
                </div>

                {/* Sub-item list under Disposals */}
                {expandDisposalsNav && (
                  <div style={{ background: 'rgba(0, 0, 0, 0.15)', padding: '4px 0' }}>
                    {filteredDisposals.map((d, idx) => (
                      <div
                        key={idx}
                        onClick={() => setSelectedSection('disposals')}
                        style={{
                          padding: '6px 16px 6px 40px',
                          fontSize: '0.78rem',
                          color: 'var(--text-secondary)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          cursor: 'pointer',
                        }}
                      >
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {idx + 1}. {d.short_name || d.full_name}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

            </div>
          </div>

          {/* RIGHT MAIN PANEL: Details & Editor View */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 20 }}>

            {/* 1. PRODUCTS EDITOR */}
            {selectedSection === 'products' && (
              <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 12, borderBottom: '1px solid var(--border)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ fontWeight: 700, fontSize: '1.05rem', color: 'var(--text-primary)' }}>
                      📦 Products
                    </div>
                    <span
                      style={{
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        padding: '2px 8px',
                        borderRadius: 12,
                        background: 'rgba(14, 165, 233, 0.15)',
                        color: 'var(--brand-primary)',
                      }}
                    >
                      {products.length} {products.length === 1 ? 'product' : 'products'}
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={() => setShowManageCategoryModal(true)}
                    >
                      🏷️ Manage Categories
                    </button>
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={() => productInputRef.current?.focus()}
                      disabled={loading || saving}
                    >
                      ➕ Add Product Column
                    </button>
                  </div>
                </div>

                {loading ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '16px 0' }}>
                    <span className="spinner" /> Loading products configuration...
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '36px 1.2fr 1fr 140px 105px', gap: 10, padding: '0 8px', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)' }}>
                      <div>Pos</div>
                      <div>Full Form (Full Product Name)</div>
                      <div>Short Form (Column Header)</div>
                      <div>Category</div>
                      <div style={{ textAlign: 'right' }}>Actions</div>
                    </div>

                    {filteredProducts.length === 0 ? (
                      <div style={{ textAlign: 'center', padding: 20, color: 'var(--text-muted)', fontSize: '0.875rem' }}>
                        {q ? 'No product columns match your search filter.' : 'No products configured. Add products below.'}
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {filteredProducts.map((p) => {
                          const realIdx = products.findIndex(item => item.key === p.key);
                          return (
                            <div
                              key={p.key || realIdx}
                              style={{
                                display: 'grid',
                                gridTemplateColumns: '36px 1.2fr 1fr 140px 105px',
                                alignItems: 'center',
                                gap: 10,
                                padding: 8,
                                background: 'rgba(255, 255, 255, 0.03)',
                                border: '1px solid var(--border)',
                                borderRadius: 'var(--radius-sm)',
                              }}
                            >
                              <div
                                style={{
                                  width: 30,
                                  height: 28,
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  background: 'rgba(14, 165, 233, 0.1)',
                                  color: 'var(--brand-primary)',
                                  borderRadius: 4,
                                  fontSize: '0.8rem',
                                  fontWeight: 700,
                                }}
                                title={`Position ${realIdx + 1}`}
                              >
                                {realIdx + 1}
                              </div>

                              <div>
                                <input
                                  type="text"
                                  className="form-input"
                                  value={p.full_name || ''}
                                  onChange={e => handleProductChange(p.key, 'full_name', e.target.value)}
                                  placeholder="e.g. WHOLE MILK"
                                  style={{ margin: 0, padding: '6px 10px', fontSize: '0.85rem' }}
                                />
                              </div>

                              <div>
                                <input
                                  type="text"
                                  className="form-input"
                                  value={p.short_name || ''}
                                  onChange={e => handleProductChange(p.key, 'short_name', e.target.value)}
                                  placeholder="e.g. WH.Milk"
                                  style={{ margin: 0, padding: '6px 10px', fontSize: '0.85rem', fontWeight: 600 }}
                                />
                              </div>

                              <div>
                                <select
                                  className="form-input"
                                  value={p.category || 'Liquid Milk'}
                                  onChange={e => handleProductChange(p.key, 'category', e.target.value)}
                                  style={{ margin: 0, padding: '6px 8px', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer' }}
                                >
                                  {categoriesList.length > 0 ? (
                                    categoriesList.map(c => (
                                      <option key={c.id || c.category_name} value={c.category_name}>
                                        {c.category_name}
                                      </option>
                                    ))
                                  ) : (
                                    <>
                                      <option value="Liquid Milk">Liquid Milk</option>
                                      <option value="Products">Products</option>
                                      <option value="By-Products">By-Products</option>
                                      <option value="Others">Others</option>
                                    </>
                                  )}
                                </select>
                              </div>

                              <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
                                <button
                                  type="button"
                                  className="btn btn-secondary btn-sm"
                                  style={{ padding: '6px 8px', height: 28 }}
                                  onClick={() => moveProdUp(realIdx)}
                                  disabled={realIdx === 0 || saving}
                                  title="Move Up"
                                >
                                  ▲
                                </button>
                                <button
                                  type="button"
                                  className="btn btn-secondary btn-sm"
                                  style={{ padding: '6px 8px', height: 28 }}
                                  onClick={() => moveProdDown(realIdx)}
                                  disabled={realIdx === products.length - 1 || saving}
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
                                  title="Soft Delete Product"
                                >
                                  ✕
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    <form
                      onSubmit={handleAddProductInline}
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '36px 1.2fr 1fr 140px 105px',
                        alignItems: 'center',
                        gap: 10,
                        padding: '12px 8px 0 8px',
                        borderTop: '1px dashed var(--border)',
                        marginTop: 8,
                      }}
                    >
                      <div style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--brand-primary)' }}>➕</div>
                      <div>
                        <input
                          ref={productInputRef}
                          type="text"
                          className="form-input"
                          value={newProdFullName}
                          onChange={e => setNewProdFullName(e.target.value)}
                          placeholder="Full Form (e.g. WHOLE MILK)"
                          style={{ margin: 0, padding: '8px 10px', fontSize: '0.85rem' }}
                        />
                      </div>
                      <div>
                        <input
                          type="text"
                          className="form-input"
                          value={newProdShortName}
                          onChange={e => setNewProdShortName(e.target.value)}
                          placeholder="Short Form (e.g. WH.Milk)"
                          style={{ margin: 0, padding: '8px 10px', fontSize: '0.85rem' }}
                        />
                      </div>
                      <div>
                        <select
                          className="form-input"
                          value={newProdCategory}
                          onChange={e => setNewProdCategory(e.target.value)}
                          style={{ margin: 0, padding: '8px 8px', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer' }}
                        >
                          {categoriesList.length > 0 ? (
                            categoriesList.map(c => (
                              <option key={c.id || c.category_name} value={c.category_name}>
                                {c.category_name}
                              </option>
                            ))
                          ) : (
                            <>
                              <option value="Liquid Milk">Liquid Milk</option>
                              <option value="Products">Products</option>
                              <option value="By-Products">By-Products</option>
                              <option value="Others">Others</option>
                            </>
                          )}
                        </select>
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
            )}

            {/* 2. RECEIPTS EDITOR */}
            {selectedSection === 'receipts' && (
              <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 12, borderBottom: '1px solid var(--border)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ fontWeight: 700, fontSize: '1.05rem', color: 'var(--text-primary)' }}>
                      📥 Receipts
                    </div>
                    <span
                      style={{
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        padding: '2px 8px',
                        borderRadius: 12,
                        background: 'rgba(16, 185, 129, 0.15)',
                        color: '#10b981',
                      }}
                    >
                      {receiptRows.length} {receiptRows.length === 1 ? 'item' : 'items'}
                    </span>
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
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '16px 0' }}>
                    <span className="spinner" /> Loading receipt rows...
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '40px 1fr 1fr 110px', gap: 12, padding: '0 8px', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)' }}>
                      <div>Pos</div>
                      <div>Full Form (Full Particular Name)</div>
                      <div>Short Form (Row Header in Entry)</div>
                      <div style={{ textAlign: 'right' }}>Actions</div>
                    </div>

                    {filteredReceipts.length === 0 ? (
                      <div style={{ textAlign: 'center', padding: 20, color: 'var(--text-muted)', fontSize: '0.875rem' }}>
                        {q ? 'No receipt particulars match your filter.' : 'No receipt row particulars configured.'}
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {filteredReceipts.map((r) => {
                          const realIdx = receiptRows.findIndex(item => item === r || (item.full_name === r.full_name && item.short_name === r.short_name));
                          return (
                            <div
                              key={realIdx}
                              style={{
                                display: 'grid',
                                gridTemplateColumns: '40px 1fr 1fr 110px',
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
                                  width: 32,
                                  height: 28,
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  background: 'rgba(16, 185, 129, 0.1)',
                                  color: '#10b981',
                                  borderRadius: 4,
                                  fontSize: '0.8rem',
                                  fontWeight: 700,
                                }}
                              >
                                {realIdx + 1}
                              </div>

                              <div>
                                <input
                                  type="text"
                                  className="form-input"
                                  value={r.full_name}
                                  onChange={e => {
                                    const val = e.target.value;
                                    setReceiptRows(prev => prev.map((item, i) => i === realIdx ? { ...item, full_name: val } : item));
                                  }}
                                  placeholder="e.g. Receipts from BMCs"
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
                                    setReceiptRows(prev => prev.map((item, i) => i === realIdx ? { ...item, short_name: val } : item));
                                  }}
                                  placeholder="e.g. Receipts:"
                                  style={{ margin: 0, padding: '6px 10px', fontSize: '0.875rem', fontWeight: 600 }}
                                />
                              </div>

                              <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
                                <button
                                  type="button"
                                  className="btn btn-secondary btn-sm"
                                  style={{ padding: '6px 8px', height: 28 }}
                                  onClick={() => {
                                    if (realIdx === 0) return;
                                    setReceiptRows(prev => {
                                      const next = [...prev];
                                      const temp = next[realIdx];
                                      next[realIdx] = next[realIdx - 1];
                                      next[realIdx - 1] = temp;
                                      return next;
                                    });
                                  }}
                                  disabled={realIdx === 0 || saving}
                                  title="Move Up"
                                >
                                  ▲
                                </button>
                                <button
                                  type="button"
                                  className="btn btn-secondary btn-sm"
                                  style={{ padding: '6px 8px', height: 28 }}
                                  onClick={() => {
                                    if (realIdx === receiptRows.length - 1) return;
                                    setReceiptRows(prev => {
                                      const next = [...prev];
                                      const temp = next[realIdx];
                                      next[realIdx] = next[realIdx + 1];
                                      next[realIdx + 1] = temp;
                                      return next;
                                    });
                                  }}
                                  disabled={realIdx === receiptRows.length - 1 || saving}
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
                                  onClick={() => removeReceiptRow(realIdx)}
                                  disabled={saving}
                                  title="Soft Delete Row"
                                >
                                  ✕
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    <form
                      onSubmit={handleAddReceiptInline}
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '40px 1fr 1fr 110px',
                        alignItems: 'center',
                        gap: 12,
                        padding: '12px 8px 0 8px',
                        borderTop: '1px dashed var(--border)',
                        marginTop: 8,
                      }}
                    >
                      <div style={{ fontSize: '0.9rem', fontWeight: 600, color: '#10b981' }}>➕</div>
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
            )}

            {/* 3. DISPOSALS EDITOR */}
            {selectedSection === 'disposals' && (
              <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 12, borderBottom: '1px solid var(--border)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ fontWeight: 700, fontSize: '1.05rem', color: 'var(--text-primary)' }}>
                      📤 Disposals
                    </div>
                    <span
                      style={{
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        padding: '2px 8px',
                        borderRadius: 12,
                        background: 'rgba(245, 158, 11, 0.15)',
                        color: '#f59e0b',
                      }}
                    >
                      {disposalRows.length} {disposalRows.length === 1 ? 'item' : 'items'}
                    </span>
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
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '16px 0' }}>
                    <span className="spinner" /> Loading disposal rows...
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '40px 1fr 1fr 110px', gap: 12, padding: '0 8px', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)' }}>
                      <div>Pos</div>
                      <div>Full Form (Full Particular Name)</div>
                      <div>Short Form (Row Header in Entry)</div>
                      <div style={{ textAlign: 'right' }}>Actions</div>
                    </div>

                    {filteredDisposals.length === 0 ? (
                      <div style={{ textAlign: 'center', padding: 20, color: 'var(--text-muted)', fontSize: '0.875rem' }}>
                        {q ? 'No disposal particulars match your filter.' : 'No disposal row particulars configured.'}
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {filteredDisposals.map((d) => {
                          const realIdx = disposalRows.findIndex(item => item === d || (item.full_name === d.full_name && item.short_name === d.short_name));
                          return (
                            <div
                              key={realIdx}
                              style={{
                                display: 'grid',
                                gridTemplateColumns: '40px 1fr 1fr 110px',
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
                                  width: 32,
                                  height: 28,
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  background: 'rgba(245, 158, 11, 0.1)',
                                  color: '#f59e0b',
                                  borderRadius: 4,
                                  fontSize: '0.8rem',
                                  fontWeight: 700,
                                }}
                              >
                                {realIdx + 1}
                              </div>

                              <div>
                                <input
                                  type="text"
                                  className="form-input"
                                  value={d.full_name}
                                  onChange={e => {
                                    const val = e.target.value;
                                    setDisposalRows(prev => prev.map((item, i) => i === realIdx ? { ...item, full_name: val } : item));
                                  }}
                                  placeholder="e.g. To Double Toned Milk"
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
                                    setDisposalRows(prev => prev.map((item, i) => i === realIdx ? { ...item, short_name: val } : item));
                                  }}
                                  placeholder="e.g. To DLT Milk"
                                  style={{ margin: 0, padding: '6px 10px', fontSize: '0.875rem', fontWeight: 600 }}
                                />
                              </div>

                              <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
                                <button
                                  type="button"
                                  className="btn btn-secondary btn-sm"
                                  style={{ padding: '6px 8px', height: 28 }}
                                  onClick={() => {
                                    if (realIdx === 0) return;
                                    setDisposalRows(prev => {
                                      const next = [...prev];
                                      const temp = next[realIdx];
                                      next[realIdx] = next[realIdx - 1];
                                      next[realIdx - 1] = temp;
                                      return next;
                                    });
                                  }}
                                  disabled={realIdx === 0 || saving}
                                  title="Move Up"
                                >
                                  ▲
                                </button>
                                <button
                                  type="button"
                                  className="btn btn-secondary btn-sm"
                                  style={{ padding: '6px 8px', height: 28 }}
                                  onClick={() => {
                                    if (realIdx === disposalRows.length - 1) return;
                                    setDisposalRows(prev => {
                                      const next = [...prev];
                                      const temp = next[realIdx];
                                      next[realIdx] = next[realIdx + 1];
                                      next[realIdx + 1] = temp;
                                      return next;
                                    });
                                  }}
                                  disabled={realIdx === disposalRows.length - 1 || saving}
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
                                  onClick={() => removeDisposalRow(realIdx)}
                                  disabled={saving}
                                  title="Soft Delete Row"
                                >
                                  ✕
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    <form
                      onSubmit={handleAddDisposalInline}
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '40px 1fr 1fr 110px',
                        alignItems: 'center',
                        gap: 12,
                        padding: '12px 8px 0 8px',
                        borderTop: '1px dashed var(--border)',
                        marginTop: 8,
                      }}
                    >
                      <div style={{ fontSize: '0.9rem', fontWeight: 600, color: '#f59e0b' }}>➕</div>
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
            )}

            {/* Save Button Footer */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: 10 }}>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleSave}
                disabled={loading || saving}
                style={{ padding: '12px 32px', fontSize: '1rem', fontWeight: 600, width: '100%' }}
              >
                {saving ? 'Saving Config to Database...' : '💾 Save'}
              </button>
            </div>

          </div>

        </div>

      </div>

      {/* MANAGE CATEGORIES MODAL */}
      {showManageCategoryModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div className="card animate-fade-in" style={{ maxWidth: 520, width: '100%', background: '#fff', borderRadius: 12, padding: 24 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: 'var(--brand-primary)' }}>🏷️ Product Categories Master</h3>
              <button type="button" style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.2rem' }} onClick={() => setShowManageCategoryModal(false)}>✖</button>
            </div>

            {catActionMsg && (
              <div style={{ background: catActionMsg.type === 'success' ? '#ecfdf5' : '#fef2f2', border: `1px solid ${catActionMsg.type === 'success' ? '#6ee7b7' : '#fca5a5'}`, color: catActionMsg.type === 'success' ? '#065f46' : '#991b1b', padding: '8px 12px', borderRadius: 6, marginBottom: 14, fontSize: '0.82rem' }}>
                {catActionMsg.type === 'success' ? '✅' : '⚠️'} {catActionMsg.text}
              </div>
            )}

            {/* Add Category Form */}
            <form onSubmit={handleAddCategoryModalSubmit} style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
              <input
                type="text"
                className="form-input"
                value={newCatNameInput}
                onChange={e => setNewCatNameInput(e.target.value)}
                placeholder="New Category Name (e.g. Sweets)"
                required
                style={{ flex: 1, margin: 0, padding: '7px 10px', fontSize: '0.85rem' }}
              />
              <input
                type="text"
                className="form-input"
                value={newCatCodeInput}
                onChange={e => setNewCatCodeInput(e.target.value)}
                placeholder="Code"
                style={{ width: 80, margin: 0, padding: '7px 10px', fontSize: '0.85rem' }}
              />
              <button type="submit" className="btn btn-primary btn-sm" style={{ height: 36, whiteSpace: 'nowrap' }}>
                ➕ Add Category
              </button>
            </form>

            {/* Categories Table */}
            <div style={{ border: '1px solid var(--border)', borderRadius: 8, maxHeight: 260, overflowY: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                <thead>
                  <tr style={{ background: '#f8fafc', borderBottom: '1px solid var(--border)', fontSize: '0.72rem', textTransform: 'uppercase', color: 'var(--text-secondary)' }}>
                    <th style={{ padding: '8px 12px', textAlign: 'left' }}>Category Name</th>
                    <th style={{ padding: '8px 12px', textAlign: 'left' }}>Code</th>
                    <th style={{ padding: '8px 12px', textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {categoriesList.length === 0 ? (
                    <tr><td colSpan={3} style={{ padding: 16, textAlign: 'center', color: 'var(--text-muted)' }}>No categories declared.</td></tr>
                  ) : (
                    categoriesList.map(cat => (
                      <tr key={cat.id} style={{ borderBottom: '1px solid var(--border)' }}>
                        <td style={{ padding: '8px 12px', fontWeight: 600 }}>
                          {editingCatId === cat.id ? (
                            <input
                              type="text"
                              className="form-input"
                              value={editingCatName}
                              onChange={e => setEditingCatName(e.target.value)}
                              style={{ margin: 0, padding: '4px 8px', fontSize: '0.82rem' }}
                            />
                          ) : (
                            cat.category_name
                          )}
                        </td>
                        <td style={{ padding: '8px 12px', color: 'var(--text-secondary)', fontSize: '0.8rem' }}>{cat.code || '—'}</td>
                        <td style={{ padding: '8px 12px', textAlign: 'right' }}>
                          {editingCatId === cat.id ? (
                            <div style={{ display: 'inline-flex', gap: 4 }}>
                              <button
                                type="button"
                                className="btn btn-primary btn-xs"
                                onClick={() => handleUpdateCategoryModalSubmit(cat.id, editingCatName)}
                              >
                                💾 Save
                              </button>
                              <button
                                type="button"
                                className="btn btn-secondary btn-xs"
                                onClick={() => setEditingCatId(null)}
                              >
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <div style={{ display: 'inline-flex', gap: 4 }}>
                              <button
                                type="button"
                                className="btn btn-secondary btn-xs"
                                onClick={() => { setEditingCatId(cat.id); setEditingCatName(cat.category_name); }}
                              >
                                ✏️ Edit
                              </button>
                              <button
                                type="button"
                                className="btn btn-secondary btn-xs"
                                style={{ color: '#ef4444', borderColor: '#fca5a5' }}
                                onClick={() => handleDeleteCategoryModal(cat.id, cat.category_name)}
                              >
                                🗑️ Delete
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => setShowManageCategoryModal(false)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

