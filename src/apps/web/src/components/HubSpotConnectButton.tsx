'use client';
import { useRouter } from 'next/navigation';
import { useState, useEffect, useCallback } from 'react';
import { ExternalLink, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';
import axios from 'axios';
import { UserInfo } from '@/types';
import { useUser } from '@/context/UserContext';

// 类型扩展：添加初始化状态
type UserState = UserInfo | null;

// 定义组件 Props 类型（更精确的类型约束）
interface HubspotConnectButtonProps {
  disabled?: boolean;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  onSuccess?: () => void; // 成功回调（可选）
  onError?: (error: Error) => void; // 错误回调（可选）
}

// 尺寸样式映射（优化间距和对齐，与系统组件视觉统一）
const sizeClasses = {
  sm: 'px-2 py-1 text-xs gap-1',
  md: 'px-3 py-1.5 text-sm gap-1.5',
  lg: 'px-4 py-2 text-base gap-2',
} as const;

// 环境变量校验（提前报错，便于开发调试）
const validateEnv = () => {
  const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL;
  if (!backendUrl) {
    throw new Error('环境变量 NEXT_PUBLIC_BACKEND_URL 未配置，请检查 .env 文件');
  }
  return backendUrl;
};

export default function HubspotConnectButton({
  disabled = false,
  size = 'md',
  className = '',
  onSuccess,
  onError,
}: HubspotConnectButtonProps) {
  const router = useRouter();
  const { user: contextUser } = useUser();
  const [user, setUser] = useState<UserState>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [authUrl, setAuthUrl] = useState<string>('');
  const [tempError, setTempError] = useState<string | null>(null); // 临时错误提示（自动消失）

    useEffect(() => {
    const initUserState = async () => {
      if (contextUser) {
        setUser(contextUser);
      } else {
        setUser(null);
      }
      setIsLoading(false);
    };

    initUserState();
  }, [contextUser]);

  // 环境变量缓存（避免重复校验）
  const backendUrl = validateEnv();

  // 生成随机 State（抽离为独立函数，便于复用和测试）
  const generateState = useCallback((): string => {
    const state = crypto.randomUUID();
    sessionStorage.setItem('hubspot_auth_state', state); // 存储用于 CSRF 验证
    return state;
  }, []);

  // 获取授权 URL（优化性能：使用 useCallback 缓存，避免依赖变化重复创建）
  const fetchAuthUrl = useCallback(async () => {
    if (tempError) setTempError(null); // 清除之前的错误

    try {
      const state = generateState();
      const url = new URL('auth/hubspot/url', backendUrl);
      url.searchParams.append('state', state);

      // 优化 axios 请求配置（超时控制、响应类型限制）
      const res = await axios.get<{ url: string }>(url.toString(), {
        timeout: 10000, // 10秒超时
        responseType: 'json',
        headers: {
          'Accept': 'application/json',
        },
      });

      if (!res.data?.url || typeof res.data.url !== 'string') {
        throw new Error('后端返回无效的授权 URL');
      }

      setAuthUrl(res.data.url);
      return res.data.url;
    } catch (error) {
      const err = error instanceof Error 
        ? error 
        : new Error('获取 HubSpot 授权 URL 失败');
      
      // 触发外部错误回调
      onError?.(err);
      // 显示临时错误提示（用户可看到）
      setTempError(err.message);
      console.error('获取 HubSpot 授权 URL 失败：', err);
      return null;
    }
  }, [backendUrl, generateState, tempError, onError]);

  // 初始化获取授权 URL（仅在登录状态下执行）
  useEffect(() => {
    if (user) {
      fetchAuthUrl();
    }
  }, [user, fetchAuthUrl]);

  // 临时错误自动消失（优化用户体验，避免错误常驻）
  useEffect(() => {
    if (tempError) {
      const timer = setTimeout(() => setTempError(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [tempError]);

  // 处理关联按钮点击（优化逻辑：先校验 URL，再跳转）
  const handleConnect = async () => {
    if (isLoading || disabled || !authUrl) return;

    setIsLoading(true);
    setTempError(null);

    try {
      // 跳转前验证 URL 有效性（兜底校验）
      new URL(authUrl); // 若 URL 无效会抛出错误
      router.push(authUrl);
      onSuccess?.(); // 触发成功回调
    } catch (error) {
      const err = error instanceof Error 
        ? error 
        : new Error('跳转 HubSpot 授权页面失败');
      
      onError?.(err);
      setTempError(err.message);
      console.error('跳转 HubSpot 授权失败：', err);
    } finally {
      setIsLoading(false);
    }
  };

  // 未登录时不渲染组件
  if (!user) return null;

  // 组合最终样式（优先级：用户自定义 > 尺寸样式 > 基础样式）
  const combinedClasses = [
    'inline-flex items-center justify-center rounded border transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2',
    sizeClasses[size],
    'border-blue-300 bg-blue-50 text-blue-700 hover:bg-blue-100 hover:border-blue-400 focus:ring-blue-500',
    (isLoading || disabled) && 'opacity-70 cursor-not-allowed',
    className,
  ].filter(Boolean).join(' ');

  return (
    <div className="relative">
      {/* 按钮主体 */}
      <button
        type="button"
        onClick={handleConnect}
        disabled={disabled || isLoading || !authUrl}
        aria-busy={isLoading}
        aria-label={isLoading ? '跳转 HubSpot 授权中...' : '关联 HubSpot 账户'}
        className={combinedClasses}
      >
        {isLoading ? (
          <Loader2 size={16} className="animate-spin" />
        ) : (
          <ExternalLink size={16} />
        )}
        <span>{isLoading ? '跳转中...' : '关联 HubSpot 账户'}</span>
      </button>

      {/* 临时错误提示（悬浮显示，不占用布局空间） */}
      {tempError && (
        <div className="absolute left-1/2 bottom-full mb-1 -translate-x-1/2 px-2 py-1 bg-red-50 text-red-600 text-xs rounded flex items-center gap-1 whitespace-nowrap z-10">
          <AlertCircle size={12} />
          <span>{tempError}</span>
        </div>
      )}
    </div>
  );
}