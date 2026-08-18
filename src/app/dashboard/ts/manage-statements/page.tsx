// ─────────────────────────────────────────────────────────────────────────────
// Aavin Dashboard – Manage Statements Configuration Page
// Allows adding, renaming, and deleting custom solid balance (STG) statements
// ─────────────────────────────────────────────────────────────────────────────

'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Header from '@/components/layout/Header';
import Link from 'next/link';

interface StatementConfig {
  key: string;
  label: string;
}

export default function ManageStatementsPage() {
  const router = useRouter();
  const [statements, setStatements] = useState<StatementConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Load global statements list template from DB
  useEffect(() => {
    async function loadConfig() {
      try {
        const res = await fetch('/api/entries?report_type=TS');
        if (!res.ok) {
          setLoading(false);
          return;
        }
        const json = await res.json();
        const entries: any[] = json.data || [];
        const configEntry = entries.find((e: any) => {
          if (!e.notes || e.notes.includes('__METADATA__:')) return false;
          try {
            const parsed = JSON.parse(e.notes);
            return Array.isArray(parsed) && (parsed.length === 0 || parsed[0]?.key !== undefined);
          } catch { return false; }
        });
        if (configEntry && configEntry.notes) {
          try {
            const list = JSON.parse(configEntry.notes);
            if (Array.isArray(list) && list.length > 0) {
              setStatements(list);
            }
          } catch (e) {
            console.error('Failed to parse global config notes:', e);
          }
        }
      } catch (err) {
        console.error('Error loading statement config:', err);
      } finally {
        setLoading(false);
      }
    }
    loadConfig();
  }, []);

  const handleSave = async () => {
    // Validate empty labels
    const hasEmptyLabel = statements.some(s => s.label.trim() === '');
    if (hasEmptyLabel) {
      setError('Please fill in names for all statements before saving.');
      return;
    }

    // Validate empty keys
    const hasEmptyKey = statements.some(s => s.key.trim() === '');
    if (hasEmptyKey) {
      setError('Please fill in shortkeys/keys for all statements before saving.');
      return;
    }

    // Validate duplicate keys
    const keys = statements.map(s => s.key.trim().toUpperCase());
    const uniqueKeys = new Set(keys);
    if (uniqueKeys.size !== keys.length) {
      setError('Duplicate shortkeys are not allowed.');
      return;
    }

    setSaving(true);
    setError('');
    setSuccess('');
    try {
      const res = await fetch('/api/entries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          report_type: 'TS',
          notes: JSON.stringify(statements),
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to save configuration.');
      }
      setSuccess('Statement configurations saved successfully!');
      window.alert('Statement configurations saved successfully!');
      setTimeout(() => setSuccess(''), 4000);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const addStatement = () => {
    setStatements(prev => [...prev, { key: '', label: '' }]);
  };

  const addStatementAfter = (index: number) => {
    setStatements(prev => {
      const next = [...prev];
      next.splice(index + 1, 0, { key: '', label: '' });
      return next;
    });
  };

  const deleteStatement = (key: string, label: string) => {
    const ok = window.confirm(`Are you sure you want to delete "${label || 'Unnamed Statement'}" from the template?`);
    if (!ok) return;

    setStatements(prev => prev.filter(s => s.key !== key));
  };

  return (
    <>
      <Header
        title="Manage Statements"
        subtitle="Configure the templates and product blocks for the Solid Balance (STG) reports"
        actions={
          <Link href="/dashboard/ts" className="btn btn-secondary btn-sm">
            ← Back to TS Dashboard
          </Link>
        }
      />

      <div className="page-body animate-fade-in" style={{ maxWidth: 800 }}>
        {error && <div className="alert alert-error">⚠️ {error}</div>}
        {success && <div className="alert alert-success">✅ {success}</div>}

        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <h3 style={{ margin: 0, color: 'var(--brand-primary)' }}>STG Statements Template</h3>
            <button type="button" className="btn btn-secondary btn-sm" onClick={addStatement}>
              ➕ Add Statement
            </button>
          </div>

          {loading ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 24 }}>
              <span className="spinner" /> Loading statement list...
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {statements.map((s, index) => {
                let duplicateStatement: StatementConfig | undefined;
                if (s.key.trim() !== '') {
                  duplicateStatement = statements.find((other, otherIdx) =>
                    otherIdx !== index && other.key.trim().toUpperCase() === s.key.trim().toUpperCase()
                  );
                }

                return (
                  <div
                    key={index}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '12px 18px',
                      background: '#f8fafc',
                      border: '1px solid var(--border)',
                      borderRadius: 8,
                    }}
                  >
                    <div style={{ flexGrow: 1, marginRight: 16, display: 'flex', gap: 16, alignItems: 'flex-end', flexWrap: 'wrap' }}>
                      <div style={{ minWidth: 200, flex: 2 }}>
                        <label className="form-label" style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: 4, display: 'block' }}>
                          Statement Name
                        </label>
                        <input
                          type="text"
                          className="form-input"
                          style={{ fontSize: '0.9rem', fontWeight: 600, padding: '6px 12px', width: '100%' }}
                          value={s.label}
                          onChange={(e) => {
                            const val = e.target.value;
                            setStatements(prev => {
                              const list = [...prev];
                              list[index] = { ...list[index], label: val };
                              return list;
                            });
                          }}
                          placeholder="Enter statement name (e.g. Whole Milk)..."
                          autoFocus={s.label === ''}
                        />
                      </div>
                      <div style={{ minWidth: 100, flex: 1 }}>
                        <label className="form-label" style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: 4, display: 'block' }}>
                          Shortkey / Key
                        </label>
                        <input
                          type="text"
                          className="form-input"
                          style={{ fontSize: '0.9rem', fontWeight: 600, padding: '6px 12px', width: '100%', textTransform: 'uppercase', borderColor: duplicateStatement ? '#ef4444' : undefined }}
                          value={s.key}
                          onChange={(e) => {
                            const val = e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, '');
                            setStatements(prev => {
                              const list = [...prev];
                              list[index] = { ...list[index], key: val };
                              return list;
                            });
                          }}
                          placeholder="e.g. WM"
                        />
                        {duplicateStatement && (
                          <div style={{ fontSize: '0.7rem', color: '#ef4444', marginTop: 4 }}>
                            ⚠️ Already used for "{duplicateStatement.label || 'Unnamed'}"
                          </div>
                        )}
                      </div>
                    </div>

                    <div style={{ alignSelf: 'flex-end', paddingBottom: 2, display: 'flex', gap: 8 }}>
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        style={{ padding: '6px 12px', fontSize: '0.75rem', color: 'var(--brand-primary)', border: '1px solid var(--border)' }}
                        onClick={() => addStatementAfter(index)}
                      >
                        ➕ Insert Below
                      </button>
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        style={{ padding: '6px 12px', fontSize: '0.75rem', color: '#ef4444', border: '1px solid #fca5a5' }}
                        onClick={() => deleteStatement(s.key, s.label)}
                      >
                        ❌ Delete
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 24, borderTop: '1px solid var(--border)', paddingTop: 16 }}>
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleSave}
              disabled={saving || loading}
              style={{ padding: '10px 24px' }}
            >
              {saving ? 'Saving changes...' : '💾 Save Configurations'}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
