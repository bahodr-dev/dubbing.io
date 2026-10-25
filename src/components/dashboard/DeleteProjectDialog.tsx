import React, { useState, useRef } from 'react';
import type { Project } from '../../types';
import { Loader2 } from 'lucide-react';
import { useDialogFocus } from '../../hooks/useDialogFocus';

interface DeleteProjectDialogProps {
  project: Project | null;
  isOpen: boolean;
  onClose: () => void;
  onDelete: (projectId: string) => void | Promise<void>;
  returnFocusRef?: React.RefObject<HTMLElement | null>;
}

export const DeleteProjectDialog: React.FC<DeleteProjectDialogProps> = ({
  project,
  isOpen,
  onClose,
  onDelete,
  returnFocusRef,
}) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const cancelButtonRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  useDialogFocus({ isOpen, dialogRef, initialFocusRef: cancelButtonRef, returnFocusRef, onClose, canClose: !isSubmitting });

  const openKey = isOpen && project ? project.id : '';
  const [prevOpenKey, setPrevOpenKey] = useState(openKey);

  if (openKey !== prevOpenKey) {
    setPrevOpenKey(openKey);
    if (isOpen && project) {
      setErrorMessage(null);
      setIsSubmitting(false);
    }
  }

  const handleClose = () => {
    onClose();
  };

  if (!isOpen || !project) return null;

  const handleDelete = async () => {
    if (isSubmitting) return;

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      await onDelete(project.id);
      handleClose();
    } catch (err: unknown) {
      const errorObj = err as Error;
      setErrorMessage(errorObj.message || 'Failed to delete project. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="dashboard-dialog-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isSubmitting) {
          handleClose();
        }
      }}
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.45)',
        backdropFilter: 'blur(2px)',
        zIndex: 200,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
        animation: 'fadeIn 120ms ease',
      }}
    >
      <div
        ref={dialogRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="delete-dialog-title"
        aria-describedby="delete-dialog-desc"
        className="dashboard-dialog"
        style={{
          backgroundColor: '#FFFFFF',
          borderRadius: '12px',
          border: '1px solid rgba(0, 0, 0, 0.1)',
          boxShadow: '0 12px 36px rgba(0, 0, 0, 0.15)',
          maxWidth: '440px',
          width: '100%',
          padding: '24px',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
        }}
      >
        <div>
          <h2
            id="delete-dialog-title"
            style={{
              fontSize: '18px',
              fontWeight: 700,
              color: '#111827',
              margin: 0,
              letterSpacing: '-0.01em',
            }}
          >
            Delete project
          </h2>
          <p
            id="delete-dialog-desc"
            style={{
              fontSize: 'var(--text-body)',
              color: 'rgba(0, 0, 0, 0.65)',
              marginTop: '6px',
              marginBottom: 0,
              lineHeight: 1.5,
            }}
          >
            Are you sure you want to delete <strong style={{ color: '#111827' }}>"{project.title}"</strong>? This will permanently remove the video dubbing project and transcript data.
          </p>
        </div>

        {errorMessage && (
          <div
            role="alert"
            style={{
              padding: '8px 12px',
              borderRadius: '6px',
              backgroundColor: 'rgba(0, 0, 0, 0.04)',
              border: '1px solid rgba(0, 0, 0, 0.15)',
              color: '#000000',
              fontSize: 'var(--text-meta)',
              fontWeight: 500,
            }}
          >
            {errorMessage}
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '8px' }}>
          <button
            ref={cancelButtonRef}
            type="button"
            onClick={handleClose}
            disabled={isSubmitting}
            className="btn btn-secondary btn-sm"
            style={{ padding: '8px 14px', fontWeight: 600 }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleDelete}
            disabled={isSubmitting}
            className="btn btn-sm dashboard-dialog-delete-btn"
            style={{
              padding: '8px 16px',
              fontWeight: 600,
              backgroundColor: '#111827',
              color: '#FFFFFF',
              border: '1px solid #111827',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              cursor: isSubmitting ? 'not-allowed' : 'pointer',
              opacity: isSubmitting ? 0.6 : 1,
            }}
          >
            {isSubmitting && <Loader2 size={14} className="animate-spin" />}
            <span>Delete</span>
          </button>
        </div>
      </div>
    </div>
  );
};
