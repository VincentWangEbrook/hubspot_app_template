import { Logger } from '@nestjs/common';

/**
 * 全局通用异常处理工具（无多租户依赖）
 * @param logger - Logger 实例
 * @param err - 捕获的异常（unknown 类型）
 * @param action - 操作描述（如 "查询用户"）
 * @param options - 可选配置（自定义错误信息、特殊异常处理）
 * @returns 抛出标准化 Error
 */
export function handleCommonException(
  logger: Logger,
  err: unknown,
  action: string,
  options?: {
    customMessage?: string;
    onSpecialError?: (err: Error) => void;
  },
): never {
  const { customMessage, onSpecialError } = options || {};
  const errorMsg = `${action} 失败`;

  // 分类型记录日志
  if (err instanceof Error) {
    // 支持特殊异常处理（如令牌过期、权限不足）
    onSpecialError?.(err);
    logger.error(`${errorMsg}: ${err.message}`, err.stack);
  } else {
    logger.error(`${errorMsg}: ${String(err)}`);
  }

  // 抛出标准化错误
  const finalMessage = customMessage || `${action} 失败`;
  throw new Error(finalMessage);
}