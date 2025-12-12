'use client';
import { useState, useEffect, useRef, FormEvent } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useTenant } from '@/context/TenantContext';
import { apiFetch } from '@/lib/apiFetch';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Loader } from '@/components/ui/Loader';
import { AlertCircle, Send, ArrowLeft, Check, WifiOff } from 'lucide-react';
import { useSocket } from '@/context/SocketContext';

// 消息类型定义（明确类型）
interface LineMessage {
  id: number;
  content: string;
  isFromUser: boolean; // true = from Line user, false = from System/HubSpot
  createdAt: string;
  channelId: number;
}

// 格式化日期时间
const formatMessageTime = (dateString: string) => {
  const date = new Date(dateString);
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

export default function LineChatPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { socket, isConnected } = useSocket();
  const { tenantId } = useTenant(); // 使用 useTenant hook 获取租户ID
  const channelId = searchParams.get('channelId');
  
  const [messages, setMessages] = useState<LineMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // 验证参数（Next.js 16 搜索参数可能为 null）
  useEffect(() => {
    if (!tenantId || !channelId) {
      setError('缺少租户 ID 或聊天通道 ID，无法加载聊天窗口');
      setLoading(false);
    }
  }, [tenantId, channelId]);

  // 加载历史消息
  const fetchMessageHistory = async () => {
    if (!tenantId || !channelId) return;

    try {
      setError(null);
      const res = await apiFetch(`/chat/messages/${channelId}?tenantId=${tenantId}`);

      if (Array.isArray(res)) {
        setMessages(res as LineMessage[]);
      } else {
        setError('获取聊天记录失败');
      }
    } catch (err) {
      console.error('获取聊天记录失败:', err);
      setError('获取聊天记录失败，请重试');
    } finally {
      setLoading(false);
    }
  };

  // 初始加载消息
  useEffect(() => {
    if (tenantId && channelId) {
      fetchMessageHistory();
    }
  }, [tenantId, channelId]);

  // WebSocket: Join channel room and listen for messages
  useEffect(() => {
    if (!socket || !channelId || !tenantId) return;

    // Join tenant and channel rooms
    socket.emit('join', tenantId);
    socket.emit('join', `channel_${channelId}`);

    const handleMessage = (event: any) => {
      if (event.event === 'message.created') {
        const newMsg = event.data;
        // Only append if it belongs to current channel
        if (newMsg.channelId === parseInt(channelId)) {
          setMessages((prev) => [...prev, newMsg]);
        }
      }
    };

    socket.on('message', handleMessage);

    return () => {
      socket.emit('leave', tenantId);
      socket.emit('leave', `channel_${channelId}`);
      socket.off('message', handleMessage);
    };
  }, [socket, channelId, tenantId]);

  // 自动滚动到底部
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // 发送消息
  const handleSendMessage = async (e: FormEvent) => {
    e.preventDefault();
    const trimmedValue = inputValue.trim();

    if (!trimmedValue || !tenantId || !channelId) return;

    // Optimistic update
    const tempId = Date.now();
    const optimisticMsg: LineMessage = {
      id: tempId,
      content: trimmedValue,
      isFromUser: false,
      createdAt: new Date().toISOString(),
      channelId: parseInt(channelId),
    };
    setMessages((prev) => [...prev, optimisticMsg]);
    setInputValue('');

    try {
      setIsSending(true);
      await apiFetch('/chat/messages', {
        headers: { 'X-Tenant-Id': tenantId },
        data: {
          tenantId,
          channelId: Number(channelId),
          content: trimmedValue,
        },
      });

      // Real message will arrive via WebSocket, remove optimistic one
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
    } catch (err) {
      console.error('发送消息失败:', err);
      // Remove optimistic message on error
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
      alert('发送消息失败，请重试');
    } finally {
      setIsSending(false);
    }
  };

  if (loading) {
    return (
      <div className="container py-8 mx-auto">
        <Card className="max-w-2xl mx-auto px-6 py-8 shadow-lg">
          <Loader size="lg" label="加载聊天记录中..." />
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container py-8 mx-auto">
        <Card className="max-w-2xl mx-auto px-6 py-8 shadow-lg">
          <div className="flex items-start gap-4 text-red-500">
            <AlertCircle size={24} />
            <div className="flex-1">
              <h3 className="text-lg font-semibold">聊天窗口加载失败</h3>
              <p className="mt-2 text-gray-600">{error}</p>
              <div className="flex gap-3 mt-4">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => window.location.reload()}
                >
                  重试
                </Button>
                <Button variant="ghost" size="sm" onClick={() => router.back()}>
                  返回上一页
                </Button>
              </div>
            </div>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="container py-8 mx-auto">
      <Card className="max-w-2xl mx-auto flex flex-col h-[85vh] shadow-lg">
        {/* 聊天头部 */}
        <div className="border-b border-gray-100 p-4 flex items-center justify-between">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.back()}
            className="p-0 mr-2"
          >
            <ArrowLeft size={20} />
          </Button>
          <h2 className="text-xl font-semibold flex-1 text-center">Line 聊天窗口</h2>
          <div className="flex items-center gap-2">
            {!isConnected && (
              <div className="flex items-center gap-1 text-red-500 text-sm">
                <WifiOff size={16} />
                <span>未连接</span>
              </div>
            )}
            {isConnected && (
              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
            )}
          </div>
        </div>

        {/* 聊天内容区域 */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50">
          {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-gray-500">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="48"
                height="48"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="mb-4 opacity-50"
              >
                <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
              </svg>
              <p>暂无聊天记录，开始发送消息吧～</p>
            </div>
          ) : (
            messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex ${msg.isFromUser ? 'justify-start' : 'justify-end'}`}
              >
                <div className={`max-w-[75%] p-4 ${msg.isFromUser ? 'message-in' : 'message-out'}`}>
                  <p className="whitespace-pre-wrap">{msg.content}</p>
                  <div
                    className={`flex items-center mt-1 text-xs ${
                      msg.isFromUser ? 'text-gray-400' : 'text-primary-200'
                    }`}
                  >
                    {formatMessageTime(msg.createdAt)}
                    {!msg.isFromUser && (
                      <Check size={12} className="ml-1" />
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
          <div ref={messagesEndRef}></div>
        </div>

        {/* 消息输入区域 */}
        <div className="border-t border-gray-100 p-4">
          <form onSubmit={handleSendMessage} className="flex gap-3">
            <Input
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder="输入消息..."
              className="flex-1"
              disabled={isSending || !isConnected}
            />
            <Button
              type="submit"
              variant="primary"
              size="lg"
              isLoading={isSending}
              disabled={!inputValue.trim() || isSending || !isConnected}
            >
              <Send size={18} />
            </Button>
          </form>
          <p className="text-xs text-gray-500 mt-2 text-center">
            {isConnected ? '消息将实时同步到 Line 客户端' : '连接已断开，正在重连...'}
          </p>
        </div>
      </Card>
    </div>
  );
}
