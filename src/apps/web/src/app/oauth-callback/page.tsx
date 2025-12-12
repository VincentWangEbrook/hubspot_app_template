"use client";

import React, { useEffect } from 'react';
// 1. 替换路由包：从 next/navigation 导入 useRouter
import { useRouter } from 'next/navigation'; 
import { apiFetch } from '../../lib/apiFetch';
import { getLastTenantId } from '@/utils/tenantUrl';

export default function Callback() {
  const router = useRouter(); // 2. 初始化 App Router 的路由实例

  useEffect(() => {
    async function handle() {
      const params = new URLSearchParams(window.location.search);
      const code = params.get('code');
      const state = params.get('state');
      
      if (!code) {
        // 无授权码，重定向到租户选择或最后访问的租户
        const lastTenantId = getLastTenantId();
        router.push(lastTenantId ? `/${lastTenantId}/hubspot` : '/settings/tenants');
        return;
      }

      try {
        await apiFetch('auth/hubspot', { data: {code, tenantId: state }});
      } catch (err) {
        console.error('HubSpot 授权失败:', err);
      }

      // 授权完成后，重定向到最后访问的租户或租户选择页
      const lastTenantId = getLastTenantId();
      router.push(lastTenantId ? `/${lastTenantId}/hubspot` : '/settings/tenants');
    }

    handle();
  }, [router]); // 依赖项保持 router

  return <div>Connecting... please wait</div>;
}