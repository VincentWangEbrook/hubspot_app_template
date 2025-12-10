import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface AuditLogEntry {
  userId: string;
  action: string;
  resource: string;
  resourceId?: string;
  tenantId?: string;
  details?: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
}

export interface AuditLogDto {
  id: string;
  userId: string;
  action: string;
  resource: string;
  resourceId: string | null;
  tenantId: string | null;
  details: any;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: Date;
  user?: {
    id: string;
    email: string;
    username: string;
  };
}

export interface AuditLogQueryOptions {
  userId?: string;
  tenantId?: string;
  resource?: string;
  action?: string;
  startDate?: Date;
  endDate?: Date;
  page?: number;
  pageSize?: number;
}

// 审计操作类型
export const AuditActions = {
  // 用户操作
  USER_LOGIN: 'user:login',
  USER_LOGOUT: 'user:logout',
  USER_CREATE: 'user:create',
  USER_UPDATE: 'user:update',
  USER_DELETE: 'user:delete',
  USER_PASSWORD_CHANGE: 'user:password_change',
  USER_PASSWORD_RESET: 'user:password_reset',
  
  // 角色操作
  ROLE_CREATE: 'role:create',
  ROLE_UPDATE: 'role:update',
  ROLE_DELETE: 'role:delete',
  ROLE_ASSIGN: 'role:assign',
  ROLE_REVOKE: 'role:revoke',
  
  // 租户操作
  TENANT_CREATE: 'tenant:create',
  TENANT_UPDATE: 'tenant:update',
  TENANT_DELETE: 'tenant:delete',
  
  // 成员操作
  MEMBER_ADD: 'member:add',
  MEMBER_REMOVE: 'member:remove',
  MEMBER_ROLE_CHANGE: 'member:role_change',
  
  // 紧急访问
  EMERGENCY_REQUEST: 'emergency:request',
  EMERGENCY_APPROVE: 'emergency:approve',
  EMERGENCY_REJECT: 'emergency:reject',
  EMERGENCY_ACCESS: 'emergency:access',
  
  // HubSpot
  HUBSPOT_CONNECT: 'hubspot:connect',
  HUBSPOT_DISCONNECT: 'hubspot:disconnect',
  HUBSPOT_SYNC: 'hubspot:sync',
  
  // LINE
  LINE_MESSAGE_SEND: 'line:message_send',
} as const;

@Injectable()
export class AuditLogService {
  private readonly logger = new Logger(AuditLogService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * 记录审计日志
   */
  async log(entry: AuditLogEntry): Promise<void> {
    try {
      await this.prisma.auditLog.create({
        data: {
          userId: entry.userId,
          action: entry.action,
          resource: entry.resource,
          resourceId: entry.resourceId,
          tenantId: entry.tenantId,
          details: entry.details,
          ipAddress: entry.ipAddress,
          userAgent: entry.userAgent,
        },
      });

      this.logger.debug(`审计日志: ${entry.action} on ${entry.resource} by ${entry.userId}`);
    } catch (error) {
      // 审计日志记录失败不应影响业务流程
      this.logger.error(`审计日志记录失败: ${error}`);
    }
  }

  /**
   * 从请求中提取信息并记录审计日志
   */
  async logFromRequest(
    request: any,
    action: string,
    resource: string,
    resourceId?: string,
    tenantId?: string,
    details?: Record<string, any>,
  ): Promise<void> {
    const userId = request.session?.user?.id;
    if (!userId) {
      this.logger.warn(`无法记录审计日志: 用户未登录`);
      return;
    }

    await this.log({
      userId,
      action,
      resource,
      resourceId,
      tenantId,
      details,
      ipAddress: request.ip || request.headers?.['x-forwarded-for'] || request.connection?.remoteAddress,
      userAgent: request.headers?.['user-agent'],
    });
  }

  /**
   * 查询审计日志
   */
  async query(options: AuditLogQueryOptions): Promise<{
    data: AuditLogDto[];
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  }> {
    const page = options.page || 1;
    const pageSize = Math.min(options.pageSize || 20, 100);
    const skip = (page - 1) * pageSize;

    const where: any = {};

    if (options.userId) {
      where.userId = options.userId;
    }

    if (options.tenantId) {
      where.tenantId = options.tenantId;
    }

    if (options.resource) {
      where.resource = options.resource;
    }

    if (options.action) {
      where.action = options.action;
    }

    if (options.startDate || options.endDate) {
      where.createdAt = {};
      if (options.startDate) {
        where.createdAt.gte = options.startDate;
      }
      if (options.endDate) {
        where.createdAt.lte = options.endDate;
      }
    }

    const [data, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              email: true,
              username: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSize,
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    return {
      data,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  /**
   * 获取用户的操作历史
   */
  async getUserHistory(userId: string, limit = 50): Promise<AuditLogDto[]> {
    return this.prisma.auditLog.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  /**
   * 获取租户的操作历史
   */
  async getTenantHistory(tenantId: string, limit = 50): Promise<AuditLogDto[]> {
    return this.prisma.auditLog.findMany({
      where: { tenantId },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            username: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  /**
   * 获取资源的操作历史
   */
  async getResourceHistory(resource: string, resourceId: string, limit = 50): Promise<AuditLogDto[]> {
    return this.prisma.auditLog.findMany({
      where: { resource, resourceId },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            username: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  /**
   * 清理过期的审计日志
   * @param retentionDays 保留天数
   */
  async cleanup(retentionDays: number): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

    const result = await this.prisma.auditLog.deleteMany({
      where: {
        createdAt: { lt: cutoffDate },
      },
    });

    this.logger.log(`清理了 ${result.count} 条过期审计日志`);
    return result.count;
  }
}

