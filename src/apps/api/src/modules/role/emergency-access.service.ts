import { Injectable, Logger, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogService, AuditActions } from './audit-log.service';
import { PermissionService } from './permission.service';
import { CreateEmergencyAccessDto } from './dto/emergency-access.dto';

export interface EmergencyAccessRequestDto {
  id: string;
  requesterId: string;
  tenantId: string;
  reason: string;
  scope: string[];
  status: string;
  approverId: string | null;
  approvedAt: Date | null;
  expiresAt: Date;
  createdAt: Date;
  requester?: {
    id: string;
    email: string;
    username: string;
  };
  approver?: {
    id: string;
    email: string;
    username: string;
  } | null;
  tenant?: {
    id: string;
    name: string;
  };
}

@Injectable()
export class EmergencyAccessService {
  private readonly logger = new Logger(EmergencyAccessService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogService: AuditLogService,
    private readonly permissionService: PermissionService,
  ) {}

  /**
   * 创建紧急访问请求
   */
  async createRequest(
    requesterId: string,
    dto: CreateEmergencyAccessDto,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<EmergencyAccessRequestDto> {
    // 验证用户有 emergency:request 权限
    const hasPermission = await this.permissionService.hasPermission(requesterId, 'emergency:request');
    if (!hasPermission) {
      throw new ForbiddenException('您没有申请紧急访问的权限');
    }

    // 验证租户存在
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: dto.tenantId },
    });
    if (!tenant) {
      throw new NotFoundException('租户不存在');
    }

    // 检查是否有未处理的请求
    const pendingRequest = await this.prisma.emergencyAccessRequest.findFirst({
      where: {
        requesterId,
        tenantId: dto.tenantId,
        status: 'pending',
      },
    });
    if (pendingRequest) {
      throw new BadRequestException('您已有一个待审批的访问请求');
    }

    // 设置过期时间（默认 2 小时）
    const durationHours = dto.durationHours || 2;
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + durationHours);

    const request = await this.prisma.emergencyAccessRequest.create({
      data: {
        requesterId,
        tenantId: dto.tenantId,
        reason: dto.reason,
        scope: dto.scope,
        status: 'pending',
        expiresAt,
      },
      include: {
        requester: {
          select: { id: true, email: true, username: true },
        },
        tenant: {
          select: { id: true, name: true },
        },
      },
    });

    // 记录审计日志
    await this.auditLogService.log({
      userId: requesterId,
      action: AuditActions.EMERGENCY_REQUEST,
      resource: 'emergency_access',
      resourceId: request.id,
      tenantId: dto.tenantId,
      details: {
        reason: dto.reason,
        scope: dto.scope,
        durationHours,
      },
      ipAddress,
      userAgent,
    });

    this.logger.log(`紧急访问请求已创建: ${request.id}`);
    return request;
  }

  /**
   * 获取待审批的请求列表
   */
  async getPendingRequests(): Promise<EmergencyAccessRequestDto[]> {
    return this.prisma.emergencyAccessRequest.findMany({
      where: { status: 'pending' },
      include: {
        requester: {
          select: { id: true, email: true, username: true },
        },
        tenant: {
          select: { id: true, name: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * 获取请求详情
   */
  async getRequestById(id: string): Promise<EmergencyAccessRequestDto | null> {
    return this.prisma.emergencyAccessRequest.findUnique({
      where: { id },
      include: {
        requester: {
          select: { id: true, email: true, username: true },
        },
        approver: {
          select: { id: true, email: true, username: true },
        },
        tenant: {
          select: { id: true, name: true },
        },
      },
    });
  }

  /**
   * 审批请求
   */
  async approveRequest(
    requestId: string,
    approverId: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<EmergencyAccessRequestDto> {
    // 验证审批人有 emergency:approve 权限
    const hasPermission = await this.permissionService.hasPermission(approverId, 'emergency:approve');
    if (!hasPermission) {
      throw new ForbiddenException('您没有审批紧急访问的权限');
    }

    const request = await this.prisma.emergencyAccessRequest.findUnique({
      where: { id: requestId },
    });

    if (!request) {
      throw new NotFoundException('请求不存在');
    }

    if (request.status !== 'pending') {
      throw new BadRequestException('该请求已被处理');
    }

    // 不能自己审批自己的请求
    if (request.requesterId === approverId) {
      throw new BadRequestException('不能审批自己的请求');
    }

    const updated = await this.prisma.emergencyAccessRequest.update({
      where: { id: requestId },
      data: {
        status: 'approved',
        approverId,
        approvedAt: new Date(),
      },
      include: {
        requester: {
          select: { id: true, email: true, username: true },
        },
        approver: {
          select: { id: true, email: true, username: true },
        },
        tenant: {
          select: { id: true, name: true },
        },
      },
    });

    // 记录审计日志
    await this.auditLogService.log({
      userId: approverId,
      action: AuditActions.EMERGENCY_APPROVE,
      resource: 'emergency_access',
      resourceId: requestId,
      tenantId: request.tenantId,
      details: {
        requesterId: request.requesterId,
        reason: request.reason,
      },
      ipAddress,
      userAgent,
    });

    this.logger.log(`紧急访问请求已批准: ${requestId}`);
    return updated;
  }

  /**
   * 拒绝请求
   */
  async rejectRequest(
    requestId: string,
    approverId: string,
    rejectReason?: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<EmergencyAccessRequestDto> {
    // 验证审批人有 emergency:approve 权限
    const hasPermission = await this.permissionService.hasPermission(approverId, 'emergency:approve');
    if (!hasPermission) {
      throw new ForbiddenException('您没有审批紧急访问的权限');
    }

    const request = await this.prisma.emergencyAccessRequest.findUnique({
      where: { id: requestId },
    });

    if (!request) {
      throw new NotFoundException('请求不存在');
    }

    if (request.status !== 'pending') {
      throw new BadRequestException('该请求已被处理');
    }

    const updated = await this.prisma.emergencyAccessRequest.update({
      where: { id: requestId },
      data: {
        status: 'rejected',
        approverId,
        approvedAt: new Date(),
      },
      include: {
        requester: {
          select: { id: true, email: true, username: true },
        },
        approver: {
          select: { id: true, email: true, username: true },
        },
        tenant: {
          select: { id: true, name: true },
        },
      },
    });

    // 记录审计日志
    await this.auditLogService.log({
      userId: approverId,
      action: AuditActions.EMERGENCY_REJECT,
      resource: 'emergency_access',
      resourceId: requestId,
      tenantId: request.tenantId,
      details: {
        requesterId: request.requesterId,
        rejectReason,
      },
      ipAddress,
      userAgent,
    });

    this.logger.log(`紧急访问请求已拒绝: ${requestId}`);
    return updated;
  }

  /**
   * 检查用户是否有有效的紧急访问权限
   */
  async hasValidEmergencyAccess(userId: string, tenantId: string): Promise<boolean> {
    const now = new Date();
    
    const validAccess = await this.prisma.emergencyAccessRequest.findFirst({
      where: {
        requesterId: userId,
        tenantId,
        status: 'approved',
        expiresAt: { gt: now },
      },
    });

    return !!validAccess;
  }

  /**
   * 获取用户的紧急访问历史
   */
  async getUserRequests(userId: string): Promise<EmergencyAccessRequestDto[]> {
    return this.prisma.emergencyAccessRequest.findMany({
      where: { requesterId: userId },
      include: {
        approver: {
          select: { id: true, email: true, username: true },
        },
        tenant: {
          select: { id: true, name: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * 过期处理（定期运行）
   */
  async expireOldRequests(): Promise<number> {
    const now = new Date();

    const result = await this.prisma.emergencyAccessRequest.updateMany({
      where: {
        status: 'approved',
        expiresAt: { lt: now },
      },
      data: {
        status: 'expired',
      },
    });

    if (result.count > 0) {
      this.logger.log(`标记了 ${result.count} 个过期的紧急访问请求`);
    }

    return result.count;
  }
}

