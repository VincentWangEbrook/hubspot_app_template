import { Logger } from '@nestjs/common';
import { handleCommonException } from '../error-handler.util';

/**
 * 多租户专用异常处理工具（依赖 tenantId）
 * @param logger - Logger 实例
 * @param tenantId - 租户 ID
 * @param err - 捕获的异常（unknown 类型）
 * @param action - 操作描述（如 "查询 HubSpot 联系人"）
 * @param options - 可选配置（继承通用工具的配置）
 * @returns 抛出标准化 Error（包含租户信息）
 */
export function handleTenantException(
  logger: Logger,
  tenantId: string,
  err: unknown,
  action: string,
  options?: Parameters<typeof handleCommonException>[3],
): never {
  // 复用通用异常处理的核心逻辑，仅扩展租户相关信息
  return handleCommonException(
    logger,
    err,
    `租户 ${tenantId} ${action}`, // 增强操作描述，包含租户 ID
    {
      // 自定义错误信息默认包含租户 ID
      customMessage: options?.customMessage || `${action} 失败（租户：${tenantId}）`,
      onSpecialError: options?.onSpecialError,
    },
  );
}