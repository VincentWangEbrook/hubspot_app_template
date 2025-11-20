'use client';
import { useState, useEffect, useRef, FormEvent } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { apiFetch } from '@/lib/apiFetch';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Loader } from '@/components/ui/Loader';
import { AlertCircle, Send, ArrowLeft, Check } from 'lucide-react';

// 消息类型定义（明确类型）
interface LineMessage {
  id: number;
  content: string;
  isLine: boolean;
  createdAt: string;
  tenantId: string;
}

// 格式化日期时间
const formatMessageTime = (dateString: string) => {
  const date = new Date(dateString);
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

export default function LineChatPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const tenantId = searchParams.get('tenantId');
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
      const res = await apiFetch(`/line/messages?channelId=${channelId}`, {
        headers: { 'X-Tenant-Id': tenantId },
      });

      if (res.success && Array.isArray(res.data)) {
        setMessages(res.data as LineMessage[]); // 明确类型断言
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

  useEffect(() => {
    if (tenantId && channelId) {
      fetchMessageHistory();

      // 轮询获取新消息（5秒一次）
      const interval = setInterval(fetchMessageHistory, 5000);
      return () => clearInterval(interval);
    }
  }, [tenantId, channelId]);

  // 自动滚动到底部
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // 发送消息
  const handleSendMessage = async (e: FormEvent) => {
    e.preventDefault();
    const trimmedValue = inputValue.trim();

    if (!trimmedValue || !tenantId || !channelId) return;

    try {
      setIsSending(true);
      await apiFetch(
        '/line/reply',
        { 
            headers: { 'X-Tenant-Id': tenantId },
            data: {
                channelId: Number(channelId),
                message: trimmedValue,
            }
        }
      );

      // 发送成功后清空输入框并刷新消息
      setInputValue('');
      await fetchMessageHistory();
    } catch (err) {
      console.error('发送消息失败:', err);
      alert('发送消息失败，请重试');
    } finally {
      setIsSending(false);
    }
  };

  if (loading) {
    return (
      <div className="container py-8 mx-auto">
        <Card shadow="lg" padding="xl" className="max-w-2xl mx-auto">
          <Loader size="lg" label="加载聊天记录中..." />
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container py-8 mx-auto">
        <Card shadow="lg" padding="xl" className="max-w-2xl mx-auto">
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
      <Card shadow="lg" className="max-w-2xl mx-auto flex flex-col h-[85vh]">
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
          <div className="w-8"></div> {/* 占位，保持头部居中 */}
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
                className={`flex ${msg.isLine ? 'justify-start' : 'justify-end'}`}
              >
                <div className={`max-w-[75%] p-4 ${msg.isLine ? 'message-in' : 'message-out'}`}>
                  <p className="whitespace-pre-wrap">{msg.content}</p>
                  <div
                    className={`flex items-center mt-1 text-xs ${
                      msg.isLine ? 'text-gray-400' : 'text-primary-200'
                    }`}
                  >
                    {formatMessageTime(msg.createdAt)}
                    {!msg.isLine && (
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
              disabled={isSending}
            />
            <Button
              type="submit"
              variant="primary"
              size="lg"
              isLoading={isSending}
              disabled={!inputValue.trim() || isSending}
            >
              <Send size={18} />
            </Button>
          </form>
          <p className="text-xs text-gray-500 mt-2 text-center">
            消息将实时同步到 Line 客户端
          </p>
        </div>
      </Card>
    </div>
  );
}