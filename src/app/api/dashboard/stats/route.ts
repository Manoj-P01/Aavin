import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServiceClient } from '@/lib/supabase';
import type { Entry } from '@/lib/types';

export async function GET(req: NextRequest) {
  try {
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];
    const monthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const monthStart = `${monthStr}-01`;
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0)
      .toISOString().split('T')[0];

    const supabase = getSupabaseServiceClient();

    const [allTs, allStock, monthTs, monthStock, recentAll, pendingRes, monthlyTotalsRes] = await Promise.all([
      supabase.from('entries').select('id', { count: 'exact', head: true }).eq('report_type', 'TS'),
      supabase.from('entries').select('id', { count: 'exact', head: true }).eq('report_type', 'STOCK'),
      supabase.from('entries').select('id', { count: 'exact', head: true }).eq('report_type', 'TS').gte('entry_date', monthStart).lte('entry_date', monthEnd),
      supabase.from('entries').select('id', { count: 'exact', head: true }).eq('report_type', 'STOCK').gte('entry_date', monthStart).lte('entry_date', monthEnd),
      supabase.from('entries').select('id, report_type, entry_date, shift, status, notes, created_at, updated_at').order('created_at', { ascending: false }).limit(8),
      supabase.from('entries').select('id, report_type, entry_date, shift, status, notes, created_at, updated_at').neq('status', 'FINAL').order('entry_date', { ascending: false }).limit(6),
      supabase.from('monthly_totals').select('month_key, report_type, entry_count').order('month_key', { ascending: true }),
    ]);

    const recent = ((recentAll.data || []) as unknown) as Entry[];
    const pending = ((pendingRes.data || []) as unknown) as Entry[];
    const latestTs = recent.find(e => e.report_type === 'TS') || null;
    const latestStock = recent.find(e => e.report_type === 'STOCK') || null;

    // Monthly totals formatting
    let tsTrend: { month: string; count: number }[] = [];
    let stockTrend: { month: string; count: number }[] = [];

    if (monthlyTotalsRes.data && monthlyTotalsRes.data.length > 0) {
      monthlyTotalsRes.data.forEach((row: { month_key: string; report_type: string; entry_count: number }) => {
        const point = { month: row.month_key.replace('-', '/'), count: row.entry_count };
        if (row.report_type === 'TS') tsTrend.push(point);
        else if (row.report_type === 'STOCK') stockTrend.push(point);
      });
    }

    return NextResponse.json({
      data: {
        tsCount: allTs.count || 0,
        stockCount: allStock.count || 0,
        thisMonthTs: monthTs.count || 0,
        thisMonthStock: monthStock.count || 0,
        latestTs,
        latestStock,
        recentEntries: recent,
        pendingEntries: pending,
        monthlyTrend: {
          ts: tsTrend.slice(-12),
          stock: stockTrend.slice(-12),
        },
      }
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
