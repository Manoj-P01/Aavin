'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { usePathname, useRouter } from 'next/navigation';

const IDLE_LIMIT_MS = 10 * 60 * 1000; // 10 minutes
const HEARTBEAT_INTERVAL_MS = 2 * 60 * 1000; // 2 minutes
const ACTIVITY_STORAGE_KEY = 'aavin_last_user_activity';

export default function IdleSessionTracker() {
  const pathname = usePathname();
  const router = useRouter();
  const [isExpired, setIsExpired] = useState(false);

  const lastActivityRef = useRef<number>(Date.now());
  const lastHeartbeatRef = useRef<number>(Date.now());
  const isExpiredRef = useRef<boolean>(false);

  const isLoginPage = pathname?.startsWith('/login');

  const handleExpireSession = useCallback(async () => {
    if (isExpiredRef.current || isLoginPage) return;
    isExpiredRef.current = true;
    setIsExpired(true);

    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch {
      // Ignore network errors on logout
    }

    if (typeof window !== 'undefined') {
      try {
        localStorage.removeItem(ACTIVITY_STORAGE_KEY);
      } catch {}
    }
  }, [isLoginPage]);

  // Record user activity (mouse, keyboard, scroll, touch)
  const recordActivity = useCallback(() => {
    if (isExpiredRef.current) return;
    const now = Date.now();
    lastActivityRef.current = now;
    try {
      localStorage.setItem(ACTIVITY_STORAGE_KEY, now.toString());
    } catch {
      // Ignore storage errors
    }
  }, []);

  // Periodic heartbeat & idle check
  useEffect(() => {
    if (isLoginPage) {
      isExpiredRef.current = false;
      setIsExpired(false);
      return;
    }

    // Initialize activity timestamp
    recordActivity();

    // Event listeners for user interaction
    const events = ['mousemove', 'mousedown', 'keydown', 'scroll', 'touchstart', 'click'];
    let throttleTimeout: NodeJS.Timeout | null = null;

    const onUserEvent = () => {
      if (!throttleTimeout) {
        throttleTimeout = setTimeout(() => {
          throttleTimeout = null;
        }, 1000); // Throttle to once per second
        recordActivity();
      }
    };

    events.forEach(evt => window.addEventListener(evt, onUserEvent, { passive: true }));

    // Timer loop: checks idle status every 5 seconds, sends heartbeat every 2 minutes if active
    const checkInterval = setInterval(async () => {
      if (isExpiredRef.current) return;

      const now = Date.now();

      // Check cross-tab activity from localStorage
      let latestActivity = lastActivityRef.current;
      try {
        const stored = localStorage.getItem(ACTIVITY_STORAGE_KEY);
        if (stored) {
          const storedTime = parseInt(stored, 10);
          if (!isNaN(storedTime) && storedTime > latestActivity) {
            latestActivity = storedTime;
            lastActivityRef.current = storedTime;
          }
        }
      } catch {}

      const idleDuration = now - latestActivity;

      // 1. If user has been idle for more than 10 minutes: expire session
      if (idleDuration >= IDLE_LIMIT_MS) {
        await handleExpireSession();
        return;
      }

      // 2. If user is actively working and 2 minutes have elapsed since last heartbeat: send refresh
      if (now - lastHeartbeatRef.current >= HEARTBEAT_INTERVAL_MS) {
        lastHeartbeatRef.current = now;
        try {
          const res = await fetch('/api/auth/refresh', { method: 'POST' });
          if (res.status === 401) {
            // Server reported session expired or invalid
            await handleExpireSession();
          }
        } catch (err) {
          console.warn('Session heartbeat error:', err);
        }
      }
    }, 5000);

    // Global fetch interceptor to catch 401 Unauthorized responses
    const originalFetch = window.fetch;
    window.fetch = async (...args) => {
      const response = await originalFetch(...args);
      if (response.status === 401 && !isExpiredRef.current && !window.location.pathname.startsWith('/login')) {
        try {
          const clone = response.clone();
          const json = await clone.json();
          if (
            json?.error?.includes('Token expired or invalid') ||
            json?.error?.includes('Authentication required') ||
            json?.error?.includes('Unauthorized')
          ) {
            handleExpireSession();
          }
        } catch {}
      }
      return response;
    };

    return () => {
      events.forEach(evt => window.removeEventListener(evt, onUserEvent));
      clearInterval(checkInterval);
      if (throttleTimeout) clearTimeout(throttleTimeout);
      window.fetch = originalFetch;
    };
  }, [isLoginPage, recordActivity, handleExpireSession]);

  const handleLoginRedirect = () => {
    setIsExpired(false);
    isExpiredRef.current = false;
    router.push('/login?reason=idle_timeout');
  };

  if (!isExpired || isLoginPage) return null;

  return (
    <div
      className="modal-overlay animate-fade-in"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(15, 23, 42, 0.7)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 99999,
        padding: '16px',
      }}
    >
      <div
        className="modal-card"
        style={{
          background: '#ffffff',
          border: '1px solid #e2e8f0',
          borderRadius: '16px',
          padding: '28px 24px',
          maxWidth: 440,
          width: '100%',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.35)',
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
          color: '#0f172a',
          textAlign: 'center',
        }}
      >
        <div
          style={{
            width: 56,
            height: 56,
            borderRadius: '50%',
            background: 'rgba(245, 158, 11, 0.14)',
            color: '#d97706',
            fontSize: '1.8rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto',
          }}
        >
          ⚠️
        </div>

        <div>
          <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800, color: '#0f172a' }}>
            Unauthorized: Token expired or invalid
          </h3>
          <p style={{ margin: '8px 0 0', fontSize: '0.9rem', color: '#64748b', lineHeight: 1.55 }}>
            Your session has expired due to more than <strong>10 minutes of inactivity</strong>. Please log in again to continue working.
          </p>
        </div>

        <div style={{ marginTop: 8 }}>
          <button
            type="button"
            onClick={handleLoginRedirect}
            style={{
              width: '100%',
              padding: '12px 20px',
              fontSize: '0.95rem',
              fontWeight: 700,
              color: '#ffffff',
              background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
              border: 'none',
              borderRadius: '10px',
              cursor: 'pointer',
              boxShadow: '0 4px 6px -1px rgba(2, 132, 199, 0.3)',
              transition: 'all 0.15s ease',
            }}
          >
            🔐 Log In Again
          </button>
        </div>
      </div>
    </div>
  );
}
