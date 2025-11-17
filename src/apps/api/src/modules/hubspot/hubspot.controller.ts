/**
 * Developed by eBrook Group.
 * Copyright © 2025 eBrook Group (https://www.ebrook.com.tw)
 */

import { Controller, Get, Post, Body, Query, UseGuards, Req, ForbiddenException } from '@nestjs/common';
import { HubSpotService } from './hubspot.service';
import { HubSpotContact, ApiResponse } from '@hubspot-app/shared/types/hubspot.types';
import { Roles } from '../../common/security/roles.decorator';
import { RolesGuard } from '../../common/security/roles.guard';
import { TenantService } from '../tenant/tenant.service';
import { FastifyRequest as Request } from 'fastify';

@Controller('api/hubspot')
export class HubSpotController {
  constructor(private readonly hubspotService: HubSpotService, private readonly tenants: TenantService) {}

  @Get('contacts')
  @UseGuards(RolesGuard)
  @Roles('admin', 'user')
  async getContacts(@Query('tenantId') tenantId: string, @Req() req: Request): Promise<ApiResponse<HubSpotContact[]>> {
    const user = (req as any).user;
    if (user?.sub) {
      const allowed = await this.tenants.isMemberOrOwner(tenantId, user.sub);
      if (!allowed) throw new ForbiddenException('无权访问该租户');
    }
    return this.hubspotService.getContacts(tenantId);
  }

  @Post('contacts')
  @UseGuards(RolesGuard)
  @Roles('admin')
  async createContact(
    @Query('tenantId') tenantId: string,
    @Body() contactData: Omit<HubSpotContact['properties'], 'createdate'>,
    @Req() req: Request,
  ): Promise<ApiResponse<HubSpotContact>> {
    const user = (req as any).user;
    if (user?.sub) {
      const allowed = await this.tenants.isMemberOrOwner(tenantId, user.sub);
      if (!allowed) throw new ForbiddenException('无权访问该租户');
    }
    return this.hubspotService.createContact(tenantId, contactData);
  }

  @Post('sync')
  @UseGuards(RolesGuard)
  @Roles('admin')
  async syncContacts(@Query('tenantId') tenantId: string, @Req() req: Request) {
    const user = (req as any).user;
    if (user?.sub) {
      const allowed = await this.tenants.isMemberOrOwner(tenantId, user.sub);
      if (!allowed) throw new ForbiddenException('无权访问该租户');
    }
    // Reuse getContacts which also mirrors to tenant schema
    const res = await this.hubspotService.getContacts(tenantId);
    return { success: res.success, message: res.message ?? 'Sync completed', count: res.data?.length ?? 0 };
  }
}
