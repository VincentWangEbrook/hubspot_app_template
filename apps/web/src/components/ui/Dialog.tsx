'use client';
import React, { useRef, useEffect, ReactNode, useCallback, Ref, MutableRefObject } from 'react';
import { X } from 'lucide-react';

// 核心类型：聚焦常用场景，避免复杂推断
interface DialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  disabled?: boolean;
  className?: string;
  children: ReactNode;
  closeOnOutsideClick?: boolean;
  closeOnEsc?: boolean;
}

interface DialogTriggerProps {
  asChild?: boolean;
  className?: string;
  children: ReactNode;
  disabled?: boolean; // 直接控制触发按钮禁用
}

interface DialogContentProps extends React.HTMLAttributes<HTMLDivElement> {
  className?: string;
  children: ReactNode;
  dismissible?: boolean;
}

interface DialogHeaderProps extends React.HTMLAttributes<HTMLDivElement> {
  className?: string;
  children: ReactNode;
}

interface DialogTitleProps extends React.HTMLAttributes<HTMLHeadingElement> {
  className?: string;
  children: ReactNode;
}

interface DialogDescriptionProps extends React.HTMLAttributes<HTMLParagraphElement> {
  className?: string;
  children: ReactNode;
}

interface DialogFooterProps extends React.HTMLAttributes<HTMLDivElement> {
  className?: string;
  children: ReactNode;
}

// 核心 Dialog 容器
export function Dialog({
  open,
  onOpenChange,
  disabled = false,
  className,
  children,
  closeOnOutsideClick = true,
  closeOnEsc = true,
}: DialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLElement | null>(null);

  // 关闭对话框
  const closeDialog = useCallback(() => {
    if (!disabled) onOpenChange(false);
  }, [disabled, onOpenChange]);

  // 点击外部关闭
  useEffect(() => {
    if (!open) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (
        closeOnOutsideClick &&
        dialogRef.current &&
        !dialogRef.current.contains(e.target as Node) &&
        triggerRef.current &&
        !triggerRef.current.contains(e.target as Node)
      ) {
        closeDialog();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open, closeDialog, closeOnOutsideClick]);

  // ESC 键关闭
  useEffect(() => {
    if (!open || !closeOnEsc || disabled) return;

    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeDialog();
    };

    document.addEventListener('keydown', handleEsc);
    return () => document.removeEventListener('keydown', handleEsc);
  }, [open, closeDialog, closeOnEsc, disabled]);

  // 禁止页面滚动，同时保持滚动位置
  useEffect(() => {
    if (open) {
      // 保存当前滚动位置
      const scrollY = window.scrollY;
      const scrollX = window.scrollX;
      
      // 禁止滚动
      document.body.style.overflow = 'hidden';
      document.body.style.position = 'fixed';
      document.body.style.top = `-${scrollY}px`;
      document.body.style.left = `-${scrollX}px`;
      document.body.style.width = '100%';
      
      return () => {
        // 恢复滚动
        document.body.style.overflow = '';
        document.body.style.position = '';
        document.body.style.top = '';
        document.body.style.left = '';
        document.body.style.width = '';
        
        // 恢复滚动位置
        window.scrollTo(scrollX, scrollY);
      };
    }
  }, [open]);

  if (!open || disabled) return null;

  // 传递关闭方法（修复 Context 类型）
  const DialogContext = React.createContext<() => void>(() => {});

  return (
    <div className={`fixed inset-0 z-50 flex items-center justify-center p-4 ${className}`}>
      <div 
        className="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
        onClick={closeDialog}
      />
      <div
        ref={dialogRef}
        className="relative bg-white rounded-lg shadow-xl max-w-md w-full max-h-[90vh] transform transition-all flex flex-col"
        tabIndex={-1}
        aria-modal="true"
        role="dialog"
      >
        <DialogContext.Provider value={closeDialog}>
          {children}
        </DialogContext.Provider>
      </div>
    </div>
  );
}

// DialogTrigger：修复 Ref 类型，彻底移除扩展运算符
export function DialogTrigger({
  asChild = false,
  className,
  children,
  disabled = false,
}: DialogTriggerProps) {
  const triggerRef = useRef<HTMLElement | null>(null);
  
  const handleClick = useCallback((e: React.MouseEvent) => {
    if (disabled) return;
    e.stopPropagation();
  }, [disabled]);

  if (asChild) {
    // 仅处理嵌套 Button 组件（常用场景），明确属性类型
    const child = React.Children.only(children) as React.ReactElement<{
      disabled?: boolean;
      onClick?: (e: React.MouseEvent) => void;
      ref?: Ref<HTMLElement | null>; // 使用 React.Ref 兼容所有 Ref 类型
      className?: string;
    }>;

    // 合并 classNames
    const mergedClass = child.props.className 
      ? `${child.props.className} ${className || ''}` 
      : className;

    return React.cloneElement(child, {
      // 1. 传递禁用状态
      disabled: disabled || child.props.disabled,
      // 2. 合并点击事件
      onClick: (e: React.MouseEvent) => {
        if (typeof child.props.onClick === 'function') {
          child.props.onClick(e);
        }
        handleClick(e);
      },
      // 3. 传递 ref（修复 RefObject 错误）
      ref: (el: HTMLElement | null) => {
        triggerRef.current = el;
        // 安全处理子组件的 ref
        if (typeof child.props.ref === 'function') {
          child.props.ref(el);
        } else if (child.props.ref && typeof child.props.ref === 'object') {
          // 使用 MutableRefObject 替代 RefObject（兼容 React 18+）
          (child.props.ref as MutableRefObject<HTMLElement | null>).current = el;
        }
      },
      // 4. 传递合并后的样式
      className: mergedClass,
    });
  }

  // 默认按钮
  return (
    <button
      ref={triggerRef as MutableRefObject<HTMLButtonElement | null>}
      type="button"
      className={`px-4 py-2 rounded-md bg-blue-600 text-white hover:bg-blue-700 ${className || ''}`}
      onClick={handleClick}
      disabled={disabled}
    >
      {children}
    </button>
  );
}

// DialogContent：简化实现
export function DialogContent({
  className,
  children,
  dismissible = true,
  style,
  id,
  onClose,
}: DialogContentProps & { onClose?: () => void }) {
  return (
    <div 
      className={`flex flex-col ${className || ''}`} 
      onClick={(e) => e.stopPropagation()}
      style={style}
      id={id}
    >
      {dismissible && onClose && (
        <button
          type="button"
          className="absolute top-4 right-4 p-1 rounded-full hover:bg-gray-100 text-gray-500 z-10"
          onClick={(e) => {
            e.stopPropagation();
            onClose();
          }}
          aria-label="关闭对话框"
        >
          <X size={18} />
        </button>
      )}
      {children}
    </div>
  );
}

// 其他子组件（保持无扩展运算符）
export function DialogHeader({ className, children, id }: DialogHeaderProps) {
  return (
    <div 
      className={`px-6 py-6 border-b ${className || ''}`}
      id={id}
    >
      {children}
    </div>
  );
}

export function DialogTitle({ className, children, id }: DialogTitleProps) {
  return (
    <h3 
      className={`text-xl font-semibold text-gray-900 mb-2 ${className || ''}`}
      id={id}
    >
      {children}
    </h3>
  );
}

export function DialogDescription({ className, children, id }: DialogDescriptionProps) {
  return (
    <p 
      className={`text-sm text-gray-500 ${className || ''}`}
      id={id}
    >
      {children}
    </p>
  );
}

export function DialogFooter({ className, children, id }: DialogFooterProps) {
  return (
    <div 
      className={`px-6 py-4 border-t flex justify-end space-x-3 ${className || ''}`}
      id={id}
    >
      {children}
    </div>
  );
}