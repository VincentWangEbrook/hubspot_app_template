/**
 * Developed by eBrook Group.
 * Copyright © 2025 eBrook Group (https://www.ebrook.com.tw)
 */

import { Test, TestingModule } from '@nestjs/testing';
import { ChannelAdapterFactory } from '../channel-adapter.factory';
import { LineChannelAdapter } from '../adapters/line.adapter';
import { WeChatChannelAdapter } from '../adapters/wechat.adapter';

describe('ChannelAdapterFactory', () => {
  let factory: ChannelAdapterFactory;
  let lineAdapter: jest.Mocked<LineChannelAdapter>;
  let wechatAdapter: jest.Mocked<WeChatChannelAdapter>;

  beforeEach(async () => {
    const mockLineAdapter = {
      channelType: 'LINE',
      sendMessage: jest.fn(),
      handleWebhook: jest.fn(),
    };

    const mockWeChatAdapter = {
      channelType: 'WECHAT',
      sendMessage: jest.fn(),
      handleWebhook: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ChannelAdapterFactory,
        { provide: LineChannelAdapter, useValue: mockLineAdapter },
        { provide: WeChatChannelAdapter, useValue: mockWeChatAdapter },
      ],
    }).compile();

    factory = module.get<ChannelAdapterFactory>(ChannelAdapterFactory);
    lineAdapter = module.get(LineChannelAdapter);
    wechatAdapter = module.get(WeChatChannelAdapter);
  });

  describe('getAdapter', () => {
    it('应该返回 LINE 适配器', () => {
      // Act
      const adapter = factory.getAdapter('LINE');

      // Assert
      expect(adapter).toBe(lineAdapter);
      expect(adapter.channelType).toBe('LINE');
    });

    it('应该返回 WeChat 适配器', () => {
      // Act
      const adapter = factory.getAdapter('WECHAT');

      // Assert
      expect(adapter).toBe(wechatAdapter);
      expect(adapter.channelType).toBe('WECHAT');
    });

    it('应该在不支持的渠道类型时抛出错误', () => {
      // Act & Assert
      expect(() => factory.getAdapter('UNSUPPORTED' as any)).toThrow(
        'Unsupported channel type: UNSUPPORTED',
      );
    });
  });

  describe('registerAdapter', () => {
    it('应该支持动态注册新适配器', () => {
      // Arrange
      const customAdapter = {
        channelType: 'CUSTOM' as any,
        sendMessage: jest.fn(),
        handleWebhook: jest.fn(),
        getUserProfile: jest.fn(),
        verifyWebhookSignature: jest.fn(),
      };

      // Act
      factory.registerAdapter(customAdapter);
      const adapter = factory.getAdapter('CUSTOM' as any);

      // Assert
      expect(adapter).toBe(customAdapter);
    });
  });

  describe('getSupportedChannels', () => {
    it('应该返回所有已注册的渠道类型', () => {
      // Act
      const channels = factory.getSupportedChannels();

      // Assert
      expect(channels).toContain('LINE');
      expect(channels).toContain('WECHAT');
      expect(channels.length).toBeGreaterThanOrEqual(2);
    });
  });
});
