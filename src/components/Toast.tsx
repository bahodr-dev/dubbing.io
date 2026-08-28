import React from 'react';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';

export interface ToastMessage {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info';
}

interface ToastProps {
  toasts: ToastMessage[];
  onDismiss: (id: string) => void;
}

export const ToastContainer: React.FC<ToastProps> = ({ toasts, onDismiss }) => {
  if (toasts.length === 0) return null;

  return (
    <div
      style={{
        position: 'fixed',
        bottom: '24px',
        right: '24px',
        zIndex: 9999,
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
        maxWidth: '400px',
        width: '100%',
        pointerEvents: 'none',
      }}
    >
      {toasts.map((toast) => (
        <div
          key={toast.id}
          style={{
            pointerEvents: 'auto',
            backgroundColor: '#000000',
            color: '#FFFFFF',
            border: '1px solid rgba(255, 255, 255, 0.15)',
            borderRadius: '12px',
            padding: '12px 16px',
            boxShadow: '0 10px 30px rgba(0, 0, 0, 0.35)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
            fontSize: '13px',
            animation: 'fadeIn 180ms ease, slideUp 180ms ease',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1 }}>
            {toast.type === 'success' && <CheckCircle2 size={18} color="#22c55e" />}
            {toast.type === 'error' && <AlertCircle size={18} color="#ef4444" />}
            {toast.type === 'info' && <Info size={18} color="#3b82f6" />}
            <span style={{ fontWeight: 500, lineHeight: 1.4 }}>{toast.message}</span>
          </div>

          <button
            type="button"
            onClick={() => onDismiss(toast.id)}
            style={{
              background: 'none',
              border: 'none',
              color: 'rgba(255, 255, 255, 0.5)',
              cursor: 'pointer',
              padding: '2px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: '4px',
            }}
          >
            <X size={15} />
          </button>
        </div>
      ))}
    </div>
  );
};
