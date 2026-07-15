import fs from 'fs';
import path from 'path';
import type { Entry, TSMilkRow, STGRow, StockRow, SeparationDetails, ReportType, Shift } from './types';

const DB_FILE_PATH = path.join(process.cwd(), 'local_db.json');

interface Schema {
  entries: Entry[];
  ts_milk_rows: TSMilkRow[];
  stg_rows: STGRow[];
  stock_rows: StockRow[];
  separation_details: SeparationDetails[];
}

const KV_REST_API_URL = process.env.KV_REST_API_URL;
const KV_REST_API_TOKEN = process.env.KV_REST_API_TOKEN;
const isVercelKvAvailable = !!KV_REST_API_URL && !!KV_REST_API_TOKEN;
const KV_KEY = 'aavin_db';

async function fetchFromKv(command: string[]): Promise<any> {
  const res = await fetch(KV_REST_API_URL!, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${KV_REST_API_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(command),
    cache: 'no-store',
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Vercel KV REST Error: ${res.statusText} - ${text}`);
  }
  const json = await res.json();
  return json.result;
}

export async function initDb(): Promise<Schema> {
  const defaultDb: Schema = {
    entries: [],
    ts_milk_rows: [],
    stg_rows: [],
    stock_rows: [],
    separation_details: [],
  };

  if (isVercelKvAvailable) {
    try {
      const content = await fetchFromKv(['GET', KV_KEY]);
      if (content) {
        const parsed = typeof content === 'string' ? JSON.parse(content) : content;
        return {
          entries: parsed.entries || [],
          ts_milk_rows: parsed.ts_milk_rows || [],
          stg_rows: parsed.stg_rows || [],
          stock_rows: parsed.stock_rows || [],
          separation_details: parsed.separation_details || [],
        };
      }
    } catch (e) {
      console.error('Failed to load from Vercel KV, falling back to clean database', e);
    }
  } else {
    if (process.env.VERCEL === '1') {
      console.warn('Vercel KV is not configured. Reads will return an empty database, writes will fail.');
    }
    if (fs.existsSync(DB_FILE_PATH)) {
      try {
        const content = fs.readFileSync(DB_FILE_PATH, 'utf-8');
        const parsed = JSON.parse(content);
        return {
          entries: parsed.entries || [],
          ts_milk_rows: parsed.ts_milk_rows || [],
          stg_rows: parsed.stg_rows || [],
          stock_rows: parsed.stock_rows || [],
          separation_details: parsed.separation_details || [],
        };
      } catch {
        // corrupt JSON, start clean
      }
    }
  }

  if (isVercelKvAvailable) {
    try {
      await fetchFromKv(['SET', KV_KEY, JSON.stringify(defaultDb)]);
    } catch (e) {
      console.error('Failed to initialize Vercel KV database schema', e);
    }
  } else {
    if (process.env.VERCEL !== '1') {
      fs.writeFileSync(DB_FILE_PATH, JSON.stringify(defaultDb, null, 2), 'utf-8');
    }
  }
  return defaultDb;
}

export async function saveDb(data: Schema) {
  if (isVercelKvAvailable) {
    await fetchFromKv(['SET', KV_KEY, JSON.stringify(data)]);
  } else {
    if (process.env.VERCEL === '1') {
      throw new Error(
        'Vercel KV is not configured. ' +
        'Please link a Vercel KV database in your Vercel Project settings to enable persistent storage.'
      );
    }
    fs.writeFileSync(DB_FILE_PATH, JSON.stringify(data, null, 2), 'utf-8');
  }
}


export function isLocalDbEnabled(): boolean {
  return process.env.USE_LOCAL_STORAGE === 'true' ||
         !process.env.NEXT_PUBLIC_SUPABASE_URL ||
         process.env.NEXT_PUBLIC_SUPABASE_URL.includes('YOUR_PROJECT_REF');
}

// ─── Query Operations ─────────────────────────────────────────────────────────

export async function getLocalEntries(reportType?: ReportType, month?: string, date?: string, shift?: Shift | null): Promise<Entry[]> {
  const db = await initDb();
  let result = [...db.entries];

  if (reportType) {
    result = result.filter(e => e.report_type === reportType);
  }
  if (date) {
    result = result.filter(e => e.entry_date === date);
  }
  if (month) {
    result = result.filter(e => e.entry_date.startsWith(month)); // YYYY-MM
  }
  if (shift !== undefined) {
    result = result.filter(e => e.shift === shift || (!e.shift && !shift));
  }

  return result.sort((a, b) => b.entry_date.localeCompare(a.entry_date));
}

export async function createLocalEntry(entry_date: string, shift: Shift | null, report_type: ReportType, notes?: string | null): Promise<Entry> {
  const db = await initDb();

  // Guard duplicate
  const exists = db.entries.find(e => e.entry_date === entry_date && e.shift === shift && e.report_type === report_type);
  if (exists) return exists;

  const newEntry: Entry = {
    id: Math.random().toString(36).substring(2, 11),
    entry_date,
    shift,
    report_type,
    notes: notes || null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  db.entries.push(newEntry);
  await saveDb(db);
  return newEntry;
}

export async function getLocalTSData(entryId: string) {
  const db = await initDb();
  const ts_rows = db.ts_milk_rows.filter(r => r.entry_id === entryId).sort((a, b) => a.sort_order - b.sort_order);
  const stg_rows = db.stg_rows.filter(r => r.entry_id === entryId).sort((a, b) => a.sort_order - b.sort_order);
  return { ts_rows, stg_rows };
}

export async function saveLocalTSData(entryId: string, tsRows: any[], stgRows?: any[], section?: string) {
  const db = await initDb();

  if (section) {
    // Delete only for this section
    db.ts_milk_rows = db.ts_milk_rows.filter(r => !(r.entry_id === entryId && r.section === section));
  } else {
    // Delete all
    db.ts_milk_rows = db.ts_milk_rows.filter(r => r.entry_id !== entryId);
    db.stg_rows = db.stg_rows.filter(r => r.entry_id !== entryId);
  }

  const rowsToInsert = tsRows.map((r, idx) => ({
    id: Math.random().toString(36).substring(2, 11),
    entry_id: entryId,
    section: r.section,
    product: r.product,
    qty_lts: Number(r.qty_lts) || 0,
    qty_kg: Number(r.qty_kg) || 0,
    fat_pct: Number(r.fat_pct) || 0,
    snf_pct: Number(r.snf_pct) || 0,
    sp_gr: Number(r.sp_gr) || 0,
    kg_fat: Number(r.kg_fat) || 0,
    kg_snf: Number(r.kg_snf) || 0,
    remarks: r.remarks || '',
    sort_order: r.sort_order ?? idx,
  }));

  db.ts_milk_rows.push(...rowsToInsert);

  if (stgRows && stgRows.length > 0) {
    const stgToInsert = stgRows.map((r, idx) => ({
      id: Math.random().toString(36).substring(2, 11),
      entry_id: entryId,
      product_block: r.product_block,
      side: r.side,
      item_name: r.item_name,
      qty_lts: Number(r.qty_lts) || 0,
      qty_kg: Number(r.qty_kg) || 0,
      fat_pct: Number(r.fat_pct) || 0,
      snf_pct: Number(r.snf_pct) || 0,
      sp_gr: Number(r.sp_gr) || 0,
      kg_fat: Number(r.kg_fat) || 0,
      kg_snf: Number(r.kg_snf) || 0,
      sort_order: r.sort_order ?? idx,
    }));
    db.stg_rows.push(...stgToInsert);
  }

  await saveDb(db);
  return rowsToInsert;
}

export async function getLocalStockData(entryId: string) {
  const db = await initDb();
  const stock_rows = db.stock_rows.filter(r => r.entry_id === entryId).sort((a, b) => a.sort_order - b.sort_order);
  const separation_details = db.separation_details.find(r => r.entry_id === entryId) || null;
  return { stock_rows, separation_details };
}

export async function saveLocalStockData(entryId: string, stockRows: any[], separationDetails?: any) {
  const db = await initDb();

  // Delete existing
  db.stock_rows = db.stock_rows.filter(r => r.entry_id !== entryId);
  db.separation_details = db.separation_details.filter(r => r.entry_id !== entryId);

  const rowsToInsert = stockRows.map((r, idx) => ({
    id: Math.random().toString(36).substring(2, 11),
    entry_id: entryId,
    row_type: r.row_type,
    row_label: r.row_label,
    wh_milk: Number(r.wh_milk) || 0,
    dlt_milk: Number(r.dlt_milk) || 0,
    fc_milk: Number(r.fc_milk) || 0,
    std_milk: Number(r.std_milk) || 0,
    toned_curd: Number(r.toned_curd) || 0,
    dtm: Number(r.dtm) || 0,
    skim_milk: Number(r.skim_milk) || 0,
    cream: Number(r.cream) || 0,
    butter_milk: Number(r.butter_milk) || 0,
    r_con: Number(r.r_con) || 0,
    smp: Number(r.smp) || 0,
    water: Number(r.water) || 0,
    sort_order: r.sort_order ?? idx,
  }));

  db.stock_rows.push(...rowsToInsert);

  if (separationDetails) {
    db.separation_details.push({
      id: Math.random().toString(36).substring(2, 11),
      entry_id: entryId,
      wm_fat_pct: Number(separationDetails.wm_fat_pct) || 0,
      wm_snf_pct: Number(separationDetails.wm_snf_pct) || 0,
      cream_lts: Number(separationDetails.cream_lts) || 0,
      cream_fat_pct: Number(separationDetails.cream_fat_pct) || 0,
      cream_snf_pct: Number(separationDetails.cream_snf_pct) || 0,
      ssm_lts: Number(separationDetails.ssm_lts) || 0,
      ssm_fat_pct: Number(separationDetails.ssm_fat_pct) || 0,
      ssm_snf_pct: Number(separationDetails.ssm_snf_pct) || 0,
    });
  }

  await saveDb(db);
  return { row_count: rowsToInsert.length };
}

export async function getLocalAggregatedStock(type: string, date?: string, month?: string, year?: string, from?: string, to?: string) {
  const db = await initDb();
  let entries = [...db.entries].filter(e => e.report_type === 'STOCK');

  if (type === 'day' && date) {
    entries = entries.filter(e => e.entry_date === date);
  } else if (type === 'month' && month) {
    entries = entries.filter(e => e.entry_date.startsWith(month));
  } else if (type === 'year' && year) {
    entries = entries.filter(e => e.entry_date.startsWith(year));
  } else if (type === 'range' && from && to) {
    entries = entries.filter(e => e.entry_date >= from && e.entry_date <= to);
  }

  const entryIds = entries.map(e => e.id);
  const rows = db.stock_rows.filter(r => entryIds.includes(r.entry_id));

  // Aggregate by row_type and row_label
  const aggregatedMap: Record<string, any> = {};

  for (const r of rows) {
    const key = `${r.row_type}_${r.row_label}`;
    if (!aggregatedMap[key]) {
      aggregatedMap[key] = {
        row_type: r.row_type,
        row_label: r.row_label,
        wh_milk: 0, dlt_milk: 0, fc_milk: 0, std_milk: 0,
        toned_curd: 0, dtm: 0, skim_milk: 0, cream: 0,
        butter_milk: 0, r_con: 0, smp: 0, water: 0,
        sort_order: r.sort_order,
      };
    }
    const target = aggregatedMap[key];
    target.wh_milk += r.wh_milk;
    target.dlt_milk += r.dlt_milk;
    target.fc_milk += r.fc_milk;
    target.std_milk += r.std_milk;
    target.toned_curd += r.toned_curd;
    target.dtm += r.dtm;
    target.skim_milk += r.skim_milk;
    target.cream += r.cream;
    target.butter_milk += r.butter_milk;
    target.r_con += r.r_con;
    target.smp += r.smp;
    target.water += r.water;
  }

  return Object.values(aggregatedMap).sort((a, b) => a.sort_order - b.sort_order);
}
