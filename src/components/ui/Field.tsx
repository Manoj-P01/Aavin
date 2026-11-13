// ─────────────────────────────────────────────────────────────
// src/components/ui/Field.tsx
// Standardized Form Field wrapper (Label, Helper, Error)
// ─────────────────────────────────────────────────────────────

'use client';

import React, { useId } from 'react';

export interface FieldProps {
  label?: string;
  htmlFor?: string;
  helperText?: string;
  error?: string | null;
  required?: boolean;
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

export function Field({
  label,
  htmlFor,
  helperText,
  error,
  required = false,
  children,
  className = '',
  style,
}: FieldProps) {
  const autoId = useId();
  const inputId = htmlFor || autoId;

  return (
    <div
      className={`form-field ${error ? 'has-error' : ''} ${className}`.trim()}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--space-1, 4px)',
        marginBottom: 'var(--space-3, 12px)',
        ...style,
      }}
    >
      {label && (
        <label
          htmlFor={inputId}
          className="form-label"
          style={{
            fontSize: 'var(--font-xs, 0.75rem)',
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.04em',
            color: error ? 'var(--brand-danger, #ef4444)' : 'var(--text-secondary, #475569)',
            display: 'flex',
            alignItems: 'center',
            gap: 4,
          }}
        >
          {label}
          {required && <span style={{ color: 'var(--brand-danger, #ef4444)' }}>*</span>}
        </label>
      )}

      {children}

      {error ? (
        <span
          className="form-error text-danger"
          style={{
            fontSize: 'var(--font-xs, 0.75rem)',
            color: 'var(--brand-danger, #ef4444)',
            marginTop: 2,
          }}
        >
          {error}
        </span>
      ) : helperText ? (
        <span
          className="form-helper text-muted"
          style={{
            fontSize: 'var(--font-xs, 0.75rem)',
            color: 'var(--text-muted, #64748b)',
            marginTop: 2,
          }}
        >
          {helperText}
        </span>
      ) : null}
    </div>
  );
}

export default Field;

