import { Controller, Get, Post, Body, Param, Query, UseGuards, Req, NotFoundException } from '@nestjs/common';
import { TenantPrismaService } from '../prisma/tenant-prisma.service';
import { LineService } from '../line/services/line.service';
import { TenantService } from '../tenants/services/tenant.service';

@Controller('chat')
export class ChatController {
  constructor(
    private readonly tenantPrisma: TenantPrismaService,
    private readonly lineService: LineService,
    private readonly tenantService: TenantService,
  ) {}

  @Get('channels')
  async getChannels(@Query('tenantId') tenantId: string) {
    // In a real app, we would get tenantId from the authenticated user's session/token
    // For now, we accept it as a query param for simplicity or assume it's passed
    if (!tenantId) throw new Error('Tenant ID is required');

    return this.tenantPrisma.runInTenantContext(tenantId, async (tx) => {
      // Fetch channels with latest message (optional optimization)
      const channels = await tx.channel.findMany({
        orderBy: { updatedAt: 'desc' },
        include: {
          messages: {
            take: 1,
            orderBy: { createdAt: 'desc' },
          },
        },
      });
      return channels;
    });
  }

  @Get('messages/:channelId')
  async getMessages(
    @Param('channelId') channelId: string,
    @Query('tenantId') tenantId: string,
  ) {
    if (!tenantId) throw new Error('Tenant ID is required');

    return this.tenantPrisma.runInTenantContext(tenantId, async (tx) => {
      const messages = await tx.message.findMany({
        where: { channelId: parseInt(channelId) },
        orderBy: { createdAt: 'asc' },
      });
      return messages;
    });
  }

  @Post('messages')
  async sendMessage(
    @Body() body: { tenantId: string; channelId: number; content: string },
  ) {
    const { tenantId, channelId, content } = body;
    if (!tenantId || !channelId || !content) {
      throw new Error('Missing required fields');
    }

    // Use LineService to handle the full flow (Save -> Line -> HubSpot)
    await this.lineService.replyToLine(tenantId, channelId, content);
    return { success: true };
  }
}
