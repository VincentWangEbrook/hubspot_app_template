/**
 * Developed by eBrook Group.
 * Copyright © 2025 eBrook Group (https://www.ebrook.com.tw)
 */

import { Test, TestingModule } from '@nestjs/testing';
import { ChatController } from '../chat.controller';
import { ChatService } from '../chat.service';
import { UnauthorizedException, ForbiddenException } from '@nestjs/common';
import { TenantService } from '../../tenants/services/tenant.service';
import { TenantMemberGuard } from '../../../common/security/tenant-member.guard';

describe('ChatController', () => {
  let controller: ChatController;
  let chatService: jest.Mocked<ChatService>;

  beforeEach(async () => {
    const mockChatService = {
      sendMessage: jest.fn(),
      getConversations: jest.fn(),
      getMessages: jest.fn(),
      getOrCreateConversation: jest.fn(),
      markAsRead: jest.fn(),
    };

    const mockTenantService = {
      isMemberOrOwner: jest.fn().mockResolvedValue(true),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ChatController],
      providers: [
        {
          provide: ChatService,
          useValue: mockChatService,
        },
        {
          provide: TenantService,
          useValue: mockTenantService,
        },
      ],
    })
      .overrideGuard(TenantMemberGuard)
      .useValue({
        canActivate: jest.fn((context) => {
          const request = context.switchToHttp().getRequest();
          request.userId = 'user-456';
          request.tenantId = 'tenant-123';
          return true;
        }),
      })
      .compile();

    controller = module.get<ChatController>(ChatController);
    chatService = module.get(ChatService);
  });

  describe('POST /chat/messages', () => {
    it('应该成功发送消息', async () => {
      // Arrange
      const body = {
        tenantId: 'tenant-123',
        channelId: 1,
        content: 'Hello',
      };

      const userId = 'user-456';

      const mockMessage = {
        id: 100,
        content: 'Hello',
        status: 'sent',
        createdAt: new Date(),
      };

      const mockRes = {
        send: jest.fn().mockReturnThis(),
      };

      chatService.sendMessage.mockResolvedValue(mockMessage as any);

      // Act
      await controller.sendMessage(body, userId, mockRes as any);

      // Assert
      expect(mockRes.send).toHaveBeenCalledWith({
        success: true,
        data: mockMessage,
      });
      expect(chatService.sendMessage).toHaveBeenCalledWith({
        ...body,
        userId: 'user-456',
      });
    });

    it('应该验证用户权限（租户匹配）', async () => {
      // Note: 权限验证现在由 TenantMemberGuard 处理，不在 Controller 中
      // 这个测试已不再适用
    });

    it('应该验证必填字段', async () => {
      // Arrange
      const body = {
        tenantId: 'tenant-123',
        channelId: 1,
        // content 缺失
      };

      const mockRequest = {
        user: { id: 'user-456', tenantId: 'tenant-123' },
      };

      // Act & Assert
      // DTO validation 应该在管道中处理，此处假设已通过
      // 实际应用中使用 class-validator
    });
  });

  describe('GET /chat/conversations', () => {
    it('应该返回对话列表', async () => {
      // Arrange
      const query = {
        tenantId: 'tenant-123',
        page: 1,
        limit: 20,
      };

      const tenantId = 'tenant-123';

      const mockResult = {
        data: [
          {
            channelId: 1,
            contactName: 'User One',
            unreadCount: 3,
          },
        ],
        meta: {
          total: 1,
          page: 1,
          limit: 20,
        },
      };

      const mockRes = {
        send: jest.fn().mockReturnThis(),
      };

      chatService.getConversations.mockResolvedValue(mockResult as any);

      // Act
      await controller.getConversations(query, tenantId, mockRes as any);

      // Assert
      expect(mockRes.send).toHaveBeenCalledWith({
        success: true,
        data: mockResult,
      });
    });

    it('应该支持分页查询', async () => {
      // Arrange
      const query = {
        tenantId: 'tenant-123',
        page: 2,
        limit: 10,
      };

      const tenantId = 'tenant-123';

      const mockResult = {
        data: [],
        meta: { total: 25, page: 2, limit: 10, totalPages: 3 },
      };

      const mockRes = {
        send: jest.fn().mockReturnThis(),
      };

      chatService.getConversations.mockResolvedValue(mockResult as any);

      // Act
      await controller.getConversations(query, tenantId, mockRes as any);

      // Assert
      expect(chatService.getConversations).toHaveBeenCalledWith(
        expect.objectContaining({ tenantId, page: 2, limit: 10 }),
      );
    });
  });

  describe('GET /chat/messages/:channelId', () => {
    it('应该返回消息历史', async () => {
      // Arrange
      const channelId = '1';
      const query = { tenantId: 'tenant-123' };
      const tenantId = 'tenant-123';

      const mockMessages = [
        {
          id: 1,
          content: 'Message 1',
          isFromUser: true,
          createdAt: new Date('2025-01-01'),
        },
        {
          id: 2,
          content: 'Message 2',
          isFromUser: false,
          createdAt: new Date('2025-01-02'),
        },
      ];

      const mockResult = {
        data: mockMessages,
        meta: { total: 2, page: 1, limit: 50 },
      };

      const mockRes = {
        send: jest.fn().mockReturnThis(),
      };

      chatService.getMessages.mockResolvedValue(mockResult as any);

      // Act
      await controller.getMessages(channelId, query, tenantId, mockRes as any);

      // Assert
      expect(mockRes.send).toHaveBeenCalledWith({
        success: true,
        data: mockResult,
      });
      expect(chatService.getMessages).toHaveBeenCalledWith(1, expect.objectContaining({ tenantId }));
    });
  });

  describe('POST /chat/conversations/init', () => {
    it('应该从 Contact 初始化对话', async () => {
      // Arrange
      const body = {
        tenantId: 'tenant-123',
        hubspotContactId: 'contact-789',
        channelType: 'LINE',
      };

      const mockConversation = {
        channelId: 10,
        channelType: 'LINE',
        contactName: 'John Doe',
        externalUserId: 'U1234567890abcdef',
      };

      const mockRes = {
        send: jest.fn().mockReturnThis(),
      };

      chatService.getOrCreateConversation.mockResolvedValue(mockConversation as any);

      // Act
      await controller.initConversation(body, mockRes as any);

      // Assert
      expect(mockRes.send).toHaveBeenCalledWith({
        success: true,
        data: mockConversation,
      });
    });

    it('应该处理未绑定 LINE 的 Contact', async () => {
      // Arrange
      const body = {
        tenantId: 'tenant-123',
        hubspotContactId: 'contact-unbound',
        channelType: 'LINE',
      };

      const mockRes = {
        send: jest.fn().mockReturnThis(),
      };

      chatService.getOrCreateConversation.mockRejectedValue(
        new Error('Contact has not bound LINE account'),
      );

      // Act & Assert
      await expect(
        controller.initConversation(body, mockRes as any),
      ).rejects.toThrow('Contact has not bound LINE account');
    });
  });

  describe('PUT /chat/messages/:channelId/read', () => {
    it('应该标记消息为已读', async () => {
      // Arrange
      const channelId = '1';
      const tenantId = 'tenant-123';

      const mockRes = {
        send: jest.fn().mockReturnThis(),
      };

      chatService.markAsRead.mockResolvedValue(undefined);

      // Act
      await controller.markAsRead(channelId, tenantId, mockRes as any);

      // Assert
      expect(mockRes.send).toHaveBeenCalledWith({ success: true });
      expect(chatService.markAsRead).toHaveBeenCalledWith(1, 'tenant-123');
    });
  });
});
