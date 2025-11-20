import { Injectable, Logger } from '@nestjs/common';
import Stripe from 'stripe';
import { ConfigService } from '@nestjs/config';
import { TenantService } from '../tenants/services/tenant.service';

@Injectable()
export class SubscriptionService {
  private readonly logger = new Logger(SubscriptionService.name);
  private stripe: Stripe;

  // 1. 在构造函数中注入 TenantService 和 ConfigService（推荐用 ConfigService 读取环境变量）
  constructor(
    private readonly tenantService: TenantService, // 注入 TenantService
    private readonly configService: ConfigService,  // 注入 ConfigService（替代直接使用 process.env）
  ) {
    // 2. 通过 ConfigService 读取环境变量（更符合 NestJS 最佳实践）
    this.stripe = new Stripe(
      this.configService.get<string>('STRIPE_SECRET_KEY') || '', 
      { apiVersion: '2023-10-16' }
    );
  }

  async createCheckoutSession(tenantId: string) {
    const session = await this.stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'subscription',
      line_items: [
        { 
          price: this.configService.get<string>('STRIPE_TEST_PRICE_ID'),
          quantity: 1 
        },
      ],
      success_url: `${this.configService.get<string>('FRONTEND_URL')}/subscription-success`,
      cancel_url: `${this.configService.get<string>('FRONTEND_URL')}/subscription-cancel`,
      metadata: { tenantId },
    });
    this.logger.log(`Created Stripe checkout session for ${tenantId}`);
    return session.url;
  }

  async handleStripeEvent(event: Stripe.Event) {
    const type = event.type;
    this.logger.log(`Stripe event ${type} received`);

    switch (type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        const tenantId = session.metadata?.tenantId;
        if (tenantId) {
          // 现在可以正常使用 this.tenantService 了
          await this.tenantService.upsertTenant(tenantId, {
            raw: { stripeCheckout: session },
          });
        }
        break;
      }
      default:
        this.logger.log(`Unhandled Stripe event type: ${type}`);
    }
  }
}