/**
 * Developed by eBrook Group.
 * Copyright © 2025 eBrook Group (https://www.ebrook.com.tw)
 */

import { Test, TestingModule } from '@nestjs/testing';
import { WebhookController } from '../webhook.controller';
import { ChannelAdapterFactory } from '../../channel/channel-adapter.factory';
import { ChatService } from '../../chat/chat.service';
import { UnauthorizedException } from '@nestjs/common';

describe('WebhookController', () => {
  let controller: WebhookController;
  let channelAdapterFactory: jest.Mocked<ChannelAdapterFactory>;
  let chatService: jest.Mocked<ChatService>;

  beforeEach(async () => {
    const mockChannelAdapterFactory = {
      getAdapter: jest.fn(),
    };

    const mockChatService = {
      handleIncomingMessage: jest.fn(),
      handleChannelEvent: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [WebhookController],
      providers: [
        { provide: ChannelAdapterFactory, useValue: mockChannelAdapterFactory },
        { provide: ChatService, useValue: mockChatService },
      ],
    }).compile();

    controller = module.get<WebhookController>(WebhookController);
    channelAdapterFactory = module.get(ChannelAdapterFactory);
    chatService = module.get(ChatService);
  });

  describe('POST /webhook/:channelType/:tenantId', () => {
    it('应该处理有效的 LINE Webhook', async () => {
      // Arrange
      const channelType = 'LINE';
      const tenantId = 'tenant-123';
      const signature = 'valid-signature';
      const body = {
        events: [
          {
            type: 'message',
            source: { userId: 'U1234567890abcdef' },
            message: {
              type: 'text',
              id: 'msg-123',
              text: 'Hello',
            },
          },
        ],
      };

      const mockAdapter = {
        verifyWebhookSignature: jest.fn().mockReturnValue(true),
        handleWebhook: jest.fn().mockResolvedValue({
          messages: [
            {
              externalUserId: 'U1234567890abcdef',
              content: 'Hello',
              messageType: 'text',
              timestamp: new Date(),
              rawPayload: body.events[0],
            },
          ],
          events: [],
        }),
      };

      channelAdapterFactory.getAdapter.mockReturnValue(mockAdapter as any);
      chatService.handleIncomingMessage.mockResolvedValue({} as any);

      // Act
      const result = await controller.handleWebhook(
        channelType,
        tenantId,
        signature,
        body,
      );

      // Assert
      expect(result).toEqual({ success: true, processed: 1 });
      expect(mockAdapter.verifyWebhookSignature).toHaveBeenCalled();
      expect(chatService.handleIncomingMessage).toHaveBeenCalledWith({
        tenantId,
        channelType,
        externalUserId: 'U1234567890abcdef',
        content: 'Hello',
        externalMessageId: expect.any(String),
      });
    });

    it('应该拒绝签名验证失败的请求', async () => {
      // Arrange
      const channelType = 'LINE';
      const tenantId = 'tenant-123';
      const signature = 'invalid-signature';
      const body = { events: [] };

      const mockAdapter = {
        verifyWebhookSignature: jest.fn().mockReturnValue(false),
      };

      channelAdapterFactory.getAdapter.mockReturnValue(mockAdapter as any);

      // Act & Assert
      await expect(
        controller.handleWebhook(channelType, tenantId, signature, body),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('应该处理 Follow 事件', async () => {
      // Arrange
      const channelType = 'LINE';
      const tenantId = 'tenant-123';
      const signature = 'valid-signature';
      const body = {
        events: [
          {
            type: 'follow',
            source: { userId: 'U1234567890abcdef' },
          },
        ],
      };

      const mockAdapter = {
        verifyWebhookSignature: jest.fn().mockReturnValue(true),
        handleWebhook: jest.fn().mockResolvedValue({
          messages: [],
          events: [
            {
              type: 'follow',
              externalUserId: 'U1234567890abcdef',
              timestamp: new Date(),
            },
          ],
        }),
        getUserProfile: jest.fn().mockResolvedValue({
          displayName: 'New Follower',
          pictureUrl: 'https://example.com/avatar.jpg',
        }),
      };

      channelAdapterFactory.getAdapter.mockReturnValue(mockAdapter as any);
      chatService.handleChannelEvent.mockResolvedValue({} as any);

      // Act
      const result = await controller.handleWebhook(
        channelType,
        tenantId,
        signature,
        body,
      );

      // Assert
      expect(result).toEqual({ success: true, processed: 1 });
      expect(chatService.handleChannelEvent).toHaveBeenCalledWith({
        tenantId,
        channelType,
        eventType: 'follow',
        externalUserId: 'U1234567890abcdef',
        userData: {
          displayName: 'New Follower',
          pictureUrl: 'https://example.com/avatar.jpg',
        },
      });
    });

    it('应该记录 Webhook 处理错误但不抛出异常', async () => {
      // Arrange
      const channelType = 'LINE';
      const tenantId = 'tenant-123';
      const signature = 'valid-signature';
      const body = {
        events: [
          {
            type: 'message',
            source: { userId: 'U1234567890abcdef' },
            message: { type: 'text', text: 'Test' },
          },
        ],
      };

      const mockAdapter = {
        verifyWebhookSignature: jest.fn().mockReturnValue(true),
        handleWebhook: jest.fn().mockResolvedValue({
          messages: [
            {
              externalUserId: 'U1234567890abcdef',
              content: 'Test',
              messageType: 'text',
            },
          ],
          events: [],
        }),
      };

      channelAdapterFactory.getAdapter.mockReturnValue(mockAdapter as any);
      chatService.handleIncomingMessage.mockRejectedValue(
        new Error('Database error'),
      );

      // Act
      const result = await controller.handleWebhook(
        channelType,
        tenantId,
        signature,
        body,
      );

      // Assert
      expect(result).toEqual({ success: true, processed: 0, errors: 1 });
      // 错误应该被记录但不影响响应
    });

    it('应该支持 WeChat Webhook', async () => {
      // Arrange
      const channelType = 'WECHAT';
      const tenantId = 'tenant-123';
      const signature = 'valid-signature';
      const body = {
        // WeChat webhook payload
        ToUserName: 'gh_xxx',
        FromUserName: 'openid-123',
        MsgType: 'text',
        Content: 'Hello from WeChat',
      };

      const mockAdapter = {
        verifyWebhookSignature: jest.fn().mockReturnValue(true),
        handleWebhook: jest.fn().mockResolvedValue({
          messages: [
            {
              externalUserId: 'openid-123',
              content: 'Hello from WeChat',
              messageType: 'text',
            },
          ],
          events: [],
        }),
      };

      channelAdapterFactory.getAdapter.mockReturnValue(mockAdapter as any);
      chatService.handleIncomingMessage.mockResolvedValue({} as any);

      // Act
      const result = await controller.handleWebhook(
        channelType,
        tenantId,
        signature,
        body,
      );

      // Assert
      expect(result.success).toBe(true);
      expect(channelAdapterFactory.getAdapter).toHaveBeenCalledWith('WECHAT');
    });
  });
});
