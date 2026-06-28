import { NextRequest, NextResponse } from 'next/server';
import * as XLSX from 'xlsx';
import { isLocalDbEnabled, createLocalEntry, saveLocalTSData, saveLocalStockData } from '@/lib/fileDb';
import { getSupabaseServiceClient } from '@/lib/supabase';
import { TS_OB_PRODUCTS, TS_RECEIPT_PRODUCTS, TS_DESPATCH_PRODUCTS, TS_LOCAL_SALE_PRODUCTS, TS_OTHER_DISPOSAL_PRODUCTS } from '@/lib/types';
import type { TSSection, StockRowType, Shift } from '@/lib/types';

// Helper: parse date from Excel format
function parseExcelDate(val: any): string {
  if (val instanceof Date) {
    return val.toISOString().split('T')[0];
  }
  if (typeof val === 'number') {
    // Excel serial number format
    const d = new Date((val - 25569) * 86400 * 1000);
    return d.toISOString().split('T')[0];
  }
  if (typeof val === 'string') {
    // e.g. "01-06-2026"
    const match = val.match(/(\d{2})[-/](\d{2})[-/](\d{4})/);
    if (match) return `${match[3]}-${match[2]}-${match[1]}`;
  }
  return new Date().toISOString().split('T')[0];
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File;
    const reportType = formData.get('report_type') as string; // 'TS' or 'STOCK'

    if (!file) return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });

    const bytes = await file.arrayBuffer();
    const workbook = XLSX.read(bytes, { type: 'array', cellDates: true });

    const localEnabled = isLocalDbEnabled();
    const supabase = !localEnabled ? getSupabaseServiceClient() : null;

    let importedCount = 0;

    if (reportType === 'TS') {
      // ─── PARSE TS REPORT ───────────────────────────────────────────────────
      const sheet = workbook.Sheets['TS'];
      if (!sheet) return NextResponse.json({ error: 'Sheet "TS" not found in workbook' }, { status: 400 });

      const range = XLSX.utils.decode_range(sheet['!ref'] || 'A1:R40');
      const rows: any[] = [];
      for (let r = range.s.r; r <= range.e.r; r++) {
        const row: any[] = [];
        for (let c = range.s.c; c <= range.e.c; c++) {
          const cell = sheet[XLSX.utils.encode_cell({ r, c })];
          row.push(cell ? cell.v : null);
        }
        rows.push(row);
      }

      // Try to find Date in sheet
      let entryDate = new Date().toISOString().split('T')[0];
      for (let r = 0; r < Math.min(10, rows.length); r++) {
        for (let c = 0; c < rows[r].length; c++) {
          const v = rows[r][c];
          if (v instanceof Date) {
            entryDate = v.toISOString().split('T')[0];
            break;
          }
        }
      }

      // We read O/B, Receipts, Despatch, Local Sales, Other Disposal, CB
      const tsRows: any[] = [];

      let currentLeftSection: TSSection = 'OB';
      let currentRightSection: TSSection = 'DISPOSAL_DESPATCH';

      for (let r = 2; r < rows.length; r++) {
        const row = rows[r];
        if (!row || row.length < 5) continue;

        // Left Side: Arrival (cols 0-8)
        const leftProd = row[1] ? String(row[1]).trim() : null;
        if (leftProd === 'TOTAL') {
          // transition left
          currentLeftSection = 'RECEIPT';
        }

        if (leftProd && leftProd !== 'Arrival' && leftProd !== 'O/B' && leftProd !== 'TOTAL' && leftProd !== 'RECEIPTS') {
          const section: TSSection = (TS_OB_PRODUCTS as readonly string[]).includes(leftProd) && currentLeftSection === 'OB' ? 'OB' : 'RECEIPT';
          tsRows.push({
            section,
            product: leftProd,
            qty_lts: Number(row[2]) || 0,
            qty_kg: Number(row[3]) || 0,
            fat_pct: Number(row[4]) || 0,
            snf_pct: Number(row[5]) || 0,
            sp_gr: Number(row[6]) || 0,
            kg_fat: Number(row[7]) || 0,
            kg_snf: Number(row[8]) || 0,
            remarks: '',
          });
        }

        // Right Side: Disposal (cols 9-17)
        const rightProd = row[10] ? String(row[10]).trim() : null;
        if (rightProd === 'C/B' || rightProd === 'CB') {
          currentRightSection = 'CB';
        }

        if (rightProd && rightProd !== 'Disposal' && rightProd !== 'TOTAL' && rightProd !== 'C/B') {
          let section: TSSection = 'CB';
          if (currentRightSection !== 'CB') {
            if ((TS_DESPATCH_PRODUCTS as readonly string[]).includes(rightProd)) section = 'DISPOSAL_DESPATCH';
            else if ((TS_LOCAL_SALE_PRODUCTS as readonly string[]).includes(rightProd)) section = 'LOCAL_SALE';
            else section = 'OTHER_DISPOSAL';
          }
          tsRows.push({
            section,
            product: rightProd,
            qty_lts: Number(row[11]) || 0,
            qty_kg: Number(row[12]) || 0,
            fat_pct: Number(row[13]) || 0,
            snf_pct: Number(row[14]) || 0,
            sp_gr: Number(row[15]) || 0,
            kg_fat: Number(row[16]) || 0,
            kg_snf: Number(row[17]) || 0,
            remarks: '',
          });
        }
      }

      // Persist
      if (localEnabled) {
        const entry = createLocalEntry(entryDate, null, 'TS');
        saveLocalTSData(entry.id, tsRows);
      } else {
        const { data: entry, error: entErr } = await supabase!
          .from('entries')
          .insert({ entry_date: entryDate, report_type: 'TS' })
          .select()
          .single();
        if (entErr && entErr.code !== '23505') throw entErr;

        let entryId = entry?.id;
        if (!entryId) {
          const { data: ext } = await supabase!.from('entries').select('id').eq('entry_date', entryDate).eq('report_type', 'TS').single();
          entryId = ext?.id;
        }

        if (entryId) {
          await supabase!.from('ts_milk_rows').delete().eq('entry_id', entryId);
          await supabase!.from('ts_milk_rows').insert(
            tsRows.map((r, sort_order) => ({ ...r, entry_id: entryId, sort_order }))
          );
        }
      }
      importedCount = 1;

    } else if (reportType === 'STOCK') {
      // ─── PARSE STOCK REGISTER ─────────────────────────────────────────────
      // Loop over sheets (could be one shift or multiple daily tabs)
      for (const sheetName of workbook.SheetNames) {
        // e.g. "1-06-2026D" or "01-06-2026N"
        const match = sheetName.match(/(\d{1,2}-\d{1,2}-\d{4})([DN])/);
        if (!match) continue;

        const dateParts = match[1].split('-');
        const entryDate = `${dateParts[2]}-${dateParts[1].padStart(2, '0')}-${dateParts[0].padStart(2, '0')}`;
        const shift = match[2] as Shift;

        const sheet = workbook.Sheets[sheetName];
        if (!sheet) continue;

        // Parse sheet table grid rows
        const range = XLSX.utils.decode_range(sheet['!ref'] || 'A1:T33');
        const sheetRows: any[] = [];
        for (let r = range.s.r; r <= range.e.r; r++) {
          const row: any[] = [];
          for (let c = range.s.c; c <= range.e.c; c++) {
            const cell = sheet[XLSX.utils.encode_cell({ r, c })];
            row.push(cell ? cell.v : null);
          }
          sheetRows.push(row);
        }

        const stockRows: any[] = [];
        let separationDetails: any = null;

        // Stock Statement Columns layout (starts at col index 1: WH.Milk ... col index 12: Water)
        const colsMap = ['wh_milk', 'dlt_milk', 'fc_milk', 'std_milk', 'toned_curd', 'dtm', 'skim_milk', 'cream', 'butter_milk', 'r_con', 'smp', 'water'] as const;

        let currentType: StockRowType = 'OB';

        for (let r = 2; r < sheetRows.length; r++) {
          const row = sheetRows[r];
          if (!row || row.length < 2) continue;

          const label = row[0] ? String(row[0]).trim() : '';
          if (!label) continue;

          if (label === 'Receipts:') {
            currentType = 'RECEIPT';
            continue;
          }
          if (label === 'Disposals:') {
            currentType = 'DISPOSAL';
            continue;
          }
          if (label === 'physical') {
            currentType = 'PHYSICAL';
          }

          if (label === 'TOTAL' || label === 'difference' || label === 'Closing Balance' || label === 'DATE') continue;

          // Check if this row is separation details
          if (label === 'Details of Separation' || label === 'WM' || label === 'SSM (Lts)' || label === 'Cream (Lts)') {
            continue;
          }

          // Build row record
          const rowRecord: any = {
            row_type: currentType,
            row_label: label,
          };

          for (let c = 0; c < 12; c++) {
            rowRecord[colsMap[c]] = Number(row[c + 1]) || 0;
          }

          stockRows.push(rowRecord);
        }

        // Persist
        if (localEnabled) {
          const entry = createLocalEntry(entryDate, shift, 'STOCK');
          saveLocalStockData(entry.id, stockRows, separationDetails);
        } else {
          const { data: entry, error: entErr } = await supabase!
            .from('entries')
            .insert({ entry_date: entryDate, shift, report_type: 'STOCK' })
            .select()
            .single();
          if (entErr && entErr.code !== '23505') throw entErr;

          let entryId = entry?.id;
          if (!entryId) {
            const { data: ext } = await supabase!.from('entries').select('id').eq('entry_date', entryDate).eq('shift', shift).eq('report_type', 'STOCK').single();
            entryId = ext?.id;
          }

          if (entryId) {
            await Promise.all([
              supabase!.from('stock_rows').delete().eq('entry_id', entryId),
              supabase!.from('separation_details').delete().eq('entry_id', entryId),
            ]);

            await supabase!.from('stock_rows').insert(
              stockRows.map((r, sort_order) => ({ ...r, entry_id: entryId, sort_order }))
            );
          }
        }
        importedCount++;
      }
    }

    return NextResponse.json({ success: true, count: importedCount });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
