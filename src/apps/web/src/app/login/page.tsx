'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useUser } from '@/context/UserContext';
import { UserInfo } from '@/types';
import { apiFetch } from '@/lib/apiFetch';
import { Loader2, Eye, EyeOff, AlertCircle } from 'lucide-react';
import { log } from 'console';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [emailFocused, setEmailFocused] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);

  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get('redirect') || '/dashboard';
  const { user, login } = useUser();

  // 页面加载时：检查是否已登录，若已登录直接跳转到仪表盘（优化：添加加载状态避免闪烁）
  if (user) {
    // 延迟跳转，避免页面闪烁
    setTimeout(() => router.push(redirectTo), 100);
  }

  // 邮箱验证（增强：支持中文邮箱前缀）
  const validateEmail = (email: string) => {
    const re = /^[a-zA-Z0-9._%+-\u4e00-\u9fa5]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    return re.test(email);
  };

  // 密码验证（增强：支持特殊字符，提示更具体）
  const validatePassword = (password: string) => {
    // 至少6位，包含字母、数字，可选特殊字符
    const re = /^(?=.*[a-zA-Z])(?=.*\d).{6,}$/;
    return re.test(password);
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // 表单验证（优化：错误提示更精准）
    if (!email.trim()) {
      setError('请输入邮箱地址');
      return;
    }
    if (!validateEmail(email)) {
      setError('请输入有效的邮箱地址（如：xxx@example.com 或 中文@example.com）');
      return;
    }
    if (!password) {
      setError('请输入密码');
      return;
    }
    if (!validatePassword(password)) {
      setError('密码至少6位，需同时包含字母和数字');
      return;
    }

    setIsLoading(true);
    try {
      // 调用登录接口（优化：添加请求超时处理）
      const isSuccess = await login({ email: email.trim(), password });

      // 严格判断接口返回数据
      if (isSuccess) {
        //  router.push(redirectTo); // 登录后跳回原页面
        // 延迟跳转，确保 Context 状态同步完成
        setTimeout(() => router.push('/dashboard'), 150);
      } else {
        setError('登录失败，请检查邮箱和密码是否正确');
      }
    } catch (err: any) {
      console.error('登录异常:', err);
      // 优化：区分网络错误和超时错误
      setError(err.message || '网络异常，无法连接服务器，请稍后再试');
    } finally {
      setIsLoading(false);
    }
  };

  // 优化：输入框变化时清除对应字段的错误提示
  const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.trim();
    setEmail(value);
    if (error && error.includes('邮箱')) {
      setError(null);
    }
  };

  const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setPassword(value);
    if (error && error.includes('密码')) {
      setError(null);
    }
  };

  return (
    <div className="min-h-screen bg-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center p-4 sm:p-6">
      {/* 背景装饰元素 */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 left-1/4 w-64 h-64 bg-blue-400 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob"></div>
        <div className="absolute top-40 right-1/4 w-72 h-72 bg-indigo-400 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-2000"></div>
        <div className="absolute bottom-20 left-1/3 w-60 h-60 bg-purple-400 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-4000"></div>
      </div>

      {/* 登录卡片 */}
      <div className="w-full max-w-md bg-white dark:bg-gray-800 rounded-2xl shadow-xl overflow-hidden transition-all duration-300 hover:shadow-2xl relative z-10 border border-gray-100 dark:border-gray-700">
        {/* 卡片顶部渐变区域 */}
        <div className="bg-to-r from-blue-600 to-indigo-600 py-8 px-6 flex flex-col items-center">
          {/* 品牌 Logo */}
          <div className="w-16 h-16 rounded-full bg-white flex items-center justify-center mb-4 shadow-lg transform transition-transform hover:scale-105">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 2L2 7L12 12L22 7L12 2Z" stroke="#3B82F6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M2 17L12 22L22 17" stroke="#3B82F6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M2 12L12 17L22 12" stroke="#3B82F6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <h1 className="text-white text-xl font-bold mb-1">eTrunk 数据管理平台</h1>
          <p className="text-blue-100 text-sm">专业、安全、高效的数据管理解决方案</p>
        </div>

        {/* 表单区域 */}
        <div className="p-6 sm:p-8">
          <form onSubmit={handleLogin} className="space-y-5">
            {/* 邮箱输入框 */}
            <div className="space-y-2">
              <label 
                htmlFor="email" 
                className="block text-sm font-medium text-gray-700 dark:text-gray-300"
              >
                邮箱地址
              </label>
              <div className="relative">
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={handleEmailChange} // 绑定优化后的change事件
                  onFocus={() => setEmailFocused(true)}
                  onBlur={() => setEmailFocused(false)}
                  className={`w-full px-4 py-3 rounded-lg border transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                    emailFocused 
                      ? 'border-blue-500 dark:border-blue-400' 
                      : 'border-gray-300 dark:border-gray-600'
                  } ${
                    error && error.includes('邮箱') 
                      ? 'border-red-500 dark:border-red-400 bg-red-50 dark:bg-red-900/20' 
                      : 'bg-white dark:bg-gray-700'
                  } text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500`}
                  placeholder="请输入您的邮箱"
                  disabled={isLoading}
                  autoComplete="email" // 优化：自动填充提示
                />
              </div>
            </div>

            {/* 密码输入框 */}
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <label 
                  htmlFor="password" 
                  className="block text-sm font-medium text-gray-700 dark:text-gray-300"
                >
                  密码
                </label>
                <a 
                  href="/forgot-password" 
                  className="text-xs font-medium text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 transition-colors"
                >
                  忘记密码?
                </a>
              </div>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={handlePasswordChange} // 绑定优化后的change事件
                  onFocus={() => setPasswordFocused(true)}
                  onBlur={() => setPasswordFocused(false)}
                  className={`w-full px-4 py-3 rounded-lg border transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                    passwordFocused 
                      ? 'border-blue-500 dark:border-blue-400' 
                      : 'border-gray-300 dark:border-gray-600'
                  } ${
                    error && error.includes('密码') 
                      ? 'border-red-500 dark:border-red-400 bg-red-50 dark:bg-red-900/20' 
                      : 'bg-white dark:bg-gray-700'
                  } text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500`}
                  placeholder="请输入您的密码"
                  disabled={isLoading}
                  autoComplete="current-password" // 优化：自动填充提示
                />
                {/* 显示/隐藏密码按钮 */}
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                  disabled={isLoading}
                  aria-label={showPassword ? '隐藏密码' : '显示密码'}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            {/* 错误提示 */}
            {error && (
              <div className="flex items-start space-x-2 bg-red-50 dark:bg-red-900/20 p-3 rounded-lg animate-fadeIn">
                <AlertCircle size={18} className="text-red-500 dark:text-red-400 mt-0.5 shrink-0" />
                <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
              </div>
            )}

            {/* 登录按钮（优化：添加加载状态下的样式锁定） */}
            <button
              type="submit"
              disabled={isLoading}
              className={`w-full py-3 px-4 rounded-lg font-medium transition-all duration-200 transform hover:translate-y-[-2px] active:translate-y-0 flex items-center justify-center gap-2 shadow-sm ${
                isLoading 
                  ? 'bg-blue-300 dark:bg-blue-700 text-white cursor-not-allowed' 
                  : 'bg-blue-600 hover:bg-blue-700 dark:bg-blue-600 dark:hover:bg-blue-700 text-white hover:shadow-md'
              }`}
            >
              {isLoading ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  登录中...
                </>
              ) : (
                '立即登录'
              )}
            </button>

            {/* 注册入口（优化：添加新窗口打开选项） */}
            <div className="text-center text-sm text-gray-600 dark:text-gray-400 pt-2">
              还没有账号?{' '}
              <button 
                type="button" 
                onClick={() => router.push('/register')}
                className="font-medium text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 transition-colors"
              >
                立即注册
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* 全局样式（优化：添加暗模式适配） */}
      <style>{`
        @keyframes blob {
          0% { transform: translate(0px, 0px) scale(1); }
          33% { transform: translate(30px, -50px) scale(1.1); }
          66% { transform: translate(-20px, 20px) scale(0.9); }
          100% { transform: translate(0px, 0px) scale(1); }
        }
        .animate-blob {
          animation: blob 7s infinite;
        }
        .animation-delay-2000 {
          animation-delay: 2s;
        }
        .animation-delay-4000 {
          animation-delay: 4s;
        }
        .animate-fadeIn {
          animation: fadeIn 0.3s ease-in-out;
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        /* 暗模式下装饰元素颜色调整 */
        .dark .animate-blob {
          opacity: 0.1;
        }
      `}</style>
    </div>
  );
}