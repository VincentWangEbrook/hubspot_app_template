"use client";

import React, { useEffect } from 'react';
// 1. 替换路由包：从 next/navigation 导入 useRouter
import { useRouter } from 'next/navigation'; 
import axios from 'axios';

export default function Callback() {
  const router = useRouter(); // 2. 初始化 App Router 的路由实例

  useEffect(() => {
    async function handle() {
      const params = new URLSearchParams(window.location.search);
      const code = params.get('code');
      const state = params.get('state') || 'tenant_demo';
      
      if (!code) {
        router.push('/connect-hubspot'); // 3. 跳转逻辑不变（App Router 的 push 支持字符串路径）
        return;
      }

      try {
        const res = await axios.post(
          process.env.NEXT_PUBLIC_HUBSPOT_AUTH_URL as string, // 增加类型断言（可选，避免 undefined 提示）
          { code, tenantId: state }
        );
        
        if (res.data.success) {
          router.push('/dashboard');
        } else {
          router.push('/connect-hubspot');
        }
      } catch (err) {
        console.error('HubSpot 授权失败:', err);
        router.push('/connect-hubspot');
      }
    }

    handle();
  }, [router]); // 依赖项保持 router

  return <div>Connecting... please wait</div>;
}