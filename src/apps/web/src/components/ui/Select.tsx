'use client';
import React, { useState, useRef, useEffect, ReactNode, MutableRefObject, forwardRef, isValidElement } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';

// 核心类型定义
interface SelectProps {
  value?: string;
  onValueChange?: (value: string) => void;
  disabled?: boolean;
  className?: string;
  children: ReactNode;
  name?: string;
  placeholder?: string;
}

interface SelectTriggerProps extends React.HTMLAttributes<HTMLDivElement> {
  disabled?: boolean;
  className?: string;
  children: ReactNode;
  name?: string;
  'aria-expanded'?: boolean;
}

interface SelectContentProps extends React.HTMLAttributes<HTMLDivElement> {
  className?: string;
  children: React.ReactNode;
  'aria-hidden'?: boolean;
}

// 明确 SelectValueProps 所有属性
interface SelectValueProps extends React.HTMLAttributes<HTMLSpanElement> {
  placeholder?: string;
  className?: string;
  value?: string;
}

interface SelectItemProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  value: string;
  className?: string;
  children: ReactNode;
  disabled?: boolean;
  'data-selected'?: boolean;
}

// 核心 Select 容器组件
export function Select({
  value,
  onValueChange,
  disabled = false,
  className,
  children,
  name,
  placeholder,
}: SelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const triggerRef = useRef<HTMLDivElement | null>(null) as MutableRefObject<HTMLDivElement | null>;
  const contentRef = useRef<HTMLDivElement | null>(null) as MutableRefObject<HTMLDivElement | null>;

  // 点击外部关闭下拉框
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        triggerRef.current &&
        contentRef.current &&
        !triggerRef.current.contains(e.target as Node) &&
        !contentRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // 切换下拉框展开/收起
  const toggleOpen = () => {
    if (!disabled) setIsOpen(!isOpen);
  };

  // 处理选项点击
  const handleItemClick = (itemValue: string) => {
    if (value !== itemValue && onValueChange) {
      onValueChange(itemValue);
    }
    setIsOpen(false);
  };

  return (
    <div className={`relative inline-block w-full ${className}`}>
      <SelectTrigger
        ref={triggerRef}
        onClick={toggleOpen}
        disabled={disabled}
        aria-expanded={isOpen}
        name={name}
      >
        {React.Children.map(children, (child) => {
          // 严格类型守卫：确保是 SelectValue 组件
          if (isValidElement(child) && child.type === SelectValue) {
            // 断言为 SelectValue 组件类型，明确 props 结构
            const selectValueChild = child as React.ReactElement<SelectValueProps>;
            // 安全取值：使用可选链+空值合并，避免 undefined 报错
            const childPlaceholder = selectValueChild.props?.placeholder;
            const finalPlaceholder = childPlaceholder ?? placeholder ?? '请选择';
            
            return React.cloneElement(selectValueChild, {
              value,
              placeholder: finalPlaceholder,
            });
          }
          return child;
        })}
        {/* 隐藏的 input 用于表单提交 */}
        {name && (
          <input
            type="hidden"
            name={name}
            value={value || ''}
            disabled={disabled}
          />
        )}
      </SelectTrigger>

      {isOpen && (
        <SelectContent
          ref={contentRef}
          aria-hidden={!isOpen}
        >
          {React.Children.map(children, (child) => {
            // 严格类型守卫：确保是 SelectItem 组件
            if (isValidElement(child) && child.type === SelectItem) {
              const selectItemChild = child as React.ReactElement<SelectItemProps>;
              return React.cloneElement(selectItemChild, {
                onClick: () => handleItemClick(selectItemChild.props.value),
                disabled: disabled || selectItemChild.props.disabled,
                'data-selected': value === selectItemChild.props.value,
              });
            }
            return child;
          })}
        </SelectContent>
      )}
    </div>
  );
}

// SelectTrigger：forwardRef 组件
export const SelectTrigger = forwardRef<HTMLDivElement, SelectTriggerProps>(
  ({ disabled = false, className, children, name, 'aria-expanded': ariaExpanded, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={`
          flex items-center justify-between px-3 py-2 border rounded-md
          bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500
          focus:border-transparent ${disabled ? 'opacity-50 cursor-not-allowed' : 'hover:border-gray-400'}
          ${className || ''}
        `}
        onClick={props.onClick}
        aria-expanded={ariaExpanded}
      >
        {children}
        {disabled ? (
          <ChevronDown size={16} className="text-gray-400" />
        ) : (
          ariaExpanded ? <ChevronUp size={16} className="text-gray-600" /> : <ChevronDown size={16} className="text-gray-600" />
        )}
      </div>
    );
  }
);

// SelectContent：forwardRef 组件
export const SelectContent = forwardRef<HTMLDivElement, SelectContentProps>(
  ({ className, children, 'aria-hidden': ariaHidden, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={`
          absolute top-full left-0 right-0 mt-1 max-h-60 overflow-y-auto
          bg-white border rounded-md shadow-lg z-10
          focus:outline-none ${className || ''}
        `}
        aria-hidden={ariaHidden}
        {...props}
      >
        {children}
      </div>
    );
  }
);

// SelectValue：明确接收所有属性
export function SelectValue({
  placeholder = '请选择',
  className,
  value,
  ...props
}: SelectValueProps) {
  return (
    <span
      className={`text-sm ${value ? 'text-gray-900' : 'text-gray-500'} ${className || ''}`}
      {...props}
    >
      {value || placeholder}
    </span>
  );
}

// SelectItem：明确接收所有属性
export function SelectItem({
  value,
  className,
  children,
  disabled = false,
  'data-selected': isSelected = false,
  ...props
}: SelectItemProps) {
  return (
    <button
      type="button"
      value={value}
      disabled={disabled}
      className={`
        w-full text-left px-3 py-2 text-sm transition-colors
        ${disabled ? 'text-gray-400 cursor-not-allowed' : ''}
        ${isSelected ? 'bg-blue-50 text-blue-700' : 'text-gray-700 hover:bg-gray-100'}
        ${className || ''}
      `}
      onClick={props.onClick}
      data-selected={isSelected}
    >
      {children}
    </button>
  );
}