'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useTenant } from '@/context/TenantContext';
import { apiFetch } from '@/lib/apiFetch';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Loader } from '@/components/ui/Loader';
import { 
  Users, 
  Building2, 
  RefreshCcw, 
  ArrowRight, 
  CheckCircle2, 
  AlertCircle,
  Clock
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { zhCN } from 'date-fns/locale';

interface SyncStatus {
  status: 'running' | 'completed' | 'failed';
  startedAt: string;
  completedAt?: string;
  processedRecords?: number;
  totalRecords?: number;
  message?: string;
}

interface DashboardStats {
  contactsCount: number;
  companiesCount: number;
  contactsSync?: SyncStatus;
  companiesSync?: SyncStatus;
}

export default function HubSpotDashboard() {
  const router = useRouter();
  const { tenantId } = useTenant();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<DashboardStats>({
    contactsCount: 0,
    companiesCount: 0
  });
  const [syncingContacts, setSyncingContacts] = useState(false);
  const [syncingCompanies, setSyncingCompanies] = useState(false);

  const fetchStats = useCallback(async () => {
    if (!tenantId) return;

    try {
      // Parallel fetch using apiFetch (automatically handles auth and X-Tenant-Id)
      const [contactsRes, companiesRes, contactsSyncRes, companiesSyncRes] = await Promise.all([
        apiFetch<any>(`/hubspot/contacts?tenantId=${tenantId}&limit=1`),
        apiFetch<any>(`/hubspot/companies?tenantId=${tenantId}&limit=1`),
        apiFetch<any>(`/hubspot/sync/status?tenantId=${tenantId}`),
        apiFetch<any>(`/hubspot/companies/sync/status?tenantId=${tenantId}`)
      ]);

      setStats({
        contactsCount: contactsRes.success ? contactsRes.data?.total || 0 : 0,
        companiesCount: companiesRes.success ? companiesRes.data?.total || 0 : 0,
        contactsSync: contactsSyncRes.data,
        companiesSync: companiesSyncRes.data
      });
    } catch (error) {
      console.error('Failed to fetch dashboard stats', error);
    } finally {
      setLoading(false);
    }
  }, [tenantId]);

  useEffect(() => {
    fetchStats();
    // Auto-refresh stats every 10 seconds if a sync is running
    const interval = setInterval(() => {
        if (stats.contactsSync?.status === 'running' || stats.companiesSync?.status === 'running') {
            fetchStats();
        }
    }, 10000);
    return () => clearInterval(interval);
  }, [fetchStats, stats.contactsSync?.status, stats.companiesSync?.status]);

  const triggerSync = async (type: 'contacts' | 'companies') => {
    if (!tenantId) return;
    
    if (type === 'contacts') setSyncingContacts(true);
    else setSyncingCompanies(true);

    try {
      const endpoint = type === 'contacts' ? 'sync/full' : 'companies/sync';
      
      await apiFetch(`/hubspot/${endpoint}?tenantId=${tenantId}`, {
        method: 'POST'
      });
      
      // Refresh stats immediately to show "running" status
      setTimeout(fetchStats, 1000);
    } catch (error) {
      console.error(`Failed to trigger ${type} sync`, error);
    } finally {
      if (type === 'contacts') setSyncingContacts(false);
      else setSyncingCompanies(false);
    }
  };

  const renderSyncStatus = (sync?: SyncStatus) => {
    if (!sync) return <span className="text-gray-400 text-sm">从未同步</span>;

    const isRunning = sync.status === 'running';
    const isFailed = sync.status === 'failed';
    const date = sync.completedAt ? new Date(sync.completedAt) : new Date(sync.startedAt);

    return (
      <div className="flex items-center gap-2 text-sm">
        {isRunning ? (
          <RefreshCcw className="h-4 w-4 animate-spin text-blue-500" />
        ) : isFailed ? (
          <AlertCircle className="h-4 w-4 text-red-500" />
        ) : (
          <CheckCircle2 className="h-4 w-4 text-green-500" />
        )}
        <span className={isRunning ? 'text-blue-600' : isFailed ? 'text-red-600' : 'text-gray-600'}>
          {isRunning ? '正在同步...' : isFailed ? '同步失败' : '同步完成'}
        </span>
        <span className="text-gray-400 text-xs flex items-center">
            <Clock className="h-3 w-3 mr-1" />
            {formatDistanceToNow(date, { addSuffix: true, locale: zhCN })}
        </span>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
            <Loader className="h-10 w-10 text-blue-600 mx-auto" />
            <p className="mt-4 text-gray-500">加载数据中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 tracking-tight">HubSpot 集成概览</h1>
        <p className="mt-2 text-gray-500">查看同步状态并管理您的 HubSpot 数据</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Contacts Card */}
        <Card className="border-t-4 border-t-orange-500 shadow-sm hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-lg font-medium text-gray-700 flex items-center gap-2">
              <Users className="h-5 w-5 text-orange-500" />
              联系人 (Contacts)
            </CardTitle>
            <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => router.push(`/${tenantId}/hubspot/contacts`)}
                className="text-gray-500 hover:text-orange-600"
            >
                查看全部 <ArrowRight className="ml-1 h-4 w-4" />
            </Button>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold text-gray-900 mb-4">
                {stats.contactsCount.toLocaleString()}
            </div>
            
            <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                <div className="flex justify-between items-center">
                    <span className="text-sm font-medium text-gray-600">同步状态</span>
                    {renderSyncStatus(stats.contactsSync)}
                </div>
                
                <div className="pt-2 border-t border-gray-200 flex justify-end">
                    <Button 
                        size="sm" 
                        variant="secondary" 
                        onClick={() => triggerSync('contacts')}
                        disabled={syncingContacts || stats.contactsSync?.status === 'running'}
                        className="w-full sm:w-auto"
                    >
                        {syncingContacts ? (
                            <><RefreshCcw className="mr-2 h-4 w-4 animate-spin" /> 请求中...</>
                        ) : (
                            <><RefreshCcw className="mr-2 h-4 w-4" /> 立即同步</>
                        )}
                    </Button>
                </div>
            </div>
          </CardContent>
        </Card>

        {/* Companies Card */}
        <Card className="border-t-4 border-t-blue-500 shadow-sm hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-lg font-medium text-gray-700 flex items-center gap-2">
              <Building2 className="h-5 w-5 text-blue-500" />
              公司 (Companies)
            </CardTitle>
            <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => router.push(`/${tenantId}/hubspot/companies`)}
                className="text-gray-500 hover:text-blue-600"
            >
                查看全部 <ArrowRight className="ml-1 h-4 w-4" />
            </Button>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold text-gray-900 mb-4">
                {stats.companiesCount.toLocaleString()}
            </div>
            
            <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                <div className="flex justify-between items-center">
                    <span className="text-sm font-medium text-gray-600">同步状态</span>
                    {renderSyncStatus(stats.companiesSync)}
                </div>
                
                <div className="pt-2 border-t border-gray-200 flex justify-end">
                    <Button 
                        size="sm" 
                        variant="secondary" 
                        onClick={() => triggerSync('companies')}
                        disabled={syncingCompanies || stats.companiesSync?.status === 'running'}
                        className="w-full sm:w-auto"
                    >
                         {syncingCompanies ? (
                            <><RefreshCcw className="mr-2 h-4 w-4 animate-spin" /> 请求中...</>
                        ) : (
                            <><RefreshCcw className="mr-2 h-4 w-4" /> 立即同步</>
                        )}
                    </Button>
                </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
