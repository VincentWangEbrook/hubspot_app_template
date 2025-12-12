'use client';
import Link from 'next/link';
import { useState, useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { 
  Settings, 
  BarChart, 
  ChevronDown, 
  ChevronRight, 
  Menu, 
  X,
  Briefcase,
  CreditCard,
  Shield,
  ChevronLeft,
  Layers,
} from 'lucide-react';
import { UserInfo } from '@/types';
import { useTenant } from '@/context/TenantContext';
import { getNavigationUrl, getLastTenantId } from '@/utils/tenantUrl';

interface MenuItem {
  label: string;
  path: string;
  icon?: React.ReactNode;
  children?: MenuItem[];
  requiredPermission?: string;
}

const menuConfig: MenuItem[] = [
  {
    label: 'Reports',
    path: '/reports',
    icon: <BarChart size={20} />,
  },
  {
    label: 'HubSpot',
    path: '/hubspot',
    icon: <Briefcase size={20} />,
    // children: [
    //   { label: '联系人', path: '/hubspot/contacts'},
    //   { label: '公司', path: '/hubspot/companies'},
    //   { label: 'LINE 聊天', path: '/hubspot/line-chat', requiredPermission: 'line:read' },
    // ],
  },
  {
    label: '订阅管理',
    path: '/subscription',
    icon: <CreditCard size={20} />,
  },
  {
    label: '设置',
    path: '/settings',
    icon: <Settings size={20} />,
    children: [
      { label: '个人资料', path: '/settings/profile' },
      { label: '安全设置', path: '/settings/security' },
      { label: '租户管理', path: '/settings/tenants', requiredPermission: 'tenant:read' },
    ],
  },
  {
    label: '系统管理',
    path: '/system',
    icon: <Shield size={20} />,
    children: [
      { label: '用户管理', path: '/system/accounts', requiredPermission: 'user:read' },
      { label: '租户管理', path: '/system/tenants', requiredPermission: 'tenant:read' },
      { label: '角色管理', path: '/system/roles', requiredPermission: 'role:read' },
      { label: '审计日志', path: '/system/audit-logs', requiredPermission: 'audit:read' },
      { label: '紧急访问', path: '/system/emergency-access', requiredPermission: 'emergency:request' },
    ],
  },
];

interface NavbarProps {
  onCollapseChange: (isCollapsed: boolean) => void;
  user: UserInfo;
}

export default function Navbar({ onCollapseChange, user }: NavbarProps) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [expandedMenus, setExpandedMenus] = useState<string[]>([]);
  const currentPath = usePathname();
  const navRef = useRef<HTMLDivElement>(null);
  const { tenantId } = useTenant();

  const isInTenantContext = !!tenantId;

  const getMenuUrl = (basePath: string): string => {
    const effectiveTenantId = tenantId || getLastTenantId();
    return getNavigationUrl(basePath, effectiveTenantId);
  };

  const isTenantLevelMenu = (basePath: string): boolean => {
    return basePath.startsWith('/hubspot') || 
           basePath.startsWith('/reports') || 
           basePath.startsWith('/subscription');
  };

  useEffect(() => {
    onCollapseChange(isCollapsed);
  }, [isCollapsed, onCollapseChange]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (navRef.current && !navRef.current.contains(e.target as Node)) {
        setIsMobileMenuOpen(false);
      }
    };

    if (user) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isMobileMenuOpen, user]);

  useEffect(() => {
    menuConfig.forEach((menu) => {
      if (menu.children?.some((child) => currentPath?.startsWith(child.path))) {
        setExpandedMenus((prev) => 
          prev.includes(menu.path) ? prev : [...prev, menu.path]
        );
      }
    });
  }, [currentPath]);

  const toggleCollapse = () => {
    setIsCollapsed(!isCollapsed);
  };

  const toggleSubmenu = (path: string) => {
    setExpandedMenus((prev) =>
      prev.includes(path)
        ? prev.filter((p) => p !== path)
        : [...prev, path]
    );
  };

  const hasPermission = (menu: MenuItem): boolean => {
    if (!menu.requiredPermission) return true;
    const permissions = user.permissions ?? [];
    if (permissions.includes(menu.requiredPermission)) return true;
    
    const [resource, action] = menu.requiredPermission.split(':');
    if (action && action !== 'manage') {
      const managePermission = `${resource}:manage`;
      if (permissions.includes(managePermission)) return true;
    }
    
    return false;
  };

  const shouldShowMenu = (menu: MenuItem): boolean => {
    if (menu.children && menu.children.length > 0) {
      return menu.children.some(hasPermission);
    }
    return hasPermission(menu);
  };

  const getVisibleChildren = (menu: MenuItem): MenuItem[] => {
    if (!menu.children) return [];
    return menu.children.filter(hasPermission);
  };

  const isPathActive = (path: string): boolean => {
    return currentPath?.startsWith(path) ?? false;
  };

  if (!user) return null;

  const visibleMenus = menuConfig.filter(shouldShowMenu);

  return (
    <>
      {/* Mobile Menu Button - Positioned below toolbar */}
      <button
        onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
        className="md:hidden fixed top-20 left-4 z-40 p-2.5 bg-gradient-to-br from-blue-600 to-indigo-600 text-white shadow-lg rounded-xl hover:shadow-xl transition-all duration-200"
      >
        {isMobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
      </button>

      {/* Sidebar */}
      <nav
        ref={navRef}
        className={`
          ${isMobileMenuOpen ? 'fixed inset-0 z-40' : 'hidden md:block'}
          md:fixed md:top-0 md:left-0 md:h-screen
          transition-all duration-300 ease-in-out
          ${isCollapsed ? 'md:w-20' : 'md:w-64'}
        `}
      >
        <div className={`
          h-full flex flex-col
          bg-gradient-to-br from-slate-900 via-blue-900 to-indigo-900
          ${isMobileMenuOpen ? 'p-6' : 'md:p-4'}
          shadow-2xl
        `}>
          {/* Logo */}
          <div className="mb-8 flex items-center justify-between">
            {!isCollapsed && (
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-400 to-indigo-500 flex items-center justify-center shadow-lg">
                  <Layers size={18} className="text-white" />
                </div>
                <h1 className="text-xl font-bold text-white">
                  HubSpot
                </h1>
              </div>
            )}
            {!isCollapsed && (
              <button
                onClick={() => setIsMobileMenuOpen(false)}
                className="md:hidden p-1.5 hover:bg-white/10 rounded-lg transition-colors"
              >
                <X size={20} className="text-white" />
              </button>
            )}
          </div>

          {/* Menu Items */}
          <div className="flex-1 overflow-y-auto custom-scrollbar">
            {/* Tenant Level Menus */}
            {!isCollapsed && (
              <div className="px-3 py-2 mb-2">
                <span className="text-xs font-semibold text-blue-300 uppercase tracking-wider">
                  租户功能
                </span>
              </div>
            )}
            
            <ul className="space-y-1 mb-6">
              {visibleMenus.filter(menu => isTenantLevelMenu(menu.path)).map((menu) => (
                <li key={menu.path}>
                  {menu.children ? (
                    <div>
                      <button
                        onClick={() => toggleSubmenu(menu.path)}
                        className={`w-full flex items-center gap-3 py-2.5 px-3 rounded-xl transition-all duration-200 ${
                          isPathActive(menu.path)
                            ? 'bg-gradient-to-r from-blue-500 to-indigo-500 text-white shadow-lg'
                            : 'text-blue-100 hover:bg-white/10'
                        }`}
                      >
                        <div className={isCollapsed ? 'mx-auto' : ''}>
                          {menu.icon}
                        </div>
                        {!isCollapsed && (
                          <>
                            <span className="flex-1 text-left font-medium">{menu.label}</span>
                            {expandedMenus.includes(menu.path) ? (
                              <ChevronDown size={16} />
                            ) : (
                              <ChevronRight size={16} />
                            )}
                          </>
                        )}
                      </button>
                      
                      {!isCollapsed && expandedMenus.includes(menu.path) && (
                        <ul className="ml-6 mt-1 space-y-1 border-l-2 border-blue-400/30 pl-4">
                          {getVisibleChildren(menu).map((child) => (
                            <li key={child.path}>
                              <Link
                                href={getMenuUrl(child.path)}
                                className={`block py-2 px-3 rounded-lg text-sm transition-all duration-200 ${
                                  currentPath === child.path
                                    ? 'bg-blue-500/20 text-white font-medium'
                                    : 'text-blue-200 hover:bg-white/5 hover:text-white'
                                }`}
                                onClick={() => setIsMobileMenuOpen(false)}
                              >
                                {child.label}
                              </Link>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  ) : (
                    <Link
                      href={getMenuUrl(menu.path)}
                      className={`flex items-center gap-3 py-2.5 px-3 rounded-xl transition-all duration-200 ${
                        isPathActive(menu.path)
                          ? 'bg-gradient-to-r from-blue-500 to-indigo-500 text-white shadow-lg'
                          : 'text-blue-100 hover:bg-white/10'
                      }`}
                      onClick={() => setIsMobileMenuOpen(false)}
                    >
                      <div className={isCollapsed ? 'mx-auto' : ''}>
                        {menu.icon}
                      </div>
                      {!isCollapsed && (
                        <span className="font-medium">{menu.label}</span>
                      )}
                    </Link>
                  )}
                </li>
              ))}
            </ul>

            {/* System Level Menus */}
            {!isCollapsed && visibleMenus.some(m => !isTenantLevelMenu(m.path)) && (
              <>
                <div className="border-t border-white/10 my-4" />
                <div className="px-3 py-2 mb-2">
                  <span className="text-xs font-semibold text-purple-300 uppercase tracking-wider">
                    系统与设置
                  </span>
                </div>
              </>
            )}
            
            <ul className="space-y-1">
              {visibleMenus.filter(menu => !isTenantLevelMenu(menu.path)).map((menu) => (
                <li key={menu.path}>
                  {menu.children ? (
                    <div>
                      <button
                        onClick={() => toggleSubmenu(menu.path)}
                        className={`w-full flex items-center gap-3 py-2.5 px-3 rounded-xl transition-all duration-200 ${
                          isPathActive(menu.path)
                            ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white shadow-lg'
                            : 'text-blue-100 hover:bg-white/10'
                        }`}
                      >
                        <div className={isCollapsed ? 'mx-auto' : ''}>
                          {menu.icon}
                        </div>
                        {!isCollapsed && (
                          <>
                            <span className="flex-1 text-left font-medium">{menu.label}</span>
                            {expandedMenus.includes(menu.path) ? (
                              <ChevronDown size={16} />
                            ) : (
                              <ChevronRight size={16} />
                            )}
                          </>
                        )}
                      </button>
                      
                      {!isCollapsed && expandedMenus.includes(menu.path) && (
                        <ul className="ml-6 mt-1 space-y-1 border-l-2 border-purple-400/30 pl-4">
                          {getVisibleChildren(menu).map((child) => (
                            <li key={child.path}>
                              <Link
                                href={getMenuUrl(child.path)}
                                className={`block py-2 px-3 rounded-lg text-sm transition-all duration-200 ${
                                  currentPath === child.path
                                    ? 'bg-purple-500/20 text-white font-medium'
                                    : 'text-blue-200 hover:bg-white/5 hover:text-white'
                                }`}
                                onClick={() => setIsMobileMenuOpen(false)}
                              >
                                {child.label}
                              </Link>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  ) : (
                    <Link
                      href={getMenuUrl(menu.path)}
                      className={`flex items-center gap-3 py-2.5 px-3 rounded-xl transition-all duration-200 ${
                        isPathActive(menu.path)
                          ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white shadow-lg'
                          : 'text-blue-100 hover:bg-white/10'
                      }`}
                      onClick={() => setIsMobileMenuOpen(false)}
                    >
                      <div className={isCollapsed ? 'mx-auto' : ''}>
                        {menu.icon}
                      </div>
                      {!isCollapsed && (
                        <span className="font-medium">{menu.label}</span>
                      )}
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          </div>

          {/* Collapse Button */}
          <button
            onClick={toggleCollapse}
            className="hidden md:flex items-center justify-center gap-2 mt-4 p-3 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-all duration-200 border-t border-white/10 pt-4"
          >
            {isCollapsed ? (
              <ChevronRight size={20} />
            ) : (
              <>
                <ChevronLeft size={20} />
                <span className="text-sm font-medium">收起</span>
              </>
            )}
          </button>
        </div>
      </nav>

      {/* Custom Scrollbar Styles */}
      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: rgba(255, 255, 255, 0.05);
          border-radius: 100px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.2);
          border-radius: 100px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(255, 255, 255, 0.3);
        }
      `}</style>
    </>
  );
}
