'use client';

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { getTenantIdFromUrl, setLastTenantId, replaceTenantInUrl } from '@/utils/tenantUrl';

interface TenantContextValue {
  tenantId: string | null;
  switchTenant: (newTenantId: string) => void;
  isLoading: boolean;
}

const TenantContext = createContext<TenantContextValue | undefined>(undefined);

export function TenantProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [tenantId, setTenantId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // 从URL提取租户ID（单一真实来源）
  useEffect(() => {
    const extractedTenantId = getTenantIdFromUrl(pathname);
    setTenantId(extractedTenantId);
    
    // 自动缓存到localStorage（仅用于记忆）
    if (extractedTenantId) {
      setLastTenantId(extractedTenantId);
    }
    
    setIsLoading(false);
  }, [pathname]);

  // 切换租户
  const switchTenant = useCallback((newTenantId: string) => {
    if (!newTenantId) return;
    
    // 生成新的URL（保留当前页面路径）
    const newPath = replaceTenantInUrl(pathname, newTenantId);
    
    // 通过路由导航切换（URL作为真实来源）
    router.push(newPath);
    
    // localStorage会在下次useEffect中自动更新
  }, [pathname, router]);

  return (
    <TenantContext.Provider value={{ tenantId, switchTenant, isLoading }}>
      {children}
    </TenantContext.Provider>
  );
}

/**
 * Hook to access current tenant context
 * @returns Current tenant ID and switch function
 */
export function useTenant() {
  const context = useContext(TenantContext);
  if (context === undefined) {
    throw new Error('useTenant must be used within a TenantProvider');
  }
  return context;
}
