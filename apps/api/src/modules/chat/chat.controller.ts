/**
 * Developed by eBrook Group.
 * Copyright © 2025 eBrook Group (https://www.ebrook.com.tw)
 */

import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  Query,
  Req,
  ForbiddenException,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ChatService } from './chat.service';
import { SendMessageDto } from './dto/send-message.dto';
import { GetConversationsDto } from './dto/get-conversations.dto';
import { GetMessagesDto } from './dto/get-messages.dto';
import { InitConversationDto } from './dto/init-conversation.dto';
import { TenantMemberGuard } from '../../common/security/tenant-member.guard';
import { FastifyReply } from 'fastify';
import { UserId, TenantId } from '../../common/decorators/user.decorator';

@Controller('api/chat')
@UseGuards(TenantMemberGuard)
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  /**
   * 发送消息
   * Rate Limit: 每分钟最多 10 条消息
   */
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @Post('messages')
  async sendMessage(
    @Body() body: SendMessageDto,
    @UserId() userId: string,
    @Res() res: FastifyReply,
  ) {
    body.userId = userId;
    const result = await this.chatService.sendMessage(body);
    return res.send({ success: true, data: result });
  }

  /**
   * 获取对话列表（收件箱）
   * Rate Limit: 每分钟最多 30 次查询
   */
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  @Get('conversations')
  async getConversations(
    @Query() query: GetConversationsDto,
    @TenantId() tenantId: string,
    @Res() res: FastifyReply,
  ) {
    query.tenantId = tenantId;
    const conversations = await this.chatService.getConversations(query);
    return res.send({ success: true, data: conversations });
  }

  /**
   * 获取消息历史
   */
  @Get('messages/:channelId')
  async getMessages(
    @Param('channelId') channelId: string,
    @Query() query: GetMessagesDto,
    @TenantId() tenantId: string,
    @Res() res: FastifyReply,
  ) {
    // 解析和验证 channelId
    const parsedChannelId = Number(channelId);
    if (!Number.isSafeInteger(parsedChannelId) || parsedChannelId <= 0) {
      throw new ForbiddenException('Invalid channelId format');
    }

    query.tenantId = tenantId;
    const messages = await this.chatService.getMessages(parsedChannelId, query);
    return res.send({ success: true, data: messages });
  }

  /**
   * 标记消息为已读
   */
  @Put('messages/:channelId/read')
  async markAsRead(
    @Param('channelId') channelId: string,
    @TenantId() tenantId: string,
    @Res() res: FastifyReply,
  ) {
    // 🐛 安全: 解析和验证 channelId
    const parsedChannelId = Number(channelId);
    if (!Number.isSafeInteger(parsedChannelId) || parsedChannelId <= 0) {
      throw new ForbiddenException('Invalid channelId format');
    }

    await this.chatService.markAsRead(parsedChannelId, tenantId);
    return res.send({ success: true });
  }

  /**
   * 从 Contact 初始化对话
   */
  @Post('conversations/init')
  async initConversation(
    @Body() body: InitConversationDto,
    @Res() res: FastifyReply,
  ) {
    const conversation = await this.chatService.getOrCreateConversation(body);
    return res.send({ success: true, data: conversation });
  }
}
