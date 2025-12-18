'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/Table';
import { apiFetch } from '@/lib/apiFetch';
import { Tenant } from '@/types';
import { PermissionGuard, NoPermissionFallback } from '@/components/PermissionGuard';
import { Loader } from '@/components/ui/Loader';
import Link from 'next/link';

export default function TenantsPage() {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string>('');

  useEffect(() => {
    loadTenants();
  }, []);

  const loadTenants = async () => {
    setIsLoading(true);
    setError('');
    try {
      const response = await apiFetch<Tenant[]>('/admin/tenants');
      if (response.success && response.data) {
        setTenants(response.data);
      } else {
        setError(response.message || '加载租户列表失败');
      }
    } catch (err) {
      setError('加载租户列表时发生错误');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <PermissionGuard 
      permissions="tenant:read" 
      fallback={<NoPermissionFallback message="您没有权限访问此页面。此页面仅限系统管理员访问。" />}
    >
      <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">租户管理</h1>
            <p className="text-sm text-gray-500 mt-1">查看和管理系统中的所有租户</p>
          </div>
          <Button onClick={loadTenants} variant="secondary">
            刷新列表
          </Button>
        </div>

        {error && (
          <div className="mb-4 bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded">
            {error}
          </div>
        )}

        {isLoading ? (
          <div className="flex justify-center items-center py-12">
            <Loader />
          </div>
        ) : (
          <Card>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>租户名称</TableHead>
                    <TableHead>HubSpot ID</TableHead>
                    <TableHead>创建者 ID</TableHead>
                    <TableHead>创建时间</TableHead>
                    <TableHead>最后更新</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tenants.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-gray-500 py-8">
                        暂无租户数据
                      </TableCell>
                    </TableRow>
                  ) : (
                    tenants.map((tenant) => (
                      <TableRow key={tenant.id}>
                        <TableCell className="font-medium">{tenant.name}</TableCell>
                        <TableCell>
                          <code className="text-xs bg-gray-100 px-2 py-1 rounded">
                            {tenant.hubspotId || 'N/A'}
                          </code>
                        </TableCell>
                        <TableCell>
                          <code className="text-xs bg-gray-100 px-2 py-1 rounded">
                            {tenant.createdBy ? tenant.createdBy.substring(0, 8) + '...' : 'N/A'}
                          </code>
                        </TableCell>
                        <TableCell>
                          {tenant.createdAt 
                            ? new Date(tenant.createdAt).toLocaleDateString('zh-CN')
                            : 'N/A'
                          }
                        </TableCell>
                        <TableCell>
                          {tenant.updatedAt 
                            ? new Date(tenant.updatedAt).toLocaleDateString('zh-CN')
                            : 'N/A'
                          }
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}

        <div className="mt-4 text-sm text-gray-500">
          <p>💡 提示：租户成员管理请前往 <Link href="/settings/tenants" className="text-blue-600 hover:underline">设置 → 租户管理</Link></p>
        </div>
      </div>
    </PermissionGuard>
  );
}
