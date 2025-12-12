'use client';
import './globals.css';
import { UserProvider, useUser } from '@/context/UserContext';
import { TenantProvider } from '@/context/TenantContext';
import Toolbar from '../components/Toolbar';
import Navbar from '@/components/Navbar';
import { useState } from 'react';

// 布局包装器（用于获取用户状态）
const LayoutContent = ({ children }: { children: React.ReactNode }) => {
  const { user } = useUser(); // 获取用户状态
  const [isNavbarCollapsed, setIsNavbarCollapsed] = useState(false);

  return (
    <div className="flex flex-1 overflow-hidden min-h-screen pt-16">
      {/* 传递用户状态给 Navbar（用户不存在时不渲染） */}
      <Navbar 
        onCollapseChange={setIsNavbarCollapsed} 
        user={user}
      />

      {/* 主内容区：移动端无左边距，桌面端根据侧边栏状态调整 */}
      <main className={`
        flex-1 overflow-auto p-4 transition-all duration-300
        ml-0
        ${!user ? 'md:ml-0' : isNavbarCollapsed ? 'md:ml-20' : 'md:ml-64'}
      `}>
        {children}
      </main>
    </div>
  );
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body className={`relative`}>
        <UserProvider>
          <TenantProvider>
            <Toolbar />
            {/* 渲染布局内容（包含侧边栏和主内容区） */}
            <LayoutContent>{children}</LayoutContent>
          </TenantProvider>
        </UserProvider>
      </body>
    </html>
  );
}