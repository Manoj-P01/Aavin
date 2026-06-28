'use client';

import { Suspense, useState } from 'react';
import Header from '@/components/layout/Header';
import Link from 'next/link';
import DashboardClient from './DashboardClient';
import ImportExcelModal from '@/components/ImportExcelModal';

export default function DashboardPage() {
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const handleImportSuccess = (count: number) => {
    alert(`Successfully imported ${count} entries!`);
    setRefreshKey(prev => prev + 1); // Refresh data
  };

  return (
    <>
      <Header
        title="Dashboard"
        subtitle="Namakkal District Co-operative Milk Producers' Union Ltd"
        actions={
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => setIsImportOpen(true)}
            >
              📥 Import Excel
            </button>
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
          <DashboardClient key={refreshKey} />
        </Suspense>
      </div>

      <ImportExcelModal
        isOpen={isImportOpen}
        onClose={() => setIsImportOpen(false)}
        onSuccess={handleImportSuccess}
      />
    </>
  );
}
