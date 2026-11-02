'use client';

import React, { useState, useEffect } from 'react';
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
    paramStep === 'stock' || paramStep === 'stg' || paramStep === 'ts' || paramStep === 'prep'
      ? (paramStep as 'prep' | 'stock' | 'stg' | 'ts')
      : 'prep'
  );
  const [entryDate, setEntryDate] = useState<string>(
    paramDate || new Date().toISOString().split('T')[0]
  );
  const [shift, setShift] = useState<Shift | null>(
    paramShift === 'N' || paramShift === 'D' || paramShift === 'F' ? (paramShift as Shift) : 'F'
  );

  // Sync date, shift, or step if URL query params change
  useEffect(() => {
    if (paramDate && paramDate !== entryDate) {
      setEntryDate(paramDate);
    }
  }, [paramDate]);

  useEffect(() => {
    if (paramShift && (paramShift === 'D' || paramShift === 'N' || paramShift === 'F') && paramShift !== shift) {
      setShift(paramShift as Shift);
    }
  }, [paramShift]);

  useEffect(() => {
    if (paramStep && (paramStep === 'prep' || paramStep === 'stock' || paramStep === 'stg' || paramStep === 'ts') && paramStep !== activeStep) {
      setActiveStep(paramStep as any);
    }
  }, [paramStep]);

  // Keep browser URL updated with selected date, shift & step
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      let changed = false;
      if (entryDate && params.get('date') !== entryDate) {
        params.set('date', entryDate);
        changed = true;
      }
      if (shift && params.get('shift') !== shift) {
        params.set('shift', shift);
        changed = true;
      }
      if (activeStep && params.get('step') !== activeStep) {
        params.set('step', activeStep);
        changed = true;
      }
      if (changed) {
        window.history.replaceState(null, '', `?${params.toString()}`);
      }
    }
  }, [entryDate, shift, activeStep]);

  const handleDateShiftChange = (newDate: string, newShift?: Shift | string | null) => {
    if (newDate) setEntryDate(newDate);
    if (newShift && (newShift === 'D' || newShift === 'N' || newShift === 'F')) {
      setShift(newShift as Shift);
    }
  };

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
          onNextStep={(nextDate?: string, nextShift?: any) => {
            if (nextDate) handleDateShiftChange(nextDate, nextShift);
            setActiveStep('stock');
          }}
          onDateShiftChange={handleDateShiftChange}
          initialDate={entryDate}
          initialShift={shift || 'F'}
        />
      )}

      {activeStep === 'stock' && (
        <StockEntryForm
          stepMode={true}
          activeStep={activeStep}
          onStepChange={handleStepChange}
          onNextStep={(nextDate?: string, nextShift?: any) => {
            if (nextDate) handleDateShiftChange(nextDate, nextShift);
            setActiveStep('stg');
          }}
          onPrevStep={(nextDate?: string, nextShift?: any) => {
            if (nextDate) handleDateShiftChange(nextDate, nextShift);
            setActiveStep('prep');
          }}
          onDateShiftChange={handleDateShiftChange}
          initialDate={entryDate}
          initialShift={shift || 'F'}
        />
      )}

      {activeStep === 'stg' && (
        <STGEntryForm
          stepMode={true}
          activeStep={activeStep}
          onStepChange={handleStepChange}
          onNextStep={(nextDate?: string, nextShift?: any) => {
            if (nextDate) handleDateShiftChange(nextDate, nextShift);
            setActiveStep('ts');
          }}
          onPrevStep={(nextDate?: string, nextShift?: any) => {
            if (nextDate) handleDateShiftChange(nextDate, nextShift);
            setActiveStep('stock');
          }}
          onDateShiftChange={handleDateShiftChange}
          initialDate={entryDate}
          initialShift={shift}
        />
      )}

      {activeStep === 'ts' && (
        <TSEntryForm
          stepMode={true}
          activeStep={activeStep}
          onStepChange={handleStepChange}
          onPrevStep={(nextDate?: string, nextShift?: any) => {
            if (nextDate) handleDateShiftChange(nextDate, nextShift);
            setActiveStep('stg');
          }}
          onFinish={() => {
            router.push(`/dashboard/ts/${entryDate}?shift=${shift || 'F'}`);
          }}
          onDateShiftChange={handleDateShiftChange}
          initialDate={entryDate}
          initialShift={shift}
        />
      )}
    </div>
  );
}
