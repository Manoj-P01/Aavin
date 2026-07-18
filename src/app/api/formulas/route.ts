import { NextRequest, NextResponse } from 'next/server';
import { isLocalDbEnabled, initDb, saveDb, createLocalEntry } from '@/lib/fileDb';
import { getSupabaseServiceClient } from '@/lib/supabase';
import { CALC_CONFIG } from '@/lib/config';

const CONFIG_DATE = '1970-01-03';
const CONFIG_REPORT_TYPE = 'TS';

interface FormulaConfigItem {
  key: string;
  path: string;
  name: string;
  value: number;
  description: string;
  category: string;
  isCustom?: boolean;
}

// System defaults
function getSystemDefaults(): FormulaConfigItem[] {
  return [
    { key: 'SP_GR_BASE', path: 'SP_GR.BASE', name: 'Sp. Gr Base Value', value: CALC_CONFIG.SP_GR.BASE, category: 'Specific Gravity', description: 'Base constant in specific gravity formula' },
    { key: 'SP_GR_FAT_FACTOR', path: 'SP_GR.FAT_FACTOR', name: 'Sp. Gr Fat Factor', value: CALC_CONFIG.SP_GR.FAT_FACTOR, category: 'Specific Gravity', description: 'Multiplier for Avg Fat % in sp. gr formula' },
    { key: 'SP_GR_OFFSET', path: 'SP_GR.OFFSET', name: 'Sp. Gr Offset', value: CALC_CONFIG.SP_GR.OFFSET, category: 'Specific Gravity', description: 'Subtracted constant for Fat % factor in sp. gr formula' },
    { key: 'SP_GR_DIVISOR', path: 'SP_GR.DIVISOR', name: 'Sp. Gr Divisor', value: CALC_CONFIG.SP_GR.DIVISOR, category: 'Specific Gravity', description: 'Divisor constant in specific gravity formula' },
    { key: 'SP_GR_DECIMALS', path: 'SP_GR.DECIMALS', name: 'Sp. Gr Decimals Precision', value: CALC_CONFIG.SP_GR.DECIMALS, category: 'Specific Gravity', description: 'Number of decimal places to round specific gravity to' },
    
    { key: 'QTY_KG_DECIMALS', path: 'QTY_KG.DECIMALS', name: 'Qty Kg Rounding Precision', value: CALC_CONFIG.QTY_KG.DECIMALS, category: 'Milk Weight (Kg)', description: 'Number of decimal places to round Qty(Kg) to' },
    
    { key: 'KG_FAT_DIVISOR', path: 'KG_FAT.DIVISOR', name: 'Kg Fat Divisor', value: CALC_CONFIG.KG_FAT.DIVISOR, category: 'Kg Fat Calculations', description: 'Divisor constant for calculating Kg Fat from weight and Fat %' },
    { key: 'KG_FAT_DECIMALS', path: 'KG_FAT.DECIMALS', name: 'Kg Fat Rounding (STG)', value: CALC_CONFIG.KG_FAT.DECIMALS, category: 'Kg Fat Calculations', description: 'Decimal places for Kg Fat on STG receipts/disposals' },
    { key: 'KG_FAT_TS_DECIMALS', path: 'KG_FAT.TS_DECIMALS', name: 'Kg Fat Rounding (TS)', value: CALC_CONFIG.KG_FAT.TS_DECIMALS, category: 'Kg Fat Calculations', description: 'Decimal places for Kg Fat on TS totals' },
    
    { key: 'KG_SNF_DIVISOR', path: 'KG_SNF.DIVISOR', name: 'Kg SNF Divisor', value: CALC_CONFIG.KG_SNF.DIVISOR, category: 'Kg SNF Calculations', description: 'Divisor constant for calculating Kg SNF from weight and SNF %' },
    { key: 'KG_SNF_DECIMALS', path: 'KG_SNF.DECIMALS', name: 'Kg SNF Rounding (STG)', value: CALC_CONFIG.KG_SNF.DECIMALS, category: 'Kg SNF Calculations', description: 'Decimal places for Kg SNF on STG receipts/disposals' },
    { key: 'KG_SNF_TS_DECIMALS', path: 'KG_SNF.TS_DECIMALS', name: 'Kg SNF Rounding (TS)', value: CALC_CONFIG.KG_SNF.TS_DECIMALS, category: 'Kg SNF Calculations', description: 'Decimal places for Kg SNF on TS totals' },
    
    { key: 'TS_REPORT_QTY_LTS_DECIMALS', path: 'TS_REPORT.QTY_LTS_DECIMALS', name: 'TS Report Qty Liters Precision', value: CALC_CONFIG.TS_REPORT.QTY_LTS_DECIMALS, category: 'TS Report Display', description: 'Decimal precision for Qty (Lts) sums in TS report' },
    { key: 'TS_REPORT_QTY_KG_DECIMALS', path: 'TS_REPORT.QTY_KG_DECIMALS', name: 'TS Report Qty Weight Precision', value: CALC_CONFIG.TS_REPORT.QTY_KG_DECIMALS, category: 'TS Report Display', description: 'Decimal precision for Qty (Kg) sums in TS report' },
    { key: 'TS_REPORT_LOSS_PERCENTAGE_DECIMALS', path: 'TS_REPORT.LOSS_PERCENTAGE_DECIMALS', name: 'TS Loss Percentage Precision', value: CALC_CONFIG.TS_REPORT.LOSS_PERCENTAGE_DECIMALS, category: 'TS Report Display', description: 'Decimal precision for variance percentage loss/gain calculations' },
    { key: 'TS_REPORT_CMPDD_NORM_PCT', path: 'TS_REPORT.CMPDD_NORM_PCT', name: 'CMPDD Loss Norm Limit %', value: CALC_CONFIG.TS_REPORT.CMPDD_NORM_PCT, category: 'TS Report Display', description: 'Dairy cooperative standard loss tolerance percentage (limit before coloring red)' },
  ];
}

// Convert flat configuration array to nested calc config object
export function flatToNested(flatList: FormulaConfigItem[]) {
  const nested = {
    SP_GR: { BASE: 1, FAT_FACTOR: 0.2, OFFSET: 0.36, DIVISOR: 250, DECIMALS: 4 },
    QTY_KG: { DECIMALS: 3 },
    KG_FAT: { DIVISOR: 100, DECIMALS: 3, TS_DECIMALS: 4 },
    KG_SNF: { DIVISOR: 100, DECIMALS: 3, TS_DECIMALS: 4 },
    TS_REPORT: { QTY_LTS_DECIMALS: 3, QTY_KG_DECIMALS: 3, LOSS_PERCENTAGE_DECIMALS: 4, CMPDD_NORM_PCT: 0.5 },
    CUSTOM: {} as Record<string, number>,
  };

  flatList.forEach(item => {
    if (item.path) {
      const parts = item.path.split('.');
      if (parts.length === 2) {
        const sec = parts[0] as keyof typeof nested;
        const key = parts[1] as string;
        if (sec !== 'CUSTOM') {
          // @ts-ignore
          nested[sec][key] = Number(item.value);
        }
      }
    } else if (item.isCustom) {
      nested.CUSTOM[item.key] = Number(item.value);
    }
  });

  return nested;
}

export async function GET() {
  try {
    let flatConfig = getSystemDefaults();
    const localEnabled = isLocalDbEnabled();

    if (localEnabled) {
      const db = await initDb();
      const entry = db.entries.find(e => e.entry_date === CONFIG_DATE && e.report_type === CONFIG_REPORT_TYPE);
      if (entry && entry.notes) {
        flatConfig = JSON.parse(entry.notes);
      }
    } else {
      const supabase = getSupabaseServiceClient();
      const { data: entries } = await supabase
        .from('entries')
        .select('notes')
        .eq('entry_date', CONFIG_DATE)
        .eq('report_type', CONFIG_REPORT_TYPE);
      if (entries && entries.length > 0 && entries[0].notes) {
        flatConfig = JSON.parse(entries[0].notes);
      }
    }

    const nestedConfig = flatToNested(flatConfig);

    return NextResponse.json({
      data: {
        flat: flatConfig,
        nested: nestedConfig,
      }
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { flatConfig } = body as { flatConfig: FormulaConfigItem[] };
    if (!flatConfig || !Array.isArray(flatConfig)) {
      return NextResponse.json({ error: 'flatConfig array required' }, { status: 400 });
    }

    const localEnabled = isLocalDbEnabled();
    const notesJson = JSON.stringify(flatConfig);

    if (localEnabled) {
      const db = await initDb();
      let entry = db.entries.find(e => e.entry_date === CONFIG_DATE && e.report_type === CONFIG_REPORT_TYPE);
      if (!entry) {
        entry = await createLocalEntry(CONFIG_DATE, null, CONFIG_REPORT_TYPE, notesJson);
      } else {
        entry.notes = notesJson;
        entry.updated_at = new Date().toISOString();
        await saveDb(db);
      }
    } else {
      const supabase = getSupabaseServiceClient();
      const { data: existing } = await supabase
        .from('entries')
        .select('id')
        .eq('entry_date', CONFIG_DATE)
        .eq('report_type', CONFIG_REPORT_TYPE);

      if (existing && existing.length > 0) {
        await supabase
          .from('entries')
          .update({ notes: notesJson, updated_at: new Date().toISOString() })
          .eq('id', existing[0].id);
      } else {
        await supabase
          .from('entries')
          .insert({
            entry_date: CONFIG_DATE,
            shift: null,
            report_type: CONFIG_REPORT_TYPE,
            notes: notesJson
          });
      }
    }

    const nestedConfig = flatToNested(flatConfig);

    return NextResponse.json({
      success: true,
      data: {
        flat: flatConfig,
        nested: nestedConfig,
      }
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
