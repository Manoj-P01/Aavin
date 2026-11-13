'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Header from '@/components/layout/Header';
import type { SetupStepStatus } from '@/app/api/setup/status/route';

export default function SetupChecklistPage() {
  const [loading, setLoading] = useState(true);
  const [statusData, setStatusData] = useState<{
    isReady: boolean;
    completedCount: number;
    totalCount: number;
    percentage: number;
    steps: SetupStepStatus[];
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchStatus = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/setup/status', { cache: 'no-store' });
      if (!res.ok) throw new Error('Failed to fetch configuration status');
      const json = await res.json();
      if (!json.success) throw new Error(json.error || 'Unknown error');
      setStatusData(json);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error fetching setup status');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
  }, []);

  return (
    <>
      <Header
        title="Zero-Hardcode System Setup Checklist"
        subtitle="Manage dependency-ordered configurations from scratch. No hardcoded business data or pre-loaded records."
        actions={
          <div style={{ display: 'flex', gap: 10 }}>
            <button
              onClick={fetchStatus}
              disabled={loading}
              className="btn btn-secondary btn-sm"
              title="Refresh configuration status"
            >
              🔄 Refresh Status
            </button>
            <Link
              href="/dashboard/stock/new?step=stg"
              className={`btn btn-sm ${statusData?.isReady ? 'btn-primary' : 'btn-outline'}`}
            >
              📊 Go to STG Entry
            </Link>
          </div>
        }
      />

      <div style={{ padding: '24px 32px', maxWidth: 1200, margin: '0 auto' }}>
        {error && (
          <div
            style={{
              padding: '16px 20px',
              backgroundColor: '#fef2f2',
              color: '#991b1b',
              border: '1px solid #fecaca',
              borderRadius: 8,
              marginBottom: 24,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <span>⚠️ {error}</span>
            <button onClick={fetchStatus} className="btn btn-outline btn-sm">
              Retry
            </button>
          </div>
        )}

        {/* Overview Banner */}
        <div
          style={{
            background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
            color: '#fff',
            borderRadius: 12,
            padding: '24px 28px',
            marginBottom: 28,
            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
                <h2 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0 }}>System Readiness</h2>
                {loading ? (
                  <span className="badge badge-secondary">Checking...</span>
                ) : statusData?.isReady ? (
                  <span
                    style={{
                      background: '#16a34a',
                      color: '#fff',
                      fontSize: '0.75rem',
                      fontWeight: 700,
                      padding: '4px 10px',
                      borderRadius: 9999,
                      textTransform: 'uppercase',
                      letterSpacing: 0.5,
                    }}
                  >
                    ✓ Ready for Production
                  </span>
                ) : (
                  <span
                    style={{
                      background: '#eab308',
                      color: '#78350f',
                      fontSize: '0.75rem',
                      fontWeight: 700,
                      padding: '4px 10px',
                      borderRadius: 9999,
                      textTransform: 'uppercase',
                      letterSpacing: 0.5,
                    }}
                  >
                    Action Required ({statusData?.completedCount ?? 0}/{statusData?.totalCount ?? 8})
                  </span>
                )}
              </div>
              <p style={{ margin: 0, fontSize: '0.875rem', color: '#94a3b8' }}>
                Every master definition, row particular, column key, and formula is 100% database-driven.
                Follow the numbered sequence below to complete configuration.
              </p>
            </div>

            <div style={{ minWidth: 200 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8125rem', marginBottom: 6 }}>
                <span style={{ color: '#cbd5e1' }}>Setup Progress</span>
                <span style={{ fontWeight: 700, color: '#38bdf8' }}>{statusData?.percentage ?? 0}%</span>
              </div>
              <div
                style={{
                  height: 8,
                  backgroundColor: '#334155',
                  borderRadius: 9999,
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    height: '100%',
                    width: `${statusData?.percentage ?? 0}%`,
                    backgroundColor: statusData?.isReady ? '#22c55e' : '#38bdf8',
                    transition: 'width 0.4s ease',
                  }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Steps List */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {statusData?.steps.map((step) => {
            const isDone = step.isConfigured;

            return (
              <div
                key={step.id}
                style={{
                  background: '#fff',
                  border: isDone ? '1px solid #e2e8f0' : '1px solid #fde047',
                  borderRadius: 10,
                  padding: '20px 24px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.05)',
                  transition: 'all 0.2s ease',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16 }}>
                  {/* Order Circle */}
                  <div
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: '50%',
                      background: isDone ? '#dcfce7' : '#fef9c3',
                      color: isDone ? '#15803d' : '#a16207',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: 700,
                      fontSize: '1rem',
                      flexShrink: 0,
                    }}
                  >
                    {isDone ? '✓' : step.order}
                  </div>

                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                      <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: '#0f172a' }}>
                        {step.title}
                      </h3>
                      <span
                        style={{
                          fontSize: '0.6875rem',
                          fontFamily: 'monospace',
                          background: '#f1f5f9',
                          color: '#64748b',
                          padding: '2px 8px',
                          borderRadius: 4,
                        }}
                      >
                        {step.tableName}
                      </span>
                    </div>
                    <p style={{ margin: '0 0 6px 0', fontSize: '0.875rem', color: '#64748b' }}>
                      {step.description}
                    </p>
                    <div style={{ fontSize: '0.75rem', fontWeight: 600 }}>
                      {isDone ? (
                        <span style={{ color: '#16a34a' }}>
                          ● Active Records: {step.count}
                        </span>
                      ) : (
                        <span style={{ color: '#dc2626' }}>
                          ○ 0 records found — Required
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <Link
                    href={step.link}
                    className={`btn btn-sm ${isDone ? 'btn-secondary' : 'btn-primary'}`}
                    style={{ fontWeight: 600, minWidth: 140, textAlign: 'center' }}
                  >
                    {isDone ? 'Manage ' + step.title.split(' ')[0] : step.linkText} ➔
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}

