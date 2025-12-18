'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronDown, Loader2, AlertCircle, RefreshCw, Building2, CheckCircle2 } from 'lucide-react';
import { apiFetch, ApiResponse } from '@/lib/apiFetch';
import { useTenant } from '@/context/TenantContext';
import { getLastTenantId } from '@/utils/tenantUrl';

export type Tenant = {
  id: string;
  name: string;
  desc?: string;
  avatar?: string;
};

interface TenantSwitcherProps {
  className?: string;
  onTenantChange?: (tenantId: string) => void;
  placeholder?: string;
  disabled?: boolean;
}

const fetchTenantList = async (): Promise<ApiResponse<Tenant[]>> => {
  try {
    const res = await apiFetch<Tenant[]>('tenant/my');
    if (res.success) {
      const hubspotTenants = res.data?.map(tenant => ({
        id: tenant.id,
        name: tenant.name || `HubSpot_${tenant.id.slice(0, 6)}`,
        desc: tenant.desc || '关联的 HubSpot 账户',
        avatar: tenant.avatar || 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/59/HubSpot_Logo.png/600px-HubSpot_Logo.png',
      })) || [];
      return { success: true, data: hubspotTenants };
    }
    return { success: false, message: res.message || '获取账户列表失败' };
  } catch (error) {
    console.error('获取 HubSpot 账户列表失败:', error);
    return { success: false, message: '网络异常，无法加载账户' };
  }
};

export default function TenantSwitcher({
  className = '',
  onTenantChange,
  placeholder = '选择 HubSpot 账户',
  disabled = false,
}: TenantSwitcherProps) {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [activeTenantId, setActiveTenantId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const router = useRouter();
  const { switchTenant } = useTenant();

  const loadTenantList = useCallback(async () => {
    if (disabled) return;
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetchTenantList();
      if (res.success && res.data) {
        const validTenants = res.data.filter(Boolean);
        setTenants(validTenants);

        if (!activeTenantId && validTenants.length > 0) {
          const defaultId = validTenants[0].id;
          setActiveTenantId(defaultId);
        }
      } else {
        setError(res.message || '获取账户列表失败');
      }
    } catch (err) {
      setError('加载账户时发生错误，请重试');
    } finally {
      setIsLoading(false);
    }
  }, [disabled, activeTenantId, router]);

  const loadActiveTenant = useCallback(() => {
    const storedId = getLastTenantId();
    if (storedId && storedId !== activeTenantId) {
      setActiveTenantId(storedId);
    }
  }, [activeTenantId]);

  useEffect(() => {
    loadTenantList();
    loadActiveTenant();

    const handleTenantRefresh = () => {
      loadTenantList();
    };
    window.addEventListener('tenant:refresh', handleTenantRefresh);

    return () => {
      window.removeEventListener('tenant:refresh', handleTenantRefresh);
    };
  }, [loadTenantList, loadActiveTenant]);

  const handleChange = useCallback((newId: string) => {
    if (newId && newId !== activeTenantId) {
      setActiveTenantId(newId);
      router.push(`/${newId}/hubspot`);
      onTenantChange?.(newId);
      setIsOpen(false);
    }
  }, [activeTenantId, router, onTenantChange]);

  const activeTenant = useMemo(
    () => tenants.find(t => t.id === activeTenantId) || null,
    [tenants, activeTenantId]
  );

  const handleRefresh = () => loadTenantList();

  if (disabled) {
    return (
      <div className={`relative ${className}`}>
        <div className="flex items-center gap-2 px-3 py-2 bg-gray-100 border border-gray-300 rounded-lg text-gray-500 cursor-not-allowed">
          <Building2 size={16} />
          <span className="text-sm flex-1 truncate">{placeholder}</span>
          <ChevronDown size={16} className="text-gray-400" />
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className={`relative ${className}`}>
        <div className="flex items-center gap-2 px-3 py-2 bg-white/50 border border-blue-200 rounded-lg">
          <Loader2 size={16} className="animate-spin text-blue-600" />
          <span className="text-sm text-gray-600 flex-1">加载中...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`relative ${className}`}>
        <div className="flex items-center gap-2 px-3 py-2 bg-red-50 border border-red-300 rounded-lg">
          <AlertCircle size={16} className="text-red-600 flex-shrink-0" />
          <span className="text-sm text-red-700 flex-1 truncate">{error}</span>
          <button
            onClick={handleRefresh}
            className="p-1 hover:bg-red-100 rounded transition-colors"
            aria-label="刷新"
          >
            <RefreshCw size={14} className="text-red-600" />
          </button>
        </div>
      </div>
    );
  }

  if (tenants.length === 0) {
    return (
      <div className={`relative ${className}`}>
        <div className="flex items-center gap-2 px-3 py-2 bg-orange-50 border border-orange-300 rounded-lg">
          <AlertCircle size={16} className="text-orange-600" />
          <span className="text-sm text-orange-700 flex-1">暂无关联账户</span>
        </div>
      </div>
    );
  }

  return (
    <div className={`relative ${className}`}>
      {/* Trigger Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center gap-2 px-3 py-2 bg-white border border-gray-300 hover:border-blue-400 rounded-lg transition-all duration-200 hover:shadow-md group"
      >
        <div className="w-6 h-6 rounded bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center flex-shrink-0">
          <Building2 size={14} className="text-white" />
        </div>
        <span className="text-sm font-medium text-gray-900 flex-1 truncate text-left">
          {activeTenant?.name || placeholder}
        </span>
        <ChevronDown 
          size={16} 
          className={`text-gray-500 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} 
        />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <>
          {/* Backdrop */}
          <div 
            className="fixed inset-0 z-40" 
            onClick={() => setIsOpen(false)}
          />
          
          {/* Menu */}
          <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-xl shadow-2xl ring-1 ring-black/5 py-2 z-50 animate-in fade-in slide-in-from-top-2 duration-200 max-h-80 overflow-y-auto">
            {tenants.map(tenant => (
              <button
                key={tenant.id}
                onClick={() => handleChange(tenant.id)}
                className={`w-full flex items-center gap-3 px-4 py-3 hover:bg-blue-50 transition-colors ${
                  tenant.id === activeTenantId ? 'bg-blue-50' : ''
                }`}
              >
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center flex-shrink-0 shadow-md">
                  <Building2 size={16} className="text-white" />
                </div>
                <div className="flex-1 text-left min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{tenant.name}</p>
                  {tenant.desc && (
                    <p className="text-xs text-gray-500 truncate">{tenant.desc}</p>
                  )}
                </div>
                {tenant.id === activeTenantId && (
                  <CheckCircle2 size={18} className="text-blue-600 flex-shrink-0" />
                )}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}