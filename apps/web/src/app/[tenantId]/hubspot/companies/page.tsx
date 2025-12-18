'use client'

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTenant } from '@/context/TenantContext';
import { apiFetch } from '@/lib/apiFetch';
import { Search, Building, RefreshCw, AlertCircle, ChevronLeft, ChevronRight, ExternalLink, Filter, BarChart3, Users, DollarSign, TrendingUp, X, Globe, MapPin } from 'lucide-react';
import HubSpotConnectButton from '@/components/HubSpotConnectButton';

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
}

interface PaginatedResponse {
  data: Company[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

interface SyncProgress {
  status: string;
  totalRecords: number;
  processedRecords: number;
  startedAt?: string;
  completedAt?: string;
}

interface Stats {
  total: number;
  withEmployees: number;
  withRevenue: number;
  topIndustries: Array<{ industry: string; count: number }>;
}

export default function CompaniesPage() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(25);
  const [totalPages, setTotalPages] = useState(1);
  
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Filters
  const [industryFilter, setIndustryFilter] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  
  // Stats
  const [stats, setStats] = useState<Stats>({
    total: 0,
    withEmployees: 0,
    withRevenue: 0,
    topIndustries: [],
  });
  
  // Sync progress
  const [syncProgress, setSyncProgress] = useState<SyncProgress | null>(null);
  const [showProgress, setShowProgress] = useState(false);
  
  // Authorization status
  const [isAuthError, setIsAuthError] = useState(false);
  
  const router = useRouter();
  const { tenantId, isLoading: isTenantLoading } = useTenant();

  // Calculate stats from companies
  useEffect(() => {
    if (companies.length > 0) {
      const withEmployees = companies.filter(c => c.num_employees).length;
      const withRevenue = companies.filter(c => c.annual_revenue).length;
      
      // Count industries
      const industryCount: { [key: string]: number } = {};
      companies.forEach(c => {
        if (c.industry) {
          industryCount[c.industry] = (industryCount[c.industry] || 0) + 1;
        }
      });
      
      const topIndustries = Object.entries(industryCount)
        .map(([industry, count]) => ({ industry, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);
      
      setStats({
        total: totalCount,
        withEmployees,
        withRevenue,
        topIndustries,
      });
    }
  }, [companies, totalCount]);

  // Load companies
  const loadCompanies = async () => {
    if (!tenantId) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const params = new URLSearchParams({
        tenantId,
        page: String(currentPage),
        pageSize: String(pageSize),
      });
      
      if (searchQuery) params.append('search', searchQuery);
      if (industryFilter) params.append('industry', industryFilter);
      
      const res = await apiFetch<PaginatedResponse>(`hubspot/companies?${params.toString()}`);
      
      if (res.success && res.data) {
        setCompanies(res.data.data);
        setTotalCount(res.data.total);
        setTotalPages(res.data.totalPages);
      } else {
        setError(res.error || 'Failed to load companies');
      }
    } catch (err: any) {
      if (err.message?.includes('未授权') || err.message?.includes('Unauthorized')) {
        setIsAuthError(true);
      }
      setError(err.message || 'Failed to load companies');
    } finally {
      setLoading(false);
    }
  };

  // Sync companies
  const handleSync = async () => {
    if (!tenantId || syncing) return;
    
    setSyncing(true);
    setError(null);
    setShowProgress(true);
    
    try {
      const res = await apiFetch(`hubspot/companies/sync?tenantId=${tenantId}`, {
        method: 'POST',
      });
      
      if (res.success) {
        pollSyncProgress();
      } else {
        setError(res.error || 'Sync failed');
        setSyncing(false);
        setShowProgress(false);
      }
    } catch (err: any) {
      setError(err.message || 'Sync failed');
      setSyncing(false);
      setShowProgress(false);
    }
  };

  // Poll sync progress
  const pollSyncProgress = async () => {
    if (!tenantId) return;
    
    const intervalId = setInterval(async () => {
      try {
        const res = await apiFetch<SyncProgress>(`hubspot/companies/sync/status?tenantId=${tenantId}`);
        
        if (res.success && res.data) {
          setSyncProgress(res.data);
          
          if (res.data.status === 'completed' || res.data.status === 'failed') {
            clearInterval(intervalId);
            setSyncing(false);
            
            setTimeout(() => {
              setShowProgress(false);
              setSyncProgress(null);
            }, 2000);
            
            if (res.data.status === 'completed') {
              loadCompanies();
            }
          }
        }
      } catch (err) {
        console.error('Failed to poll sync status:', err);
        clearInterval(intervalId);
        setSyncing(false);
      }
    }, 500);
  };

  // Load companies on mount and when filters change
  useEffect(() => {
    if (!isTenantLoading && tenantId) {
      loadCompanies();
    }
  }, [tenantId, isTenantLoading, currentPage, searchQuery, industryFilter]);

  // Search debounce
  const handleSearch = (value: string) => {
    setSearchQuery(value);
    setCurrentPage(1);
  };

  // Format currency
  const formatCurrency = (amount: number) => {
    if (amount >= 1000000) {
      return `$${(amount / 1000000).toFixed(1)}M`;
    } else if (amount >= 1000) {
      return `$${(amount / 1000).toFixed(0)}K`;
    }
    return `$${amount}`;
  };

  if (isTenantLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-4 border-blue-600 border-t-transparent mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">加载中...</p>
        </div>
      </div>
    );
  }

  if (isAuthError) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 dark:from-gray-900 dark:via-purple-900/20 dark:to-blue-900/20 p-8">
        <div className="max-w-4xl mx-auto">
          <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-2xl p-12 text-center backdrop-blur-sm bg-opacity-90 dark:bg-opacity-90">
            <div className="w-24 h-24 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg">
              <AlertCircle className="w-12 h-12 text-white" />
            </div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">
              HubSpot未授权
            </h1>
            <p className="text-lg text-gray-600 dark:text-gray-400 mb-8">
              请先连接您的HubSpot账号以管理公司数据
            </p>
            <HubSpotConnectButton />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50/30 to-purple-50/30 dark:from-gray-900 dark:via-blue-900/10 dark:to-purple-900/10">
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-4 mb-3">
            <div className="w-14 h-14 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl flex items-center justify-center shadow-lg">
              <Building className="w-8 h-8 text-white" />
            </div>
            <div>
              <h1 className="text-4xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 dark:from-white dark:to-gray-300 bg-clip-text text-transparent">
                HubSpot 公司
              </h1>
              <p className="text-gray-600 dark:text-gray-400 mt-1">
                管理和同步您的HubSpot公司数据
              </p>
            </div>
          </div>
        </div>

        {/* Statistics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6 border border-gray-100 dark:border-gray-700 hover:shadow-xl transition-all duration-300">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center">
                <Building className="w-6 h-6 text-white" />
              </div>
              <TrendingUp className="w-5 h-5 text-green-500" />
            </div>
            <p className="text-3xl font-bold text-gray-900 dark:text-white mb-1">
              {stats.total.toLocaleString()}
            </p>
            <p className="text-sm text-gray-600 dark:text-gray-400">总公司数</p>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6 border border-gray-100 dark:border-gray-700 hover:shadow-xl transition-all duration-300">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl flex items-center justify-center">
                <Users className="w-6 h-6 text-white" />
              </div>
              <BarChart3 className="w-5 h-5 text-purple-500" />
            </div>
            <p className="text-3xl font-bold text-gray-900 dark:text-white mb-1">
              {stats.withEmployees}
            </p>
            <p className="text-sm text-gray-600 dark:text-gray-400">有员工数据</p>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6 border border-gray-100 dark:border-gray-700 hover:shadow-xl transition-all duration-300">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-green-600 rounded-xl flex items-center justify-center">
                <DollarSign className="w-6 h-6 text-white" />
              </div>
              <TrendingUp className="w-5 h-5 text-green-500" />
            </div>
            <p className="text-3xl font-bold text-gray-900 dark:text-white mb-1">
              {stats.withRevenue}
            </p>
            <p className="text-sm text-gray-600 dark:text-gray-400">有营收数据</p>
          </div>

          <div className="bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl shadow-lg p-6 text-white hover:shadow-xl transition-all duration-300">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center">
                <BarChart3 className="w-6 h-6 text-white" />
              </div>
            </div>
            <p className="text-2xl font-bold mb-1">
              {stats.topIndustries.length > 0 ? stats.topIndustries[0].industry : '-'}
            </p>
            <p className="text-sm text-blue-100">顶级行业</p>
          </div>
        </div>

        {/* Sync Progress */}
        {showProgress && syncProgress && (
          <div className="mb-6 bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 border-2 border-blue-200 dark:border-blue-800 rounded-2xl p-6 shadow-lg">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <div className={`w-3 h-3 rounded-full ${syncProgress.status === 'running' ? 'bg-blue-500 animate-pulse' : syncProgress.status === 'completed' ? 'bg-green-500' : 'bg-red-500'}`}></div>
                <span className="text-lg font-semibold text-gray-900 dark:text-white">
                  {syncProgress.status === 'running' ? '🔄 正在同步公司...' : 
                   syncProgress.status === 'completed' ? '✅ 同步完成!' : 
                   '❌ 同步失败'}
                </span>
              </div>
              <span className="text-sm font-medium text-blue-700 dark:text-blue-300 bg-white dark:bg-gray-800 px-4 py-2 rounded-lg">
                {syncProgress.processedRecords} / {syncProgress.totalRecords}
              </span>
            </div>
            <div className="relative w-full bg-blue-200 dark:bg-blue-800 rounded-full h-3 overflow-hidden">
              <div 
                className="absolute top-0 left-0 h-full bg-gradient-to-r from-blue-500 to-purple-600 rounded-full transition-all duration-300 ease-out shadow-lg"
                style={{ 
                  width: `${syncProgress.totalRecords > 0 ? (syncProgress.processedRecords / syncProgress.totalRecords * 100) : 0}%` 
                }}
              >
                <div className="absolute inset-0 bg-white/20 animate-pulse"></div>
              </div>
            </div>
          </div>
        )}

        {/* Actions Bar */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6 mb-6 border border-gray-100 dark:border-gray-700">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            {/* Search */}
            <div className="flex-1 max-w-2xl">
              <div className="relative group">
                <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 group-hover:text-blue-500 transition-colors w-5 h-5" />
                <input
                  type="text"
                  placeholder="搜索公司名称、域名、行业..."
                  className="w-full pl-12 pr-4 py-3 border-2 border-gray-200 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white transition-all duration-200 hover:border-blue-300"
                  value={searchQuery}
                  onChange={(e) => handleSearch(e.target.value)}
                />
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3">
              <button
                onClick={() => setShowFilters(!showFilters)}
                className={`flex items-center gap-2 px-5 py-3 border-2 ${showFilters ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300' : 'border-gray-300 dark:border-gray-600 hover:border-blue-400 text-gray-700 dark:text-gray-300'} rounded-xl font-medium transition-all duration-200`}
              >
                <Filter className="w-5 h-5" />
                过滤器
              </button>
              
              <button
                onClick={handleSync}
                disabled={syncing}
                className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 disabled:from-gray-400 disabled:to-gray-500 text-white font-semibold rounded-xl shadow-lg hover:shadow-xl transition-all duration-200 disabled:cursor-not-allowed"
              >
                <RefreshCw className={`w-5 h-5 ${syncing ? 'animate-spin' : ''}`} />
                {syncing ? '同步中...' : '同步公司'}
              </button>
            </div>
          </div>

          {/* Filters Panel */}
          {showFilters && (
            <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    行业
                  </label>
                  <select
                    value={industryFilter}
                    onChange={(e) => {
                      setIndustryFilter(e.target.value);
                      setCurrentPage(1);
                    }}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                  >
                    <option value="">全部行业</option>
                    {stats.topIndustries.map(({ industry }) => (
                      <option key={industry} value={industry}>{industry}</option>
                    ))}
                  </select>
                </div>
                
                {industryFilter && (
                  <div className="flex items-end">
                    <button
                      onClick={() => {
                        setIndustryFilter('');
                        setCurrentPage(1);
                      }}
                      className="flex items-center gap-2 px-4 py-2 text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 font-medium"
                    >
                      <X className="w-4 h-4" />
                      清除过滤器
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-6 bg-gradient-to-r from-red-50 to-orange-50 dark:from-red-900/20 dark:to-orange-900/20 border-2 border-red-200 dark:border-red-800 rounded-2xl p-5 shadow-lg">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 bg-red-500 rounded-xl flex items-center justify-center flex-shrink-0">
                <AlertCircle className="w-6 h-6 text-white" />
              </div>
              <p className="text-red-900 dark:text-red-200 font-medium">{error}</p>
            </div>
          </div>
        )}

        {/* Companies Grid/Table */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl overflow-hidden border border-gray-100 dark:border-gray-700">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gradient-to-r from-gray-50 to-gray-100 dark:from-gray-700 dark:to-gray-800 border-b-2 border-gray-200 dark:border-gray-600">
                <tr>
                  <th className="px-6 py-5 text-left text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                    公司信息
                  </th>
                  <th className="px-6 py-5 text-left text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                    行业
                  </th>
                  <th className="px-6 py-5 text-left text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                    地点
                  </th>
                  <th className="px-6 py-5 text-left text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                    规模
                  </th>
                  <th className="px-6 py-5 text-right text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                    操作
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {loading ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-16 text-center">
                      <div className="flex flex-col items-center gap-4">
                        <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-600 border-t-transparent"></div>
                        <p className="text-gray-600 dark:text-gray-400 font-medium">加载公司数据...</p>
                      </div>
                    </td>
                  </tr>
                ) : companies.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-16 text-center">
                      <div className="flex flex-col items-center gap-4">
                        <div className="w-20 h-20 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center">
                          <Building className="w-10 h-10 text-gray-400" />
                        </div>
                        <div>
                          <p className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                            {searchQuery ? '未找到匹配的公司' : '暂无公司数据'}
                          </p>
                          <p className="text-gray-500 dark:text-gray-400">
                            {!searchQuery && '点击"同步公司"开始导入HubSpot数据'}
                          </p>
                        </div>
                      </div>
                    </td>
                  </tr>
                ) : (
                  companies.map((company, index) => (
                    <tr 
                      key={company.id}
                      className="hover:bg-gradient-to-r hover:from-blue-50 hover:to-purple-50 dark:hover:from-blue-900/10 dark:hover:to-purple-900/10 transition-all duration-200 cursor-pointer group"
                      onClick={() => router.push(`/${tenantId}/hubspot/companies/${company.id}`)}
                      style={{ animationDelay: `${index * 50}ms` }}
                    >
                      <td className="px-6 py-5">
                        <div className="flex items-center gap-4">
                          <div className="relative flex-shrink-0 w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-500 via-purple-500 to-pink-500 flex items-center justify-center shadow-lg group-hover:shadow-xl group-hover:scale-110 transition-all duration-300">
                            <Building className="w-7 h-7 text-white" />
                            <div className="absolute inset-0 rounded-2xl bg-white/10 group-hover:bg-white/20 transition-all"></div>
                          </div>
                          <div className="min-w-0">
                            <p className="font-semibold text-gray-900 dark:text-white text-lg truncate group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                              {company.name || '未命名公司'}
                            </p>
                            <div className="flex items-center gap-3 mt-1">
                              {company.domain && (
                                <div className="flex items-center gap-1 text-sm text-gray-600 dark:text-gray-400">
                                  <Globe className="w-3.5 h-3.5" />
                                  <span className="truncate max-w-[200px]">{company.domain}</span>
                                </div>
                              )}
                              <span className="text-xs text-gray-400 dark:text-gray-500 font-mono">
                                ID: {company.hubspot_id}
                              </span>
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-5">
                        {company.industry ? (
                          <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-gradient-to-r from-blue-100 to-purple-100 dark:from-blue-900/30 dark:to-purple-900/30 text-blue-800 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                            {company.industry}
                          </span>
                        ) : (
                          <span className="text-gray-400 dark:text-gray-500">-</span>
                        )}
                      </td>
                      <td className="px-6 py-5">
                        {(company.city || company.state || company.country) ? (
                          <div className="flex items-center gap-2 text-gray-700 dark:text-gray-300">
                            <MapPin className="w-4 h-4 text-gray-400" />
                            <span>
                              {[company.city, company.state, company.country].filter(Boolean).join(', ')}
                            </span>
                          </div>
                        ) : (
                          <span className="text-gray-400 dark:text-gray-500">-</span>
                        )}
                      </td>
                      <td className="px-6 py-5">
                        <div className="space-y-2">
                          {company.num_employees && (
                            <div className="flex items-center gap-2">
                              <Users className="w-4 h-4 text-purple-500" />
                              <span className="text-sm font-semibold text-gray-900 dark:text-white">
                                {company.num_employees.toLocaleString()} 员工
                              </span>
                            </div>
                          )}
                          {company.annual_revenue && (
                            <div className="flex items-center gap-2">
                              <DollarSign className="w-4 h-4 text-green-500" />
                              <span className="text-sm font-semibold text-green-600 dark:text-green-400">
                                {formatCurrency(company.annual_revenue)}
                              </span>
                            </div>
                          )}
                          {!company.num_employees && !company.annual_revenue && (
                            <span className="text-gray-400 dark:text-gray-500">-</span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-5 text-right">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            window.open(`https://app.hubspot.com/contacts/${company.hubspot_id}`, '_blank');
                          }}
                          className="inline-flex items-center gap-2 px-4 py-2 text-blue-600 hover:text-white hover:bg-blue-600 dark:text-blue-400 dark:hover:bg-blue-500 border-2 border-blue-600 dark:border-blue-400 rounded-lg font-medium transition-all duration-200 group-hover:shadow-lg"
                        >
                          <ExternalLink className="w-4 h-4" />
                          <span className="text-sm">HubSpot</span>
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {!loading && totalPages > 1 && (
            <div className="border-t-2 border-gray-200 dark:border-gray-700 px-6 py-5 bg-gray-50 dark:bg-gray-800/50">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  显示 <span className="text-blue-600 dark:text-blue-400 font-bold">{(currentPage - 1) * pageSize + 1}</span> 到{' '}
                  <span className="text-blue-600 dark:text-blue-400 font-bold">
                    {Math.min(currentPage * pageSize, totalCount)}
                  </span>{' '}
                  共 <span className="text-blue-600 dark:text-blue-400 font-bold">{totalCount}</span> 条
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="px-4 py-2 rounded-xl border-2 border-gray-300 dark:border-gray-600 hover:bg-blue-600 hover:text-white hover:border-blue-600 dark:hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-gray-700 dark:disabled:hover:text-gray-300 transition-all duration-200 font-medium"
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                  <div className="px-5 py-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white font-bold rounded-xl shadow-lg">
                    {currentPage} / {totalPages}
                  </div>
                  <button
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    className="px-4 py-2 rounded-xl border-2 border-gray-300 dark:border-gray-600 hover:bg-blue-600 hover:text-white hover:border-blue-600 dark:hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-gray-700 dark:disabled:hover:text-gray-300 transition-all duration-200 font-medium"
                  >
                    <ChevronRight className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
