'use client';
import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { User, LogIn, LogOut, Menu, X, ChevronDown, Loader2 } from 'lucide-react';
import TenantSwitcher from './TenantSwitcher';
import HubspotConnectButton from './HubSpotConnectButton';
import { UserInfo } from '@/types';
import { useUser } from '@/context/UserContext';

// 类型扩展：添加初始化状态
type UserState = UserInfo | null | 'initializing';

interface NavbarProps {
  className?: string;
  // 服务端预传的用户状态（Next.js 13+ App Router 支持）
  serverUser?: UserInfo | null;
  userRole?: 'admin' | 'user';
  onLogin?: () => void;
  onLogout?: () => void;
}

export default function Navbar({
  className = '',
  serverUser = null,
  onLogin: propsOnLogin,
  onLogout: propsOnLogout,
  userRole = 'user',
}: NavbarProps) {
  const { user: contextUser, logout: contextLogout } = useUser();
  const router = useRouter();
  const navbarRef = useRef<HTMLDivElement>(null);

  // 关键优化1：三级状态管理（initializing -> 已登录/未登录）
  const [user, setUser] = useState<UserState>('initializing');
  const logout = contextLogout ?? propsOnLogout;
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  // 创建菜单 DOM 引用，用于判断点击是否在菜单内部
  const userMenuRef = useRef<HTMLDivElement>(null);

  // 关键优化2：优先使用服务端预传状态 -> Context -> localStorage
  useEffect(() => {
    const initUserState = async () => {
      // 1. 优先使用服务端预传状态（无延迟）
      // if (serverUser !== 'initializing') {
      //   setUser(serverUser);
      //   if (serverUser) {
      //     localStorage.setItem('user', JSON.stringify(serverUser));
      //   } else {
      //     localStorage.removeItem('user');
      //   }
      //   return;
      // }

      // 2. 其次使用 Context 状态
      if (contextUser) {
        setUser(contextUser);
        localStorage.setItem('user', JSON.stringify(contextUser));
        return;
      }

      // 3. 最后从 localStorage 兜底读取
      if (typeof window !== 'undefined') {
        const storedUser = localStorage.getItem('user');
        if (storedUser) {
          try {
            const parsedUser = JSON.parse(storedUser);
            setUser(parsedUser);
          } catch (error) {
            localStorage.removeItem('user');
            setUser(null);
          }
        } else {
          setUser(null);
        }
      }
    };

    initUserState();
  }, [contextUser, serverUser]);

  // 关键优化3：监听窗口大小变化，固化 Navbar 高度（避免布局位移）
  useEffect(() => {
    if (navbarRef.current) {
      // 固化 Navbar 高度，防止加载过程中高度变化
      navbarRef.current.style.height = `${navbarRef.current.offsetHeight}px`;
    }

    const handleResize = () => {
      if (navbarRef.current) {
        navbarRef.current.style.height = 'auto';
        navbarRef.current.style.height = `${navbarRef.current.offsetHeight}px`;
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // 全局点击事件监听：点击外部关闭菜单
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      // 若菜单已展开，且点击目标不在菜单内部（包含菜单触发按钮）
      if (isUserMenuOpen && userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setIsUserMenuOpen(false);
      }
    };

    // 绑定全局点击事件（捕获阶段，避免被内部事件阻止）
    document.addEventListener('mousedown', handleClickOutside, true);

    // 组件卸载时移除事件监听（避免内存泄漏）
    return () => {
      document.removeEventListener('mousedown', handleClickOutside, true);
    };
  }, [isUserMenuOpen]); // 仅当菜单状态变化时重新绑定

  // 处理登录
  const handleLogin = () => {
    propsOnLogin ? propsOnLogin() : router.push('/login');
    setIsMobileMenuOpen(false);
  };

  // 处理退出登录（彻底清除状态）
  const handleLogout = () => {
    logout?.();
    // 清除所有相关缓存
    localStorage.removeItem('activeTenantId');
    localStorage.removeItem('user');
    localStorage.removeItem('authToken');
    setUser(null);
    setIsUserMenuOpen(false);
    router.push('/login');
  };

  // 租户切换回调
  const handleTenantChange = (tenantId: string) => {
    console.log('切换到 HubSpot 账户:', tenantId);
  };

  // 优化版骨架屏（模拟真实组件结构，视觉更统一）
  const NavSkeleton = ({ type = 'desktop' }: { type: 'desktop' | 'mobile' | 'user' }) => {
    switch (type) {
      case 'desktop':
        return (
          <div className="flex items-center gap-2">
            <div className="animate-pulse bg-gray-100 rounded-md w-[180px] md:w-[220px] h-9" />
            <div className="animate-pulse bg-gray-100 rounded-md w-20 h-9" />
          </div>
        );
      case 'mobile':
        return (
          <div className="space-y-3">
            <div className="animate-pulse bg-gray-100 rounded h-5 w-32" />
            <div className="animate-pulse bg-gray-100 rounded-md w-full h-9" />
            <div className="animate-pulse bg-gray-100 rounded-md w-full h-9" />
          </div>
        );
      case 'user':
        return (
          <div className="flex items-center">
            <div className="animate-pulse bg-gray-100 rounded-full h-8 w-8" />
            <div className="ml-2 animate-pulse bg-gray-100 rounded h-5 w-24" />
            <div className="ml-1 animate-pulse bg-gray-100 rounded h-4 w-4" />
          </div>
        );
      default:
        return null;
    }
  };

  // 判断是否加载中
  const isLoading = user === 'initializing';

  return (
    <nav
      ref={navbarRef}
      className={`bg-white border-b border-gray-200 fixed top-0 left-0 right-0 z-50 transition-all duration-200 ${className}`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          {/* 左侧 Logo 和导航链接 */}
          <div className="flex items-center">
            <Link href="/" className="shrink-0 flex items-center">
              <span className="text-xl font-bold text-blue-600">HubSpot</span>
            </Link>
          </div>

          {/* 右侧：租户切换 + HubSpot 关联按钮 + 用户操作 */}
          <div className="flex items-center">
            {/* 租户切换 + 关联按钮（桌面端） */}
            <div className="hidden sm:flex items-center gap-2 mr-4">
              {isLoading ? (
                <NavSkeleton type="desktop" />
              ) : user ? (
                <>
                  <TenantSwitcher
                    className="w-[180px] md:w-[220px]"
                    onTenantChange={handleTenantChange}
                    placeholder="Select HubSpot Account"
                  />
                  <HubspotConnectButton size="md" />
                </>
              ) : null}
            </div>

            {/* 登录/用户菜单（桌面端） */}
            <div className="hidden sm:flex sm:items-center" ref={userMenuRef}>
              {isLoading ? (
                <div className="ml-3 relative">
                  <NavSkeleton type="user" />
                </div>
              ) : user ? (
                <div className="ml-3 relative">
                  <div
                    onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                    className="flex items-center cursor-pointer p-1 rounded-full hover:bg-gray-100 transition-colors"
                    aria-expanded={isUserMenuOpen}
                  >
                    {user.avatar ? (
                      <img
                        className="h-8 w-8 rounded-full object-cover border border-gray-200"
                        src={user.avatar}
                        alt={user.username}
                        loading="lazy"
                      />
                    ) : (
                      <User size={20} className="text-gray-600" />
                    )}
                    <span
                      className="ml-2 text-sm font-medium text-gray-700 hidden md:inline-block w-24 truncate text-ellipsis whitespace-nowrap"
                      title={user.username}
                    >
                      {user.username}
                    </span>
                    <ChevronDown size={16} className="ml-1 text-gray-500 shrink-0" />
                  </div>
                  {/* 用户下拉菜单（添加淡入动画） */}
                  {isUserMenuOpen && (
                    <div
                      className="origin-top-right absolute right-0 mt-2 w-48 rounded-md shadow-lg bg-white ring-1 ring-black ring-opacity-5 py-1 z-50 animate-fadeIn"
                      style={{ animationDuration: '150ms' }}
                    >
                      <Link
                        href="/settings/profile"
                        className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors"
                        onClick={() => setIsUserMenuOpen(false)}
                      >
                        Profile
                      </Link>
                      <Link
                        href="/settings/security"
                        className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors"
                        onClick={() => setIsUserMenuOpen(false)}
                      >
                        Security
                      </Link>
                      <button
                        className="block w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-gray-100 transition-colors"
                        onClick={handleLogout}
                      >
                        <LogOut size={14} className="inline mr-1" /> Sign Out
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <button
                  onClick={handleLogin}
                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
                >
                  <LogIn size={16} className="mr-2" /> Sign In
                </button>
              )}
            </div>

            {/* 移动端菜单按钮 */}
            <div className="sm:hidden flex items-center">
              <button
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                className="p-2 rounded-md text-gray-400 hover:text-gray-500 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-500 transition-colors"
                aria-expanded={isMobileMenuOpen}
              >
                {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 移动端菜单（优化动画和加载状态） */}
      {isMobileMenuOpen && (
        <div
          className="sm:hidden bg-white border-b border-gray-200 animate-slideDown"
          style={{ animationDuration: '200ms' }}
          onClick={(e) => {
            // 点击菜单内容不关闭，仅点击空白处关闭
            if (e.target === e.currentTarget) setIsMobileMenuOpen(false);
          }}
        >
          <div className="px-4 py-3 border-b border-gray-200">
            {isLoading ? (
              <NavSkeleton type="mobile" />
            ) : user ? (
              <div className="space-y-3">
                <label className="block text-sm font-medium text-gray-700 mb-1">Select HubSpot Account</label>
                <TenantSwitcher className="w-full" onTenantChange={handleTenantChange} />
                <HubspotConnectButton size="md" className="w-full" />
              </div>
            ) : (
              <div className="h-16 flex items-center justify-center">
                <button
                  onClick={handleLogin}
                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700"
                >
                  <LogIn size={16} className="mr-2" /> Sign In
                </button>
              </div>
            )}
          </div>

          {/* 移动端导航链接 */}
          {!isLoading && user && (
            <div className="pt-2 pb-3 space-y-1">
              <Link
                href="/settings/profile"
                className="block pl-3 pr-4 py-2 border-l-4 border-transparent text-base font-medium text-gray-500 hover:border-blue-500 hover:bg-gray-50 hover:text-gray-700 transition-colors"
                onClick={() => setIsMobileMenuOpen(false)}
              >
                Profile
              </Link>
            </div>
          )}

          {/* 移动端用户信息（仅登录状态） */}
          {!isLoading && user && (
            <div className="pt-4 pb-3 border-t border-gray-200">
              <div className="flex items-center px-4">
                <div className="shrink-0">
                  {user.avatar ? (
                    <img className="h-10 w-10 rounded-full" src={user.avatar} alt={user.username} loading="lazy" />
                  ) : (
                    <User size={24} className="text-gray-600" />
                  )}
                </div>
                <div className="ml-3">
                  <div className="text-base font-medium text-gray-800">{user.username}</div>
                  <div className="text-sm font-medium text-gray-500">{user.role || 'User'}</div>
                </div>
                <button
                  onClick={handleLogout}
                  className="ml-auto text-red-600 hover:text-red-700"
                >
                  <LogOut size={20} />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 全局动画样式（仅在该组件内生效） */}
      <style jsx global>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(-5px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes slideDown {
          from { opacity: 0; transform: translateY(-10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fadeIn {
          animation-name: fadeIn;
        }
        .animate-slideDown {
          animation-name: slideDown;
        }
      `}</style>
    </nav>
  );
}