'use client';

import useSWR from 'swr';
import type { ProductMasterItem, DairyDestinationItem, ProductCategoryItem } from '@/lib/masters';

const fetcher = (url: string) => fetch(url).then(r => {
  if (!r.ok) throw new Error('Failed to load masters');
  return r.json();
});

export interface MastersBootstrapData {
  products: ProductMasterItem[];
  dairies: DairyDestinationItem[];
  categories: ProductCategoryItem[];
  settings: Record<string, any>;
}

export function useMasters() {
  const { data, error, isLoading, mutate } = useSWR<MastersBootstrapData>(
    '/api/masters/bootstrap',
    fetcher,
    {
      revalidateOnFocus: false,
      revalidateIfStale: false,
      dedupingInterval: 60000, // 1 minute client cache
    }
  );

  return {
    products: data?.products || [],
    dairies: data?.dairies || [],
    categories: data?.categories || [],
    settings: data?.settings || {},
    isLoading,
    error,
    refresh: mutate,
  };
}

