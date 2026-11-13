// ─────────────────────────────────────────────────────────────
// src/components/ui/PageActions.tsx
// Standardized Page Header Action Buttons Layout
// ─────────────────────────────────────────────────────────────

'use client';

import React from 'react';

interface PageActionsProps {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

export function PageActions({ children, className = '', style }: PageActionsProps) {
  return (
    <div
      className={`page-actions ${className}`.trim()}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 'var(--space-2, 8px)',
        flexWrap: 'wrap',
        ...style,
      }}
    >
      {children}
    </div>
  );
}

export default PageActions;

