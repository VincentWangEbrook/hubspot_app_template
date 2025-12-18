'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/Table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/Dialog';
import { apiFetch } from '@/lib/apiFetch';
import { User, Role } from '@/types';
import { PermissionGuard, NoPermissionFallback } from '@/components/PermissionGuard';
import { Loader } from '@/components/ui/Loader';

// 扩展用户类型，包含角色信息
interface UserWithRoles extends User {
  roles?: Role[];
}

export default function AccountsPage() {
  const [users, setUsers] = useState<UserWithRoles[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string>('');
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState<UserWithRoles | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    setIsLoading(true);
    setError('');
    try {
      const response = await apiFetch<UserWithRoles[]>('/admin/users');
      if (response.success && response.data) {
        setUsers(response.data);
      } else {
        setError(response.message || '加载用户列表失败');
      }
    } catch (err) {
      setError('加载用户列表时发生错误');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteClick = (user: User) => {
    setUserToDelete(user);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!userToDelete) return;

    setIsDeleting(true);
    setError('');
    try {
      const response = await apiFetch(`/admin/users/${userToDelete.id}`, {
        method: 'DELETE',
      });

      if (response.success) {
        setUsers(users.filter(u => u.id !== userToDelete.id));
        setDeleteDialogOpen(false);
        setUserToDelete(null);
      } else {
        setError(response.message || '删除用户失败');
      }
    } catch (err) {
      setError('删除用户时发生错误');
    } finally {
      setIsDeleting(false);
    }
  };

  const getRoleBadges = (roles?: Role[]) => {
    if (!roles || roles.length === 0) {
      return (
        <span className="px-2 py-1 rounded text-xs font-medium bg-gray-100 text-gray-800">
          无角色
        </span>
      );
    }
    return (
      <div className="flex flex-wrap gap-1">
        {roles.map(role => (
          <span 
            key={role.id}
            className={`px-2 py-1 rounded text-xs font-medium ${
              role.code === 'super_admin' ? 'bg-red-100 text-red-800' :
              role.code === 'admin' ? 'bg-purple-100 text-purple-800' : 
              'bg-gray-100 text-gray-800'
            }`}
          >
            {role.name}
          </span>
        ))}
      </div>
    );
  };

  return (
    <PermissionGuard 
      permissions="user:read" 
      fallback={<NoPermissionFallback message="您没有权限访问此页面。此页面仅限系统管理员访问。" />}
    >
      <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">用户管理</h1>
            <p className="text-sm text-gray-500 mt-1">管理系统中的所有用户账号</p>
          </div>
          <Button onClick={loadUsers} variant="secondary">
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
                    <TableHead>用户名</TableHead>
                    <TableHead>邮箱</TableHead>
                    <TableHead>角色</TableHead>
                    <TableHead>创建时间</TableHead>
                    <TableHead>操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-gray-500 py-8">
                        暂无用户数据
                      </TableCell>
                    </TableRow>
                  ) : (
                    users.map((user) => (
                      <TableRow key={user.id}>
                        <TableCell className="font-medium">{user.username}</TableCell>
                        <TableCell>{user.email}</TableCell>
                        <TableCell>{getRoleBadges(user.roles)}</TableCell>
                        <TableCell>
                          {new Date(user.createdAt).toLocaleDateString('zh-CN')}
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => handleDeleteClick(user)}
                            className="text-red-600 hover:text-red-700"
                          >
                            删除
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}

        <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>确认删除用户</DialogTitle>
              <DialogDescription>
                您确定要删除用户 <strong>{userToDelete?.username}</strong> ({userToDelete?.email}) 吗？
                此操作无法撤销。
                {userToDelete?.roles?.some(r => r.code === 'admin' || r.code === 'super_admin') && (
                  <div className="mt-2 text-yellow-600">
                    ⚠️ 注意：您正在删除一个管理员账号。
                  </div>
                )}
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button 
                variant="secondary" 
                onClick={() => setDeleteDialogOpen(false)}
                disabled={isDeleting}
              >
                取消
              </Button>
              <Button 
                className="bg-red-600 hover:bg-red-700"
                onClick={handleDeleteConfirm}
                disabled={isDeleting}
              >
                {isDeleting ? '删除中...' : '确认删除'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </PermissionGuard>
  );
}