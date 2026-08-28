import React from 'react';
import { Search } from 'lucide-react';

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  width?: string;
}

export const SearchBar: React.FC<SearchBarProps> = ({
  value,
  onChange,
  placeholder = 'Search by title or language...',
  width = '320px',
}) => {
  return (
    <div style={{ position: 'relative', width }}>
      <Search
        size={16}
        style={{
          position: 'absolute',
          left: '12px',
          top: '50%',
          transform: 'translateY(-50%)',
          color: 'var(--black-40)',
        }}
      />
      <input
        type="text"
        className="input"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{ paddingLeft: '38px', height: '38px', fontSize: '13px' }}
      />
    </div>
  );
};
