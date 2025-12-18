'use client';
import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { User, LogIn, LogOut, Menu, X, ChevronDown, Sparkles } from 'lucide-react';
import TenantSwitcher from './TenantSwitcher';
import HubspotConnectButton from './HubSpotConnectButton';
import { UserInfo } from '@/types';
import { useUser } from '@/context/UserContext';

type UserState = UserInfo | null;

interface NavbarProps {
  className?: string;
  userRole?: 'admin' | 'user';
}

export default function Toolbar({
  className = '',
  userRole = 'user',
}: NavbarProps) {
  const { user: contextUser, logout } = useUser();
  const router = useRouter();
  const navbarRef = useRef<HTMLDivElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);

  const [user, setUser] = useState<UserState>(null);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [hasScrolled, setHasScrolled] = useState(false);

  useEffect(() => {
    const initUserState = async () => {
      if (contextUser) {
        setUser(contextUser);
      } else {
        setUser(null);
      }
      setIsLoading(false);
    };

    initUserState();
  }, [contextUser]);

  // Scroll detection for shadow effect
  useEffect(() => {
    const handleScroll = () => {
      setHasScrolled(window.scrollY > 10);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Click outside to close user menu
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (isUserMenuOpen && userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setIsUserMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside, true);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside, true);
    };
  }, [isUserMenuOpen]);

  const handleLogin = () => {
    router.push('/login');
    setIsMobileMenuOpen(false);
  };

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await logout();
      setUser(null);
      router.push('/login');
      router.refresh();
    } catch (err) {
      console.error('退出登录失败：', (err as Error).message);
      alert('退出登录失败，请重试');
    } finally {
      setIsLoggingOut(false);
      setIsUserMenuOpen(false);
    }
  };

  const handleTenantChange = (tenantId: string) => {
    console.log('切换到 HubSpot 账户:', tenantId);
  };

  const NavSkeleton = ({ type = 'desktop' }: { type: 'desktop' | 'mobile' | 'user' }) => {
    switch (type) {
      case 'desktop':
        return (
          <div className="flex items-center gap-3">
            <div className="animate-pulse bg-white/20 rounded-lg w-[200px] h-10" />
            <div className="animate-pulse bg-white/20 rounded-lg w-24 h-10" />
          </div>
        );
      case 'mobile':
        return (
          <div className="space-y-3">
            <div className="animate-pulse bg-gray-200 rounded h-5 w-32" />
            <div className="animate-pulse bg-gray-200 rounded-lg w-full h-10" />
            <div className="animate-pulse bg-gray-200 rounded-lg w-full h-10" />
          </div>
        );
      case 'user':
        return (
          <div className="flex items-center gap-2">
            <div className="animate-pulse bg-white/20 rounded-full h-9 w-9" />
            <div className="animate-pulse bg-white/20 rounded h-5 w-20" />
          </div>
        );
      default:
        return null;
    }
  };

  const getInitials = () => {
    if (!user) return 'U';
    const username = user.username || '';
    return username.slice(0, 2).toUpperCase() || 'U';
  };

  return (
    <nav
      ref={navbarRef}
      className={`
        fixed top-0 left-0 right-0 z-50 
        transition-all duration-300
        ${hasScrolled 
          ? 'bg-white/80 backdrop-blur-xl shadow-lg border-b border-blue-100' 
          : 'bg-gradient-to-r from-white via-blue-50/30 to-indigo-50/30 backdrop-blur-sm border-b border-transparent'
        }
        ${className}
      `}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2 group">
            <div className="relative">
              <Sparkles className="w-6 h-6 text-blue-600 group-hover:text-blue-700 transition-colors" />
              <div className="absolute inset-0 bg-blue-400 blur-xl opacity-20 group-hover:opacity-40 transition-opacity" />
            </div>
            <span className="text-xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
            eTrunk 智汇云
            </span>
          </Link>

          {/* Desktop: Tenant Switcher + Connect Button + User Menu */}
          <div className="hidden md:flex items-center gap-3">
            {isLoading ? (
              <NavSkeleton type="desktop" />
            ) : user ? (
              <>
                <TenantSwitcher
                  className="w-[200px]"
                  onTenantChange={handleTenantChange}
                  placeholder="Select HubSpot Account"
                />
                <HubspotConnectButton size="md" />
                
                {/* User Menu */}
                <div className="relative" ref={userMenuRef}>
                  <button
                    onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-white/60 transition-all duration-200 group"
                  >
                    <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white text-sm font-semibold shadow-lg group-hover:shadow-xl transition-shadow">
                      {getInitials()}
                    </div>
                    <span className="text-sm font-medium text-gray-700 max-w-24 truncate">
                      {user.username}
                    </span>
                    <ChevronDown 
                      className={`w-4 h-4 text-gray-500 transition-transform duration-200 ${
                        isUserMenuOpen ? 'rotate-180' : ''
                      }`} 
                    />
                  </button>

                  {/* Dropdown Menu */}
                  {isUserMenuOpen && (
                    <div className="absolute right-0 mt-2 w-56 bg-white rounded-xl shadow-2xl ring-1 ring-black/5 py-2 animate-in fade-in slide-in-from-top-2 duration-200">
                      <div className="px-4 py-3 border-b border-gray-100">
                        <p className="text-sm font-semibold text-gray-900">{user.username}</p>
                        <p className="text-xs text-gray-500 mt-0.5">{user.email || 'User Account'}</p>
                      </div>
                      
                      <Link
                        href="/settings/profile"
                        className="block px-4 py-2.5 text-sm text-gray-700 hover:bg-blue-50 hover:text-blue-700 transition-colors"
                        onClick={() => setIsUserMenuOpen(false)}
                      >
                        个人资料
                      </Link>
                      <Link
                        href="/settings/security"
                        className="block px-4 py-2.5 text-sm text-gray-700 hover:bg-blue-50 hover:text-blue-700 transition-colors"
                        onClick={() => setIsUserMenuOpen(false)}
                      >
                        安全设置
                      </Link>
                      
                      <div className="border-t border-gray-100 mt-2 pt-2">
                        <button
                          className="w-full text-left px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors flex items-center gap-2"
                          onClick={handleLogout}
                          disabled={isLoggingOut}
                        >
                          <LogOut size={16} />
                          {isLoggingOut ? '退出中...' : '退出登录'}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <button
                onClick={handleLogin}
                className="inline-flex items-center gap-2 px-6 py-2.5 rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-medium shadow-lg hover:shadow-xl hover:from-blue-700 hover:to-indigo-700 transition-all duration-200"
              >
                <LogIn size={18} />
                登录
              </button>
            )}
          </div>

          {/* Mobile Menu Button */}
          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="md:hidden p-2 rounded-lg hover:bg-white/60 transition-colors"
          >
            {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
      </div>

      {/* Mobile Menu */}
      {isMobileMenuOpen && (
        <div className="md:hidden bg-white border-t border-gray-100 shadow-xl animate-in slide-in-from-top duration-200">
          <div className="px-4 py-4">
            {isLoading ? (
              <NavSkeleton type="mobile" />
            ) : user ? (
              <div className="space-y-4">
                <div className="flex items-center gap-3 pb-4 border-b border-gray-100">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-semibold shadow-lg">
                    {getInitials()}
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold text-gray-900">{user.username}</p>
                    <p className="text-sm text-gray-500">{user.email || 'User'}</p>
                  </div>
                  <button
                    onClick={handleLogout}
                    disabled={isLoggingOut}
                    className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                  >
                    <LogOut size={20} />
                  </button>
                </div>

                <div className="space-y-3">
                  <label className="block text-sm font-medium text-gray-700">HubSpot 账户</label>
                  <TenantSwitcher className="w-full" onTenantChange={handleTenantChange} />
                  <HubspotConnectButton size="md" className="w-full" />
                </div>

                <div className="pt-2 space-y-1">
                  <Link
                    href="/settings/profile"
                    className="block px-4 py-2.5 rounded-lg text-gray-700 hover:bg-blue-50 hover:text-blue-700 transition-colors"
                    onClick={() => setIsMobileMenuOpen(false)}
                  >
                    个人资料
                  </Link>
                  <Link
                    href="/settings/security"
                    className="block px-4 py-2.5 rounded-lg text-gray-700 hover:bg-blue-50 hover:text-blue-700 transition-colors"
                    onClick={() => setIsMobileMenuOpen(false)}
                  >
                    安全设置
                  </Link>
                </div>
              </div>
            ) : (
              <button
                onClick={handleLogin}
                className="w-full inline-flex items-center justify-center gap-2 px-6 py-3 rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-medium shadow-lg"
              >
                <LogIn size={18} />
                登录
              </button>
            )}
          </div>
        </div>
      )}
    </nav>
  );
}