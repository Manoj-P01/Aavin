// ─────────────────────────────────────────────────────────────
// src/components/ui/DataTable.tsx
// Standardized Enterprise Data Table Component
// ─────────────────────────────────────────────────────────────

'use client';

import React, { useState } from 'react';

export interface ColumnDef<T> {
  key: string;
  header: React.ReactNode;
  accessor?: (row: T, index: number) => React.ReactNode;
  align?: 'left' | 'center' | 'right';
  isNumeric?: boolean;
  width?: string | number;
  sticky?: 'left' | 'right';
  className?: string;
}

export interface DataTableProps<T> {
  columns: ColumnDef<T>[];
  data: T[];
  keyExtractor: (row: T, index: number) => string | number;
  isLoading?: boolean;
  emptyMessage?: string;
  stickyHeader?: boolean;
  stickyFirstColumn?: boolean;
  zebra?: boolean;
  compact?: boolean;
  enableColumnToggle?: boolean;
  footerRow?: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  onRowClick?: (row: T, index: number) => void;
}

export function DataTable<T>({
  columns,
  data,
  keyExtractor,
  isLoading = false,
  emptyMessage = 'No records found',
  stickyHeader = true,
  stickyFirstColumn = false,
  zebra = true,
  compact = false,
  enableColumnToggle = false,
  footerRow,
  className = '',
  style,
  onRowClick,
}: DataTableProps<T>) {
  const [hiddenCols, setHiddenCols] = useState<Record<string, boolean>>({});

  const visibleColumns = columns.filter(col => !hiddenCols[col.key]);

  const toggleCol = (key: string) => {
    setHiddenCols(prev => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <div className={`datatable-container ${className}`.trim()} style={{ display: 'flex', flexDirection: 'column', gap: 8, ...style }}>
      {enableColumnToggle && (
        <div className="datatable-controls no-print" style={{ display: 'flex', justifyContent: 'flex-end', gap: 6, flexWrap: 'wrap' }}>
          <details style={{ position: 'relative' }}>
            <summary
              className="btn btn-secondary text-xs"
              style={{
                cursor: 'pointer',
                padding: '4px 8px',
                borderRadius: 'var(--radius-md, 6px)',
                background: 'var(--bg-subtle, #f1f5f9)',
                border: '1px solid var(--border, #cbd5e1)',
                fontSize: '0.75rem',
                userSelect: 'none',
              }}
            >
              Columns ({visibleColumns.length}/{columns.length})
            </summary>
            <div
              style={{
                position: 'absolute',
                right: 0,
                top: '100%',
                marginTop: 4,
                zIndex: 50,
                background: 'var(--bg-card, #ffffff)',
                border: '1px solid var(--border, #cbd5e1)',
                borderRadius: 'var(--radius-md, 6px)',
                boxShadow: 'var(--shadow-md, 0 4px 6px -1px rgb(0 0 0 / 0.1))',
                padding: 8,
                minWidth: 160,
                maxHeight: 240,
                overflowY: 'auto',
                display: 'flex',
                flexDirection: 'column',
                gap: 4,
              }}
            >
              {columns.map(c => (
                <label key={c.key} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.75rem', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={!hiddenCols[c.key]}
                    onChange={() => toggleCol(c.key)}
                  />
                  <span>{typeof c.header === 'string' ? c.header : c.key}</span>
                </label>
              ))}
            </div>
          </details>
        </div>
      )}

      <div
        style={{
          overflowX: 'auto',
          border: '1px solid var(--border, #e2e8f0)',
          borderRadius: 'var(--radius-lg, 10px)',
          background: 'var(--bg-card, #ffffff)',
          boxShadow: 'var(--shadow-xs, 0 1px 2px 0 rgb(0 0 0 / 0.05))',
        }}
      >
        <table
          className="w-full border-collapse"
          style={{
            width: '100%',
            borderCollapse: 'collapse',
            fontSize: compact ? 'var(--font-xs, 0.75rem)' : 'var(--font-sm, 0.875rem)',
          }}
        >
          <thead
            style={{
              position: stickyHeader ? 'sticky' : undefined,
              top: 0,
              zIndex: 20,
              backgroundColor: 'var(--bg-subtle, #f8fafc)',
              borderBottom: '2px solid var(--border, #cbd5e1)',
            }}
          >
            <tr>
              {visibleColumns.map((col, idx) => {
                const isStickyFirst = stickyFirstColumn && idx === 0;
                return (
                  <th
                    key={col.key}
                    style={{
                      padding: compact ? '6px 10px' : '10px 14px',
                      textAlign: col.align || (col.isNumeric ? 'right' : 'left'),
                      width: col.width,
                      fontWeight: 600,
                      color: 'var(--text-secondary, #475569)',
                      whiteSpace: 'nowrap',
                      position: isStickyFirst ? 'sticky' : undefined,
                      left: isStickyFirst ? 0 : undefined,
                      zIndex: isStickyFirst ? 25 : undefined,
                      backgroundColor: isStickyFirst ? 'var(--bg-subtle, #f8fafc)' : undefined,
                      boxShadow: isStickyFirst ? '2px 0 4px -2px rgba(0,0,0,0.1)' : undefined,
                    }}
                    className={col.className}
                  >
                    {col.header}
                  </th>
                );
              })}
            </tr>
          </thead>

          <tbody>
            {isLoading ? (
              // Skeleton rows
              Array.from({ length: 5 }).map((_, rIdx) => (
                <tr key={`skeleton-${rIdx}`} style={{ borderBottom: '1px solid var(--border, #e2e8f0)' }}>
                  {visibleColumns.map((c, cIdx) => (
                    <td key={`sk-${rIdx}-${cIdx}`} style={{ padding: compact ? '8px 10px' : '12px 14px' }}>
                      <div
                        style={{
                          height: 14,
                          background: 'var(--bg-subtle, #f1f5f9)',
                          borderRadius: 4,
                          animation: 'pulse 1.5s infinite',
                          width: c.isNumeric ? '60%' : '80%',
                          marginLeft: c.isNumeric ? 'auto' : undefined,
                        }}
                      />
                    </td>
                  ))}
                </tr>
              ))
            ) : data.length === 0 ? (
              <tr>
                <td
                  colSpan={visibleColumns.length}
                  style={{
                    padding: '32px 16px',
                    textAlign: 'center',
                    color: 'var(--text-muted, #64748b)',
                    fontStyle: 'italic',
                  }}
                >
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              data.map((row, rIdx) => {
                const isEven = rIdx % 2 === 0;
                return (
                  <tr
                    key={keyExtractor(row, rIdx)}
                    onClick={() => onRowClick?.(row, rIdx)}
                    style={{
                      borderBottom: '1px solid var(--border, #e2e8f0)',
                      backgroundColor: zebra && !isEven ? 'var(--bg-subtle, #f8fafc)' : 'var(--bg-card, #ffffff)',
                      cursor: onRowClick ? 'pointer' : undefined,
                      transition: 'background-color 0.15s ease',
                    }}
                    className={onRowClick ? 'hover:bg-slate-50' : undefined}
                  >
                    {visibleColumns.map((col, cIdx) => {
                      const isStickyFirst = stickyFirstColumn && cIdx === 0;
                      const cellContent = col.accessor
                        ? col.accessor(row, rIdx)
                        : (row as any)[col.key];

                      return (
                        <td
                          key={col.key}
                          style={{
                            padding: compact ? '6px 10px' : '10px 14px',
                            textAlign: col.align || (col.isNumeric ? 'right' : 'left'),
                            color: 'var(--text-primary, #0f172a)',
                            position: isStickyFirst ? 'sticky' : undefined,
                            left: isStickyFirst ? 0 : undefined,
                            zIndex: isStickyFirst ? 10 : undefined,
                            backgroundColor: isStickyFirst
                              ? (zebra && !isEven ? 'var(--bg-subtle, #f8fafc)' : 'var(--bg-card, #ffffff)')
                              : undefined,
                            boxShadow: isStickyFirst ? '2px 0 4px -2px rgba(0,0,0,0.1)' : undefined,
                          }}
                          className={`${col.isNumeric ? 'num' : ''} ${col.className || ''}`.trim()}
                        >
                          {cellContent}
                        </td>
                      );
                    })}
                  </tr>
                );
              })
            )}
          </tbody>

          {footerRow && (
            <tfoot
              style={{
                position: stickyHeader ? 'sticky' : undefined,
                bottom: 0,
                zIndex: 15,
                backgroundColor: 'var(--bg-subtle, #f8fafc)',
                borderTop: '2px solid var(--border, #cbd5e1)',
                fontWeight: 600,
              }}
            >
              {footerRow}
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}

export default DataTable;

