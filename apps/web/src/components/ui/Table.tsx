import React from 'react';

// 类型定义
interface TableProps extends React.HTMLAttributes<HTMLTableElement> {
  className?: string;
  children: React.ReactNode;
}

interface TableHeaderProps extends React.HTMLAttributes<HTMLTableSectionElement> {
  className?: string;
  children: React.ReactNode;
}

interface TableBodyProps extends React.HTMLAttributes<HTMLTableSectionElement> {
  className?: string;
  children: React.ReactNode;
}

interface TableRowProps extends React.HTMLAttributes<HTMLTableRowElement> {
  className?: string;
  children: React.ReactNode;
  disabled?: boolean;
}

interface TableHeadProps extends React.HTMLAttributes<HTMLTableCellElement> {
  className?: string;
  children: React.ReactNode;
}

interface TableCellProps extends React.HTMLAttributes<HTMLTableCellElement> {
  className?: string;
  children: React.ReactNode;
}

// 表格容器
export function Table({ className, children, ...props }: TableProps) {
  return (
    <table className={`w-full border-collapse ${className}`} {...props}>
      {children}
    </table>
  );
}

// 表头区域（<thead>）
export function TableHeader({ className, children, ...props }: TableHeaderProps) {
  return (
    <thead className={`${className}`} {...props}>
      {children}
    </thead>
  );
}

// 表体区域（<tbody>）
export function TableBody({ className, children, ...props }: TableBodyProps) {
  return (
    <tbody className={`${className}`} {...props}>
      {children}
    </tbody>
  );
}

// 表格行（<tr>）
export function TableRow({ className, children, disabled = false, ...props }: TableRowProps) {
  return (
    <tr
      className={`
        ${disabled ? 'opacity-50 cursor-not-allowed' : 'hover:bg-gray-50'}
        transition-colors ${className}
      `}
      {...props}
    >
      {children}
    </tr>
  );
}

// 表头单元格（<th>）
export function TableHead({ className, children, ...props }: TableHeadProps) {
  return (
    <th
      className={`
        px-4 py-3 text-left text-sm font-semibold text-gray-700
        border-b bg-gray-50 ${className}
      `}
      {...props}
    >
      {children}
    </th>
  );
}

// 表体单元格（<td>）
export function TableCell({ className, children, ...props }: TableCellProps) {
  return (
    <td
      className={`
        px-4 py-3 text-sm text-gray-700 border-b
        ${className}
      `}
      {...props}
    >
      {children}
    </td>
  );
}