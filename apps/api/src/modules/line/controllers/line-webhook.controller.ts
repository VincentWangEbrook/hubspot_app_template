import { Controller, Post, Req, Body, Param, NotFoundException } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bullmq';
import { LineService } from '../services/line.service';
import { TenantService } from '../../tenants/services/tenant.service';

@Controller('line')
export class LineWebhookController {
  constructor(
    private readonly lineService: LineService,
    private readonly tenantService: TenantService,
    @InjectQueue('hubspot-sync') private readonly hubspotQueue: Queue,
  ) {}

  @Post('webhook/:tenantId')
  async handleWebhook(@Param('tenantId') tenantId: string, @Body() body: any) {
    // 验证租户是否存在
    const tenant = await this.tenantService.getTenant({ id: tenantId });
    if (!tenant) {
      throw new NotFoundException(`Tenant ${tenantId} not found`);
    }

    const events = body.events ?? [];
    // 调用 Service 处理事件
    await this.lineService.handleWebhookEvents(events, tenantId);
    
    return { success: true };
  }
}
