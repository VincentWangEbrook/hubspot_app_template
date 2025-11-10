import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'secondary';
  size?: 'sm' | 'default';
}

export function Button({
  children,
  variant = 'default',
  size = 'default',
  className,
  ...props
}: ButtonProps) {
  const baseStyles = 'inline-flex items-center justify-center rounded-md font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2';
  const variantStyles = variant === 'default'
    ? 'bg-gray-800 text-white hover:bg-gray-700 focus:ring-gray-500'
    : 'bg-gray-100 text-gray-800 hover:bg-gray-200 focus:ring-gray-300';
  const sizeStyles = size === 'sm'
    ? 'px-3 py-1.5 text-sm'
    : 'px-4 py-2 text-base';

  return (
    <button
      className={`${baseStyles} ${variantStyles} ${sizeStyles} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}