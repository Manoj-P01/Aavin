'use client';

import type { StockRow, SeparationDetails, StockColumns } from '@/lib/types';
import { STOCK_PRODUCT_COLUMNS, STOCK_RECEIPT_LABELS, STOCK_DISPOSAL_LABELS } from '@/lib/types';
import { calcStockSummary, fmtNum } from '@/lib/calculations';

interface Props {
  rows: StockRow[];
  separation?: SeparationDetails | null;
  date: string;
  shift: 'D' | 'N' | 'COMBINED';
}

function ColNum({ val }: { val: number }) {
  const abs = Math.abs(val);
  const color = val < 0 ? '#ef4444' : val > 0 ? 'inherit' : 'var(--text-muted)';
  return <td className="num" style={{ color, fontSize: '0.78rem' }}>{val === 0 ? '—' : fmtNum(abs)}</td>;
}

export default function StockReport({ rows, separation, date, shift }: Props) {
  const summary = calcStockSummary(rows);

  const dateDisplay = new Date(date).toLocaleDateString('en-IN', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  });

  const shiftLabel = shift === 'D' ? 'Day (D)' : shift === 'N' ? 'Night (N)' : 'Combined (D+N)';

  // Helper to render a group of labelled rows
  const renderRows = (labels: readonly string[], rowType: 'RECEIPT' | 'DISPOSAL') => {
    return labels.map(label => {
      const row = rows.find(r => r.row_type === rowType && r.row_label === label);
      return (
        <tr key={label}>
          <td style={{ paddingLeft: 20, color: 'var(--text-secondary)', fontSize: '0.78rem' }}>{label}</td>
          {STOCK_PRODUCT_COLUMNS.map(col => (
            <ColNum key={col.key} val={row ? Number(row[col.key]) : 0} />
          ))}
        </tr>
      );
    });
  };

  const renderSummaryRow = (label: string, data: StockColumns, style?: React.CSSProperties) => (
    <tr key={label} style={style}>
      <td style={{ fontWeight: 700, color: 'var(--text-primary)', paddingLeft: 8 }}>{label}</td>
      {STOCK_PRODUCT_COLUMNS.map(col => (
        <ColNum key={col.key} val={data[col.key]} />
      ))}
    </tr>
  );

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
        <div style={{ display: 'flex', gap: 24, marginTop: 4 }}>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>DATE: {dateDisplay}</div>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>SHIFT: {shiftLabel}</div>
        </div>
      </div>

      <div className="table-wrapper">
        <table className="report-table" style={{ width: '100%', fontSize: '0.78rem' }}>
          <thead>
            <tr>
              <th style={{ minWidth: 160 }}>Particulars</th>
              {STOCK_PRODUCT_COLUMNS.map(col => (
                <th key={col.key} className="num" style={{ minWidth: 80, fontSize: '0.65rem' }}>{col.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {/* Opening Balance */}
            {renderSummaryRow('OPENING BALANCE', summary.opening_balance, {
              background: 'rgba(14,165,233,0.08)',
            })}

            {/* Receipt header */}
            <tr>
              <td colSpan={13} style={{
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
            {renderRows(STOCK_RECEIPT_LABELS, 'RECEIPT')}
            {renderSummaryRow('TOTAL (Receipts)', summary.total_receipts, {
              background: 'rgba(16,185,129,0.06)',
            })}

            {/* Disposal header */}
            <tr>
              <td colSpan={13} style={{
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
            {renderRows(STOCK_DISPOSAL_LABELS, 'DISPOSAL')}
            {renderSummaryRow('TOTAL (Disposals)', summary.total_disposals, {
              background: 'rgba(245,158,11,0.06)',
            })}

            {/* Closing Balance */}
            {renderSummaryRow('CLOSING BALANCE', summary.closing_balance, {
              background: 'rgba(14,165,233,0.12)',
              fontWeight: 700,
            })}

            {/* Physical */}
            <tr>
              <td style={{ fontWeight: 600, color: 'var(--text-secondary)', paddingLeft: 8 }}>Physical Count</td>
              {STOCK_PRODUCT_COLUMNS.map(col => (
                <ColNum key={col.key} val={summary.physical_count[col.key]} />
              ))}
            </tr>

            {/* Difference */}
            <tr>
              <td style={{ fontWeight: 700, color: '#ef4444', paddingLeft: 8 }}>DIFFERENCE</td>
              {STOCK_PRODUCT_COLUMNS.map(col => {
                const diff = summary.difference[col.key];
                return (
                  <td key={col.key} className="num" style={{
                    color: diff < 0 ? '#ef4444' : diff > 0 ? '#10b981' : 'var(--text-muted)',
                    fontWeight: 600,
                    fontSize: '0.78rem',
                  }}>
                    {diff === 0 ? '—' : (diff > 0 ? '+' : '') + fmtNum(diff)}
                  </td>
                );
              })}
            </tr>
          </tbody>
        </table>
      </div>

      {/* Separation Details */}
      {separation && (
        <div className="card" style={{ marginTop: 16 }}>
          <div className="section-title" style={{ marginBottom: 12 }}>⚗️ Separation Details</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
            <div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: 6, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Whole Milk (WM)
              </div>
              <div style={{ fontSize: '0.875rem' }}>Fat %: <strong>{separation.wm_fat_pct}</strong></div>
              <div style={{ fontSize: '0.875rem' }}>SNF %: <strong>{separation.wm_snf_pct}</strong></div>
            </div>
            <div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: 6, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Cream
              </div>
              <div style={{ fontSize: '0.875rem' }}>Qty (Lts): <strong>{separation.cream_lts}</strong></div>
              <div style={{ fontSize: '0.875rem' }}>Fat %: <strong>{separation.cream_fat_pct}</strong></div>
              <div style={{ fontSize: '0.875rem' }}>SNF %: <strong>{separation.cream_snf_pct}</strong></div>
            </div>
            <div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: 6, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                SSM
              </div>
              <div style={{ fontSize: '0.875rem' }}>Qty (Lts): <strong>{separation.ssm_lts}</strong></div>
              <div style={{ fontSize: '0.875rem' }}>Fat %: <strong>{separation.ssm_fat_pct}</strong></div>
              <div style={{ fontSize: '0.875rem' }}>SNF %: <strong>{separation.ssm_snf_pct}</strong></div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
