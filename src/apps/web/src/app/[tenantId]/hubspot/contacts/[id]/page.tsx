'use client';
import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useTenant } from '@/context/TenantContext';
import { apiFetch } from '@/lib/apiFetch';
import { Button } from '@/components/ui/Button';
import { Loader } from '@/components/ui/Loader';
import { 
  AlertCircle, 
  ArrowLeft, 
  Mail, 
  Phone, 
  Building2, 
  Briefcase,
  Calendar,
  Clock,
  MessageCircle,
  User,
  CheckCircle2,
  XCircle
} from 'lucide-react';

interface Contact {
  id: string;
  hubspot_id: string;
  firstname?: string;
  lastname?: string;
  email?: string;
  phone?: string;
  company?: string;
  job_title?: string;
  lifecycle_stage?: string;
  line_display_name?: string;
  line_user_id?: string;
  hubspot_created_at?: string;
  hubspot_updated_at?: string;
  last_synced_at?: string;
  [key: string]: any;
}

export default function ContactDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const router = useRouter();
  const { tenantId } = useTenant();
  
  const [contact, setContact] = useState<Contact | null>(null);
  const [lineChannel, setLineChannel] = useState<{ id: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

        const [contactRes, channelRes] = await Promise.all([
          apiFetch(`hubspot/contacts/${id}?tenantId=${tenantId}`),
          apiFetch(`line/channel?contactId=${id}&tenantId=${tenantId}`),
        ]);

        setContact(contactRes.data as Contact);
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
      router.push(`/${tenantId}/hubspot/line-chat?channelId=${lineChannel.id}`);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
        <div className="container py-8 mx-auto px-4">
          <div className="max-w-5xl mx-auto">
            <div className="bg-white rounded-2xl shadow-xl p-12">
              <Loader size="lg" label="加载联系人详情中..." />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
        <div className="container py-8 mx-auto px-4">
          <div className="max-w-5xl mx-auto">
            <div className="bg-white rounded-2xl shadow-xl p-8">
              <div className="flex items-start gap-4 text-red-600">
                <AlertCircle size={28} className="flex-shrink-0 mt-1" />
                <div className="flex-1">
                  <h3 className="text-xl font-semibold mb-2">操作失败</h3>
                  <p className="text-gray-600 mb-4">{error}</p>
                  <Button
                    variant="secondary"
                    onClick={() => window.location.reload()}
                    className="inline-flex items-center gap-2"
                  >
                    刷新页面
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!contact) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
        <div className="container py-8 mx-auto px-4">
          <div className="max-w-5xl mx-auto">
            <div className="bg-white rounded-2xl shadow-xl p-8">
              <div className="flex items-start gap-4 text-orange-600">
                <AlertCircle size={28} className="flex-shrink-0 mt-1" />
                <div className="flex-1">
                  <h3 className="text-xl font-semibold mb-2">联系人不存在</h3>
                  <p className="text-gray-600 mb-4">该联系人可能已被删除或ID无效</p>
                  <Button
                    variant="secondary"
                    onClick={() => router.back()}
                    className="inline-flex items-center gap-2"
                  >
                    <ArrowLeft size={16} />
                    返回上一页
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const getInitials = () => {
    const firstName = contact.firstname || '';
    const lastName = contact.lastname || '';
    if (firstName && lastName) {
      return `${firstName[0]}${lastName[0]}`.toUpperCase();
    }
    if (firstName) return firstName[0].toUpperCase();
    if (contact.email) return contact.email[0].toUpperCase();
    return 'U';
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return '未知';
    return new Date(dateString).toLocaleString('zh-CN', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const hasLineIntegration = !!contact.line_user_id;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      <div className="container py-8 mx-auto px-4">
        <div className="max-w-5xl mx-auto space-y-6">
          
          {/* Header with Back Button */}
          <div className="flex items-center gap-4">
            <Button
              variant="secondary"
              onClick={() => router.back()}
              className="inline-flex items-center gap-2"
            >
              <ArrowLeft size={16} />
              返回列表
            </Button>
          </div>

          {/* Contact Header Card */}
          <div className="bg-gradient-to-br from-white to-blue-50/50 rounded-2xl shadow-xl overflow-hidden">
            <div className="p-8">
              <div className="flex flex-col md:flex-row gap-6 items-start md:items-center">
                {/* Avatar */}
                <div className="relative">
                  <div className="w-24 h-24 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white text-3xl font-bold shadow-lg">
                    {getInitials()}
                  </div>
                  {hasLineIntegration && (
                    <div className="absolute -bottom-2 -right-2 bg-green-500 rounded-full p-2 shadow-lg">
                      <CheckCircle2 size={20} className="text-white" />
                    </div>
                  )}
                </div>

                {/* Contact Info */}
                <div className="flex-1">
                  <h1 className="text-3xl font-bold text-gray-900 mb-2">
                    {[contact.firstname, contact.lastname].filter(Boolean).join(' ') || '未命名联系人'}
                  </h1>
                  {contact.job_title && (
                    <p className="text-lg text-gray-600 mb-1">{contact.job_title}</p>
                  )}
                  {contact.company && (
                    <p className="text-gray-500 flex items-center gap-2">
                      <Building2 size={16} />
                      {contact.company}
                    </p>
                  )}
                  {contact.lifecycle_stage && (
                    <div className="mt-3 inline-block">
                      <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm font-medium">
                        {contact.lifecycle_stage}
                      </span>
                    </div>
                  )}
                </div>

                {/* LINE Status Badge */}
                {hasLineIntegration && (
                  <div className="bg-green-50 border-2 border-green-200 rounded-xl p-4">
                    <div className="flex items-center gap-2 text-green-700 font-semibold mb-1">
                      <MessageCircle size={20} />
                      LINE 已绑定
                    </div>
                    <p className="text-sm text-green-600">{contact.line_display_name}</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Main Content Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Contact Information */}
            <div className="lg:col-span-2 space-y-6">
              
              {/* Basic Info Card */}
              <div className="bg-white rounded-xl shadow-lg p-6">
                <h2 className="text-xl font-semibold text-gray-900 mb-6 flex items-center gap-2">
                  <User size={20} className="text-blue-600" />
                  基本信息
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <InfoItem
                    icon={<Mail size={18} />}
                    label="邮箱"
                    value={contact.email}
                  />
                  <InfoItem
                    icon={<Phone size={18} />}
                    label="电话"
                    value={contact.phone}
                  />
                  <InfoItem
                    icon={<Building2 size={18} />}
                    label="公司"
                    value={contact.company}
                  />
                  <InfoItem
                    icon={<Briefcase size={18} />}
                    label="职位"
                    value={contact.job_title}
                  />
                </div>
              </div>

              {/* LINE Integration Card */}
              <div className="bg-white rounded-xl shadow-lg p-6">
                <h2 className="text-xl font-semibold text-gray-900 mb-6 flex items-center gap-2">
                  <MessageCircle size={20} className="text-green-600" />
                  LINE 集成
                </h2>
                {hasLineIntegration ? (
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <InfoItem
                        icon={<User size={18} />}
                        label="LINE 昵称"
                        value={contact.line_display_name}
                      />
                      <InfoItem
                        icon={<User size={18} />}
                        label="LINE 用户 ID"
                        value={contact.line_user_id}
                        valueClassName="font-mono text-xs"
                      />
                    </div>
                    {lineChannel && (
                      <Button
                        variant="primary"
                        size="lg"
                        onClick={openLineChat}
                        className="w-full md:w-auto inline-flex items-center gap-2"
                      >
                        <MessageCircle size={20} />
                        打开 LINE 聊天窗口
                      </Button>
                    )}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gray-100 mb-4">
                      <XCircle size={32} className="text-gray-400" />
                    </div>
                    <p className="text-gray-500">该联系人尚未绑定 LINE 账号</p>
                  </div>
                )}
              </div>
            </div>

            {/* Sidebar - Timestamps */}
            <div className="space-y-6">
              
              {/* Sync Info Card */}
              <div className="bg-white rounded-xl shadow-lg p-6">
                <h2 className="text-xl font-semibold text-gray-900 mb-6 flex items-center gap-2">
                  <Clock size={20} className="text-purple-600" />
                  同步信息
                </h2>
                <div className="space-y-4">
                  <TimeItem
                    icon={<Calendar size={16} />}
                    label="创建时间"
                    value={formatDate(contact.hubspot_created_at)}
                  />
                  <TimeItem
                    icon={<Clock size={16} />}
                    label="最后更新"
                    value={formatDate(contact.hubspot_updated_at)}
                  />
                  <TimeItem
                    icon={<Clock size={16} />}
                    label="最后同步"
                    value={formatDate(contact.last_synced_at)}
                  />
                </div>
              </div>

              {/* HubSpot ID Card */}
              <div className="bg-gradient-to-br from-orange-50 to-orange-100 rounded-xl p-6 border-2 border-orange-200">
                <h3 className="text-sm font-semibold text-orange-900 mb-2">HubSpot Contact ID</h3>
                <p className="font-mono text-sm text-orange-700 break-all">{contact.hubspot_id}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Helper Components
function InfoItem({ icon, label, value, valueClassName = '' }: { 
  icon: React.ReactNode; 
  label: string; 
  value?: string;
  valueClassName?: string;
}) {
  return (
    <div>
      <div className="flex items-center gap-2 text-sm font-medium text-gray-500 mb-1">
        {icon}
        {label}
      </div>
      <p className={`text-gray-900 font-medium ${valueClassName || ''}`}>
        {value || '未填写'}
      </p>
    </div>
  );
}

function TimeItem({ icon, label, value }: { 
  icon: React.ReactNode; 
  label: string; 
  value: string;
}) {
  return (
    <div className="flex items-start gap-3 pb-4 border-b border-gray-100 last:border-0 last:pb-0">
      <div className="flex-shrink-0 mt-0.5 text-purple-600">
        {icon}
      </div>
      <div className="flex-1">
        <p className="text-sm font-medium text-gray-500 mb-0.5">{label}</p>
        <p className="text-sm text-gray-900">{value}</p>
      </div>
    </div>
  );
}
