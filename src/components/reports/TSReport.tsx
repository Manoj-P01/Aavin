'use client';

import type { TSMilkRow, TSTotals } from '@/lib/types';
import { CMPDD_NORM_PCT } from '@/lib/types';
import { fmtNum, fmtPct } from '@/lib/calculations';

interface Props {
  rows: TSMilkRow[];
  totals: TSTotals;
  date: string;
  shift?: string | null;
}

const SECTION_LABELS: Record<string, string> = {
  OB: 'O/B (Opening Balance)',
  RECEIPT: 'Receipts',
  DISPOSAL_DESPATCH: 'Disposal - Despatch / Sale',
  LOCAL_SALE: 'Local Sales',
  OTHER_DISPOSAL: 'Other Disposal',
  CB: 'C/B (Closing Balance)',
};

const SECTIONS = ['OB', 'RECEIPT', 'DISPOSAL_DESPATCH', 'LOCAL_SALE', 'OTHER_DISPOSAL', 'CB'] as const;

export default function TSReport({ rows, totals, date, shift }: Props) {
  // 1. Group rows by section
  const rowsBySection = SECTIONS.reduce((acc, s) => {
    acc[s] = rows.filter(r => r.section === s);
    return acc;
  }, {} as Record<(typeof SECTIONS)[number], TSMilkRow[]>);

  // Helper to calculate totals of a list of rows
  const getRowsTotal = (sRows: TSMilkRow[]) => {
    return {
      qty_lts: sRows.reduce((a, r) => a + r.qty_lts, 0),
      qty_kg: sRows.reduce((a, r) => a + r.qty_kg, 0),
      kg_fat: sRows.reduce((a, r) => a + r.kg_fat, 0),
      kg_snf: sRows.reduce((a, r) => a + r.kg_snf, 0),
    };
  };

  // 2. Build aligned rows for left and right columns
  type AlignedRowItem =
    | { type: 'header'; label: string; isDisposal: boolean }
    | { type: 'item'; data: TSMilkRow; isDisposal: boolean; index: number }
    | { type: 'total'; label: string; data: ReturnType<typeof getRowsTotal>; isDisposal: boolean }
    | { type: 'empty' };

  const leftRows: AlignedRowItem[] = [];
  const rightRows: AlignedRowItem[] = [];

  // Populate left side: OB and RECEIPT
  // OB
  const obRows = rowsBySection['OB'];
  if (obRows.length > 0) {
    leftRows.push({ type: 'header', label: SECTION_LABELS['OB'], isDisposal: false });
    obRows.forEach((r, idx) => {
      leftRows.push({ type: 'item', data: r, isDisposal: false, index: idx + 1 });
    });
    leftRows.push({ type: 'total', label: 'O/B Total', data: getRowsTotal(obRows), isDisposal: false });
  }
  // RECEIPT
  const receiptRows = rowsBySection['RECEIPT'];
  if (receiptRows.length > 0) {
    leftRows.push({ type: 'header', label: SECTION_LABELS['RECEIPT'], isDisposal: false });
    receiptRows.forEach((r, idx) => {
      leftRows.push({ type: 'item', data: r, isDisposal: false, index: idx + 1 });
    });
    leftRows.push({ type: 'total', label: 'Receipts Total', data: getRowsTotal(receiptRows), isDisposal: false });
  }

  // Populate right side: DISPOSAL_DESPATCH, LOCAL_SALE, OTHER_DISPOSAL, CB
  // DESPATCH
  const despatchRows = rowsBySection['DISPOSAL_DESPATCH'];
  if (despatchRows.length > 0) {
    rightRows.push({ type: 'header', label: SECTION_LABELS['DISPOSAL_DESPATCH'], isDisposal: true });
    despatchRows.forEach((r, idx) => {
      rightRows.push({ type: 'item', data: r, isDisposal: true, index: idx + 1 });
    });
    rightRows.push({ type: 'total', label: 'Despatch Total', data: getRowsTotal(despatchRows), isDisposal: true });
  }
  // LOCAL
  const localRows = rowsBySection['LOCAL_SALE'];
  if (localRows.length > 0) {
    rightRows.push({ type: 'header', label: SECTION_LABELS['LOCAL_SALE'], isDisposal: true });
    localRows.forEach((r, idx) => {
      rightRows.push({ type: 'item', data: r, isDisposal: true, index: idx + 1 });
    });
    rightRows.push({ type: 'total', label: 'Local Sales Total', data: getRowsTotal(localRows), isDisposal: true });
  }
  // OTHER
  const otherRows = rowsBySection['OTHER_DISPOSAL'];
  if (otherRows.length > 0) {
    rightRows.push({ type: 'header', label: SECTION_LABELS['OTHER_DISPOSAL'], isDisposal: true });
    otherRows.forEach((r, idx) => {
      rightRows.push({ type: 'item', data: r, isDisposal: true, index: idx + 1 });
    });
    rightRows.push({ type: 'total', label: 'Other Disposal Total', data: getRowsTotal(otherRows), isDisposal: true });
  }
  // CB
  const cbRows = rowsBySection['CB'];
  if (cbRows.length > 0) {
    rightRows.push({ type: 'header', label: SECTION_LABELS['CB'], isDisposal: true });
    cbRows.forEach((r, idx) => {
      rightRows.push({ type: 'item', data: r, isDisposal: true, index: idx + 1 });
    });
    rightRows.push({ type: 'total', label: 'C/B Total', data: getRowsTotal(cbRows), isDisposal: true });
  }

  // 3. Align both arrays
  const maxRowsLength = Math.max(leftRows.length, rightRows.length);
  const alignedRows: Array<{ left: AlignedRowItem; right: AlignedRowItem }> = [];
  for (let i = 0; i < maxRowsLength; i++) {
    alignedRows.push({
      left: leftRows[i] || { type: 'empty' },
      right: rightRows[i] || { type: 'empty' },
    });
  }

  return (
    <div style={{ fontFamily: 'var(--font-sans)' }}>
      <div className="print-header" style={{ marginBottom: 16 }}>
        <div style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)' }}>
          NAMAKKAL DISTRICT CO-OPERATIVE MILK PRODUCERS&apos; UNION LTD
        </div>
        <div style={{ fontSize: '0.875rem', color: 'var(--brand-primary)', fontWeight: 600, marginTop: 4 }}>
          TOTAL SOLIDS DETAILS
        </div>
        <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: 4 }}>
          DATE: {new Date(date).toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' })}
          {shift ? ` | SHIFT: ${shift === 'D' ? 'Day' : 'Night'}` : ''}
        </div>
      </div>

      <div className="table-wrapper" style={{ overflowX: 'auto' }}>
        <table className="report-table" style={{ width: '100%', minWidth: 1400 }}>
          <thead>
            <tr style={{ background: '#f8fafc' }}>
              <th colSpan={9} style={{ textAlign: 'center', borderRight: '2px solid var(--border)' }}>ARRIVAL</th>
              <th colSpan={9} style={{ textAlign: 'center' }}>DISPOSAL</th>
            </tr>
            <tr>
              {/* Left Side Headers */}
              <th>S.No</th>
              <th>Arrival</th>
              <th className="num">Milk (Lit)</th>
              <th className="num">Milk (Kg)</th>
              <th className="num">Avg Fat %</th>
              <th className="num">Avg SNF %</th>
              <th className="num">Sp. Gr</th>
              <th className="num">Kg Fat</th>
              <th className="num" style={{ borderRight: '2px solid var(--border)' }}>Kg SNF</th>

              {/* Right Side Headers */}
              <th>S.No</th>
              <th>Disposal</th>
              <th className="num">Milk (Lit)</th>
              <th className="num">Milk (Kg)</th>
              <th className="num">Avg Fat %</th>
              <th className="num">Avg SNF %</th>
              <th className="num">Sp. Gr</th>
              <th className="num">Kg Fat</th>
              <th>Kg SNF</th>
            </tr>
          </thead>
          <tbody>
            {alignedRows.map((alignedRow, index) => {
              const left = alignedRow.left;
              const right = alignedRow.right;

              const renderRowHalf = (half: AlignedRowItem, isLeft: boolean) => {
                const middleBorder = isLeft ? { borderRight: '2px solid var(--border)' } : {};

                if (half.type === 'empty') {
                  return (
                    <td colSpan={9} style={{ background: '#fafafa', ...middleBorder }} />
                  );
                }

                if (half.type === 'header') {
                  const isDisp = half.isDisposal;
                  return (
                    <td colSpan={9} style={{
                      background: isDisp ? 'rgba(234,88,12,0.05)' : 'rgba(2,132,199,0.05)',
                      color: isDisp ? 'var(--brand-accent)' : 'var(--brand-primary)',
                      fontWeight: 700,
                      fontSize: '0.75rem',
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                      padding: '8px 12px',
                      borderLeft: `3px solid ${isDisp ? 'var(--brand-accent)' : 'var(--brand-primary)'}`,
                      ...middleBorder,
                    }}>
                      {half.label}
                    </td>
                  );
                }

                if (half.type === 'total') {
                  const isDisp = half.isDisposal;
                  const color = isDisp ? 'var(--brand-accent)' : 'var(--brand-primary)';
                  return (
                    <>
                      <td colSpan={2} style={{ textAlign: 'right', paddingRight: 12, fontWeight: 700 }}>
                        {half.label}
                      </td>
                      <td className="num" title="Formula: SUM(Milk Liters in this section)" style={{ cursor: 'help', fontWeight: 700 }}>{fmtNum(half.data.qty_lts)}</td>
                      <td className="num" title="Formula: SUM(Milk Kg in this section)" style={{ cursor: 'help', fontWeight: 700 }}>{fmtNum(half.data.qty_kg)}</td>
                      <td className="num">-</td>
                      <td className="num">-</td>
                      <td className="num">-</td>
                      <td className="num" title="Formula: SUM(Kg Fat in this section)" style={{ cursor: 'help', fontWeight: 700, color }}>{fmtNum(half.data.kg_fat, 4)}</td>
                      <td className="num" title="Formula: SUM(Kg SNF in this section)" style={{ cursor: 'help', fontWeight: 700, color, ...middleBorder }}>{fmtNum(half.data.kg_snf, 4)}</td>
                    </>
                  );
                }

                const isDisp = half.isDisposal;
                const row = half.data;
                return (
                  <>
                    <td style={{ color: 'var(--text-muted)', width: 40 }}>{half.index}</td>
                    <td style={{ fontWeight: 500 }}>{row.product}</td>
                    <td className="num">{fmtNum(row.qty_lts)}</td>
                    <td className="num" title="Formula: Milk (Lit) * Sp. Gr" style={{ cursor: 'help' }}>
                      {fmtNum(row.qty_kg)}
                    </td>
                    <td className="num">{fmtNum(row.fat_pct, 4)}</td>
                    <td className="num">{fmtNum(row.snf_pct, 4)}</td>
                    <td className="num" title="Formula: 1 + (Avg SNF % - Avg Fat % * 0.2 - 0.36) / 250" style={{ cursor: 'help' }}>
                      {fmtNum(row.sp_gr, 4)}
                    </td>
                    <td className="num" title="Formula: Milk (Kg) * Avg Fat % / 100" style={{ color: isDisp ? 'var(--brand-accent)' : 'var(--brand-primary)', fontWeight: 600, cursor: 'help' }}>
                      {fmtNum(row.kg_fat, 4)}
                    </td>
                    <td className="num" title="Formula: Milk (Kg) * Avg SNF % / 100" style={{ color: isDisp ? 'var(--brand-accent)' : 'var(--brand-primary)', fontWeight: 600, cursor: 'help', ...middleBorder }}>
                      {fmtNum(row.kg_snf, 4)}
                    </td>
                  </>
                );
              };

              return (
                <tr key={`aligned-row-${index}`}>
                  {renderRowHalf(left, true)}
                  {renderRowHalf(right, false)}
                </tr>
              );
            })}

            {/* Grand Total row */}
            <tr className="row-grand-total" style={{ fontWeight: 700, background: 'rgba(16,185,129,0.06)' }}>
              {/* Left Side: Arrival G.Total */}
              <td colSpan={2} style={{ textAlign: 'right', paddingRight: 12 }}>G. TOTAL (Arrival)</td>
              <td className="num" title="Formula: O/B Total (Lit) + Receipts Total (Lit)" style={{ cursor: 'help' }}>{fmtNum(totals.grand_total_arrival_lts)}</td>
              <td className="num" title="Formula: O/B Total (Kg) + Receipts Total (Kg)" style={{ cursor: 'help' }}>{fmtNum(totals.grand_total_arrival_kg)}</td>
              <td className="num">-</td>
              <td className="num">-</td>
              <td className="num">-</td>
              <td className="num" title="Formula: O/B Total (Kg Fat) + Receipts Total (Kg Fat)" style={{ cursor: 'help', color: 'var(--brand-primary)' }}>{fmtNum(totals.grand_total_arrival_kg_fat, 4)}</td>
              <td className="num" title="Formula: O/B Total (Kg SNF) + Receipts Total (Kg SNF)" style={{ cursor: 'help', color: 'var(--brand-primary)', borderRight: '2px solid var(--border)' }}>{fmtNum(totals.grand_total_arrival_kg_snf, 4)}</td>

              {/* Right Side: Disposal G.Total */}
              <td colSpan={2} style={{ textAlign: 'right', paddingRight: 12 }}>G. TOTAL (Disposal)</td>
              <td className="num" title="Formula: Despatch (Lit) + Local Sales (Lit) + Other Disposal (Lit) + C/B (Lit)" style={{ cursor: 'help' }}>{fmtNum(totals.grand_total_disposal_lts)}</td>
              <td className="num" title="Formula: Despatch (Kg) + Local Sales (Kg) + Other Disposal (Kg) + C/B (Kg)" style={{ cursor: 'help' }}>{fmtNum(totals.grand_total_disposal_kg)}</td>
              <td className="num">-</td>
              <td className="num">-</td>
              <td className="num">-</td>
              <td className="num" title="Formula: Despatch (Kg Fat) + Local Sales (Kg Fat) + Other Disposal (Kg Fat) + C/B (Kg Fat)" style={{ cursor: 'help', color: 'var(--brand-accent)' }}>{fmtNum(totals.grand_total_disposal_kg_fat, 4)}</td>
              <td className="num" title="Formula: Despatch (Kg SNF) + Local Sales (Kg SNF) + Other Disposal (Kg SNF) + C/B (Kg SNF)" style={{ cursor: 'help', color: 'var(--brand-accent)' }}>{fmtNum(totals.grand_total_disposal_kg_snf, 4)}</td>
            </tr>

            {/* Loss / Gain row */}
            <tr className={totals.loss_kg_fat >= 0 ? 'row-loss' : 'row-gain'} style={{ fontWeight: 700 }}>
              <td colSpan={9} style={{ borderRight: '2px solid var(--border)' }} />
              <td colSpan={2} style={{ textAlign: 'right', paddingRight: 12 }}>
                {totals.loss_kg_fat >= 0 ? 'LOSS' : 'GAIN'}
              </td>
              <td className="num">-</td>
              <td className="num">-</td>
              <td className="num">-</td>
              <td className="num">-</td>
              <td className="num">-</td>
              <td className="num" title="Formula: G.Total Arrival (Kg Fat) - G.Total Disposal (Kg Fat)" style={{ cursor: 'help' }}>{fmtNum(Math.abs(totals.loss_kg_fat), 4)}</td>
              <td className="num" title="Formula: G.Total Arrival (Kg SNF) - G.Total Disposal (Kg SNF)" style={{ cursor: 'help' }}>{fmtNum(Math.abs(totals.loss_kg_snf), 4)}</td>
            </tr>

            {/* Loss % row */}
            <tr style={{ background: 'rgba(0,0,0,0.02)', fontWeight: 700 }}>
              <td colSpan={9} style={{ borderRight: '2px solid var(--border)' }} />
              <td colSpan={2} style={{ textAlign: 'right', paddingRight: 12, color: 'var(--text-secondary)', fontSize: '0.8rem' }}>LOSS %</td>
              <td colSpan={5} />
              <td className="num" style={{ color: totals.loss_pct_fat > CMPDD_NORM_PCT ? 'var(--brand-danger)' : 'var(--brand-success)', cursor: 'help' }} title="Formula: Loss (Kg Fat) / G.Total Arrival (Kg Fat) * 100">
                {fmtPct(totals.loss_pct_fat)}
              </td>
              <td className="num" style={{ color: Math.abs(totals.loss_pct_snf) > CMPDD_NORM_PCT ? 'var(--brand-danger)' : 'var(--brand-success)', cursor: 'help' }} title="Formula: Loss (Kg SNF) / G.Total Arrival (Kg SNF) * 100">
                {fmtPct(totals.loss_pct_snf)}
              </td>
            </tr>

            {/* CMPDD Norm row */}
            <tr style={{ background: 'rgba(0,0,0,0.02)' }}>
              <td colSpan={9} style={{ borderRight: '2px solid var(--border)' }} />
              <td colSpan={2} style={{ textAlign: 'right', paddingRight: 12, color: 'var(--text-muted)', fontSize: '0.8rem' }}>CMPDD NORM (0.5%)</td>
              <td colSpan={5} />
              <td className="num" style={{ color: 'var(--text-muted)' }}>{CMPDD_NORM_PCT}%</td>
              <td className="num" style={{ color: 'var(--text-muted)' }}>{CMPDD_NORM_PCT}%</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
