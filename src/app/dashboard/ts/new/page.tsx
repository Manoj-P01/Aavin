'use client';

import { Suspense, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

function RedirectToWizard() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const params = new URLSearchParams(searchParams ? searchParams.toString() : '');
    params.set('step', 'ts');
    router.replace(`/dashboard/stock/new?${params.toString()}`);
  }, [router, searchParams]);

  return (
    <div style={{ padding: 40, display: 'flex', alignItems: 'center', gap: 12 }}>
      <span className="spinner" /> Loading Total Solids (TS) Statement...
    </div>
  );
}

export default function NewTSPage() {
  return (
    <Suspense fallback={<div style={{ padding: 40 }}><span className="spinner" /> Loading Total Solids (TS) Statement...</div>}>
      <RedirectToWizard />
    </Suspense>
  );
}
