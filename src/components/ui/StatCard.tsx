// ─────────────────────────────────────────────────────────────
// src/components/ui/StatCard.tsx
// Standardized KPI / Metric Stat Card
// ─────────────────────────────────────────────────────────────

'use client';

import React from 'react';

export interface StatCardProps {
  label: string;
  value: React.ReactNode;
  icon?: React.ReactNode;
  badge?: {
    text: string;
    variant?: 'success' | 'danger' | 'warning' | 'info' | 'neutral';
  };
  subtext?: string;
  trend?: 'up' | 'down' | 'neutral';
  className?: string;
  style?: React.CSSProperties;
  onClick?: () => void;
}

export function StatCard({
  label,
  value,
  icon,
  badge,
  subtext,
  trend,
  className = '',
  style,
  onClick,
}: StatCardProps) {
  const getBadgeBg = (variant?: string) => {
    switch (variant) {
      case 'success':
        return 'rgba(34, 197, 94, 0.15)';
      case 'danger':
        return 'rgba(239, 68, 68, 0.15)';
      case 'warning':
        return 'rgba(245, 158, 11, 0.15)';
      case 'info':
        return 'rgba(59, 130, 246, 0.15)';
      default:
        return 'var(--bg-subtle, #f1f5f9)';
    }
  };

  const getBadgeColor = (variant?: string) => {
    switch (variant) {
      case 'success':
        return '#16a34a';
      case 'danger':
        return '#dc2626';
      case 'warning':
        return '#d97706';
      case 'info':
        return '#2563eb';
      default:
        return 'var(--text-secondary, #475569)';
    }
  };

  return (
    <div
      className={`card stat-card ${onClick ? 'cursor-pointer hover:shadow-md' : ''} ${className}`.trim()}
      onClick={onClick}
      style={{
        padding: 'var(--space-4, 16px) var(--space-5, 20px)',
        borderRadius: 'var(--radius-lg, 12px)',
        border: '1px solid var(--border, #e2e8f0)',
        background: 'var(--bg-card, #ffffff)',
        boxShadow: 'var(--shadow-sm, 0 1px 2px 0 rgb(0 0 0 / 0.05))',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        transition: 'all 0.2s ease',
        ...style,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-2, 8px)' }}>
        <span
          style={{
            fontSize: 'var(--font-xs, 0.75rem)',
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            color: 'var(--text-muted, #64748b)',
          }}
        >
          {label}
        </span>
        {icon && (
          <span
            style={{
              fontSize: '1.25rem',
              width: 32,
              height: 32,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: 'var(--radius-md, 8px)',
              background: 'var(--bg-subtle, #f8fafc)',
            }}
          >
            {icon}
          </span>
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'baseline', gap: 'var(--space-2, 8px)', flexWrap: 'wrap' }}>
        <div
          style={{
            fontSize: 'var(--font-2xl, 1.5rem)',
            fontWeight: 700,
            color: 'var(--text-primary, #0f172a)',
            letterSpacing: '-0.02em',
          }}
        >
          {value}
        </div>

        {badge && (
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              padding: '2px 8px',
              borderRadius: 'var(--radius-full, 9999px)',
              fontSize: 'var(--font-xs, 0.75rem)',
              fontWeight: 600,
              background: getBadgeBg(badge.variant),
              color: getBadgeColor(badge.variant),
            }}
          >
            {trend === 'up' && '▲ '}
            {trend === 'down' && '▼ '}
            {badge.text}
          </span>
        )}
      </div>

      {subtext && (
        <div
          style={{
            fontSize: 'var(--font-xs, 0.75rem)',
            color: 'var(--text-muted, #64748b)',
            marginTop: 'var(--space-2, 8px)',
          }}
        >
          {subtext}
        </div>
      )}
    </div>
  );
}

export default StatCard;

