import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
  Req,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { FastifyRequest } from 'fastify';
import { EmergencyAccessService, EmergencyAccessRequestDto } from './emergency-access.service';
import { PermissionGuard } from './guards/permission.guard';
import { RequirePermission } from './guards/permission.decorator';
import { CreateEmergencyAccessDto, RejectEmergencyAccessDto } from './dto/emergency-access.dto';

@Controller('api/emergency-access')
@UseGuards(PermissionGuard)
export class EmergencyAccessController {
  constructor(private readonly emergencyAccessService: EmergencyAccessService) {}

  /**
   * 创建紧急访问请求
   * POST /api/emergency-access/requests
   */
  @Post('requests')
  @RequirePermission('emergency:request')
  async createRequest(
    @Body() dto: CreateEmergencyAccessDto,
    @Req() req: FastifyRequest,
  ): Promise<{ success: boolean; data: EmergencyAccessRequestDto }> {
    const userId = req.session?.user?.id;
    if (!userId) {
      throw new ForbiddenException('请先登录');
    }

    const request = await this.emergencyAccessService.createRequest(
      userId,
      dto,
      req.ip,
      req.headers['user-agent'] as string,
    );

    return { success: true, data: request };
  }

  /**
   * 获取待审批的请求列表
   * GET /api/emergency-access/pending
   */
  @Get('pending')
  @RequirePermission('emergency:approve')
  async getPendingRequests(): Promise<{ success: boolean; data: EmergencyAccessRequestDto[] }> {
    const requests = await this.emergencyAccessService.getPendingRequests();
    return { success: true, data: requests };
  }

  /**
   * 获取我的请求历史
   * GET /api/emergency-access/my-requests
   */
  @Get('my-requests')
  @RequirePermission('emergency:request')
  async getMyRequests(
    @Req() req: FastifyRequest,
  ): Promise<{ success: boolean; data: EmergencyAccessRequestDto[] }> {
    const userId = req.session?.user?.id;
    if (!userId) {
      throw new ForbiddenException('请先登录');
    }

    const requests = await this.emergencyAccessService.getUserRequests(userId);
    return { success: true, data: requests };
  }

  /**
   * 获取请求详情
   * GET /api/emergency-access/requests/:id
   */
  @Get('requests/:id')
  @RequirePermission('emergency:request')
  async getRequestById(
    @Param('id') id: string,
  ): Promise<{ success: boolean; data: EmergencyAccessRequestDto }> {
    const request = await this.emergencyAccessService.getRequestById(id);
    if (!request) {
      throw new NotFoundException('请求不存在');
    }
    return { success: true, data: request };
  }

  /**
   * 审批请求
   * POST /api/emergency-access/requests/:id/approve
   */
  @Post('requests/:id/approve')
  @RequirePermission('emergency:approve')
  async approveRequest(
    @Param('id') id: string,
    @Req() req: FastifyRequest,
  ): Promise<{ success: boolean; data: EmergencyAccessRequestDto; message: string }> {
    const userId = req.session?.user?.id;
    if (!userId) {
      throw new ForbiddenException('请先登录');
    }

    const request = await this.emergencyAccessService.approveRequest(
      id,
      userId,
      req.ip,
      req.headers['user-agent'] as string,
    );

    return {
      success: true,
      data: request,
      message: '请求已批准',
    };
  }

  /**
   * 拒绝请求
   * POST /api/emergency-access/requests/:id/reject
   */
  @Post('requests/:id/reject')
  @RequirePermission('emergency:approve')
  async rejectRequest(
    @Param('id') id: string,
    @Body() dto: RejectEmergencyAccessDto,
    @Req() req: FastifyRequest,
  ): Promise<{ success: boolean; data: EmergencyAccessRequestDto; message: string }> {
    const userId = req.session?.user?.id;
    if (!userId) {
      throw new ForbiddenException('请先登录');
    }

    const request = await this.emergencyAccessService.rejectRequest(
      id,
      userId,
      dto.rejectReason,
      req.ip,
      req.headers['user-agent'] as string,
    );

    return {
      success: true,
      data: request,
      message: '请求已拒绝',
    };
  }

  /**
   * 检查是否有有效的紧急访问权限
   * GET /api/emergency-access/check/:tenantId
   */
  @Get('check/:tenantId')
  @RequirePermission('emergency:request')
  async checkAccess(
    @Param('tenantId') tenantId: string,
    @Req() req: FastifyRequest,
  ): Promise<{ success: boolean; hasAccess: boolean }> {
    const userId = req.session?.user?.id;
    if (!userId) {
      throw new ForbiddenException('请先登录');
    }

    const hasAccess = await this.emergencyAccessService.hasValidEmergencyAccess(userId, tenantId);
    return { success: true, hasAccess };
  }
}

