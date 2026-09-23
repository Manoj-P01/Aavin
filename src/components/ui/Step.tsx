'use client';

import React from 'react';

export interface StepItem {
  key: string;
  title: string;
  description?: string;
  icon?: string | React.ReactNode;
  disabled?: boolean;
  status?: 'wait' | 'process' | 'finish' | 'error';
}

export const DAILY_ENTRY_STEP_ITEMS: StepItem[] = [
  {
    key: 'prep',
    title: 'Preparation Charts',
    description: 'Milk & Cream Formulations',
    icon: '📋',
  },
  {
    key: 'stock',
    title: 'Stock Statement Entry',
    description: 'Milk & Cream Stock Balances',
    icon: '📊',
  },
  {
    key: 'stg',
    title: 'Solid Balance Details (STG)',
    description: 'Auto-compiled Receipts & Disposals',
    icon: '⚖️',
  },
  {
    key: 'ts',
    title: 'Total Solids (TS) Statement',
    description: 'Total Solids & Fat/SNF Balances',
    icon: '🧪',
  },
  {
    key: 'reports',
    title: 'Reports & Downloads',
    description: 'View PDF / Export Multi-Sheet Excel',
    icon: '📥',
  },
];

export interface StepProps {
  items: (StepItem | string)[];
  activeStep?: string | number;
  flat?: boolean;
  onStepClick?: (key: string, index: number) => void;
  className?: string;
  style?: React.CSSProperties;
}

export default function Step({
  items = [],
  activeStep,
  flat = false,
  onStepClick,
  className = '',
  style = {},
}: StepProps) {
  // Normalize items to StepItem structure
  const stepItems: StepItem[] = items.map((item, idx) => {
    if (typeof item === 'string') {
      return { key: item || `step-${idx}`, title: item };
    }
    return {
      key: item.key || `step-${idx}`,
      title: item.title,
      description: item.description,
      icon: item.icon,
      disabled: item.disabled,
      status: item.status,
    };
  });

  // Resolve active index
  let activeIdx = 0;
  if (typeof activeStep === 'number') {
    activeIdx = activeStep;
  } else if (typeof activeStep === 'string') {
    const foundIdx = stepItems.findIndex(s => s.key === activeStep);
    if (foundIdx !== -1) activeIdx = foundIdx;
  }

  const handleItemClick = (item: StepItem, idx: number) => {
    if (item.disabled) return;
    if (onStepClick) {
      onStepClick(item.key, idx);
    }
  };

  if (flat) {
    const total = stepItems.length;

    return (
      <div
        className={`step-flat-container ${className}`}
        style={{
          display: 'flex',
          alignItems: 'stretch',
          width: '100%',
          background: '#ffffff',
          border: '1px solid #e2e8f0',
          borderRadius: 8,
          boxShadow: '0 2px 6px rgba(0, 0, 0, 0.04)',
          overflow: 'hidden',
          marginTop: 4,
          marginBottom: 4,
          minHeight: 52,
          ...style,
        }}
      >
        {stepItems.map((item, idx) => {
          const isActive = idx === activeIdx;
          const isCompleted = idx < activeIdx;
          const isNext = idx === activeIdx + 1;
          const isDisabled = !!item.disabled;

          const isFirst = idx === 0;
          const isLast = idx === total - 1;

          // Arrow depth in pixels
          const arrowDepth = 16;

          // Polygon path calculation
          let clipPath = `polygon(0% 0%, calc(100% - ${arrowDepth}px) 0%, 100% 50%, calc(100% - ${arrowDepth}px) 100%, 0% 100%, ${arrowDepth}px 50%)`;

          if (isFirst && isLast) {
            clipPath = 'none';
          } else if (isFirst) {
            clipPath = `polygon(0% 0%, calc(100% - ${arrowDepth}px) 0%, 100% 50%, calc(100% - ${arrowDepth}px) 100%, 0% 100%)`;
          } else if (isLast) {
            clipPath = `polygon(0% 0%, 100% 0%, 100% 100%, 0% 100%, ${arrowDepth}px 50%)`;
          }

          // Visual Styling based on reference image:
          // Active: Royal Blue solid background, bright white text
          // Completed / Next: Light background with crisp blue/slate text
          // Pending: White background with muted slate text
          let bg = '#ffffff';
          let titleColor = '#475569';
          let descColor = '#94a3b8';
          let zIndex = total - idx;
          let filter = 'drop-shadow(1px 0 0 #cbd5e1)';

          if (isActive) {
            bg = 'linear-gradient(135deg, #0066ff 0%, #0052cc 100%)';
            titleColor = '#ffffff';
            descColor = 'rgba(255, 255, 255, 0.85)';
            zIndex = 10;
            filter = 'drop-shadow(2px 0 6px rgba(0, 102, 255, 0.35))';
          } else if (isCompleted) {
            bg = '#f8fafc';
            titleColor = '#0284c7';
            descColor = '#64748b';
            zIndex = total - idx + 1;
            filter = 'drop-shadow(1px 0 0 #cbd5e1)';
          } else if (isNext) {
            bg = '#ffffff';
            titleColor = '#0066ff';
            descColor = '#94a3b8';
            filter = 'drop-shadow(1px 0 0 #cbd5e1)';
          }

          return (
            <div
              key={item.key}
              onClick={() => handleItemClick(item, idx)}
              className={`step-chevron-banner-item ${isActive ? 'active' : ''} ${isCompleted ? 'completed' : ''}`}
              style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                paddingTop: 8,
                paddingBottom: 8,
                paddingLeft: isFirst ? 20 : 28,
                paddingRight: isLast ? 20 : 28,
                marginLeft: isFirst ? 0 : -14,
                clipPath,
                background: bg,
                cursor: isDisabled ? 'not-allowed' : 'pointer',
                opacity: isDisabled ? 0.5 : 1,
                position: 'relative',
                zIndex,
                filter,
                transition: 'all 0.2s ease',
                userSelect: 'none',
                minWidth: 0,
              }}
            >
              {/* Step Title */}
              <div
                style={{
                  fontSize: '0.9rem',
                  fontWeight: isActive ? 800 : (isCompleted || isNext ? 700 : 600),
                  color: titleColor,
                  lineHeight: 1.25,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {item.title}
              </div>

              {/* Step Description */}
              {item.description && (
                <div
                  style={{
                    fontSize: '0.73rem',
                    fontWeight: 400,
                    color: descColor,
                    lineHeight: 1.2,
                    marginTop: 2,
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {item.description}
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  }

  // Standard Stepper Layout
  return (
    <div
      className={`step-container ${className}`}
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '16px 0',
        marginBottom: 24,
        ...style,
      }}
    >
      {stepItems.map((item, idx) => {
        const isActive = idx === activeIdx;
        const isCompleted = idx < activeIdx;
        const isDisabled = !!item.disabled;

        return (
          <React.Fragment key={item.key}>
            <div
              onClick={() => handleItemClick(item, idx)}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                textAlign: 'center',
                cursor: isDisabled ? 'not-allowed' : 'pointer',
                opacity: isDisabled ? 0.5 : 1,
                flex: 1,
              }}
            >
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: '50%',
                  background: isActive ? '#0ea5e9' : (isCompleted ? '#10b981' : 'var(--bg-secondary, #f1f5f9)'),
                  color: (isActive || isCompleted) ? '#ffffff' : 'var(--text-secondary, #64748b)',
                  border: isActive ? '2px solid #0284c7' : (isCompleted ? '2px solid #059669' : '1px solid var(--border, #cbd5e1)'),
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 700,
                  fontSize: '0.9rem',
                  marginBottom: 6,
                }}
              >
                {isCompleted ? '✓' : (item.icon || (idx + 1))}
              </div>
              <div style={{ fontSize: '0.85rem', fontWeight: isActive ? 700 : 500, color: isActive ? '#0ea5e9' : 'inherit' }}>
                {item.title}
              </div>
              {item.description && (
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted, #94a3b8)' }}>{item.description}</div>
              )}
            </div>
            {idx < stepItems.length - 1 && (
              <div style={{ height: 2, flex: 1, background: idx < activeIdx ? '#10b981' : '#e2e8f0', margin: '0 10px' }} />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}
