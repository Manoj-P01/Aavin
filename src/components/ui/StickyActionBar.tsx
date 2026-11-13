// ─────────────────────────────────────────────────────────────
// src/components/ui/StickyActionBar.tsx
// Standardized Sticky Bottom Action Bar with Save / Discard / Status
// ─────────────────────────────────────────────────────────────

'use client';

import React from 'react';

interface StickyActionBarProps {
  hasChanges?: boolean;
  message?: string;
  onSave?: () => void;
  onDiscard?: () => void;
  saving?: boolean;
  saveLabel?: string;
  discardLabel?: string;
  leftContent?: React.ReactNode;
  rightContent?: React.ReactNode;
  children?: React.ReactNode;
  visible?: boolean;
}

export function StickyActionBar({
  hasChanges = false,
  message = 'You have unsaved changes',
  onSave,
  onDiscard,
  saving = false,
  saveLabel = 'Save Changes',
  discardLabel = 'Discard',
  leftContent,
  rightContent,
  children,
  visible = true,
}: StickyActionBarProps) {
  if (!visible && !hasChanges) return null;

  return (
    <div
      className="sticky-action-bar no-print"
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 50,
        backgroundColor: 'var(--bg-surface, #ffffff)',
        borderTop: '1px solid var(--border, #e2e8f0)',
        boxShadow: 'var(--shadow-lg, 0 10px 15px -3px rgba(0,0,0,0.1))',
        padding: '12px 24px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        transition: 'all 0.2s ease-in-out',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        {hasChanges && (
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              fontSize: '0.82rem',
              fontWeight: 600,
              color: '#d97706',
              backgroundColor: '#fffbeb',
              border: '1px solid #fde68a',
              borderRadius: 6,
              padding: '4px 10px',
            }}
          >
            ⚠️ {message}
          </span>
        )}
        {leftContent}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        {children}
        {rightContent}
        {onDiscard && (
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={onDiscard}
            disabled={saving}
          >
            {discardLabel}
          </button>
        )}
        {onSave && (
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={onSave}
            disabled={saving || !hasChanges}
          >
            {saving ? 'Saving...' : saveLabel}
          </button>
        )}
      </div>
    </div>
  );
}

export default StickyActionBar;

