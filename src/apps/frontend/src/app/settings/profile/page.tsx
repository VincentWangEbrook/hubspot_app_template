'use client';
import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useUser } from '@/src/context/UserContext';
import { Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { apiFetch } from '@/src/lib/api';

// 定义表单数据类型（增强类型安全）
interface FormDataType {
  username: string;
  nickname: string;
  phone: string;
  email: string;
}

export default function ProfilePage() {
  const router = useRouter();
  const { user, updateUser } = useUser();
  
  // 初始化表单数据（使用useState直接赋值，避免重复合并）
  const [formData, setFormData] = useState<FormDataType>({
    username: '',
    nickname: '',
    phone: '',
    email: '',
  });
  
  // 加载状态（合并为单个状态，减少状态更新次数）
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // 提示信息（使用固定高度容器，避免布局偏移）
  const [notification, setNotification] = useState<{
    type: 'success' | 'error' | null;
    text: string;
  }>({ type: null, text: '' });

  // 1. 初始化：加载用户信息（优化依赖项 + 避免重复执行）
  const initUserInfo = useCallback(() => {
    if (!user?.id) return;

    // 加载本地存储的用户信息（仅执行一次）
    const storedUser = localStorage.getItem('user');
    if (storedUser) {
      try {
        const parsedUser = JSON.parse(storedUser);
        // 直接赋值，避免不必要的对象合并
        setFormData({
          username: parsedUser.username || '',
          nickname: parsedUser.nickname || '',
          phone: parsedUser.phone || '',
          email: parsedUser.email || '',
        });
      } catch (error) {
        console.error('解析用户信息失败：', error);
        localStorage.removeItem('user'); // 清除无效数据
      }
    }
  }, [user?.id]); // 仅依赖 user.id，避免不必要的重执行

  // 初始化仅执行一次（空依赖项 + useCallback 缓存）
  useEffect(() => {
    initUserInfo();
  }, [initUserInfo]);

  // 2. 表单输入变更处理（缓存函数，避免重复创建）
  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    // 输入时清除提示信息（不触发布局抖动）
    if (notification.type) {
      setNotification({ type: null, text: '' });
    }
  }, [notification.type]);

  // 3. 表单提交（优化状态更新逻辑 + 稳定DOM）
  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return; // 防止重复提交

    // 前端验证
    if (!formData.username.trim() || formData.username.length < 3 || formData.username.length > 20) {
      setNotification({ type: 'error', text: '用户名需为 3-20 个字符' });
      return;
    }

    setIsSubmitting(true);
    // 保留提示信息容器（仅更新内容，不删除DOM）
    setNotification({ type: null, text: '' });

    try {
      // 提交修改（优化API调用参数）
      const response = await apiFetch('user/update', {
        data: { username: formData.username.trim() },
      });

      if (response.success) {
        // 更新全局用户信息（仅传递必要字段）
        updateUser({ username: formData.username.trim() });
        
        // 更新本地存储（与全局状态保持一致）
        const storedUser = JSON.parse(localStorage.getItem('user') || '{}');
        localStorage.setItem('user', JSON.stringify({
          ...storedUser,
          username: formData.username.trim(),
        }));

        // 显示成功提示
        setNotification({ type: 'success', text: '修改成功！' });
        
        // 延迟刷新（避免立即刷新导致的抖动）
        setTimeout(() => {
          router.refresh();
        }, 1500);
      } else {
        setNotification({ type: 'error', text: response.message || '修改失败，请重试' });
      }
    } catch (error) {
      console.error('修改失败：', error);
      setNotification({ type: 'error', text: '网络异常，修改失败' });
    } finally {
      setIsSubmitting(false);
    }
  }, [formData.username, isSubmitting, updateUser, router]);

  return (
    <div className="max-w-4xl mx-auto space-y-8 py-8"> {/* 添加上下内边距，避免顶部紧贴导航栏 */}
      {/* 个人信息编辑卡片（固定容器，避免整体位移） */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h1 className="text-xl font-bold text-gray-900">个人信息设置</h1>
          <p className="text-sm text-gray-500 mt-1">修改基础信息，未来可扩展更多字段</p>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* 已启用字段：用户名 */}
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
            <p className="text-xs text-gray-500">用户名仅用于登录和显示，修改后立即生效</p>
          </div>

          {/* 只读字段：邮箱 */}
          <div className="space-y-2 opacity-70"> {/* 调整透明度，更清晰区分只读状态 */}
            <label htmlFor="email" className="block text-sm font-medium text-gray-700">
              邮箱（仅展示）
            </label>
            <input
              type="email" // 正确的输入类型
              id="email"
              name="email"
              value={formData.email}
              className="w-full px-4 py-2 border border-gray-300 rounded-md bg-gray-50 cursor-not-allowed"
              placeholder="暂无绑定邮箱"
              disabled
              readOnly // 额外添加readOnly属性，增强兼容性
            />
          </div>

          {/* 预留扩展字段：昵称（暂不启用） */}
          <div className="space-y-2 opacity-50">
            <label htmlFor="nickname" className="block text-sm font-medium text-gray-700">
              昵称（即将开放）
            </label>
            <input
              type="text"
              id="nickname"
              name="nickname"
              value={formData.nickname}
              className="w-full px-4 py-2 border border-gray-300 rounded-md bg-gray-50 cursor-not-allowed"
              placeholder="请输入昵称"
              disabled
              readOnly
            />
          </div>

          {/* 预留扩展字段：手机号（暂不启用） */}
          <div className="space-y-2 opacity-50">
            <label htmlFor="phone" className="block text-sm font-medium text-gray-700">
              手机号（即将开放）
            </label>
            <input
              type="tel"
              id="phone"
              name="phone"
              value={formData.phone}
              className="w-full px-4 py-2 border border-gray-300 rounded-md bg-gray-50 cursor-not-allowed"
              placeholder="请输入手机号"
              disabled
              readOnly
            />
          </div>

          {/* 提交按钮 + 状态提示（固定高度容器，避免布局偏移） */}
          <div className="space-y-3 pt-4 border-t border-gray-100">
            {/* 提示信息容器（固定高度，即使无信息也占位置） */}
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
                    <CheckCircle2 size={18} className="text-green-500 flex-shrink-0" />
                  ) : (
                    <AlertCircle size={18} className="text-red-500 flex-shrink-0" />
                  )}
                  <span className="flex-shrink-0">{notification.text}</span>
                </div>
              )}
            </div>

            {/* 提交按钮（固定宽度，避免点击时尺寸变化） */}
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-2.5 px-4 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors disabled:bg-blue-300 disabled:cursor-not-allowed"
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