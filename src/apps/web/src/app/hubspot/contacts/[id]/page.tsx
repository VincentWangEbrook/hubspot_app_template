'use client';
import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { apiFetch } from '@/lib/apiFetch';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Loader } from '@/components/ui/Loader';
import { AlertCircle } from 'lucide-react';

// 明确联系人类型定义（Next.js 16 类型推导更严格）
interface Contact {
  id: string;
  firstname: string;
  email: string;
  line_display_name?: string;
  line_user_id?: string;
  createdate?: string;
  lastmodifieddate?: string;
  [key: string]: any;
}

export default function ContactDetailPage() {
  const params = useParams();
  const id = params.id as string; // 明确类型转换
  const router = useRouter();
  const [contact, setContact] = useState<Contact | null>(null);
  const [lineChannel, setLineChannel] = useState<{ id: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const tenantId = localStorage.getItem('activeTenantId');

  useEffect(() => {
    const fetchContactDetail = async () => {
      if (!id || !tenantId) {
        setError('缺少联系人 ID 或租户信息');
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);

        // 并行请求：优化性能
        const [contactRes, channelRes] = await Promise.all([
            apiFetch(`/hubspot/contacts/${id}`, {
                headers: { 'X-Tenant-Id': tenantId },
            }),
            apiFetch(`/line/channel?contactId=${id}`, {
                headers: { 'X-Tenant-Id': tenantId },
            }),
        ]);

        setContact(contactRes.data as Contact); // 明确类型断言
        if (channelRes.success && channelRes.data) {
          setLineChannel(channelRes.data);
        }
      } catch (err) {
        console.error('获取联系人详情失败:', err);
        setError('获取联系人信息失败，请刷新页面重试');
      } finally {
        setLoading(false);
      }
    };

    fetchContactDetail();
  }, [id, tenantId]);

  const openLineChat = () => {
    if (lineChannel && tenantId) {
      router.push(`/hubspot/line-chat?tenantId=${tenantId}&channelId=${lineChannel.id}`);
    }
  };

  if (loading) {
    return (
      <div className="container py-12 mx-auto">
        <Card shadow="lg" padding="xl" className="max-w-3xl mx-auto">
          <Loader size="lg" label="加载联系人详情中..." />
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container py-12 mx-auto">
        <Card shadow="lg" padding="xl" className="max-w-3xl mx-auto">
          <div className="flex items-start gap-4 text-red-500">
            <AlertCircle size={24} />
            <div>
              <h3 className="text-lg font-semibold">操作失败</h3>
              <p className="mt-2 text-gray-600">{error}</p>
              <Button
                variant="secondary"
                size="sm"
                className="mt-4"
                onClick={() => window.location.reload()}
              >
                刷新页面
              </Button>
            </div>
          </div>
        </Card>
      </div>
    );
  }

  if (!contact) {
    return (
      <div className="container py-12 mx-auto">
        <Card shadow="lg" padding="xl" className="max-w-3xl mx-auto">
          <div className="flex items-start gap-4 text-orange-500">
            <AlertCircle size={24} />
            <div>
              <h3 className="text-lg font-semibold">联系人不存在</h3>
              <p className="mt-2 text-gray-600">该联系人可能已被删除或ID无效</p>
              <Button
                variant="secondary"
                size="sm"
                className="mt-4"
                onClick={() => router.back()}
              >
                返回上一页
              </Button>
            </div>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="container py-12 mx-auto">
      <Card shadow="lg" padding="xl" className="max-w-3xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-2xl font-bold text-gray-800">
            {contact.firstname || '未知联系人'} 的详情
          </h1>
          <Button variant="secondary" onClick={() => router.back()}>
            返回列表
          </Button>
        </div>

        {/* 联系人基本信息 */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
          <div className="space-y-6">
            <div>
              <h3 className="text-sm font-medium text-gray-500 mb-1">邮箱</h3>
              <p className="text-gray-800 font-medium">{contact.email || '未填写'}</p>
            </div>
            <div>
              <h3 className="text-sm font-medium text-gray-500 mb-1">Line 昵称</h3>
              <p className="text-gray-800 font-medium">
                {contact.line_display_name || '未绑定 Line'}
              </p>
            </div>
            <div>
              <h3 className="text-sm font-medium text-gray-500 mb-1">Line 用户 ID</h3>
              <p className="text-gray-800 font-medium">
                {contact.line_user_id || '未绑定 Line'}
              </p>
            </div>
          </div>
          <div className="space-y-6">
            <div>
              <h3 className="text-sm font-medium text-gray-500 mb-1">创建时间</h3>
              <p className="text-gray-800 font-medium">
                {contact.createdate 
                  ? new Date(contact.createdate).toLocaleString() 
                  : '未知'}
              </p>
            </div>
            <div>
              <h3 className="text-sm font-medium text-gray-500 mb-1">最后更新时间</h3>
              <p className="text-gray-800 font-medium">
                {contact.lastmodifieddate 
                  ? new Date(contact.lastmodifieddate).toLocaleString() 
                  : '未知'}
              </p>
            </div>
            <div>
              <h3 className="text-sm font-medium text-gray-500 mb-1">租户 ID</h3>
              <p className="text-gray-800 font-medium">{tenantId}</p>
            </div>
          </div>
        </div>

        {/* Line 聊天入口 */}
        <div className="border-t border-gray-100 pt-8">
          {lineChannel ? (
            <Button variant="primary" size="lg" onClick={openLineChat} className="w-full md:w-auto">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="mr-2"
              >
                <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
              </svg>
              打开 Line 聊天窗口
            </Button>
          ) : (
            <Button variant="secondary" size="lg" disabled className="w-full md:w-auto">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="mr-2"
              >
                <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
              </svg>
              未绑定 Line 账号
            </Button>
          )}
        </div>
      </Card>
    </div>
  );
}