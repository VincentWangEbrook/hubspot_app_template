'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { apiFetch } from '@/lib/apiFetch';
import { Loader2, AlertCircle, CheckCircle2, Eye, EyeOff, Lock, ShieldCheck, XCircle } from 'lucide-react';

function ResetPasswordContent() {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isVerifying, setIsVerifying] = useState(true);
  const [tokenValid, setTokenValid] = useState<boolean | null>(null);
  const [tokenError, setTokenError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);
  const [confirmFocused, setConfirmFocused] = useState(false);

  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token');

  // 验证 token 有效性
  useEffect(() => {
    const verifyToken = async () => {
      if (!token) {
        setTokenValid(false);
        setTokenError('缺少重置令牌，请从邮件中点击链接访问');
        setIsVerifying(false);
        return;
      }

      try {
        const response = await apiFetch(`/auth/verify-reset-token?token=${token}`);
        
        if (response.success) {
          setTokenValid(true);
        } else {
          setTokenValid(false);
          setTokenError(response.message || '重置链接无效或已过期');
        }
      } catch (err) {
        setTokenValid(false);
        setTokenError('验证失败，请稍后再试');
      } finally {
        setIsVerifying(false);
      }
    };

    verifyToken();
  }, [token]);

  // 密码强度检查
  const getPasswordStrength = (pwd: string): { level: number; text: string; color: string } => {
    if (!pwd) return { level: 0, text: '', color: '' };
    
    let score = 0;
    if (pwd.length >= 6) score++;
    if (pwd.length >= 8) score++;
    if (/[A-Z]/.test(pwd)) score++;
    if (/[a-z]/.test(pwd)) score++;
    if (/\d/.test(pwd)) score++;
    if (/[!@#$%^&*(),.?":{}|<>]/.test(pwd)) score++;

    if (score <= 2) return { level: 1, text: '弱', color: 'bg-red-500' };
    if (score <= 4) return { level: 2, text: '中等', color: 'bg-yellow-500' };
    return { level: 3, text: '强', color: 'bg-green-500' };
  };

  const passwordStrength = getPasswordStrength(password);

  // 验证密码格式
  const validatePassword = (pwd: string) => {
    const re = /^(?=.*[a-zA-Z])(?=.*\d).{6,}$/;
    return re.test(pwd);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!password) {
      setError('请输入新密码');
      return;
    }

    if (!validatePassword(password)) {
      setError('密码至少6位，需同时包含字母和数字');
      return;
    }

    if (password !== confirmPassword) {
      setError('两次输入的密码不一致');
      return;
    }

    setIsLoading(true);

    try {
      const response = await apiFetch('/auth/reset-password', {
        method: 'POST',
        data: { token, password },
      });

      if (response.success) {
        setSuccess(true);
      } else {
        setError(response.message || '重置失败，请稍后再试');
      }
    } catch (err: any) {
      setError(err.message || '网络异常，请稍后再试');
    } finally {
      setIsLoading(false);
    }
  };

  // 加载中状态
  if (isVerifying) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8 text-center">
          <Loader2 size={48} className="mx-auto mb-4 text-blue-600 animate-spin" />
          <p className="text-gray-600 dark:text-gray-400">正在验证重置链接...</p>
        </div>
      </div>
    );
  }

  // Token 无效状态
  if (!tokenValid) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center p-4">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-20 left-1/4 w-72 h-72 bg-blue-400 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob"></div>
          <div className="absolute bottom-20 right-1/4 w-80 h-80 bg-indigo-400 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-2000"></div>
        </div>

        <div className="w-full max-w-md bg-white dark:bg-gray-800 rounded-2xl shadow-xl overflow-hidden relative z-10 border border-gray-100 dark:border-gray-700">
          <div className="p-8 text-center">
            <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
              <XCircle size={40} className="text-red-500" />
            </div>

            <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-3">
              链接已失效
            </h1>
            
            <p className="text-gray-600 dark:text-gray-400 mb-8">
              {tokenError}
            </p>

            <div className="space-y-3">
              <button
                onClick={() => router.push('/forgot-password')}
                className="w-full py-3 px-4 rounded-lg font-medium bg-blue-600 hover:bg-blue-700 text-white transition-all duration-200 shadow-md hover:shadow-lg"
              >
                重新申请重置
              </button>
              
              <button
                onClick={() => router.push('/login')}
                className="w-full py-3 px-4 rounded-lg font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-all duration-200"
              >
                返回登录
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

  // 成功状态
  if (success) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center p-4">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-20 left-1/4 w-72 h-72 bg-blue-400 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob"></div>
          <div className="absolute bottom-20 right-1/4 w-80 h-80 bg-indigo-400 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-2000"></div>
        </div>

        <div className="w-full max-w-md bg-white dark:bg-gray-800 rounded-2xl shadow-xl overflow-hidden relative z-10 border border-gray-100 dark:border-gray-700">
          <div className="p-8 text-center">
            <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg">
              <ShieldCheck size={40} className="text-white" />
            </div>

            <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-3">
              密码重置成功
            </h1>
            
            <p className="text-gray-600 dark:text-gray-400 mb-8">
              您的密码已成功重置，请使用新密码登录。
            </p>

            <button
              onClick={() => router.push('/login')}
              className="w-full py-3 px-4 rounded-lg font-medium bg-blue-600 hover:bg-blue-700 text-white transition-all duration-200 shadow-md hover:shadow-lg"
            >
              前往登录
            </button>
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

  // 重置密码表单
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
            <Lock size={32} className="text-blue-600" />
          </div>
          <h1 className="text-white text-xl font-bold mb-1">重置密码</h1>
          <p className="text-blue-100 text-sm text-center">请设置您的新密码</p>
        </div>

        {/* 表单区域 */}
        <div className="p-6 sm:p-8">
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* 新密码 */}
            <div className="space-y-2">
              <label 
                htmlFor="password" 
                className="block text-sm font-medium text-gray-700 dark:text-gray-300"
              >
                新密码
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (error) setError(null);
                  }}
                  onFocus={() => setPasswordFocused(true)}
                  onBlur={() => setPasswordFocused(false)}
                  className={`w-full px-4 py-3 rounded-lg border transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                    passwordFocused 
                      ? 'border-blue-500 dark:border-blue-400' 
                      : 'border-gray-300 dark:border-gray-600'
                  } bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400`}
                  placeholder="请输入新密码（至少6位）"
                  disabled={isLoading}
                  autoComplete="new-password"
                  autoFocus
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                  disabled={isLoading}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              
              {/* 密码强度指示器 */}
              {password && (
                <div className="space-y-1">
                  <div className="flex gap-1">
                    {[1, 2, 3].map((level) => (
                      <div
                        key={level}
                        className={`h-1 flex-1 rounded-full transition-all duration-300 ${
                          passwordStrength.level >= level
                            ? passwordStrength.color
                            : 'bg-gray-200 dark:bg-gray-600'
                        }`}
                      />
                    ))}
                  </div>
                  <p className={`text-xs ${
                    passwordStrength.level === 1 ? 'text-red-500' :
                    passwordStrength.level === 2 ? 'text-yellow-600' :
                    'text-green-500'
                  }`}>
                    密码强度：{passwordStrength.text}
                  </p>
                </div>
              )}
            </div>

            {/* 确认密码 */}
            <div className="space-y-2">
              <label 
                htmlFor="confirmPassword" 
                className="block text-sm font-medium text-gray-700 dark:text-gray-300"
              >
                确认密码
              </label>
              <div className="relative">
                <input
                  id="confirmPassword"
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => {
                    setConfirmPassword(e.target.value);
                    if (error) setError(null);
                  }}
                  onFocus={() => setConfirmFocused(true)}
                  onBlur={() => setConfirmFocused(false)}
                  className={`w-full px-4 py-3 rounded-lg border transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                    confirmFocused 
                      ? 'border-blue-500 dark:border-blue-400' 
                      : 'border-gray-300 dark:border-gray-600'
                  } ${
                    confirmPassword && password !== confirmPassword
                      ? 'border-red-500 dark:border-red-400'
                      : ''
                  } bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400`}
                  placeholder="请再次输入新密码"
                  disabled={isLoading}
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                  disabled={isLoading}
                >
                  {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              
              {/* 密码匹配提示 */}
              {confirmPassword && (
                <div className="flex items-center gap-1.5">
                  {password === confirmPassword ? (
                    <>
                      <CheckCircle2 size={14} className="text-green-500" />
                      <span className="text-xs text-green-500">密码匹配</span>
                    </>
                  ) : (
                    <>
                      <XCircle size={14} className="text-red-500" />
                      <span className="text-xs text-red-500">密码不匹配</span>
                    </>
                  )}
                </div>
              )}
            </div>

            {/* 密码要求提示 */}
            <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3">
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">密码要求：</p>
              <ul className="text-xs text-gray-500 dark:text-gray-400 space-y-1">
                <li className={`flex items-center gap-1.5 ${password.length >= 6 ? 'text-green-500' : ''}`}>
                  {password.length >= 6 ? <CheckCircle2 size={12} /> : <span className="w-3 h-3 rounded-full border border-gray-300 dark:border-gray-500" />}
                  至少 6 个字符
                </li>
                <li className={`flex items-center gap-1.5 ${/[a-zA-Z]/.test(password) ? 'text-green-500' : ''}`}>
                  {/[a-zA-Z]/.test(password) ? <CheckCircle2 size={12} /> : <span className="w-3 h-3 rounded-full border border-gray-300 dark:border-gray-500" />}
                  包含字母
                </li>
                <li className={`flex items-center gap-1.5 ${/\d/.test(password) ? 'text-green-500' : ''}`}>
                  {/\d/.test(password) ? <CheckCircle2 size={12} /> : <span className="w-3 h-3 rounded-full border border-gray-300 dark:border-gray-500" />}
                  包含数字
                </li>
              </ul>
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
              disabled={isLoading || !validatePassword(password) || password !== confirmPassword}
              className={`w-full py-3 px-4 rounded-lg font-medium transition-all duration-200 transform hover:translate-y-[-2px] active:translate-y-0 flex items-center justify-center gap-2 shadow-sm ${
                isLoading || !validatePassword(password) || password !== confirmPassword
                  ? 'bg-gray-300 dark:bg-gray-600 text-gray-500 cursor-not-allowed' 
                  : 'bg-blue-600 hover:bg-blue-700 text-white hover:shadow-md'
              }`}
            >
              {isLoading ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  重置中...
                </>
              ) : (
                '重置密码'
              )}
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

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8 text-center">
          <Loader2 size={48} className="mx-auto mb-4 text-blue-600 animate-spin" />
          <p className="text-gray-600 dark:text-gray-400">加载中...</p>
        </div>
      </div>
    }>
      <ResetPasswordContent />
    </Suspense>
  );
}
