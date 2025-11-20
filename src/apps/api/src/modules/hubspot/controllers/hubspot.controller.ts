/**
 * Developed by eBrook Group.
 * Copyright © 2025 eBrook Group (https://www.ebrook.com.tw)
 */

import { Controller, Get, Post, Body, Query, UseGuards, Req, Res, ForbiddenException } from '@nestjs/common';
import { HubspotService } from '../services/hubspot.service';
import { HubspotContact, ApiResponse } from '@hubspot-app/shared/types/hubspot.types';
import { Roles } from '../../../common/security/roles.decorator';
import { RolesGuard } from '../../../common/security/roles.guard';
import { TenantService } from '../../tenants/services/tenant.service';
import { FastifyRequest, FastifyReply } from 'fastify';

@Controller('api/hubspot')
export class HubspotController {
  constructor(private readonly hubspotService: HubspotService, private readonly tenants: TenantService) {}

  @Get('contacts')
  @UseGuards(RolesGuard)
  @Roles('admin', 'user')
  async getContacts(
    @Query('tenantId') tenantId: string,
    @Req() req: FastifyRequest,
    @Res() res: FastifyReply,
  ): Promise<ApiResponse<HubspotContact[]>> {
    const user = (req as any).user;
    if (user?.sub) {
      const allowed = await this.tenants.isMemberOrOwner(tenantId, user.sub);
      if (!allowed) throw new ForbiddenException('无权访问该租户');
    }

    const contacts = this.hubspotService.getContacts(tenantId);
    return res.send({ success: true, data: contacts });
  }

  @Post('contacts')
  @UseGuards(RolesGuard)
  @Roles('admin')
  async createContact(
    @Query('tenantId') tenantId: string,
    @Req() req: FastifyRequest,
    @Body() contactData: Omit<HubspotContact['properties'], 'createdate'>,
    @Res() res: FastifyReply,
  ): Promise<ApiResponse<HubspotContact>> {
    const user = (req as any).user;
    if (user?.sub) {
      const allowed = await this.tenants.isMemberOrOwner(tenantId, user.sub);
      if (!allowed) throw new ForbiddenException('无权访问该租户');
    }
    const contantPropoerties =  this.hubspotService.createContact(tenantId, contactData);

    return res.send({ success: true, data: contantPropoerties });
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
    const contacts = await this.hubspotService.syncContacts(tenantId);
    return { success: true, data: contacts };
  }
}
