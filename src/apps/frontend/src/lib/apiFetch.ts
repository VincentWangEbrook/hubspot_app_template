const API_BASE_URL =
  process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001/api/';

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  message?: string;
}

const getApiUrl = (path: string) => {
  // 确保基础 URL 末尾有 /，路径开头去除 /，避免重复
  const base = API_BASE_URL.endsWith('/') ? API_BASE_URL : `${API_BASE_URL}/`;
  const cleanPath = path.startsWith('/') ? path.slice(1) : path;
  return new URL(cleanPath, base).toString();
};

export async function apiFetch<T = unknown>(
  path: string,
  options: RequestInit & {
    data?: Record<string, any> | FormData;
    requireAuth?: boolean;
  } = {}
): Promise<ApiResponse<T>> {
  const { data, requireAuth = false, ...fetchOptions } = options;

  // 构造完整 URL
  const fullUrl = getApiUrl(path);

  // 自动设置 headers（区分 JSON / FormData）
  const isFormData = data instanceof FormData;
  const headers: HeadersInit = {
    ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
    ...(fetchOptions.headers || {}),
  };

  // 序列化请求体
  const body = data
    ? isFormData
      ? (data as FormData)
      : JSON.stringify(data)
    : fetchOptions.body;

  // 构建请求（包含 Cookie）
  const res = await fetch(fullUrl, {
    ...fetchOptions,
    method: fetchOptions.method || (data ? 'POST' : 'GET'),
    headers,
    body,
    credentials: 'include', // 自动带上 HttpOnly Cookie
  });

  // 解析响应（避免多次 .json() 解析错误）
  let json: ApiResponse<T>;
  try {
    json = await res.json();
  } catch {
    json = {
      success: false,
      message: `Invalid JSON response (${res.status})`
    };
  }
  // HTTP 层错误（如 401 / 500）
  if (!res.ok) {
    // 自动识别未授权
    if (res.status === 401 && requireAuth) {
      console.warn('登录已失效，跳转登录页...');
      if (typeof window !== 'undefined') {
        window.location.href = '/login';
      }
    }
    return {
      success: false,
      message: json.message || res.statusText || '请求失败'
    };
  }

  // 标准化返回结构
  return {
    success: json.success ?? true,
    data: json.data,
    message: json.message || '操作成功'
  };
}
