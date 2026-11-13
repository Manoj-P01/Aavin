// ─────────────────────────────────────────────────────────────────────────────
// POST /api/keys/rename
// Transactional cascading key rename API using Postgres RPC fn_rename_key
// Supports dry_run mode to inspect affected row counts prior to mutating data.
// ─────────────────────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServiceClient } from '@/lib/supabase';
import { getAuthUserFromRequest } from '@/lib/auth';
import { invalidateMasterTag } from '@/lib/masters';
import { invalidateSettingsTag } from '@/lib/settings';

const VALID_SCOPES = new Set([
  'product',
  'prep_chart',
  'prep_chart_column',
  'statement',
  'stg_column',
  'ts_column',
  'rule',
  'dairy',
]);

export async function POST(req: NextRequest) {
  try {
    const authUser = await getAuthUserFromRequest(req);
    const userRole = req.headers.get('x-user-role') || authUser?.role || 'admin';

    if (userRole !== 'admin' && userRole !== 'editor') {
      return NextResponse.json(
        { error: 'Unauthorized: admin or editor role required to rename keys' },
        { status: 403 }
      );
    }

    const body = await req.json();
    const { scope, old_key, new_key, context = {}, dry_run = false } = body as {
      scope?: string;
      old_key?: string;
      new_key?: string;
      context?: Record<string, any>;
      dry_run?: boolean;
    };

    if (!scope || !VALID_SCOPES.has(scope)) {
      return NextResponse.json(
        { error: `Invalid scope '${scope}'. Valid scopes: ${Array.from(VALID_SCOPES).join(', ')}` },
        { status: 400 }
      );
    }

    if (!old_key || typeof old_key !== 'string' || !old_key.trim()) {
      return NextResponse.json({ error: 'old_key is required' }, { status: 400 });
    }

    if (!new_key || typeof new_key !== 'string' || !new_key.trim()) {
      return NextResponse.json({ error: 'new_key is required' }, { status: 400 });
    }

    const trimmedOld = old_key.trim();
    const trimmedNew = new_key.trim();

    if (trimmedOld === trimmedNew) {
      return NextResponse.json({ error: 'Old key and new key cannot be identical' }, { status: 400 });
    }

    const supabase = getSupabaseServiceClient();
    const { data: counts, error } = await supabase.rpc('fn_rename_key', {
      p_scope: scope,
      p_old: trimmedOld,
      p_new: trimmedNew,
      p_context: context,
      p_dry_run: !!dry_run,
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    if (!dry_run) {
      invalidateMasterTag('masters-products');
      invalidateMasterTag('masters-dairies');
      invalidateMasterTag('masters-categories');
      invalidateSettingsTag();
    }

    return NextResponse.json({
      success: true,
      counts: counts || {},
      dry_run: !!dry_run,
      message: dry_run
        ? `Dry run: renaming '${trimmedOld}' to '${trimmedNew}' in scope '${scope}'`
        : `Successfully renamed '${trimmedOld}' to '${trimmedNew}' in scope '${scope}'`,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to rename key';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

