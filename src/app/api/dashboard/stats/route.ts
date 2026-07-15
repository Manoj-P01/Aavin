import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServiceClient } from '@/lib/supabase';
import { isLocalDbEnabled, getLocalEntries } from '@/lib/fileDb';
import type { Entry } from '@/lib/types';

export async function GET(req: NextRequest) {
  try {
    const now = new Date();
    const monthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const monthStart = `${monthStr}-01`;
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0)
      .toISOString().split('T')[0];

    if (isLocalDbEnabled()) {
      const allEntries = getLocalEntries();
      const tsEntries = allEntries.filter(e => e.report_type === 'TS');
      const stockEntries = allEntries.filter(e => e.report_type === 'STOCK');

      const thisMonthTs = tsEntries.filter(e => e.entry_date >= monthStart && e.entry_date <= monthEnd);
      const thisMonthStock = stockEntries.filter(e => e.entry_date >= monthStart && e.entry_date <= monthEnd);

      const latestTs = tsEntries[0] || null;
      const latestStock = stockEntries[0] || null;

      return NextResponse.json({
        data: {
          tsCount: tsEntries.length,
          stockCount: stockEntries.length,
          thisMonthTs: thisMonthTs.length,
          thisMonthStock: thisMonthStock.length,
          latestTs,
          latestStock,
          recentEntries: allEntries.slice(0, 8),
        }
      });
    }

    // Supabase path
    const supabase = getSupabaseServiceClient();

    const [allTs, allStock, monthTs, monthStock, recentAll] = await Promise.all([
      supabase.from('entries').select('id', { count: 'exact', head: true }).eq('report_type', 'TS'),
      supabase.from('entries').select('id', { count: 'exact', head: true }).eq('report_type', 'STOCK'),
      supabase.from('entries').select('id', { count: 'exact', head: true }).eq('report_type', 'TS').gte('entry_date', monthStart).lte('entry_date', monthEnd),
      supabase.from('entries').select('id', { count: 'exact', head: true }).eq('report_type', 'STOCK').gte('entry_date', monthStart).lte('entry_date', monthEnd),
      supabase.from('entries').select('*').order('created_at', { ascending: false }).limit(8),
    ]);

    const recent = (recentAll.data || []) as Entry[];
    const latestTs = recent.find(e => e.report_type === 'TS') || null;
    const latestStock = recent.find(e => e.report_type === 'STOCK') || null;

    return NextResponse.json({
      data: {
        tsCount: allTs.count || 0,
        stockCount: allStock.count || 0,
        thisMonthTs: monthTs.count || 0,
        thisMonthStock: monthStock.count || 0,
        latestTs,
        latestStock,
        recentEntries: recent,
      }
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
