import { Injectable, UnauthorizedException, Logger } from '@nestjs/common';
import { Client } from '@hubspot/api-client';
import { TenantService } from '../../tenants/services/tenant.service';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class HubspotClientFactory {
  private readonly logger = new Logger(HubspotClientFactory.name);
  private clientCache = new Map<string, { client: Client; expiresAt: number }>();

  constructor(
    private readonly tenantService: TenantService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Get HubSpot client for tenant with automatic token refresh
   */
  async getClient(tenantId: string): Promise<Client> {
    // Check if we have a valid cached client
    const cached = this.clientCache.get(tenantId);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.client;
    }

    // Get tenant with tokens
    const tenant = await this.tenantService.getTenant({ id: tenantId });
    if (!tenant) {
      throw new UnauthorizedException(`租户 ${tenantId} 不存在`);
    }

    const accessToken = (tenant as any).hubspotAccessToken;
    const refreshToken = (tenant as any).hubspotRefreshToken;
    const expiresAt = (tenant as any).hubspotExpiresAt;

    // Check if we have access token
    if (!accessToken) {
      throw new UnauthorizedException(
        `租户 ${tenantId} 未授权 HubSpot。请重新授权。`,
        'HUBSPOT_NOT_AUTHORIZED'
      );
    }

    // Check if token is expired or about to expire (within 5 minutes)
    const now = Math.floor(Date.now() / 1000);
    const isExpired = expiresAt && expiresAt < now + 300; // 5 minutes buffer

    if (isExpired && refreshToken) {
      this.logger.log(`Token expired for tenant ${tenantId}, attempting refresh...`);
      try {
        const newToken = await this.refreshAccessToken(tenantId, refreshToken);
        // Update cache with new token
        const client = new Client({ accessToken: newToken.accessToken });
        this.clientCache.set(tenantId, {
          client,
          expiresAt: newToken.expiresAt * 1000,
        });
        return client;
      } catch (error) {
        this.logger.error(`Failed to refresh token for tenant ${tenantId}:`, error);
        // Clear cache and throw authorization error
        this.clientCache.delete(tenantId);
        throw new UnauthorizedException(
          `HubSpot 授权已过期且刷新失败。请重新授权。`,
          'HUBSPOT_TOKEN_REFRESH_FAILED'
        );
      }
    } else if (isExpired && !refreshToken) {
      this.logger.warn(`Token expired for tenant ${tenantId} and no refresh token available`);
      this.clientCache.delete(tenantId);
      throw new UnauthorizedException(
        `HubSpot 授权已过期。请重新授权。`,
        'HUBSPOT_TOKEN_EXPIRED'
      );
    }

    // Token is valid, create and cache client
    const client = new Client({ accessToken });
    const cacheExpiresAt = expiresAt ? expiresAt * 1000 : Date.now() + 6 * 60 * 60 * 1000; // Default 6 hours
    this.clientCache.set(tenantId, {
      client,
      expiresAt: cacheExpiresAt,
    });

    return client;
  }

  /**
   * Refresh HubSpot access token using refresh token
   */
  private async refreshAccessToken(
    tenantId: string,
    refreshToken: string,
  ): Promise<{ accessToken: string; expiresAt: number }> {
    const clientId = this.configService.get<string>('HUBSPOT_CLIENT_ID');
    const clientSecret = this.configService.get<string>('HUBSPOT_CLIENT_SECRET');

    if (!clientId || !clientSecret) {
      throw new Error('HubSpot OAuth credentials not configured');
    }

    const response = await fetch('https://api.hubapi.com/oauth/v1/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      this.logger.error(`Token refresh failed: ${errorText}`);
      throw new Error(`Failed to refresh token: ${response.statusText}`);
    }

    const tokenData = await response.json();

    // Update tenant with new tokens
    await this.tenantService.upsertTenant(
      { id: tenantId },
      {
        hubspotAccessToken: tokenData.access_token,
        hubspotRefreshToken: tokenData.refresh_token,
        hubspotExpiresAt: Math.floor(Date.now() / 1000) + tokenData.expires_in,
      },
    );

    this.logger.log(`Successfully refreshed token for tenant ${tenantId}`);

    return {
      accessToken: tokenData.access_token,
      expiresAt: Math.floor(Date.now() / 1000) + tokenData.expires_in,
    };
  }

  /**
   * Validate and potentially refresh token before making API calls
   * Call this before important operations to ensure token is valid
   */
  async ensureValidToken(tenantId: string): Promise<void> {
    // This will trigger refresh if needed
    await this.getClient(tenantId);
  }

  /**
   * Clear cached client for a tenant (useful after token refresh or revocation)
   */
  clearCache(tenantId?: string) {
    if (tenantId) {
      this.clientCache.delete(tenantId);
      this.logger.log(`Cleared HubSpot client cache for tenant ${tenantId}`);
    } else {
      this.clientCache.clear();
      this.logger.log('Cleared all HubSpot client caches');
    }
  }

  /**
   * Check if tenant has valid HubSpot authorization
   */
  async isAuthorized(tenantId: string): Promise<boolean> {
    try {
      await this.getClient(tenantId);
      return true;
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        return false;
      }
      throw error;
    }
  }
}
