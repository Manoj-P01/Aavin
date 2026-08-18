// ─────────────────────────────────────────────────────────────────────────────
// Aavin Dashboard – NKL Stock Statement Report View
// ─────────────────────────────────────────────────────────────────────────────

'use client';

import type { StockRow, SeparationDetails } from '@/lib/types';
import { STOCK_PRODUCT_COLUMNS } from '@/lib/types';
import { fmtNum } from '@/lib/calculations';

interface Props {
  rows: StockRow[];
  separation?: SeparationDetails | null;
  date: string;
  shift: 'D' | 'N' | 'COMBINED' | 'FULL_DAY';
  notes?: string | null;
  products?: Array<{ key: string; label: string }> | null;
}

function ColNum({ val }: { val: number }) {
  const abs = Math.abs(val);
  const color = val < 0 ? '#ef4444' : val > 0 ? 'inherit' : 'var(--text-muted)';
  return <td className="num" style={{ color, fontSize: '0.78rem', fontFamily: 'var(--font-numbers)' }}>{val === 0 ? '—' : fmtNum(abs)}</td>;
}

export default function StockReport({ rows, separation, date, shift, notes, products }: Props) {
  const dateDisplay = new Date(date).toLocaleDateString('en-IN', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  });

  const shiftLabel = shift === 'D' ? 'Day (D)' : shift === 'N' ? 'Night (N)' : shift === 'FULL_DAY' ? 'Full Day' : 'Combined (D+N)';

  // Parse custom columns and values from notes metadata
  let columns = products && products.length > 0 ? [...products] : [...STOCK_PRODUCT_COLUMNS];
  const customValues: Record<string, Record<string, number>> = {}; // rowLabel -> colKey -> val
  let cleanNotes = notes || '';

  if (notes) {
    // If combined view, we might have multiple metadata blocks merged
    const notesParts = notes.split('\n');
    notesParts.forEach(part => {
      if (part.includes('__METADATA__:')) {
        const [, metaJson] = part.split('__METADATA__:');
        try {
          const meta = JSON.parse(metaJson);
          if (meta.custom_columns) {
            meta.custom_columns.forEach((cc: any) => {
              if (!columns.some(c => c.key === cc.key)) {
                columns.push(cc);
              }
            });
          }
          if (meta.custom_values) {
            Object.entries(meta.custom_values).forEach(([rowLabel, colVals]: any) => {
              if (!customValues[rowLabel]) {
                customValues[rowLabel] = {};
              }
              Object.entries(colVals).forEach(([colKey, val]: any) => {
                customValues[rowLabel][colKey] = (customValues[rowLabel][colKey] || 0) + (parseFloat(val) || 0);
              });
            });
          }
        } catch (e) {
          console.error('Failed to parse metadata in report:', e);
        }
      }
    });

    cleanNotes = notesParts
      .filter(part => !part.includes('__METADATA__:'))
      .join('\n')
      .trim();
  }

  // Dynamic sum helper for both standard and custom columns
  const DB_COLUMNS = ['wh_milk', 'dlt_milk', 'fc_milk', 'std_milk', 'toned_curd', 'dtm', 'skim_milk', 'cream', 'butter_milk', 'r_con', 'smp', 'water'];

  const getSum = (rowType: 'OB' | 'RECEIPT' | 'DISPOSAL' | 'PHYSICAL', colKey: string): number => {
    const matchingRows = rows.filter(r => r.row_type === rowType);
    return matchingRows.reduce((sum, r) => {
      if (DB_COLUMNS.includes(colKey)) {
        return sum + (Number(r[colKey as keyof StockRow]) || 0);
      } else {
        const rowVals = customValues[r.row_label];
        return sum + (rowVals ? (rowVals[colKey] || 0) : 0);
      }
    }, 0);
  };

  // Helper to render dynamic rows from database matching a rowType
  const renderRows = (rowType: 'RECEIPT' | 'DISPOSAL') => {
    const matchingRows = [...rows]
      .filter(r => r.row_type === rowType)
      .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));

    return matchingRows.map(row => {
      const label = row.row_label;
      const rowTotal = columns.reduce((sum, col) => {
        if (DB_COLUMNS.includes(col.key)) {
          return sum + (Number(row[col.key as keyof StockRow]) || 0);
        } else {
          const rowVals = customValues[label];
          return sum + (rowVals ? (rowVals[col.key] || 0) : 0);
        }
      }, 0);

      return (
        <tr key={label}>
          <td style={{ paddingLeft: 20, color: 'var(--text-secondary)', fontSize: '0.78rem' }}>{label}</td>
          {columns.map(col => {
            let val = 0;
            if (DB_COLUMNS.includes(col.key)) {
              val = Number(row[col.key as keyof StockRow]) || 0;
            } else {
              val = customValues[label] ? (customValues[label][col.key] || 0) : 0;
            }
            return <ColNum key={col.key} val={val} />;
          })}
          <td className="num text-right" style={{ fontWeight: 700, fontSize: '0.78rem', fontFamily: 'var(--font-numbers)', paddingRight: 8 }}>
            {rowTotal === 0 ? '—' : fmtNum(rowTotal)}
          </td>
        </tr>
      );
    });
  };

  const renderSummaryRow = (label: string, rowType: 'OB' | 'RECEIPT_TOTAL' | 'OB_RECEIPT_TOTAL' | 'DISPOSAL_TOTAL' | 'CB', style?: React.CSSProperties) => {
    const rowValues = columns.map(col => {
      let val = 0;
      if (rowType === 'OB') {
        val = getSum('OB', col.key);
      } else if (rowType === 'RECEIPT_TOTAL') {
        val = getSum('RECEIPT', col.key);
      } else if (rowType === 'OB_RECEIPT_TOTAL') {
        val = getSum('OB', col.key) + getSum('RECEIPT', col.key);
      } else if (rowType === 'DISPOSAL_TOTAL') {
        val = getSum('DISPOSAL', col.key);
      } else if (rowType === 'CB') {
        val = getSum('OB', col.key) + getSum('RECEIPT', col.key) - getSum('DISPOSAL', col.key);
      }
      return val;
    });
    const rowTotal = rowValues.reduce((sum, val) => sum + val, 0);

    return (
      <tr key={label} style={style}>
        <td style={{ fontWeight: 700, color: 'var(--text-primary)', paddingLeft: 8 }}>{label}</td>
        {columns.map((col, idx) => (
          <ColNum key={col.key} val={rowValues[idx]} />
        ))}
        <td className="num text-right" style={{ fontWeight: 700, fontSize: '0.78rem', fontFamily: 'var(--font-numbers)', paddingRight: 8 }}>
          {rowTotal === 0 ? '—' : fmtNum(rowTotal)}
        </td>
      </tr>
    );
  };

  return (
    <div>
      {/* Header */}
      <div className="print-header" style={{ marginBottom: 16 }}>
        <div style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)' }}>
          NAMAKKAL DISTRICT CO-OPERATIVE MILK PRODUCERS&apos; UNION LTD
        </div>
        <div style={{ fontSize: '0.875rem', color: 'var(--brand-primary)', fontWeight: 600, marginTop: 4 }}>
          NKL — MILK AND CREAM STOCK STATEMENT
        </div>
        <div style={{ display: 'flex', gap: 24, marginTop: 4, fontFamily: 'var(--font-numbers)' }}>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>DATE: {dateDisplay}</div>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>SHIFT: {shiftLabel}</div>
          {cleanNotes && <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>NOTES: {cleanNotes}</div>}
        </div>
      </div>

      <div className="table-wrapper">
        <table className="report-table" style={{ width: '100%', fontSize: '0.78rem' }}>
          <thead>
            <tr>
              <th style={{ minWidth: 160 }}>Particulars</th>
              {columns.map(col => (
                <th key={col.key} className="num" style={{ minWidth: 80, fontSize: '0.65rem' }}>{col.label}</th>
              ))}
              <th className="num text-right" style={{ minWidth: 90, fontSize: '0.65rem', fontWeight: 700, paddingRight: 8 }}>Total</th>
            </tr>
          </thead>
          <tbody>
            {/* Opening Balance */}
            {renderSummaryRow('OPENING BALANCE', 'OB', {
              background: 'rgba(14,165,233,0.08)',
            })}

            {/* Receipt header */}
            <tr>
              <td colSpan={columns.length + 2} style={{
                background: 'rgba(16,185,129,0.08)',
                color: '#10b981',
                fontWeight: 700,
                fontSize: '0.72rem',
                textTransform: 'uppercase',
                padding: '7px 12px',
                borderLeft: '3px solid #10b981',
              }}>
                Receipts
              </td>
            </tr>
            {renderRows('RECEIPT')}
            {renderSummaryRow('TOTAL (Receipts)', 'RECEIPT_TOTAL', {
              background: 'rgba(16,185,129,0.06)',
            })}
            {renderSummaryRow('TOTAL (OB + Receipts)', 'OB_RECEIPT_TOTAL', {
              background: 'rgba(16,185,129,0.12)',
              fontWeight: 700,
            })}

            {/* Disposal header */}
            <tr>
              <td colSpan={columns.length + 2} style={{
                background: 'rgba(245,158,11,0.08)',
                color: '#f59e0b',
                fontWeight: 700,
                fontSize: '0.72rem',
                textTransform: 'uppercase',
                padding: '7px 12px',
                borderLeft: '3px solid #f59e0b',
              }}>
                Disposals
              </td>
            </tr>
            {renderRows('DISPOSAL')}
            {renderSummaryRow('TOTAL (Disposals)', 'DISPOSAL_TOTAL', {
              background: 'rgba(245,158,11,0.06)',
            })}

            {/* Closing Balance */}
            {renderSummaryRow('CLOSING BALANCE', 'CB', {
              background: 'rgba(14,165,233,0.12)',
              fontWeight: 700,
            })}

          </tbody>
        </table>
      </div>
    </div>
  );
}
