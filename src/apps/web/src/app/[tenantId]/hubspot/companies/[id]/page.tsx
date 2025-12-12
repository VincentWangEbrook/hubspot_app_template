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
  Phone, 
  Building2, 
  Calendar,
  Clock,
  Globe,
  MapPin,
  Users,
  DollarSign,
  FileText,
  ExternalLink,
  Briefcase
} from 'lucide-react';

interface Company {
  id: number;
  hubspot_id: string;
  name?: string;
  domain?: string;
  industry?: string;
  city?: string;
  state?: string;
  country?: string;
  zip?: string;
  phone?: string;
  website?: string;
  description?: string;
  num_employees?: number;
  annual_revenue?: number;
  type?: string;
  hubspot_created_at?: string;
  hubspot_updated_at?: string;
  last_synced_at?: string;
  line_channel_id?: string;
}

export default function CompanyDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const router = useRouter();
  const { tenantId } = useTenant();
  
  const [company, setCompany] = useState<Company | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchCompanyDetail = async () => {
      if (!id || !tenantId) {
        setError('缺少公司 ID 或租户信息');
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);

        const res = await apiFetch<Company>(`hubspot/companies/${id}?tenantId=${tenantId}`);
        
        if (res.success && res.data) {
          setCompany(res.data);
        } else {
          setError(res.error || '获取公司详情失败');
        }
      } catch (err) {
        console.error('获取公司详情失败:', err);
        setError('获取公司信息失败，请刷新页面重试');
      } finally {
        setLoading(false);
      }
    };

    fetchCompanyDetail();
  }, [id, tenantId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
        <div className="container py-8 mx-auto px-4">
          <div className="max-w-5xl mx-auto">
            <div className="bg-white rounded-2xl shadow-xl p-12">
              <Loader size="lg" label="加载公司详情中..." />
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

  if (!company) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
        <div className="container py-8 mx-auto px-4">
          <div className="max-w-5xl mx-auto">
            <div className="bg-white rounded-2xl shadow-xl p-8">
              <div className="flex items-start gap-4 text-orange-600">
                <AlertCircle size={28} className="flex-shrink-0 mt-1" />
                <div className="flex-1">
                  <h3 className="text-xl font-semibold mb-2">公司不存在</h3>
                  <p className="text-gray-600 mb-4">该公司可能已被删除或ID无效</p>
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
    return (company.name || 'U').substring(0, 2).toUpperCase();
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

  const formatCurrency = (amount?: number) => {
    if (amount === undefined || amount === null) return '未填写';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0
    }).format(amount);
  };

  const locationString = [company.city, company.state, company.country, company.zip]
    .filter(Boolean)
    .join(', ');

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

          {/* Company Header Card */}
          <div className="bg-gradient-to-br from-white to-blue-50/50 rounded-2xl shadow-xl overflow-hidden">
            <div className="p-8">
              <div className="flex flex-col md:flex-row gap-6 items-start md:items-center">
                {/* Avatar */}
                <div className="relative">
                  <div className="w-24 h-24 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-700 flex items-center justify-center text-white text-3xl font-bold shadow-lg transform -rotate-3">
                    {getInitials()}
                  </div>
                </div>

                {/* Company Info */}
                <div className="flex-1">
                  <h1 className="text-3xl font-bold text-gray-900 mb-2">
                    {company.name || '未命名公司'}
                  </h1>
                  <div className="flex flex-wrap gap-3 items-center text-gray-600 mb-4">
                    {company.domain && (
                      <div className="flex items-center gap-1.5">
                        <Globe size={16} className="text-blue-500" />
                        <a href={`https://${company.domain}`} target="_blank" rel="noopener noreferrer" className="hover:text-blue-600 hover:underline">
                          {company.domain}
                        </a>
                      </div>
                    )}
                    {company.industry && (
                      <div className="flex items-center gap-1.5">
                        <Briefcase size={16} className="text-purple-500" />
                        <span>{company.industry}</span>
                      </div>
                    )}
                    {locationString && (
                      <div className="flex items-center gap-1.5">
                        <MapPin size={16} className="text-red-500" />
                        <span>{locationString}</span>
                      </div>
                    )}
                  </div>
                  
                  <div className="flex gap-3">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => window.open(`https://app.hubspot.com/contacts/${company.hubspot_id}`, '_blank')}
                      className="inline-flex items-center gap-2 text-blue-600 border-blue-200 hover:bg-blue-50"
                    >
                      <ExternalLink size={16} />
                      在 HubSpot 中查看
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Main Content Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Left Column: Main Info */}
            <div className="lg:col-span-2 space-y-6">
              
              {/* Basic Info Card */}
              <div className="bg-white rounded-xl shadow-lg p-6">
                <h2 className="text-xl font-semibold text-gray-900 mb-6 flex items-center gap-2">
                  <Building2 size={20} className="text-blue-600" />
                  公司信息
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-y-6 gap-x-8">
                  <InfoItem
                    icon={<Phone size={18} />}
                    label="电话"
                    value={company.phone}
                  />
                  <InfoItem
                    icon={<Globe size={18} />}
                    label="网站"
                    value={company.website}
                    isLink
                  />
                  <InfoItem
                    icon={<Briefcase size={18} />}
                    label="类型"
                    value={company.type}
                  />
                  <InfoItem
                    icon={<Users size={18} />}
                    label="员工人数"
                    value={company.num_employees ? `${company.num_employees.toLocaleString()} 人` : undefined}
                  />
                  <InfoItem
                    icon={<DollarSign size={18} />}
                    label="年营收"
                    value={formatCurrency(company.annual_revenue)}
                  />
                </div>
              </div>

              {/* Description Card */}
              {company.description && (
                <div className="bg-white rounded-xl shadow-lg p-6">
                  <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center gap-2">
                    <FileText size={20} className="text-indigo-600" />
                    简介
                  </h2>
                  <p className="text-gray-700 leading-relaxed whitespace-pre-wrap">
                    {company.description}
                  </p>
                </div>
              )}
            </div>

            {/* Right Column: Meta Info */}
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
                    value={formatDate(company.hubspot_created_at)}
                  />
                  <TimeItem
                    icon={<Clock size={16} />}
                    label="最后更新"
                    value={formatDate(company.hubspot_updated_at)}
                  />
                  <TimeItem
                    icon={<Clock size={16} />}
                    label="最后同步"
                    value={formatDate(company.last_synced_at)}
                  />
                </div>
              </div>

              {/* HubSpot ID Card */}
              <div className="bg-gradient-to-br from-orange-50 to-orange-100 rounded-xl p-6 border-2 border-orange-200">
                <h3 className="text-sm font-semibold text-orange-900 mb-2">HubSpot Company ID</h3>
                <p className="font-mono text-sm text-orange-700 break-all">{company.hubspot_id}</p>
              </div>

               {/* System Info */}
               <div className="bg-gray-50 rounded-xl p-6 border border-gray-200">
                <h3 className="text-sm font-semibold text-gray-500 mb-4 uppercase tracking-wider">系统信息</h3>
                <div className="space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">数据库 ID</span>
                    <span className="font-mono text-gray-700">{company.id}</span>
                  </div>
                  {company.line_channel_id && (
                     <div className="flex justify-between text-sm">
                     <span className="text-gray-500">LINE Channel ID</span>
                     <span className="font-mono text-gray-700">{company.line_channel_id}</span>
                   </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Helper Components
function InfoItem({ icon, label, value, isLink = false }: { 
  icon: React.ReactNode; 
  label: string; 
  value?: string;
  isLink?: boolean;
}) {
  return (
    <div>
      <div className="flex items-center gap-2 text-sm font-medium text-gray-500 mb-1">
        {icon}
        {label}
      </div>
      {isLink && value ? (
        <a 
          href={value.startsWith('http') ? value : `https://${value}`} 
          target="_blank" 
          rel="noopener noreferrer"
          className="text-blue-600 hover:underline font-medium truncate block"
        >
          {value}
        </a>
      ) : (
        <p className="text-gray-900 font-medium break-words">
          {value || '未填写'}
        </p>
      )}
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
