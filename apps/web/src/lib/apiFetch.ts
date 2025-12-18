import { ApiUtils, API_TIMEOUT } from 'shared';

/** 标准化 API 响应结构 */
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  message?: string;
  code?: number; // 错误码（便于精准处理）
}

/** 扩展请求配置：支持 Session/Token 双认证，预留扩展点 */
export interface ApiFetchOptions extends RequestInit {
  /** 普通对象或 FormData（自动处理 Content-Type） */
  data?: Record<string, any> | FormData;
  /** 是否需要认证（true 时：优先 Token，无 Token 则依赖 Session） */
  requireAuth?: boolean;
  /** 自定义超时时间（覆盖默认 API_TIMEOUT） */
  timeout?: number;
  /** 认证模式：默认 'session'，后续可切换为 'token' */
  authMode?: 'session' | 'token' | 'both';
  /** 是否严格模式（严格模式下，非 JSON 响应视为错误） */
  strictMode?: boolean;
}

/**
 * 增强型 API 请求工具（Session 优先，预留 Token 开关，参数名 data 兼容）
 * @param path 接口路径（相对路径/绝对路径）
 * @param options 请求配置（支持 data/FormData、超时、双认证模式）
 * @returns 标准化响应结构
 */
export async function apiFetch<T = unknown>(
  path: string,
  options: ApiFetchOptions = {},
): Promise<ApiResponse<T>> {
  // 解构配置并设置默认值（结构更清晰）
  const {
    data,
    requireAuth = false,
    timeout = API_TIMEOUT,
    authMode = 'session',
    strictMode = false,
    method,
    headers: customHeaders,
    body: customBody,
    ...restOptions
  } = options;

  // 初始化响应结构（默认失败，message 更精准）
  const response: ApiResponse<T> = {
    success: false,
    message: '请求初始化中...',
  };

  try {
    // 统一处理 Headers（兼容多种格式，类型安全）
    const headers = normalizeHeaders(customHeaders);

    // 自动提取 tenantId 并添加到 header（多租户支持）
    const tenantId = extractTenantIdFromPath(path);
    if (tenantId && !headers['X-Tenant-Id'] && !headers['x-tenant-id']) {
      headers['X-Tenant-Id'] = tenantId;
    }

    // 认证逻辑预处理（抽离为独立逻辑，便于维护）
    const authError = handleAuth({ requireAuth, authMode, headers });
    if (authError) {
      Object.assign(response, authError);
      return response;
    }

    // 处理请求体和 Content-Type（抽离为工具函数，减少冗余）
    const { requestBody, finalHeaders } = handleRequestBodyAndHeaders({
      data,
      customBody,
      headers,
    });

    // 自动适配请求方法（有 body/data 用 POST，无则用 GET）
    const requestMethod = method || (requestBody ? 'POST' : 'GET');

    // 构造请求参数
    const url = ApiUtils.getApiUrl(path);
    const controller = new AbortController();
    const { signal } = controller;
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      // 发送请求
      const fetchResponse = await fetch(url, {
        ...restOptions,
        signal,
        method: requestMethod,
        headers: finalHeaders,
        body: requestBody,
        credentials: authMode === 'token' ? 'omit' : 'include', // Token 模式不携带 Cookie
      });

      // 处理 HTTP 错误（4xx/5xx）
      if (!fetchResponse.ok) {
        Object.assign(response, handleHttpError(fetchResponse));
        return response;
      }

      // 解析响应（兼容 JSON/文本，支持严格模式）
      Object.assign(response, await parseResponse<T>(fetchResponse, strictMode));

    } catch (error) {
      // 捕获网络错误/超时错误
      Object.assign(response, handleNetworkError(error, url, timeout));
    } finally {
      clearTimeout(timeoutId); // 清理定时器，避免内存泄漏
    }

  } catch (globalError) {
    // 捕获全局异常（如参数处理失败等）
    response.message = `请求异常：${(globalError as Error).message || '未知错误'}`;
    response.code = 500;
  }

  return response;
}

/**
 * 工具函数：统一处理 Headers 格式（兼容对象、数组、Headers 实例）
 * @param customHeaders 自定义 Headers
 * @returns 标准化的 Headers 对象
 */
function normalizeHeaders(customHeaders?: HeadersInit): Record<string, string> {
  const headers: Record<string, string> = {};

  if (!customHeaders) return headers;

  if (Array.isArray(customHeaders)) {
    // 处理二维数组格式：[['key', 'value']]
    customHeaders.forEach(([key, value]) => {
      if (key && value) headers[key] = String(value);
    });
  } else if (customHeaders instanceof Headers) {
    // 处理 Headers 实例
    customHeaders.forEach((value, key) => {
      headers[key] = value;
    });
  } else {
    // 处理对象格式（过滤 null/undefined 值）
    Object.entries(customHeaders).forEach(([key, value]) => {
      if (key && value != null) headers[key] = String(value);
    });
  }

  return headers;
}

/**
 * 工具函数：从 URL 路径中提取 tenantId（支持查询参数）
 * @param path API 路径
 * @returns tenantId 或 undefined
 */
function extractTenantIdFromPath(path: string): string | undefined {
  try {
    // 检查是否包含查询参数
    const urlParts = path.split('?');
    if (urlParts.length < 2) return undefined;
    
    // 解析查询参数
    const params = new URLSearchParams(urlParts[1]);
    return params.get('tenantId') || undefined;
  } catch {
    return undefined;
  }
}

/**
 * 工具函数：处理认证逻辑（抽离独立，便于后续扩展）
 * @param params 认证相关参数
 * @returns 认证错误（无错误则返回 undefined）
 */
function handleAuth(params: {
  requireAuth: boolean;
  authMode: 'session' | 'token' | 'both';
  headers: Record<string, string>;
}): Pick<ApiResponse, 'success' | 'message' | 'code'> | undefined {
  const { requireAuth, authMode, headers } = params;

  if (!requireAuth) return undefined;

  // Token 认证逻辑（预留开关）
  if (authMode === 'token' || authMode === 'both') {
    const token = localStorage.getItem('authToken');
    if (token) {
      // 避免覆盖已有的 Authorization 头
      if (!headers.Authorization) {
        headers.Authorization = `Bearer ${token}`;
      }
    } else if (authMode === 'token') {
      // 纯 Token 模式下，无 Token 直接返回未授权
      return {
        success: false,
        message: '未授权：缺少访问令牌',
        code: 401,
      };
    }
    // both 模式下，无 Token 降级为 Session
  }

  return undefined;
}

/**
 * 工具函数：处理请求体和 Content-Type（减少主逻辑冗余）
 */
function handleRequestBodyAndHeaders(params: {
  data?: Record<string, any> | FormData;
  customBody?: RequestInit['body'];
  headers: Record<string, string>;
}): {
  requestBody: RequestInit['body'];
  finalHeaders: Record<string, string>;
} {
  const { data, customBody, headers } = params;
  const finalHeaders = { ...headers };

  // 优先使用 customBody，其次处理 data
  if (customBody) {
    return { requestBody: customBody, finalHeaders };
  }

  if (!data) {
    return { requestBody: null, finalHeaders };
  }

  // 处理 FormData 类型
  if (data instanceof FormData) {
    // FormData 无需手动设置 Content-Type（浏览器自动处理）
    return { requestBody: data, finalHeaders };
  }

  // 处理普通对象（转为 JSON）
  if (!finalHeaders['Content-Type'] && !finalHeaders['content-type']) {
    finalHeaders['Content-Type'] = 'application/json';
  }

  return {
    requestBody: JSON.stringify(data),
    finalHeaders,
  };
}

/**
 * 工具函数：处理 HTTP 错误（4xx/5xx）
 */
async function handleHttpError(fetchResponse: Response): Promise<Pick<ApiResponse, 'success' | 'message' | 'code'>> {
  const code = fetchResponse.status;
  let message = `请求失败 [${code}]：${fetchResponse.statusText}`;

  // 尝试解析后端返回的详细错误信息
  try {
    const errorData = await fetchResponse.json();
    if (typeof errorData === 'object' && errorData.message) {
      message = errorData.message;
    }
  } catch {
    // 解析失败时，用响应文本作为错误信息
    const errorText = await fetchResponse.text();
    if (errorText) message = errorText;
  }

  return {
    success: false,
    message,
    code,
  };
}

/**
 * 工具函数：解析响应（兼容 JSON/文本，支持严格模式）
 */
async function parseResponse<T = unknown>(
  fetchResponse: Response,
  strictMode: boolean,
): Promise<Pick<ApiResponse<T>, 'success' | 'data' | 'message' | 'code'>> {
  // 优先解析为 JSON
  try {
    const responseData = await fetchResponse.json();
    return {
      success: responseData.success ?? true, // 后端未返回 success 时默认成功
      data: (responseData.data as T) ?? undefined, // 兼容后端无 data 字段
      message: responseData.message || '请求成功',
      code: responseData.code || fetchResponse.status,
    };
  } catch (jsonError) {
    // 严格模式下，非 JSON 响应视为错误
    if (strictMode) {
      return {
        success: false,
        message: '响应格式错误：期望 JSON 格式',
        code: 400,
      };
    }

    // 降级解析为文本
    try {
      const textData = await fetchResponse.text();
      return {
        success: true,
        data: textData as T,
        message: '请求成功（文本格式响应）',
        code: fetchResponse.status,
      };
    } catch (textError) {
      return {
        success: false,
        message: '响应解析失败',
        code: 500,
      };
    }
  }
}

/**
 * 工具函数：处理网络错误/超时错误
 */
function handleNetworkError(
  error: unknown,
  url: string,
  timeout: number,
): Pick<ApiResponse, 'success' | 'message' | 'code'> {
  if (error instanceof DOMException && error.name === 'AbortError') {
    return {
      success: false,
      message: `请求超时（${timeout}ms）：${url}`,
      code: 408,
    };
  }

  return {
    success: false,
    message: `网络错误：${(error as Error).message || '未知网络错误'}`,
    code: 503,
  };
}