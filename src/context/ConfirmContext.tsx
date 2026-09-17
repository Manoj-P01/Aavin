'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

export interface ConfirmOptions {
  title?: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  type?: 'danger' | 'warning' | 'info' | 'success' | 'error';
}

export interface ConfirmContextType {
  confirm: (options: ConfirmOptions | string) => Promise<boolean>;
  showAlert: (message: string, title?: string) => Promise<void>;
  showError: (message: string, title?: string) => Promise<void>;
  showSuccess: (message: string, title?: string) => Promise<void>;
  showWarning: (message: string, title?: string) => Promise<void>;
}

const ConfirmContext = createContext<ConfirmContextType | undefined>(undefined);

interface ModalState {
  isOpen: boolean;
  title: string;
  message: string;
  confirmText: string;
  cancelText: string;
  type: 'danger' | 'warning' | 'info' | 'success' | 'error';
  isAlertOnly: boolean;
  resolve: (val: boolean) => void;
}

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [modal, setModal] = useState<ModalState | null>(null);

  useEffect(() => {
    if (!modal?.isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (!modal.isAlertOnly) {
          modal.resolve(false);
        } else {
          modal.resolve(true);
        }
      } else if (e.key === 'Enter') {
        modal.resolve(true);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [modal]);

  const confirm = (options: ConfirmOptions | string): Promise<boolean> => {
    return new Promise((resolve) => {
      const opts: ConfirmOptions = typeof options === 'string' ? { message: options } : options;
      setModal({
        isOpen: true,
        title: opts.title || (opts.type === 'info' ? 'Information' : opts.type === 'danger' ? 'Confirm Action' : 'Notice'),
        message: opts.message,
        confirmText: opts.confirmText || 'Confirm',
        cancelText: opts.cancelText || 'Cancel',
        type: opts.type || 'danger',
        isAlertOnly: false,
        resolve: (result: boolean) => {
          setModal(null);
          resolve(result);
        },
      });
    });
  };

  const showAlert = (message: string, title: string = 'Notice'): Promise<void> => {
    return new Promise((resolve) => {
      setModal({
        isOpen: true,
        title,
        message,
        confirmText: 'OK',
        cancelText: '',
        type: 'info',
        isAlertOnly: true,
        resolve: () => {
          setModal(null);
          resolve();
        },
      });
    });
  };

  const showError = (message: string, title: string = 'Error'): Promise<void> => {
    return new Promise((resolve) => {
      setModal({
        isOpen: true,
        title,
        message,
        confirmText: 'OK',
        cancelText: '',
        type: 'error',
        isAlertOnly: true,
        resolve: () => {
          setModal(null);
          resolve();
        },
      });
    });
  };

  const showSuccess = (message: string, title: string = 'Success'): Promise<void> => {
    return new Promise((resolve) => {
      setModal({
        isOpen: true,
        title,
        message,
        confirmText: 'OK',
        cancelText: '',
        type: 'success',
        isAlertOnly: true,
        resolve: () => {
          setModal(null);
          resolve();
        },
      });
    });
  };

  const showWarning = (message: string, title: string = 'Warning'): Promise<void> => {
    return new Promise((resolve) => {
      setModal({
        isOpen: true,
        title,
        message,
        confirmText: 'OK',
        cancelText: '',
        type: 'warning',
        isAlertOnly: true,
        resolve: () => {
          setModal(null);
          resolve();
        },
      });
    });
  };

  const getIcon = (type: ModalState['type']) => {
    switch (type) {
      case 'danger':
        return '⚠️';
      case 'error':
        return '❌';
      case 'warning':
        return '⚡';
      case 'success':
        return '✅';
      case 'info':
      default:
        return 'ℹ️';
    }
  };

  const getIconBg = (type: ModalState['type']) => {
    switch (type) {
      case 'danger':
      case 'error':
        return 'rgba(239, 68, 68, 0.12)';
      case 'warning':
        return 'rgba(245, 158, 11, 0.12)';
      case 'success':
        return 'rgba(16, 185, 129, 0.12)';
      case 'info':
      default:
        return 'rgba(14, 165, 233, 0.12)';
    }
  };

  const getConfirmBtnStyle = (type: ModalState['type']) => {
    switch (type) {
      case 'danger':
      case 'error':
        return { background: '#ef4444', color: '#ffffff' };
      case 'warning':
        return { background: '#f59e0b', color: '#ffffff' };
      case 'success':
        return { background: '#10b981', color: '#ffffff' };
      case 'info':
      default:
        return { background: '#0ea5e9', color: '#ffffff' };
    }
  };

  return (
    <ConfirmContext.Provider value={{ confirm, showAlert, showError, showSuccess, showWarning }}>
      {children}
      {modal?.isOpen && (
        <div
          className="modal-overlay animate-fade-in"
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(15, 23, 42, 0.55)',
            backdropFilter: 'blur(6px)',
            WebkitBackdropFilter: 'blur(6px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: '16px',
          }}
          onClick={() => {
            if (!modal.isAlertOnly) modal.resolve(false);
          }}
        >
          <div
            className="modal-card"
            style={{
              background: '#ffffff',
              border: '1px solid #e2e8f0',
              borderRadius: '14px',
              padding: '24px',
              maxWidth: 460,
              width: '100%',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
              display: 'flex',
              flexDirection: 'column',
              gap: 16,
              color: '#0f172a',
              animation: 'modalPop 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <div
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: getIconBg(modal.type),
                  fontSize: '1.4rem',
                  flexShrink: 0,
                }}
              >
                {getIcon(modal.type)}
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.125rem', fontWeight: 700, color: '#0f172a' }}>
                  {modal.title}
                </h3>
              </div>
            </div>

            <p style={{ margin: 0, fontSize: '0.9rem', color: '#475569', lineHeight: 1.55, whiteSpace: 'pre-line' }}>
              {modal.message}
            </p>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 10 }}>
              {!modal.isAlertOnly && (
                <button
                  type="button"
                  style={{
                    padding: '9px 18px',
                    fontSize: '0.875rem',
                    fontWeight: 600,
                    background: '#f1f5f9',
                    color: '#334155',
                    border: '1px solid #cbd5e1',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                  onClick={() => modal.resolve(false)}
                >
                  {modal.cancelText}
                </button>
              )}
              <button
                type="button"
                style={{
                  padding: '9px 22px',
                  fontSize: '0.875rem',
                  fontWeight: 600,
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                  transition: 'all 0.15s ease',
                  ...getConfirmBtnStyle(modal.type),
                }}
                onClick={() => modal.resolve(true)}
              >
                {modal.confirmText}
              </button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  );
}

export function useConfirm(): ConfirmContextType {
  const context = useContext(ConfirmContext);
  if (!context) {
    throw new Error('useConfirm must be used within a ConfirmProvider');
  }
  return context;
}
