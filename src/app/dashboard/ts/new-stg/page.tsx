'use client';

import STGEntryForm from '@/components/forms/STGEntryForm';
import { Suspense, useState, useRef } from 'react';

export default function NewSTGPage() {
  const [formActions, setFormActions] = useState<{ handleSave: () => void; saving: boolean } | null>(null);
  const saveButtonRef = useRef<HTMLDivElement | null>(null);

  return (
    <div className="page-body animate-fade-in" style={{ padding: '0 20px 20px 20px' }}>
      <Suspense fallback={<div className="card" style={{ padding: 20 }}>Loading form...</div>}>
        <STGEntryForm
          onRegisterActions={setFormActions}
          saveButtonRef={saveButtonRef}
        />
      </Suspense>
    </div>
  );
}
