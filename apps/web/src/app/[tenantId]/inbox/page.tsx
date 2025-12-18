/**
 * Developed by eBrook Group.
 * Copyright © 2025 eBrook Group (https://www.ebrook.com.tw)
 */

'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useTenant } from '@/context/TenantContext';
import { useSocket } from '@/context/SocketContext';
import { apiFetch } from '@/lib/apiFetch';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Loader } from '@/components/ui/Loader';
import { 
  Search, 
  MessageCircle, 
  Filter,
  RefreshCw,
  Mail,
  MailOpen,
} from 'lucide-react';

interface ConversationSummary {
  channelId: number;
  channelType: string;
  externalUserId: string;
  hubspotContactId: string;
  contactName: string;
  contactAvatar?: string;
  lastMessage?: {
    content: string;
    createdAt: string;
    isFromUser: boolean;
  };
  unreadCount: number;
  updatedAt: string;
}

interface ConversationsResponse {
  data: ConversationSummary[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export default function InboxPage() {
  const router = useRouter();
  const { tenantId } = useTenant();
  const { socket, isConnected } = useSocket();

  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // 搜索和过滤
  const [searchQuery, setSearchQuery] = useState('');
  const [channelTypeFilter, setChannelTypeFilter] = useState<string>('');
  
  // 分页
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  /**
   * 加载对话列表
   */
  const loadConversations = async (page: number = 1) => {
    if (!tenantId) return;

    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams({
        tenantId,
        page: page.toString(),
        limit: '20',
      });

      if (searchQuery) {
        params.append('search', searchQuery);
      }

      if (channelTypeFilter) {
        params.append('channelType', channelTypeFilter);
      }

      const response = await apiFetch<ConversationsResponse>(
        `/chat/conversations?${params.toString()}`,
        {
          method: 'GET',
        }
      );
      setConversations(response.data!.data);
      setTotal(response.data!.meta!.total);
      setCurrentPage(response.data!.meta!.page);
      setTotalPages(response.data!.meta!.totalPages);
    } catch (err: any) {
      console.error('Failed to load conversations:', err);
      setError(err.message || '加载对话列表失败');
    } finally {
      setLoading(false);
    }
  };

  /**
   * 初始加载
   */
  useEffect(() => {
    loadConversations(1);
  }, [tenantId]);

  /**
   * 搜索/过滤变化时重新加载
   */
  useEffect(() => {
    const timer = setTimeout(() => {
      if (tenantId) {
        loadConversations(1);
      }
    }, 500); // 防抖 500ms

    return () => clearTimeout(timer);
  }, [searchQuery, channelTypeFilter]);

  /**
   * WebSocket: 监听新消息
   */
  useEffect(() => {
    if (!socket || !isConnected || !tenantId) return;

    // 加入租户房间
    socket.emit('join', tenantId);

    // 监听新消息
    const handleMessage = (event: any) => {
      if (event.event === 'message.created') {
        // 更新对话列表中的对应对话
        setConversations((prev) =>
          prev.map((conv) =>
            conv.channelId === event.data.channelId
              ? {
                  ...conv,
                  lastMessage: {
                    content: event.data.content,
                    createdAt: event.data.createdAt,
                    isFromUser: event.data.isFromUser,
                  },
                  unreadCount: event.data.isFromUser
                    ? conv.unreadCount + 1
                    : conv.unreadCount,
                }
              : conv
          )
        );
      }
    };

    socket.on('message', handleMessage);

    return () => {
      socket.off('message', handleMessage);
      socket.emit('leave', tenantId);
    };
  }, [socket, isConnected, tenantId]);

  /**
   * 打开对话
   */
  const handleOpenConversation = (channelId: number) => {
    router.push(`/${tenantId}/hubspot/line-chat?channelId=${channelId}`);
  };

  /**
   * 格式化时间
   */
  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}天前`;
    if (hours > 0) return `${hours}小时前`;
    if (minutes > 0) return `${minutes}分钟前`;
    return '刚刚';
  };

  /**
   * 获取渠道图标
   */
  const getChannelIcon = (channelType: string) => {
    switch (channelType) {
      case 'LINE':
        return '💬';
      case 'WECHAT':
        return '💚';
      default:
        return '📱';
    }
  };

  if (!tenantId) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Card className="p-6">
          <p className="text-red-600">未找到租户信息</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-6 max-w-6xl">
      {/* 头部 */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">收件箱</h1>
        <p className="text-gray-600">
          管理所有渠道的对话 • {total} 个对话
        </p>
      </div>

      {/* 搜索和过滤栏 */}
      <Card className="mb-6 p-4">
        <div className="flex flex-col sm:flex-row gap-4">
          {/* 搜索框 */}
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <Input
              type="text"
              placeholder="搜索联系人姓名..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>

          {/* 渠道过滤 */}
          <div className="flex gap-2">
            <Button
              variant={channelTypeFilter === '' ? 'default' : 'outline'}
              onClick={() => setChannelTypeFilter('')}
              size="sm"
            >
              全部
            </Button>
            <Button
              variant={channelTypeFilter === 'LINE' ? 'default' : 'outline'}
              onClick={() => setChannelTypeFilter('LINE')}
              size="sm"
            >
              💬 LINE
            </Button>
            <Button
              variant={channelTypeFilter === 'WECHAT' ? 'default' : 'outline'}
              onClick={() => setChannelTypeFilter('WECHAT')}
              size="sm"
            >
              💚 WeChat
            </Button>
          </div>

          {/* 刷新按钮 */}
          <Button
            variant="outline"
            onClick={() => loadConversations(currentPage)}
            disabled={loading}
            size="sm"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </Card>

      {/* WebSocket 状态 */}
      {!isConnected && (
        <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-yellow-500 animate-pulse" />
          <span className="text-sm text-yellow-700">
            实时连接中断，消息可能不会实时更新
          </span>
        </div>
      )}

      {/* 错误提示 */}
      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-red-600">{error}</p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => loadConversations(currentPage)}
            className="mt-2"
          >
            重试
          </Button>
        </div>
      )}

      {/* 加载中 */}
      {loading && conversations.length === 0 ? (
        <div className="flex justify-center items-center py-12">
          <Loader size="lg" />
        </div>
      ) : conversations.length === 0 ? (
        /* 空状态 */
        <Card className="p-12 text-center">
          <MessageCircle className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-xl font-semibold mb-2">暂无对话</h3>
          <p className="text-gray-600 mb-4">
            {searchQuery || channelTypeFilter
              ? '没有找到匹配的对话'
              : '开始与您的联系人聊天吧'}
          </p>
          {(searchQuery || channelTypeFilter) && (
            <Button
              variant="outline"
              onClick={() => {
                setSearchQuery('');
                setChannelTypeFilter('');
              }}
            >
              清除筛选
            </Button>
          )}
        </Card>
      ) : (
        <>
          {/* 对话列表 */}
          <div className="space-y-2">
            {conversations.map((conversation) => (
              <Card
                key={conversation.channelId}
                className={`p-4 cursor-pointer hover:shadow-md transition-shadow ${
                  conversation.unreadCount > 0 ? 'bg-blue-50 border-blue-200' : ''
                }`}
                onClick={() => handleOpenConversation(conversation.channelId)}
              >
                <div className="flex items-start gap-4">
                  {/* 头像 */}
                  <div className="flex-shrink-0">
                    {conversation.contactAvatar ? (
                      <img
                        src={conversation.contactAvatar}
                        alt={conversation.contactName}
                        className="w-12 h-12 rounded-full"
                      />
                    ) : (
                      <div className="w-12 h-12 rounded-full bg-gray-200 flex items-center justify-center text-2xl">
                        {getChannelIcon(conversation.channelType)}
                      </div>
                    )}
                  </div>

                  {/* 内容 */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <h3
                          className={`font-semibold ${
                            conversation.unreadCount > 0
                              ? 'text-blue-600'
                              : 'text-gray-900'
                          }`}
                        >
                          {conversation.contactName}
                        </h3>
                        <span className="text-xs text-gray-500">
                          {conversation.channelType}
                        </span>
                      </div>
                      <span className="text-xs text-gray-500">
                        {conversation.lastMessage &&
                          formatTime(conversation.lastMessage.createdAt)}
                      </span>
                    </div>

                    {/* 最后一条消息 */}
                    {conversation.lastMessage && (
                      <p
                        className={`text-sm truncate ${
                          conversation.unreadCount > 0
                            ? 'text-gray-700 font-medium'
                            : 'text-gray-600'
                        }`}
                      >
                        {conversation.lastMessage.isFromUser ? '' : '我: '}
                        {conversation.lastMessage.content}
                      </p>
                    )}
                  </div>

                  {/* 未读计数 */}
                  {conversation.unreadCount > 0 && (
                    <div className="flex-shrink-0">
                      <div className="bg-blue-500 text-white text-xs font-bold rounded-full w-6 h-6 flex items-center justify-center">
                        {conversation.unreadCount > 99
                          ? '99+'
                          : conversation.unreadCount}
                      </div>
                    </div>
                  )}
                </div>
              </Card>
            ))}
          </div>

          {/* 分页 */}
          {totalPages > 1 && (
            <div className="mt-6 flex items-center justify-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => loadConversations(currentPage - 1)}
                disabled={currentPage === 1 || loading}
              >
                上一页
              </Button>
              <span className="text-sm text-gray-600">
                第 {currentPage} / {totalPages} 页
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => loadConversations(currentPage + 1)}
                disabled={currentPage === totalPages || loading}
              >
                下一页
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
