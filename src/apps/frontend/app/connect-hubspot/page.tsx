"use client";

import React, { useEffect, useState } from 'react';
import axios from 'axios';

export default function LoginPage() {
  const [url, setUrl] = useState('');

  async function getUrl() {
    try {
      // 生成随机 state（用于防止 CSRF 攻击，建议存储到 sessionStorage 供后续验证）
      const state = crypto.randomUUID();
      sessionStorage.setItem('hubspot_auth_state', state); // 存储 state 供回调时验证

      // 检查环境变量是否存在（避免 undefined 导致的 URL 错误）
      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL;
      if (!backendUrl) {
        throw new Error('Backend URL is not configured. Please check environment variables.');
      }
  
      // 使用 URL 构造函数拼接 URL（自动处理特殊字符编码）
      const url = new URL('auth/hubspot/url', backendUrl);
      url.searchParams.append('state', state); // 自动编码 state 中的特殊字符


      const res = await axios.get<{ url: string }>(url.toString());
      // 验证后端返回的 URL 是否有效
      if (!res.data?.url) {
        throw new Error('Invalid response from server: URL not found');
      }
  
      setUrl(res.data.url); // 更新状态
    } catch (error) {
      // 精细化错误处理（区分不同错误类型）
      const errorMessage = error instanceof Error 
        ? error.message 
        : 'An unknown error occurred while fetching the URL';
      
      console.error('Failed to fetch URL:', errorMessage);
      alert(`Failed to fetch authentication URL: ${errorMessage}. Please try again.`); // 更具体的用户提示
    }
  }

  useEffect(() => { getUrl(); }, []);

  return (
    <div style={{ padding: 20 }}>
      <h1>Login / Connect HubSpot</h1>
      <p>Click to connect HubSpot (demo tenant)</p>
      <a href={url}><button>Connect HubSpot</button></a>
    </div>
  );
}
