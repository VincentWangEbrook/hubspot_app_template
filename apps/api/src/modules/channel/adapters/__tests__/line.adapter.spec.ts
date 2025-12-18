/**
 * Developed by eBrook Group.
 * Copyright © 2025 eBrook Group (https://www.ebrook.com.tw)
 */

import { Test, TestingModule } from '@nestjs/testing';
import { LineChannelAdapter } from '../line.adapter';
import { ChannelConfigService } from '../../channel-config.service';
import { SendMessageParams } from '../../interfaces/channel-adapter.interface';

describe('LineChannelAdapter', () => {
  let adapter: LineChannelAdapter;
  let channelConfigService: jest.Mocked<ChannelConfigService>;

  beforeEach(async () => {
    const mockChannelConfigService = {
      getConfig: jest.fn(),
      verifySignature: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LineChannelAdapter,
        {
          provide: ChannelConfigService,
          useValue: mockChannelConfigService,
        },
      ],
    }).compile();

    adapter = module.get<LineChannelAdapter>(LineChannelAdapter);
    channelConfigService = module.get(ChannelConfigService);
  });

  describe('sendMessage', () => {
    it('应该成功发送文本消息 (Happy Path)', async () => {
      // Arrange
      const params: SendMessageParams = {
        externalUserId: 'U1234567890abcdef',
        content: 'Hello from backend',
        messageType: 'text',
      };

      channelConfigService.getConfig.mockResolvedValue({
        channelAccessToken: 'mock-token',
        channelSecret: 'mock-secret',
      });

      // Mock LINE API call
      const mockLineApi = jest.spyOn(adapter as any, 'callLineApi').mockResolvedValue({
        sentMessages: [{ id: 'msg-123' }],
      });

      // Act
      const result = await adapter.sendMessage(params);

      // Assert
      expect(result.success).toBe(true);
      expect(result.externalMessageId).toBe('msg-123');
      expect(mockLineApi).toHaveBeenCalledWith(
        'https://api.line.me/v2/bot/message/push',
        expect.objectContaining({
          to: params.externalUserId,
          messages: [{ type: 'text', text: params.content }],
        }),
      );
    });

    it('应该处理 LINE API 限流错误 (429)', async () => {
      // Arrange
      const params: SendMessageParams = {
        externalUserId: 'U1234567890abcdef',
        content: 'Test message',
        messageType: 'text',
      };

      channelConfigService.getConfig.mockResolvedValue({
        channelAccessToken: 'mock-token',
        channelSecret: 'mock-secret',
      });

      const mockLineApi = jest
        .spyOn(adapter as any, 'callLineApi')
        .mockRejectedValue({ response: { status: 429 } });

      // Act
      const result = await adapter.sendMessage(params);

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toContain('Rate limit');
    });

    it('应该处理用户已封锁 Bot 的情况', async () => {
      // Arrange
      const params: SendMessageParams = {
        externalUserId: 'U1234567890abcdef',
        content: 'Test message',
        messageType: 'text',
      };

      channelConfigService.getConfig.mockResolvedValue({
        channelAccessToken: 'mock-token',
        channelSecret: 'mock-secret',
      });

      const mockLineApi = jest
        .spyOn(adapter as any, 'callLineApi')
        .mockRejectedValue({ 
          response: { 
            status: 403,
            data: { message: 'The user has blocked the bot' }
          } 
        });

      // Act
      const result = await adapter.sendMessage(params);

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toContain('blocked');
    });

    it('应该在网络超时后重试 (最多3次)', async () => {
      // Arrange
      const params: SendMessageParams = {
        externalUserId: 'U1234567890abcdef',
        content: 'Test message',
        messageType: 'text',
      };

      channelConfigService.getConfig.mockResolvedValue({
        channelAccessToken: 'mock-token',
        channelSecret: 'mock-secret',
      });

      const mockLineApi = jest
        .spyOn(adapter as any, 'callLineApi')
        .mockRejectedValueOnce({ code: 'ETIMEDOUT' })
        .mockRejectedValueOnce({ code: 'ETIMEDOUT' })
        .mockResolvedValueOnce({ sentMessages: [{ id: 'msg-123' }] });

      // Act
      const result = await adapter.sendMessage(params);

      // Assert
      expect(result.success).toBe(true);
      expect(mockLineApi).toHaveBeenCalledTimes(3);
    });

    it('应该在3次重试后仍失败时返回错误', async () => {
      // Arrange
      const params: SendMessageParams = {
        externalUserId: 'U1234567890abcdef',
        content: 'Test message',
        messageType: 'text',
      };

      channelConfigService.getConfig.mockResolvedValue({
        channelAccessToken: 'mock-token',
        channelSecret: 'mock-secret',
      });

      const mockLineApi = jest
        .spyOn(adapter as any, 'callLineApi')
        .mockRejectedValue({ code: 'ETIMEDOUT' });

      // Act
      const result = await adapter.sendMessage(params);

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toContain('timeout');
      expect(mockLineApi).toHaveBeenCalledTimes(3);
    });
  });

  describe('handleWebhook', () => {
    it('应该成功解析 LINE Webhook 消息事件', async () => {
      // Arrange
      const payload = {
        events: [
          {
            type: 'message',
            source: { userId: 'U1234567890abcdef' },
            message: {
              type: 'text',
              id: 'msg-123',
              text: 'Hello from LINE user',
            },
            timestamp: 1234567890123,
          },
        ],
      };

      // Act
      const result = await adapter.handleWebhook(payload, 'tenant-123');

      // Assert
      expect(result.messages).toHaveLength(1);
      expect(result.messages[0]).toMatchObject({
        externalUserId: 'U1234567890abcdef',
        content: 'Hello from LINE user',
        messageType: 'text',
      });
    });

    it('应该处理 Follow 事件', async () => {
      // Arrange
      const payload = {
        events: [
          {
            type: 'follow',
            source: { userId: 'U1234567890abcdef' },
            timestamp: 1234567890123,
          },
        ],
      };

      // Act
      const result = await adapter.handleWebhook(payload, 'tenant-123');

      // Assert
      expect(result.events).toHaveLength(1);
      expect(result.events[0]).toMatchObject({
        type: 'follow',
        externalUserId: 'U1234567890abcdef',
      });
      expect(result.messages).toHaveLength(0);
    });

    it('应该过滤掉非文本消息类型', async () => {
      // Arrange
      const payload = {
        events: [
          {
            type: 'message',
            source: { userId: 'U1234567890abcdef' },
            message: {
              type: 'sticker',
              id: 'msg-123',
              packageId: '1',
              stickerId: '1',
            },
            timestamp: 1234567890123,
          },
        ],
      };

      // Act
      const result = await adapter.handleWebhook(payload, 'tenant-123');

      // Assert
      expect(result.messages).toHaveLength(0);
    });

    it('应该使用 externalId 去重重复的 Webhook 事件', async () => {
      // Arrange
      const payload = {
        events: [
          {
            type: 'message',
            source: { userId: 'U1234567890abcdef' },
            message: {
              type: 'text',
              id: 'msg-123', // 相同的消息 ID
              text: 'Hello',
            },
            timestamp: 1234567890123,
          },
          {
            type: 'message',
            source: { userId: 'U1234567890abcdef' },
            message: {
              type: 'text',
              id: 'msg-123', // 重复
              text: 'Hello',
            },
            timestamp: 1234567890124,
          },
        ],
      };

      // Act
      const result = await adapter.handleWebhook(payload, 'tenant-123');

      // Assert
      expect(result.messages).toHaveLength(1);
    });

    it('应该处理超长消息内容', async () => {
      // Arrange
      const longContent = 'a'.repeat(10000); // 超过 LINE 5000 字符限制
      const payload = {
        events: [
          {
            type: 'message',
            source: { userId: 'U1234567890abcdef' },
            message: {
              type: 'text',
              id: 'msg-123',
              text: longContent,
            },
            timestamp: 1234567890123,
          },
        ],
      };

      // Act
      const result = await adapter.handleWebhook(payload, 'tenant-123');

      // Assert
      expect(result.messages[0].content.length).toBeLessThanOrEqual(5000);
      expect(result.messages[0].metadata?.truncated).toBe(true);
      expect(result.messages[0].metadata?.originalLength).toBe(10000);
    });
  });

  describe('verifyWebhookSignature', () => {
    it('应该验证有效的签名', () => {
      // Arrange
      const body = JSON.stringify({ test: 'data' });
      const signature = 'valid-signature-hash';

      channelConfigService.verifySignature.mockReturnValue(true);

      // Act
      const result = adapter.verifyWebhookSignature(signature, body);

      // Assert
      expect(result).toBe(true);
      expect(channelConfigService.verifySignature).toHaveBeenCalledWith(
        'LINE',
        signature,
        body,
      );
    });

    it('应该拒绝无效的签名', () => {
      // Arrange
      const body = JSON.stringify({ test: 'data' });
      const signature = 'invalid-signature';

      channelConfigService.verifySignature.mockReturnValue(false);

      // Act
      const result = adapter.verifyWebhookSignature(signature, body);

      // Assert
      expect(result).toBe(false);
    });
  });

  describe('getUserProfile', () => {
    it('应该获取 LINE 用户资料', async () => {
      // Arrange
      const externalUserId = 'U1234567890abcdef';
      
      const mockLineApi = jest.spyOn(adapter as any, 'callLineApi').mockResolvedValue({
        displayName: 'Test User',
        pictureUrl: 'https://example.com/avatar.jpg',
        statusMessage: 'Hello World',
      });

      // Act
      const result = await adapter.getUserProfile(externalUserId);

      // Assert
      expect(result).toMatchObject({
        displayName: 'Test User',
        pictureUrl: 'https://example.com/avatar.jpg',
        statusMessage: 'Hello World',
      });
    });

    it('应该处理用户资料不存在的情况', async () => {
      // Arrange
      const externalUserId = 'U-nonexistent';
      
      const mockLineApi = jest
        .spyOn(adapter as any, 'callLineApi')
        .mockRejectedValue({ response: { status: 404 } });

      // Act & Assert
      await expect(adapter.getUserProfile(externalUserId)).rejects.toThrow(
        'User profile not found',
      );
    });
  });
});
