import React from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  className?: string;
  disabled?: boolean;
  type?: string;
}

export function Input({
  className,
  disabled = false,
  type = 'text',
  ...props
}: InputProps) {
  return (
    <input
      type={type}
      disabled={disabled}
      className={`
        w-full px-3 py-2 border border-gray-300 rounded-md
        text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500
        focus:border-transparent transition-colors
        ${disabled ? 'opacity-50 cursor-not-allowed bg-gray-50' : 'bg-white hover:border-gray-400'}
        ${className}
      `}
      {...props}
    />
  );
}