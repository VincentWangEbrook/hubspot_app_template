'use client';

import { useEffect, useState, useRef } from 'react';
import { Plus } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/Table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/Dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/Select';
import { apiFetch } from '@/lib/apiFetch';
import { Role, Permission, GroupedPermissions } from '@/types';
import { PermissionGuard, NoPermissionFallback } from '@/components/PermissionGuard';
import { Loader } from '@/components/ui/Loader';

export default function RolesPage() {
  const [roles, setRoles] = useState<Role[]>([]);
  const [permissions, setPermissions] = useState<GroupedPermissions[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string>('');
  const [message, setMessage] = useState<string>('');
  
  // 创建/编辑对话框
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<Role | null>(null);
  const [formData, setFormData] = useState({
    code: '',
    name: '',
    description: '',
    type: 'system' as 'system' | 'tenant',
    permissionCodes: [] as string[],
  });
  const [isSaving, setIsSaving] = useState(false);

  // 删除对话框
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [roleToDelete, setRoleToDelete] = useState<Role | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // 筛选
  const [filterType, setFilterType] = useState<'all' | 'system' | 'tenant'>('all');

  // 对话框内容滚动容器的 ref
  const dialogContentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    setError('');
    try {
      const [rolesRes, permsRes] = await Promise.all([
        apiFetch<Role[]>('/roles'),
        apiFetch<GroupedPermissions[]>('/permissions/grouped'),
      ]);

      if (rolesRes.success && rolesRes.data) {
        setRoles(rolesRes.data);
      }
      if (permsRes.success && permsRes.data) {
        setPermissions(permsRes.data);
      }
    } catch (err) {
      setError('加载数据失败');
    } finally {
      setIsLoading(false);
    }
  };

  const openCreateDialog = () => {
    setEditingRole(null);
    setFormData({
      code: '',
      name: '',
      description: '',
      type: 'system',
      permissionCodes: [],
    });
    setDialogOpen(true);
  };

  const openEditDialog = (role: Role) => {
    setEditingRole(role);
    setFormData({
      code: role.code,
      name: role.name,
      description: role.description || '',
      type: role.type,
      permissionCodes: role.permissions?.map(p => p.code) || [],
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    setError('');
    setIsSaving(true);

    try {
      if (editingRole) {
        // 更新
        const res = await apiFetch<Role>(`/roles/${editingRole.id}`, {
          method: 'PUT',
          data: {
            name: formData.name,
            description: formData.description,
            permissionCodes: formData.permissionCodes,
          },
        });

        if (res.success) {
          setMessage('角色更新成功');
          await loadData();
          setDialogOpen(false);
        } else {
          setError(res.message || '更新失败');
        }
      } else {
        // 创建
        const res = await apiFetch<Role>('/roles', {
          method: 'POST',
          data: formData,
        });

        if (res.success) {
          setMessage('角色创建成功');
          await loadData();
          setDialogOpen(false);
        } else {
          setError(res.message || '创建失败');
        }
      }
    } catch (err) {
      setError('操作失败');
    } finally {
      setIsSaving(false);
      setTimeout(() => setMessage(''), 3000);
    }
  };

  const handleDelete = async () => {
    if (!roleToDelete) return;

    setIsDeleting(true);
    setError('');

    try {
      const res = await apiFetch(`/roles/${roleToDelete.id}`, {
        method: 'DELETE',
      });

      if (res.success) {
        setMessage('角色已删除');
        setRoles(roles.filter(r => r.id !== roleToDelete.id));
        setDeleteDialogOpen(false);
        setRoleToDelete(null);
      } else {
        setError(res.message || '删除失败');
      }
    } catch (err) {
      setError('删除失败');
    } finally {
      setIsDeleting(false);
      setTimeout(() => setMessage(''), 3000);
    }
  };

  const togglePermission = (code: string) => {
    setFormData(prev => ({
      ...prev,
      permissionCodes: prev.permissionCodes.includes(code)
        ? prev.permissionCodes.filter(c => c !== code)
        : [...prev.permissionCodes, code],
    }));
  };

  const filteredRoles = roles.filter(role => {
    if (filterType === 'all') return true;
    return role.type === filterType;
  });

  const getTypeBadge = (type: string) => {
    const isSystem = type === 'system';
    return (
      <span className={`px-2 py-1 rounded text-xs font-medium ${
        isSystem ? 'bg-purple-100 text-purple-800' : 'bg-blue-100 text-blue-800'
      }`}>
        {isSystem ? '系统级' : '租户级'}
      </span>
    );
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center py-12">
        <Loader />
      </div>
    );
  }

  return (
    <PermissionGuard 
      permissions="role:read" 
      fallback={<NoPermissionFallback message="您没有权限访问此页面。此页面仅限系统管理员访问。" />}
    >
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">角色管理</h1>
          <p className="text-sm text-gray-500 mt-1">管理系统角色和权限分配</p>
        </div>
        <div className="flex gap-2">
          <Select value={filterType} onValueChange={(v) => setFilterType(v as any)}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部</SelectItem>
              <SelectItem value="system">系统级</SelectItem>
              <SelectItem value="tenant">租户级</SelectItem>
            </SelectContent>
          </Select>
          <Button 
            onClick={openCreateDialog}
            className="inline-flex items-center gap-2 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 shadow-md hover:shadow-lg transition-all duration-200"
          >
            <Plus size={18} />
            <span>创建角色</span>
          </Button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded">
          {error}
        </div>
      )}

      {message && (
        <div className="bg-green-50 border border-green-200 text-green-800 px-4 py-3 rounded">
          {message}
        </div>
      )}

      <Card>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>角色代码</TableHead>
                <TableHead>名称</TableHead>
                <TableHead>类型</TableHead>
                <TableHead>权限数</TableHead>
                <TableHead>系统内置</TableHead>
                <TableHead>操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredRoles.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-gray-500 py-8">
                    暂无角色数据
                  </TableCell>
                </TableRow>
              ) : (
                filteredRoles.map((role) => (
                  <TableRow key={role.id}>
                    <TableCell className="font-mono text-sm">{role.code}</TableCell>
                    <TableCell className="font-medium">{role.name}</TableCell>
                    <TableCell>{getTypeBadge(role.type)}</TableCell>
                    <TableCell>{role.permissions?.length || 0}</TableCell>
                    <TableCell>
                      {role.isSystem ? (
                        <span className="text-gray-400">是</span>
                      ) : (
                        <span className="text-green-600">否</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => openEditDialog(role)}
                          disabled={role.isSystem}
                        >
                          编辑
                        </Button>
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => {
                            setRoleToDelete(role);
                            setDeleteDialogOpen(true);
                          }}
                          disabled={role.isSystem}
                          className="text-red-600 hover:text-red-700"
                        >
                          删除
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* 创建/编辑对话框 */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col" onClose={() => setDialogOpen(false)}>
          <DialogHeader className="pb-4 flex-shrink-0">
            <DialogTitle className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-blue-800 bg-clip-text text-transparent">
              {editingRole ? '编辑角色' : '创建新角色'}
            </DialogTitle>
            <DialogDescription className="text-gray-600">
              {editingRole ? '修改角色信息和权限配置' : '填写角色信息并分配相应权限'}
            </DialogDescription>
          </DialogHeader>

          <div 
            ref={dialogContentRef} 
            className="flex-1 overflow-y-auto px-6 py-2 space-y-5"
            style={{ scrollBehavior: 'auto' }}
          >
            {!editingRole && (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-gray-700">
                    角色代码 <span className="text-red-500">*</span>
                  </label>
                  <Input
                    placeholder="例如: custom_admin"
                    value={formData.code}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                    className="border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                  />
                  <p className="text-xs text-gray-500">
                    只能包含小写字母、数字和下划线
                  </p>
                </div>

                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-gray-700">
                    角色类型 <span className="text-red-500">*</span>
                  </label>
                  <Select
                    value={formData.type}
                    onValueChange={(v) => setFormData({ ...formData, type: v as any })}
                  >
                    <SelectTrigger className="border-gray-300">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="system">系统级</SelectItem>
                      <SelectItem value="tenant">租户级</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}

            <div className="space-y-2">
              <label className="block text-sm font-semibold text-gray-700">
                角色名称 <span className="text-red-500">*</span>
              </label>
              <Input
                placeholder="例如: 自定义管理员"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
              />
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-semibold text-gray-700">
                描述
              </label>
              <Input
                placeholder="角色描述（可选）"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
              />
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="block text-sm font-semibold text-gray-700">
                  权限分配 <span className="text-red-500">*</span>
                </label>
                <span className="text-xs font-medium text-blue-600 bg-blue-50 px-3 py-1 rounded-full">
                  已选择 {formData.permissionCodes.length} 个权限
                </span>
              </div>
              <div className="border border-gray-200 rounded-xl p-5 max-h-64 overflow-y-auto bg-gradient-to-br from-gray-50 to-white space-y-5">
                {permissions
                  .filter(g => formData.type === 'system' ? g.permissions.some(p => p.scope !== 'tenant') : g.permissions.some(p => p.scope !== 'system'))
                  .map((group) => (
                    <div key={group.resource} className="bg-white rounded-lg border border-gray-200 p-4 hover:border-blue-300 transition-colors">
                      <h4 className="font-semibold text-gray-800 mb-3 text-sm uppercase tracking-wide flex items-center gap-2">
                        <span className="w-1 h-4 bg-blue-600 rounded-full"></span>
                        {group.resource}
                      </h4>
                      <div className="flex flex-wrap gap-2">
                        {group.permissions
                          .filter(p => formData.type === 'system' ? p.scope !== 'tenant' : p.scope !== 'system')
                          .map((perm) => (
                            <div
                              key={perm.id}
                              role="button"
                              aria-pressed={formData.permissionCodes.includes(perm.code)}
                              className={`inline-flex items-center px-3.5 py-2 rounded-lg text-sm font-medium cursor-pointer transition-all duration-150 border-2 ${
                                formData.permissionCodes.includes(perm.code)
                                  ? 'bg-gradient-to-r from-blue-500 to-blue-600 text-white border-blue-600 shadow-md scale-105'
                                  : 'bg-white text-gray-700 border-gray-200 hover:border-blue-400 hover:bg-blue-50'
                              }`}
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                togglePermission(perm.code);
                              }}
                            >
                              {perm.name}
                            </div>
                          ))}
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          </div>

          <DialogFooter className="border-t bg-gray-50 px-6 py-4 flex-shrink-0">
            <Button 
              variant="secondary" 
              onClick={(e) => {
                e.stopPropagation();
                setDialogOpen(false);
              }}
              className="hover:bg-gray-200"
            >
              取消
            </Button>
            <Button 
              onClick={(e) => {
                e.stopPropagation();
                handleSave();
              }}
              disabled={isSaving}
              className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 shadow-md"
            >
              {isSaving ? '保存中...' : '保存'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 删除确认对话框 */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent onClose={() => setDeleteDialogOpen(false)}>
          <DialogHeader>
            <DialogTitle>确认删除角色</DialogTitle>
            <DialogDescription>
              您确定要删除角色 <strong>{roleToDelete?.name}</strong> 吗？
              此操作无法撤销。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button 
              variant="secondary" 
              onClick={(e) => {
                e.stopPropagation();
                setDeleteDialogOpen(false);
              }}
            >
              取消
            </Button>
            <Button
              className="bg-red-600 hover:bg-red-700"
              onClick={(e) => {
                e.stopPropagation();
                handleDelete();
              }}
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

