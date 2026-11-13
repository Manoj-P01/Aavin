// ─────────────────────────────────────────────────────────────
// src/lib/export/prepChartExport.ts
// Preparation Charts Export Library (Excel, CSV, PDF)
// ─────────────────────────────────────────────────────────────

export interface ChartColumnDef {
  key: string;
  name: string;
  type?: string;
  formula?: string;
  decimals?: number;
  is_quantity?: boolean;
}

export interface ChartMasterDef {
  key: string;
  name: string;
  product_variant?: string;
  target_batch_liters?: number;
  target_fat?: number;
  target_snf?: number;
}

export interface ChartRowData {
  variant_name?: string;
  values?: Record<string, any>;
}

export interface ChartBatchData {
  batch_name?: string;
  target_batch_liters?: number;
  rows: ChartRowData[];
}

export interface ChartEntryData {
  batches?: ChartBatchData[];
  rows?: ChartRowData[];
}

/** Compute numeric/formula cell values */
export function getChartCellValue(
  col: ChartColumnDef,
  rowVals: Record<string, any> = {},
  rowIndex: number = 0,
  rowsContext: ChartRowData[] = []
): any {
  const cellVal = rowVals ? rowVals[col.key] : undefined;

  if (cellVal !== undefined && cellVal !== '' && cellVal !== null) {
    if (typeof cellVal === 'number') return cellVal;
    const num = parseFloat(String(cellVal));
    if (!isNaN(num)) return num;
    return cellVal;
  }

  // Calculated defaults
  const qtyLit = parseFloat(String(rowVals?.qty_lit || 0));
  const spGr = parseFloat(String(rowVals?.sp_gr || 0));
  const fatPct = parseFloat(String(rowVals?.fat_pct || 0));
  const snfPct = parseFloat(String(rowVals?.snf_pct || 0));

  if (col.key === 'qty_kg') {
    return spGr > 0 ? qtyLit * spGr : qtyLit;
  }
  if (col.key === 'fat_kg') {
    const qtyKg = spGr > 0 ? qtyLit * spGr : qtyLit;
    return (qtyKg * fatPct) / 100;
  }
  if (col.key === 'snf_kg') {
    const qtyKg = spGr > 0 ? qtyLit * spGr : qtyLit;
    return (qtyKg * snfPct) / 100;
  }

  return '';
}

/** Compute total qty in liters for a batch */
export function computeBatchQtyTotal(batchRows: ChartRowData[], columns: ChartColumnDef[]): number {
  const qtyCol = columns.find(c => c.key === 'qty_lit') || columns.find(c => c.is_quantity);
  if (!qtyCol) return 0;
  let sum = 0;
  (batchRows || []).forEach((r, idx) => {
    const v = getChartCellValue(qtyCol, r.values || {}, idx, batchRows);
    const n = parseFloat(String(v));
    if (!isNaN(n)) sum += n;
  });
  return sum;
}

/** Export selected preparation charts to Excel with styled sheets */
export async function exportPrepChartsToExcel({
  masters,
  chartEntriesData,
  columns,
  date,
  shiftLabel = 'Full Day',
  filename,
}: {
  masters: ChartMasterDef[];
  chartEntriesData: Record<string, ChartEntryData>;
  columns: ChartColumnDef[];
  date: string;
  shiftLabel?: string;
  filename?: string;
}) {
  if (typeof window === 'undefined') return;

  const XLSX = await import('xlsx-js-style');

  const border = {
    top: { style: 'thin', color: { rgb: '94A3B8' } },
    bottom: { style: 'thin', color: { rgb: '94A3B8' } },
    left: { style: 'thin', color: { rgb: '94A3B8' } },
    right: { style: 'thin', color: { rgb: '94A3B8' } },
  };

  const headerFill = { fgColor: { rgb: '1E3A5F' } };
  const batchHeaderFill = { fgColor: { rgb: 'E0F2FE' } };
  const titleFill = { fgColor: { rgb: 'EDE9FE' } };
  const whiteFont = { bold: true, color: { rgb: 'FFFFFF' }, sz: 10 };
  const normalFont = { color: { rgb: '1E293B' }, sz: 9 };
  const mutedFont = { color: { rgb: '475569' }, sz: 9 };

  const wb = XLSX.utils.book_new();

  // 1. Individual Sheet per Chart
  masters.forEach(master => {
    const chartData = chartEntriesData[master.key];
    const batches = chartData?.batches || (chartData?.rows ? [{ rows: chartData.rows }] : []);

    const rawName = (master.product_variant || master.name).replace(/[\[\]:*?/\\]/g, '').substring(0, 31);
    const sheetName = rawName || master.key.substring(0, 31);

    const sheetData: any[][] = [];
    sheetData.push([`Milk & Cream Preparation Charts`]);
    sheetData.push([`Date: ${date}  |  Shift: ${shiftLabel}  |  Chart: ${master.name}`]);
    const target = master.target_batch_liters ?? (batches[0] ? computeBatchQtyTotal(batches[0].rows || [], columns) : 0);
    sheetData.push([`Target: ${target > 0 ? target : '-'} L    Fat: ${master.target_fat ?? '-'}%    SNF: ${master.target_snf ?? '-'}%`]);
    sheetData.push([]); // blank

    sheetData.push(columns.map(c => c.name));

    if (batches.length === 0) {
      sheetData.push(['No batch data available']);
    } else {
      batches.forEach((batch, bIdx) => {
        const batchTarget = batch.target_batch_liters ?? master.target_batch_liters ?? computeBatchQtyTotal(batch.rows || [], columns);
        sheetData.push([`${batch.batch_name || `Batch #${bIdx + 1}`} — Target: ${batchTarget > 0 ? batchTarget : '-'} L`]);

        (batch.rows || []).forEach((row, rIdx) => {
          const rowCells = columns.map(col => {
            const val = getChartCellValue(col, row.values || {}, rIdx, batch.rows);
            if (val === undefined || val === null || val === '') return '';
            if (typeof val === 'number') return isNaN(val) ? '' : parseFloat(val.toFixed(col.decimals ?? 3));
            const n = parseFloat(String(val));
            return isNaN(n) ? String(val) : parseFloat(n.toFixed(col.decimals ?? 3));
          });
          sheetData.push(rowCells);
        });

        sheetData.push([]); // blank between batches
      });
    }

    const ws = XLSX.utils.aoa_to_sheet(sheetData);
    const numCols = columns.length;
    const range = XLSX.utils.decode_range(ws['!ref'] || 'A1');

    for (let R = range.s.r; R <= range.e.r; R++) {
      for (let C = range.s.c; C <= range.e.c; C++) {
        const addr = XLSX.utils.encode_cell({ r: R, c: C });
        if (!ws[addr]) ws[addr] = { v: '', t: 's' };
        const cell = ws[addr];

        if (R === 0) {
          cell.s = { fill: titleFill, font: { bold: true, color: { rgb: '5B21B6' }, sz: 12 }, alignment: { horizontal: 'left' } };
        } else if (R === 1 || R === 2) {
          cell.s = { font: mutedFont, alignment: { horizontal: 'left' } };
        } else if (R === 4) {
          cell.s = { fill: headerFill, font: whiteFont, border, alignment: { horizontal: 'center' } };
        } else if (R > 4) {
          const firstCellAddr = XLSX.utils.encode_cell({ r: R, c: 0 });
          const firstCellVal = ws[firstCellAddr]?.v;
          const isBatchRow = typeof firstCellVal === 'string' && /Batch/i.test(firstCellVal) && C === 0;

          if (isBatchRow) {
            cell.s = { fill: batchHeaderFill, font: { bold: true, color: { rgb: '0369A1' }, sz: 10 } };
          } else if (typeof cell.v === 'number') {
            cell.s = { border, font: normalFont, numFmt: '0.000', alignment: { horizontal: 'right' } };
          } else {
            cell.s = { border, font: normalFont, alignment: { horizontal: 'left' } };
          }
        }
      }
    }

    ws['!cols'] = columns.map(() => ({ wch: 14 }));
    if (numCols > 1) {
      ws['!merges'] = [
        { s: { r: 0, c: 0 }, e: { r: 0, c: numCols - 1 } },
        { s: { r: 1, c: 0 }, e: { r: 1, c: numCols - 1 } },
        { s: { r: 2, c: 0 }, e: { r: 2, c: numCols - 1 } },
      ];
    }

    XLSX.utils.book_append_sheet(wb, ws, sheetName);
  });

  const finalName = filename || `Preparation_Charts_${date}_${shiftLabel.replace(/ /g, '_')}.xlsx`;
  const wbOut = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  const blob = new Blob([wbOut], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = finalName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/** Export report rows to CSV */
export function exportPrepChartsToCSV({
  headers,
  rows,
  filename = 'prep_chart_report.csv',
}: {
  headers: string[];
  rows: (string | number)[][];
  filename?: string;
}) {
  if (typeof window === 'undefined') return;

  const escapeCSV = (val: any) => {
    if (val === null || val === undefined) return '';
    const s = String(val);
    if (s.includes(',') || s.includes('"') || s.includes('\n')) {
      return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
  };

  const csvContent = [
    headers.map(escapeCSV).join(','),
    ...rows.map(row => row.map(escapeCSV).join(',')),
  ].join('\r\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/** Export selected charts to clean PDF print layout */
export function exportPrepChartsToPDF({
  masters,
  chartEntriesData,
  columns,
  date,
  shiftLabel = 'Full Day',
}: {
  masters: ChartMasterDef[];
  chartEntriesData: Record<string, ChartEntryData>;
  columns: ChartColumnDef[];
  date: string;
  shiftLabel?: string;
}) {
  if (typeof window === 'undefined') return;

  const colHeaders = columns.map(c => c.name);
  const tableStyle = 'border-collapse:collapse;width:100%;font-size:11px;margin-bottom:18px';
  const thStyle = 'border:1px solid #94a3b8;padding:5px 8px;background:#1e3a5f;color:#ffffff;font-weight:700;text-align:center;white-space:nowrap';
  const tdStyle = 'border:1px solid #cbd5e1;padding:4px 8px;text-align:right;white-space:nowrap';

  let html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Preparation Charts - ${date}</title>`;
  html += `<style>body{font-family:Arial,sans-serif;margin:20px;color:#1e293b}h1{font-size:15px;color:#1e3a5f;margin-bottom:4px}h2{font-size:13px;color:#0369a1;margin:16px 0 4px;border-bottom:2px solid #0369a1;padding-bottom:4px}h3{font-size:11px;color:#374151;margin:10px 0 4px}p{font-size:10px;color:#64748b;margin:0 0 8px}table{${tableStyle}}@media print{@page{margin:15mm;size:A3 landscape}}</style>`;
  html += `</head><body>`;
  html += `<h1>🥛 Milk &amp; Cream Preparation Charts</h1>`;
  html += `<p>Date: <strong>${date}</strong> &nbsp;|&nbsp; Shift: <strong>${shiftLabel}</strong> &nbsp;|&nbsp; Generated: ${new Date().toLocaleString('en-IN')}</p>`;

  masters.forEach(master => {
    const chartData = chartEntriesData[master.key];
    const batches = chartData?.batches || (chartData?.rows ? [{ rows: chartData.rows }] : []);
    const target = master.target_batch_liters ?? (batches[0] ? computeBatchQtyTotal(batches[0].rows || [], columns) : 0);
    html += `<h2>${master.name} <small style="font-weight:500;font-size:10px;color:#64748b">(${master.product_variant || 'DEFAULT'}) — Target: ${target > 0 ? target : '-'} L | Fat: ${master.target_fat ?? '-'}% | SNF: ${master.target_snf ?? '-'}%</small></h2>`;

    if (batches.length === 0) {
      html += `<p style="color:#94a3b8;font-style:italic">No batch data available.</p>`;
    } else {
      batches.forEach((batch, bIdx) => {
        const batchTarget = batch.target_batch_liters ?? master.target_batch_liters ?? computeBatchQtyTotal(batch.rows || [], columns);
        html += `<h3>${batch.batch_name || `Batch #${bIdx + 1}`} — Target: ${batchTarget > 0 ? batchTarget : '-'} L</h3>`;
        html += `<table><thead><tr>${colHeaders.map(h => `<th style="${thStyle}">${h}</th>`).join('')}</tr></thead><tbody>`;

        (batch.rows || []).forEach((row, rIdx) => {
          html += `<tr>`;
          columns.forEach(col => {
            const val = getChartCellValue(col, row.values || {}, rIdx, batch.rows);
            let displayVal = '';
            if (val !== undefined && val !== null && val !== '') {
              if (typeof val === 'number') {
                displayVal = isNaN(val)
                  ? ''
                  : parseFloat(val.toFixed(col.decimals ?? 3)).toLocaleString('en-IN', {
                      minimumFractionDigits: col.decimals ?? 3,
                      maximumFractionDigits: col.decimals ?? 3,
                    });
              } else {
                displayVal = String(val);
              }
            }
            html += `<td style="${tdStyle}">${displayVal}</td>`;
          });
          html += `</tr>`;
        });

        html += `</tbody></table>`;
      });
    }
  });

  html += `</body></html>`;

  const printWindow = window.open('', '_blank', 'width=1200,height=800');
  if (!printWindow) return;
  printWindow.document.write(html);
  printWindow.document.close();
  printWindow.focus();
  setTimeout(() => { printWindow.print(); }, 600);
}

