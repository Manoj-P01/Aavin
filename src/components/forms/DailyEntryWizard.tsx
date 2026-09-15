'use client';

import React, { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import StockEntryForm from '@/components/forms/StockEntryForm';
import STGEntryForm from '@/components/forms/STGEntryForm';
import TSEntryForm from '@/components/forms/TSEntryForm';
import type { Shift } from '@/lib/types';

export default function DailyEntryWizard() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const paramDate = searchParams.get('date');
  const paramShift = searchParams.get('shift');

  const [activeStep, setActiveStep] = useState<'stock' | 'stg' | 'ts'>('stock');
  const [entryDate, setEntryDate] = useState<string>(
    paramDate || new Date().toISOString().split('T')[0]
  );
  const [shift, setShift] = useState<Shift | null>(
    paramShift === 'N' || paramShift === 'D' || paramShift === 'F' ? (paramShift as Shift) : 'F'
  );

  const handleStepChange = (key: string) => {
    if (key === 'stock' || key === 'stg' || key === 'ts') {
      setActiveStep(key);
    }
  };

  return (
    <div className="wizard-content animate-fade-in" key={activeStep}>
      {activeStep === 'stock' && (
        <StockEntryForm
          stepMode={true}
          activeStep={activeStep}
          onStepChange={handleStepChange}
          onNextStep={() => setActiveStep('stg')}
          initialDate={entryDate}
          initialShift={shift || 'F'}
        />
      )}

      {activeStep === 'stg' && (
        <STGEntryForm
          stepMode={true}
          activeStep={activeStep}
          onStepChange={handleStepChange}
          onNextStep={() => setActiveStep('ts')}
          onPrevStep={() => setActiveStep('stock')}
          initialDate={entryDate}
          initialShift={shift}
        />
      )}

      {activeStep === 'ts' && (
        <TSEntryForm
          stepMode={true}
          activeStep={activeStep}
          onStepChange={handleStepChange}
          onPrevStep={() => setActiveStep('stg')}
          onFinish={() => {
            router.push(`/dashboard/stock/${entryDate}/${shift || 'D'}`);
          }}
          initialDate={entryDate}
          initialShift={shift}
        />
      )}
    </div>
  );
}
