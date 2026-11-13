// ─────────────────────────────────────────────────────────────
// src/components/ui/PageHeader.tsx
// Standardized Page Header Component (Title, Breadcrumbs, Actions)
// ─────────────────────────────────────────────────────────────

'use client';

import React from 'react';
import Link from 'next/link';

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

export interface PageHeaderProps {
  title: string;
  subtitle?: string;
  breadcrumbs?: BreadcrumbItem[];
  backHref?: string;
  backLabel?: string;
  onBack?: () => void;
  actions?: React.ReactNode;
  badge?: React.ReactNode;
  className?: string;
}

export function PageHeader({
  title,
  subtitle,
  breadcrumbs,
  backHref,
  backLabel = 'Back',
  onBack,
  actions,
  badge,
  className = '',
}: PageHeaderProps) {
  return (
    <header className={`page-header mb-6 ${className}`.trim()} style={{ marginBottom: 'var(--space-6, 24px)' }}>
      {/* Breadcrumbs or Back Link */}
      {(breadcrumbs?.length || backHref || onBack) && (
        <div
          className="page-header-nav mb-2"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-2, 8px)',
            fontSize: 'var(--font-sm, 0.875rem)',
            color: 'var(--text-muted, #64748b)',
            marginBottom: 'var(--space-2, 8px)',
          }}
        >
          {backHref ? (
            <Link
              href={backHref}
              className="inline-flex items-center gap-1 font-medium hover:text-primary transition-colors"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                color: 'var(--brand-primary, #1e40af)',
                textDecoration: 'none',
              }}
            >
              <span>←</span> {backLabel}
            </Link>
          ) : onBack ? (
            <button
              type="button"
              onClick={onBack}
              className="inline-flex items-center gap-1 font-medium hover:text-primary transition-colors bg-transparent border-0 cursor-pointer p-0"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                color: 'var(--brand-primary, #1e40af)',
              }}
            >
              <span>←</span> {backLabel}
            </button>
          ) : null}

          {breadcrumbs && breadcrumbs.length > 0 && (
            <nav aria-label="Breadcrumb" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              {(backHref || onBack) && <span style={{ opacity: 0.4 }}>|</span>}
              {breadcrumbs.map((crumb, idx) => {
                const isLast = idx === breadcrumbs.length - 1;
                return (
                  <React.Fragment key={crumb.label + idx}>
                    {idx > 0 && <span style={{ opacity: 0.4 }}>/</span>}
                    {crumb.href && !isLast ? (
                      <Link
                        href={crumb.href}
                        style={{ color: 'var(--text-muted, #64748b)', textDecoration: 'none' }}
                        className="hover:underline"
                      >
                        {crumb.label}
                      </Link>
                    ) : (
                      <span style={{ color: isLast ? 'var(--text-primary, #0f172a)' : undefined, fontWeight: isLast ? 600 : 400 }}>
                        {crumb.label}
                      </span>
                    )}
                  </React.Fragment>
                );
              })}
            </nav>
          )}
        </div>
      )}

      {/* Main Title Row */}
      <div
        className="page-header-row"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 'var(--space-4, 16px)',
          flexWrap: 'wrap',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3, 12px)', flexWrap: 'wrap' }}>
          <h1
            style={{
              fontSize: 'var(--font-2xl, 1.5rem)',
              fontWeight: 700,
              color: 'var(--text-primary, #0f172a)',
              margin: 0,
              letterSpacing: '-0.02em',
            }}
          >
            {title}
          </h1>
          {badge && <div>{badge}</div>}
        </div>

        {actions && (
          <div className="page-header-actions no-print" style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2, 8px)' }}>
            {actions}
          </div>
        )}
      </div>

      {subtitle && (
        <p
          style={{
            fontSize: 'var(--font-sm, 0.875rem)',
            color: 'var(--text-muted, #64748b)',
            marginTop: 'var(--space-1, 4px)',
            marginBottom: 0,
          }}
        >
          {subtitle}
        </p>
      )}
    </header>
  );
}

export default PageHeader;

