'use client';

import { useState, useEffect, useMemo } from 'react';
import Header from '@/components/layout/Header';
import Link from 'next/link';
import { useConfirm } from '@/context/ConfirmContext';
import { DEFAULT_STG_TO_TS_RULES, StgToTsMappingRule } from '@/app/api/ts/stg-mappings/route';

const TS_SECTION_META: Record<string, { label: string; icon: string; color: string }> = {
  OB: { label: 'Arrival – Opening Balance (O/B)', icon: '📦', color: '#0284c7' },
  RECEIPT: { label: 'Arrival – Receipts', icon: '📥', color: '#16a34a' },
  DISPOSAL_DESPATCH: { label: 'Disposal – Despatch / Sale', icon: '🚚', color: '#ea580c' },
  LOCAL_SALE: { label: 'Disposal – Local Sales', icon: '🏪', color: '#8b5cf6' },
  OTHER_DISPOSAL: { label: 'Disposal – Other Disposal', icon: '🔄', color: '#d97706' },
  CB: { label: 'Disposal – Closing Balance (C/B)', icon: '🔒', color: '#0d9488' },
};

const STG_FIELD_OPTIONS = [
  { value: 'all', label: 'All Columns / Whole Row (Lts, Kg, Fat%, SNF%, Sp.Gr, Kg Fat, Kg SNF)' },
  { value: 'qty_lts', label: 'Milk (Lit) - qty_lts' },
  { value: 'qty_kg', label: 'Milk (Kg) - qty_kg' },
  { value: 'fat_pct', label: 'Avg Fat % - fat_pct' },
  { value: 'snf_pct', label: 'Avg SNF % - snf_pct' },
  { value: 'sp_gr', label: 'Sp. Gr - sp_gr' },
  { value: 'kg_fat', label: 'Kg Fat - kg_fat' },
  { value: 'kg_snf', label: 'Kg SNF - kg_snf' },
];

export default function StgToTsMappingPage() {
  const { confirm } = useConfirm();

  const [rules, setRules] = useState<StgToTsMappingRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // STG masters from API for dropdowns
  const [stgStatements, setStgStatements] = useState<Array<{ key: string; label: string }>>([]);

  // Accordion open/close state
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    OB: true,
    RECEIPT: true,
    DISPOSAL_DESPATCH: true,
    LOCAL_SALE: true,
    OTHER_DISPOSAL: true,
    CB: true,
  });

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [formSourceStmt, setFormSourceStmt] = useState('wm');
  const [formSourceSection, setFormSourceSection] = useState<'OB' | 'RECEIPT' | 'DISPOSAL' | 'CB' | 'RECON'>('OB');
  const [formSourceRowName, setFormSourceRowName] = useState('OB');
  const [formSourceField, setFormSourceField] = useState('all');

  const [formTargetSection, setFormTargetSection] = useState<
    'OB' | 'RECEIPT' | 'DISPOSAL_DESPATCH' | 'LOCAL_SALE' | 'OTHER_DISPOSAL' | 'CB'
  >('OB');
  const [formTargetParticular, setFormTargetParticular] = useState('WM');
  const [formTargetField, setFormTargetField] = useState('all');
  const [formDescription, setFormDescription] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      // 1. Fetch STG Statements
      try {
        const stmtRes = await fetch('/api/ts/masters');
        if (stmtRes.ok) {
          const stmtJson = await stmtRes.json();
          if (Array.isArray(stmtJson.masters)) {
            setStgStatements(
              stmtJson.masters.map((m: any) => ({
                key: m.key,
                label: m.label || m.name || m.key,
              }))
            );
          }
        }
      } catch (e) {
        console.warn('Failed fetching stg masters:', e);
      }

      // 2. Fetch STG ➔ TS Rules
      const rulesRes = await fetch('/api/ts/stg-mappings');
      if (rulesRes.ok) {
        const rulesJson = await rulesRes.json();
        if (Array.isArray(rulesJson.rules)) {
          setRules(rulesJson.rules);
        }
      }
    } catch (err) {
      console.error('Failed loading mapping data:', err);
    }
    setLoading(false);
  };

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const saveToApi = async (rulesToSave: StgToTsMappingRule[]) => {
    setSaving(true);
    try {
      const res = await fetch('/api/ts/stg-mappings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rules: rulesToSave }),
      });
      if (res.ok) {
        showToast('✅ STG ➔ TS Statement mappings saved successfully!');
        setHasUnsavedChanges(false);
      } else {
        showToast('❌ Failed to save mappings');
      }
    } catch (err) {
      console.error('Save mapping error:', err);
      showToast('❌ Error connecting to server');
    }
    setSaving(false);
  };

  const handleResetToDefaults = async () => {
    const ok = await confirm({
      title: 'Reset to Excel Default Mappings',
      message: 'This will restore all default cell-to-cell mapping rules linking STG statement rows to Total Solids (TS) Statement rows matching 01-05-2026-TS.xlsx. Continue?',
      confirmText: 'Reset Mappings',
      cancelText: 'Cancel',
      type: 'warning',
    });
    if (!ok) return;

    setRules(DEFAULT_STG_TO_TS_RULES);
    setHasUnsavedChanges(true);
    showToast('🔄 Restored Excel default mapping rules (click "Save" to commit)');
  };

  const toggleSection = (sec: string) => {
    setOpenSections(prev => ({ ...prev, [sec]: !prev[sec] }));
  };

  const handleExpandAll = () => {
    setOpenSections({
      OB: true,
      RECEIPT: true,
      DISPOSAL_DESPATCH: true,
      LOCAL_SALE: true,
      OTHER_DISPOSAL: true,
      CB: true,
    });
  };

  const handleCollapseAll = () => {
    setOpenSections({
      OB: false,
      RECEIPT: false,
      DISPOSAL_DESPATCH: false,
      LOCAL_SALE: false,
      OTHER_DISPOSAL: false,
      CB: false,
    });
  };

  const handleToggleRule = (id: string) => {
    setRules(prev => prev.map(r => (r.id === id ? { ...r, enabled: !r.enabled } : r)));
    setHasUnsavedChanges(true);
  };

  const handleDeleteRule = async (id: string, label: string) => {
    const ok = await confirm({
      title: 'Delete Mapping Rule',
      message: `Delete rule for "${label}"? Click "Save STG ➔ TS Mappings" to persist.`,
      confirmText: 'Delete Rule',
      cancelText: 'Cancel',
      type: 'danger',
    });
    if (!ok) return;

    setRules(prev => prev.filter(r => r.id !== id));
    setHasUnsavedChanges(true);
    showToast(`🗑️ Removed rule "${label}"`);
  };

  const handleOpenAdd = (targetSec?: any) => {
    setEditingId(null);
    setFormSourceStmt('wm');
    setFormSourceSection('OB');
    setFormSourceRowName('OB');
    setFormSourceField('all');

    setFormTargetSection(targetSec || 'OB');
    setFormTargetParticular('');
    setFormTargetField('all');
    setFormDescription('');
    setIsModalOpen(true);
  };

  const handleOpenEdit = (rule: StgToTsMappingRule) => {
    setEditingId(rule.id);
    setFormSourceStmt(rule.source_statement_key);
    setFormSourceSection(rule.source_section);
    setFormSourceRowName(rule.source_row_name);
    setFormSourceField(rule.source_field || 'all');

    setFormTargetSection(rule.target_section);
    setFormTargetParticular(rule.target_particular);
    setFormTargetField(rule.target_field || 'all');
    setFormDescription(rule.description || '');
    setIsModalOpen(true);
  };

  const handleModalSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTargetParticular.trim()) {
      showToast('❌ Target TS Particular name is required');
      return;
    }

    const newRule: StgToTsMappingRule = {
      id: editingId || `rule_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      rule_key: editingId || `rule_${Date.now()}`,
      source_statement_key: formSourceStmt,
      source_section: formSourceSection,
      source_row_name: formSourceRowName.trim(),
      source_field: formSourceField,
      target_section: formTargetSection,
      target_particular: formTargetParticular.trim().toUpperCase(),
      target_field: formTargetField,
      enabled: true,
      description:
        formDescription.trim() ||
        `STG ${formSourceStmt.toUpperCase()} ${formSourceSection} (${formSourceRowName}) ➔ TS ${formTargetParticular} (${formTargetSection})`,
    };

    if (editingId) {
      setRules(prev => prev.map(r => (r.id === editingId ? newRule : r)));
    } else {
      setRules(prev => [...prev, newRule]);
    }

    setHasUnsavedChanges(true);
    setIsModalOpen(false);
    showToast(editingId ? `✏️ Updated rule` : `➕ Added new mapping rule`);
  };

  // Group rules by target section
  const filteredRules = useMemo(() => {
    if (!searchQuery.trim()) return rules;
    const q = searchQuery.toLowerCase();
    return rules.filter(
      r =>
        r.target_particular.toLowerCase().includes(q) ||
        r.source_statement_key.toLowerCase().includes(q) ||
        r.source_row_name.toLowerCase().includes(q) ||
        (r.description && r.description.toLowerCase().includes(q))
    );
  }, [rules, searchQuery]);

  const rulesBySection = useMemo(() => {
    const map: Record<string, StgToTsMappingRule[]> = {
      OB: [],
      RECEIPT: [],
      DISPOSAL_DESPATCH: [],
      LOCAL_SALE: [],
      OTHER_DISPOSAL: [],
      CB: [],
    };
    filteredRules.forEach(r => {
      if (map[r.target_section]) {
        map[r.target_section].push(r);
      } else {
        if (!map['OTHER_DISPOSAL']) map['OTHER_DISPOSAL'] = [];
        map['OTHER_DISPOSAL'].push(r);
      }
    });
    return map;
  }, [filteredRules]);

  return (
    <>
      <Header
        title="Solid Balance STG ➔ Total Solids (TS) Statement Mapping"
        subtitle="Configure dynamic cell-to-cell mapping rules transferring values from Stage 3 (Solid Balance STG) to Stage 4 (Total Solids TS)"
        actions={
          <div style={{ display: 'flex', gap: 10 }}>
            <button
              onClick={handleResetToDefaults}
              className="btn btn-outline btn-sm"
              style={{ fontWeight: 600 }}
              title="Reset all rules to Excel template default mappings"
            >
              🔄 Reset to Excel Defaults
            </button>
            <Link href="/dashboard/ts/defaults" className="btn btn-secondary btn-sm">
              ⭐ Master Default Statement
            </Link>
            <Link href="/dashboard/ts/columns" className="btn btn-secondary btn-sm">
              ⚙️ TS Columns Config
            </Link>
            <button
              onClick={() => saveToApi(rules)}
              disabled={saving}
              className="btn btn-primary btn-sm"
              style={{ fontWeight: 600 }}
            >
              {saving ? 'Saving...' : '💾 Save STG ➔ TS Mappings'}
            </button>
          </div>
        }
      />

      <div className="page-body animate-fade-in" style={{ padding: 20 }}>
        {toastMessage && (
          <div
            style={{
              position: 'fixed',
              top: 20,
              right: 20,
              zIndex: 9999,
              background: '#0f172a',
              color: '#fff',
              padding: '12px 20px',
              borderRadius: 8,
              boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
              fontSize: '0.875rem',
              fontWeight: 500,
            }}
          >
            {toastMessage}
          </div>
        )}

        {hasUnsavedChanges && (
          <div
            style={{
              background: '#fef3c7',
              border: '1px solid #f59e0b',
              color: '#92400e',
              padding: '12px 18px',
              borderRadius: 8,
              marginBottom: 16,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: '1.2rem' }}>⚠️</span>
              <span style={{ fontWeight: 600 }}>You have unsaved changes in STG ➔ TS Mapping Rules.</span>
              <span style={{ fontSize: '0.875rem' }}>Remember to click &quot;Save STG ➔ TS Mappings&quot; to apply to TS Entry.</span>
            </div>
            <button
              onClick={() => saveToApi(rules)}
              disabled={saving}
              className="btn btn-primary btn-sm"
              style={{ padding: '6px 14px' }}
            >
              {saving ? 'Saving...' : 'Save Mappings'}
            </button>
          </div>
        )}

        {/* Top Control Bar */}
        <div
          className="card"
          style={{
            marginBottom: 20,
            padding: '14px 20px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 12,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>Search Rules:</span>
            <input
              type="text"
              className="form-input"
              style={{ width: 280, padding: '6px 12px' }}
              placeholder="Filter by row name or statement..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="btn btn-outline btn-sm"
                style={{ padding: '4px 8px' }}
              >
                Clear
              </button>
            )}
            <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              {filteredRules.length} of {rules.length} rules
            </span>
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" onClick={handleExpandAll} className="btn btn-secondary btn-sm">
              Expand All
            </button>
            <button type="button" onClick={handleCollapseAll} className="btn btn-secondary btn-sm">
              Collapse All
            </button>
            <button onClick={() => handleOpenAdd()} className="btn btn-primary btn-sm" style={{ fontWeight: 600 }}>
              ➕ Add Mapping Rule
            </button>
          </div>
        </div>

        {/* Accordions by Section */}
        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-secondary)' }}>
            <span className="spinner" /> Loading mapping rules...
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {Object.entries(TS_SECTION_META).map(([secKey, meta]) => {
              const secRules = rulesBySection[secKey] || [];
              const isOpen = openSections[secKey] !== false;

              return (
                <div
                  key={secKey}
                  className="card"
                  style={{
                    padding: 0,
                    overflow: 'hidden',
                    border: '1px solid var(--border)',
                  }}
                >
                  {/* Accordion Header */}
                  <div
                    onClick={() => toggleSection(secKey)}
                    style={{
                      padding: '14px 20px',
                      background: '#f8fafc',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      cursor: 'pointer',
                      borderBottom: isOpen ? '1px solid var(--border)' : 'none',
                      userSelect: 'none',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ fontSize: '1.25rem' }}>{meta.icon}</span>
                      <span style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--text-primary)' }}>
                        {meta.label}
                      </span>
                      <span
                        style={{
                          background: meta.color,
                          color: '#fff',
                          padding: '2px 8px',
                          borderRadius: 12,
                          fontSize: '0.75rem',
                          fontWeight: 700,
                        }}
                      >
                        {secRules.length} Rules
                      </span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <button
                        type="button"
                        onClick={e => {
                          e.stopPropagation();
                          handleOpenAdd(secKey);
                        }}
                        className="btn btn-secondary btn-sm"
                        style={{ padding: '3px 10px', fontSize: '0.8rem' }}
                      >
                        + Add Rule
                      </button>
                      <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                        {isOpen ? '▲' : '▼'}
                      </span>
                    </div>
                  </div>

                  {/* Accordion Body */}
                  {isOpen && (
                    <div>
                      {secRules.length === 0 ? (
                        <div style={{ padding: '24px 20px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                          No mapping rules configured for this section.{' '}
                          <button
                            type="button"
                            onClick={() => handleOpenAdd(secKey)}
                            className="btn btn-link btn-sm"
                            style={{ color: 'var(--brand-primary)', fontWeight: 600 }}
                          >
                            Add Rule
                          </button>
                        </div>
                      ) : (
                        <div className="table-wrapper">
                          <table className="data-table" style={{ width: '100%' }}>
                            <thead>
                              <tr style={{ background: '#fafafa' }}>
                                <th style={{ width: 50, textAlign: 'center' }}>#</th>
                                <th>Target TS Particular</th>
                                <th>Target Field</th>
                                <th style={{ textAlign: 'center', width: 40 }}>➔</th>
                                <th>Source STG Block</th>
                                <th>Source Section</th>
                                <th>Source STG Row</th>
                                <th>Source Field</th>
                                <th style={{ textAlign: 'center' }}>Enabled</th>
                                <th style={{ width: 120, textAlign: 'center' }}>Actions</th>
                              </tr>
                            </thead>
                            <tbody>
                              {secRules.map((rule, idx) => (
                                <tr key={rule.id} style={{ opacity: rule.enabled ? 1 : 0.55 }}>
                                  <td style={{ textAlign: 'center', fontWeight: 600, color: 'var(--text-secondary)' }}>
                                    {idx + 1}
                                  </td>
                                  <td style={{ fontWeight: 700, color: 'var(--text-primary)' }}>
                                    <span
                                      style={{
                                        background: '#eff6ff',
                                        color: '#1d4ed8',
                                        padding: '3px 8px',
                                        borderRadius: 4,
                                        fontSize: '0.85rem',
                                      }}
                                    >
                                      {rule.target_particular}
                                    </span>
                                  </td>
                                  <td>
                                    <code style={{ fontSize: '0.8rem', color: '#475569' }}>
                                      {rule.target_field || 'all'}
                                    </code>
                                  </td>
                                  <td style={{ textAlign: 'center', color: 'var(--text-secondary)', fontWeight: 700 }}>
                                    ➔
                                  </td>
                                  <td style={{ fontWeight: 600, color: '#0f172a' }}>
                                    {rule.source_statement_key.toUpperCase()}
                                  </td>
                                  <td>
                                    <span
                                      className="badge"
                                      style={{
                                        fontSize: '0.75rem',
                                        background: '#f1f5f9',
                                        color: '#334155',
                                        padding: '2px 6px',
                                      }}
                                    >
                                      {rule.source_section}
                                    </span>
                                  </td>
                                  <td style={{ fontWeight: 600 }}>
                                    {rule.source_row_name}
                                  </td>
                                  <td>
                                    <code style={{ fontSize: '0.8rem', color: '#475569' }}>
                                      {rule.source_field || 'all'}
                                    </code>
                                  </td>
                                  <td style={{ textAlign: 'center' }}>
                                    <button
                                      type="button"
                                      onClick={() => handleToggleRule(rule.id)}
                                      style={{
                                        cursor: 'pointer',
                                        background: 'transparent',
                                        border: 'none',
                                        fontSize: '1.1rem',
                                      }}
                                      title={rule.enabled ? 'Enabled (Click to disable)' : 'Disabled (Click to enable)'}
                                    >
                                      {rule.enabled ? '✅' : '⚪'}
                                    </button>
                                  </td>
                                  <td style={{ textAlign: 'center' }}>
                                    <div style={{ display: 'inline-flex', gap: 6 }}>
                                      <button
                                        type="button"
                                        onClick={() => handleOpenEdit(rule)}
                                        className="btn btn-secondary btn-sm"
                                        style={{ padding: '2px 8px', fontSize: '0.8rem' }}
                                      >
                                        ✏️ Edit
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => handleDeleteRule(rule.id, rule.target_particular)}
                                        className="btn btn-outline btn-sm"
                                        style={{
                                          padding: '2px 8px',
                                          fontSize: '0.8rem',
                                          color: 'var(--brand-danger)',
                                          borderColor: 'var(--brand-danger)',
                                        }}
                                      >
                                        🗑️
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
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Add / Edit Rule Modal */}
      {isModalOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: 20,
          }}
        >
          <div
            className="card"
            style={{
              maxWidth: 620,
              width: '100%',
              padding: 24,
              boxShadow: '0 10px 25px rgba(0,0,0,0.2)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700 }}>
                {editingId ? '✏️ Edit STG ➔ TS Mapping Rule' : '➕ Add STG ➔ TS Mapping Rule'}
              </h3>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  fontSize: '1.25rem',
                  cursor: 'pointer',
                  color: 'var(--text-secondary)',
                }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleModalSave}>
              {/* Target Section (Stage 4 TS) */}
              <div
                style={{
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: 8,
                  padding: 14,
                  marginBottom: 16,
                }}
              >
                <div style={{ fontWeight: 700, fontSize: '0.9rem', marginBottom: 10, color: '#0f172a' }}>
                  🎯 Target: Total Solids (TS) Statement Cell
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <label className="form-label" style={{ fontWeight: 600, fontSize: '0.8rem' }}>
                      Target Section <span style={{ color: 'red' }}>*</span>
                    </label>
                    <select
                      className="form-input"
                      value={formTargetSection}
                      onChange={e => setFormTargetSection(e.target.value as any)}
                    >
                      <option value="OB">Arrival – Opening Balance (O/B)</option>
                      <option value="RECEIPT">Arrival – Receipts</option>
                      <option value="DISPOSAL_DESPATCH">Disposal – Despatch / Sale</option>
                      <option value="LOCAL_SALE">Disposal – Local Sales</option>
                      <option value="OTHER_DISPOSAL">Disposal – Other Disposal</option>
                      <option value="CB">Disposal – Closing Balance (C/B)</option>
                    </select>
                  </div>

                  <div>
                    <label className="form-label" style={{ fontWeight: 600, fontSize: '0.8rem' }}>
                      Target Particular (Row) <span style={{ color: 'red' }}>*</span>
                    </label>
                    <input
                      type="text"
                      required
                      className="form-input"
                      placeholder="e.g. WM, P.VELUR CC, AMBATTUR-SSM"
                      value={formTargetParticular}
                      onChange={e => setFormTargetParticular(e.target.value.toUpperCase())}
                    />
                  </div>
                </div>

                <div style={{ marginTop: 10 }}>
                  <label className="form-label" style={{ fontWeight: 600, fontSize: '0.8rem' }}>
                    Target Field
                  </label>
                  <select
                    className="form-input"
                    value={formTargetField}
                    onChange={e => setFormTargetField(e.target.value)}
                  >
                    {STG_FIELD_OPTIONS.map(opt => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Source Section (Stage 3 STG) */}
              <div
                style={{
                  background: '#f0fdf4',
                  border: '1px solid #bbf7d0',
                  borderRadius: 8,
                  padding: 14,
                  marginBottom: 16,
                }}
              >
                <div style={{ fontWeight: 700, fontSize: '0.9rem', marginBottom: 10, color: '#166534' }}>
                  📦 Source: Solid Balance STG Statement Cell
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <label className="form-label" style={{ fontWeight: 600, fontSize: '0.8rem' }}>
                      Source Statement Master Block <span style={{ color: 'red' }}>*</span>
                    </label>
                    <select
                      className="form-input"
                      value={formSourceStmt}
                      onChange={e => setFormSourceStmt(e.target.value)}
                    >
                      {stgStatements.length > 0 ? (
                        stgStatements.map(stmt => (
                          <option key={stmt.key} value={stmt.key}>
                            {stmt.label} ({stmt.key})
                          </option>
                        ))
                      ) : (
                        <>
                          <option value="wm">Whole Milk (wm)</option>
                          <option value="ssm">Standardised Skim Milk (ssm)</option>
                          <option value="cream">Cream (cream)</option>
                          <option value="dlt_milk">Double Toned Milk (dlt_milk)</option>
                          <option value="fc_milk">Full Cream Milk (fc_milk)</option>
                          <option value="std_milk">Standard Milk (std_milk)</option>
                          <option value="smp">Skim Milk Powder (smp)</option>
                        </>
                      )}
                    </select>
                  </div>

                  <div>
                    <label className="form-label" style={{ fontWeight: 600, fontSize: '0.8rem' }}>
                      Source Section <span style={{ color: 'red' }}>*</span>
                    </label>
                    <select
                      className="form-input"
                      value={formSourceSection}
                      onChange={e => setFormSourceSection(e.target.value as any)}
                    >
                      <option value="OB">Opening Balance (OB)</option>
                      <option value="RECEIPT">Receipts</option>
                      <option value="DISPOSAL">Disposals</option>
                      <option value="CB">Closing Balance (CB)</option>
                      <option value="RECON">Reconciliation Summary</option>
                    </select>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 10 }}>
                  <div>
                    <label className="form-label" style={{ fontWeight: 600, fontSize: '0.8rem' }}>
                      Source Row / Particular Name <span style={{ color: 'red' }}>*</span>
                    </label>
                    <input
                      type="text"
                      required
                      className="form-input"
                      placeholder="e.g. OB, P.VELUR CC, AMBATTUR-SSM, CB"
                      value={formSourceRowName}
                      onChange={e => setFormSourceRowName(e.target.value)}
                    />
                  </div>

                  <div>
                    <label className="form-label" style={{ fontWeight: 600, fontSize: '0.8rem' }}>
                      Source Field
                    </label>
                    <select
                      className="form-input"
                      value={formSourceField}
                      onChange={e => setFormSourceField(e.target.value)}
                    >
                      {STG_FIELD_OPTIONS.map(opt => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Description */}
              <div style={{ marginBottom: 18 }}>
                <label className="form-label" style={{ fontWeight: 600, fontSize: '0.8rem' }}>
                  Rule Description (Optional)
                </label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. Map STG WM Opening Balance to TS WM O/B"
                  value={formDescription}
                  onChange={e => setFormDescription(e.target.value)}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                <button type="button" onClick={() => setIsModalOpen(false)} className="btn btn-secondary btn-sm">
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary btn-sm">
                  {editingId ? 'Update Rule' : 'Add Rule'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

