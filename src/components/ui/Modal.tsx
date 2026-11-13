// ─────────────────────────────────────────────────────────────
// src/components/ui/Modal.tsx
// Standardized Accessible Dialog / Modal Component
// ─────────────────────────────────────────────────────────────

'use client';

import React, { useEffect, useRef } from 'react';

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  subtitle?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
  closeOnBackdrop?: boolean;
  closeOnEsc?: boolean;
  className?: string;
}

export function Modal({
  isOpen,
  onClose,
  title,
  subtitle,
  children,
  footer,
  size = 'md',
  closeOnBackdrop = true,
  closeOnEsc = true,
  className = '',
}: ModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (closeOnEsc && e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [isOpen, closeOnEsc, onClose]);

  if (!isOpen) return null;

  const getMaxWidth = () => {
    switch (size) {
      case 'sm':
        return 420;
      case 'md':
        return 560;
      case 'lg':
        return 780;
      case 'xl':
        return 960;
      case 'full':
        return '95vw';
      default:
        return 560;
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 'var(--space-4, 16px)',
        backgroundColor: 'rgba(15, 23, 42, 0.5)',
        backdropFilter: 'blur(4px)',
      }}
      onClick={e => {
        if (closeOnBackdrop && e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        ref={modalRef}
        className={`modal-box ${className}`.trim()}
        style={{
          width: '100%',
          maxWidth: getMaxWidth(),
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          backgroundColor: 'var(--bg-card, #ffffff)',
          borderRadius: 'var(--radius-xl, 16px)',
          boxShadow: 'var(--shadow-xl, 0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1))',
          border: '1px solid var(--border, #e2e8f0)',
          overflow: 'hidden',
          animation: 'modalSlideIn 0.2s ease-out',
        }}
      >
        {/* Modal Header */}
        {title && (
          <div
            style={{
              padding: 'var(--space-4, 16px) var(--space-6, 24px)',
              borderBottom: '1px solid var(--border, #e2e8f0)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 12,
            }}
          >
            <div>
              <h3
                style={{
                  margin: 0,
                  fontSize: 'var(--font-lg, 1.125rem)',
                  fontWeight: 600,
                  color: 'var(--text-primary, #0f172a)',
                }}
              >
                {title}
              </h3>
              {subtitle && (
                <p
                  style={{
                    margin: '2px 0 0 0',
                    fontSize: 'var(--font-xs, 0.75rem)',
                    color: 'var(--text-muted, #64748b)',
                  }}
                >
                  {subtitle}
                </p>
              )}
            </div>

            <button
              type="button"
              onClick={onClose}
              aria-label="Close dialog"
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--text-muted, #64748b)',
                fontSize: '1.25rem',
                cursor: 'pointer',
                borderRadius: 'var(--radius-md, 6px)',
                width: 32,
                height: 32,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              ✕
            </button>
          </div>
        )}

        {/* Modal Body */}
        <div
          style={{
            padding: 'var(--space-6, 24px)',
            overflowY: 'auto',
            flex: 1,
          }}
        >
          {children}
        </div>

        {/* Modal Footer */}
        {footer && (
          <div
            style={{
              padding: 'var(--space-4, 16px) var(--space-6, 24px)',
              borderTop: '1px solid var(--border, #e2e8f0)',
              backgroundColor: 'var(--bg-subtle, #f8fafc)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-end',
              gap: 'var(--space-3, 12px)',
            }}
          >
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

export default Modal;

