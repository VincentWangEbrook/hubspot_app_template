'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch } from '@/lib/apiFetch';
import { Loader2, AlertCircle, CheckCircle2, ArrowLeft, Mail } from 'lucide-react';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [emailFocused, setEmailFocused] = useState(false);

  const router = useRouter();

  // 邮箱验证
  const validateEmail = (email: string) => {
    const re = /^[a-zA-Z0-9._%+-\u4e00-\u9fa5]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    return re.test(email);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!email.trim()) {
      setError('请输入邮箱地址');
      return;
    }

    if (!validateEmail(email)) {
      setError('请输入有效的邮箱地址');
      return;
    }

    setIsLoading(true);

    try {
      const response = await apiFetch('/auth/forgot-password', {
        method: 'POST',
        data: { email: email.trim().toLowerCase() },
      });

      if (response.success) {
        setSuccess(true);
      } else {
        setError(response.message || '请求失败，请稍后再试');
      }
    } catch (err: any) {
      setError(err.message || '网络异常，请稍后再试');
    } finally {
      setIsLoading(false);
    }
  };

  // 成功状态页面
  if (success) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center p-4 sm:p-6">
        {/* 背景装饰 */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-20 left-1/4 w-72 h-72 bg-blue-400 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob"></div>
          <div className="absolute bottom-20 right-1/4 w-80 h-80 bg-indigo-400 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-2000"></div>
        </div>

        <div className="w-full max-w-md bg-white dark:bg-gray-800 rounded-2xl shadow-xl overflow-hidden relative z-10 border border-gray-100 dark:border-gray-700">
          <div className="p-8 text-center">
            {/* 成功图标 */}
            <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg">
              <CheckCircle2 size={40} className="text-white" />
            </div>

            <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-3">
              邮件已发送
            </h1>
            
            <p className="text-gray-600 dark:text-gray-400 mb-2">
              我们已向 <span className="font-medium text-blue-600 dark:text-blue-400">{email}</span> 发送了密码重置链接。
            </p>
            
            <p className="text-sm text-gray-500 dark:text-gray-500 mb-8">
              请检查您的收件箱（包括垃圾邮件文件夹），链接将在 30 分钟后失效。
            </p>

            <div className="space-y-3">
              <button
                onClick={() => router.push('/login')}
                className="w-full py-3 px-4 rounded-lg font-medium bg-blue-600 hover:bg-blue-700 text-white transition-all duration-200 shadow-md hover:shadow-lg"
              >
                返回登录
              </button>
              
              <button
                onClick={() => {
                  setSuccess(false);
                  setEmail('');
                }}
                className="w-full py-3 px-4 rounded-lg font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-all duration-200"
              >
                重新发送
              </button>
            </div>
          </div>
        </div>

        <style>{`
          @keyframes blob {
            0% { transform: translate(0px, 0px) scale(1); }
            33% { transform: translate(30px, -50px) scale(1.1); }
            66% { transform: translate(-20px, 20px) scale(0.9); }
            100% { transform: translate(0px, 0px) scale(1); }
          }
          .animate-blob { animation: blob 7s infinite; }
          .animation-delay-2000 { animation-delay: 2s; }
          .dark .animate-blob { opacity: 0.1; }
        `}</style>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center p-4 sm:p-6">
      {/* 背景装饰 */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 left-1/4 w-64 h-64 bg-blue-400 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob"></div>
        <div className="absolute top-40 right-1/4 w-72 h-72 bg-indigo-400 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-2000"></div>
        <div className="absolute bottom-20 left-1/3 w-60 h-60 bg-purple-400 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-4000"></div>
      </div>

      {/* 卡片 */}
      <div className="w-full max-w-md bg-white dark:bg-gray-800 rounded-2xl shadow-xl overflow-hidden transition-all duration-300 hover:shadow-2xl relative z-10 border border-gray-100 dark:border-gray-700">
        {/* 顶部区域 */}
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 py-8 px-6 flex flex-col items-center">
          <div className="w-16 h-16 rounded-full bg-white flex items-center justify-center mb-4 shadow-lg">
            <Mail size={32} className="text-blue-600" />
          </div>
          <h1 className="text-white text-xl font-bold mb-1">忘记密码</h1>
          <p className="text-blue-100 text-sm text-center">输入您的注册邮箱，我们将发送重置链接</p>
        </div>

        {/* 表单区域 */}
        <div className="p-6 sm:p-8">
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* 邮箱输入 */}
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
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (error) setError(null);
                  }}
                  onFocus={() => setEmailFocused(true)}
                  onBlur={() => setEmailFocused(false)}
                  className={`w-full px-4 py-3 rounded-lg border transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                    emailFocused 
                      ? 'border-blue-500 dark:border-blue-400' 
                      : 'border-gray-300 dark:border-gray-600'
                  } ${
                    error 
                      ? 'border-red-500 dark:border-red-400 bg-red-50 dark:bg-red-900/20' 
                      : 'bg-white dark:bg-gray-700'
                  } text-gray-900 dark:text-white placeholder-gray-400`}
                  placeholder="请输入您的注册邮箱"
                  disabled={isLoading}
                  autoComplete="email"
                  autoFocus
                />
              </div>
            </div>

            {/* 错误提示 */}
            {error && (
              <div className="flex items-start space-x-2 bg-red-50 dark:bg-red-900/20 p-3 rounded-lg animate-fadeIn">
                <AlertCircle size={18} className="text-red-500 dark:text-red-400 mt-0.5 shrink-0" />
                <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
              </div>
            )}

            {/* 提交按钮 */}
            <button
              type="submit"
              disabled={isLoading}
              className={`w-full py-3 px-4 rounded-lg font-medium transition-all duration-200 transform hover:translate-y-[-2px] active:translate-y-0 flex items-center justify-center gap-2 shadow-sm ${
                isLoading 
                  ? 'bg-blue-300 dark:bg-blue-700 text-white cursor-not-allowed' 
                  : 'bg-blue-600 hover:bg-blue-700 text-white hover:shadow-md'
              }`}
            >
              {isLoading ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  发送中...
                </>
              ) : (
                '发送重置链接'
              )}
            </button>

            {/* 返回登录 */}
            <button
              type="button"
              onClick={() => router.push('/login')}
              className="w-full flex items-center justify-center gap-2 py-3 px-4 text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
            >
              <ArrowLeft size={16} />
              返回登录
            </button>
          </form>
        </div>
      </div>

      {/* 动画样式 */}
      <style>{`
        @keyframes blob {
          0% { transform: translate(0px, 0px) scale(1); }
          33% { transform: translate(30px, -50px) scale(1.1); }
          66% { transform: translate(-20px, 20px) scale(0.9); }
          100% { transform: translate(0px, 0px) scale(1); }
        }
        .animate-blob { animation: blob 7s infinite; }
        .animation-delay-2000 { animation-delay: 2s; }
        .animation-delay-4000 { animation-delay: 4s; }
        .animate-fadeIn {
          animation: fadeIn 0.3s ease-in-out;
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .dark .animate-blob { opacity: 0.1; }
      `}</style>
    </div>
  );
}
