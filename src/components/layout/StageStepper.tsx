'use client';

import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { Shift } from '@/lib/types';

interface StageStepperProps {
  currentStage: 1 | 2 | 3 | 4; // 1: Stock, 2: STG, 3: TS, 4: Reports & Downloads
  date?: string;
  shift?: Shift | string | null;
  onStepClick?: (stage: 1 | 2 | 3 | 4) => void;
  onOpenExportModal?: () => void;
}

export default function StageStepper({
  currentStage,
  date,
  shift = 'F',
  onStepClick,
  onOpenExportModal,
}: StageStepperProps) {
  const router = useRouter();
  const entryDate = date || new Date().toISOString().split('T')[0];
  const activeShift = shift ? (shift === 'null' ? 'F' : shift) : 'F';

  const stages = [
    {
      id: 1,
      title: 'Stock Statement',
      subtitle: 'Opening & Receipts/Disposals',
      icon: '📦',
      href: `/dashboard/stock/new?date=${entryDate}&shift=${activeShift}`,
    },
    {
      id: 2,
      title: 'Solid Balance (STG)',
      subtitle: 'Manual STG Receipts & CB',
      icon: '⚖️',
      href: `/dashboard/ts/new-stg?date=${entryDate}&shift=${activeShift}`,
    },
    {
      id: 3,
      title: 'Total Solids (TS)',
      subtitle: 'TS Milk Rows & Norms',
      icon: '🧪',
      href: `/dashboard/ts/new?date=${entryDate}&shift=${activeShift}`,
    },
    {
      id: 4,
      title: 'Reports & Downloads',
      subtitle: 'View PDF / 2-Sheet Excel',
      icon: '📊',
      href: `/dashboard/ts/${entryDate}?shift=${activeShift}`,
    },
  ];

  const handleStageClick = (stageId: number, href: string) => {
    if (onStepClick && (stageId === 1 || stageId === 2 || stageId === 3 || stageId === 4)) {
      onStepClick(stageId as 1 | 2 | 3 | 4);
    } else {
      router.push(href);
    }
  };

  return (
    <div
      className="card no-print animate-fade-in"
      style={{
        padding: '16px 20px',
        marginBottom: 20,
        background: 'var(--bg-card)',
        border: '1px solid var(--border-color)',
        borderRadius: 'var(--radius-lg)',
        boxShadow: 'var(--shadow-md)',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--brand-primary)' }}>
            Stage Pipeline Flow
          </span>
          <span style={{ fontSize: '0.75rem', padding: '2px 8px', borderRadius: 12, background: 'rgba(14,165,233,0.1)', color: 'var(--brand-primary)', fontWeight: 600 }}>
            Stage {currentStage} of 4
          </span>
        </div>

        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => window.print()}
            title="Print or Save PDF for this stage"
            style={{ fontSize: '0.8rem', padding: '4px 10px' }}
          >
            🖨 Print / PDF Stage
          </button>

          {onOpenExportModal ? (
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={onOpenExportModal}
              style={{ backgroundColor: '#16a34a', backgroundImage: 'none', borderColor: '#16a34a', fontSize: '0.8rem', padding: '4px 10px' }}
            >
              📥 Download Multi-Sheet Excel
            </button>
          ) : (
            <Link
              href={`/dashboard/ts/${entryDate}?shift=${activeShift}`}
              className="btn btn-primary btn-sm"
              style={{ backgroundColor: '#16a34a', backgroundImage: 'none', borderColor: '#16a34a', fontSize: '0.8rem', padding: '4px 10px' }}
            >
              📥 Download Excel (2-Sheet STG,TS)
            </Link>
          )}
        </div>
      </div>

      {/* Stepper Pipeline Grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: 12,
          position: 'relative',
        }}
      >
        {stages.map((stg) => {
          const isCurrent = currentStage === stg.id;
          const isCompleted = currentStage > stg.id;

          return (
            <div
              key={stg.id}
              onClick={() => handleStageClick(stg.id, stg.href)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: '10px 14px',
                borderRadius: 'var(--radius-md)',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                border: isCurrent
                  ? '2px solid var(--brand-primary)'
                  : isCompleted
                  ? '1px solid rgba(16,185,129,0.4)'
                  : '1px solid var(--border-color)',
                background: isCurrent
                  ? 'rgba(14,165,233,0.08)'
                  : isCompleted
                  ? 'rgba(16,185,129,0.05)'
                  : 'var(--bg-main)',
                boxShadow: isCurrent ? '0 0 12px rgba(14,165,233,0.15)' : 'none',
              }}
            >
              <div
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 700,
                  fontSize: '0.85rem',
                  flexShrink: 0,
                  background: isCurrent
                    ? 'var(--brand-primary)'
                    : isCompleted
                    ? '#10b981'
                    : 'var(--border-color)',
                  color: isCurrent || isCompleted ? '#ffffff' : 'var(--text-secondary)',
                }}
              >
                {isCompleted ? '✓' : stg.id}
              </div>

              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '0.82rem', fontWeight: 700, color: isCurrent ? 'var(--brand-primary)' : 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {stg.icon} {stg.title}
                </div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {stg.subtitle}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
