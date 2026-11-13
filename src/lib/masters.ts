import { unstable_cache, revalidateTag } from 'next/cache';
import { getSupabaseServiceClient } from '@/lib/supabase';
import { CALC_CONFIG } from '@/lib/config';

export function invalidateMasterTag(tag: string) {
  try {
    (revalidateTag as any)(tag, 'default');
  } catch {}
}

export interface ProductMasterItem {
  id: string;
  product_key: string;
  product_name: string;
  short_name: string;
  category: string;
  is_default?: boolean;
  sort_order: number;
  is_active: boolean;
}

export interface DairyDestinationItem {
  id: string;
  code: string;
  destination_name: string;
  display_order: number;
  is_active: boolean;
}

export interface ProductCategoryItem {
  id: string;
  category_name: string;
  sort_order?: number;
  display_order?: number;
  is_active: boolean;
}

export interface AppSettingItem {
  key: string;
  value: any;
  effective_from?: string;
}

// ── Server-side cached masters ──────────────────────────────────────────────────

export const getProducts = unstable_cache(
  async (): Promise<ProductMasterItem[]> => {
    try {
      const supabase = getSupabaseServiceClient();
      const { data, error } = await supabase
        .from('products_master')
        .select('id, product_key, product_name, short_name, category, is_default, sort_order, is_active')
        .eq('is_active', true)
        .order('sort_order', { ascending: true });

      if (error || !data) return [];
      return data;
    } catch (e) {
      console.warn('getProducts cached error:', e);
      return [];
    }
  },
  ['masters-products-cache'],
  { tags: ['masters-products'], revalidate: 3600 }
);

export const getDairies = unstable_cache(
  async (): Promise<DairyDestinationItem[]> => {
    try {
      const supabase = getSupabaseServiceClient();
      const { data, error } = await supabase
        .from('dairy_destinations_master')
        .select('id, code, destination_name, display_order, is_active')
        .eq('is_active', true)
        .order('display_order', { ascending: true });

      if (error || !data) return [];
      return data;
    } catch (e) {
      console.warn('getDairies cached error:', e);
      return [];
    }
  },
  ['masters-dairies-cache'],
  { tags: ['masters-dairies'], revalidate: 3600 }
);

export const getCategories = unstable_cache(
  async (): Promise<ProductCategoryItem[]> => {
    try {
      const supabase = getSupabaseServiceClient();
      const { data, error } = await supabase
        .from('product_categories_master')
        .select('id, category_name, sort_order, is_active')
        .eq('is_active', true)
        .order('sort_order', { ascending: true });

      if (error || !data) return [];
      return data;
    } catch (e) {
      console.warn('getCategories cached error:', e);
      return [];
    }
  },
  ['masters-categories-cache'],
  { tags: ['masters-categories'], revalidate: 3600 }
);

export const getAppSettings = unstable_cache(
  async (): Promise<Record<string, any>> => {
    try {
      const supabase = getSupabaseServiceClient();
      const { data, error } = await supabase
        .from('app_settings')
        .select('key, value');

      if (error || !data) return {};
      const settingsMap: Record<string, any> = {};
      data.forEach(item => {
        settingsMap[item.key] = item.value;
      });
      return settingsMap;
    } catch (e) {
      console.warn('getAppSettings cached error:', e);
      return {};
    }
  },
  ['masters-settings-cache'],
  { tags: ['masters-settings'], revalidate: 3600 }
);

export async function getCalcConfig(date?: string): Promise<typeof CALC_CONFIG> {
  try {
    const settings = await getAppSettings();
    if (settings && settings.calc_config) {
      return {
        ...CALC_CONFIG,
        ...settings.calc_config,
      };
    }
  } catch {}
  return CALC_CONFIG;
}

