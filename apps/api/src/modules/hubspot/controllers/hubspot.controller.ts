/**
 * Developed by eBrook Group.
 * Copyright © 2025 eBrook Group (https://www.ebrook.com.tw)
 */

import { Controller, Get, Post, Put, Delete, Body, Query, Param, UseGuards, Req, Res } from '@nestjs/common';
import { HubspotService } from '../services/hubspot.service';
import { HubspotContact, ApiResponse } from '@hubspot-app/shared/types/hubspot.types';
import { TenantMemberGuard } from '../../../common/security/tenant-member.guard';
import { FastifyRequest, FastifyReply } from 'fastify';
import { ContactFiltersDto, CreateContactDto, UpdateContactDto } from '../dtos/contact.dto';

@Controller('api/hubspot')
@UseGuards(TenantMemberGuard)
export class HubspotController {
  constructor(private readonly hubspotService: HubspotService) {}

  /**
   * Get contacts from tenant database with pagination and filtering
   */
  @Get('contacts')
  async getContacts(
    @Query() allParams: ContactFiltersDto & { tenantId: string },
    @Res() res: FastifyReply,
  ) {
    const { tenantId, ...filters } = allParams;
    const result = await this.hubspotService.getContactsFromDb(tenantId, filters);
    return res.send({ success: true, data: result });
  }

  /**
   * Get contact by ID
   */
  @Get('contacts/:id')
  async getContactById(
    @Query('tenantId') tenantId: string,
    @Param('id') id: string,
    @Res() res: FastifyReply,
  ) {
    const contact = await this.hubspotService.getContactByIdFromDb(tenantId, id);
    if (!contact) {
      return res.status(404).send({ success: false, message: 'Contact not found' });
    }
    return res.send({ success: true, data: contact });
  }

  /**
   * Create new contact
   */
  @Post('contacts')
  async createContact(
    @Query('tenantId') tenantId: string,
    @Body() contactData: CreateContactDto,
    @Res() res: FastifyReply,
  ): Promise<ApiResponse<HubspotContact>> {
    const contact = await this.hubspotService.createContact(tenantId, contactData as any);
    
    // Also save to tenant database
    await this.hubspotService.saveContactsToDb(tenantId, [contact]);
    
    return res.send({ success: true, data: contact });
  }

  /**
   * Update contact
   */
  @Put('contacts/:id')
  async updateContact(
    @Param('id') id: string,
    @Query('tenantId') tenantId: string,
    @Body() updateData: UpdateContactDto,
    @Res() res: FastifyReply,
  ) {
    const contact = await this.hubspotService.updateContactInDb(tenantId, id, updateData);
    return res.send({ success: true, data: contact });
  }

  /**
   * Delete contact (soft delete)
   */
  @Delete('contacts/:id')
  async deleteContact(
    @Param('id') id: string,
    @Query('tenantId') tenantId: string,
    @Res() res: FastifyReply,
  ) {
    await this.hubspotService.deleteContactFromDb(tenantId, id);
    return res.send({ success: true, message: 'Contact deleted successfully' });
  }

  /**
   * Search contacts
   */
  @Get('contacts/search')
  async searchContacts(
    @Query('tenantId') tenantId: string,
    @Query('q') query: string,
    @Res() res: FastifyReply,
  ) {
    const contacts = await this.hubspotService.searchContacts(tenantId, query);
    return res.send({ success: true, data: contacts });
  }

  /**
   * Sync contacts from HubSpot (manual trigger)
   */
  @Post('sync')
  async syncContacts(
    @Query('tenantId') tenantId: string,
    @Res() res: FastifyReply,
  ) {
    const contacts = await this.hubspotService.syncContacts(tenantId);
    return res.send({ success: true, data: contacts, count: contacts.length });
  }

  /**
   * Trigger full sync (background job)
   */
  @Post('sync/full')
  async triggerFullSync(
    @Query('tenantId') tenantId: string,
    @Res() res: FastifyReply,
  ) {
    const result = await this.hubspotService.triggerFullSync(tenantId);
    return res.send(result);
  }

  /**
   * Get sync history
   */
  @Get('sync/history')
  async getSyncHistory(
    @Query('tenantId') tenantId: string,
    @Query('limit') limit: number = 10,
    @Res() res: FastifyReply,
  ) {
    const history = await this.hubspotService.getSyncHistory(tenantId, limit || 10);
    return res.send({ success: true, data: history });
  }

  /**
   * Get sync status
   */
  @Get('sync/status')
  async getSyncStatus(
    @Query('tenantId') tenantId: string,
    @Res() res: FastifyReply,
  ) {
    const status = await this.hubspotService.getSyncStatus(tenantId);
    return res.send({ success: true, data: status });
  }

  // ========== Companies Endpoints ==========

  /**
   * Sync companies from HubSpot (manual trigger)
   */
  @Post('companies/sync')
  async syncCompanies(
    @Query('tenantId') tenantId: string,
    @Res() res: FastifyReply,
  ) {
    const companies = await this.hubspotService.syncCompanies(tenantId);
    return res.send({ success: true, data: companies, count: companies.length });
  }

  /**
   * Get companies from tenant database with pagination and filtering
   */
  @Get('companies')
  async getCompanies(
    @Query() allParams: any,
    @Res() res: FastifyReply,
  ) {
    const { tenantId, ...filters } = allParams;
    const result = await this.hubspotService.getCompaniesFromDb(tenantId, filters);
    return res.send({ success: true, data: result });
  }

  /**
   * Get company by ID
   */
  @Get('companies/:id')
  async getCompanyById(
    @Query('tenantId') tenantId: string,
    @Param('id') id: string,
    @Res() res: FastifyReply,
  ) {
    const company = await this.hubspotService.getCompanyByIdFromDb(tenantId, id);
    if (!company) {
      return res.status(404).send({ success: false, message: 'Company not found' });
    }
    return res.send({ success: true, data: company });
  }

  /**
   * Get companies sync status
   */
  @Get('companies/sync/status')
  async getCompaniesSyncStatus(
    @Query('tenantId') tenantId: string,
    @Res() res: FastifyReply,
  ) {
    const status = await this.hubspotService.getSyncStatus(tenantId, 'companies');
    return res.send({ success: true, data: status });
  }
}
