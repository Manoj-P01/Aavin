import Header from '@/components/layout/Header';
import Link from 'next/link';
import TSEntryForm from '@/components/forms/TSEntryForm';

export const metadata = { title: 'New TS Entry | Aavin Dashboard' };

export default function NewTSPage() {
  return (
    <>
      <Header
        title="New Total Solids Entry"
        subtitle="Enter daily TS and STG report data"
        actions={
          <Link href="/dashboard/ts" className="btn btn-secondary btn-sm">← Back to TS List</Link>
        }
      />
      <div className="page-body animate-fade-in">
        <TSEntryForm />
      </div>
    </>
  );
}
