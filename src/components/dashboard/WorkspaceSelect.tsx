import { useEffect, useId, useRef, useState } from 'react';
import { Check, ChevronDown } from 'lucide-react';

interface WorkspaceSelectProps {
  id: string;
  label: string;
  value: string;
  placeholder?: string;
  disabled?: boolean;
  options: { value: string; label: string; description: string }[];
  onChange: (value: string) => void;
}

export function WorkspaceSelect({ id, label, value, placeholder, disabled, options, onChange }: WorkspaceSelectProps) {
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const listId = useId();
  const selected = options.find((option) => option.value === value);

  useEffect(() => {
    if (!open) return;
    const closeOutside = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', closeOutside);
    return () => document.removeEventListener('pointerdown', closeOutside);
  }, [open]);

  const choose = (index: number) => {
    onChange(options[index].value);
    setOpen(false);
    trigger.current?.focus();
  };

  return <div ref={root} className="workspace-select" onBlur={(event) => {
    if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
  }}>
    <label htmlFor={id} className="workspace-select-label">{label}</label>
    <button
      ref={trigger}
      id={id}
      type="button"
      role="combobox"
      className={`workspace-select-trigger${open ? ' is-open' : ''}${!selected ? ' is-placeholder' : ''}`}
      disabled={disabled}
      aria-expanded={open && !disabled}
      aria-haspopup="listbox"
      aria-controls={listId}
      aria-activedescendant={open ? `${listId}-${activeIndex}` : undefined}
      onClick={() => {
        setActiveIndex(Math.max(0, options.findIndex((option) => option.value === value)));
        setOpen(!open);
      }}
      onKeyDown={(event) => {
        if (event.key === 'Escape') { event.preventDefault(); setOpen(false); }
        else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
          event.preventDefault();
          setOpen(true);
          setActiveIndex((current) => open
            ? (current + (event.key === 'ArrowDown' ? 1 : -1) + options.length) % options.length
            : Math.max(0, options.findIndex((option) => option.value === value)));
        } else if (open && (event.key === 'Enter' || event.key === ' ')) {
          event.preventDefault(); choose(activeIndex);
        } else if (open && (event.key === 'Home' || event.key === 'End')) {
          event.preventDefault(); setActiveIndex(event.key === 'Home' ? 0 : options.length - 1);
        }
      }}
    >
      <span>{selected?.label || placeholder}</span>
      <ChevronDown size={15} aria-hidden="true" />
    </button>
    {open && !disabled && <div id={listId} role="listbox" aria-label={label} className="workspace-select-menu">
      {options.map((option, index) => <div
        id={`${listId}-${index}`}
        key={option.value}
        role="option"
        aria-selected={value === option.value}
        className={`workspace-select-option${activeIndex === index ? ' is-active' : ''}`}
        onPointerMove={() => setActiveIndex(index)}
        onMouseDown={(event) => event.preventDefault()}
        onClick={() => choose(index)}
      >
        <div><span className="workspace-select-option-title">{option.label}</span><span className="workspace-select-option-description">{option.description}</span></div>
        <span className="workspace-select-check">{value === option.value && <Check size={14} strokeWidth={2.5} />}</span>
      </div>)}
    </div>}
  </div>;
}
