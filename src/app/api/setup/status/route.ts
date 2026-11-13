import { NextResponse } from 'next/server';
import { getSupabaseServiceClient } from '@/lib/supabase';

export interface SetupStepStatus {
  id: string;
  order: number;
  title: string;
  description: string;
  tableName: string;
  link: string;
  linkText: string;
  count: number;
  isConfigured: boolean;
  required: boolean;
}

export async function GET() {
  try {
    const supabase = getSupabaseServiceClient();

    // Query counts in parallel
    const [
      settingsRes,
      sectionsRes,
      fieldsRes,
      productsRes,
      aliasesRes,
      statementsRes,
      particularsRes,
      columnsRes,
      stgMappingsRes,
      tsMappingsRes,
    ] = await Promise.all([
      supabase.from('app_settings').select('*', { count: 'exact', head: true }),
      supabase.from('stg_section_master').select('*', { count: 'exact', head: true }).eq('is_active', true),
      supabase.from('stg_field_master').select('*', { count: 'exact', head: true }).eq('is_active', true),
      supabase.from('products_master').select('*', { count: 'exact', head: true }).eq('is_active', true),
      supabase.from('product_aliases').select('*', { count: 'exact', head: true }).eq('is_active', true),
      supabase.from('stg_masters').select('*', { count: 'exact', head: true }).eq('is_active', true),
      supabase.from('stg_particular_master').select('*', { count: 'exact', head: true }).eq('is_active', true),
      supabase.from('stg_statement_column_configs').select('*', { count: 'exact', head: true }),
      supabase.from('statement_mapping_rules').select('*', { count: 'exact', head: true }).eq('enabled', true),
      supabase.from('stg_to_ts_mapping_rules').select('*', { count: 'exact', head: true }).eq('enabled', true),
    ]);

    const settingsCount = settingsRes.count ?? 0;
    const sectionsCount = sectionsRes.count ?? 0;
    const fieldsCount = fieldsRes.count ?? 0;
    const productsCount = (productsRes.count ?? 0) + (aliasesRes.count ?? 0);
    const statementsCount = statementsRes.count ?? 0;
    const particularsCount = particularsRes.count ?? 0;
    const columnsCount = columnsRes.count ?? 0;
    const mappingsCount = (stgMappingsRes.count ?? 0) + (tsMappingsRes.count ?? 0);

    const steps: SetupStepStatus[] = [
      {
        id: 'settings',
        order: 1,
        title: 'Application Settings',
        description: 'Configure shift modes, STG calculation rules, and laboratory density factors.',
        tableName: 'app_settings',
        link: '/dashboard/ts/config',
        linkText: 'Configure Settings',
        count: settingsCount,
        isConfigured: settingsCount > 0,
        required: true,
      },
      {
        id: 'sections',
        order: 2,
        title: 'STG Section Master',
        description: 'Define report sections (e.g., Opening Balance, Receipts, Disposals, Stock Balance).',
        tableName: 'stg_section_master',
        link: '/dashboard/ts/sections',
        linkText: 'Configure Sections',
        count: sectionsCount,
        isConfigured: sectionsCount > 0,
        required: true,
      },
      {
        id: 'fields',
        order: 3,
        title: 'STG Field Master',
        description: 'Define metrics, formulas, data types, and canonical row identifiers.',
        tableName: 'stg_field_master',
        link: '/dashboard/ts/fields',
        linkText: 'Configure Fields',
        count: fieldsCount,
        isConfigured: fieldsCount > 0,
        required: true,
      },
      {
        id: 'products',
        order: 4,
        title: 'Products & Aliases Master',
        description: 'Register plant milk products, categories, and alias variants.',
        tableName: 'products_master, product_aliases',
        link: '/dashboard/master/products',
        linkText: 'Configure Products',
        count: productsCount,
        isConfigured: productsCount > 0,
        required: true,
      },
      {
        id: 'statements',
        order: 5,
        title: 'Statement Master Names',
        description: 'Create receipt & disposal statement masters for each product block.',
        tableName: 'stg_masters',
        link: '/dashboard/ts/statement-master-names',
        linkText: 'Configure Statements',
        count: statementsCount,
        isConfigured: statementsCount > 0,
        required: true,
      },
      {
        id: 'particulars',
        order: 6,
        title: 'Particulars Master',
        description: 'Define particulars, suppliers, chilling centers, and distribution points per section.',
        tableName: 'stg_particular_master',
        link: '/dashboard/master/particulars',
        linkText: 'Configure Particulars',
        count: particularsCount,
        isConfigured: particularsCount > 0,
        required: true,
      },
      {
        id: 'columns',
        order: 7,
        title: 'STG Statement Column Configuration',
        description: 'Configure and arrange display columns for each statement section.',
        tableName: 'stg_statement_column_configs',
        link: '/dashboard/ts/column-config',
        linkText: 'Configure Columns',
        count: columnsCount,
        isConfigured: columnsCount > 0,
        required: true,
      },
      {
        id: 'mappings',
        order: 8,
        title: 'Formula & Sync Mappings',
        description: 'Establish automated sync rules between Stock, Preparation Charts, STG, and TS.',
        tableName: 'statement_mapping_rules, stg_to_ts_mapping_rules',
        link: '/dashboard/ts/mappings',
        linkText: 'Configure Mappings',
        count: mappingsCount,
        isConfigured: mappingsCount > 0,
        required: true,
      },
    ];

    const completedCount = steps.filter(s => s.isConfigured).length;
    const totalCount = steps.length;
    const isReady = completedCount === totalCount;

    return NextResponse.json({
      success: true,
      isReady,
      completedCount,
      totalCount,
      percentage: Math.round((completedCount / totalCount) * 100),
      steps,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to query setup status';
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

