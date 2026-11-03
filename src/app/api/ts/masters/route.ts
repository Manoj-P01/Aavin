import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServiceClient } from '@/lib/supabase';
import { getAuthUserFromRequest } from '@/lib/auth';

export const DEFAULT_STG_MASTERS = [
  {
    key: 'wh_milk',
    label: 'TENTATIVE WHOLE MILK - RECEIPT AND DISPOSAL STATEMENT',
    name: 'TENTATIVE WHOLE MILK - RECEIPT AND DISPOSAL STATEMENT',
    variant: 'WHOLE MILK',
    product_variant: 'WHOLE MILK',
    sort_order: 1,
    is_active: true,
    default_rows: [
      { variant: 'P.VELUR CC', values: { variant: 'P.VELUR CC' } },
      { variant: "BMC's", values: { variant: "BMC's" } },
      { variant: 'LAB SAMPLE RTN', values: { variant: 'LAB SAMPLE RTN' } },
      { variant: 'WF', values: { variant: 'WF' } },
      { variant: 'SMP', values: { variant: 'SMP' } },
      { variant: 'RINSE MILK', values: { variant: 'RINSE MILK' } },
      { variant: 'BUTTER MILK', values: { variant: 'BUTTER MILK' } },
      { variant: 'DLT SACHET RTN', values: { variant: 'DLT SACHET RTN' } },
      { variant: 'FCM SACHET RTN', values: { variant: 'FCM SACHET RTN' } },
      { variant: 'STD SACHET RTN', values: { variant: 'STD SACHET RTN' } },
      { variant: 'SEPERATION', values: { variant: 'SEPERATION' } },
      { variant: 'DLT MILK', values: { variant: 'DLT MILK' } },
      { variant: 'FC.MILK', values: { variant: 'FC.MILK' } },
      { variant: 'STD.Milk', values: { variant: 'STD.Milk' } },
      { variant: 'TM MILK(CURD)', values: { variant: 'TM MILK(CURD)' } },
      { variant: 'CUP CURD', values: { variant: 'CUP CURD' } },
      { variant: 'KHOA', values: { variant: 'KHOA' } },
      { variant: 'LAB SAMPLE', values: { variant: 'LAB SAMPLE' } },
      { variant: 'TO METRO', values: { variant: 'TO METRO' } },
    ],
  },
  {
    key: 'skim_milk',
    label: 'SKIMMED MILK - RECEIPT AND DISPOSAL STATEMENT',
    name: 'SKIMMED MILK - RECEIPT AND DISPOSAL STATEMENT',
    variant: 'SKIM MILK',
    product_variant: 'SKIM MILK',
    sort_order: 2,
    is_active: true,
    default_rows: [
      { variant: 'SKIMMILK RECEIPT', values: { variant: 'SKIMMILK RECEIPT' } },
      { variant: 'SMP', values: { variant: 'SMP' } },
      { variant: 'WATER FLUSH', values: { variant: 'WATER FLUSH' } },
      { variant: 'BUTTER MILK', values: { variant: 'BUTTER MILK' } },
      { variant: 'TM DELITE 3.5/8.5', values: { variant: 'TM DELITE 3.5/8.5' } },
      { variant: 'TM MILK(CURD)', values: { variant: 'TM MILK(CURD)' } },
      { variant: 'AMBATTUR-SSM', values: { variant: 'AMBATTUR-SSM' } },
      { variant: 'SNR-SSM', values: { variant: 'SNR-SSM' } },
      { variant: 'DCPP-SSM', values: { variant: 'DCPP-SSM' } },
      { variant: 'ERODE -SSM', values: { variant: 'ERODE -SSM' } },
      { variant: 'CBE-SSM', values: { variant: 'CBE-SSM' } },
    ],
  },
  {
    key: 'cream',
    label: 'CREAM - RECEIPT AND DISPOSAL STATEMENT',
    name: 'CREAM - RECEIPT AND DISPOSAL STATEMENT',
    variant: 'CREAM',
    product_variant: 'CREAM',
    sort_order: 3,
    is_active: true,
    default_rows: [
      { variant: 'CREAM', values: { variant: 'CREAM' } },
      { variant: 'FCM', values: { variant: 'FCM' } },
      { variant: 'STD', values: { variant: 'STD' } },
      { variant: 'CHURNING', values: { variant: 'CHURNING' } },
    ],
  },
  {
    key: 'separation',
    label: 'SEPARATION - RECEIPT AND DISPOSAL STATEMENT',
    name: 'SEPARATION - RECEIPT AND DISPOSAL STATEMENT',
    variant: 'SEPARATION',
    product_variant: 'SEPARATION',
    sort_order: 4,
    is_active: true,
    default_rows: [
      { variant: 'WHOLE MILK', values: { variant: 'WHOLE MILK' } },
      { variant: 'SKIMMILK', values: { variant: 'SKIMMILK' } },
      { variant: 'CREAM', values: { variant: 'CREAM' } },
    ],
  },
  {
    key: 'delite',
    label: 'DELITE - RECEIPT AND DISPOSAL STATEMENT',
    name: 'DELITE - RECEIPT AND DISPOSAL STATEMENT',
    variant: 'DELITE',
    product_variant: 'DELITE',
    sort_order: 5,
    is_active: true,
    default_rows: [
      { variant: 'WHOLE MILK', values: { variant: 'WHOLE MILK' } },
      { variant: 'SKIMMED MILK', values: { variant: 'SKIMMED MILK' } },
      { variant: 'SMP', values: { variant: 'SMP' } },
      { variant: 'WATER', values: { variant: 'WATER' } },
      { variant: 'SACHET FILLING', values: { variant: 'SACHET FILLING' } },
    ],
  },
  {
    key: 'fcm',
    label: 'FCM - RECEIPT AND DISPOSAL STATEMENT',
    name: 'FCM - RECEIPT AND DISPOSAL STATEMENT',
    variant: 'FCM',
    product_variant: 'FCM',
    sort_order: 6,
    is_active: true,
    default_rows: [
      { variant: 'WHOLE MILK', values: { variant: 'WHOLE MILK' } },
      { variant: 'CREAM', values: { variant: 'CREAM' } },
      { variant: 'SMP', values: { variant: 'SMP' } },
      { variant: 'WATER', values: { variant: 'WATER' } },
      { variant: 'SACHET FILLING', values: { variant: 'SACHET FILLING' } },
    ],
  },
  {
    key: 'std',
    label: 'STD - RECEIPT AND DISPOSAL STATEMENT',
    name: 'STD - RECEIPT AND DISPOSAL STATEMENT',
    variant: 'STD',
    product_variant: 'STD',
    sort_order: 7,
    is_active: true,
    default_rows: [
      { variant: 'WHOLE MILK', values: { variant: 'WHOLE MILK' } },
      { variant: 'CREAM', values: { variant: 'CREAM' } },
      { variant: 'SMP', values: { variant: 'SMP' } },
      { variant: 'WATER', values: { variant: 'WATER' } },
      { variant: 'SACHET FILLING', values: { variant: 'SACHET FILLING' } },
    ],
  },
  {
    key: 'curd',
    label: 'CURD - RECEIPT AND DISPOSAL STATEMENT',
    name: 'CURD - RECEIPT AND DISPOSAL STATEMENT',
    variant: 'CURD',
    product_variant: 'CURD',
    sort_order: 8,
    is_active: true,
    default_rows: [
      { variant: 'WHOLE MILK', values: { variant: 'WHOLE MILK' } },
      { variant: 'SKIMMED MILK', values: { variant: 'SKIMMED MILK' } },
      { variant: 'SMP', values: { variant: 'SMP' } },
      { variant: 'SACHET FILLING', values: { variant: 'SACHET FILLING' } },
    ],
  },
  {
    key: 'smp_for_rsm',
    label: 'SMP FOR RSM - RECEIPT AND DISPOSAL STATEMENT',
    name: 'SMP FOR RSM - RECEIPT AND DISPOSAL STATEMENT',
    variant: 'SMP FOR RSM',
    product_variant: 'SMP FOR RSM',
    sort_order: 9,
    is_active: true,
    default_rows: [
      { variant: 'SMP FOR SNF BOOSTING', values: { variant: 'SMP FOR SNF BOOSTING' } },
      { variant: 'DLT MILK', values: { variant: 'DLT MILK' } },
      { variant: 'FC.MILK', values: { variant: 'FC.MILK' } },
      { variant: 'STD.Milk', values: { variant: 'STD.Milk' } },
      { variant: 'TM MILK(CURD)', values: { variant: 'TM MILK(CURD)' } },
      { variant: 'CUP CURD', values: { variant: 'CUP CURD' } },
    ],
  },
];

// GET /api/ts/masters - Fetch STG Statement Masters strictly from Supabase DB table prep_chart_configs
export async function GET(req: NextRequest) {
  try {
    const supabase = getSupabaseServiceClient();

    let masters: any[] = [];
    const { data: res, error } = await supabase
      .from('prep_chart_configs')
      .select('config_json')
      .eq('config_key', 'stg_masters')
      .maybeSingle();

    if (!error && res && Array.isArray(res.config_json) && res.config_json.length > 0) {
      masters = res.config_json;
    } else {
      masters = DEFAULT_STG_MASTERS;
    }

    return NextResponse.json({ success: true, masters });
  } catch (err: any) {
    console.error('GET /api/ts/masters error:', err);
    return NextResponse.json({ success: true, masters: DEFAULT_STG_MASTERS });
  }
}

// POST /api/ts/masters - Save STG Statement Masters strictly to Supabase DB table prep_chart_configs
export async function POST(req: NextRequest) {
  try {
    const authUser = await getAuthUserFromRequest(req);
    const actorUsername = authUser?.username || 'admin';
    const body = await req.json();

    const supabase = getSupabaseServiceClient();
    const mastersList = Array.isArray(body.masters) ? body.masters : (Array.isArray(body.statements) ? body.statements : body);

    if (!Array.isArray(mastersList)) {
      return NextResponse.json({ error: 'Invalid payload, expected array of statement masters' }, { status: 400 });
    }

    // 1. Save strictly into prep_chart_configs DB table with config_key = 'stg_masters'
    const { error: upsertErr } = await supabase.from('prep_chart_configs').upsert({
      config_key: 'stg_masters',
      config_json: mastersList,
      updated_by: actorUsername,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'config_key' });

    if (upsertErr) throw upsertErr;

    // 2. Also sync to entries table (report_type = 'TS') for backward compatibility
    try {
      await supabase.from('entries').insert({
        report_type: 'TS',
        notes: JSON.stringify(mastersList),
        created_by: actorUsername,
      });
    } catch {}

    return NextResponse.json({ success: true, masters: mastersList });
  } catch (err: any) {
    console.error('POST /api/ts/masters error:', err);
    return NextResponse.json({ error: err.message || 'Failed to save statement masters' }, { status: 500 });
  }
}

// DELETE /api/ts/masters?key=XXX - Delete a statement master from Supabase DB table
export async function DELETE(req: NextRequest) {
  try {
    const authUser = await getAuthUserFromRequest(req);
    const actorUsername = authUser?.username || 'admin';
    const { searchParams } = new URL(req.url);
    const key = searchParams.get('key');

    if (!key) return NextResponse.json({ error: 'Statement master key required' }, { status: 400 });

    const supabase = getSupabaseServiceClient();
    const { data: res } = await supabase
      .from('prep_chart_configs')
      .select('config_json')
      .eq('config_key', 'stg_masters')
      .maybeSingle();

    if (res && Array.isArray(res.config_json)) {
      const remaining = res.config_json.filter((m: any) => m.key !== key);
      await supabase.from('prep_chart_configs').upsert({
        config_key: 'stg_masters',
        config_json: remaining,
        updated_by: actorUsername,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'config_key' });

      return NextResponse.json({ success: true, masters: remaining });
    }

    return NextResponse.json({ success: true, message: 'Statement master deleted' });
  } catch (err: any) {
    console.error('DELETE /api/ts/masters error:', err);
    return NextResponse.json({ error: err.message || 'Failed to delete statement master' }, { status: 500 });
  }
}
