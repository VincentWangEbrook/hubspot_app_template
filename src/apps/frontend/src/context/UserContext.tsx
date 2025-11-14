'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { UserInfo } from '../types';
import { useAuth } from '../lib/auth';
import { apiFetch } from '@/lib/apiFetch';

// 定义 Context 类型，明确暴露的状态和方法
interface UserContextType {
  user: UserInfo | null; // 当前登录用户信息（null 表示未登录）
  login: ({email, password}) => Promise<boolean>; // 登录方法：接收用户数据和 token
  logout: () => Promise<boolean>; // 退出登录方法：清除状态和缓存
  //setUser: (user: UserInfo | null) => void;
  isLoading: boolean; // 初始化加载状态（判断是否正在读取本地缓存）
  updateProfile: (updateProfile: Partial<UserInfo>) => Promise<boolean>;
}

// 创建 Context，初始值为 undefined（后续通过 Provider 注入）
const UserContext = createContext<UserContextType | undefined>(undefined);
//const UserContext = createContext<any>(null);

/**
 * 用户状态 Provider 组件
 * 包裹在根布局中，让所有子组件可访问用户状态
 */
export function UserProvider({ children }: { children: ReactNode }) {
  const {user: contextUser} = useAuth();
  const [user, setUser] = useState<UserInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true); // 初始化加载状态

  // 页面加载时：从 localStorage 读取用户信息和 token，恢复登录状态
  useEffect(() => {
    const initUserState = () => {
      if (contextUser) {
        setUser(contextUser);
      }
      setIsLoading(false);
    };
    initUserState();
  }, [contextUser]);

  // 登录方法：更新全局状态 + 保存到本地存储
  const login = async ({email, password}) => {
    // 验证用户数据关键字段（避免无效数据注入）
    if (!email || !password) {
      throw new Error('登录失败：用户信息缺少关键字段（id 或 username）');
    }

    const response = await apiFetch<{user: UserInfo}>('/auth/login', {
      data: { email: email.trim(), password },
      credentials: 'include'
    });

    if (response.success && response.data?.user) {
      setUser(response.data.user);
      return true;
    }
    return false;
  };

  // 处理退出登录
  const logout = async () => {
    const res = await apiFetch('/auth/logout', { data: {} });
    if (res.success) {
      setUser(null);
      return true;
    }
    return false;
  };

  // 更新用户信息（支持部分字段更新，如 username）
  const updateProfile = async (updateProfile: Partial<UserInfo>) => {
    const response = await apiFetch<{ user: UserInfo }>('/auth/update-profile', {
      data: updateProfile,
    });

  if (response.success && response.data?.user) {
    setUser(prev => ({ ...prev, ...response.data.user }));
    return true;
  }
    return false;
  };

  // 注入状态和方法到 Context
  const contextValue: UserContextType = {
    user,
    login,
    logout,
    isLoading,
    updateProfile
  };

  return (
    <UserContext.Provider value={contextValue}>
      {children}
    </UserContext.Provider>
  );
}

/**
 * 自定义 Hook：简化组件对 UserContext 的访问
 * 确保组件在 Provider 内部使用，否则抛出错误
 */
export function useUser() {
  const context = useContext(UserContext);
  if (!context) throw new Error('useUser 必须在 UserProvider 组件内部使用');
  return context;
}