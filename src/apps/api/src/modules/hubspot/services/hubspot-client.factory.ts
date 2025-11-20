import { Injectable } from '@nestjs/common';
import { Client } from '@hubspot/api-client';
import { TenantService } from '../../tenants/services/tenant.service';

@Injectable()
export class HubspotClientFactory {
  private clientCache = new Map<string, Client>();

  constructor(private readonly tenantService: TenantService) {}

  async getClient(tenantId: string): Promise<Client> {
    if (this.clientCache.has(tenantId)) return this.clientCache.get(tenantId)!;

    const tenant = await this.tenantService.getTenant({ id: tenantId });
    if (!tenant) throw new Error(`Tenant ${tenantId} not found`);
    // tenant.hubspotAccessToken may be encrypted; TenantService.getTenant() should already decrypt
    const token = (tenant as any).hubspotAccessToken;
    if (!token) throw new Error(`Tenant ${tenantId} missing HubSpot token`);

    const client = new Client({ accessToken: token });
    this.clientCache.set(tenantId, client);
    return client;
  }

  clearCache(tenantId?: string) {
    if (tenantId) this.clientCache.delete(tenantId);
    else this.clientCache.clear();
  }
}
