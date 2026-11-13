// ─────────────────────────────────────────────────────────────
// src/components/ui/EmptyState.tsx
// Standardized Empty State Component
// ─────────────────────────────────────────────────────────────

'use client';

import React from 'react';
import Link from 'next/link';

export interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  message?: string;
  actionLabel?: string;
  actionHref?: string;
  onAction?: () => void;
  className?: string;
  children?: React.ReactNode;
}

export function EmptyState({
  icon = '📂',
  title,
  message,
  actionLabel,
  actionHref,
  onAction,
  className = '',
  children,
}: EmptyStateProps) {
  return (
    <div
      className={`empty-state ${className}`.trim()}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        padding: 'var(--space-8, 32px) var(--space-4, 16px)',
        borderRadius: 'var(--radius-lg, 12px)',
        border: '1px dashed var(--border, #e2e8f0)',
        background: 'var(--bg-subtle, #f8fafc)',
        margin: 'var(--space-4, 16px) 0',
      }}
    >
      <div
        style={{
          fontSize: '2.5rem',
          marginBottom: 'var(--space-3, 12px)',
          lineHeight: 1,
        }}
      >
        {icon}
      </div>

      <h3
        style={{
          fontSize: 'var(--font-lg, 1.125rem)',
          fontWeight: 600,
          color: 'var(--text-primary, #0f172a)',
          margin: '0 0 var(--space-1, 4px) 0',
        }}
      >
        {title}
      </h3>

      {message && (
        <p
          style={{
            fontSize: 'var(--font-sm, 0.875rem)',
            color: 'var(--text-muted, #64748b)',
            maxWidth: 420,
            margin: '0 0 var(--space-4, 16px) 0',
            lineHeight: 1.5,
          }}
        >
          {message}
        </p>
      )}

      {actionLabel && (actionHref || onAction) && (
        <div style={{ marginTop: 'var(--space-2, 8px)' }}>
          {actionHref ? (
            <Link
              href={actionHref}
              className="btn btn-primary"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '8px 16px',
                borderRadius: 'var(--radius-md, 6px)',
                background: 'var(--brand-primary, #1e40af)',
                color: '#ffffff',
                textDecoration: 'none',
                fontWeight: 600,
                fontSize: 'var(--font-sm, 0.875rem)',
              }}
            >
              {actionLabel}
            </Link>
          ) : (
            <button
              type="button"
              onClick={onAction}
              className="btn btn-primary"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '8px 16px',
                borderRadius: 'var(--radius-md, 6px)',
                background: 'var(--brand-primary, #1e40af)',
                color: '#ffffff',
                border: 'none',
                cursor: 'pointer',
                fontWeight: 600,
                fontSize: 'var(--font-sm, 0.875rem)',
              }}
            >
              {actionLabel}
            </button>
          )}
        </div>
      )}

      {children && <div style={{ marginTop: 'var(--space-4, 16px)' }}>{children}</div>}
    </div>
  );
}

export default EmptyState;

