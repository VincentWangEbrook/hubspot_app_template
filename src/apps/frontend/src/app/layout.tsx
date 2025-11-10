import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { Inter } from 'next/font/google';
import './globals.css';
import { UserProvider } from '@/context/UserContext';
import Navbar from '../components/Navbar';
import Sidebar from '@/components/Sidebar';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: '系统管理平台',
  description: 'HubSpot 账户集成管理',
};

// 模拟用户角色（实际项目从 cookie/数据库获取，如 JWT 解析）
interface RootLayoutProps {
  children: React.ReactNode;
  // 实际项目：通过中间件/接口获取用户角色，这里简化为 props
  userRole?: 'admin' | 'user';
}

export default function RootLayout({
  children, 
  userRole = 'user'
}: RootLayoutProps) {

  return (
    <html lang="zh-CN">
      <body className={`${inter.className} min-h-screen`}>
      <UserProvider> {/* 包裹全局状态 */}
          {/* 全局导航栏（传递用户角色） */}
          <Navbar userRole={userRole} />
          <div className="flex flex-1 overflow-hidden">
            <Sidebar />
            {/* 页面内容（仪表盘/设置/系统管理） */}
            <main className="flex-1 overflow-auto p-4 transition-all duration-300 ml-16 md:ml-64">
              {children}
            </main>
          </div>
        </UserProvider>
      </body>
    </html>
  );
}