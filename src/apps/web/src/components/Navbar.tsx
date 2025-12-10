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
} from 'lucide-react';
import { UserInfo } from '@/types';

// 菜单项类型定义
interface MenuItem {
  label: string;
  path: string;
  icon?: React.ReactNode;
  children?: MenuItem[];
  requiredPermission?: string;
}

// 菜单配置
const menuConfig: MenuItem[] = [
  {
    label: 'Reports',
    path: '/reports',
    icon: <BarChart size={18} />,
  },
  {
    label: 'HubSpot',
    path: '/hubspot',
    icon: <Briefcase size={18} />,
    children: [
      { label: '联系人', path: '/hubspot/contacts' },
      { label: 'LINE 聊天', path: '/hubspot/line-chat' },
    ],
  },
  {
    label: '订阅管理',
    path: '/subscription',
    icon: <CreditCard size={18} />,
  },
  {
    label: '设置',
    path: '/settings',
    icon: <Settings size={18} />,
    children: [
      { label: '个人资料', path: '/settings/profile' },
      { label: '安全设置', path: '/settings/security' },
      { label: '租户管理', path: '/settings/tenants' },
    ],
  },
  {
    label: '系统管理',
    path: '/system',
    icon: <Shield size={18} />,
    children: [
      { label: '用户管理', path: '/system/accounts', requiredPermission: 'user:read' },
      { label: '租户管理', path: '/system/tenants', requiredPermission: 'tenant:read' },
      { label: '角色管理', path: '/system/roles', requiredPermission: 'role:read' },
      { label: '审计日志', path: '/system/audit-logs', requiredPermission: 'audit:read' },
      { label: '紧急访问', path: '/system/emergency-access', requiredPermission: 'emergency:request' },
    ],
  },
];

// Props
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

  // 折叠状态变化时通知父布局
  useEffect(() => {
    onCollapseChange(isCollapsed);
  }, [isCollapsed, onCollapseChange]);

  // 点击页面其他区域关闭移动端菜单
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

  // 自动展开当前路径对应的父菜单
  useEffect(() => {
    menuConfig.forEach((menu) => {
      if (menu.children?.some((child) => currentPath?.startsWith(child.path))) {
        setExpandedMenus((prev) => 
          prev.includes(menu.path) ? prev : [...prev, menu.path]
        );
      }
    });
  }, [currentPath]);

  // 切换折叠状态
  const toggleCollapse = () => {
    setIsCollapsed(!isCollapsed);
  };

  // 切换子菜单展开/收起
  const toggleSubmenu = (path: string) => {
    setExpandedMenus((prev) =>
      prev.includes(path)
        ? prev.filter((p) => p !== path)
        : [...prev, path]
    );
  };

  // 检查单个菜单项是否有权限
  // manage 权限自动包含同资源的 read/create/update/delete 权限
  const hasPermission = (menu: MenuItem): boolean => {
    if (!menu.requiredPermission) return true;
    const permissions = user.permissions ?? [];
    
    // 直接匹配
    if (permissions.includes(menu.requiredPermission)) return true;
    
    // 检查是否有对应的 manage 权限
    const [resource, action] = menu.requiredPermission.split(':');
    if (action && action !== 'manage') {
      const managePermission = `${resource}:manage`;
      if (permissions.includes(managePermission)) return true;
    }
    
    return false;
  };

  // 检查菜单是否应该显示（权限控制）
  const shouldShowMenu = (menu: MenuItem): boolean => {
    // 如果有子菜单，检查是否有任何子菜单有权限
    if (menu.children && menu.children.length > 0) {
      return menu.children.some(hasPermission);
    }
    // 无子菜单，检查自身权限
    return hasPermission(menu);
  };

  // 过滤有权限的子菜单
  const getVisibleChildren = (menu: MenuItem): MenuItem[] => {
    if (!menu.children) return [];
    return menu.children.filter(hasPermission);
  };

  // 检查路径是否激活
  const isPathActive = (path: string): boolean => {
    return currentPath?.startsWith(path) ?? false;
  };

  if (!user) return null;

  // 过滤有权限的菜单
  const visibleMenus = menuConfig.filter(shouldShowMenu);

  return (
    <div className="h-full bg-white border-r border-gray-200 transition-all duration-300 flex flex-col">
      {/* 移动端菜单触发按钮 */}
      <button
        onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
        className="md:hidden fixed top-4 right-4 z-50 p-2 bg-white shadow-md rounded"
      >
        {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
      </button>

      {/* 侧边栏容器 */}
      <nav
        ref={navRef}
        className={`
          ${isMobileMenuOpen ? 'fixed inset-0 z-40 bg-white p-4' : 'hidden md:flex md:flex-col'}
          md:fixed md:top-0 md:left-0 md:h-screen md:p-4 md:bg-gray-50 md:border-r
          transition-all duration-300
          ${isCollapsed ? 'md:w-16' : 'md:w-56'}
        `}
      >
        <div className="mb-6">
          {!isCollapsed && (
            <h1 className="text-xl font-bold flex items-center gap-2">
              <span className="text-blue-600">HubSpot</span>
            </h1>
          )}
        </div>

        <ul className="space-y-1 flex-1 overflow-y-auto">
          {visibleMenus.map((menu) => (
            <li key={menu.path}>
              {menu.children ? (
                // 有子菜单的父菜单项
                <div>
                  <button
                    onClick={() => toggleSubmenu(menu.path)}
                    className={`w-full flex items-center gap-3 py-2 px-3 rounded transition-colors ${
                      isPathActive(menu.path) 
                        ? 'bg-blue-50 text-blue-700' 
                        : 'hover:bg-gray-200 text-gray-700'
                    }`}
                  >
                    {menu.icon}
                    {!isCollapsed && (
                      <>
                        <span className="flex-1 text-left">{menu.label}</span>
                        {expandedMenus.includes(menu.path) ? (
                          <ChevronDown size={16} />
                        ) : (
                          <ChevronRight size={16} />
                        )}
                      </>
                    )}
                  </button>
                  
                  {/* 子菜单 */}
                  {!isCollapsed && expandedMenus.includes(menu.path) && (
                    <ul className="ml-6 mt-1 space-y-1 border-l border-gray-200 pl-3">
                      {getVisibleChildren(menu).map((child) => (
                        <li key={child.path}>
                          <Link
                            href={child.path}
                            className={`block py-1.5 px-2 rounded text-sm transition-colors ${
                              currentPath === child.path
                                ? 'bg-blue-100 text-blue-700 font-medium'
                                : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
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
                // 无子菜单的菜单项
                <Link
                  href={menu.path}
                  className={`flex items-center gap-3 py-2 px-3 rounded transition-colors ${
                    isPathActive(menu.path) 
                      ? 'bg-blue-100 text-blue-700' 
                      : 'hover:bg-gray-200 text-gray-700'
                  }`}
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  {menu.icon}
                  {!isCollapsed && <span>{menu.label}</span>}
                </Link>
              )}
            </li>
          ))}
        </ul>

        {/* 折叠按钮 */}
        <button
          onClick={toggleCollapse}
          className="mt-4 p-2 w-full flex items-center justify-center rounded hover:bg-gray-200 border-t pt-4"
        >
          {isCollapsed ? <ChevronRight size={20} /> : <ChevronDown size={20} />}
        </button>
      </nav>
    </div>
  );
}
