import React from 'react';

interface SeparatorProps extends React.HTMLAttributes<HTMLDivElement> {
  orientation?: 'horizontal' | 'vertical';
}

export function Separator({
  orientation = 'horizontal',
  className,
  ...props
}: SeparatorProps) {
  const baseStyles = 'bg-gray-200';
  const orientationStyles = orientation === 'horizontal'
    ? 'h-px w-full'
    : 'w-px h-full';

  return (
    <div
      className={`${baseStyles} ${orientationStyles} ${className}`}
      {...props}
    />
  );
}