import React, { useState, useRef, useEffect, useLayoutEffect, useCallback, useId } from 'react';
import { createPortal } from 'react-dom';
import type { Project } from '../../types';
import { MoreVertical, ExternalLink, Edit2, Trash2 } from 'lucide-react';

interface ProjectActionsMenuProps {
  project: Project;
  onOpen: (project: Project) => void;
  onRename: (project: Project) => void;
  onDelete: (project: Project) => void;
  isOpen?: boolean;
  onToggleOpen?: (isOpen: boolean) => void;
}

export const ProjectActionsMenu: React.FC<ProjectActionsMenuProps> = ({
  project,
  onOpen,
  onRename,
  onDelete,
  isOpen: controlledIsOpen,
  onToggleOpen,
}) => {
  const [internalIsOpen, setInternalIsOpen] = useState(false);
  const isOpen = controlledIsOpen !== undefined ? controlledIsOpen : internalIsOpen;

  const setIsOpen = useCallback((open: boolean) => {
    if (onToggleOpen) {
      onToggleOpen(open);
    } else {
      setInternalIsOpen(open);
    }
  }, [onToggleOpen]);

  const menuRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const menuId = useId();
  const [position, setPosition] = useState({ top: 0, left: 0 });

  useLayoutEffect(() => {
    if (!isOpen) return;
    const updatePosition = () => {
      const trigger = triggerRef.current?.getBoundingClientRect();
      const dropdown = dropdownRef.current;
      if (!trigger || !dropdown) return;
      const top = trigger.bottom + 6 + dropdown.offsetHeight > window.innerHeight - 12
        ? trigger.top - dropdown.offsetHeight - 6 : trigger.bottom + 6;
      setPosition({
        top: Math.max(12, top),
        left: Math.max(12, Math.min(trigger.right - dropdown.offsetWidth, window.innerWidth - dropdown.offsetWidth - 12)),
      });
    };
    updatePosition();
    dropdownRef.current?.querySelector<HTMLButtonElement>('[role="menuitem"]')?.focus();
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);
    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [isOpen]);

  // Close on outside click or Escape
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node) && !dropdownRef.current?.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        setIsOpen(false);
        triggerRef.current?.focus();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, setIsOpen]);

  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsOpen(!isOpen);
  };

  const handleAction = (e: React.MouseEvent, action: () => void) => {
    e.stopPropagation();
    setIsOpen(false);
    triggerRef.current?.focus();
    action();
  };

  const handleMenuKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    event.stopPropagation();
    const items = Array.from(dropdownRef.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]') || []);
    const index = items.indexOf(document.activeElement as HTMLButtonElement);
    if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
      event.preventDefault();
      const next = event.key === 'Home' ? 0 : event.key === 'End' ? items.length - 1
        : (index + (event.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length;
      items[next]?.focus();
    } else if (event.key === 'Escape' || event.key === 'Tab') {
      if (event.key === 'Escape') event.preventDefault();
      setIsOpen(false);
      triggerRef.current?.focus();
    }
  };

  return (
    <div
      ref={menuRef}
      className="project-actions-container"
      style={{ position: 'relative', display: 'inline-block' }}
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => e.stopPropagation()}
    >
      <button
        ref={triggerRef}
        type="button"
        onClick={handleToggle}
        className="btn btn-ghost btn-sm project-actions-trigger"
        aria-label={`Actions for ${project.title}`}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        aria-controls={isOpen ? menuId : undefined}
        onKeyDown={(event) => {
          if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            event.preventDefault();
            setIsOpen(true);
          }
        }}
        style={{
          padding: '6px',
          borderRadius: 'var(--radius-sm)',
          color: 'var(--black-60)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <MoreVertical size={16} />
      </button>

      {isOpen && createPortal(
        <div
          ref={dropdownRef}
          id={menuId}
          role="menu"
          onKeyDown={handleMenuKeyDown}
          onClick={(event) => event.stopPropagation()}
          aria-label={`Actions for ${project.title}`}
          className="project-actions-dropdown"
          style={{
            position: 'fixed',
            left: position.left,
            top: position.top,
            width: '208px',
            maxWidth: 'calc(100vw - 24px)',
            backgroundColor: '#ffffff',
            border: '1px solid rgba(0, 0, 0, 0.1)',
            borderRadius: '8px',
            boxShadow: '0 4px 16px rgba(0, 0, 0, 0.1)',
            padding: '4px',
            zIndex: 180,
            display: 'flex',
            flexDirection: 'column',
            gap: '2px',
          }}
        >
          <button
            role="menuitem"
            tabIndex={-1}
            type="button"
            onClick={(e) => handleAction(e, () => onOpen(project))}
            className="project-action-item"
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '8px 10px',
              border: 'none',
              background: 'transparent',
              fontSize: 'var(--text-control)',
              color: '#111827',
              borderRadius: '6px',
              cursor: 'pointer',
              textAlign: 'left',
              transition: 'background-color 120ms ease',
            }}
          >
            <ExternalLink size={14} color="rgba(0, 0, 0, 0.6)" />
            <span>Open project</span>
          </button>

          <button
            role="menuitem"
            tabIndex={-1}
            type="button"
            onClick={(e) => handleAction(e, () => onRename(project))}
            className="project-action-item"
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '8px 10px',
              border: 'none',
              background: 'transparent',
              fontSize: 'var(--text-control)',
              color: '#111827',
              borderRadius: '6px',
              cursor: 'pointer',
              textAlign: 'left',
              transition: 'background-color 120ms ease',
            }}
          >
            <Edit2 size={14} color="rgba(0, 0, 0, 0.6)" />
            <span>Rename project</span>
          </button>

          <div style={{ height: '1px', backgroundColor: 'rgba(0, 0, 0, 0.06)', margin: '2px 0' }} />

          <button
            role="menuitem"
            tabIndex={-1}
            type="button"
            onClick={(e) => handleAction(e, () => onDelete(project))}
            className="project-action-item project-action-delete"
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '8px 10px',
              border: 'none',
              background: 'transparent',
              fontSize: 'var(--text-control)',
              color: '#111827',
              borderRadius: '6px',
              cursor: 'pointer',
              textAlign: 'left',
              transition: 'background-color 120ms ease',
            }}
          >
            <Trash2 size={14} color="rgba(0, 0, 0, 0.6)" />
            <span>Delete project</span>
          </button>
        </div>, document.body
      )}
    </div>
  );
};
