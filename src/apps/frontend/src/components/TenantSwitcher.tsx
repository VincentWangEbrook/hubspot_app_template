'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { ChevronDown, Loader2, AlertCircle, RefreshCw } from 'lucide-react';
import { apiFetch } from '@/lib/api';

export type Tenant = {
  id: string; // HubSpot 账户ID（租户ID）
  name: string; // HubSpot 账户名称
  desc?: string; // 描述（可选）
  avatar?: string; // 账户头像（可选，默认用 HubSpot Logo）
};

interface TenantSwitcherProps {
  className?: string;
  onTenantChange?: (tenantId: string) => void;
  placeholder?: string;
  disabled?: boolean;
}

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
}

// 真实接口请求：获取用户关联的所有 HubSpot 账户（租户）
const fetchTenantList = async (): Promise<ApiResponse<Tenant[]>> => {
  try {
    const res = await apiFetch<Tenant[]>('tenant/my');
    if (res.success) {
      // 适配 HubSpot 账户数据格式（接口返回字段映射）
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

  // 加载/刷新租户列表（核心方法）
  const loadTenantList = useCallback(async () => {
    if (disabled) return;
    setIsLoading(true);
    setError(null);

    try {
      const res = await fetchTenantList();
      if (res.success && res.data) {
        const validTenants = res.data.filter(Boolean);
        setTenants(validTenants);

        // 首次加载：无活跃租户则默认选中第一个
        if (!activeTenantId && validTenants.length > 0) {
          const defaultId = validTenants[0].id;
          localStorage.setItem('activeTenantId', defaultId);
          loadActiveTenant(true);
        }
      } else {
        setError(res.message || '获取账户列表失败');
      }
    } catch (err) {
      setError('加载账户时发生错误，请重试');
    } finally {
      setIsLoading(false);
    }
  }, [disabled, activeTenantId]);

  // 加载活跃租户（本地存储同步）
  const loadActiveTenant = useCallback((isInitiative = false) => {
    const storedId = localStorage.getItem('activeTenantId');
    if (storedId && storedId !== activeTenantId) {
      setActiveTenantId(storedId);
      if (isInitiative) {
        onTenantChange?.(storedId);
        window.dispatchEvent(new Event('tenant:changed'));
      }
    }
  }, [activeTenantId]);

  // 初始化加载 + 监听授权成功事件刷新列表
  useEffect(() => {
    loadTenantList();
    const storedId = localStorage.getItem('activeTenantId');
    if (storedId) loadActiveTenant(false);

    // 监听 HubSpot 授权完成事件（来自 ConnectButton）
    const handleTenantRefresh = () => {
      loadTenantList(); // 重新请求账户列表
    };
    window.addEventListener('tenant:refresh', handleTenantRefresh);

    // 监听全局租户切换事件
    const handleGlobalChange = () => {
      loadActiveTenant(false);
    };
    window.addEventListener('tenant:changed', handleGlobalChange);

    // 清理监听
    return () => {
      window.removeEventListener('tenant:refresh', handleTenantRefresh);
      window.removeEventListener('tenant:changed', handleGlobalChange);
    };
  }, [loadTenantList, loadActiveTenant]);

  // 主动切换租户
  const handleChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    const newId = e.target.value;
    if (newId && newId !== activeTenantId) {
      localStorage.setItem('activeTenantId', newId);
      loadActiveTenant(true);
    }
  }, [activeTenantId, loadActiveTenant]);

  // 当前活跃租户
  const activeTenant = useMemo(
    () => tenants.find(t => t.id === activeTenantId) || null,
    [tenants, activeTenantId]
  );

  // 手动刷新（错误状态下可用）
  const handleRefresh = () => loadTenantList();

  // 禁用状态
  if (disabled) {
    return (
      <div className={`relative inline-flex items-center ${className}`}>
        <select
          disabled
          className="w-full pl-3 pr-10 py-1.5 text-sm rounded border border-gray-300 bg-gray-100 text-gray-500 cursor-not-allowed appearance-none"
        >
          <option>{placeholder}</option>
        </select>
        <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
      </div>
    );
  }

  // 加载中状态
  if (isLoading) {
    return (
      <div className={`relative inline-flex items-center ${className}`}>
        <select
          disabled
          className="w-full pl-3 pr-10 py-1.5 text-sm rounded border border-gray-300 bg-gray-50 text-gray-500 cursor-wait appearance-none"
        >
          <option>加载 HubSpot 账户中...</option>
        </select>
        <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 animate-spin" />
      </div>
    );
  }

  // 错误状态
  if (error) {
    return (
      <div className={`relative inline-flex items-center ${className}`}>
        <select
          disabled
          className="w-full pl-3 pr-16 py-1.5 text-sm rounded border border-red-300 bg-red-50 text-red-700 cursor-not-allowed appearance-none"
        >
          <option>{error}</option>
        </select>
        <button
          onClick={handleRefresh}
          className="absolute right-8 top-1/2 -translate-y-1/2 text-red-500 hover:text-red-700"
          aria-label="刷新"
        >
          <RefreshCw size={16} />
        </button>
        <AlertCircle className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-red-500 pointer-events-none" />
      </div>
    );
  }

  // 无账户状态（引导关联）
  if (tenants.length === 0) {
    return (
      <div className={`relative inline-flex items-center ${className}`}>
        <select
          disabled
          className="w-full pl-3 pr-10 py-1.5 text-sm rounded border border-gray-300 bg-gray-50 text-gray-500 cursor-not-allowed appearance-none"
        >
          <option>暂无关联的 HubSpot 账户</option>
        </select>
        <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
      </div>
    );
  }

  // 正常状态（显示 HubSpot 账户列表）
  return (
    <div className={`relative inline-flex items-center ${className}`}>
      <select
        value={activeTenantId ?? ''}
        onChange={handleChange}
        className="w-full pl-3 pr-10 py-1.5 text-sm rounded border border-gray-300 bg-white text-gray-900 focus:border-blue-500 focus:ring-blue-500 outline-none appearance-none hover:border-gray-400 transition-colors"
        aria-label="切换 HubSpot 账户"
      >
        {tenants.map(tenant => (
        <option
          key={tenant.id}
          value={tenant.id}
          // 用 title 属性显示完整信息（替代 span 描述）
          title={tenant.desc ? `${tenant.name} - ${tenant.desc}` : tenant.name}
          // 自定义类名，通过伪元素添加图标
          className="py-1 pl-8 relative" // pl-8 预留图标空间
        >
          {/* 仅保留纯文本，移除 img 和 span 标签 */}
          {tenant.name}
        </option>
      ))}
      </select>
      <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500 pointer-events-none" />
    </div>
  );
}