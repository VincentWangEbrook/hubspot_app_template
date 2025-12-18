import { Controller, Post, Req, Body, Logger, UnauthorizedException } from '@nestjs/common';
import { FastifyRequest } from 'fastify';
import { HubspotService } from '../services/hubspot.service';

@Controller('hubspot')
export class HubspotWebhookController {
  private readonly logger = new Logger(HubspotWebhookController.name);

  constructor(
    private readonly hubspotService: HubspotService,
  ) {}

  @Post('webhook')
  async handle(@Req() req: FastifyRequest, @Body() body: any) {
    const rawBody = (req as any).rawBody;
    const signature = req.headers['x-hubspot-signature'] as string;

    if (rawBody && signature) {
      const isValid = this.hubspotService.verifySignature(signature, rawBody);
      if (!isValid) {
        this.logger.warn(`Invalid HubSpot signature. Signature: ${signature}`);
        throw new UnauthorizedException('Invalid signature');
      }
    } else {
      this.logger.debug('Missing signature or rawBody, skipping verification (dev mode?)');
    }
    
    await this.hubspotService.handleWebhook(body);
    return { success: true };
  }
}
