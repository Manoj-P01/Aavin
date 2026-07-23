import { Suspense } from 'react';
import StockEntryForm from '@/components/forms/StockEntryForm';

export const metadata = { title: 'New Stock Statement Entry | Aavin Dashboard' };

export default function NewStockPage() {
  return (
    <div className="page-body animate-fade-in" style={{ padding: 20 }}>
      <Suspense fallback={<div style={{ padding: 40 }}><span className="spinner" /> Loading form...</div>}>
        <StockEntryForm />
      </Suspense>
    </div>
  );
}
