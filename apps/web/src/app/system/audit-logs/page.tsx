'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/Table';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/Dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/Select';
import { apiFetch } from '@/lib/apiFetch';
import { AuditLog, PaginatedResponse } from '@/types';
import { Loader } from '@/components/ui/Loader';
import { PermissionGuard, NoPermissionFallback } from '@/components/PermissionGuard';

export default function AuditLogsPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [pagination, setPagination] = useState({
    total: 0,
    page: 1,
    pageSize: 20,
    totalPages: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string>('');

  // 筛选条件
  const [filters, setFilters] = useState({
    resource: '',
    action: '',
    userId: '',
    startDate: '',
    endDate: '',
  });

  // 详情对话框
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);

  useEffect(() => {
    loadLogs();
  }, [pagination.page]);

  const loadLogs = async () => {
    setIsLoading(true);
    setError('');

    try {
      const params = new URLSearchParams({
        page: String(pagination.page),
        pageSize: String(pagination.pageSize),
      });

      if (filters.resource) params.append('resource', filters.resource);
      if (filters.action) params.append('action', filters.action);
      if (filters.userId) params.append('userId', filters.userId);
      if (filters.startDate) params.append('startDate', filters.startDate);
      if (filters.endDate) params.append('endDate', filters.endDate);

      const res = await apiFetch<AuditLog[]>(`/audit-logs?${params.toString()}`);

      if (res.success) {
        setLogs(res.data || []);
        if ((res as any).pagination) {
          setPagination((res as any).pagination);
        }
      } else {
        setError(res.message || '加载失败');
      }
    } catch (err) {
      setError('加载审计日志失败');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSearch = () => {
    setPagination(prev => ({ ...prev, page: 1 }));
    loadLogs();
  };

  const handleReset = () => {
    setFilters({
      resource: '',
      action: '',
      userId: '',
      startDate: '',
      endDate: '',
    });
    setPagination(prev => ({ ...prev, page: 1 }));
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString('zh-CN');
  };

  const getActionLabel = (action: string) => {
    const labels: Record<string, string> = {
      'user:login': '用户登录',
      'user:logout': '用户登出',
      'user:create': '创建用户',
      'user:update': '更新用户',
      'user:delete': '删除用户',
      'user:password_change': '修改密码',
      'user:password_reset': '重置密码',
      'role:create': '创建角色',
      'role:update': '更新角色',
      'role:delete': '删除角色',
      'role:assign': '分配角色',
      'role:revoke': '撤销角色',
      'tenant:create': '创建租户',
      'tenant:update': '更新租户',
      'tenant:delete': '删除租户',
      'member:add': '添加成员',
      'member:remove': '移除成员',
      'member:role_change': '变更成员角色',
      'emergency:request': '申请紧急访问',
      'emergency:approve': '批准紧急访问',
      'emergency:reject': '拒绝紧急访问',
      'emergency:access': '执行紧急访问',
      'hubspot:connect': 'HubSpot连接',
      'hubspot:disconnect': 'HubSpot断开',
      'hubspot:sync': 'HubSpot同步',
      'line:message_send': 'LINE发送消息',
    };
    return labels[action] || action;
  };

  const getActionBadge = (action: string) => {
    let color = 'bg-gray-100 text-gray-800';
    
    if (action.includes('delete') || action.includes('remove') || action.includes('reject')) {
      color = 'bg-red-100 text-red-800';
    } else if (action.includes('create') || action.includes('add') || action.includes('approve')) {
      color = 'bg-green-100 text-green-800';
    } else if (action.includes('update') || action.includes('change')) {
      color = 'bg-blue-100 text-blue-800';
    } else if (action.includes('login') || action.includes('logout')) {
      color = 'bg-purple-100 text-purple-800';
    }

    return (
      <span className={`px-2 py-1 rounded text-xs font-medium ${color}`}>
        {getActionLabel(action)}
      </span>
    );
  };

  if (isLoading && logs.length === 0) {
    return (
      <div className="flex justify-center items-center py-12">
        <Loader />
      </div>
    );
  }

  return (
    <PermissionGuard 
      permissions="audit:read" 
      fallback={<NoPermissionFallback message="您没有权限访问此页面。此页面仅限系统管理员访问。" />}
    >
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">审计日志</h1>
        <p className="text-sm text-gray-500 mt-1">查看系统操作记录和安全事件</p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded">
          {error}
        </div>
      )}

      {/* 筛选条件 */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">资源类型</label>
              <Select value={filters.resource} onValueChange={(v) => setFilters({ ...filters, resource: v })}>
                <SelectTrigger>
                  <SelectValue placeholder="全部" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">全部</SelectItem>
                  <SelectItem value="user">用户</SelectItem>
                  <SelectItem value="role">角色</SelectItem>
                  <SelectItem value="tenant">租户</SelectItem>
                  <SelectItem value="tenant_member">租户成员</SelectItem>
                  <SelectItem value="emergency_access">紧急访问</SelectItem>
                  <SelectItem value="hubspot">HubSpot</SelectItem>
                  <SelectItem value="line">LINE</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">开始日期</label>
              <Input
                type="date"
                value={filters.startDate}
                onChange={(e) => setFilters({ ...filters, startDate: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">结束日期</label>
              <Input
                type="date"
                value={filters.endDate}
                onChange={(e) => setFilters({ ...filters, endDate: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">用户ID</label>
              <Input
                placeholder="用户ID"
                value={filters.userId}
                onChange={(e) => setFilters({ ...filters, userId: e.target.value })}
              />
            </div>
            <div className="flex items-end gap-2">
              <Button onClick={handleSearch}>搜索</Button>
              <Button variant="secondary" onClick={handleReset}>重置</Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 日志列表 */}
      <Card>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>时间</TableHead>
                <TableHead>操作人</TableHead>
                <TableHead>操作</TableHead>
                <TableHead>资源</TableHead>
                <TableHead>IP地址</TableHead>
                <TableHead>详情</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {logs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-gray-500 py-8">
                    暂无审计日志
                  </TableCell>
                </TableRow>
              ) : (
                logs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell className="text-sm">{formatDate(log.createdAt)}</TableCell>
                    <TableCell>
                      <div>
                        <div className="font-medium">{log.user?.username}</div>
                        <div className="text-xs text-gray-500">{log.user?.email}</div>
                      </div>
                    </TableCell>
                    <TableCell>{getActionBadge(log.action)}</TableCell>
                    <TableCell>
                      <span className="capitalize">{log.resource}</span>
                      {log.resourceId && (
                        <span className="text-xs text-gray-400 ml-1">
                          #{log.resourceId.slice(0, 8)}
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-gray-500">{log.ipAddress || '-'}</TableCell>
                    <TableCell>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => {
                          setSelectedLog(log);
                          setDetailDialogOpen(true);
                        }}
                      >
                        查看
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>

          {/* 分页 */}
          {pagination.totalPages > 1 && (
            <div className="flex items-center justify-between mt-4 pt-4 border-t">
              <span className="text-sm text-gray-500">
                共 {pagination.total} 条记录，第 {pagination.page}/{pagination.totalPages} 页
              </span>
              <div className="flex gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={pagination.page <= 1}
                  onClick={() => setPagination(prev => ({ ...prev, page: prev.page - 1 }))}
                >
                  上一页
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={pagination.page >= pagination.totalPages}
                  onClick={() => setPagination(prev => ({ ...prev, page: prev.page + 1 }))}
                >
                  下一页
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 详情对话框 */}
      <Dialog open={detailDialogOpen} onOpenChange={setDetailDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>审计日志详情</DialogTitle>
          </DialogHeader>

          {selectedLog && (
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-500">操作时间</label>
                  <p className="mt-1">{formatDate(selectedLog.createdAt)}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">操作类型</label>
                  <p className="mt-1">{getActionBadge(selectedLog.action)}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-500">操作人</label>
                  <p className="mt-1">{selectedLog.user?.username}</p>
                  <p className="text-sm text-gray-500">{selectedLog.user?.email}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">资源</label>
                  <p className="mt-1 capitalize">{selectedLog.resource}</p>
                  {selectedLog.resourceId && (
                    <p className="text-sm text-gray-500">{selectedLog.resourceId}</p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-500">IP地址</label>
                  <p className="mt-1">{selectedLog.ipAddress || '-'}</p>
                </div>
                {selectedLog.tenantId && (
                  <div>
                    <label className="text-sm font-medium text-gray-500">租户ID</label>
                    <p className="mt-1 font-mono text-sm">{selectedLog.tenantId}</p>
                  </div>
                )}
              </div>

              {selectedLog.userAgent && (
                <div>
                  <label className="text-sm font-medium text-gray-500">User Agent</label>
                  <p className="mt-1 text-sm text-gray-600 break-all">{selectedLog.userAgent}</p>
                </div>
              )}

              {selectedLog.details && Object.keys(selectedLog.details).length > 0 && (
                <div>
                  <label className="text-sm font-medium text-gray-500">详细信息</label>
                  <pre className="mt-1 p-3 bg-gray-50 rounded text-sm overflow-auto max-h-40">
                    {JSON.stringify(selectedLog.details, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
    </PermissionGuard>
  );
}

