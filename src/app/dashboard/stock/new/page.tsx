import { Suspense } from 'react';
import DailyEntryWizard from '@/components/forms/DailyEntryWizard';

export const metadata = { title: 'Daily Entry Wizard | Aavin Dashboard' };

export default function NewStockPage() {
  return (
    <div className="page-body animate-fade-in" style={{ padding: 20 }}>
      <Suspense fallback={<div style={{ padding: 40 }}><span className="spinner" /> Loading Daily Entry Wizard...</div>}>
        <DailyEntryWizard />
      </Suspense>
    </div>
  );
}
