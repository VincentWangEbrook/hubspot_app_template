'use client'

import React, { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useTenant } from '@/context/TenantContext';
import { apiFetch } from '@/lib/apiFetch';
import { Search, User, Mail, Calendar, RefreshCw, AlertCircle, Filter, ChevronLeft, ChevronRight, ExternalLink } from 'lucide-react';
import HubSpotConnectButton from '@/components/HubSpotConnectButton';

interface Contact {
  id: number;
  hubspotId: string;
  email?: string;
  firstname?: string;
  lastname?: string;
  properties?: any;
  isDeleted?: boolean;
  lastSyncedAt?: string;
  createdAt?: string;
  updatedAt?: string;
}

interface PaginatedResponse {
  data: Contact[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export default function ContactsPage() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(27);
  const [totalPages, setTotalPages] = useState(1);
  
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('updated_at');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  
  // Filters
  const [lifecycleFilter, setLifecycleFilter] = useState('');
  const [lineBindingFilter, setLineBindingFilter] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  
  // Sync status
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(null);
  const [syncStatus, setSyncStatus] = useState<string>('idle');
  
  // Authorization status
  const [isAuthError, setIsAuthError] = useState(false);
  const [authErrorMessage, setAuthErrorMessage] = useState<string>('');
  
  const router = useRouter();
  const { tenantId, isLoading: isTenantLoading } = useTenant();
  
  // 用于跟踪请求和取消重复请求
  const abortControllerRef = useRef<AbortController | null>(null);
  const isInitializedRef = useRef(false);
  const searchTimerRef = useRef<NodeJS.Timeout | null>(null);

  // 加载联系人 - 使用 ref 存储最新的参数值
  const loadContacts = async (forceReload = false) => {
    if (!tenantId) return;
    
    // 取消之前的请求
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();
    
    setLoading(true);
    setError(null);
    
    try {
      const params = new URLSearchParams({
        tenantId,
        page: String(currentPage),
        limit: String(pageSize),
        sortBy,
        sortOrder,
      });
      
      if (searchQuery) params.append('search', searchQuery);
      if (lifecycleFilter) params.append('lifecycleStage', lifecycleFilter);
      if (lineBindingFilter) params.append('hasLineBinding', lineBindingFilter);
      
      console.log('[Contacts] Loading with params:', params.toString());
      
      const res = await apiFetch<PaginatedResponse>(`hubspot/contacts?${params.toString()}`);
      console.log('[Contacts] Response:', res);
      // 检查是否已被取消
      if (abortControllerRef.current?.signal.aborted) {
        console.log('[Contacts] Request aborted, ignoring response');
        return;
      }
            
      if (res.success && res.data) {
        const paginatedData = res.data;
        setContacts(paginatedData.data || []);
        setTotalCount(paginatedData.total || 0);
        setTotalPages(paginatedData.totalPages || 1);
        setIsAuthError(false);
      } else {
        if (res.code === 401 || res.message?.includes('授权')) {
          setIsAuthError(true);
          setAuthErrorMessage(res.message || 'HubSpot 授权已过期');
        }
        setError(res.message || '加载联系人失败');
        setContacts([]);
      }
    } catch (err: any) {
      // 忽略取消的请求错误
      if (err.name === 'AbortError') {
        console.log('[Contacts] Request cancelled');
        return;
      }
      console.error('[Contacts] Error:', err);
      if (err.message?.includes('授权') || err.message?.includes('HUBSPOT')) {
        setIsAuthError(true);
        setAuthErrorMessage(err.message);
      }
      setError(err?.message || '网络错误，请稍后重试');
      setContacts([]);
    } finally {
      setLoading(false);
    }
  };

  // State for sync progress
  const [syncProgress, setSyncProgress] = useState<{
    processed: number;
    total: number;
    status: string;
  } | null>(null);
  const syncPollingRef = useRef<NodeJS.Timeout | null>(null);

  // Poll sync status during sync
  const pollSyncStatus = async (syncHistoryId?: number) => {
    if (!tenantId) return;
    try {
      const res = await apiFetch<{
        id?: number;
        status?: string;
        totalRecords?: number;
        processedRecords?: number;
        startedAt?: string;
        completedAt?: string;
      }>(`hubspot/sync/status?tenantId=${tenantId}`);
            
      if (res.success && res.data) {
        const progressData = {
          processed: res.data.processedRecords || 0,
          total: res.data.totalRecords || 0,
          status: res.data.status || 'running',
        };
                
        setSyncProgress(progressData);

        // Stop polling if completed or failed
        if (res.data.status === 'completed' || res.data.status === 'failed') {
          
          if (syncPollingRef.current) {
            clearInterval(syncPollingRef.current);
            syncPollingRef.current = null;
          }
          
          // Keep progress visible for a moment before clearing
          setTimeout(() => {
            setSyncProgress(null);
            setSyncing(false);
          }, 2000);
          
          // Reload contacts on completion
          if (res.data.status === 'completed') {
            await loadContacts(true);
            setLastSyncTime(new Date().toISOString());
          }
        }
      }
    } catch (err) {
      console.error('[SyncPoll] Error:', err);
      if (syncPollingRef.current) {
        clearInterval(syncPollingRef.current);
        syncPollingRef.current = null;
      }
      setSyncProgress(null);
      setSyncing(false);
    }
  };

  const handleSync = async () => {
    if (!tenantId) return;
    
    setSyncing(true);
    setSyncProgress({ processed: 0, total: 0, status: 'starting' });
    
    try {
      const res = await apiFetch<{ syncHistoryId?: number }>(`hubspot/sync?tenantId=${tenantId}`, {
        method: 'POST',
      });
      
      if (res.success) {
        // Start polling sync status
        syncPollingRef.current = setInterval(() => {
          pollSyncStatus(res.data?.syncHistoryId);
        }, 300); // Poll every 300ms for faster updates
        
        // Initial poll
        pollSyncStatus(res.data?.syncHistoryId);
      } else {
        if (res.code === 401 || res.message?.includes('授权')) {
          setIsAuthError(true);
          setAuthErrorMessage(res.message || 'HubSpot 授权已过期');
        }
        setError('同步失败：' + (res.message || '未知错误'));
        setSyncProgress(null);
        setSyncing(false);
      }
    } catch (err: any) {
      console.error('[Sync] Error:', err);
      if (err.message?.includes('授权') || err.message?.includes('HUBSPOT')) {
        setIsAuthError(true);
        setAuthErrorMessage(err.message);
      }
      setError('同步失败：' + (err?.message || '未知错误'));
      setSyncProgress(null);
      setSyncing(false);
    }
  };

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (syncPollingRef.current) {
        clearInterval(syncPollingRef.current);
      }
    };
  }, []);

  const loadSyncStatus = async () => {
    if (!tenantId) return;
    try {
      const res = await apiFetch<{ completedAt?: string; startedAt?: string; status?: string }>(
        `hubspot/sync/status?tenantId=${tenantId}`
      );
      
      if (res.success && res.data) {
        setLastSyncTime(res.data.completedAt || res.data.startedAt || null);
        setSyncStatus(res.data.status || 'idle');
      }
    } catch (err) {
      console.error('[Sync Status] Error:', err);
    }
  };

  // 初始化加载 - 只在 tenantId 确定后执行一次
  useEffect(() => {
    if (isTenantLoading) return;
    
    if (!tenantId) {
      setLoading(false);
      setError('租户ID无效');
      return;
    }
    
    // 只在初始化时加载一次
    if (!isInitializedRef.current) {
      isInitializedRef.current = true;
      console.log('[Contacts] Initial load for tenant:', tenantId);
      loadContacts();
      loadSyncStatus();
    }
    
    // 清理函数
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [tenantId, isTenantLoading]);

  // 当筛选/排序/分页条件变化时重新加载（初始化后）
  useEffect(() => {
    if (!isInitializedRef.current || !tenantId) return;
    console.log('[Contacts] Filter/sort/page changed, reloading...');
    loadContacts();
  }, [currentPage, sortBy, sortOrder, lifecycleFilter, lineBindingFilter]);

  // 搜索防抖
  useEffect(() => {
    if (!isInitializedRef.current || !tenantId) return;
    
    // 清除之前的定时器
    if (searchTimerRef.current) {
      clearTimeout(searchTimerRef.current);
    }
    
    // 设置新的定时器
    searchTimerRef.current = setTimeout(() => {
      console.log('[Contacts] Search debounced, reloading...');
      // 搜索时重置到第一页
      if (currentPage !== 1) {
        setCurrentPage(1); // 这会触发上面的 useEffect
      } else {
        loadContacts();
      }
    }, 400);
    
    return () => {
      if (searchTimerRef.current) {
        clearTimeout(searchTimerRef.current);
      }
    };
  }, [searchQuery]);

  const formatDate = (dateString?: string) => {
    if (!dateString) return '未知';
    return new Date(dateString).toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const formatRelativeTime = (dateString?: string) => {
    if (!dateString) return '从未';
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    
    if (diffMins < 1) return '刚刚';
    if (diffMins < 60) return `${diffMins}分钟前`;
    if (diffHours < 24) return `${diffHours}小时前`;
    if (diffDays < 7) return `${diffDays}天前`;
    return formatDate(dateString);
  };

  const handleContactClick = (contact: Contact) => {
    router.push(`/${tenantId}/hubspot/contacts/${contact.hubspotId}`);
  };

  const getLineBoundCount = () => {
    return contacts.filter(c => c.properties?.line_user_id).length;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50 dark:from-gray-900 dark:to-gray-800">
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        
        {/* 页面头部 */}
        <div className="mb-8">
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
                HubSpot 联系人
              </h1>
              <p className="text-gray-600 dark:text-gray-400">
                管理和查看所有 HubSpot 联系人信息
              </p>
            </div>
            
            {/* Sync Status */}
            <div className="text-right">
              <div className="text-sm text-gray-500 dark:text-gray-400 mb-2">
                最后同步: {formatRelativeTime(lastSyncTime)}
              </div>
              {syncStatus === 'running' && (
                <div className="text-xs text-blue-600 dark:text-blue-400">
                  同步进行中...
                </div>
              )}
            </div>
          </div>
        </div>

        {/* 搜索和操作栏 */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-4 mb-6">
          <div className="flex flex-col gap-4">
            {/* Top row: Search and Actions */}
            <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
              <div className="relative flex-1 w-full sm:max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                <input
                  type="text"
                  placeholder="搜索联系人（姓名、邮箱、公司...）"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 
                           bg-white dark:bg-gray-700 text-gray-900 dark:text-white
                           focus:ring-2 focus:ring-blue-500 focus:border-transparent
                           placeholder-gray-400 dark:placeholder-gray-500 transition-all"
                />
              </div>
              
              <div className="flex gap-2">
                <button
                  onClick={() => setShowFilters(!showFilters)}
                  className="flex items-center gap-2 px-4 py-2.5 bg-gray-100 hover:bg-gray-200 
                           dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 
                           rounded-lg font-medium transition-all"
                >
                  <Filter size={18} />
                  筛选
                </button>
                
                <button
                  onClick={handleSync}
                  disabled={syncing || loading}
                  className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 
                           disabled:bg-blue-400 text-white rounded-lg font-medium
                           transition-all shadow-sm hover:shadow-md"
                >
                  <RefreshCw size={18} className={syncing ? 'animate-spin' : ''} />
                  {syncing ? '同步中...' : '同步'}
                </button>
              </div>
            </div>

            {/* Sync Progress Indicator */}
            {syncProgress && (
              <div className="mt-4 bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 border-l-4 border-blue-500">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center">
                      <RefreshCw size={20} className="text-blue-600 dark:text-blue-400 animate-spin" />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                        正在同步联系人
                      </h3>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        {syncProgress.status === 'starting' && '正在连接 HubSpot...'}
                        {syncProgress.status === 'running' && '正在获取并保存联系人数据...'}
                        {syncProgress.status === 'completed' && '同步完成！'}
                        {syncProgress.status === 'failed' && '同步失败'}
                      </p>
                    </div>
                  </div>
                  {syncProgress.total > 0 && (
                    <div className="text-right">
                      <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                        {Math.round((syncProgress.processed / syncProgress.total) * 100)}%
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        {syncProgress.processed} / {syncProgress.total}
                      </div>
                    </div>
                  )}
                </div>
                
                {/* Progress Bar */}
                {syncProgress.total > 0 && (
                  <div className="relative w-full h-3 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                    <div 
                      className="absolute top-0 left-0 h-full bg-gradient-to-r from-blue-500 to-indigo-500 transition-all duration-500 ease-out rounded-full"
                      style={{ width: `${Math.min((syncProgress.processed / syncProgress.total) * 100, 100)}%` }}
                    >
                      <div className="absolute inset-0 bg-white/20 animate-pulse" />
                    </div>
                  </div>
                )}
              </div>
            )}
            
            {/* Filters Row */}
            {showFilters && (
              <div className="flex flex-wrap gap-3 pt-3 border-t border-gray-200 dark:border-gray-700">
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600
                           bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                >
                  <option value="updated_at">更新时间</option>
                  <option value="created_at">创建时间</option>
                  <option value="firstname">姓名</option>
                  <option value="email">邮箱</option>
                </select>
                
                <select
                  value={sortOrder}
                  onChange={(e) => setSortOrder(e.target.value as 'asc' | 'desc')}
                  className="px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600
                           bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                >
                  <option value="desc">降序</option>
                  <option value="asc">升序</option>
                </select>
                
                <select
                  value={lifecycleFilter}
                  onChange={(e) => setLifecycleFilter(e.target.value)}
                  className="px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600
                           bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                >
                  <option value="">所有阶段</option>
                  <option value="lead">潜在客户</option>
                  <option value="marketingqualifiedlead">MQL</option>
                  <option value="salesqualifiedlead">SQL</option>
                  <option value="opportunity">商机</option>
                  <option value="customer">客户</option>
                </select>
                
                <select
                  value={lineBindingFilter}
                  onChange={(e) => setLineBindingFilter(e.target.value)}
                  className="px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600
                           bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                >
                  <option value="">全部</option>
                  <option value="true">已绑定LINE</option>
                  <option value="false">未绑定LINE</option>
                </select>
              </div>
            )}
          </div>
        </div>

        {/* 统计信息 */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">总联系人</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
                  {totalCount}
                </p>
              </div>
              <User className="text-blue-600" size={32} />
            </div>
          </div>
          
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">当前页</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
                  {contacts.length}
                </p>
              </div>
              <Search className="text-green-600" size={32} />
            </div>
          </div>
          
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">已绑定LINE</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
                  {getLineBoundCount()}
                </p>
              </div>
              <Mail className="text-purple-600" size={32} />
            </div>
          </div>
        </div>

        {/* 授权错误提示 */}
        {isAuthError && (
          <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 
                        rounded-xl p-6 mb-6">
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0 w-12 h-12 rounded-full bg-yellow-100 dark:bg-yellow-900/30 
                            flex items-center justify-center">
                <ExternalLink className="text-yellow-600 dark:text-yellow-400" size={24} />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-yellow-900 dark:text-yellow-200 mb-2">
                  需要重新授权 HubSpot
                </h3>
                <p className="text-yellow-800 dark:text-yellow-300 mb-4">
                  {authErrorMessage || 'HubSpot 授权已过期或失效，请重新连接您的 HubSpot 账户以继续使用联系人同步功能。'}
                </p>
                <HubSpotConnectButton 
                  size="lg"
                  onSuccess={() => {
                    setIsAuthError(false);
                    loadContacts(true);
                  }}
                />
              </div>
            </div>
          </div>
        )}

        {/* 错误提示 */}
        {error && !isAuthError && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 
                        rounded-xl p-4 mb-6 flex items-start gap-3">
            <AlertCircle className="text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" size={20} />
            <div className="flex-1">
              <p className="text-red-900 dark:text-red-200 font-medium">加载失败</p>
              <p className="text-red-700 dark:text-red-300 text-sm mt-1">{error}</p>
            </div>
          </div>
        )}

        {/* 加载状态 */}
        {loading && (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
            <p className="text-gray-600 dark:text-gray-400">加载联系人中...</p>
          </div>
        )}

        {/* 空状态 */}
        {!loading && contacts.length === 0 && !error && (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-12 text-center">
            <User className="mx-auto text-gray-400 mb-4" size={64} />
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
              {searchQuery || lifecycleFilter || lineBindingFilter ? '未找到匹配的联系人' : '暂无联系人'}
            </h3>
            <p className="text-gray-600 dark:text-gray-400">
              {searchQuery || lifecycleFilter || lineBindingFilter ? '尝试调整筛选条件' : '点击同步按钮从 HubSpot 同步联系人'}
            </p>
          </div>
        )}

        {/* 联系人卡片网格 */}
        {!loading && contacts.length > 0 && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {contacts.map((contact) => (
                <div
                  key={contact.id}
                  onClick={() => handleContactClick(contact)}
                  className="bg-white dark:bg-gray-800 rounded-xl shadow-sm hover:shadow-lg 
                           transition-all duration-200 cursor-pointer border border-gray-100 
                           dark:border-gray-700 hover:border-blue-500 dark:hover:border-blue-500
                           transform hover:-translate-y-1"
                >
                  <div className="p-6">
                    {/* 联系人头像 */}
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 
                                      flex items-center justify-center text-white font-bold text-lg">
                          {(contact.firstname?.[0] || contact.email?.[0] || 'U').toUpperCase()}
                        </div>
                        <div>
                          <h3 className="font-semibold text-gray-900 dark:text-white text-lg">
                            {contact.firstname || contact.lastname 
                              ? `${contact.firstname || ''} ${contact.lastname || ''}`.trim()
                              : '未命名联系人'}
                          </h3>
                          {contact.properties?.company && (
                            <p className="text-sm text-gray-500 dark:text-gray-400">
                              {contact.properties.company}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* 联系信息 */}
                    <div className="space-y-2 mb-4">
                      {contact.email && (
                        <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                          <Mail size={16} className="flex-shrink-0" />
                          <span className="truncate">{contact.email}</span>
                        </div>
                      )}
                      {contact.properties?.line_display_name && (
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-1 bg-green-100 dark:bg-green-900/30 
                                       text-green-700 dark:text-green-300 text-xs rounded-full">
                            LINE: {contact.properties.line_display_name}
                          </span>
                        </div>
                      )}
                      {contact.properties?.lifecycle_stage && (
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-1 bg-blue-100 dark:bg-blue-900/30 
                                       text-blue-700 dark:text-blue-300 text-xs rounded-full">
                            {contact.properties.lifecycle_stage}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* 日期信息 */}
                    <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400 pt-4 
                                  border-t border-gray-100 dark:border-gray-700">
                      <Calendar size={14} />
                      <span>创建于 {formatDate(contact.createdAt)}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            
            {/* Pagination - Responsive Design */}
            {totalPages > 1 && (
              <div className="mt-8 bg-white dark:bg-gray-800 rounded-xl shadow-sm p-4">
                {/* Mobile Layout: Stacked */}
                <div className="flex flex-col gap-4 md:hidden">
                  {/* Info */}
                  <div className="text-sm text-center text-gray-600 dark:text-gray-400">
                    第 {currentPage} / {totalPages} 页 (共 {totalCount} 条)
                  </div>
                  
                  {/* Controls */}
                  <div className="flex items-center justify-center gap-2">
                    <button
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                      className="flex items-center gap-1 px-4 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 
                               dark:bg-gray-700 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed
                               text-gray-700 dark:text-gray-200 transition-all text-sm"
                    >
                      <ChevronLeft size={16} />
                      上一页
                    </button>
                    
                    {/* Current Page Indicator - Mobile */}
                    <div className="px-4 py-2 rounded-lg bg-blue-600 text-white font-semibold min-w-[60px] text-center">
                      {currentPage}
                    </div>
                    
                    <button
                      onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                      disabled={currentPage === totalPages}
                      className="flex items-center gap-1 px-4 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 
                               dark:bg-gray-700 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed
                               text-gray-700 dark:text-gray-200 transition-all text-sm"
                    >
                      下一页
                      <ChevronRight size={16} />
                    </button>
                  </div>
                  
                  {/* Quick Jump - Mobile */}
                  {totalPages > 3 && (
                    <div className="flex items-center justify-center gap-2 text-sm">
                      <span className="text-gray-600 dark:text-gray-400">跳转到</span>
                      <select
                        value={currentPage}
                        onChange={(e) => setCurrentPage(Number(e.target.value))}
                        className="px-3 py-1.5 rounded-lg border border-gray-300 dark:border-gray-600 
                                 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                      >
                        {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                          <option key={page} value={page}>第 {page} 页</option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
                
                {/* Desktop Layout: Horizontal */}
                <div className="hidden md:flex items-center justify-between">
                  <div className="text-sm text-gray-600 dark:text-gray-400">
                    显示 {(currentPage - 1) * pageSize + 1} - {Math.min(currentPage * pageSize, totalCount)} / 共 {totalCount} 条
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                      className="flex items-center gap-1 px-3 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 
                               dark:bg-gray-700 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed
                               text-gray-700 dark:text-gray-200 transition-all"
                    >
                      <ChevronLeft size={18} />
                      上一页
                    </button>
                    
                    {/* Page Numbers - Desktop */}
                    <div className="flex items-center gap-1">
                      {(() => {
                        const pages = [];
                        const maxVisible = 5;
                        
                        if (totalPages <= maxVisible) {
                          // Show all pages
                          for (let i = 1; i <= totalPages; i++) {
                            pages.push(i);
                          }
                        } else {
                          // Show ellipsis logic
                          if (currentPage <= 3) {
                            // Near start
                            pages.push(1, 2, 3, 4, '...', totalPages);
                          } else if (currentPage >= totalPages - 2) {
                            // Near end
                            pages.push(1, '...', totalPages - 3, totalPages - 2, totalPages - 1, totalPages);
                          } else {
                            // Middle
                            pages.push(1, '...', currentPage - 1, currentPage, currentPage + 1, '...', totalPages);
                          }
                        }
                        
                        return pages.map((page, idx) => {
                          if (page === '...') {
                            return (
                              <span key={`ellipsis-${idx}`} className="px-2 text-gray-500">
                                ...
                              </span>
                            );
                          }
                          
                          return (
                            <button
                              key={page}
                              onClick={() => setCurrentPage(page as number)}
                              className={`w-10 h-10 rounded-lg transition-all ${
                                currentPage === page
                                  ? 'bg-blue-600 text-white shadow-lg'
                                  : 'bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200'
                              }`}
                            >
                              {page}
                            </button>
                          );
                        });
                      })()}
                    </div>
                    
                    <button
                      onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                      disabled={currentPage === totalPages}
                      className="flex items-center gap-1 px-3 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 
                               dark:bg-gray-700 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed
                               text-gray-700 dark:text-gray-200 transition-all"
                    >
                      下一页
                      <ChevronRight size={18} />
                    </button>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
