'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

function LoginFormContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('admin');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [idleMessage, setIdleMessage] = useState('');

  useEffect(() => {
    const reason = searchParams.get('reason');
    if (reason === 'idle_timeout') {
      setIdleMessage('Your session expired due to 10 minutes of inactivity. Please log in again.');
    }
  }, [searchParams]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIdleMessage('');
    setLoading(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Authentication failed');
      }

      const redirectUrl = searchParams.get('redirect') || '/dashboard/stock';
      router.push(redirectUrl);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Login failed. Please check credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
        fontFamily: 'var(--font-sans, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif)',
      }}
    >
      <div
        className="card animate-fade-in"
        style={{
          maxWidth: 420,
          width: '100%',
          background: '#ffffff',
          border: '1px solid #e2e8f0',
          borderRadius: 16,
          padding: '36px 32px',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.05), 0 8px 10px -6px rgba(0, 0, 0, 0.01)',
          color: '#0f172a',
        }}
      >
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{ fontSize: '2.5rem', marginBottom: 8 }}>🥛</div>
          <h1 style={{ fontSize: '1.4rem', fontWeight: 800, color: '#0284c7', margin: 0 }}>
            Aavin Dairy Dashboard
          </h1>
          <p style={{ fontSize: '0.82rem', color: '#64748b', marginTop: 4, fontWeight: 500 }}>
            Namakkal District Co-operative Milk Producers&apos; Union Ltd
          </p>
        </div>

        {idleMessage && (
          <div
            style={{
              background: '#fffbe6',
              border: '1px solid #ffe58f',
              color: '#d48806',
              padding: '10px 14px',
              borderRadius: 8,
              fontSize: '0.8rem',
              marginBottom: 20,
              textAlign: 'center',
              fontWeight: 600,
            }}
          >
            ⏳ {idleMessage}
          </div>
        )}

        {error && (
          <div
            style={{
              background: '#fff2f0',
              border: '1px solid #ffccc7',
              color: '#ff4d4f',
              padding: '10px 14px',
              borderRadius: 8,
              fontSize: '0.8rem',
              marginBottom: 20,
              textAlign: 'center',
              fontWeight: 600,
            }}
          >
            ⚠️ {error}
          </div>
        )}

        <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <label style={{ fontSize: '0.78rem', fontWeight: 600, color: '#334155', display: 'block', marginBottom: 6 }}>
              Username
            </label>
            <input
              type="text"
              placeholder="Enter your username"
              value={username}
              onChange={e => setUsername(e.target.value)}
              required
              style={{
                width: '100%',
                padding: '10px 12px',
                borderRadius: 8,
                border: '1px solid #cbd5e1',
                background: '#f8fafc',
                color: '#0f172a',
                fontSize: '0.9rem',
                outline: 'none',
              }}
            />
          </div>

          <div>
            <label style={{ fontSize: '0.78rem', fontWeight: 600, color: '#334155', display: 'block', marginBottom: 6 }}>
              Password
            </label>
            <input
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              style={{
                width: '100%',
                padding: '10px 12px',
                borderRadius: 8,
                border: '1px solid #cbd5e1',
                background: '#f8fafc',
                color: '#0f172a',
                fontSize: '0.9rem',
                outline: 'none',
              }}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%',
              padding: '12px',
              borderRadius: 8,
              border: 'none',
              background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
              color: '#fff',
              fontWeight: 700,
              fontSize: '0.95rem',
              cursor: loading ? 'not-allowed' : 'pointer',
              marginTop: 10,
              boxShadow: '0 4px 12px rgba(2, 132, 199, 0.25)',
            }}
          >
            {loading ? 'Authenticating...' : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div style={{ color: '#334155', textAlign: 'center', paddingTop: 100 }}>Loading Login...</div>}>
      <LoginFormContent />
    </Suspense>
  );
}
