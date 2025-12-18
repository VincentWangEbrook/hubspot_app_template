/**
 * Tenant URL Management Utilities
 * 
 * 混合方案实现：
 * - URL作为单一真实来源
 * - localStorage仅用于记住"最后访问的租户"
 */

const LAST_TENANT_KEY = 'lastTenantId';

/**
 * 从URL路径中提取租户ID
 * @param pathname - 当前路径，例如 "/tenant-123/hubspot/contacts"
 * @returns 租户ID或null
 */
export function getTenantIdFromUrl(pathname: string): string | null {
  // 匹配 /[tenantId]/... 格式
  const match = pathname.match(/^\/([^\/]+)\//);
  if (!match) return null;
  
  const potentialTenantId = match[1];
  
  // 排除非租户路径
  const nonTenantPaths = ['login', 'register', 'forgot-password', 'reset-password', 'oauth-callback', 'system', 'settings'];
  if (nonTenantPaths.includes(potentialTenantId)) {
    return null;
  }
  
  return potentialTenantId;
}

/**
 * 生成租户作用域的URL
 * @param tenantId - 租户ID
 * @param path - 路径，例如 "/hubspot/contacts" 或 "hubspot/contacts"
 * @returns 完整的租户URL，例如 "/tenant-123/hubspot/contacts"
 */
export function getTenantUrl(tenantId: string, path: string): string {
  // 移除开头的斜杠（如果有）
  const cleanPath = path.startsWith('/') ? path.slice(1) : path;
  return `/${tenantId}/${cleanPath}`;
}

/**
 * 替换URL中的租户ID，保留路径部分
 * @param currentPath - 当前完整路径，例如 "/old-tenant/hubspot/contacts"
 * @param newTenantId - 新的租户ID
 * @returns 新的URL路径，例如 "/new-tenant/hubspot/contacts"
 */
export function replaceTenantInUrl(currentPath: string, newTenantId: string): string {
  const currentTenantId = getTenantIdFromUrl(currentPath);
  
  if (!currentTenantId) {
    // 当前路径没有租户ID，假设是租户级别页面，添加租户前缀
    return getTenantUrl(newTenantId, currentPath);
  }
  
  // 替换租户ID部分
  return currentPath.replace(`/${currentTenantId}/`, `/${newTenantId}/`);
}

/**
 * 判断路径是否是租户级别页面
 * @param path - 路径（不含租户ID），例如 "/hubspot/contacts"
 * @returns 是否是租户级别页面
 */
export function isTenantLevelPath(path: string): boolean {
  const tenantPaths = ['/hubspot', '/reports', '/subscription'];
  return tenantPaths.some(prefix => path.startsWith(prefix));
}

/**
 * 从localStorage获取最后访问的租户ID
 * @returns 租户ID或null
 */
export function getLastTenantId(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(LAST_TENANT_KEY);
}

/**
 * 保存最后访问的租户ID到localStorage
 * @param tenantId - 租户ID
 */
export function setLastTenantId(tenantId: string): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(LAST_TENANT_KEY, tenantId);
}

/**
 * 清除最后访问的租户ID
 */
export function clearLastTenantId(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(LAST_TENANT_KEY);
}

/**
 * 获取租户相关的导航URL
 * 如果是租户级别页面且有tenantId，返回带租户的URL；否则返回原路径
 * @param path - 目标路径
 * @param tenantId - 当前租户ID（可选）
 * @returns 完整的导航URL
 */
export function getNavigationUrl(path: string, tenantId?: string | null): string {
  // 移除开头的斜杠用于判断
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  
  // 如果是租户级别页面且有租户ID
  if (isTenantLevelPath(cleanPath) && tenantId) {
    return getTenantUrl(tenantId, cleanPath);
  }
  
  // 其他情况返回原路径
  return cleanPath;
}
