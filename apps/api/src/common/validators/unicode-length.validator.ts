/**
 * Developed by eBrook Group.
 * Copyright © 2025 eBrook Group (https://www.ebrook.com.tw)
 */

import {
  registerDecorator,
  ValidationOptions,
  ValidationArguments,
} from 'class-validator';

/**
 * 🐛 修复: 自定义验证器，正确处理 Unicode 字符（包括 Emoji）的长度
 * 使用 Array.from 将字符串转换为真实的字符数组
 */
export function MaxUnicodeLength(
  maxLength: number,
  validationOptions?: ValidationOptions,
) {
  return function (object: Object, propertyName: string) {
    registerDecorator({
      name: 'maxUnicodeLength',
      target: object.constructor,
      propertyName: propertyName,
      constraints: [maxLength],
      options: validationOptions,
      validator: {
        validate(value: any, args: ValidationArguments) {
          if (typeof value !== 'string') {
            return false;
          }
          
          // 使用 Array.from 正确计算 Unicode 字符数（包括 Emoji）
          const actualLength = Array.from(value).length;
          const [max] = args.constraints;
          
          return actualLength <= max;
        },
        defaultMessage(args: ValidationArguments) {
          const [max] = args.constraints;
          return `$property must not be longer than ${max} characters (Unicode aware)`;
        },
      },
    });
  };
}

/**
 * 辅助函数：获取字符串的真实 Unicode 字符数
 */
export function getUnicodeLength(str: string): number {
  return Array.from(str).length;
}

/**
 * 辅助函数：安全截断字符串，不破坏 Unicode 字符（如 Emoji）
 */
export function safeSubstring(str: string, maxLength: number): string {
  const chars = Array.from(str);
  if (chars.length <= maxLength) {
    return str;
  }
  return chars.slice(0, maxLength).join('');
}
