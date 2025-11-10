import React from 'react';

interface AvatarProps extends React.HTMLAttributes<HTMLDivElement> {
  className?: string;
  children: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

interface AvatarImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  className?: string;
  alt: string;
  // 新增：支持默认占位图（可选，避免空 src）
  fallbackSrc?: string;
}

interface AvatarFallbackProps extends React.HTMLAttributes<HTMLSpanElement> {
  className?: string;
  children: React.ReactNode;
}

const sizeMap = {
  sm: 'h-8 w-8',
  md: 'h-12 w-12',
  lg: 'h-16 w-16',
  xl: 'h-20 w-20',
};

export function Avatar({
  className,
  children,
  size = 'md',
  ...props
}: AvatarProps) {
  return (
    <div
      className={`
        relative flex items-center justify-center rounded-full overflow-hidden
        bg-gray-200 ${sizeMap[size]} ${className}
      `}
      {...props}
    >
      {children}
    </div>
  );
}

// 修复：处理空 src，用 null 或 fallbackSrc 替代
export function AvatarImage({ 
  className, 
  alt, 
  src, 
  fallbackSrc = 'https://via.placeholder.com/100/cccccc/888888?text=No+Img', // 默认占位图（可选）
  ...props 
}: AvatarImageProps) {
  // 核心修复：src 为空时用 fallbackSrc 或 null（优先 fallbackSrc）
  const finalSrc = src ? src : fallbackSrc ? fallbackSrc : null;

  // 若最终 src 仍为 null，不渲染 img 标签（避免错误）
  if (!finalSrc) return null;

  return (
    <img
      src={finalSrc}
      alt={alt}
      className={`object-cover w-full h-full ${className || ''}`}
      // 新增：图片加载失败时用 fallbackSrc 兜底
      onError={(e) => {
        const img = e.target as HTMLImageElement;
        img.src = fallbackSrc;
      }}
      {...props}
    />
  );
}

export function AvatarFallback({ 
  className, 
  children, 
  ...props 
}: AvatarFallbackProps) {
  return (
    <span
      className={`
        text-gray-700 font-medium text-center
        ${className || ''}
      `}
      {...props}
    >
      {children}
    </span>
  );
}