import Header from '@/components/layout/Header';
import Link from 'next/link';
import StockEntryForm from '@/components/forms/StockEntryForm';

export const metadata = { title: 'New Stock Entry | Aavin Dashboard' };

export default function NewStockPage() {
  return (
    <>
      <Header
        title="New Stock Statement Entry"
        subtitle="Enter daily milk & cream stock data (Day or Night shift)"
        actions={
          <Link href="/dashboard/stock" className="btn btn-secondary btn-sm">← Back to Stock List</Link>
        }
      />
      <div className="page-body animate-fade-in">
        <StockEntryForm />
      </div>
    </>
  );
}
