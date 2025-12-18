/**
 * Developed by eBrook Group.
 * Copyright © 2025 eBrook Group (https://www.ebrook.com.tw)
 */
import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  MessageBody,
  ConnectedSocket,
  WsException,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { RedisService } from '../redis/redis.service';

@WebSocketGateway({
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true, // 允许携带 cookie
  },
  namespace: 'chat',
})
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(ChatGateway.name);

  constructor(private readonly redisService: RedisService) {}

  /**
   * 从 cookie 字符串中解析 sessionId
   * @fastify/session 的 cookie 值格式: sessionId.signature
   * Redis 中存储的 key 只是 sessionId（不含签名）
   */
  private parseSessionId(cookieHeader: string | undefined): string | null {
    if (!cookieHeader) return null;
    
    const cookies = cookieHeader.split(';').reduce((acc, cookie) => {
      const [key, ...valueParts] = cookie.trim().split('=');
      const value = valueParts.join('='); // 处理值中包含 = 的情况
      if (key && value) {
        acc[key.trim()] = value;
      }
      return acc;
    }, {} as Record<string, string>);

    let sessionId = cookies['sessionId'];
    if (!sessionId) return null;

    // URL 解码
    try {
      sessionId = decodeURIComponent(sessionId);
    } catch {
      // 解码失败则使用原值
    }

    // fastify-cookie 签名格式: value.signature
    // 提取 "." 之前的部分作为真正的 sessionId
    const dotIndex = sessionId.indexOf('.');
    if (dotIndex > 0) {
      sessionId = sessionId.substring(0, dotIndex);
    }
    
    return sessionId;
  }

  /**
   * 验证 WebSocket 连接
   * @security 🔒 使用 Session Cookie 认证
   */
  async handleConnection(client: Socket) {
    try {
      // 从 handshake headers 中获取 cookie
      const cookieHeader = client.handshake.headers.cookie;
      const sessionId = this.parseSessionId(cookieHeader);

      if (!sessionId) {
        this.logger.warn(`Connection rejected: No session cookie (${client.id})`);
        client.emit('error', { message: 'Unauthorized', code: 'NO_SESSION' });
        client.disconnect();
        return;
      }

      // 检查 Redis 是否可用
      if (!this.redisService.isConnected()) {
        this.logger.warn(`Connection rejected: Redis not available (${client.id})`);
        client.emit('error', { message: 'Service unavailable', code: 'REDIS_DOWN' });
        client.disconnect();
        return;
      }

      // 从 Redis 获取 session 数据
      const sessionData = await this.redisService.get(sessionId);
      if (!sessionData) {
        this.logger.warn(`Connection rejected: Invalid session (${client.id})`);
        client.emit('error', { message: 'Session expired', code: 'SESSION_EXPIRED' });
        client.disconnect();
        return;
      }

      const session = JSON.parse(sessionData);
      const user = session.user;

      if (!user || !user.id) {
        this.logger.warn(`Connection rejected: No user in session (${client.id})`);
        client.emit('error', { message: 'Not logged in', code: 'NOT_LOGGED_IN' });
        client.disconnect();
        return;
      }

      // 将用户信息存储到 socket 的 data 中
      client.data.user = {
        id: user.id,
        email: user.email,
        username: user.username,
      };

      this.logger.log(`Client connected: ${client.id} (User: ${user.id})`);
    } catch (error: any) {
      this.logger.error(`Connection error for ${client.id}: ${error.message}`);
      client.emit('error', { message: 'Authentication failed', code: 'AUTH_ERROR' });
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {
    // 清理客户端数据，防止内存泄漏
    if (client.data.user) {
      delete client.data.user;
    }
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  /**
   * Join a room based on tenantId or channelId
   */
  @SubscribeMessage('join')
  handleJoinRoom(
    @MessageBody() room: string,
    @ConnectedSocket() client: Socket,
  ) {
    const user = client.data.user;
    
    if (!user) {
      throw new WsException('Unauthorized');
    }

    // 验证房间名有效性
    if (!room || typeof room !== 'string' || room.trim().length === 0) {
      this.logger.warn(`Invalid room name from user ${user.id}: ${room}`);
      throw new WsException('Invalid room name');
    }

    // 限制房间名长度，防止内存攻击
    if (room.length > 200) {
      throw new WsException('Room name too long');
    }

    // 验证房间格式
    if (room.startsWith('channel_')) {
      const channelId = room.split('_')[1];
      if (!channelId || isNaN(Number(channelId))) {
        throw new WsException('Invalid channel room format');
      }
    }

    client.join(room);
    this.logger.log(`Client ${client.id} (User: ${user.id}) joined room: ${room}`);
    return { event: 'joined', room };
  }

  /**
   * Leave a room
   */
  @SubscribeMessage('leave')
  handleLeaveRoom(
    @MessageBody() room: string,
    @ConnectedSocket() client: Socket,
  ) {
    client.leave(room);
    this.logger.log(`Client ${client.id} left room: ${room}`);
    return { event: 'left', room };
  }

  /**
   * Handle typing indicator
   */
  @SubscribeMessage('typing')
  handleTyping(
    @MessageBody() data: { channelId: number; isTyping: boolean },
    @ConnectedSocket() client: Socket,
  ) {
    const user = client.data.user;
    
    if (!user) {
      throw new WsException('Unauthorized');
    }

    const room = `channel_${data.channelId}`;

    this.server.to(room).emit('typing', {
      channelId: data.channelId,
      userId: user.id,
      isTyping: data.isTyping,
    });
  }

  /**
   * Emit a message to a specific room (channelId or tenantId)
   */
  emitMessageToRoom(room: string, message: any) {
    this.server.to(room).emit('message', message);
  }
}
