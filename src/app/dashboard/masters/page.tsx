'use client';

import React, { useState, useEffect } from 'react';
import { useConfirm } from '@/context/ConfirmContext';

interface ProductItem {
  id: string;
  product_key: string;
  product_name: string;
  short_name?: string;
  category?: string;
  sort_order: number;
  is_active: boolean;
  created_by?: string;
  created_at?: string;
  updated_by?: string;
  updated_at?: string;
}

interface DairyItem {
  id: string;
  dairy_name: string;
  code?: string;
  sort_order: number;
  is_active: boolean;
  created_by?: string;
  created_at?: string;
  updated_by?: string;
  updated_at?: string;
}

interface CategoryItem {
  id: string;
  category_name: string;
  code?: string;
  sort_order: number;
  is_active: boolean;
  created_by?: string;
  created_at?: string;
  updated_by?: string;
  updated_at?: string;
}

export default function MasterDeclarationsPage() {
  const [activeTab, setActiveTab] = useState<'PRODUCTS' | 'DAIRIES' | 'CATEGORIES'>('PRODUCTS');
  
  // Products State
  const [products, setProducts] = useState<ProductItem[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [showAddProductModal, setShowAddProductModal] = useState(false);
  const [newProdKey, setNewProdKey] = useState('');
  const [newProdName, setNewProdName] = useState('');
  const [newProdShortName, setNewProdShortName] = useState('');
  const [newProdCategory, setNewProdCategory] = useState('Liquid Milk');
  const [editingProduct, setEditingProduct] = useState<ProductItem | null>(null);

  // Dairies State
  const [dairies, setDairies] = useState<DairyItem[]>([]);
  const [loadingDairies, setLoadingDairies] = useState(true);
  const [showAddDairyModal, setShowAddDairyModal] = useState(false);
  const [newDairyName, setNewDairyName] = useState('');
  const [newDairyCode, setNewDairyCode] = useState('');
  const [editingDairy, setEditingDairy] = useState<DairyItem | null>(null);

  // Categories Master State
  const [categories, setCategories] = useState<CategoryItem[]>([]);
  const [loadingCategories, setLoadingCategories] = useState(true);
  const [showAddCategoryModal, setShowAddCategoryModal] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newCategoryCode, setNewCategoryCode] = useState('');
  const [editingCategory, setEditingCategory] = useState<CategoryItem | null>(null);

  const [isSeeding, setIsSeeding] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleSeedMasters = async () => {
    setMessage(null);
    setIsSeeding(true);
    try {
      const res = await fetch('/api/master/seed', { method: 'POST' });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed seeding master data');
      setMessage({ type: 'success', text: json.message || 'Master data seeded successfully!' });
      await Promise.all([fetchProducts(), fetchDairies(), fetchCategories()]);
    } catch (err: unknown) {
      setMessage({ type: 'error', text: err instanceof Error ? err.message : 'Error seeding master data' });
    } finally {
      setIsSeeding(false);
    }
  };

  const fetchProducts = async () => {
    try {
      setLoadingProducts(true);
      const res = await fetch('/api/master/products');
      const json = await res.json();
      if (res.ok && json.data) setProducts(json.data);
    } catch {
      // handled silently
    } finally {
      setLoadingProducts(false);
    }
  };

  const fetchDairies = async () => {
    try {
      setLoadingDairies(true);
      const res = await fetch('/api/master/dairies');
      const json = await res.json();
      if (res.ok && json.data) setDairies(json.data);
    } catch {
      // handled silently
    } finally {
      setLoadingDairies(false);
    }
  };

  const fetchCategories = async () => {
    try {
      setLoadingCategories(true);
      const res = await fetch('/api/master/categories');
      const json = await res.json();
      if (res.ok && json.data) setCategories(json.data);
    } catch {
      // handled silently
    } finally {
      setLoadingCategories(false);
    }
  };

  useEffect(() => {
    fetchProducts();
    fetchDairies();
    fetchCategories();
  }, []);

  const handleAddProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);
    if (!newProdKey.trim() || !newProdName.trim()) return;

    try {
      const res = await fetch('/api/master/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          product_key: newProdKey,
          product_name: newProdName,
          short_name: newProdShortName || newProdKey.toUpperCase(),
          category: newProdCategory,
          sort_order: products.length + 1,
        }),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed declaring product');

      setMessage({ type: 'success', text: `Product "${newProdName}" declared successfully!` });
      setShowAddProductModal(false);
      setNewProdKey('');
      setNewProdName('');
      setNewProdShortName('');
      fetchProducts();
    } catch (err: unknown) {
      setMessage({ type: 'error', text: err instanceof Error ? err.message : 'Error declaring product' });
    }
  };

  const handleUpdateProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProduct) return;
    setMessage(null);

    try {
      const res = await fetch('/api/master/products', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editingProduct),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed updating product');

      setMessage({ type: 'success', text: `Product "${editingProduct.product_name}" updated!` });
      setEditingProduct(null);
      fetchProducts();
    } catch (err: unknown) {
      setMessage({ type: 'error', text: err instanceof Error ? err.message : 'Error updating product' });
    }
  };

  const handleAddDairy = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);
    if (!newDairyName.trim()) return;

    try {
      const res = await fetch('/api/master/dairies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dairy_name: newDairyName,
          code: newDairyCode || newDairyName.substring(0, 4).toUpperCase(),
          sort_order: dairies.length + 1,
        }),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed declaring destination dairy');

      setMessage({ type: 'success', text: `Destination Dairy "${newDairyName}" declared successfully!` });
      setShowAddDairyModal(false);
      setNewDairyName('');
      setNewDairyCode('');
      fetchDairies();
    } catch (err: unknown) {
      setMessage({ type: 'error', text: err instanceof Error ? err.message : 'Error declaring dairy' });
    }
  };

  const handleUpdateDairy = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingDairy) return;
    setMessage(null);

    try {
      const res = await fetch('/api/master/dairies', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editingDairy),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed updating destination dairy');

      setMessage({ type: 'success', text: `Destination Dairy "${editingDairy.dairy_name}" updated!` });
      setEditingDairy(null);
      fetchDairies();
    } catch (err: unknown) {
      setMessage({ type: 'error', text: err instanceof Error ? err.message : 'Error updating dairy' });
    }
  };

  const handleAddCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);
    if (!newCategoryName.trim()) return;

    try {
      const res = await fetch('/api/master/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          category_name: newCategoryName,
          code: newCategoryCode || newCategoryName.substring(0, 4).toUpperCase(),
          sort_order: categories.length + 1,
        }),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed declaring category');

      setMessage({ type: 'success', text: `Product Category "${newCategoryName}" declared successfully!` });
      setShowAddCategoryModal(false);
      setNewCategoryName('');
      setNewCategoryCode('');
      fetchCategories();
    } catch (err: unknown) {
      setMessage({ type: 'error', text: err instanceof Error ? err.message : 'Error declaring category' });
    }
  };

  const handleUpdateCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCategory) return;
    setMessage(null);

    try {
      const res = await fetch('/api/master/categories', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editingCategory),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed updating category');

      setMessage({ type: 'success', text: `Product Category "${editingCategory.category_name}" updated!` });
      setEditingCategory(null);
      fetchCategories();
    } catch (err: unknown) {
      setMessage({ type: 'error', text: err instanceof Error ? err.message : 'Error updating category' });
    }
  };

  const { confirm } = useConfirm();

  const handleDeleteProduct = async (id: string, name: string) => {
    const isConfirmed = await confirm({
      title: 'Delete Product',
      message: `Are you sure you want to delete product "${name}"?`,
      confirmText: 'Delete Product',
      cancelText: 'Cancel',
      type: 'danger',
    });
    if (!isConfirmed) return;
    setMessage(null);
    try {
      const res = await fetch(`/api/master/products?id=${id}`, { method: 'DELETE' });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed deleting product');
      setMessage({ type: 'success', text: `Product "${name}" deleted successfully!` });
      fetchProducts();
    } catch (err: unknown) {
      setMessage({ type: 'error', text: err instanceof Error ? err.message : 'Error deleting product' });
    }
  };

  const handleDeleteDairy = async (id: string, name: string) => {
    const isConfirmed = await confirm({
      title: 'Delete Destination Dairy',
      message: `Are you sure you want to delete destination dairy "${name}"?`,
      confirmText: 'Delete Dairy',
      cancelText: 'Cancel',
      type: 'danger',
    });
    if (!isConfirmed) return;
    setMessage(null);
    try {
      const res = await fetch(`/api/master/dairies?id=${id}`, { method: 'DELETE' });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed deleting destination dairy');
      setMessage({ type: 'success', text: `Destination Dairy "${name}" deleted successfully!` });
      fetchDairies();
    } catch (err: unknown) {
      setMessage({ type: 'error', text: err instanceof Error ? err.message : 'Error deleting destination dairy' });
    }
  };

  const handleDeleteCategory = async (id: string, name: string) => {
    const isConfirmed = await confirm({
      title: 'Delete Product Category',
      message: `Are you sure you want to delete product category "${name}"?`,
      confirmText: 'Delete Category',
      cancelText: 'Cancel',
      type: 'danger',
    });
    if (!isConfirmed) return;
    setMessage(null);
    try {
      const res = await fetch(`/api/master/categories?id=${id}`, { method: 'DELETE' });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed deleting category');
      setMessage({ type: 'success', text: `Product Category "${name}" deleted successfully!` });
      fetchCategories();
    } catch (err: unknown) {
      setMessage({ type: 'error', text: err instanceof Error ? err.message : 'Error deleting category' });
    }
  };

  return (
    <div style={{ padding: '24px 32px', maxWidth: 1200, margin: '0 auto' }}>
      {/* Page Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--brand-primary)', margin: 0, display: 'flex', alignItems: 'center', gap: 10 }}>
            <span>⚙️ Master Entity Declarations</span>
          </h1>
          <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', marginTop: 4, margin: 0 }}>
            User-declared master tables for Products (`products_master`), Product Categories (`product_categories_master`), and Destination Union Dairies (`dairy_destinations_master`).
          </p>
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={handleSeedMasters}
            disabled={isSeeding}
            style={{ fontSize: '0.85rem', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 6 }}
            title="Seed default products, categories and destination dairies into database"
          >
            {isSeeding ? '⏳ Seeding...' : '🌱 Seed Default Masters'}
          </button>

          {activeTab === 'PRODUCTS' && (
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => setShowAddProductModal(true)}
              style={{ fontSize: '0.85rem', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 6 }}
            >
              ➕ Declare New Product
            </button>
          )}

          {activeTab === 'DAIRIES' && (
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => setShowAddDairyModal(true)}
              style={{ fontSize: '0.85rem', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 6 }}
            >
              ➕ Declare Destination Dairy
            </button>
          )}

          {activeTab === 'CATEGORIES' && (
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => setShowAddCategoryModal(true)}
              style={{ fontSize: '0.85rem', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 6 }}
            >
              ➕ Declare Product Category
            </button>
          )}
        </div>
      </div>

      {/* Notifications */}
      {message && (
        <div
          style={{
            background: message.type === 'success' ? '#ecfdf5' : '#fef2f2',
            border: `1px solid ${message.type === 'success' ? '#6ee7b7' : '#fca5a5'}`,
            color: message.type === 'success' ? '#065f46' : '#991b1b',
            padding: '12px 16px',
            borderRadius: 8,
            marginBottom: 20,
            fontSize: '0.88rem',
            fontWeight: 600,
          }}
        >
          {message.type === 'success' ? '✅' : '⚠️'} {message.text}
        </div>
      )}

      {/* Navigation Tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20, borderBottom: '2px solid var(--border)' }}>
        <button
          type="button"
          onClick={() => setActiveTab('PRODUCTS')}
          style={{
            padding: '10px 20px',
            fontSize: '0.9rem',
            fontWeight: 700,
            border: 'none',
            background: 'none',
            borderBottom: activeTab === 'PRODUCTS' ? '3px solid var(--brand-primary)' : '3px solid transparent',
            color: activeTab === 'PRODUCTS' ? 'var(--brand-primary)' : 'var(--text-muted)',
            cursor: 'pointer',
          }}
        >
          📦 Products Master ({products.length})
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('CATEGORIES')}
          style={{
            padding: '10px 20px',
            fontSize: '0.9rem',
            fontWeight: 700,
            border: 'none',
            background: 'none',
            borderBottom: activeTab === 'CATEGORIES' ? '3px solid var(--brand-primary)' : '3px solid transparent',
            color: activeTab === 'CATEGORIES' ? 'var(--brand-primary)' : 'var(--text-muted)',
            cursor: 'pointer',
          }}
        >
          🏷️ Product Categories Master ({categories.length})
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('DAIRIES')}
          style={{
            padding: '10px 20px',
            fontSize: '0.9rem',
            fontWeight: 700,
            border: 'none',
            background: 'none',
            borderBottom: activeTab === 'DAIRIES' ? '3px solid var(--brand-primary)' : '3px solid transparent',
            color: activeTab === 'DAIRIES' ? 'var(--brand-primary)' : 'var(--text-muted)',
            cursor: 'pointer',
          }}
        >
          🏢 Destination Dairies Master ({dairies.length})
        </button>
      </div>

      {/* Products Tab View */}
      {activeTab === 'PRODUCTS' && (
        <div className="card" style={{ background: '#fff', borderRadius: 12, border: '1px solid var(--border)', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '1px solid var(--border)', color: 'var(--text-secondary)', textTransform: 'uppercase', fontSize: '0.72rem', letterSpacing: '0.05em' }}>
                <th style={{ padding: '12px 16px' }}>Key / Product Name</th>
                <th style={{ padding: '12px 16px' }}>Short Name</th>
                <th style={{ padding: '12px 16px' }}>Category</th>
                <th style={{ padding: '12px 16px' }}>Status</th>
                <th style={{ padding: '12px 16px' }}>Declared By / Date</th>
                <th style={{ padding: '12px 16px' }}>Updated By / Date</th>
                <th style={{ padding: '12px 16px', textAlign: 'center' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loadingProducts ? (
                <tr><td colSpan={7} style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)' }}>Loading declared products...</td></tr>
              ) : products.map(p => (
                <tr key={p.id} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '12px 16px' }}>
                    <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{p.product_name}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'monospace' }}>{p.product_key}</div>
                  </td>
                  <td style={{ padding: '12px 16px', fontWeight: 600, color: '#0ea5e9' }}>{p.short_name || '—'}</td>
                  <td style={{ padding: '12px 16px', color: 'var(--text-secondary)' }}>{p.category}</td>
                  <td style={{ padding: '12px 16px' }}>
                    <span style={{ padding: '2px 8px', borderRadius: 12, fontSize: '0.72rem', fontWeight: 700, background: p.is_active ? '#d1fae5' : '#fee2e2', color: p.is_active ? '#065f46' : '#991b1b' }}>
                      {p.is_active ? 'Active' : 'Disabled'}
                    </span>
                  </td>
                  <td style={{ padding: '12px 16px', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                    <div><strong>{p.created_by || 'admin'}</strong></div>
                    <div style={{ color: 'var(--text-muted)' }}>{p.created_at ? new Date(p.created_at).toLocaleDateString('en-IN') : '—'}</div>
                  </td>
                  <td style={{ padding: '12px 16px', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                    <div><strong>{p.updated_by || 'admin'}</strong></div>
                    <div style={{ color: 'var(--text-muted)' }}>{p.updated_at ? new Date(p.updated_at).toLocaleDateString('en-IN') : '—'}</div>
                  </td>
                  <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                    <div style={{ display: 'inline-flex', gap: 6 }}>
                      <button type="button" className="btn btn-secondary btn-xs" onClick={() => setEditingProduct(p)}>✏️ Edit</button>
                      <button type="button" className="btn btn-secondary btn-xs" style={{ color: '#ef4444', borderColor: '#fca5a5' }} onClick={() => handleDeleteProduct(p.id, p.product_name)}>✕ Delete</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Categories Tab View */}
      {activeTab === 'CATEGORIES' && (
        <div className="card" style={{ background: '#fff', borderRadius: 12, border: '1px solid var(--border)', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '1px solid var(--border)', color: 'var(--text-secondary)', textTransform: 'uppercase', fontSize: '0.72rem', letterSpacing: '0.05em' }}>
                <th style={{ padding: '12px 16px' }}>Category Name</th>
                <th style={{ padding: '12px 16px' }}>Code</th>
                <th style={{ padding: '12px 16px' }}>Status</th>
                <th style={{ padding: '12px 16px' }}>Declared By / Date</th>
                <th style={{ padding: '12px 16px' }}>Updated By / Date</th>
                <th style={{ padding: '12px 16px', textAlign: 'center' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loadingCategories ? (
                <tr><td colSpan={6} style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)' }}>Loading declared product categories...</td></tr>
              ) : categories.map(c => (
                <tr key={c.id} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '12px 16px', fontWeight: 700, color: 'var(--text-primary)' }}>{c.category_name}</td>
                  <td style={{ padding: '12px 16px', fontWeight: 600, color: '#0ea5e9' }}>{c.code || '—'}</td>
                  <td style={{ padding: '12px 16px' }}>
                    <span style={{ padding: '2px 8px', borderRadius: 12, fontSize: '0.72rem', fontWeight: 700, background: c.is_active ? '#d1fae5' : '#fee2e2', color: c.is_active ? '#065f46' : '#991b1b' }}>
                      {c.is_active ? 'Active' : 'Disabled'}
                    </span>
                  </td>
                  <td style={{ padding: '12px 16px', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                    <div><strong>{c.created_by || 'admin'}</strong></div>
                    <div style={{ color: 'var(--text-muted)' }}>{c.created_at ? new Date(c.created_at).toLocaleDateString('en-IN') : '—'}</div>
                  </td>
                  <td style={{ padding: '12px 16px', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                    <div><strong>{c.updated_by || 'admin'}</strong></div>
                    <div style={{ color: 'var(--text-muted)' }}>{c.updated_at ? new Date(c.updated_at).toLocaleDateString('en-IN') : '—'}</div>
                  </td>
                  <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                    <div style={{ display: 'inline-flex', gap: 6 }}>
                      <button type="button" className="btn btn-secondary btn-xs" onClick={() => setEditingCategory(c)}>✏️ Edit</button>
                      <button type="button" className="btn btn-secondary btn-xs" style={{ color: '#ef4444', borderColor: '#fca5a5' }} onClick={() => handleDeleteCategory(c.id, c.category_name)}>✕ Delete</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Dairies Tab View */}
      {activeTab === 'DAIRIES' && (
        <div className="card" style={{ background: '#fff', borderRadius: 12, border: '1px solid var(--border)', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '1px solid var(--border)', color: 'var(--text-secondary)', textTransform: 'uppercase', fontSize: '0.72rem', letterSpacing: '0.05em' }}>
                <th style={{ padding: '12px 16px' }}>Destination Dairy Name</th>
                <th style={{ padding: '12px 16px' }}>Dairy Code</th>
                <th style={{ padding: '12px 16px' }}>Status</th>
                <th style={{ padding: '12px 16px' }}>Declared By / Date</th>
                <th style={{ padding: '12px 16px' }}>Updated By / Date</th>
                <th style={{ padding: '12px 16px', textAlign: 'center' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loadingDairies ? (
                <tr><td colSpan={6} style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)' }}>Loading declared dairies...</td></tr>
              ) : dairies.map(d => (
                <tr key={d.id} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '12px 16px', fontWeight: 700, color: 'var(--text-primary)' }}>{d.dairy_name}</td>
                  <td style={{ padding: '12px 16px', fontWeight: 600, color: '#d97706' }}>{d.code || '—'}</td>
                  <td style={{ padding: '12px 16px' }}>
                    <span style={{ padding: '2px 8px', borderRadius: 12, fontSize: '0.72rem', fontWeight: 700, background: d.is_active ? '#d1fae5' : '#fee2e2', color: d.is_active ? '#065f46' : '#991b1b' }}>
                      {d.is_active ? 'Active' : 'Disabled'}
                    </span>
                  </td>
                  <td style={{ padding: '12px 16px', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                    <div><strong>{d.created_by || 'admin'}</strong></div>
                    <div style={{ color: 'var(--text-muted)' }}>{d.created_at ? new Date(d.created_at).toLocaleDateString('en-IN') : '—'}</div>
                  </td>
                  <td style={{ padding: '12px 16px', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                    <div><strong>{d.updated_by || 'admin'}</strong></div>
                    <div style={{ color: 'var(--text-muted)' }}>{d.updated_at ? new Date(d.updated_at).toLocaleDateString('en-IN') : '—'}</div>
                  </td>
                  <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                    <div style={{ display: 'inline-flex', gap: 6 }}>
                      <button type="button" className="btn btn-secondary btn-xs" onClick={() => setEditingDairy(d)}>✏️ Edit</button>
                      <button type="button" className="btn btn-secondary btn-xs" style={{ color: '#ef4444', borderColor: '#fca5a5' }} onClick={() => handleDeleteDairy(d.id, d.dairy_name)}>✕ Delete</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Add Product Modal */}
      {showAddProductModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div className="card animate-fade-in" style={{ maxWidth: 460, width: '100%', background: '#fff', borderRadius: 12, padding: 24 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
              <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: 'var(--brand-primary)' }}>➕ Declare New Product</h3>
              <button type="button" style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.2rem' }} onClick={() => setShowAddProductModal(false)}>✖</button>
            </div>
            <form onSubmit={handleAddProduct} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 600, display: 'block', marginBottom: 4 }}>Product Key (identifier)</label>
                <input type="text" placeholder="e.g. flavoured_milk" className="form-input" value={newProdKey} onChange={e => setNewProdKey(e.target.value)} required style={{ width: '100%' }} />
              </div>
              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 600, display: 'block', marginBottom: 4 }}>Product Name</label>
                <input type="text" placeholder="e.g. Flavoured Milk" className="form-input" value={newProdName} onChange={e => setNewProdName(e.target.value)} required style={{ width: '100%' }} />
              </div>
              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 600, display: 'block', marginBottom: 4 }}>Short Name (Abbreviation)</label>
                <input type="text" placeholder="e.g. FM" className="form-input" value={newProdShortName} onChange={e => setNewProdShortName(e.target.value)} style={{ width: '100%' }} />
              </div>
              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 600, display: 'block', marginBottom: 4 }}>Category</label>
                <select className="form-select" value={newProdCategory} onChange={e => setNewProdCategory(e.target.value)} style={{ width: '100%' }}>
                  {categories.length > 0 ? categories.map(c => (
                    <option key={c.id} value={c.category_name}>{c.category_name}</option>
                  )) : (
                    <>
                      <option value="Liquid Milk">Liquid Milk</option>
                      <option value="Products">Products</option>
                      <option value="By-Products">By-Products</option>
                      <option value="Others">Others</option>
                    </>
                  )}
                </select>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 12 }}>
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => setShowAddProductModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary btn-sm">💾 Declare Product</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Product Modal */}
      {editingProduct && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div className="card animate-fade-in" style={{ maxWidth: 460, width: '100%', background: '#fff', borderRadius: 12, padding: 24 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
              <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: 'var(--brand-primary)' }}>✏️ Edit Product: {editingProduct.product_name}</h3>
              <button type="button" style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.2rem' }} onClick={() => setEditingProduct(null)}>✖</button>
            </div>
            <form onSubmit={handleUpdateProduct} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 600, display: 'block', marginBottom: 4 }}>Product Name</label>
                <input type="text" className="form-input" value={editingProduct.product_name} onChange={e => setEditingProduct({ ...editingProduct, product_name: e.target.value })} required style={{ width: '100%' }} />
              </div>
              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 600, display: 'block', marginBottom: 4 }}>Short Name</label>
                <input type="text" className="form-input" value={editingProduct.short_name || ''} onChange={e => setEditingProduct({ ...editingProduct, short_name: e.target.value })} style={{ width: '100%' }} />
              </div>
              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 600, display: 'block', marginBottom: 4 }}>Category</label>
                <select className="form-select" value={editingProduct.category || 'Liquid Milk'} onChange={e => setEditingProduct({ ...editingProduct, category: e.target.value })} style={{ width: '100%' }}>
                  {categories.length > 0 ? categories.map(c => (
                    <option key={c.id} value={c.category_name}>{c.category_name}</option>
                  )) : (
                    <>
                      <option value="Liquid Milk">Liquid Milk</option>
                      <option value="Products">Products</option>
                      <option value="By-Products">By-Products</option>
                      <option value="Others">Others</option>
                    </>
                  )}
                </select>
              </div>
              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 600, display: 'block', marginBottom: 4 }}>Status</label>
                <select className="form-select" value={editingProduct.is_active ? 'active' : 'disabled'} onChange={e => setEditingProduct({ ...editingProduct, is_active: e.target.value === 'active' })} style={{ width: '100%' }}>
                  <option value="active">Active</option>
                  <option value="disabled">Disabled</option>
                </select>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 12 }}>
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => setEditingProduct(null)}>Cancel</button>
                <button type="submit" className="btn btn-primary btn-sm">💾 Save Changes</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Category Modal */}
      {showAddCategoryModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div className="card animate-fade-in" style={{ maxWidth: 460, width: '100%', background: '#fff', borderRadius: 12, padding: 24 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
              <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: 'var(--brand-primary)' }}>➕ Declare Product Category</h3>
              <button type="button" style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.2rem' }} onClick={() => setShowAddCategoryModal(false)}>✖</button>
            </div>
            <form onSubmit={handleAddCategory} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 600, display: 'block', marginBottom: 4 }}>Category Name (e.g. Liquid Milk)</label>
                <input type="text" placeholder="e.g. Liquid Milk" className="form-input" value={newCategoryName} onChange={e => setNewCategoryName(e.target.value)} required style={{ width: '100%' }} />
              </div>
              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 600, display: 'block', marginBottom: 4 }}>Category Code</label>
                <input type="text" placeholder="e.g. MILK" className="form-input" value={newCategoryCode} onChange={e => setNewCategoryCode(e.target.value)} style={{ width: '100%' }} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 12 }}>
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => setShowAddCategoryModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary btn-sm">💾 Declare Category</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Category Modal */}
      {editingCategory && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div className="card animate-fade-in" style={{ maxWidth: 460, width: '100%', background: '#fff', borderRadius: 12, padding: 24 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
              <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: 'var(--brand-primary)' }}>✏️ Edit Category: {editingCategory.category_name}</h3>
              <button type="button" style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.2rem' }} onClick={() => setEditingCategory(null)}>✖</button>
            </div>
            <form onSubmit={handleUpdateCategory} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 600, display: 'block', marginBottom: 4 }}>Category Name</label>
                <input type="text" className="form-input" value={editingCategory.category_name} onChange={e => setEditingCategory({ ...editingCategory, category_name: e.target.value })} required style={{ width: '100%' }} />
              </div>
              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 600, display: 'block', marginBottom: 4 }}>Category Code</label>
                <input type="text" className="form-input" value={editingCategory.code || ''} onChange={e => setEditingCategory({ ...editingCategory, code: e.target.value })} style={{ width: '100%' }} />
              </div>
              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 600, display: 'block', marginBottom: 4 }}>Status</label>
                <select className="form-select" value={editingCategory.is_active ? 'active' : 'disabled'} onChange={e => setEditingCategory({ ...editingCategory, is_active: e.target.value === 'active' })} style={{ width: '100%' }}>
                  <option value="active">Active</option>
                  <option value="disabled">Disabled</option>
                </select>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 12 }}>
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => setEditingCategory(null)}>Cancel</button>
                <button type="submit" className="btn btn-primary btn-sm">💾 Save Changes</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Dairy Modal */}
      {showAddDairyModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div className="card animate-fade-in" style={{ maxWidth: 460, width: '100%', background: '#fff', borderRadius: 12, padding: 24 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
              <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: 'var(--brand-primary)' }}>➕ Declare Destination Dairy</h3>
              <button type="button" style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.2rem' }} onClick={() => setShowAddDairyModal(false)}>✖</button>
            </div>
            <form onSubmit={handleAddDairy} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 600, display: 'block', marginBottom: 4 }}>Dairy Name (e.g. Trichy-SSM)</label>
                <input type="text" placeholder="e.g. Trichy-SSM" className="form-input" value={newDairyName} onChange={e => setNewDairyName(e.target.value)} required style={{ width: '100%' }} />
              </div>
              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 600, display: 'block', marginBottom: 4 }}>Dairy Code</label>
                <input type="text" placeholder="e.g. TRY" className="form-input" value={newDairyCode} onChange={e => setNewDairyCode(e.target.value)} style={{ width: '100%' }} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 12 }}>
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => setShowAddDairyModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary btn-sm">💾 Declare Dairy</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Dairy Modal */}
      {editingDairy && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div className="card animate-fade-in" style={{ maxWidth: 460, width: '100%', background: '#fff', borderRadius: 12, padding: 24 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
              <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: 'var(--brand-primary)' }}>✏️ Edit Dairy: {editingDairy.dairy_name}</h3>
              <button type="button" style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.2rem' }} onClick={() => setEditingDairy(null)}>✖</button>
            </div>
            <form onSubmit={handleUpdateDairy} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 600, display: 'block', marginBottom: 4 }}>Dairy Name</label>
                <input type="text" className="form-input" value={editingDairy.dairy_name} onChange={e => setEditingDairy({ ...editingDairy, dairy_name: e.target.value })} required style={{ width: '100%' }} />
              </div>
              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 600, display: 'block', marginBottom: 4 }}>Dairy Code</label>
                <input type="text" className="form-input" value={editingDairy.code || ''} onChange={e => setEditingDairy({ ...editingDairy, code: e.target.value })} style={{ width: '100%' }} />
              </div>
              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 600, display: 'block', marginBottom: 4 }}>Status</label>
                <select className="form-select" value={editingDairy.is_active ? 'active' : 'disabled'} onChange={e => setEditingDairy({ ...editingDairy, is_active: e.target.value === 'active' })} style={{ width: '100%' }}>
                  <option value="active">Active</option>
                  <option value="disabled">Disabled</option>
                </select>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 12 }}>
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => setEditingDairy(null)}>Cancel</button>
                <button type="submit" className="btn btn-primary btn-sm">💾 Save Changes</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

