// ─────────────────────────────────────────────────────────────────────────────
// src/components/ui/KeyField.tsx
// Antigravity Key Field component for dynamic schema entities
// - Auto-formats to snake_case
// - Validates client-side uniqueness
// - Fully editable in edit mode (never locked)
// - Supports dry-run inspection and confirmation dialog with table cascade counts
// ─────────────────────────────────────────────────────────────────────────────

'use client';

import React, { useState } from 'react';
import { useConfirm } from '@/context/ConfirmContext';
import { mutate } from 'swr';

export type KeyScope =
  | 'product'
  | 'prep_chart'
  | 'prep_chart_column'
  | 'statement'
  | 'stg_column'
  | 'ts_column'
  | 'rule'
  | 'dairy';

export interface KeyFieldProps {
  label?: string;
  value: string;
  onChange: (val: string) => void;
  originalKey?: string | null;
  scope: KeyScope;
  context?: Record<string, any>;
  existingKeys?: string[];
  disabled?: boolean;
  required?: boolean;
  placeholder?: string;
  className?: string;
  style?: React.CSSProperties;
  onRenameComplete?: (oldKey: string, newKey: string, counts: Record<string, number>) => void;
}

export function formatKey(val: string, scope?: KeyScope): string {
  if (scope === 'dairy') {
    return val.trim();
  }
  return val
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, '_')
    .replace(/_+/g, '_');
}

/**
 * Reusable helper to execute key rename with dry-run confirmation and cascade.
 */
export async function executeKeyRename(params: {
  scope: KeyScope;
  oldKey: string;
  newKey: string;
  context?: Record<string, any>;
  confirm: (opts: any) => Promise<boolean>;
  showError?: (msg: string, title?: string) => Promise<void>;
}): Promise<{ success: boolean; counts?: Record<string, number>; error?: string }> {
  const { scope, oldKey, newKey, context = {}, confirm, showError } = params;

  if (oldKey === newKey) return { success: true };

  // Dry Run check
  try {
    const dryRunRes = await fetch('/api/keys/rename', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        scope,
        old_key: oldKey,
        new_key: newKey,
        context,
        dry_run: true,
      }),
    });

    const dryRunData = await dryRunRes.json();
    if (!dryRunRes.ok || dryRunData.error) {
      const err = dryRunData.error || 'Failed to validate key rename';
      if (showError) await showError(err, 'Rename Validation Failed');
      return { success: false, error: err };
    }

    const counts: Record<string, number> = dryRunData.counts || {};
    const totalRows = Object.values(counts).reduce((a, b) => a + (Number(b) || 0), 0);
    const tableNames = Object.keys(counts).filter(k => (Number(counts[k]) || 0) > 0);

    const cascadeBreakdown = tableNames.length > 0
      ? tableNames.map(t => `• ${t}: ${counts[t]} row(s)`).join('\n')
      : '• No existing row data affected';

    const ok = await confirm({
      title: `⚡ Rename Key: "${oldKey}" ➔ "${newKey}"`,
      message: `Are you sure you want to rename this internal key?\n\nThis will update ${totalRows} row(s) in ${tableNames.length} table(s):\n${cascadeBreakdown}\n\nThis operation cascades everywhere across saved records, configurations, and mapping rules.`,
      confirmText: 'Rename Everywhere',
      cancelText: 'Cancel',
      type: 'warning',
    });

    if (!ok) {
      return { success: false, error: 'User cancelled' };
    }

    // Execute actual rename
    const runRes = await fetch('/api/keys/rename', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        scope,
        old_key: oldKey,
        new_key: newKey,
        context,
        dry_run: false,
      }),
    });

    const runData = await runRes.json();
    if (!runRes.ok || runData.error) {
      const err = runData.error || 'Failed to execute key rename';
      if (showError) await showError(err, 'Key Rename Error');
      return { success: false, error: err };
    }

    // Invalidate client caches
    mutate('/api/masters/bootstrap');
    mutate('/api/master/products');
    mutate('/api/master/dairies');
    mutate('/api/master/categories');
    mutate('/api/settings');

    return { success: true, counts: runData.counts };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error during key rename';
    if (showError) await showError(msg, 'Key Rename Error');
    return { success: false, error: msg };
  }
}

export default function KeyField({
  label = 'Field Key',
  value,
  onChange,
  originalKey,
  scope,
  context,
  existingKeys = [],
  disabled = false,
  required = true,
  placeholder = 'e.g. qty_lts',
  className = '',
  style = {},
  onRenameComplete,
}: KeyFieldProps) {
  const { confirm, showError } = useConfirm();
  const [renaming, setRenaming] = useState(false);
  const [validationError, setValidationError] = useState('');

  const isEditingExisting = Boolean(originalKey && originalKey.trim());
  const hasKeyChanged = isEditingExisting && value.trim() !== (originalKey || '').trim();

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    const formatted = formatKey(raw, scope);
    onChange(formatted);

    if (existingKeys.length > 0 && formatted !== originalKey && existingKeys.includes(formatted)) {
      setValidationError(`Key "${formatted}" is already in use.`);
    } else {
      setValidationError('');
    }
  };

  const handleApplyRename = async () => {
    if (!originalKey || !hasKeyChanged || renaming) return;

    if (scope !== 'dairy' && !/^[a-z][a-z0-9_]*$/.test(value)) {
      await showError(
        `Key "${value}" must start with a lowercase letter and contain only lowercase letters, numbers, and underscores.`,
        'Invalid Key Format'
      );
      return;
    }

    setRenaming(true);
    try {
      const result = await executeKeyRename({
        scope,
        oldKey: originalKey,
        newKey: value,
        context,
        confirm,
        showError,
      });

      if (result.success && result.counts) {
        onRenameComplete?.(originalKey, value, result.counts);
      } else if (!result.success && result.error !== 'User cancelled') {
        onChange(originalKey);
      }
    } finally {
      setRenaming(false);
    }
  };

  return (
    <div className={`key-field-container ${className}`} style={{ marginBottom: 12, ...style }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
        <label className="form-label" style={{ fontWeight: 600, margin: 0, fontSize: '0.85rem' }}>
          {label} {required && <span style={{ color: '#dc2626' }}>*</span>}
        </label>
        {isEditingExisting && (
          <span style={{ fontSize: '0.72rem', color: hasKeyChanged ? '#d97706' : 'var(--text-muted)' }}>
            {hasKeyChanged ? '⚠️ Rename pending confirmation' : '✏️ Editable key'}
          </span>
        )}
      </div>

      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
        <input
          type="text"
          className="form-input"
          placeholder={placeholder}
          value={value}
          onChange={handleInputChange}
          disabled={disabled}
          required={required}
          style={{
            flex: 1,
            fontFamily: 'monospace',
            fontSize: '0.88rem',
            borderColor: validationError ? '#ef4444' : hasKeyChanged ? '#f59e0b' : undefined,
            backgroundColor: hasKeyChanged ? '#fffbeb' : undefined,
          }}
        />

        {hasKeyChanged && (
          <button
            type="button"
            className="btn btn-warning btn-sm"
            onClick={handleApplyRename}
            disabled={renaming || Boolean(validationError)}
            style={{
              padding: '6px 12px',
              fontSize: '0.75rem',
              fontWeight: 700,
              whiteSpace: 'nowrap',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
            }}
            title="Inspect cascade effects and apply rename"
          >
            {renaming ? '...' : '⚡ Apply Rename'}
          </button>
        )}
      </div>

      {validationError ? (
        <span style={{ fontSize: '0.74rem', color: '#dc2626', marginTop: 3, display: 'block' }}>
          {validationError}
        </span>
      ) : (
        <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 3, display: 'block' }}>
          Internal identifier. Changing it updates all saved data.
        </span>
      )}
    </div>
  );
}

