'use client';
import { useState } from 'react';
import { apiFetch } from '../../lib/api';
import { useRouter } from 'next/navigation';
import { Eye, EyeOff, Loader2 } from 'lucide-react'; // 需安装lucide-react: pnpm add lucide-react

// 注册成功后后端返回的格式
interface RegisterResponseData {
  token: string;
  user?: {
    id: string;
    email: string;
    username: string;
  };
}

// 表单验证规则
const validateForm = (username: string, email: string, password: string) => {
  const errors: Record<string, string> = {};
  if (!username.trim()) errors.username = '用户名不能为空';
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
  const router = useRouter();

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    // 清除对应字段的错误提示
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

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
      const res = await apiFetch<RegisterResponseData>('user/register', {
        data: formData,
      });

      if (res.success && res.data?.token) {
        localStorage.setItem('jwt', res.data.token);
        router.push('/');
        router.refresh(); // 刷新页面状态
      } else {
        setServerError(res.message || '注册失败，请稍后再试');
      }
    } catch (err) {
      setServerError(err.message || '注册失败，请稍后再试');
    } finally {
      setIsLoading(false);
    }
  };

  // 处理回车提交
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleRegister();
  };

  return (
    <div className="flex items-center justify-center min-h-screen from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 p-4">
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
                className={`w-full px-4 py-2.5 rounded-lg border transition-all duration-200 
                  ${errors.username 
                    ? 'border-red-500 focus:ring-red-500 focus:border-red-500' 
                    : 'border-gray-300 dark:border-gray-600 focus:ring-blue-500 focus:border-blue-500'
                  } 
                  bg-white dark:bg-gray-700 dark:text-white`}
                placeholder="请输入用户名"
              />
              {errors.username && (
                <p className="mt-1 text-sm text-red-500 flex items-center gap-1">
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
                className={`w-full px-4 py-2.5 rounded-lg border transition-all duration-200 
                  ${errors.email 
                    ? 'border-red-500 focus:ring-red-500 focus:border-red-500' 
                    : 'border-gray-300 dark:border-gray-600 focus:ring-blue-500 focus:border-blue-500'
                  } 
                  bg-white dark:bg-gray-700 dark:text-white`}
                placeholder="your@email.com"
              />
              {errors.email && (
                <p className="mt-1 text-sm text-red-500 flex items-center gap-1">
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
                  className={`w-full px-4 py-2.5 pr-10 rounded-lg border transition-all duration-200 
                    ${errors.password 
                      ? 'border-red-500 focus:ring-red-500 focus:border-red-500' 
                      : 'border-gray-300 dark:border-gray-600 focus:ring-blue-500 focus:border-blue-500'
                    } 
                    bg-white dark:bg-gray-700 dark:text-white`}
                  placeholder="至少6位字符"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              {errors.password && (
                <p className="mt-1 text-sm text-red-500 flex items-center gap-1">
                  <span>⚠️ {errors.password}</span>
                </p>
              )}
            </div>

            {/* 服务器错误提示 */}
            {serverError && (
              <p className="text-red-500 text-sm text-center p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
                {serverError}
              </p>
            )}

            {/* 注册按钮 */}
            <button
              type="button"
              onClick={handleRegister}
              disabled={isLoading}
              className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-all duration-200 
                flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed disabled:hover:bg-blue-600"
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
                className="font-medium text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 transition-colors"
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