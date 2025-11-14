'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useUser } from '@/context/UserContext';
import { Loader2, CheckCircle2, AlertCircle } from 'lucide-react';

interface FormDataType {
  username: string;
  email: string;
}

export default function ProfilePage() {
  const router = useRouter();
  const { user, updateProfile } = useUser();
  const [formData, setFormData] = useState<FormDataType>({
    username: '',
    email: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showOverlay, setShowOverlay] = useState(false);
  const [notification, setNotification] = useState<{
    type: 'success' | 'error' | null;
    text: string;
  }>({ type: null, text: '' });

  // 存储初始用户名（用于判断是否修改）
  const initialUsernameRef = useRef<string>('');
  // 按钮是否可提交（依赖「内容修改」和「格式合法」）
  const [isSubmitEnabled, setIsSubmitEnabled] = useState(false);

  const overlayShowTimeRef = useRef<number | null>(null);

  const initUserInfo = useCallback(() => {
    if (!user?.id) return;
    const username = user.username || '';
    setFormData({
      username,
      email: user.email || '',
    });
    initialUsernameRef.current = username; // 记录初始用户名
  }, [user?.id]);

  useEffect(() => {
    initUserInfo();
  }, [initUserInfo]);

  // 监听用户名变化，判断是否可提交
  useEffect(() => {
    const currentUsername = formData.username.trim();
    const isModified = currentUsername !== initialUsernameRef.current; // 是否修改过
    const isFormatValid = currentUsername.length >= 3 && currentUsername.length <= 20; // 格式是否合法

    // 只有「修改过」且「格式合法」，才启用按钮
    setIsSubmitEnabled(isModified && isFormatValid);
  }, [formData.username]);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (notification.type) {
      setNotification({ type: null, text: '' });
    }
  }, [notification.type]);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting || !isSubmitEnabled) return; // 防止重复提交 + 禁用时无法提交

    setIsSubmitting(true);
    setShowOverlay(true);
    overlayShowTimeRef.current = Date.now();
    setNotification({ type: null, text: '' });

    try {
      const isSuccess = await updateProfile({ username: formData.username.trim() });
      if (isSuccess) {
        setNotification({ type: 'success', text: '修改成功！' });
        // 修改成功后，更新初始用户名（避免再次提交时误判）
        initialUsernameRef.current = formData.username.trim();
        setTimeout(() => {
          router.refresh();
        }, 1500);
      } else {
        setNotification({ type: 'error', text: '修改失败，请重试' });
      }
    } catch (error) {
      console.error('修改失败：', error);
      setNotification({ type: 'error', text: '网络异常，修改失败' });
    } finally {
      const showDuration = Date.now() - (overlayShowTimeRef.current || Date.now());
      const minShowTime = 1000;
      const delay = Math.max(0, minShowTime - showDuration);

      setTimeout(() => {
        setIsSubmitting(false);
        setShowOverlay(false);
      }, delay);
    }
  }, [formData.username, isSubmitting, isSubmitEnabled, updateProfile, router]);

  return (
    <div className="max-w-4xl mx-auto space-y-8 py-8 relative">
      {showOverlay && (
        <div className="absolute inset-0 bg-black/10 backdrop-blur-sm z-50 flex items-center justify-center">
          <div className="flex flex-col items-center gap-4 p-8 bg-white rounded-lg shadow-xl border border-gray-200">
            <Loader2 size={36} className="animate-spin text-blue-600" />
            <div className="text-lg font-medium text-gray-800">正在保存修改...</div>
            <div className="text-sm text-gray-500">请稍候，操作即将完成</div>
          </div>
        </div>
      )}
      
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h1 className="text-xl font-bold text-gray-900">个人信息设置</h1>
          <p className="text-sm text-gray-500 mt-1">修改基础信息，未来可扩展更多字段</p>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          <div className="space-y-2">
            <label htmlFor="username" className="block text-sm font-medium text-gray-700">
              用户名 <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              id="username"
              name="username"
              value={formData.username}
              onChange={handleInputChange}
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-colors"
              placeholder="请输入用户名（3-20 个字符）"
              disabled={isSubmitting}
              aria-disabled={isSubmitting}
            />
            {/* 格式提示（动态显示，增强用户引导） */}
            <p className={`text-xs ${formData.username.trim() && (formData.username.length < 3 || formData.username.length > 20) ? 'text-red-500' : 'text-gray-500'}`}>
              {formData.username.trim() && (formData.username.length < 3 || formData.username.length > 20) 
                ? '用户名需为 3-20 个字符，请调整' 
                : '用户名仅用于登录和显示，修改后立即生效'}
            </p>
          </div>

          <div className="space-y-2 opacity-70">
            <label htmlFor="email" className="block text-sm font-medium text-gray-700">
              邮箱（仅展示）
            </label>
            <input
              type="email"
              id="email"
              name="email"
              value={formData.email}
              className="w-full px-4 py-2 border border-gray-300 rounded-md bg-gray-50 cursor-not-allowed"
              placeholder="暂无绑定邮箱"
              disabled
              readOnly
            />
          </div>

          <div className="space-y-2 opacity-50">
            <label htmlFor="nickname" className="block text-sm font-medium text-gray-700">
              昵称（即将开放）
            </label>
            <input
              type="text"
              id="nickname"
              name="nickname"
              className="w-full px-4 py-2 border border-gray-300 rounded-md bg-gray-50 cursor-not-allowed"
              placeholder="请输入昵称"
              disabled
              readOnly
            />
          </div>

          <div className="space-y-2 opacity-50">
            <label htmlFor="phone" className="block text-sm font-medium text-gray-700">
              手机号（即将开放）
            </label>
            <input
              type="tel"
              id="phone"
              name="phone"
              className="w-full px-4 py-2 border border-gray-300 rounded-md bg-gray-50 cursor-not-allowed"
              placeholder="请输入手机号"
              disabled
              readOnly
            />
          </div>

          <div className="space-y-3 pt-4 border-t border-gray-100">
            <div className="h-12 flex items-center">
              {notification.type && (
                <div
                  className={`flex items-center gap-2 px-4 py-3 rounded-md w-full ${
                    notification.type === 'success'
                      ? 'bg-green-50 text-green-700 border border-green-200'
                      : 'bg-red-50 text-red-700 border border-red-200'
                  }`}
                >
                  {notification.type === 'success' ? (
                    <CheckCircle2 size={18} className="text-green-500 shrink-0" />
                  ) : (
                    <AlertCircle size={18} className="text-red-500 shrink-0" />
                  )}
                  <span className="shrink-0">{notification.text}</span>
                </div>
              )}
            </div>

            {/* 按钮状态依赖 isSubmitEnabled 和 isSubmitting */}
            <button
              type="submit"
              disabled={isSubmitting || !isSubmitEnabled}
              className={`w-full py-2.5 px-4 rounded-md focus:ring-2 focus:ring-offset-2 transition-colors ${
                isSubmitting 
                  ? 'bg-blue-300 text-white cursor-not-allowed' // 提交中状态
                  : isSubmitEnabled 
                    ? 'bg-blue-600 text-white hover:bg-blue-700 focus:ring-blue-500' // 可提交状态
                    : 'bg-gray-300 text-gray-500 cursor-not-allowed' // 禁用状态（默认）
              }`}
            >
              {isSubmitting ? (
                <div className="flex items-center justify-center gap-2">
                  <Loader2 size={18} className="animate-spin" />
                  <span>提交中...</span>
                </div>
              ) : (
                '保存修改'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}