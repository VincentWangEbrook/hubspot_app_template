'use client';
import React, { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useUser } from '@/context/UserContext';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, LineChart, Line
} from 'recharts';
import {
  Users, FileText, DollarSign, Activity, AlertCircle,
  CheckCircle, RefreshCw, Menu, X
} from 'lucide-react';
import { UserInfo } from '@/types';

// ========================= 类型定义 =========================
interface StatCardData {
  title: string;
  value: number;
  change?: number;
  icon: React.ReactNode;
  color: string;
  suffix?: string;
}

interface RecentActivity {
  id: string;
  user: string;
  action: string;
  time: string;
  status: 'success' | 'warning' | 'info';
}

interface SalesData {
  name: string;
  value: number;
}

interface TrafficData {
  date: string;
  pv: number;
  uv: number;
}

interface OrderData {
  month: string;
  completed: number;
  pending: number;
  cancelled: number;
}

interface MockApiResponse {
  success: boolean;
  message?: string;
  data?: {
    stats: StatCardData[];
    recentActivities: RecentActivity[];
    salesDistribution: SalesData[];
    trafficTrend: TrafficData[];
    orderSummary: OrderData[];
  };
}

// ========================= 主组件 =========================
export default function DashboardPage() {
  const { user } = useUser();
  const router = useRouter();

  // 状态管理
  const [dashboardData, setDashboardData] = useState<{
    stats: StatCardData[];
    recentActivities: RecentActivity[];
    salesDistribution: SalesData[];
    trafficTrend: TrafficData[];
    orderSummary: OrderData[];
  } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTenantId, setActiveTenantId] = useState<string | null>(null);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);


  const PIE_COLORS = useMemo(() => [
    '#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899'
  ], []);

  // ========================= 模拟数据函数 =========================
  const fetchMockDashboardData = async (tenantId: string): Promise<{
    stats: StatCardData[];
    recentActivities: RecentActivity[];
    salesDistribution: SalesData[];
    trafficTrend: TrafficData[];
    orderSummary: OrderData[];
  }> => {
    await new Promise(resolve => setTimeout(resolve, 600));
    if (tenantId === 'tenant_prod') {
      return {
        stats: [
          { title: '总用户数', value: 12846, change: 12.5, icon: <Users size={20} />, color: 'bg-blue-600', suffix: '人' },
          { title: '今日订单', value: 328, change: 8.2, icon: <FileText size={20} />, color: 'bg-green-600', suffix: '单' },
          { title: '本月营收', value: 1568900, change: 15.7, icon: <DollarSign size={20} />, color: 'bg-amber-600', suffix: '元' },
          { title: '转化率', value: 23.8, change: -2.1, icon: <Activity size={20} />, color: 'bg-purple-600', suffix: '%' }
        ],
        recentActivities: [
          { id: '1', user: '张三', action: '创建了新订单 #2025001', time: '10分钟前', status: 'success' },
          { id: '2', user: '李四', action: '修改了产品价格', time: '30分钟前', status: 'info' },
          { id: '3', user: '王五', action: '删除了过期优惠券', time: '1小时前', status: 'warning' }
        ],
        salesDistribution: [
          { name: '电子产品', value: 4500 },
          { name: '服装鞋帽', value: 2300 },
          { name: '家居用品', value: 1800 },
          { name: '食品饮料', value: 1200 }
        ],
        trafficTrend: [
          { date: '10/30', pv: 12000, uv: 8500 },
          { date: '10/31', pv: 13500, uv: 9200 },
          { date: '11/01', pv: 15200, uv: 10800 },
          { date: '11/02', pv: 14800, uv: 10300 },
          { date: '11/03', pv: 16500, uv: 11500 },
          { date: '11/04', pv: 17200, uv: 12100 },
          { date: '11/05', pv: 18500, uv: 13200 }
        ],
        orderSummary: [
          { month: '6月', completed: 1200, pending: 320, cancelled: 80 },
          { month: '7月', completed: 1350, pending: 380, cancelled: 95 },
          { month: '8月', completed: 1520, pending: 420, cancelled: 110 },
          { month: '9月', completed: 1680, pending: 450, cancelled: 105 },
          { month: '10月', completed: 1850, pending: 510, cancelled: 120 },
          { month: '11月', completed: 2100, pending: 580, cancelled: 135 }
        ]
      };
    } else if (tenantId === 'tenant_test') {
      return {
        stats: [
          { title: '总用户数', value: 286, change: 35.2, icon: <Users size={20} />, color: 'bg-blue-600', suffix: '人' },
          { title: '今日订单', value: 18, change: 22.5, icon: <FileText size={20} />, color: 'bg-green-600', suffix: '单' },
          { title: '本月营收', value: 28500, change: 42.8, icon: <DollarSign size={20} />, color: 'bg-amber-600', suffix: '元' },
          { title: '转化率', value: 18.3, change: 5.7, icon: <Activity size={20} />, color: 'bg-purple-600', suffix: '%' }
        ],
        recentActivities: [
          { id: '1', user: '测试账号1', action: '创建了测试订单 #T2025001', time: '5分钟前', status: 'success' },
          { id: '2', user: '测试账号2', action: '测试产品发布功能', time: '20分钟前', status: 'info' }
        ],
        salesDistribution: [
          { name: '测试产品A', value: 120 },
          { name: '测试产品B', value: 80 },
          { name: '测试产品C', value: 50 }
        ],
        trafficTrend: [
          { date: '10/30', pv: 800, uv: 520 },
          { date: '10/31', pv: 950, uv: 630 },
          { date: '11/01', pv: 1200, uv: 780 },
          { date: '11/02', pv: 1100, uv: 720 },
          { date: '11/03', pv: 1350, uv: 850 },
          { date: '11/04', pv: 1500, uv: 920 },
          { date: '11/05', pv: 1680, uv: 1050 }
        ],
        orderSummary: [
          { month: '6月', completed: 45, pending: 12, cancelled: 3 },
          { month: '7月', completed: 58, pending: 15, cancelled: 4 },
          { month: '8月', completed: 72, pending: 18, cancelled: 5 },
          { month: '9月', completed: 85, pending: 22, cancelled: 6 },
          { month: '10月', completed: 102, pending: 28, cancelled: 7 },
          { month: '11月', completed: 125, pending: 35, cancelled: 8 }
        ]
      };
    } else {
      return {
        stats: [
          { title: '总用户数', value: 42, change: 100, icon: <Users size={20} />, color: 'bg-blue-600', suffix: '人' },
          { title: '今日订单', value: 5, change: 150, icon: <FileText size={20} />, color: 'bg-green-600', suffix: '单' },
          { title: '本月营收', value: 8600, change: 200, icon: <DollarSign size={20} />, color: 'bg-amber-600', suffix: '元' },
          { title: '转化率', value: 32.5, change: 50, icon: <Activity size={20} />, color: 'bg-purple-600', suffix: '%' }
        ],
        recentActivities: [
          { id: '1', user: '开发人员1', action: '测试登录功能', time: '10分钟前', status: 'success' },
          { id: '2', user: '开发人员2', action: '调试订单接口', time: '30分钟前', status: 'info' }
        ],
        salesDistribution: [
          { name: '测试产品1', value: 3 },
          { name: '测试产品2', value: 1 },
          { name: '测试产品3', value: 1 }
        ],
        trafficTrend: [
          { date: '10/30', pv: 120, uv: 45 },
          { date: '10/31', pv: 150, uv: 58 },
          { date: '11/01', pv: 180, uv: 65 },
          { date: '11/02', pv: 220, uv: 72 },
          { date: '11/03', pv: 250, uv: 80 },
          { date: '11/04', pv: 280, uv: 85 },
          { date: '11/05', pv: 320, uv: 92 }
        ],
        orderSummary: [
          { month: '6月', completed: 2, pending: 1, cancelled: 0 },
          { month: '7月', completed: 3, pending: 1, cancelled: 0 },
          { month: '8月', completed: 4, pending: 2, cancelled: 1 },
          { month: '9月', completed: 3, pending: 1, cancelled: 0 },
          { month: '10月', completed: 4, pending: 2, cancelled: 1 },
          { month: '11月', completed: 5, pending: 2, cancelled: 1 }
        ]
      };
    }
  };

  // ========================= 关键修复：直接定义 apiFetch 函数 =========================
  const apiFetch = async (url: string, options?: any): Promise<MockApiResponse> => {
    if (url.includes('/dashboard/data')) {
      // 注意：你之前用了 options.params，但实际调用时没传 params（用的 URL 拼接），这里调整为从 URL 解析 tenantId
      const urlObj = new URL(url, window.location.origin);
      const tenantId = urlObj.searchParams.get('tenantId') || 'tenant_test'; // 从 URL 参数获取 tenantId
      const data = await fetchMockDashboardData(tenantId);
      return { success: true, data };
    }
    return { success: false, message: '接口未找到' };
  };

  // ========================= 数据加载函数 =========================
  const fetchDashboardData = async (tenantId: string) => {
    setIsLoading(true);
    setError(null);
    try {
      // 现在可以直接调用 apiFetch，TS 能识别
      const res = await apiFetch(`/dashboard/data?tenantId=${encodeURIComponent(tenantId)}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('jwt')}` }
      });

      if (res.success && res.data) {
        setDashboardData(res.data);
      } else {
        setError(res.message || '加载仪表盘数据失败');
      }
    } catch (err) {
      console.error('仪表盘数据加载异常:', err);
      setError('网络异常，无法加载数据，请稍后重试');
    } finally {
      setIsLoading(false);
    }
  };

  // ========================= 初始化逻辑 =========================
  useEffect(() => {
    if (!isLoading && !user) {
      router.push('/login');
      return;
    }

    const storedTenantId = localStorage.getItem('activeTenantId');
    if (storedTenantId) {
      setActiveTenantId(storedTenantId);
    } else {
      const defaultTenantId = 'tenant_test';
      localStorage.setItem('activeTenantId', defaultTenantId);
      setActiveTenantId(defaultTenantId);
    }

    const handleTenantChange = () => {
      const newTenantId = localStorage.getItem('activeTenantId');
      if (newTenantId && newTenantId !== activeTenantId) {
        setActiveTenantId(newTenantId);
        fetchDashboardData(newTenantId);
      }
    };

    window.addEventListener('tenant:changed', handleTenantChange);
    return () => window.removeEventListener('tenant:changed', handleTenantChange);
  }, [user, router, activeTenantId]);

  useEffect(() => {
    if (activeTenantId && user) {
      fetchDashboardData(activeTenantId);
    }
  }, [activeTenantId, user]);

  // ========================= 工具函数 =========================
  const handleRefresh = () => {
    if (activeTenantId) {
      fetchDashboardData(activeTenantId);
    }
  };

  // ========================= 状态渲染 =========================
  if (isLoading) {
    return (
      <div className="min-h-screen pt-16 bg-gray-50 dark:bg-gray-900 flex flex-col items-center justify-center">
        <RefreshCw size={40} className="text-blue-600 animate-spin mb-4" />
        <p className="text-gray-600 dark:text-gray-300 text-lg">加载仪表盘数据中...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen pt-16 bg-gray-50 dark:bg-gray-900 p-6">
        <div className="max-w-7xl mx-auto bg-white dark:bg-gray-800 rounded-xl shadow-md p-6 border border-red-100 dark:border-red-900/30">
          <div className="flex items-center space-x-3 text-red-600 dark:text-red-400 mb-4">
            <AlertCircle size={24} />
            <h2 className="text-xl font-bold">数据加载失败</h2>
          </div>
          <p className="text-gray-700 dark:text-gray-300 mb-6">{error}</p>
          <button
            onClick={handleRefresh}
            className="flex items-center space-x-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
          >
            <RefreshCw size={16} />
            <span>重试加载</span>
          </button>
        </div>
      </div>
    );
  }

  if (!dashboardData) {
    return (
      <div className="min-h-screen pt-16 bg-gray-50 dark:bg-gray-900 p-6">
        <div className="max-w-7xl mx-auto bg-white dark:bg-gray-800 rounded-xl shadow-md p-8 text-center">
          <FileText size={48} className="text-gray-300 dark:text-gray-600 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-gray-700 dark:text-gray-300 mb-2">暂无仪表盘数据</h2>
          <p className="text-gray-500 dark:text-gray-400 mb-6">当前租户暂无相关业务数据，请切换租户或添加数据后重试</p>
          <button
            onClick={handleRefresh}
            className="px-4 py-2 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg transition-colors"
          >
            刷新数据
          </button>
        </div>
      </div>
    );
  }

  const { stats, recentActivities, salesDistribution, trafficTrend, orderSummary } = dashboardData;

  // ========================= 页面渲染 =========================
  return (
    <div className="min-h-screen pt-16 bg-gray-50 dark:bg-gray-900">
      {/* 顶部导航栏 */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 sm:px-6 lg:px-8 py-4">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">仪表盘</h1>
            <p className="text-gray-500 dark:text-gray-400 mt-1">
              欢迎回来，{user?.username} · 当前租户：
              {activeTenantId === 'tenant_dev' ? '研发环境' : 
               activeTenantId === 'tenant_prod' ? '生产环境' : 
               activeTenantId === 'tenant_test' ? '测试环境' : '默认环境'}
            </p>
          </div>
          <div className="flex items-center space-x-4">
            <button
              onClick={handleRefresh}
              className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300 transition-colors"
            >
              <RefreshCw size={20} />
            </button>
            <button
              className="sm:hidden p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300"
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            >
              {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
          </div>
        </div>
      </div>

      {/* 移动端菜单 */}
      {isMobileMenuOpen && (
        <div className="sm:hidden bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 p-4">
          <div className="flex flex-col space-y-3">
            <a href="/dashboard" className="px-3 py-2 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-lg font-medium">仪表盘</a>
            <a href="/accounts" className="px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg font-medium text-gray-700 dark:text-gray-300">账号管理</a>
            <a href="/settings" className="px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg font-medium text-gray-700 dark:text-gray-300">系统设置</a>
            <a href="/profile" className="px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg font-medium text-gray-700 dark:text-gray-300">个人资料</a>
          </div>
        </div>
      )}

      {/* 主要内容区 */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* 数据概览卡片 */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {stats.map((stat, index) => (
            <div
              key={`stat-${index}`}
              className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-6 transition-all duration-300 hover:shadow-md hover:-translate-y-1"
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-gray-500 dark:text-gray-400 text-sm font-medium">{stat.title}</h3>
                <div className={`p-2 rounded-lg ${stat.color.replace('bg-', 'bg-opacity-10 text-')}`}>
                  {stat.icon}
                </div>
              </div>
              <div className="flex items-baseline">
                <span className="text-2xl font-bold text-gray-900 dark:text-white">{stat.value}</span>
                {stat.suffix && <span className="ml-1 text-gray-500 dark:text-gray-400">{stat.suffix}</span>}
              </div>
              {stat.change !== undefined && (
                <div className={`flex items-center mt-2 text-sm ${stat.change > 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                  <span>{stat.change > 0 ? '↑' : '↓'} {Math.abs(stat.change)}%</span>
                  <span className="ml-1 text-gray-500 dark:text-gray-400">vs 上月</span>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* 图表区域 */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          <div className="lg:col-span-1 bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-6">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">销售分布</h2>
              <div className="text-sm text-gray-500 dark:text-gray-400">近30天</div>
            </div>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={salesDistribution}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    outerRadius={80}
                    dataKey="value"
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  >
                    {salesDistribution.map((entry, index) => (
                      <Cell key={`pie-cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => [`${value} 单`, '订单量']} />
                  <Legend layout="vertical" verticalAlign="bottom" align="center" />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="lg:col-span-2 bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-6">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">网站流量趋势</h2>
              <div className="text-sm text-gray-500 dark:text-gray-400">近7天</div>
            </div>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={trafficTrend} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip 
                    formatter={(value) => [`${value} 次`, '访问量']}
                    contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb' }}
                  />
                  <Legend />
                  <Line type="monotone" dataKey="pv" name="访问量(PV)" stroke="#3B82F6" activeDot={{ r: 8 }} />
                  <Line type="monotone" dataKey="uv" name="独立访客(UV)" stroke="#10B981" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* 订单统计 + 最近活动 */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-6">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">订单统计</h2>
              <div className="text-sm text-gray-500 dark:text-gray-400">近6个月</div>
            </div>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={orderSummary}
                  margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb' }} />
                  <Legend />
                  <Bar dataKey="completed" name="已完成" fill="#10B981" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="pending" name="处理中" fill="#F59E0B" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="cancelled" name="已取消" fill="#EF4444" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="lg:col-span-1 bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-6">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">最近活动</h2>
              <a 
                href="/activities" 
                className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
                target="_blank"
                rel="noopener noreferrer"
              >
                查看全部
              </a>
            </div>
            <div className="space-y-4 max-h-64 overflow-y-auto pr-2 custom-scrollbar">
              {recentActivities.map((activity) => (
                <div key={activity.id} className="flex items-start space-x-3 pb-4 border-b border-gray-100 dark:border-gray-700 last:border-0 last:pb-0">
                  <div className={`mt-0.5 p-1.5 rounded-full ${
                    activity.status === 'success' 
                      ? 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400' 
                      : activity.status === 'warning'
                        ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-600 dark:text-yellow-400'
                        : 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'
                  }`}>
                    {activity.status === 'success' ? <CheckCircle size={16} /> : <AlertCircle size={16} />}
                  </div>
                  <div className="flex-1">
                    <p className="text-gray-700 dark:text-gray-300 text-sm">
                      <span className="font-medium">{activity.user}</span> {activity.action}
                    </p>
                    <p className="text-gray-500 dark:text-gray-400 text-xs mt-1">{activity.time}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* 滚动条样式 */}
      <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: #f1f1f1;
          border-radius: 2px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #c1c1c1;
          border-radius: 2px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #a1a1a1;
        }
        .dark .custom-scrollbar::-webkit-scrollbar-track {
          background: #374151;
        }
        .dark .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #4b5563;
        }
        .dark .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #6b7280;
        }
      `}</style>
    </div>
  );
}