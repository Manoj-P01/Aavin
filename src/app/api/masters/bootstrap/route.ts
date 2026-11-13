import { NextRequest, NextResponse } from 'next/server';
import { getProducts, getDairies, getCategories, getAppSettings } from '@/lib/masters';

export async function GET(req: NextRequest) {
  try {
    const [products, dairies, categories, settings] = await Promise.all([
      getProducts(),
      getDairies(),
      getCategories(),
      getAppSettings(),
    ]);

    return NextResponse.json({
      products,
      dairies,
      categories,
      settings,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to fetch masters bootstrap';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

