import React from 'react';

interface LoaderProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  label?: string;
}

const sizeStyles = {
  sm: 'w-6 h-6',
  md: 'w-8 h-8',
  lg: 'w-10 h-10',
};

export const Loader: React.FC<LoaderProps> = ({
  size = 'md',
  className = '',
  label,
}) => {
  return (
    <div className={`flex flex-col items-center justify-center gap-3 ${className}`}>
      <div
        className={`border-3 border-gray-200 border-t-primary-600 rounded-full animate-spin ${sizeStyles[size]}`}
      ></div>
      {label && <p className="text-sm text-gray-600">{label}</p>}
    </div>
  );
};