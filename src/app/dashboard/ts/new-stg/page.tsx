'use client';

import Header from '@/components/layout/Header';
import STGEntryForm from '@/components/forms/STGEntryForm';
import Link from 'next/link';
import { Suspense, useState, useRef, useEffect } from 'react';

export default function NewSTGPage() {
  const [formActions, setFormActions] = useState<{ handleSave: () => void; saving: boolean } | null>(null);
  const saveButtonRef = useRef<HTMLDivElement | null>(null);
  const [isSaveButtonVisible, setIsSaveButtonVisible] = useState(true);

  useEffect(() => {
    const target = saveButtonRef.current;
    if (!target) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsSaveButtonVisible(entry.isIntersecting);
      },
      { threshold: 0.1 }
    );

    observer.observe(target);
    return () => {
      observer.unobserve(target);
    };
  }, [formActions]);

  return (
    <>
      <Header
        title="New Solid Balance (STG) Entry"
        subtitle="Enter manual receipts/disposals to auto-compile TS and Stock reports"
        actions={
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {!isSaveButtonVisible && formActions && (
              <button
                type="button"
                className="btn btn-primary btn-sm animate-fade-in"
                onClick={formActions.handleSave}
                disabled={formActions.saving}
                title="Save & Compile STG Statement"
                style={{ padding: '6px 12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                {formActions.saving ? '⏳' : '💾'}
              </button>
            )}
            <Link href="/dashboard/ts" className="btn btn-ghost btn-sm">
              ← Back to Register
            </Link>
          </div>
        }
      />
      <div className="page-body animate-fade-in">
        <Suspense fallback={<div className="card" style={{ padding: 20 }}>Loading form...</div>}>
          <STGEntryForm
            onRegisterActions={setFormActions}
            saveButtonRef={saveButtonRef}
          />
        </Suspense>
      </div>
    </>
  );
}
