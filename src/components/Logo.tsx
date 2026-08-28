import React from 'react';

interface LogoProps {
  size?: number;
  className?: string;
  style?: React.CSSProperties;
}

export const Logo: React.FC<LogoProps> = ({ 
  size = 22, 
  className = '', 
  style = {} 
}) => {
  return (
    <img
      src="/logo.png"
      alt="dubbing.io logo"
      width={size}
      height={size}
      className={className}
      style={{
        width: `${size}px`,
        height: `${size}px`,
        borderRadius: `${Math.round(size * 0.24)}px`,
        objectFit: 'contain',
        display: 'block',
        flexShrink: 0,
        ...style,
      }}
    />
  );
};
