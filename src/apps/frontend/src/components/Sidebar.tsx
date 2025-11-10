'use client';
import Link from 'next/link';
import { useState, useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { Home, Settings, PieChart, BarChart, Users, FileText, ChevronDown, ChevronRight, Menu, X } from 'lucide-react';

// 菜单配置
const menuConfig = [
  {
    label: 'Dashboard',
    path: '/dashboard',
    icon: <Home size={18} />,
    isParent: false,
  },
  {
    label: 'Analytics',
    path: '/analytics',
    icon: <PieChart size={18} />,
    isParent: false,
  },
  {
    label: 'Reports',
    path: '/reports',
    icon: <BarChart size={18} />,
    isParent: false,
  },
  {
    label: 'Users',
    path: '/users',
    icon: <Users size={18} />,
    isParent: false,
  },
  {
    label: 'Content',
    path: '/content',
    icon: <FileText size={18} />,
    isParent: false,
  },
  {
    label: 'Settings',
    path: '/settings',
    icon: <Settings size={18} />,
    isParent: false,
  },
];

export default function Sidebar() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const currentPath = usePathname();
  const navRef = useRef<HTMLDivElement>(null);

  // 点击页面其他区域关闭移动端菜单
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (navRef.current && !navRef.current.contains(e.target as Node)) {
        setIsMobileMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // 切换折叠状态
  const toggleCollapse = () => {
    setIsCollapsed(!isCollapsed);
  };

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
          ${isMobileMenuOpen ? 'fixed inset-0 z-40 bg-white p-4' : 'hidden md:block'}
          md:fixed md:top-0 md:left-0 md:h-screen ${isCollapsed ? 'md:w-16' : 'md:w-64'} md:p-4 md:bg-gray-50 md:border-r
          transition-all duration-300
        `}
      >
        <div className="mb-6">
          {!isCollapsed && (
            <h1 className="text-xl font-bold flex items-center gap-2">
              <span className="text-blue-600">HubSpot</span>
            </h1>
          )}
        </div>

        <ul className="space-y-2">
          {menuConfig.map((menu) => (
            <li key={menu.path}>
              <Link
                href={menu.path}
                className={`flex items-center gap-3 py-2 px-3 rounded transition-colors ${
                  currentPath === menu.path ? 'bg-blue-100 text-blue-700' : 'hover:bg-gray-200'
                }`}
                onClick={() => setIsMobileMenuOpen(false)}
              >
                {menu.icon}
                {!isCollapsed && <span>{menu.label}</span>}
              </Link>
            </li>
          ))}
        </ul>

        {/* 折叠按钮（固定在侧边栏底部） */}
        <button
          onClick={toggleCollapse}
          className="mt-auto p-2 w-full flex items-center justify-center rounded hover:bg-gray-200"
        >
          {isCollapsed ? <ChevronRight /> : <ChevronDown />}
        </button>
      </nav>
    </div>
  );
}