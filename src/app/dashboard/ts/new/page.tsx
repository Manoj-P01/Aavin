import TSEntryForm from '@/components/forms/TSEntryForm';
import { Suspense } from 'react';

export const metadata = { title: 'Total Solids (TS) Statement | Aavin Dashboard' };

export default function NewTSPage() {
  return (
    <div className="page-body animate-fade-in" style={{ padding: '0 20px 20px 20px' }}>
      <Suspense fallback={<div className="card" style={{ padding: 20 }}>Loading form...</div>}>
        <TSEntryForm />
      </Suspense>
    </div>
  );
}
