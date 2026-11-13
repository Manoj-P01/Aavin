import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServiceClient } from '@/lib/supabase';
import { getAuthUserFromRequest } from '@/lib/auth';
import { invalidateSettingsTag } from '@/lib/settings';

const ALLOWED_SETTING_KEYS = new Set([
  'shift_config',
  'stg_calc_config',
  'calc_config',
]);

// GET /api/settings?keys=shift_config,stg_calc_config
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const keysParam = searchParams.get('keys');
    const keys = keysParam ? keysParam.split(',').map(k => k.trim()).filter(Boolean) : [];

    const supabase = getSupabaseServiceClient();
    let query = supabase.from('app_settings').select('key, value');

    if (keys.length > 0) {
      query = query.in('key', keys);
    }

    const { data, error } = await query;
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const result: Record<string, any> = {};
    (data || []).forEach((row: { key: string; value: any }) => {
      result[row.key] = row.value;
    });

    return NextResponse.json({ data: result });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to fetch settings';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// PUT /api/settings – upsert setting row
export async function PUT(req: NextRequest) {
  try {
    const authUser = await getAuthUserFromRequest(req);
    const actorUsername = req.headers.get('x-user-name') || authUser?.username || 'admin';

    const body = await req.json();
    const { key, value } = body as { key?: string; value?: any };

    if (!key || typeof key !== 'string') {
      return NextResponse.json({ error: 'Missing or invalid setting key' }, { status: 400 });
    }

    if (!ALLOWED_SETTING_KEYS.has(key)) {
      return NextResponse.json({ error: `Setting key '${key}' is not allowed` }, { status: 403 });
    }

    if (value === undefined) {
      return NextResponse.json({ error: 'Missing setting value' }, { status: 400 });
    }

    const supabase = getSupabaseServiceClient();
    const { data, error } = await supabase
      .from('app_settings')
      .upsert({
        key,
        value,
        updated_by: actorUsername,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'key' })
      .select('key, value, updated_at')
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    invalidateSettingsTag();

    return NextResponse.json({ success: true, data });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to update setting';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

