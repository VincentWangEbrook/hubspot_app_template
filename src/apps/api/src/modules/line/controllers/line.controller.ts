// src/modules/line/controllers/line.controller.ts
import { Controller, Post, Body, Get, Query, Headers, HttpStatus, Request } from '@nestjs/common';
import { LineService } from '../services/line.service';
import { LineConfigService } from '../services/line-config.service';
import { validateSignature } from '@line/bot-sdk';
import { ApiBody, ApiQuery, ApiHeader } from '@nestjs/swagger';

@Controller('api/line')
export class LineController {
  constructor(
    private lineService: LineService,
    private lineConfigService: LineConfigService,
  ) {}

  /**
   * Line Webhook 回调接口（多租户：需通过 Header/Query 传递 tenantId）
   * 注意：如果是多租户共享一个 Line 应用，需调整 tenantId 传递方式（如消息内容解析、用户标签映射）
   */
  @Post('webhook')
  @ApiHeader({ name: 'X-Tenant-Id', required: true, description: '租户 ID' })
  async handleWebhook(
    @Body() body: any,
    @Headers('x-line-signature') signature: string,
    @Headers('x-tenant-id') tenantId: string, // 从 Header 获取租户 ID
  ) {
    // 1. 验证租户 ID
    if (!tenantId) {
      return { status: HttpStatus.BAD_REQUEST, message: '缺少租户 ID（X-Tenant-Id）' };
    }

    // 2. 验证 Line 签名
    const channelSecret = this.lineConfigService.getChannelSecret();
    if (!validateSignature(JSON.stringify(body), channelSecret, signature)) {
      return { status: HttpStatus.FORBIDDEN, message: '签名验证失败' };
    }

    // 3. 处理事件（携带 tenantId）
    const events = body.events;
    await this.lineService.handleWebhookEvents(events, tenantId);
    return { status: HttpStatus.OK, message: '处理成功' };
  }

  /**
   * HubSpot 回复 Line 用户接口（多租户）
   */
  @Post('reply')
  @ApiHeader({ name: 'X-Tenant-Id', required: true, description: '租户 ID' })
  @ApiBody({ schema: { properties: { channelId: { type: 'number' }, message: { type: 'string' } } } })
  async replyToLine(
    @Headers('x-tenant-id') tenantId: string,
    @Body() body: { channelId: number; message: string },
  ) {
    if (!tenantId) {
      throw new Error('缺少租户 ID（X-Tenant-Id）');
    }
    return this.lineService.replyToLine(tenantId, body.channelId, body.message);
  }

  /**
   * 获取对话历史接口（多租户）
   */
  @Get('messages')
  @ApiHeader({ name: 'X-Tenant-Id', required: true, description: '租户 ID' })
  @ApiQuery({ name: 'channelId', type: 'number' })
  async getMessageHistory(
    @Headers('x-tenant-id') tenantId: string,
    @Query('channelId') channelId: number,
  ) {
    if (!tenantId) {
      throw new Error('缺少租户 ID（X-Tenant-Id）');
    }
    return this.lineService.getMessageHistory(tenantId, channelId);
  }

  /**
   * 根据联系人 ID 查询 Line 通道（多租户）
   */
  @Get('channel')
  @ApiHeader({ name: 'X-Tenant-Id', required: true, description: '租户 ID' })
  @ApiQuery({ name: 'contactId', type: 'string' })
  async getChannelByContactId(
    @Headers('x-tenant-id') tenantId: string,
    @Query('contactId') contactId: string,
  ) {
    if (!tenantId) {
      throw new Error('缺少租户 ID（X-Tenant-Id）');
    }
    return this.lineService.getChannelByTenantAndContactId(tenantId, contactId);
  }
}