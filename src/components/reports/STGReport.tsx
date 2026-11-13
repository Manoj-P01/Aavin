// ─────────────────────────────────────────────────────────────────────────────
// Aavin Dashboard – Solid Balance Details (STG) Report View
// Supports dynamic statements parsed from notes metadata
// ─────────────────────────────────────────────────────────────────────────────

'use client';

import type { STGRow } from '@/lib/types';
import { fmtNum } from '@/lib/calculations';
import { CALC_CONFIG } from '@/lib/config';

interface Props {
  stgRows: STGRow[];
  date: string;
  notes?: string | null;
  shift?: string | null;
}

export default function STGReport({ stgRows, date, notes, shift }: Props) {
  // Parse custom statements from notes
  let customStatements: Array<{ key: string; label: string }> = [];
  let customBlocks: Record<string, any> = {};
  let cmpddNorms: Record<string, string> = {};

  if (notes) {
    const notesParts = notes.split('\n');
    notesParts.forEach(part => {
      if (part.includes('__METADATA__:') || part.includes('__METADATA__::')) {
        const [, metaJson] = part.split('__METADATA__:');
        try {
          const meta = JSON.parse(metaJson);
          if (meta.custom_statements) {
            customStatements = meta.custom_statements;
          }
          if (meta.custom_blocks) {
            customBlocks = meta.custom_blocks;
          }
          if (meta.cmpdd_norms) {
            cmpddNorms = meta.cmpdd_norms;
          }
        } catch (e) {
          console.error('Failed to parse STG metadata in report:', e);
        }
      }
    });
  }

  const blockMap = new Map<string, { key: string; label: string }>();
  if (customStatements && customStatements.length > 0) {
    customStatements.forEach(s => {
      if (s && s.key) {
        blockMap.set(s.key, s);
      }
    });
  }

  // Dynamically collect any block keys present in stgRows or customBlocks metadata
  if (customBlocks) {
    Object.keys(customBlocks).forEach(bKey => {
      if (!blockMap.has(bKey)) {
        const cleanKey = bKey.toUpperCase();
        blockMap.set(bKey, { key: bKey, label: `${cleanKey} – RECEIPT AND DISPOSAL STATEMENT` });
      }
    });
  }

  stgRows.forEach(r => {
    if (r.product_block && !blockMap.has(r.product_block)) {
      const cleanKey = r.product_block.toUpperCase();
      const customMatch = customStatements.find(cs => cs.key === r.product_block);
      const label = customMatch ? customMatch.label : `${cleanKey} – RECEIPT AND DISPOSAL STATEMENT`;
      blockMap.set(r.product_block, { key: r.product_block, label });
    }
  });

  const allBlocks = Array.from(blockMap.values());

  const getBlockLabel = (blockKey: string, blockLabel: string) => {
    const rawLabel = (blockLabel || (customStatements.find(s => s.key === blockKey)?.label) || '').trim();
    if (rawLabel) {
      const upperLabel = rawLabel.toUpperCase();
      if (upperLabel.includes('STATEMENT')) return upperLabel;
      return `${upperLabel} – RECEIPT AND DISPOSAL STATEMENT`;
    }
    const upperLabel = (blockKey).toUpperCase().trim();
    if (upperLabel.includes('STATEMENT')) return upperLabel;
    return `${upperLabel} – RECEIPT AND DISPOSAL STATEMENT`;
  };

  const fmt = (v: number, decimals = 2) => {
    return Math.abs(v) > 0.0001 ? fmtNum(v, decimals) : '—';
  };

  const fmtDiff = (v: number, decimals = 2) => {
    return fmtNum(v, decimals);
  };

  return (
    <div style={{ fontFamily: 'var(--font-sans)' }}>
      {/* Print header */}
      <div className="print-header" style={{ marginBottom: 20 }}>
        <div style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)' }}>
          NAMAKKAL DISTRICT CO-OPERATIVE MILK PRODUCERS&apos; UNION LTD
        </div>
        <div style={{ fontSize: '0.875rem', color: 'var(--brand-primary)', fontWeight: 600, marginTop: 4 }}>
          SOLID BALANCE DETAILS (STG)
        </div>
        <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: 4 }}>
          DATE: {new Date(date).toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' })}
          {` | SHIFT: ${shift ? (shift === 'D' ? 'Day' : 'Night') : 'Full Day'}`}
        </div>
      </div>

      {allBlocks.map(blockInfo => {
        const block = blockInfo.key;
        const defaultNorm = CALC_CONFIG.TS_REPORT.CMPDD_NORM_PCT || 0.5;
        const bCmpddNormStr = (customBlocks[block] && customBlocks[block].cmpdd_norm)
          ? customBlocks[block].cmpdd_norm
          : (cmpddNorms[block] || String(defaultNorm));
        const bCmpddNorm = parseFloat(bCmpddNormStr) || defaultNorm;
        let blockRows = stgRows.filter(r => r.product_block === block);

        // If it's a custom block, map the rows from customBlocks metadata
        if (customBlocks[block]) {
          const bState = customBlocks[block];
          const makeRow = (itemName: string, side: 'RECEIPT' | 'DISPOSAL', itemState: any): STGRow => ({
            id: '',
            entry_id: '',
            product_block: block,
            side,
            item_name: itemName,
            qty_lts: parseFloat(itemState.qty_lts) || 0,
            qty_kg: parseFloat(itemState.qty_kg) || 0,
            fat_pct: parseFloat(itemState.fat_pct) || 0,
            snf_pct: parseFloat(itemState.snf_pct) || 0,
            sp_gr: parseFloat(itemState.sp_gr) || 0,
            kg_fat: parseFloat(itemState.kg_fat) || 0,
            kg_snf: parseFloat(itemState.kg_snf) || 0,
            sort_order: 0,
          });

          blockRows = [
            makeRow('OB', 'RECEIPT', bState.opening_balance),
            ...bState.receipts.map((r: any) => makeRow(r.item_name, 'RECEIPT', r)),
            ...bState.disposals.map((d: any) => makeRow(d.item_name, 'DISPOSAL', d)),
            makeRow('CB', 'DISPOSAL', bState.physical_count),
          ];
        }

        if (blockRows.length === 0) return null;

        const obRow = blockRows.find(r => r.item_name === 'OB');
        const cbRow = blockRows.find(r => r.item_name === 'CB');
        const receipts = blockRows.filter(r => r.side === 'RECEIPT' && r.item_name !== 'OB');
        const disposals = blockRows.filter(r => r.side === 'DISPOSAL' && r.item_name !== 'CB');

        // Align both sides row by row
        const maxLen = Math.max(receipts.length, disposals.length);
        const alignedRows: { r?: STGRow; d?: STGRow }[] = [];
        for (let i = 0; i < maxLen; i++) {
          alignedRows.push({ r: receipts[i], d: disposals[i] });
        }

        const totRec = {
          lts: receipts.reduce((a, r) => a + r.qty_lts, 0),
          kg: receipts.reduce((a, r) => a + r.qty_kg, 0),
          fat: receipts.reduce((a, r) => a + r.kg_fat, 0),
          snf: receipts.reduce((a, r) => a + r.kg_snf, 0),
        };
        const totDisp = {
          lts: disposals.reduce((a, r) => a + r.qty_lts, 0),
          kg: disposals.reduce((a, r) => a + r.qty_kg, 0),
          fat: disposals.reduce((a, r) => a + r.kg_fat, 0),
          snf: disposals.reduce((a, r) => a + r.kg_snf, 0),
        };

        const obVal = {
          lts: obRow ? obRow.qty_lts : 0,
          kg: obRow ? obRow.qty_kg : 0,
          fat_pct: obRow ? obRow.fat_pct : 0,
          snf_pct: obRow ? obRow.snf_pct : 0,
          sp_gr: obRow ? obRow.sp_gr : 0,
          fat: obRow ? obRow.kg_fat : 0,
          snf: obRow ? obRow.kg_snf : 0,
        };

        const physicalCB = {
          lts: cbRow ? cbRow.qty_lts : 0,
          kg: cbRow ? cbRow.qty_kg : 0,
          fat_pct: cbRow ? cbRow.fat_pct : 0,
          snf_pct: cbRow ? cbRow.snf_pct : 0,
          sp_gr: cbRow ? cbRow.sp_gr : 0,
          fat: cbRow ? cbRow.kg_fat : 0,
          snf: cbRow ? cbRow.kg_snf : 0,
        };

        const grandRec = {
          lts: obVal.lts + totRec.lts,
          kg: obVal.kg + totRec.kg,
          fat: obVal.fat + totRec.fat,
          snf: obVal.snf + totRec.snf,
        };

        const cbCalculated = {
          lts: grandRec.lts - totDisp.lts,
          kg: grandRec.kg - totDisp.kg,
          fat: grandRec.fat - totDisp.fat,
          snf: grandRec.snf - totDisp.snf,
        };

        const grandDisp = {
          lts: totDisp.lts + physicalCB.lts,
          kg: totDisp.kg + physicalCB.kg,
          fat: totDisp.fat + physicalCB.fat,
          snf: totDisp.snf + physicalCB.snf,
        };

        const lossGain = {
          lts: physicalCB.lts - cbCalculated.lts,
          kg: physicalCB.kg - cbCalculated.kg,
          fat: physicalCB.fat - cbCalculated.fat,
          snf: physicalCB.snf - cbCalculated.snf,
        };

        const lossGainPct = {
          lts: cbCalculated.lts !== 0 ? (lossGain.lts / cbCalculated.lts) * 100 : 0,
          kg: cbCalculated.kg !== 0 ? (lossGain.kg / cbCalculated.kg) * 100 : 0,
          fat: cbCalculated.fat !== 0 ? (lossGain.fat / cbCalculated.fat) * 100 : 0,
          snf: cbCalculated.snf !== 0 ? (lossGain.snf / cbCalculated.snf) * 100 : 0,
        };

        return (
          <div key={block} className="stg-block-card" style={{ marginBottom: 40, pageBreakAfter: 'always' }}>
            <div className="section-title" style={{ fontSize: '0.8rem', paddingBottom: 6, marginBottom: 12, borderBottom: '2px solid var(--brand-primary)', color: 'var(--brand-primary)', fontWeight: 700 }}>
              {getBlockLabel(block, blockInfo.label)}
            </div>

            <div className="table-wrapper" style={{ overflowX: 'auto' }}>
              <table className="report-table" style={{ width: '100%', fontSize: '0.78rem', minWidth: 1200 }}>
                <thead>
                  <tr style={{ background: '#f8fafc' }}>
                    <th colSpan={9} style={{ textAlign: 'center', borderRight: '2px solid var(--border)' }}>RECEIPTS</th>
                    <th colSpan={9} style={{ textAlign: 'center' }}>DISPOSALS</th>
                  </tr>
                  <tr>
                    {/* Receipts headers */}
                    <th style={{ width: 30 }}>S.No.</th>
                    <th style={{ width: 150 }}>Receipt</th>
                    <th className="num">Qty (Lts)</th>
                    <th className="num">Qty (Kg)</th>
                    <th className="num">Fat%</th>
                    <th className="num">Snf%</th>
                    <th className="num">SP.G</th>
                    <th className="num">Kg.Fat</th>
                    <th className="num" style={{ borderRight: '2px solid var(--border)' }}>Kg.Snf</th>

                    {/* Disposals headers */}
                    <th style={{ width: 30 }}>S.No.</th>
                    <th style={{ width: 150 }}>Disposal</th>
                    <th className="num">Qty (Lts)</th>
                    <th className="num">Qty (Kg)</th>
                    <th className="num">Fat%</th>
                    <th className="num">Snf%</th>
                    <th className="num">SP.G</th>
                    <th className="num">Kg.Fat</th>
                    <th className="num">Kg.Snf</th>
                  </tr>
                </thead>
                <tbody>
                  {/* Receipt and Disposal side-by-side rows */}
                  {alignedRows.map(({ r, d }, i) => (
                    <tr key={`${block}-${i}`}>
                      {/* Left: Receipt */}
                      <td style={{ color: 'var(--text-muted)' }}>{r ? i + 1 : ''}</td>
                      <td style={{ fontWeight: r ? 500 : 400 }}>{r ? r.item_name : ''}</td>
                      <td className="num">{r ? fmt(r.qty_lts) : ''}</td>
                      <td className="num">{r ? fmt(r.qty_kg) : ''}</td>
                      <td className="num">{r ? fmt(r.fat_pct, 4) : ''}</td>
                      <td className="num">{r ? fmt(r.snf_pct, 4) : ''}</td>
                      <td className="num">{r ? fmt(r.sp_gr, 4) : ''}</td>
                      <td className="num" style={{ color: 'var(--brand-primary)' }}>{r ? fmt(r.kg_fat, 4) : ''}</td>
                      <td className="num" style={{ borderRight: '2px solid var(--border)', color: 'var(--brand-primary)' }}>{r ? fmt(r.kg_snf, 4) : ''}</td>
                      {/* Right: Disposal */}
                      <td style={{ color: 'var(--text-muted)' }}>{d ? i + 1 : ''}</td>
                      <td style={{ fontWeight: d ? 500 : 400 }}>{d ? d.item_name : ''}</td>
                      <td className="num">{d ? fmt(d.qty_lts) : ''}</td>
                      <td className="num">{d ? fmt(d.qty_kg) : ''}</td>
                      <td className="num">{d ? fmt(d.fat_pct, 4) : ''}</td>
                      <td className="num">{d ? fmt(d.snf_pct, 4) : ''}</td>
                      <td className="num">{d ? fmt(d.sp_gr, 4) : ''}</td>
                      <td className="num" style={{ color: 'var(--brand-accent)' }}>{d ? fmt(d.kg_fat, 4) : ''}</td>
                      <td className="num">{d ? fmt(d.kg_snf, 4) : ''}</td>
                    </tr>
                  ))}

                  {/* Receipts / Disposals sub-total row */}
                  <tr className="total-row" style={{ fontWeight: 700, background: '#f8fafc' }}>
                    {/* Col A: S.No. empty */}
                    <td />
                    {/* Col B: Receipt label */}
                    <td style={{ fontWeight: 700 }}>Total (Receipt)</td>
                    <td className="num">{fmt(totRec.lts)}</td>
                    <td className="num">{fmt(totRec.kg)}</td>
                    <td colSpan={3} style={{ background: '#fafafa' }} />
                    <td className="num" style={{ color: 'var(--brand-primary)' }}>{fmt(totRec.fat, 4)}</td>
                    <td className="num" style={{ borderRight: '2px solid var(--border)', color: 'var(--brand-primary)' }}>{fmt(totRec.snf, 4)}</td>
                    {/* Col J: S.No. empty */}
                    <td />
                    {/* Col K: Disposal label */}
                    <td style={{ fontWeight: 700 }}>Total (Disposal)</td>
                    <td className="num">{fmt(totDisp.lts)}</td>
                    <td className="num">{fmt(totDisp.kg)}</td>
                    <td colSpan={3} style={{ background: '#fafafa' }} />
                    <td className="num" style={{ color: 'var(--brand-accent)' }}>{fmt(totDisp.fat, 4)}</td>
                    <td className="num">{fmt(totDisp.snf, 4)}</td>
                  </tr>

                  {/* OB (left) and CB (right) row in between total and grand total */}
                  <tr className="ob-cb-row" style={{ fontWeight: 700, background: 'rgba(2,132,199,0.06)' }}>
                    {/* OB — left (Receipts) side */}
                    {/* Col A: S.No. empty */}
                    <td></td>
                    {/* Col B: Receipt label */}
                    <td>Opening Balance (O/B)</td>
                    <td className="num">{fmt(obVal.lts)}</td>
                    <td className="num">{fmt(obVal.kg)}</td>
                    <td className="num">{fmt(obVal.fat_pct, 4)}</td>
                    <td className="num">{fmt(obVal.snf_pct, 4)}</td>
                    <td className="num">{fmt(obVal.sp_gr, 4)}</td>
                    <td className="num" style={{ color: 'var(--brand-primary)' }}>{fmt(obVal.fat, 4)}</td>
                    <td className="num" style={{ borderRight: '2px solid var(--border)', color: 'var(--brand-primary)' }}>{fmt(obVal.snf, 4)}</td>

                    {/* CB — right (Disposals) side */}
                    {/* Col J: S.No. empty */}
                    <td></td>
                    {/* Col K: Disposal label */}
                    <td>Closing Balance (C/B)</td>
                    <td className="num">{fmt(physicalCB.lts)}</td>
                    <td className="num">{fmt(physicalCB.kg)}</td>
                    <td colSpan={3} style={{ background: '#fafafa' }} />
                    <td className="num" style={{ color: 'var(--brand-primary)' }}>{fmt(physicalCB.fat, 4)}</td>
                    <td className="num">{fmt(physicalCB.snf, 4)}</td>
                  </tr>

                  {/* Grand Total row */}
                  <tr className="grand-total-row" style={{ fontWeight: 700, background: 'rgba(16,185,129,0.1)' }}>
                    {/* Col A: S.No. empty */}
                    <td />
                    {/* Col B: Receipt label */}
                    <td style={{ fontWeight: 700 }}>Grand Total Receipts</td>
                    <td className="num">{fmt(grandRec.lts)}</td>
                    <td className="num">{fmt(grandRec.kg)}</td>
                    <td colSpan={3} style={{ background: '#fafafa' }} />
                    <td className="num" style={{ color: 'var(--brand-primary)' }}>{fmt(grandRec.fat, 4)}</td>
                    <td className="num" style={{ borderRight: '2px solid var(--border)', color: 'var(--brand-primary)' }}>{fmt(grandRec.snf, 4)}</td>

                    {/* Col J: S.No. empty */}
                    <td />
                    {/* Col K: Disposal label */}
                    <td style={{ fontWeight: 700 }}>Grand Total Disposals</td>
                    <td className="num">{fmt(grandDisp.lts)}</td>
                    <td className="num">{fmt(grandDisp.kg)}</td>
                    <td colSpan={3} style={{ background: '#fafafa' }} />
                    <td className="num" style={{ color: 'var(--brand-primary)' }}>{fmt(grandDisp.fat, 4)}</td>
                    <td className="num">{fmt(grandDisp.snf, 4)}</td>
                  </tr>

                  {/* Physical Count row */}
                  <tr className="physical-row" style={{ fontWeight: 600, background: '#fafafa' }}>
                    <td colSpan={9} style={{ borderRight: '2px solid var(--border)' }} />
                    {/* Col J: S.No. empty */}
                    <td />
                    {/* Col K: Disposal label */}
                    <td>Physical Count (CB)</td>
                    <td className="num">{fmt(physicalCB.lts)}</td>
                    <td className="num">{fmt(physicalCB.kg)}</td>
                    <td className="num">{fmt(physicalCB.fat_pct, 4)}</td>
                    <td className="num">{fmt(physicalCB.snf_pct, 4)}</td>
                    <td className="num">{fmt(physicalCB.sp_gr, 4)}</td>
                    <td className="num" style={{ color: 'var(--brand-primary)' }}>{fmt(physicalCB.fat, 4)}</td>
                    <td className="num">{fmt(physicalCB.snf, 4)}</td>
                  </tr>

                  {/* Loss/Gain row */}
                  <tr className="loss-gain-row" style={{ fontWeight: 700, background: 'rgba(239,68,68,0.06)' }}>
                    <td colSpan={9} style={{ borderRight: '2px solid var(--border)' }} />
                    {/* Col J: S.No. empty */}
                    <td />
                    {/* Col K: Disposal label */}
                    <td style={{ color: 'var(--brand-danger)' }}>Loss / Gain</td>
                    <td className="num" style={{ color: lossGain.lts >= 0 ? 'var(--brand-success)' : 'var(--brand-danger)' }}>
                      {lossGain.lts > 0 ? '+' : ''}{fmtDiff(lossGain.lts)}
                    </td>
                    <td className="num" style={{ color: lossGain.kg >= 0 ? 'var(--brand-success)' : 'var(--brand-danger)' }}>
                      {lossGain.kg > 0 ? '+' : ''}{fmtDiff(lossGain.kg)}
                    </td>
                    <td colSpan={3} style={{ background: '#fafafa' }} />
                    <td className="num" style={{ color: lossGain.fat >= 0 ? 'var(--brand-success)' : 'var(--brand-danger)' }}>
                      {lossGain.fat > 0 ? '+' : ''}{fmtDiff(lossGain.fat, 4)}
                    </td>
                    <td className="num" style={{ color: lossGain.snf >= 0 ? 'var(--brand-success)' : 'var(--brand-danger)' }}>
                      {lossGain.snf > 0 ? '+' : ''}{fmtDiff(lossGain.snf, 4)}
                    </td>
                  </tr>

                  {/* Loss/Gain % row */}
                  <tr className="loss-gain-pct-row" style={{ fontWeight: 700, background: 'rgba(239,68,68,0.06)' }}>
                    <td colSpan={9} style={{ borderRight: '2px solid var(--border)' }} />
                    {/* Col J: S.No. empty */}
                    <td />
                    {/* Col K: Disposal label */}
                    <td style={{ color: 'var(--brand-danger)' }}>Loss / Gain %</td>
                    <td className="num" style={{ color: lossGainPct.lts >= 0 ? 'var(--brand-success)' : 'var(--brand-danger)' }}>
                      {lossGainPct.lts > 0 ? '+' : ''}{fmtDiff(lossGainPct.lts)}%
                    </td>
                    <td className="num" style={{ color: lossGainPct.kg >= 0 ? 'var(--brand-success)' : 'var(--brand-danger)' }}>
                      {lossGainPct.kg > 0 ? '+' : ''}{fmtDiff(lossGainPct.kg)}%
                    </td>
                    <td colSpan={3} style={{ background: '#fafafa' }} />
                    <td className="num" style={{ color: Math.abs(lossGainPct.fat) > bCmpddNorm ? 'var(--brand-danger)' : 'var(--brand-success)' }}>
                      {lossGainPct.fat > 0 ? '+' : ''}{fmtDiff(lossGainPct.fat)}%
                    </td>
                    <td className="num" style={{ color: Math.abs(lossGainPct.snf) > bCmpddNorm ? 'var(--brand-danger)' : 'var(--brand-success)' }}>
                      {lossGainPct.snf > 0 ? '+' : ''}{fmtDiff(lossGainPct.snf)}%
                    </td>
                  </tr>

                  {/* CMPDD Norm row */}
                  <tr className="cmpdd-norm-row" style={{ background: 'rgba(0,0,0,0.02)', fontWeight: 600 }}>
                    <td colSpan={9} style={{ borderRight: '2px solid var(--border)' }} />
                    {/* Col J: S.No. empty */}
                    <td />
                    {/* Col K: Disposal label */}
                    <td style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>CMPDD Norms % ({bCmpddNorm}%)</td>
                    <td colSpan={5} style={{ background: '#fafafa' }} />
                    <td className="num" style={{ color: 'var(--text-muted)' }}>{bCmpddNorm}%</td>
                    <td className="num" style={{ color: 'var(--text-muted)' }}>{bCmpddNorm}%</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        );
      })}

      {/* Whole-Page Compiled STG Plant Summary Table */}
      {(() => {
        let plantGrandRec = { lts: 0, kg: 0, fat: 0, snf: 0 };
        let plantGrandDisp = { lts: 0, kg: 0, fat: 0, snf: 0 };

        allBlocks.forEach(blockInfo => {
          const block = blockInfo.key;
          let blockRows = stgRows.filter(r => r.product_block === block);
          if (customBlocks[block]) {
            const bState = customBlocks[block];
            const makeRow = (itemName: string, side: 'RECEIPT' | 'DISPOSAL', itemState: any): STGRow => ({
              id: '', entry_id: '', product_block: block, side, item_name: itemName,
              qty_lts: parseFloat(itemState.qty_lts) || 0,
              qty_kg: parseFloat(itemState.qty_kg) || 0,
              fat_pct: parseFloat(itemState.fat_pct) || 0,
              snf_pct: parseFloat(itemState.snf_pct) || 0,
              sp_gr: parseFloat(itemState.sp_gr) || 0,
              kg_fat: parseFloat(itemState.kg_fat) || 0,
              kg_snf: parseFloat(itemState.kg_snf) || 0,
              sort_order: 0,
            });
            blockRows = [
              makeRow('OB', 'RECEIPT', bState.opening_balance),
              ...bState.receipts.map((r: any) => makeRow(r.item_name, 'RECEIPT', r)),
              ...bState.disposals.map((d: any) => makeRow(d.item_name, 'DISPOSAL', d)),
              makeRow('CB', 'DISPOSAL', bState.physical_count),
            ];
          }
          const obRow = blockRows.find(r => r.item_name === 'OB');
          const cbRow = blockRows.find(r => r.item_name === 'CB');
          const receipts = blockRows.filter(r => r.side === 'RECEIPT' && r.item_name !== 'OB');
          const disposals = blockRows.filter(r => r.side === 'DISPOSAL' && r.item_name !== 'CB');

          const totRec = {
            lts: receipts.reduce((a, r) => a + r.qty_lts, 0),
            kg: receipts.reduce((a, r) => a + r.qty_kg, 0),
            fat: receipts.reduce((a, r) => a + r.kg_fat, 0),
            snf: receipts.reduce((a, r) => a + r.kg_snf, 0),
          };
          const totDisp = {
            lts: disposals.reduce((a, r) => a + r.qty_lts, 0),
            kg: disposals.reduce((a, r) => a + r.qty_kg, 0),
            fat: disposals.reduce((a, r) => a + r.kg_fat, 0),
            snf: disposals.reduce((a, r) => a + r.kg_snf, 0),
          };
          const obVal = {
            lts: obRow ? obRow.qty_lts : 0,
            kg: obRow ? obRow.qty_kg : 0,
            fat: obRow ? obRow.kg_fat : 0,
            snf: obRow ? obRow.kg_snf : 0,
          };
          const physicalCB = {
            lts: cbRow ? cbRow.qty_lts : 0,
            kg: cbRow ? cbRow.qty_kg : 0,
            fat: cbRow ? cbRow.kg_fat : 0,
            snf: cbRow ? cbRow.kg_snf : 0,
          };

          plantGrandRec.lts += (obVal.lts + totRec.lts);
          plantGrandRec.kg += (obVal.kg + totRec.kg);
          plantGrandRec.fat += (obVal.fat + totRec.fat);
          plantGrandRec.snf += (obVal.snf + totRec.snf);

          plantGrandDisp.lts += (totDisp.lts + physicalCB.lts);
          plantGrandDisp.kg += (totDisp.kg + physicalCB.kg);
          plantGrandDisp.fat += (totDisp.fat + physicalCB.fat);
          plantGrandDisp.snf += (totDisp.snf + physicalCB.snf);
        });

        const plantLossGain = {
          lts: plantGrandRec.lts - plantGrandDisp.lts,
          kg: plantGrandRec.kg - plantGrandDisp.kg,
          fat: plantGrandRec.fat - plantGrandDisp.fat,
          snf: plantGrandRec.snf - plantGrandDisp.snf,
        };
        const plantLossGainPct = {
          fat: plantGrandRec.fat !== 0 ? (plantLossGain.fat / plantGrandRec.fat) * 100 : 0,
          snf: plantGrandRec.snf !== 0 ? (plantLossGain.snf / plantGrandRec.snf) * 100 : 0,
        };
        const defaultNorm = CALC_CONFIG.TS_REPORT.CMPDD_NORM_PCT || 0.5;
        const isOverallWithinNorm = Math.abs(plantLossGainPct.fat) <= defaultNorm && Math.abs(plantLossGainPct.snf) <= defaultNorm;

        return (
          <div className="card-glass" style={{ padding: '20px 24px', marginTop: 30, background: '#ffffff', border: '2px solid #0284c7', borderRadius: 12, boxShadow: '0 8px 24px rgba(2, 132, 199, 0.08)' }}>
            <div style={{ fontWeight: 800, fontSize: '1rem', color: '#0369a1', marginBottom: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>🏭 WHOLE-PAGE COMPILED STG PLANT BALANCE SUMMARY</span>
              <span style={{ fontSize: '0.78rem', padding: '4px 12px', borderRadius: 20, fontWeight: 800, background: isOverallWithinNorm ? '#f0fdf4' : '#fef2f2', color: isOverallWithinNorm ? '#15803d' : '#b91c1c', border: isOverallWithinNorm ? '1px solid #86efac' : '1px solid #fca5a5' }}>
                {isOverallWithinNorm ? `🟢 Overall Plant Balance: Within CMPDD Norm (${defaultNorm}%)` : '🔴 Overall Plant Balance: Exceeds CMPDD Norm'}
              </span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 16 }}>
              <div style={{ background: '#f0f9ff', padding: '12px 16px', borderRadius: 8, border: '1px solid #bae6fd' }}>
                <div style={{ fontWeight: 800, fontSize: '0.85rem', color: '#0369a1', marginBottom: 6 }}>TOTAL PLANT RECEIPTS</div>
                <div style={{ fontSize: '0.82rem', color: '#0369a1', lineHeight: 1.6 }}>
                  <div>Qty (Lts): <strong>{fmt(plantGrandRec.lts)} Lts</strong></div>
                  <div>Qty (Kg): <strong>{fmt(plantGrandRec.kg)} Kg</strong></div>
                  <div>Kg Fat: <strong>{fmt(plantGrandRec.fat, 4)} Kg</strong></div>
                  <div>Kg SNF: <strong>{fmt(plantGrandRec.snf, 4)} Kg</strong></div>
                </div>
              </div>

              <div style={{ background: '#fff7ed', padding: '12px 16px', borderRadius: 8, border: '1px solid #fed7aa' }}>
                <div style={{ fontWeight: 800, fontSize: '0.85rem', color: '#c2410c', marginBottom: 6 }}>TOTAL PLANT DISPOSALS</div>
                <div style={{ fontSize: '0.82rem', color: '#c2410c', lineHeight: 1.6 }}>
                  <div>Qty (Lts): <strong>{fmt(plantGrandDisp.lts)} Lts</strong></div>
                  <div>Qty (Kg): <strong>{fmt(plantGrandDisp.kg)} Kg</strong></div>
                  <div>Kg Fat: <strong>{fmt(plantGrandDisp.fat, 4)} Kg</strong></div>
                  <div>Kg SNF: <strong>{fmt(plantGrandDisp.snf, 4)} Kg</strong></div>
                </div>
              </div>

              <div style={{ background: '#f8fafc', padding: '12px 16px', borderRadius: 8, border: '1px solid #cbd5e1' }}>
                <div style={{ fontWeight: 800, fontSize: '0.85rem', color: '#334155', marginBottom: 6 }}>OVERALL PLANT LOSS / GAIN</div>
                <div style={{ fontSize: '0.82rem', lineHeight: 1.6 }}>
                  <div style={{ color: plantLossGain.fat >= 0 ? '#16a34a' : '#dc2626' }}>
                    Fat Loss/Gain: <strong>{plantLossGain.fat > 0 ? '+' : ''}{fmtDiff(plantLossGain.fat, 4)} Kg</strong> ({plantLossGainPct.fat > 0 ? '+' : ''}{fmtDiff(plantLossGainPct.fat, 2)}%)
                  </div>
                  <div style={{ color: plantLossGain.snf >= 0 ? '#16a34a' : '#dc2626' }}>
                    SNF Loss/Gain: <strong>{plantLossGain.snf > 0 ? '+' : ''}{fmtDiff(plantLossGain.snf, 4)} Kg</strong> ({plantLossGainPct.snf > 0 ? '+' : ''}{fmtDiff(plantLossGainPct.snf, 2)}%)
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: 4 }}>
                    CMPDD Tolerance Limit: <strong>{defaultNorm}%</strong>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
