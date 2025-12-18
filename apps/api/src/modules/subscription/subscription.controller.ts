/**
 * Developed by eBrook Group.
 * Copyright © 2025 eBrook Group (https://www.ebrook.com.tw)
 */

import {
  Controller,
  Post,
  Body,
  Req,
  Res,
  HttpCode,
  HttpStatus,
  Headers,
} from '@nestjs/common';
import { SubscriptionService } from './subscription.service';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';

interface Session {
  url?: string;
}

// 类型守卫：判断是否为 Session 对象
function isSession(obj: any): obj is Session {
  return typeof obj === 'object' && obj !== null && 'url' in obj;
}

@Controller('api/subscription')
export class SubscriptionController {
  constructor(
    private readonly subscriptionService: SubscriptionService,
    private readonly config: ConfigService,
  ) {}

  @Post('create-checkout-session')
  async createCheckout(@Body() body: { tenantId: string }) {
    const { tenantId } = body;
    const session: Session | string | null = await this.subscriptionService.createCheckoutSession(
      tenantId
    );

    return { success: true,   url: isSession(session) ? session.url ?? null : null
    };
  }

  @Post('webhook')
  @HttpCode(HttpStatus.OK)
  async webhook(@Req() req: any, @Res() res: any, @Headers('stripe-signature') sig: string) {
    // fastify-raw-body adds rawBody field
    const raw = (req as any).rawBody;
    const secret = this.config.get<string>('STRIPE_WEBHOOK_SECRET')!;
    let event: Stripe.Event;

    try {
      const stripe = new Stripe(this.config.get<string>('STRIPE_SECRET_KEY')!,   { apiVersion: '2023-10-16' });
      event = stripe.webhooks.constructEvent(raw, sig, secret);
    } catch (err: any) {
      console.error('Webhook signature verification failed.', err.message);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    await this.subscriptionService.handleStripeEvent(event);
    return res.send({ received: true });
  }
}
