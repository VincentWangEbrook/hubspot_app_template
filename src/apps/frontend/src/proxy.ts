import { NextRequest, NextResponse } from 'next/server';

if (!process.env.NEXT_PUBLIC_BACKEND_URL) {
  throw new Error('NEXT_PUBLIC_BACKEND_URL 环境变量未配置');
}

// 配置常量（集中管理，便于维护）
const CONFIG = {
  PROTECTED_ROUTES: ['/dashboard', '/admin', '/settings'], // 需要登录的路由前缀
  LOGIN_PATH: '/login', // 登录页路径
  API_AUTH_CHECK: new URL('/auth/me', process.env.NEXT_PUBLIC_BACKEND_URL).toString(),
  CACHE_TTL: 30, // 鉴权结果缓存时间（秒），减少重复请求
};

export async function proxy(req: NextRequest) {
  const { pathname, origin } = req.nextUrl;

  // 公共路由直接放行（跳过鉴权，提升性能）
  if (!CONFIG.PROTECTED_ROUTES.some(route => pathname.startsWith(route))) {
    return NextResponse.next();
  }

  // 提取 Cookie（处理 Cookie 不存在的边缘情况）
  const cookie = req.headers.get('cookie');
  if (!cookie) {
    // 无 Cookie 直接重定向到登录页
    return redirectToLogin(pathname, origin);
  }

  try {
    // 调用后端鉴权接口（优化请求配置，增强稳定性）
    const res = await fetch(CONFIG.API_AUTH_CHECK, {
      method: 'GET',
      headers: {
        Cookie: cookie,
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      //cache: 'no-store', // 禁用缓存（鉴权状态需实时校验，避免缓存导致的登录状态延迟）
      next: { revalidate: CONFIG.CACHE_TTL },
    });

    // 处理后端响应异常（如 500 错误）
    if (!res.ok) {
      console.error(`鉴权接口失败：${res.status} ${res.statusText}`);
      // 后端错误时仍重定向到登录页（或返回 500 页面，根据需求调整）
      return redirectToLogin(pathname, origin);
    }

    const data = await res.json();

    // 5. 未登录 → 重定向到登录页（带原路径参数）
    if (!data?.success || !data?.data?.user?.username) {
      return redirectToLogin(pathname, origin);
    }

    // 6. 已登录 → 放行（可选：添加用户信息到请求头，供前端页面使用）
    const response = NextResponse.next();
    //response.headers.set('X-User-Role', data.data.user.role || 'user'); // 传递用户角色
    return response;
  } catch (err) {
    // 7. 捕获网络错误（如后端不可用、超时）
    console.error('鉴权请求失败：', (err as Error).message);
    // 网络错误时重定向到登录页（或返回维护页面）
    return redirectToLogin(pathname, origin);
  }
}

// 辅助函数：生成登录重定向 URL（复用逻辑，减少冗余）
function redirectToLogin(originalPath: string, origin: string) {
  const loginUrl = new URL(CONFIG.LOGIN_PATH, origin);
  // 编码原路径（避免特殊字符导致的跳转异常）
  loginUrl.searchParams.set('redirect', encodeURIComponent(originalPath));
  return NextResponse.redirect(loginUrl);
}

// 优化 matcher：精确匹配受保护路由，避免不必要的触发
export const config = {
  matcher: [
    '/dashboard/:path*',
    '/admin/:path*',
    '/settings/:path*',
    // 排除静态资源（如 /dashboard/_next/...），进一步提升性能
    {
      source: '/:path*',
      missing: [
        { type: 'header', key: 'next-router-prefetch' },
        { type: 'header', key: 'purpose', value: 'prefetch' },
      ],
    },
  ],
};