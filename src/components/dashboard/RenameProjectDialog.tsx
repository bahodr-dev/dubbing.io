import React, { useState, useEffect, useRef } from 'react';
import type { Project } from '../../types';
import { Loader2 } from 'lucide-react';
import { useDialogFocus } from '../../hooks/useDialogFocus';

interface RenameProjectDialogProps {
  project: Project | null;
  isOpen: boolean;
  onClose: () => void;
  onRename: (projectId: string, newTitle: string) => void | Promise<void>;
  returnFocusRef?: React.RefObject<HTMLElement | null>;
}

export const RenameProjectDialog: React.FC<RenameProjectDialogProps> = ({
  project,
  isOpen,
  onClose,
  onRename,
  returnFocusRef,
}) => {
  const [title, setTitle] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  useDialogFocus({ isOpen, dialogRef, initialFocusRef: inputRef, returnFocusRef, onClose, canClose: !isSubmitting });

  const openKey = isOpen && project ? `${project.id}-${project.title}` : '';
  const [prevOpenKey, setPrevOpenKey] = useState(openKey);

  if (openKey !== prevOpenKey) {
    setPrevOpenKey(openKey);
    if (isOpen && project) {
      setTitle(project.title);
      setErrorMessage(null);
      setIsSubmitting(false);
    }
  }

  useEffect(() => {
    if (!isOpen) return;
    const frame = requestAnimationFrame(() => inputRef.current?.select());
    return () => cancelAnimationFrame(frame);
  }, [isOpen, project]);

  const handleClose = () => {
    onClose();
  };

  if (!isOpen || !project) return null;

  const trimmedTitle = title.trim();
  const isUnchanged = trimmedTitle === project.title.trim();
  const isInvalid = !trimmedTitle || isUnchanged;

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (isInvalid || isSubmitting) return;

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      await onRename(project.id, trimmedTitle);
      handleClose();
    } catch (err: unknown) {
      const errorObj = err as Error;
      setErrorMessage(errorObj.message || 'Failed to rename project. Please try again.');
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
        aria-labelledby="rename-dialog-title"
        aria-describedby="rename-dialog-desc"
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
            id="rename-dialog-title"
            style={{
              fontSize: '18px',
              fontWeight: 700,
              color: '#111827',
              margin: 0,
              letterSpacing: '-0.01em',
            }}
          >
            Rename project
          </h2>
          <p
            id="rename-dialog-desc"
            style={{
              fontSize: 'var(--text-body)',
              color: 'rgba(0, 0, 0, 0.6)',
              marginTop: '4px',
              marginBottom: 0,
            }}
          >
            Enter a new descriptive title for this dubbing project.
          </p>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <label
              htmlFor="rename-project-input"
              style={{
                display: 'block',
                fontSize: 'var(--text-control)',
                fontWeight: 600,
                color: 'rgba(0, 0, 0, 0.7)',
                marginBottom: '6px',
              }}
            >
              Project title
            </label>
            <input
              ref={inputRef}
              id="rename-project-input"
              type="text"
              value={title}
              maxLength={200}
              onChange={(e) => setTitle(e.target.value)}
              disabled={isSubmitting}
              className="input"
              style={{
                width: '100%',
                padding: '8px 12px',
                borderRadius: '8px',
                border: '1px solid rgba(0, 0, 0, 0.15)',
                fontSize: 'var(--text-input)',
                outline: 'none',
              }}
            />
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
              type="button"
              onClick={handleClose}
              disabled={isSubmitting}
              className="btn btn-secondary btn-sm"
              style={{ padding: '8px 14px', fontWeight: 600 }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isInvalid || isSubmitting}
              className="btn btn-primary btn-sm"
              style={{
                padding: '8px 16px',
                fontWeight: 600,
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                opacity: isInvalid || isSubmitting ? 0.5 : 1,
                cursor: isInvalid || isSubmitting ? 'not-allowed' : 'pointer',
              }}
            >
              {isSubmitting && <Loader2 size={14} className="animate-spin" />}
              <span>Rename</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
