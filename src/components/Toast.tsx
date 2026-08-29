import React, { useState, useEffect } from 'react';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';

export interface ToastMessage {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info';
  duration?: number;
}

interface ToastItemProps {
  toast: ToastMessage;
  onDismiss: (id: string) => void;
}

export const ToastItem: React.FC<ToastItemProps> = ({ toast, onDismiss }) => {
  const [isExiting, setIsExiting] = useState(false);

  useEffect(() => {
    const duration = toast.duration || 3600;
    const dismissTimer = setTimeout(() => {
      setIsExiting(true);
    }, duration);

    return () => clearTimeout(dismissTimer);
  }, [toast.duration]);

  useEffect(() => {
    if (isExiting) {
      const exitTimer = setTimeout(() => {
        onDismiss(toast.id);
      }, 220);
      return () => clearTimeout(exitTimer);
    }
  }, [isExiting, onDismiss, toast.id]);

  const handleManualClose = () => {
    setIsExiting(true);
  };

  return (
    <div
      style={{
        pointerEvents: 'auto',
        width: '100%',
        backgroundColor: '#000000',
        color: '#FFFFFF',
        border: '1px solid rgba(255, 255, 255, 0.18)',
        borderRadius: '14px',
        padding: '12px 18px',
        boxShadow: '0 16px 36px rgba(0, 0, 0, 0.4), 0 2px 8px rgba(0, 0, 0, 0.2)',
        backdropFilter: 'blur(10px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '12px',
        fontSize: '13.5px',
        animation: isExiting
          ? 'toastSlideOutTop 220ms cubic-bezier(0.16, 1, 0.3, 1) forwards'
          : 'toastSlideInTop 320ms cubic-bezier(0.16, 1, 0.3, 1) forwards',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1 }}>
        {toast.type === 'success' && <CheckCircle2 size={18} color="#22c55e" strokeWidth={2.2} />}
        {toast.type === 'error' && <AlertCircle size={18} color="#ef4444" strokeWidth={2.2} />}
        {toast.type === 'info' && <Info size={18} color="#3b82f6" strokeWidth={2.2} />}
        <span style={{ fontWeight: 500, lineHeight: 1.4 }}>{toast.message}</span>
      </div>

      <button
        type="button"
        onClick={handleManualClose}
        style={{
          background: 'none',
          border: 'none',
          color: 'rgba(255, 255, 255, 0.5)',
          cursor: 'pointer',
          padding: '4px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: '4px',
          transition: 'color 150ms ease',
        }}
        onMouseEnter={(e) => (e.currentTarget.style.color = '#FFFFFF')}
        onMouseLeave={(e) => (e.currentTarget.style.color = 'rgba(255, 255, 255, 0.5)')}
        aria-label="Close notification"
      >
        <X size={15} />
      </button>
    </div>
  );
};

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
        top: '20px',
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 9999,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '10px',
        maxWidth: '440px',
        width: 'calc(100% - 32px)',
        pointerEvents: 'none',
      }}
    >
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onDismiss={onDismiss} />
      ))}
    </div>
  );
};
