const API_BASE_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001/api';

// 定义 API 响应的通用类型（假设后端统一返回 { success: boolean, data?: T, message?: string }）
interface ApiResponse<T = unknown> {
    success: boolean;
    data?: T;
    message?: string;
  }

/**
 * 将数据转换为 ApiResponse 格式
 * @param data 原始数据
 * @param success 操作是否成功
 * @param message 可选的消息
 */
  function toApiResponse<T>(data: T, success: boolean, message: string): ApiResponse<T> {
    return {
      success,
      data: success ? data : undefined,
      message: success ? message : message || '操作失败',
    };
  }
    
  /**
   * 封装 fetch 请求，处理基础 URL、认证令牌、JSON 解析和错误
   * @param path 接口路径（如 '/auth/login'）
   * @param options 请求配置（扩展 RequestInit，支持 data 自动转为 body）
   * @returns 解析后的响应数据（类型化）
   */
  export async function apiFetch<T = unknown>(
    path: string,
    options: RequestInit & { data?: Record<string, any> } = {}
  ): Promise<ApiResponse<T>> {
    // 1. 提取 data 并处理请求体（自动序列化 JSON）
    const { data, ...fetchOptions } = options;
    const body = data ? JSON.stringify(data) : options.body;
  
    // 2. 处理请求头（合并默认头和自定义头，避免覆盖）
    const token = localStorage.getItem('jwt');
    const defaultHeaders: HeadersInit = {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
    // 允许用户覆盖默认头（如上传文件时用 multipart/form-data）
    const headers = { ...defaultHeaders, ...fetchOptions.headers };
  
    // 3. 拼接完整 URL（处理 path 以 / 开头的情况，避免重复 //）
    const fullUrl = new URL(path, API_BASE_URL).toString();
  console.log(API_BASE_URL)
    try {
        // 默认方法为 GET（若有 data 则默认为 POST）
      const res = await fetch(fullUrl, {
        ...fetchOptions,
        headers,
        body,
        // 默认方法为 GET（若有 data 则默认为 POST）
        method: fetchOptions.method || (data ? 'POST' : 'GET'),
      });

      // 4. 处理 HTTP 错误状态（非 2xx 状态码）
      if (!res.ok) {
        // 尝试解析后端返回的错误信息（若后端有统一格式）
        let errorData: Partial<ApiResponse> = {};
        try {
          errorData = await res.json();
        } catch {
          // 若解析失败，使用响应文本作为错误信息
          errorData.message = await res.text();
        }
        throw new Error(errorData.message || `Request failed with status ${res.status}`);
      }
  
      // 5. 解析成功响应（确保返回符合 ApiResponse 格式）
      const response = (await res.json()) as ApiResponse<T>;
     // const response = toApiResponse<T>(responseData, true, '');

      return response;
    } catch (error) {
      // 6. 处理网络错误（如断网）
      if (error instanceof TypeError && error.message.includes('Failed to fetch')) {
        throw new Error('Network error - please check your connection');
      }
      throw error; // 抛出其他错误（如解析失败、后端错误信息）
    }
  }