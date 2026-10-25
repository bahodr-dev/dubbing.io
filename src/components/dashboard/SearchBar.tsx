import React from 'react';
import { Search, X } from 'lucide-react';

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  width?: string;
  id?: string;
}

export const SearchBar: React.FC<SearchBarProps> = ({
  value,
  onChange,
  placeholder = 'Search by title or language...',
  width = '320px',
  id = 'project-search-input',
}) => {
  return (
    <div className="search-bar-wrapper" style={{ position: 'relative', width, maxWidth: '100%' }}>
      <label htmlFor={id} className="sr-only">
        Search projects
      </label>
      <Search
        size={16}
        aria-hidden="true"
        style={{
          position: 'absolute',
          left: '12px',
          top: '50%',
          transform: 'translateY(-50%)',
          color: 'var(--black-40)',
          pointerEvents: 'none',
        }}
      />
      <input
        id={id}
        type="text"
        className="input"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{
          paddingLeft: '36px',
          paddingRight: value ? '32px' : '12px',
          height: '38px',
          fontSize: 'var(--text-input)',
          width: '100%',
        }}
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange('')}
          aria-label="Clear search input"
          className="btn btn-ghost"
          style={{
            position: 'absolute',
            right: '6px',
            top: '50%',
            transform: 'translateY(-50%)',
            padding: '4px',
            color: 'var(--black-40)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <X size={14} />
        </button>
      )}
    </div>
  );
};
