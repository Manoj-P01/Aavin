'use client';

import React, { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import StockEntryForm from '@/components/forms/StockEntryForm';
import STGEntryForm from '@/components/forms/STGEntryForm';
import TSEntryForm from '@/components/forms/TSEntryForm';
import PreparationChartsDashboardPage from '@/app/dashboard/stock/preparation-charts/page';
import type { Shift } from '@/lib/types';

export default function DailyEntryWizard() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const paramDate = searchParams.get('date');
  const paramShift = searchParams.get('shift');
  const paramStep = searchParams.get('step');

  const [activeStep, setActiveStep] = useState<'prep' | 'stock' | 'stg' | 'ts'>(
    paramStep === 'prep' ? 'prep' : 'stock'
  );
  const [entryDate, setEntryDate] = useState<string>(
    paramDate || new Date().toISOString().split('T')[0]
  );
  const [shift, setShift] = useState<Shift | null>(
    paramShift === 'N' || paramShift === 'D' || paramShift === 'F' ? (paramShift as Shift) : 'F'
  );

  const handleStepChange = (key: string) => {
    if (key === 'prep' || key === 'stock' || key === 'stg' || key === 'ts') {
      setActiveStep(key as 'prep' | 'stock' | 'stg' | 'ts');
    } else if (key === 'reports') {
      router.push(`/dashboard/ts/${entryDate}?shift=${shift || 'F'}`);
    }
  };

  return (
    <div className="wizard-content animate-fade-in">
      {activeStep === 'prep' && (
        <PreparationChartsDashboardPage
          stepMode={true}
          activeStep={activeStep}
          onStepChange={handleStepChange}
          onNextStep={() => setActiveStep('stock')}
          initialDate={entryDate}
          initialShift={shift || 'F'}
        />
      )}

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
            router.push(`/dashboard/ts/${entryDate}?shift=${shift || 'F'}`);
          }}
          initialDate={entryDate}
          initialShift={shift}
        />
      )}
    </div>
  );
}
