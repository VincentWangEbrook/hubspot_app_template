import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import * as crypto from 'crypto';
import { TenantService } from '../tenant/tenant.service';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private clientId = this.config.get<string>('HUBSPOT_CLIENT_ID');
  private clientSecret = this.config.get<string>('HUBSPOT_CLIENT_SECRET');
  private redirectUri = this.config.get<string>('HUBSPOT_OAUTH_REDIRECT_URI');

  constructor(
    private readonly config: ConfigService,
    private readonly tenantService: TenantService,
    private readonly jwtService: JwtService
  ) {}

  verifyJwt(token: string) {
    try {
      return this.jwtService.verify(token);
    } catch (err) {
      throw new UnauthorizedException('无效的或过期的 JWT');
    }
  }

  getAuthorizeUrl(state: string) {
    const url = new URL('https://app.hubspot.com/oauth/authorize');
    url.searchParams.set('client_id', this.clientId || '');
    url.searchParams.set('redirect_uri', this.redirectUri || '');
    url.searchParams.set('scope', 'crm.schemas.contacts.write crm.objects.contacts.write crm.schemas.contacts.read crm.objects.contacts.read');
    url.searchParams.set('state', state);
    return url.toString();
  }

  async exchangeCodeForToken(code: string, tenantId: string) {
    const tokenUrl = 'https://api.hubapi.com/oauth/v1/token';
    try {
      const params = new URLSearchParams();
      params.set('grant_type', 'authorization_code');
      params.set('client_id', this.clientId || '');
      params.set('client_secret', this.clientSecret || '');
      params.set('redirect_uri', this.redirectUri || '');
      params.set('code', code);

      const { data } = await axios.post(tokenUrl, params.toString(), {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      });

      await this.tenantService.upsertTenant({id: tenantId, hubId: data.hub_id}, {
        hubspotAccessToken: data.access_token,
        hubspotRefreshToken: data.refresh_token,
        hubspotScope: data.scope,
        raw: data,
      });

      return data;
    } catch (err: any) {
      this.logger.error('HubSpot token exchange failed', err?.response?.data ?? err.message);
      throw err;
    }
  }
}
