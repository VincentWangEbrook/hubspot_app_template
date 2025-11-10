'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { UserInfo } from '@/types'; // 从共享类型文件导入

// 定义 Context 类型，明确暴露的状态和方法
interface UserContextType {
  user: UserInfo | null; // 当前登录用户信息（null 表示未登录）
  login: (userData: UserInfo, token: string) => void; // 登录方法：接收用户数据和 token
  logout: () => void; // 退出登录方法：清除状态和缓存
  isLoading: boolean; // 初始化加载状态（判断是否正在读取本地缓存）
  updateUser: (updatedUser: Partial<UserInfo>) => void; // 新增：更新用户信息的方法
}

// 创建 Context，初始值为 undefined（后续通过 Provider 注入）
const UserContext = createContext<UserContextType | undefined>(undefined);

/**
 * 用户状态 Provider 组件
 * 包裹在根布局中，让所有子组件可访问用户状态
 */
export function UserProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true); // 初始化加载状态

  // 页面加载时：从 localStorage 读取用户信息和 token，恢复登录状态
  useEffect(() => {
    const initUserState = () => {
      try {
        // 读取本地存储的 token 和用户信息
        const storedToken = localStorage.getItem('jwt');
        const storedUserStr = localStorage.getItem('user');

        if (storedToken && storedUserStr) {
          // 解析用户信息（确保格式正确）
          const storedUser = JSON.parse(storedUserStr) as UserInfo;
          // 验证用户信息关键字段（避免非法数据）
          if (storedUser.id && storedUser.username) {
            setUser(storedUser);
          } else {
            // 数据非法：清除缓存
            localStorage.removeItem('jwt');
            localStorage.removeItem('user');
          }
        }
      } catch (error) {
        // 解析失败：清除缓存，重置状态
        console.error('初始化用户状态失败:', error);
        localStorage.removeItem('jwt');
        localStorage.removeItem('user');
      } finally {
        // 无论成功失败，加载状态结束
        setIsLoading(false);
      }
    };

    initUserState();
  }, []);

  // 登录方法：更新全局状态 + 保存到本地存储
  const login = (userData: UserInfo, token: string) => {
    // 验证用户数据关键字段（避免无效数据注入）
    if (!userData.id || !userData.username) {
      throw new Error('登录失败：用户信息缺少关键字段（id 或 username）');
    }
    // 更新全局状态
    setUser(userData);
    // 保存到本地存储（持久化，刷新页面后仍保留）
    localStorage.setItem('jwt', token);
    localStorage.setItem('user', JSON.stringify(userData));
  };

  // 退出登录方法：清除全局状态 + 本地缓存
  const logout = () => {
    // 清除全局状态
    setUser(null);
    // 清除本地缓存（token 和用户信息）
    localStorage.removeItem('jwt');
    localStorage.removeItem('user');
    // 可选：清除租户缓存（与 Navbar 租户切换联动）
    localStorage.removeItem('activeTenantId');
  };

    // 更新用户信息（支持部分字段更新，如 username）
    const updateUser = (updatedUser: Partial<UserInfo>) => {
      setUser(prev => {
        if (!prev) return prev;
        // 合并旧用户信息和新字段
        const newUser = { ...prev, ...updatedUser };
        // 同步更新本地存储（关键：确保刷新页面后仍保留新值）
        localStorage.setItem('user', JSON.stringify(newUser));
        return newUser;
      });
    };

  // 注入状态和方法到 Context
  const contextValue: UserContextType = {
    user,
    login,
    logout,
    isLoading,
    updateUser
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