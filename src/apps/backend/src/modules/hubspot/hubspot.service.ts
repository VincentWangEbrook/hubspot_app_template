/**
 * Developed by eBrook Group.
 * Copyright © 2025 eBrook Group (https://www.ebrook.com.tw)
 */

import { Injectable, Logger } from '@nestjs/common';
import { Client } from '@hubspot/api-client';
import { HubSpotContact, ApiResponse } from '@hubspot-app/shared/types/hubspot.types';
import { TenantService } from '../tenant/tenant.service';
import { TenantDbService } from '../tenant/tenant-db.service';

@Injectable()
export class HubSpotService {
  private readonly logger = new Logger(HubSpotService.name);
  private client?: Client;

  constructor(
    private readonly tenantService: TenantService,
    private readonly tenantDb: TenantDbService,
  ) {}

  private async getClient(tenantId: string) {
    if (!tenantId) {
      this.logger.error('Missing tenantId');
      throw new Error('Missing tenantId');
    } 
    const tenant = await this.tenantService.getTenant( {id: tenantId} );
    if (!tenant?.hubspotAccessToken) throw new Error('HubSpot token not found');
    return new Client({ accessToken: tenant.hubspotAccessToken });
  }

  async getContacts(tenantId: string): Promise<ApiResponse<HubSpotContact[]>> {
    try {
      const client = await this.getClient(tenantId);
      const resp = await client.crm.contacts.basicApi.getPage();
      // optional: mirror into per-tenant schema
      await this.tenantDb.ensureSchema(tenantId);
      await this.tenantDb.runInTenantSchema(tenantId, async (runner) => {
        const inserts = resp.results.map((c) => (
          runner.query(
            `INSERT INTO contacts (id, email, properties, synced_at)
             VALUES ($1, $2, $3, now())
             ON CONFLICT (id) DO UPDATE SET email=EXCLUDED.email, properties=EXCLUDED.properties, synced_at=now()`,
            [c.id, (c as any).properties?.email ?? null, JSON.stringify(c)]
          )
        ));
        await Promise.all(inserts);
      });
      return { success: true, data: resp.results };
    } catch (error) {
      this.logger.error('Error fetching contacts', error);
      return { success: false, message: 'Failed to fetch contacts' };
    }
  }

  async createContact(tenantId: string, properties: HubSpotContact['properties']): Promise<ApiResponse<HubSpotContact>> {
    try {
      const client = await this.getClient(tenantId);
      const resp = await client.crm.contacts.basicApi.create({ properties });
      return { success: true, data: resp };
    } catch (error) {
      this.logger.error('Error creating contact', error);
      return { success: false, message: 'Failed to create contact' };
    }
  }
}
