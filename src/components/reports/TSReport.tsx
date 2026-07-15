'use client';

import { Fragment } from 'react';
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

const REPORT_SECTIONS = ['RECEIPT', 'DISPOSAL_DESPATCH', 'LOCAL_SALE', 'OTHER_DISPOSAL'] as const;
const BALANCE_SECTIONS = ['OB', 'CB'] as const;
const SECTIONS = [...BALANCE_SECTIONS, ...REPORT_SECTIONS] as const;

export default function TSReport({ rows, totals, date, shift }: Props) {
  const rowsBySection = SECTIONS.reduce((acc, s) => {
    acc[s] = rows.filter(r => r.section === s);
    return acc;
  }, {} as Record<(typeof SECTIONS)[number], TSMilkRow[]>);

  const sectionTotal = (section: (typeof SECTIONS)[number]) => {
    const sRows = rowsBySection[section];
    return {
      qty_lts: sRows.reduce((a, r) => a + r.qty_lts, 0),
      qty_kg: sRows.reduce((a, r) => a + r.qty_kg, 0),
      kg_fat: sRows.reduce((a, r) => a + r.kg_fat, 0),
      kg_snf: sRows.reduce((a, r) => a + r.kg_snf, 0),
    };
  };

  const renderSection = (section: (typeof SECTIONS)[number]) => {
    const sRows = rowsBySection[section];
    if (sRows.length === 0) return null;

    const tot = sectionTotal(section);
    const isDisposal = ['DISPOSAL_DESPATCH', 'LOCAL_SALE', 'OTHER_DISPOSAL', 'CB'].includes(section);

    return (
      <Fragment key={section}>
        <tr className="section-header">
          <td colSpan={10} style={{
            background: isDisposal ? 'rgba(234,88,12,0.05)' : 'rgba(2,132,199,0.05)',
            color: isDisposal ? 'var(--brand-accent)' : 'var(--brand-primary)',
            fontWeight: 700,
            fontSize: '0.75rem',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            padding: '8px 12px',
            borderLeft: `3px solid ${isDisposal ? 'var(--brand-accent)' : 'var(--brand-primary)'}`,
          }}>
            {SECTION_LABELS[section]}
          </td>
        </tr>

        {sRows.map((row, i) => (
          <tr key={row.id}>
            <td style={{ color: 'var(--text-muted)', width: 40 }}>{i + 1}</td>
            <td style={{ fontWeight: 500 }}>{row.product}</td>
            <td className="num">{fmtNum(row.qty_lts)}</td>
            <td className="num">{fmtNum(row.qty_kg)}</td>
            <td className="num">{fmtNum(row.fat_pct, 4)}</td>
            <td className="num">{fmtNum(row.snf_pct, 4)}</td>
            <td className="num">{fmtNum(row.sp_gr, 4)}</td>
            <td className="num" style={{ color: isDisposal ? 'var(--brand-accent)' : 'var(--brand-primary)', fontWeight: 600 }}>
              {fmtNum(row.kg_fat, 4)}
            </td>
            <td className="num" style={{ color: isDisposal ? 'var(--brand-accent)' : 'var(--brand-primary)', fontWeight: 600 }}>
              {fmtNum(row.kg_snf, 4)}
            </td>
            <td style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>{row.remarks || '-'}</td>
          </tr>
        ))}

        <tr className="row-total">
          <td colSpan={2} style={{ textAlign: 'right', paddingRight: 12 }}>
            {section === 'OB' ? 'O/B Total' :
             section === 'CB' ? 'C/B Total' :
             `${SECTION_LABELS[section]} Total`}
          </td>
          <td className="num">{fmtNum(tot.qty_lts)}</td>
          <td className="num">{fmtNum(tot.qty_kg)}</td>
          <td className="num">-</td>
          <td className="num">-</td>
          <td className="num">-</td>
          <td className="num">{fmtNum(tot.kg_fat, 4)}</td>
          <td className="num">{fmtNum(tot.kg_snf, 4)}</td>
          <td />
        </tr>
      </Fragment>
    );
  };

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

      <div className="table-wrapper">
        <table className="report-table" style={{ width: '100%' }}>
          <thead>
            <tr>
              <th>S.No</th>
              <th>Arrival / Disposal</th>
              <th className="num">Milk (Lit)</th>
              <th className="num">Milk (Kg)</th>
              <th className="num">Avg Fat %</th>
              <th className="num">Avg SNF %</th>
              <th className="num">Sp. Gr</th>
              <th className="num">Kg Fat</th>
              <th className="num">Kg SNF</th>
              <th>Remarks</th>
            </tr>
          </thead>
          <tbody>
            {REPORT_SECTIONS.map(renderSection)}

            <tr className="row-grand-total">
              <td colSpan={2} style={{ textAlign: 'right', paddingRight: 12 }}>G. TOTAL (Arrival)</td>
              <td className="num">{fmtNum(totals.grand_total_arrival_lts)}</td>
              <td className="num">{fmtNum(totals.grand_total_arrival_kg)}</td>
              <td className="num">-</td>
              <td className="num">-</td>
              <td className="num">-</td>
              <td className="num">{fmtNum(totals.grand_total_arrival_kg_fat, 4)}</td>
              <td className="num">{fmtNum(totals.grand_total_arrival_kg_snf, 4)}</td>
              <td />
            </tr>
            <tr className="row-grand-total">
              <td colSpan={2} style={{ textAlign: 'right', paddingRight: 12 }}>G. TOTAL (Disposal)</td>
              <td className="num">{fmtNum(totals.grand_total_disposal_lts)}</td>
              <td className="num">{fmtNum(totals.grand_total_disposal_kg)}</td>
              <td className="num">-</td>
              <td className="num">-</td>
              <td className="num">-</td>
              <td className="num">{fmtNum(totals.grand_total_disposal_kg_fat, 4)}</td>
              <td className="num">{fmtNum(totals.grand_total_disposal_kg_snf, 4)}</td>
              <td />
            </tr>

            {BALANCE_SECTIONS.map(renderSection)}

            <tr className={totals.loss_kg_fat >= 0 ? 'row-loss' : 'row-gain'}>
              <td colSpan={2} style={{ textAlign: 'right', paddingRight: 12 }}>
                {totals.loss_kg_fat >= 0 ? 'LOSS' : 'GAIN'}
              </td>
              <td className="num">-</td>
              <td className="num">-</td>
              <td className="num">-</td>
              <td className="num">-</td>
              <td className="num">-</td>
              <td className="num">{fmtNum(Math.abs(totals.loss_kg_fat), 4)}</td>
              <td className="num">{fmtNum(Math.abs(totals.loss_kg_snf), 4)}</td>
              <td />
            </tr>
            <tr style={{ background: 'rgba(0,0,0,0.02)' }}>
              <td colSpan={2} style={{ textAlign: 'right', paddingRight: 12, color: 'var(--text-secondary)', fontSize: '0.8rem' }}>LOSS %</td>
              <td colSpan={5} />
              <td className="num" style={{ color: totals.loss_pct_fat > CMPDD_NORM_PCT ? 'var(--brand-danger)' : 'var(--brand-success)' }}>
                {fmtPct(totals.loss_pct_fat)}
              </td>
              <td className="num" style={{ color: Math.abs(totals.loss_pct_snf) > CMPDD_NORM_PCT ? 'var(--brand-danger)' : 'var(--brand-success)' }}>
                {fmtPct(totals.loss_pct_snf)}
              </td>
              <td />
            </tr>
            <tr style={{ background: 'rgba(0,0,0,0.02)' }}>
              <td colSpan={2} style={{ textAlign: 'right', paddingRight: 12, color: 'var(--text-muted)', fontSize: '0.8rem' }}>CMPDD NORM (0.5%)</td>
              <td colSpan={5} />
              <td className="num" style={{ color: 'var(--text-muted)' }}>{CMPDD_NORM_PCT}%</td>
              <td className="num" style={{ color: 'var(--text-muted)' }}>{CMPDD_NORM_PCT}%</td>
              <td />
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
