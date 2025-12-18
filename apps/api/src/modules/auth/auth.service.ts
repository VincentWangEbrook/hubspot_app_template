import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Client } from '@hubspot/api-client';
import axios from 'axios';
import { TenantService } from '../tenants/services/tenant.service';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private clientId = this.config.get<string>('HUBSPOT_CLIENT_ID');
  private clientSecret = this.config.get<string>('HUBSPOT_CLIENT_SECRET');
  private redirectUri = this.config.get<string>('HUBSPOT_OAUTH_REDIRECT_URI');

  constructor(
    private readonly config: ConfigService,
    private readonly tenantService: TenantService,
    private readonly jwtService: JwtService,
    private readonly client: Client
  ) {}

  verifyJwt(token: string) {
    try {
      return this.jwtService.verify(token);
    } catch (err) {
      throw new UnauthorizedException('无效的或过期的 JWT');
    }
  }

  getAuthorizationUrl(state: string) {
    const scopes = [
      'crm.schemas.contacts.read',
      'crm.schemas.contacts.write',
      'crm.schemas.companies.read',
      'crm.schemas.companies.write',
      'crm.schemas.deals.read',
      'crm.schemas.deals.write',
      'crm.objects.contacts.read',
      'crm.objects.contacts.write',
      'crm.objects.companies.read',
      'crm.objects.companies.write',
      'crm.objects.deals.read',
      'crm.objects.deals.write',  
    ];

    return this.client.oauth.getAuthorizationUrl(
      this.clientId || '',
      this.redirectUri || '',
      scopes.join(' '),
      '',
      state
    );
  }

  async refreshTokensApi(code: string, refreshToken: string) {
    const tokenData = await this.client.oauth.tokensApi.create(
      'refresh_token',
      code, this.redirectUri || '',
      this.clientId || '',
      this.clientSecret || '',
      refreshToken
    );
    return tokenData;
  }

  async exchangeCodeForToken(code: string) {
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

      return data;
    } catch (err: any) {
      this.logger.error('HubSpot token exchange failed', err?.response?.data ?? err.message);
      throw err;
    }
  }
}
