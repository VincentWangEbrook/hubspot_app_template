'use client';
import { useState, useCallback } from 'react';
import { apiFetch } from '../../lib/apiFetch';
import { useRouter } from 'next/navigation';
import { Eye, EyeOff, Loader2, CheckCircle2 } from 'lucide-react';
import { UserInfo } from '@/types';

// 表单验证规则
const validateForm = (username: string, email: string, password: string) => {
  const errors: Record<string, string> = {};
  if (!username.trim()) errors.username = '用户名不能为空';
  if (username.trim().length < 3 || username.trim().length > 20) {
    errors.username = '用户名需为 3-20 个字符';
  }
  if (!email.trim()) {
    errors.email = '邮箱不能为空';
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    errors.email = '请输入有效的邮箱地址';
  }
  if (!password) {
    errors.password = '密码不能为空';
  } else if (password.length < 6) {
    errors.password = '密码长度不能少于6位';
  }
  return errors;
};

export default function RegisterPage() {
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [serverError, setServerError] = useState('');
  // 注册成功状态（控制遮罩层提示）
  const [isRegisterSuccess, setIsRegisterSuccess] = useState(false);
  const router = useRouter();

  // 用 useCallback 缓存输入处理函数，减少重创建
  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    // 清除对应字段的错误提示
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
    // 清除服务器错误和成功状态
    if (serverError) setServerError('');
    if (isRegisterSuccess) setIsRegisterSuccess(false);
  }, [errors, serverError, isRegisterSuccess]);

  const handleRegister = async () => {
    // 表单验证
    const formErrors = validateForm(formData.username, formData.email, formData.password);
    if (Object.keys(formErrors).length > 0) {
      setErrors(formErrors);
      return;
    }

    try {
      setIsLoading(true);
      setServerError('');
      const res = await apiFetch<{ user: UserInfo; success: boolean; message?: string }>('/auth/register', {
        data: formData,
      });

      if (res.success && res.data?.user) {
        // 注册成功：显示成功遮罩层，不跳转
        setIsRegisterSuccess(true);
        // 清空表单（根据需求决定是否保留）
        setTimeout(() => {
          setFormData({ username: '', email: '', password: '' });
        }, 1500);
      } else {
        setServerError(res.message || '注册失败，请稍后再试');
      }
    } catch (err) {
      setServerError((err as Error).message || '网络异常，注册失败');
    } finally {
      // 延迟关闭加载状态（避免遮罩层一闪而过）
      setTimeout(() => {
        setIsLoading(false);
      }, 800);
    }
  };

  // 关闭成功遮罩层（手动或自动）
  const closeSuccessOverlay = () => {
    setIsRegisterSuccess(false);
  };

  // 处理回车提交
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !isLoading && !isRegisterSuccess) {
      handleRegister();
    }
  }, [isLoading, isRegisterSuccess, handleRegister]);

  return (
    <div className="flex items-center justify-center min-h-screen from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 p-4 relative">
      {/* 加载遮罩层（注册中） */}
      {isLoading && (
        <div className="absolute inset-0 bg-black/10 backdrop-blur-sm z-50 flex items-center justify-center">
          <div className="flex flex-col items-center gap-4 p-8 bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700">
            <Loader2 size={36} className="animate-spin text-blue-600 dark:text-blue-400" />
            <div className="text-lg font-medium text-gray-800 dark:text-white">正在注册账号...</div>
            <div className="text-sm text-gray-500 dark:text-gray-400">请稍候，操作即将完成</div>
          </div>
        </div>
      )}

      {/* 注册成功遮罩层（成功后显示） */}
      {isRegisterSuccess && (
        <div className="absolute inset-0 bg-black/20 backdrop-blur-sm z-50 flex items-center justify-center">
          <div className="flex flex-col items-center gap-4 p-8 bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 max-w-sm w-full mx-4">
            <div className="w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
              <CheckCircle2 size={32} className="text-green-600 dark:text-green-400" />
            </div>
            <div className="text-xl font-bold text-gray-800 dark:text-white text-center">注册成功！</div>
            <p className="text-sm text-gray-500 dark:text-gray-400 text-center">
              您的账号已创建完成，可前往登录页登录
            </p>
            <button
              onClick={closeSuccessOverlay}
              className="mt-4 w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-600 text-white font-medium rounded-lg transition-colors"
            >
              关闭
            </button>
            {/* 添加登录跳转按钮 */}
            <button
              onClick={() => {
                closeSuccessOverlay();
                router.push('/login');
              }}
              className="mt-2 w-full py-2.5 px-4 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-800 dark:text-white font-medium rounded-lg transition-colors"
            >
              前往登录
            </button>
          </div>
        </div>
      )}

      {/* 注册卡片 */}
      <div className="w-full max-w-md bg-white dark:bg-gray-800 rounded-2xl shadow-lg overflow-hidden transition-all duration-300 hover:shadow-xl">
        {/* 卡片头部 */}
        <div className="p-6 sm:p-8 border-b border-gray-100 dark:border-gray-700">
          <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white text-center">
            创建账号
          </h2>
          <p className="mt-2 text-center text-gray-500 dark:text-gray-400 text-sm">
            填写信息完成注册，开启使用之旅
          </p>
        </div>

        {/* 表单区域 */}
        <div className="p-6 sm:p-8">
          <form className="space-y-5" onKeyDown={handleKeyDown}>
            {/* 用户名输入 */}
            <div>
              <label
                htmlFor="username"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
              >
                用户名
              </label>
              <input
                id="username"
                name="username"
                type="text"
                value={formData.username}
                onChange={handleChange}
                disabled={isLoading || isRegisterSuccess}
                aria-disabled={isLoading || isRegisterSuccess}
                className={`w-full px-4 py-2.5 rounded-lg border transition-all duration-200 
                  ${errors.username
                    ? 'border-red-500 focus:ring-red-500 focus:border-red-500 dark:border-red-400 dark:focus:ring-red-400'
                    : 'border-gray-300 dark:border-gray-600 focus:ring-blue-500 focus:border-blue-500 dark:focus:ring-blue-400 dark:focus:border-blue-400'
                  } 
                  bg-white dark:bg-gray-700 dark:text-white ${(isLoading || isRegisterSuccess) ? 'opacity-70 cursor-not-allowed' : ''}`}
                placeholder="请输入用户名（3-20 个字符）"
              />
              {errors.username && (
                <p className="mt-1 text-sm text-red-500 dark:text-red-400 flex items-center gap-1">
                  <span>⚠️ {errors.username}</span>
                </p>
              )}
            </div>

            {/* 邮箱输入 */}
            <div>
              <label
                htmlFor="email"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
              >
                邮箱
              </label>
              <input
                id="email"
                name="email"
                type="email"
                value={formData.email}
                onChange={handleChange}
                disabled={isLoading || isRegisterSuccess}
                aria-disabled={isLoading || isRegisterSuccess}
                className={`w-full px-4 py-2.5 rounded-lg border transition-all duration-200 
                  ${errors.email
                    ? 'border-red-500 focus:ring-red-500 focus:border-red-500 dark:border-red-400 dark:focus:ring-red-400'
                    : 'border-gray-300 dark:border-gray-600 focus:ring-blue-500 focus:border-blue-500 dark:focus:ring-blue-400 dark:focus:border-blue-400'
                  } 
                  bg-white dark:bg-gray-700 dark:text-white ${(isLoading || isRegisterSuccess) ? 'opacity-70 cursor-not-allowed' : ''}`}
                placeholder="your@email.com"
              />
              {errors.email && (
                <p className="mt-1 text-sm text-red-500 dark:text-red-400 flex items-center gap-1">
                  <span>⚠️ {errors.email}</span>
                </p>
              )}
            </div>

            {/* 密码输入（带显示/隐藏功能） */}
            <div>
              <label
                htmlFor="password"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
              >
                密码
              </label>
              <div className="relative">
                <input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  value={formData.password}
                  onChange={handleChange}
                  disabled={isLoading || isRegisterSuccess}
                  aria-disabled={isLoading || isRegisterSuccess}
                  className={`w-full px-4 py-2.5 pr-10 rounded-lg border transition-all duration-200 
                    ${errors.password
                      ? 'border-red-500 focus:ring-red-500 focus:border-red-500 dark:border-red-400 dark:focus:ring-red-400'
                      : 'border-gray-300 dark:border-gray-600 focus:ring-blue-500 focus:border-blue-500 dark:focus:ring-blue-400 dark:focus:border-blue-400'
                    } 
                    bg-white dark:bg-gray-700 dark:text-white ${(isLoading || isRegisterSuccess) ? 'opacity-70 cursor-not-allowed' : ''}`}
                  placeholder="至少6位字符"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  disabled={isLoading || isRegisterSuccess}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors disabled:opacity-50"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              {errors.password && (
                <p className="mt-1 text-sm text-red-500 dark:text-red-400 flex items-center gap-1">
                  <span>⚠️ {errors.password}</span>
                </p>
              )}
            </div>

            {/* 服务器错误提示 */}
            {serverError && (
              <p className="text-red-500 dark:text-red-400 text-sm text-center p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
                {serverError}
              </p>
            )}

            {/* 注册按钮 */}
            <button
              type="button"
              onClick={handleRegister}
              disabled={isLoading || isRegisterSuccess}
              className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-600 text-white font-medium rounded-lg transition-all duration-200 
                flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed disabled:hover:bg-blue-600 dark:disabled:hover:bg-blue-700"
            >
              {isLoading ? (
                <>
                  <Loader2 className="animate-spin h-4 w-4" />
                  注册中...
                </>
              ) : (
                '完成注册'
              )}
            </button>

            {/* 已有账号？登录入口 */}
            <div className="text-center text-sm text-gray-600 dark:text-gray-400 pt-2">
              已有账号？{' '}
              <button
                type="button"
                onClick={() => router.push('/login')}
                disabled={isLoading || isRegisterSuccess}
                className="font-medium text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 transition-colors disabled:opacity-70"
              >
                立即登录
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}