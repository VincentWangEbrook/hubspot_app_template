// 移除 'use client' 标记，默认是 Server Component
import { Card, CardContent, CardHeader, CardTitle } from '@/src/components/ui/Card';
import { Button } from '@/src/components/ui/Button'; // 确保导入路径大小写正确

// 定义数据类型
interface DashboardData {
  totalUsers: number;
  totalOrders: number;
  revenue: number;
  recentActivities: Array<{ id: string; action: string; time: string }>;
}

// 组件直接设为 async（Server Component 支持）
export default async function DashboardPage() {
  // 直接在组件顶部用 async/await 获取数据（服务端执行）
  const fetchDashboardData = async (): Promise<DashboardData> => {
    // 服务端组件 fetch 默认是服务器端请求，无需 CORS
    const response = await fetch('https://your-api.com/dashboard', {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      // 可选：缓存策略（Next.js 13+ 特性）
      next: { revalidate: 60 }, // 60 秒重新验证数据
    });

    if (!response.ok) throw new Error('数据获取失败');
    return response.json();
  };

  // 执行异步请求（服务端渲染时完成）
  const data = await fetchDashboardData();

  return (
    <div className="space-y-6 py-8">
      <h1 className="text-2xl font-bold text-gray-900">仪表盘</h1>

      {/* 统计卡片 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">总用户数</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold">{data.totalUsers}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">总订单数</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold">{data.totalOrders}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">总收入</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold">¥{data.revenue.toLocaleString()}</p>
          </CardContent>
        </Card>
      </div>

      {/* 最近活动 */}
      <Card>
        <CardHeader>
          <CardTitle>最近活动</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {data.recentActivities.map((activity) => (
              <div key={activity.id} className="flex justify-between items-center border-b pb-2">
                <span>{activity.action}</span>
                <span className="text-sm text-gray-500">{activity.time}</span>
              </div>
            ))}
          </div>
          <Button className="mt-4 bg-blue-600 hover:bg-blue-700">查看全部</Button>
        </CardContent>
      </Card>
    </div>
  );
}