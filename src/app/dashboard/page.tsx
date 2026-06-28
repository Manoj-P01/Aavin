import { Suspense } from 'react';
import Header from '@/components/layout/Header';
import Link from 'next/link';
import DashboardClient from './DashboardClient';

export const metadata = {
  title: 'Dashboard | Aavin NKL Dairy',
};

export default function DashboardPage() {
  return (
    <>
      <Header
        title="Dashboard"
        subtitle="Namakkal District Co-operative Milk Producers' Union Ltd"
        actions={
          <div style={{ display: 'flex', gap: 8 }}>
            <Link href="/dashboard/ts/new" className="btn btn-primary btn-sm">
              ➕ New TS Entry
            </Link>
            <Link href="/dashboard/stock/new" className="btn btn-secondary btn-sm">
              ➕ New Stock Entry
            </Link>
          </div>
        }
      />
      <div className="page-body animate-fade-in">
        <Suspense fallback={<div className="spinner" />}>
          <DashboardClient />
        </Suspense>
      </div>
    </>
  );
}
