// ─────────────────────────────────────────────────────────────
// src/components/ui/Tabs.tsx
// Standardized Segmented / Underline Tab Navigation
// ─────────────────────────────────────────────────────────────

'use client';

import React from 'react';

export interface TabItem {
  key: string;
  label: string;
  icon?: React.ReactNode;
  badge?: string | number;
  disabled?: boolean;
}

export interface TabsProps {
  tabs: TabItem[];
  activeKey: string;
  onChange: (key: string) => void;
  variant?: 'pill' | 'underline';
  className?: string;
  style?: React.CSSProperties;
}

export function Tabs({
  tabs,
  activeKey,
  onChange,
  variant = 'pill',
  className = '',
  style,
}: TabsProps) {
  if (variant === 'underline') {
    return (
      <nav
        className={`tabs-underline ${className}`.trim()}
        aria-label="Tabs"
        style={{
          display: 'flex',
          borderBottom: '1px solid var(--border, #e2e8f0)',
          gap: 'var(--space-6, 24px)',
          ...style,
        }}
      >
        {tabs.map(tab => {
          const isActive = tab.key === activeKey;
          return (
            <button
              key={tab.key}
              type="button"
              disabled={tab.disabled}
              onClick={() => onChange(tab.key)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 'var(--space-2, 8px)',
                padding: 'var(--space-3, 12px) 0',
                fontSize: 'var(--font-sm, 0.875rem)',
                fontWeight: isActive ? 600 : 500,
                color: isActive ? 'var(--brand-primary, #1e40af)' : 'var(--text-muted, #64748b)',
                borderBottom: isActive ? '2px solid var(--brand-primary, #1e40af)' : '2px solid transparent',
                background: 'transparent',
                borderLeft: 'none',
                borderRight: 'none',
                borderTop: 'none',
                cursor: tab.disabled ? 'not-allowed' : 'pointer',
                opacity: tab.disabled ? 0.5 : 1,
                transition: 'all 0.2s ease',
                marginBottom: -1,
              }}
            >
              {tab.icon && <span>{tab.icon}</span>}
              <span>{tab.label}</span>
              {tab.badge !== undefined && (
                <span
                  style={{
                    padding: '1px 6px',
                    borderRadius: 'var(--radius-full, 9999px)',
                    fontSize: 'var(--font-xs, 0.75rem)',
                    fontWeight: 600,
                    background: isActive ? 'rgba(30, 64, 175, 0.1)' : 'var(--bg-subtle, #f1f5f9)',
                    color: isActive ? 'var(--brand-primary, #1e40af)' : 'var(--text-secondary, #475569)',
                  }}
                >
                  {tab.badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>
    );
  }

  // Pill variant
  return (
    <div
      className={`tabs-pill ${className}`.trim()}
      role="tablist"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '3px',
        borderRadius: 'var(--radius-lg, 8px)',
        background: 'var(--bg-subtle, #f1f5f9)',
        border: '1px solid var(--border, #e2e8f0)',
        gap: 2,
        ...style,
      }}
    >
      {tabs.map(tab => {
        const isActive = tab.key === activeKey;
        return (
          <button
            key={tab.key}
            type="button"
            role="tab"
            aria-selected={isActive}
            disabled={tab.disabled}
            onClick={() => onChange(tab.key)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '6px 14px',
              fontSize: 'var(--font-sm, 0.875rem)',
              fontWeight: isActive ? 600 : 500,
              color: isActive ? 'var(--text-primary, #0f172a)' : 'var(--text-muted, #64748b)',
              background: isActive ? 'var(--bg-card, #ffffff)' : 'transparent',
              borderRadius: 'var(--radius-md, 6px)',
              boxShadow: isActive ? 'var(--shadow-xs, 0 1px 2px 0 rgb(0 0 0 / 0.05))' : 'none',
              border: 'none',
              cursor: tab.disabled ? 'not-allowed' : 'pointer',
              opacity: tab.disabled ? 0.5 : 1,
              transition: 'all 0.15s ease',
            }}
          >
            {tab.icon && <span>{tab.icon}</span>}
            <span>{tab.label}</span>
            {tab.badge !== undefined && (
              <span
                style={{
                  padding: '1px 6px',
                  borderRadius: 'var(--radius-full, 9999px)',
                  fontSize: '0.7rem',
                  fontWeight: 600,
                  background: isActive ? 'var(--brand-primary, #1e40af)' : 'rgba(100, 116, 139, 0.15)',
                  color: isActive ? '#ffffff' : 'var(--text-secondary, #475569)',
                }}
              >
                {tab.badge}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

export default Tabs;

