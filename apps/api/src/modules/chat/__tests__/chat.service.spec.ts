/**
 * Developed by eBrook Group.
 * Copyright © 2025 eBrook Group (https://www.ebrook.com.tw)
 */

import { Test, TestingModule } from '@nestjs/testing';
import { ChatService } from '../chat.service';
import { TenantPrismaService, TenantTransactionClient, TenantChannel, TenantMessage } from '../../prisma/tenant-prisma.service';
import { ChannelAdapterFactory } from '../../channel/channel-adapter.factory';
import { MultiChannelService } from '../../hubspot/services/multi-channel.service';
import { ChatGateway } from '../chat.gateway';
import { NotFoundException } from '@nestjs/common';

describe('ChatService', () => {
  let service: ChatService;
  let tenantPrisma: jest.Mocked<TenantPrismaService>;
  let channelAdapterFactory: jest.Mocked<ChannelAdapterFactory>;
  let multiChannelService: jest.Mocked<MultiChannelService>;
  let chatGateway: jest.Mocked<ChatGateway>;

  // Mock transaction client with Raw SQL methods
  const createMockTx = (overrides: {
    queryRawResults?: Map<string, any[]>;
    executeRawResult?: number;
  } = {}): TenantTransactionClient => {
    const { queryRawResults = new Map(), executeRawResult = 1 } = overrides;
    
    return {
      $queryRaw: jest.fn().mockImplementation((query) => {
        // Return appropriate results based on query patterns
        for (const [key, value] of queryRawResults) {
          if (query?.strings?.[0]?.includes(key) || String(query).includes(key)) {
            return Promise.resolve(value);
          }
        }
        return Promise.resolve([]);
      }),
      $executeRaw: jest.fn().mockResolvedValue(executeRawResult),
      $queryRawUnsafe: jest.fn().mockImplementation((query) => {
        for (const [key, value] of queryRawResults) {
          if (query.includes(key)) {
            return Promise.resolve(value);
          }
        }
        return Promise.resolve([]);
      }),
      $executeRawUnsafe: jest.fn().mockResolvedValue(executeRawResult),
    };
  };

  beforeEach(async () => {
    const mockTenantPrisma = {
      runInTenantContext: jest.fn(),
      getSchemaName: jest.fn().mockReturnValue('tenant_test'),
    };

    const mockChannelAdapterFactory = {
      getAdapter: jest.fn(),
    };

    const mockMultiChannelService = {
      sendMessageToHubspot: jest.fn(),
      saveOutgoingMessage: jest.fn(),
    };

    const mockChatGateway = {
      emitMessageToRoom: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ChatService,
        { provide: TenantPrismaService, useValue: mockTenantPrisma },
        { provide: ChannelAdapterFactory, useValue: mockChannelAdapterFactory },
        { provide: MultiChannelService, useValue: mockMultiChannelService },
        { provide: ChatGateway, useValue: mockChatGateway },
      ],
    }).compile();

    service = module.get<ChatService>(ChatService);
    tenantPrisma = module.get(TenantPrismaService);
    channelAdapterFactory = module.get(ChannelAdapterFactory);
    multiChannelService = module.get(MultiChannelService);
    chatGateway = module.get(ChatGateway);
  });

  describe('sendMessage', () => {
    it('应该成功发送消息到 LINE 和 HubSpot (Happy Path)', async () => {
      // Arrange
      const dto = {
        tenantId: 'tenant-123',
        channelId: 1,
        content: 'Hello from backend',
        userId: 'user-456',
      };

      const mockChannel: TenantChannel = {
        id: 1,
        channelType: 'LINE',
        externalUserId: 'U1234567890abcdef',
        hubspotContactId: 'contact-789',
        tenantId: 'tenant-123',
        contactName: 'Test User',
        contactAvatar: null,
        unreadCount: 0,
        lastMessageAt: null,
        status: 'active',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const mockMessage: TenantMessage = {
        id: 100,
        channelId: 1,
        tenantId: 'tenant-123',
        content: 'Hello from backend',
        isFromUser: false,
        messageType: 'text',
        senderId: 'user-456',
        externalId: 'line-msg-123',
        status: 'sent',
        metadata: null,
        readAt: null,
        createdAt: new Date(),
      };

      const mockAdapter = {
        sendMessage: jest.fn().mockResolvedValue({
          success: true,
          externalMessageId: 'line-msg-123',
        }),
      };

      const queryResults = new Map<string, any[]>();
      queryResults.set('FROM channels', [mockChannel]);
      queryResults.set('INSERT INTO messages', [mockMessage]);

      const mockTx = createMockTx({ queryRawResults: queryResults });

      tenantPrisma.runInTenantContext.mockImplementation(async (tenantId, callback) => {
        return callback(mockTx);
      });

      channelAdapterFactory.getAdapter.mockReturnValue(mockAdapter as any);

      // Act
      const result = await service.sendMessage(dto);

      // Assert
      expect(tenantPrisma.runInTenantContext).toHaveBeenCalledWith('tenant-123', expect.any(Function));
      expect(channelAdapterFactory.getAdapter).toHaveBeenCalledWith('LINE');
      expect(mockAdapter.sendMessage).toHaveBeenCalledWith({
        externalUserId: 'U1234567890abcdef',
        content: 'Hello from backend',
        messageType: 'text',
        metadata: undefined,
      });
      expect(chatGateway.emitMessageToRoom).toHaveBeenCalled();
    });

    it('应该在 Channel 不存在时抛出 NotFoundException', async () => {
      // Arrange
      const dto = {
        tenantId: 'tenant-123',
        channelId: 999,
        content: 'Hello',
        userId: 'user-456',
      };

      const mockTx = createMockTx({ queryRawResults: new Map([['FROM channels', []]]) });

      tenantPrisma.runInTenantContext.mockImplementation(async (tenantId, callback) => {
        return callback(mockTx);
      });

      // Act & Assert
      await expect(service.sendMessage(dto)).rejects.toThrow(NotFoundException);
    });

    it('应该验证 channelId 是有效的正整数', async () => {
      // Arrange
      const dto = {
        tenantId: 'tenant-123',
        channelId: -1,
        content: 'Hello',
        userId: 'user-456',
      };

      // Act & Assert
      await expect(service.sendMessage(dto)).rejects.toThrow('Invalid channelId');
    });
  });

  describe('getConversations', () => {
    it('应该返回租户的对话列表', async () => {
      // Arrange
      const dto = {
        tenantId: 'tenant-123',
        page: 1,
        limit: 20,
      };

      const mockChannels = [
        {
          id: 1,
          channelType: 'LINE',
          externalUserId: 'U123',
          hubspotContactId: 'contact-1',
          contactName: 'User 1',
          contactAvatar: null,
          unreadCount: 2,
          lastMessageAt: new Date(),
          status: 'active',
          updatedAt: new Date(),
          lastMessageContent: 'Hello',
          lastMessageCreatedAt: new Date(),
          lastMessageIsFromUser: true,
        },
      ];

      const queryResults = new Map<string, any[]>();
      queryResults.set('FROM channels', mockChannels);
      queryResults.set('COUNT(*)', [{ count: BigInt(1) }]);

      const mockTx = createMockTx({ queryRawResults: queryResults });

      tenantPrisma.runInTenantContext.mockImplementation(async (tenantId, callback) => {
        return callback(mockTx);
      });

      // Act
      const result = await service.getConversations(dto);

      // Assert
      expect(result.data).toHaveLength(1);
      expect(result.meta.total).toBe(1);
    });

    it('应该在 tenantId 为空时抛出错误', async () => {
      // Arrange
      const dto = {
        tenantId: '',
        page: 1,
        limit: 20,
      };

      // Act & Assert
      await expect(service.getConversations(dto)).rejects.toThrow('Invalid tenantId');
    });
  });

  describe('getMessages', () => {
    it('应该返回指定 Channel 的消息历史', async () => {
      // Arrange
      const channelId = 1;
      const dto = {
        tenantId: 'tenant-123',
        page: 1,
        limit: 50,
      };

      const mockMessages: TenantMessage[] = [
        {
          id: 1,
          channelId: 1,
          tenantId: 'tenant-123',
          content: 'Hello',
          isFromUser: true,
          messageType: 'text',
          senderId: null,
          externalId: null,
          status: 'received',
          metadata: null,
          readAt: null,
          createdAt: new Date(),
        },
      ];

      const queryResults = new Map<string, any[]>();
      queryResults.set('FROM messages', mockMessages);
      queryResults.set('COUNT(*)', [{ count: BigInt(1) }]);

      const mockTx = createMockTx({ queryRawResults: queryResults });

      tenantPrisma.runInTenantContext.mockImplementation(async (tenantId, callback) => {
        return callback(mockTx);
      });

      // Act
      const result = await service.getMessages(channelId, dto);

      // Assert
      expect(result.data).toHaveLength(1);
      expect(result.meta.total).toBe(1);
    });
  });

  describe('markAsRead', () => {
    it('应该标记消息为已读', async () => {
      // Arrange
      const channelId = 1;
      const tenantId = 'tenant-123';

      const mockTx = createMockTx();

      tenantPrisma.runInTenantContext.mockImplementation(async (tid, callback) => {
        return callback(mockTx);
      });

      // Act
      await service.markAsRead(channelId, tenantId);

      // Assert
      expect(tenantPrisma.runInTenantContext).toHaveBeenCalledWith(tenantId, expect.any(Function));
      expect(mockTx.$executeRaw).toHaveBeenCalled();
    });

    it('应该验证 channelId 是有效的正整数', async () => {
      // Act & Assert
      await expect(service.markAsRead(0, 'tenant-123')).rejects.toThrow('Invalid channelId');
    });
  });
});
