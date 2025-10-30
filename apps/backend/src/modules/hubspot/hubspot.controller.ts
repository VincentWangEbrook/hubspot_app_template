/**
 * Developed by eBrook Group.
 * Copyright © 2025 eBrook Group (https://www.ebrook.com.tw)
 */


import { Controller, Get, Post, Body, Query } from '@nestjs/common';
import { HubSpotService } from './hubspot.service';
import { HubSpotContact, ApiResponse } from '@hubspot-app/shared/types/hubspot.types';

@Controller('api/hubspot')
export class HubSpotController {
  constructor(private readonly hubspotService: HubSpotService) {}

  @Get('contacts')
  async getContacts(@Query('tenantId') tenantId: string): Promise<ApiResponse<HubSpotContact[]>> {
    return this.hubspotService.getContacts(tenantId);
  }

  @Post('contacts')
  async createContact(
    @Query('tenantId') tenantId: string,
    @Body() contactData: Omit<HubSpotContact['properties'], 'createdate'>
  ): Promise<ApiResponse<HubSpotContact>> {
    return this.hubspotService.createContact(tenantId, contactData);
  }
}
