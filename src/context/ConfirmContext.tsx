'use client';

import React, { createContext, useContext, useState, ReactNode } from 'react';

export interface ConfirmOptions {
  title?: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  type?: 'danger' | 'warning' | 'info';
}

export interface ConfirmContextType {
  confirm: (options: ConfirmOptions | string) => Promise<boolean>;
  showAlert: (message: string, title?: string) => Promise<void>;
}

const ConfirmContext = createContext<ConfirmContextType | undefined>(undefined);

interface ModalState {
  isOpen: boolean;
  title: string;
  message: string;
  confirmText: string;
  cancelText: string;
  type: 'danger' | 'warning' | 'info';
  isAlertOnly: boolean;
  resolve: (val: boolean) => void;
}

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [modal, setModal] = useState<ModalState | null>(null);

  const confirm = (options: ConfirmOptions | string): Promise<boolean> => {
    return new Promise((resolve) => {
      const opts: ConfirmOptions = typeof options === 'string' ? { message: options } : options;
      setModal({
        isOpen: true,
        title: opts.title || (opts.type === 'info' ? 'Information' : 'Confirm Action'),
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

  return (
    <ConfirmContext.Provider value={{ confirm, showAlert }}>
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
            background: 'rgba(15, 23, 42, 0.45)',
            backdropFilter: 'blur(4px)',
            WebkitBackdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
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
              borderRadius: '12px',
              padding: '24px',
              maxWidth: 440,
              width: '90%',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.15), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
              display: 'flex',
              flexDirection: 'column',
              gap: 16,
              color: '#0f172a',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div
                style={{
                  width: 38,
                  height: 38,
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background:
                    modal.type === 'danger'
                      ? '#fee2e2'
                      : modal.type === 'warning'
                      ? '#fef3c7'
                      : '#e0f2fe',
                  fontSize: '1.25rem',
                }}
              >
                {modal.type === 'danger' ? '⚠️' : modal.type === 'warning' ? '⚡' : 'ℹ️'}
              </div>
              <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: '#0f172a' }}>
                {modal.title}
              </h3>
            </div>

            <p style={{ margin: 0, fontSize: '0.875rem', color: '#475569', lineHeight: 1.5 }}>
              {modal.message}
            </p>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 8 }}>
              {!modal.isAlertOnly && (
                <button
                  type="button"
                  style={{
                    padding: '8px 16px',
                    fontSize: '0.875rem',
                    fontWeight: 600,
                    background: '#f1f5f9',
                    color: '#334155',
                    border: '1px solid #cbd5e1',
                    borderRadius: '6px',
                    cursor: 'pointer',
                  }}
                  onClick={() => modal.resolve(false)}
                >
                  {modal.cancelText}
                </button>
              )}
              <button
                type="button"
                style={{
                  padding: '8px 18px',
                  fontSize: '0.875rem',
                  fontWeight: 600,
                  background:
                    modal.type === 'danger'
                      ? '#ef4444'
                      : modal.type === 'warning'
                      ? '#f59e0b'
                      : '#0ea5e9',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
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
