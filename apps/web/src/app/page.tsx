"use client";

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useUser } from '@/context/UserContext';
import { getLastTenantId } from '@/utils/tenantUrl';
import { Button } from '@/components/ui/Button';
import { 
  CheckCircle2, 
  ArrowRight, 
  Globe2, 
  ShieldCheck, 
  Zap, 
  Layout, 
  Database,
  Users
} from 'lucide-react';

export default function LandingPage() {
  const router = useRouter();
  const { user, isLoading } = useUser();

  const handleDashboardClick = () => {
    const lastTenantId = getLastTenantId();
    if (lastTenantId) {
      router.push(`/${lastTenantId}/hubspot`);
    } else {
      router.push('/settings/tenants');
    }
  };

  return (
    <div className="min-h-screen bg-white">
      {/* Navigation */}
      <nav className="border-b border-gray-100 bg-white/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold text-xl">
                E
              </div>
              <span className="text-xl font-bold text-gray-900">eTrunk 智汇云</span>
            </div>
            
            <div className="hidden md:flex items-center gap-8">
              <Link href="#features" className="text-gray-600 hover:text-blue-600 transition-colors">特性</Link>
              <Link href="#solutions" className="text-gray-600 hover:text-blue-600 transition-colors">解决方案</Link>
              <Link href="#pricing" className="text-gray-600 hover:text-blue-600 transition-colors">价格</Link>
            </div>

            <div className="flex items-center gap-4">
              {!isLoading && user ? (
                <Button onClick={handleDashboardClick}>
                  进入控制台 <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              ) : (
                <>
                  <Link href="/login" className="text-gray-600 hover:text-gray-900 font-medium hidden sm:block">
                    登录
                  </Link>
                  <Button onClick={() => router.push('/register')}>
                    免费试用
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative overflow-hidden pt-20 pb-28 bg-gradient-to-b from-blue-50 to-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center relative z-10">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-blue-100 text-blue-700 text-sm font-medium mb-8">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
            </span>
            全新 HubSpot 集成上线
          </div>
          
          <h1 className="text-5xl md:text-7xl font-extrabold text-gray-900 tracking-tight mb-8">
          数据无缝同步 <br/>
          </h1>
          
          <p className="text-xl text-gray-600 max-w-2xl mx-auto mb-10 leading-relaxed">
          打破数据孤岛，全链路业务协同企业级 HubSpot 整合方案，实现联系人、公司数据与 Line 消息双向实时同步，让数据为业务增长赋能。
          </p>
          
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Button size="lg" className="w-full sm:w-auto text-lg h-12 px-8" onClick={() => router.push('/register')}>
              立即开始免费试用
            </Button>
            <Button size="lg" variant="secondary" className="w-full sm:w-auto text-lg h-12 px-8" onClick={() => document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' })}>
              了解更多
            </Button>
          </div>
        </div>
        
        {/* Decorative elements */}
        <div className="absolute top-0 left-0 w-full h-full overflow-hidden -z-10 opacity-30">
          <div className="absolute -top-[30%] -left-[10%] w-[700px] h-[700px] bg-purple-200 rounded-full blur-3xl mix-blend-multiply filter animate-blob"></div>
          <div className="absolute -top-[30%] -right-[10%] w-[700px] h-[700px] bg-blue-200 rounded-full blur-3xl mix-blend-multiply filter animate-blob animation-delay-2000"></div>
        </div>
      </section>

      {/* Features Grid */}
      <section id="features" className="py-24 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-20">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">为什么选择我们？</h2>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              不仅仅是数据同步，我们提供全方位的企业级解决方案，满足您对性能、安全和可扩展性的苛刻要求。
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <FeatureCard 
              icon={<Layout className="h-8 w-8 text-blue-600" />}
              title="多租户架构"
              description="原生支持多租户数据隔离。为您的每个客户提供独立的数据空间，互不干扰，安全无忧。"
            />
            <FeatureCard 
              icon={<Zap className="h-8 w-8 text-orange-500" />}
              title="实时双向同步"
              description="告别数据延迟。HubSpot 中的变更会立即反映在您的系统中，反之亦然，保持数据的一致性。"
            />
            <FeatureCard 
              icon={<ShieldCheck className="h-8 w-8 text-green-600" />}
              title="企业级安全"
              description="基于 OAuth 2.0 的安全认证，AES 加密存储敏感配置。我们像保护自己的数据一样保护您的数据。"
            />
            <FeatureCard 
              icon={<Database className="h-8 w-8 text-purple-600" />}
              title="高性能存储"
              description="基于 Prisma 和 PostgreSQL 优化。支持海量数据的快速读写，轻松应对百万级联系人管理。"
            />
            <FeatureCard 
              icon={<Globe2 className="h-8 w-8 text-cyan-600" />}
              title="LINE 生态集成"
              description="独家支持 LINE 账号绑定。将 HubSpot CRM 与 LINE 社交生态打通，挖掘私域流量价值。"
            />
            <FeatureCard 
              icon={<Users className="h-8 w-8 text-pink-600" />}
              title="团队协作"
              description="细粒度的权限控制。让销售、市场和客服团队在同一个平台上高效协作，共享客户视图。"
            />
          </div>
        </div>
      </section>

      {/* Solutions / Stats Section */}
      <section id="solutions" className="py-24 bg-gray-900 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="text-3xl md:text-4xl font-bold mb-6">值得信赖的数据处理能力</h2>
              <p className="text-gray-400 text-lg mb-8 leading-relaxed">
                我们的平台每天处理数以万计的 API 请求，确保您的业务永不停歇。无论是初创公司还是大型企业，我们都能提供稳定的支持。
              </p>
              <ul className="space-y-4">
                {[
                  '99.9% 系统可用性',
                  '毫秒级 API 响应速度',
                  '自动化的错误重试机制',
                  '全天候监控与告警'
                ].map((item, i) => (
                  <li key={i} className="flex items-center gap-3">
                    <CheckCircle2 className="h-5 w-5 text-blue-400" />
                    <span className="text-gray-200">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="grid grid-cols-2 gap-6">
              <StatCard number="100+" label="支持的 API 端点" />
              <StatCard number="5000+" label="日均同步记录" />
              <StatCard number="10+" label="服务企业租户" />
              <StatCard number="24/7" label="全天候支持" />
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-50 border-t border-gray-200 py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
            <div className="col-span-1 md:col-span-2">
              <h3 className="text-xl font-bold text-gray-900 mb-4">eTrunk 智汇云</h3>
              <p className="text-gray-500 max-w-xs">
                企业数据流转的智能桥梁，连接 HubSpot 与全业务链条，降本又增效。
              </p>
            </div>
            <div>
              <h4 className="font-bold text-gray-900 mb-4">产品</h4>
              <ul className="space-y-2 text-gray-600">
                <li><Link href="#" className="hover:text-blue-600">HubSpot 集成</Link></li>
                <li><Link href="#" className="hover:text-blue-600">LINE 集成</Link></li>
                <li><Link href="#" className="hover:text-blue-600">API 文档</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="font-bold text-gray-900 mb-4">公司</h4>
              <ul className="space-y-2 text-gray-600">
                <li><Link href="#" className="hover:text-blue-600">关于我们</Link></li>
                <li><Link href="#" className="hover:text-blue-600">联系支持</Link></li>
                <li><Link href="#" className="hover:text-blue-600">隐私政策</Link></li>
              </ul>
            </div>
          </div>
          <div className="pt-8 border-t border-gray-200 text-center text-gray-500 text-sm">
            &copy; {new Date().getFullYear()} eTrunk Group. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
}

function FeatureCard({ icon, title, description }: { icon: React.ReactNode, title: string, description: string }) {
  return (
    <div className="p-8 rounded-2xl bg-gray-50 hover:bg-white border border-gray-100 hover:border-blue-100 hover:shadow-xl transition-all duration-300 group">
      <div className="mb-6 p-3 bg-white rounded-lg inline-block shadow-sm group-hover:scale-110 transition-transform">
        {icon}
      </div>
      <h3 className="text-xl font-bold text-gray-900 mb-3">{title}</h3>
      <p className="text-gray-600 leading-relaxed">{description}</p>
    </div>
  );
}

function StatCard({ number, label }: { number: string, label: string }) {
  return (
    <div className="p-6 bg-gray-800 rounded-xl text-center border border-gray-700">
      <div className="text-3xl font-bold text-white mb-2">{number}</div>
      <div className="text-sm text-gray-400">{label}</div>
    </div>
  );
}