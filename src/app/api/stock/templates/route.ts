import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServiceClient } from '@/lib/supabase';
import { getAuthUserFromRequest } from '@/lib/auth';

export interface StockMasterDef {
  key: string;
  name: string;
  description?: string;
  is_default?: boolean;
  sort_order?: number;
}

export interface StockRowState {
  row_type: 'OB' | 'RECEIPT' | 'DISPOSAL';
  row_label: string;
  values: Record<string, string>;
}

export interface StockTemplateDef {
  rows: StockRowState[];
  product_columns?: Array<{
    key: string;
    label: string;
    category?: string;
    short_name?: string;
    full_name?: string;
  }>;
  description?: string;
  summary_formulas?: {
    total_receipts?: Record<string, string>;
    total_available?: Record<string, string>;
    total_disposals?: Record<string, string>;
    closing_balance?: Record<string, string>;
  };
}

// GET /api/stock/templates - Fetch Stock Statement Masters and Default Templates
export async function GET(req: NextRequest) {
  try {
    const supabase = getSupabaseServiceClient();

    // 1. Fetch Masters from prep_chart_configs
    let masters: StockMasterDef[] = [];
    try {
      const { data: mastersRes } = await supabase
        .from('prep_chart_configs')
        .select('config_json')
        .eq('config_key', 'stock_masters')
        .maybeSingle();

      if (mastersRes && Array.isArray(mastersRes.config_json) && mastersRes.config_json.length > 0) {
        masters = mastersRes.config_json;
      }
    } catch (e) {
      console.error('Error fetching stock_masters:', e);
    }

    if (masters.length === 0) {
      masters = [
        {
          key: 'daily_stock_statement',
          name: 'Standard Daily Stock Statement',
          description: 'Standard Daily Milk & Cream Stock Statement Entry Template',
          is_default: true,
          sort_order: 1,
        },
      ];
    }

    // 2. Fetch Templates from prep_chart_configs
    let templates: Record<string, StockTemplateDef> = {};
    try {
      const { data: tmplRes } = await supabase
        .from('prep_chart_configs')
        .select('config_json')
        .eq('config_key', 'stock_templates')
        .maybeSingle();

      if (tmplRes && tmplRes.config_json && typeof tmplRes.config_json === 'object') {
        templates = tmplRes.config_json;
      }
    } catch (e) {
      console.error('Error fetching stock_templates:', e);
    }

    // 3. Fetch default products & particulars to provide seamless initial template fallback
    let defaultProducts: any[] = [];
    let defaultReceiptRows: any[] = [];
    let defaultDisposalRows: any[] = [];

    try {
      const [prodRes, partRes] = await Promise.all([
        supabase.from('products_master').select('*').eq('is_active', true).order('sort_order', { ascending: true }),
        supabase.from('particulars_master').select('*').eq('is_active', true).order('sort_order', { ascending: true }),
      ]);

      if (prodRes.data && Array.isArray(prodRes.data)) {
        defaultProducts = prodRes.data.map(p => ({
          key: p.product_key,
          label: p.short_name || p.product_name,
          full_name: p.product_name,
          short_name: p.short_name,
          category: p.category || 'Liquid Milk',
        }));
      }

      if (partRes.data && Array.isArray(partRes.data)) {
        defaultReceiptRows = partRes.data
          .filter(r => (r.section_type || '').toUpperCase() === 'RECEIPT')
          .map(r => r.particular_name);
        defaultDisposalRows = partRes.data
          .filter(r => (r.section_type || '').toUpperCase() === 'DISPOSAL')
          .map(r => r.particular_name);
      }
    } catch (e) {
      console.error('Error fetching default products/particulars:', e);
    }

    return NextResponse.json({
      success: true,
      masters,
      templates,
      default_products: defaultProducts,
      default_receipt_rows: defaultReceiptRows,
      default_disposal_rows: defaultDisposalRows,
    });
  } catch (err: any) {
    console.error('GET /api/stock/templates error:', err);
    return NextResponse.json({ error: err.message || 'Failed to fetch stock templates' }, { status: 500 });
  }
}

// POST /api/stock/templates - Save Stock Statement Masters & Templates
export async function POST(req: NextRequest) {
  try {
    const authUser = await getAuthUserFromRequest(req);
    const actorUsername = authUser?.username || 'admin';
    const body = await req.json();
    const supabase = getSupabaseServiceClient();

    // 1. Save single master template
    if (body.template && body.template.master_key) {
      const { master_key, rows, product_columns, description, summary_formulas } = body.template;

      const { data: tmplRes } = await supabase
        .from('prep_chart_configs')
        .select('config_json')
        .eq('config_key', 'stock_templates')
        .maybeSingle();

      const existingTemplates = tmplRes?.config_json && typeof tmplRes.config_json === 'object' ? tmplRes.config_json : {};

      const updatedTemplates = {
        ...existingTemplates,
        [master_key]: {
          rows: rows || [],
          product_columns: product_columns || undefined,
          description: description || undefined,
          summary_formulas: summary_formulas || undefined,
        },
      };

      const { error: upsertErr } = await supabase.from('prep_chart_configs').upsert({
        config_key: 'stock_templates',
        config_json: updatedTemplates,
        updated_by: actorUsername,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'config_key' });

      if (upsertErr) throw upsertErr;

      return NextResponse.json({
        success: true,
        message: `Saved stock statement template for "${master_key}" successfully`,
        templates: updatedTemplates,
      });
    }

    // 2. Save masters list
    if (Array.isArray(body.masters)) {
      const { error: upsertErr } = await supabase.from('prep_chart_configs').upsert({
        config_key: 'stock_masters',
        config_json: body.masters,
        updated_by: actorUsername,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'config_key' });

      if (upsertErr) throw upsertErr;
    }

    // 3. Save all templates map
    if (body.templates && typeof body.templates === 'object') {
      const { error: upsertErr } = await supabase.from('prep_chart_configs').upsert({
        config_key: 'stock_templates',
        config_json: body.templates,
        updated_by: actorUsername,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'config_key' });

      if (upsertErr) throw upsertErr;
    }

    return NextResponse.json({ success: true, message: 'Stock templates saved successfully' });
  } catch (err: any) {
    console.error('POST /api/stock/templates error:', err);
    return NextResponse.json({ error: err.message || 'Failed to save stock templates' }, { status: 500 });
  }
}
