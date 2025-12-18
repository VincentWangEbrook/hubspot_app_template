import { API_BASE_URL } from '../../config';

/**
 * API 工具类：封装通用的 API 相关工具函数（URL 拼接、请求参数处理等）
 */
export class ApiUtils {
  /**
   * 拼接基础 URL 和接口路径，确保格式规范（避免重复 / 或缺失 /）
   * @param path 接口路径（如 '/auth/login' 或 'auth/login'）
   * @param baseUrl 可选：自定义基础 URL（默认使用全局 API_BASE_URL）
   * @returns 完整的接口 URL 字符串
   */
  static getApiUrl(path: string, baseUrl?: string): string {
    // 优先使用传入的 baseUrl，否则使用全局基础 URL
    const finalBaseUrl = baseUrl || API_BASE_URL;
    
    // 确保基础 URL 末尾有 /
    const base = finalBaseUrl.endsWith('/') ? finalBaseUrl : `${finalBaseUrl}/`;
    
    // 确保路径开头无 /（避免拼接后出现 //）
    const cleanPath = path.startsWith('/') ? path.slice(1) : path;
    
    // 使用 URL 构造函数确保拼接格式正确（兼容特殊字符、查询参数等）
    return new URL(cleanPath, base).toString();
  }

  /**
   * 扩展：拼接 URL 查询参数（可选，增强工具类实用性）
   * @param url 基础 URL（可含已有查询参数）
   * @param params 查询参数对象
   * @returns 带查询参数的完整 URL
   */
  static addQueryParams(url: string, params?: Record<string, any>): string {
    if (!params || Object.keys(params).length === 0) return url;

    const urlObj = new URL(url);
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        urlObj.searchParams.append(key, String(value));
      }
    });
    return urlObj.toString();
  }
}

export const getApiUrl = ApiUtils.getApiUrl;
export const addQueryParams = ApiUtils.addQueryParams;