'use client';

import React, { createContext, useContext, useState, useEffect, useRef, useCallback, Suspense } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';

interface LoadingContextType {
  isLoading: boolean;
  activeRequests: number;
  startLoading: () => void;
  stopLoading: () => void;
}

const LoadingContext = createContext<LoadingContextType>({
  isLoading: false,
  activeRequests: 0,
  startLoading: () => {},
  stopLoading: () => {},
});

function RouteChangeTracker({ onStart, onComplete }: { onStart: () => void; onComplete: () => void }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const isFirstRender = useRef(true);

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    // Briefly indicate loading on navigation
    onStart();
    const timer = setTimeout(() => {
      onComplete();
    }, 300);

    return () => clearTimeout(timer);
  }, [pathname, searchParams, onStart, onComplete]);

  return null;
}

export function LoadingProvider({ children }: { children: React.ReactNode }) {
  const [activeRequests, setActiveRequests] = useState(0);
  const [isNavigating, setIsNavigating] = useState(false);
  const activeRequestsRef = useRef(0);

  const startLoading = useCallback(() => {
    activeRequestsRef.current += 1;
    setActiveRequests(activeRequestsRef.current);
  }, []);

  const stopLoading = useCallback(() => {
    activeRequestsRef.current = Math.max(0, activeRequestsRef.current - 1);
    setActiveRequests(activeRequestsRef.current);
  }, []);

  const startNav = useCallback(() => {
    setIsNavigating(true);
  }, []);

  const stopNav = useCallback(() => {
    setIsNavigating(false);
  }, []);

  // Intercept window.fetch globally on client
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const originalFetch = window.fetch;

    window.fetch = async function (...args) {
      startLoading();
      try {
        const response = await originalFetch.apply(this, args);
        return response;
      } finally {
        stopLoading();
      }
    };

    return () => {
      window.fetch = originalFetch;
    };
  }, [startLoading, stopLoading]);

  const isLoading = activeRequests > 0 || isNavigating;

  return (
    <LoadingContext.Provider value={{ isLoading, activeRequests, startLoading, stopLoading }}>
      <Suspense fallback={null}>
        <RouteChangeTracker onStart={startNav} onComplete={stopNav} />
      </Suspense>
      
      {/* Global Top Progress Bar & Floating Loading Badge */}
      <div
        className={`global-loading-bar-wrapper ${isLoading ? 'active' : ''}`}
        aria-live="polite"
        aria-busy={isLoading}
      >
        <div className="global-loading-bar-fill" />
      </div>

      {isLoading && (
        <div className="global-loading-badge">
          <span className="global-loading-spinner" />
          <span className="global-loading-text">
            {activeRequests > 0 ? 'Fetching API data...' : 'Loading page...'}
          </span>
        </div>
      )}

      {children}
    </LoadingContext.Provider>
  );
}

export function useLoading() {
  return useContext(LoadingContext);
}
