'use client';

import { useEffect, useMemo, useState } from 'react';
import { apiFetch } from '../../../lib/apiFetch';
import { Tenant, TenantMember, TenantRole } from '@/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/Select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/Table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/Dialog';
import { Loader } from '@/components/ui/Loader';
import { TenantRoleGuard } from '@/components/RoleGuard';

export default function TenantsSettingsPage() {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [selectedTenantId, setSelectedTenantId] = useState<string>('');
  const [members, setMembers] = useState<TenantMember[]>([]);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'admin' | 'member'>('member');
  const [error, setError] = useState<string>('');
  const [message, setMessage] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [isMembersLoading, setIsMembersLoading] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [removeDialogOpen, setRemoveDialogOpen] = useState(false);
  const [memberToRemove, setMemberToRemove] = useState<TenantMember | null>(null);

  const selectedTenant = useMemo(
    () => tenants.find(t => t.id === selectedTenantId) || null,
    [tenants, selectedTenantId]
  );

  // Get current user's role in the selected tenant
  const currentUserRole = useMemo(() => {
    // This would need to be fetched from the user context or API
    // For now, we'll determine it from the members list
    const currentMember = members.find(m => m.userId === 'current-user-id'); // Replace with actual user ID
    return currentMember?.role || 'member';
  }, [members]);

  useEffect(() => {
    loadTenants();
  }, []);

  useEffect(() => {
    if (selectedTenantId) {
      loadMembers();
    }
  }, [selectedTenantId]);

  const loadTenants = async () => {
    setIsLoading(true);
    setError('');
    try {
      const res = await apiFetch<Tenant[]>('tenant/my');
      if (res.success && res.data) {
        setTenants(res.data);
        if (res.data.length > 0) {
          setSelectedTenantId(res.data[0].id);
        }
      } else {
        setError(res.message || '加载租户列表失败');
      }
    } catch (err) {
      setError('加载租户列表时发生错误');
    } finally {
      setIsLoading(false);
    }
  };

  const loadMembers = async () => {
    if (!selectedTenantId) return;
    
    setIsMembersLoading(true);
    setError('');
    try {
      const res = await apiFetch<TenantMember[]>(`tenant/${selectedTenantId}/members`);
      if (res.success && res.data) {
        setMembers(res.data);
      } else {
        setError(res.message || '加载成员列表失败');
      }
    } catch (err) {
      setError('加载成员列表时发生错误');
    } finally {
      setIsMembersLoading(false);
    }
  };

  const addMember = async () => {
    setError('');
    setMessage('');
    
    if (!email.trim()) {
      setError('请输入邮箱');
      return;
    }

    setIsAdding(true);
    try {
      const res = await apiFetch('tenant/members/addByEmail', {
        data: { tenantId: selectedTenantId, email: email.trim(), role },
      });

      if (res.success) {
        setEmail('');
        setRole('member');
        await loadMembers();
        setMessage('成员添加成功');
        setTimeout(() => setMessage(''), 3000);
      } else {
        setError(res.message || '添加成员失败');
      }
    } catch (err) {
      setError('添加成员时发生错误');
    } finally {
      setIsAdding(false);
    }
  };

  const handleRemoveClick = (member: TenantMember) => {
    setMemberToRemove(member);
    setRemoveDialogOpen(true);
  };

  const confirmRemoveMember = async () => {
    if (!memberToRemove) return;

    setError('');
    setMessage('');
    
    try {
      const res = await apiFetch('tenant/members/remove', {
        data: { tenantId: selectedTenantId, userId: memberToRemove.userId },
      });

      if (res.success) {
        setMembers(members.filter(m => m.userId !== memberToRemove.userId));
        setMessage('成员移除成功');
        setTimeout(() => setMessage(''), 3000);
        setRemoveDialogOpen(false);
        setMemberToRemove(null);
      } else {
        setError(res.message || '移除成员失败');
      }
    } catch (err) {
      setError('移除成员时发生错误');
    }
  };

  const updateMemberRole = async (userId: string, newRole: TenantRole) => {
    setError('');
    setMessage('');

    try {
      const res = await apiFetch('tenant/members/updateRole', {
        data: { tenantId: selectedTenantId, userId, role: newRole },
      });

      if (res.success) {
        setMembers(prev => prev.map(m => (m.userId === userId ? { ...m, role: newRole } : m)));
        setMessage('成员角色更新成功');
        setTimeout(() => setMessage(''), 3000);
      } else {
        setError(res.message || '更新角色失败');
      }
    } catch (err) {
      setError('更新角色时发生错误');
    }
  };

  const getRoleBadge = (role: TenantRole) => {
    const styles = {
      owner: 'bg-purple-100 text-purple-800 border-purple-200',
      admin: 'bg-blue-100 text-blue-800 border-blue-200',
      member: 'bg-gray-100 text-gray-800 border-gray-200',
    };

    const labels = {
      owner: '所有者',
      admin: '管理员',
      member: '成员',
    };

    return (
      <span className={`px-2 py-1 rounded text-xs font-medium border ${styles[role]}`}>
        {labels[role]}
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
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">租户与成员管理</h2>
        <p className="text-sm text-gray-500 mt-1">管理您的租户及其成员权限</p>
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

      {tenants.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-gray-500">
            您还没有加入任何租户
          </CardContent>
        </Card>
      ) : (
        <>
          <Card>
            <CardHeader>
              <CardTitle>选择租户</CardTitle>
            </CardHeader>
            <CardContent>
              <Select value={selectedTenantId} onValueChange={setSelectedTenantId}>
                <SelectTrigger>
                  <SelectValue placeholder="选择一个租户" />
                </SelectTrigger>
                <SelectContent>
                  {tenants.map(t => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name || t.id}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </CardContent>
          </Card>

          {selectedTenant && (
            <>
              <Card>
                <CardHeader>
                  <CardTitle>成员列表</CardTitle>
                </CardHeader>
                <CardContent>
                  {isMembersLoading ? (
                    <div className="flex justify-center py-8">
                      <Loader />
                    </div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>邮箱</TableHead>
                          <TableHead>用户名</TableHead>
                          <TableHead>角色</TableHead>
                          <TableHead>操作</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {members.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={4} className="text-center text-gray-500 py-8">
                              暂无成员
                            </TableCell>
                          </TableRow>
                        ) : (
                          members.map(m => (
                            <TableRow key={m.id}>
                              <TableCell className="font-medium">
                                {m.user?.email || m.userId}
                              </TableCell>
                              <TableCell>{m.user?.username || 'N/A'}</TableCell>
                              <TableCell>{getRoleBadge(m.role)}</TableCell>
                              <TableCell>
                                <div className="flex items-center gap-2">
                                  <TenantRoleGuard
                                    tenantId={selectedTenantId}
                                    allowedRoles={['owner']}
                                    currentUserRole={currentUserRole}
                                  >
                                    <Select
                                      value={m.role}
                                      onValueChange={(value) => updateMemberRole(m.userId, value as TenantRole)}
                                      disabled={m.role === 'owner'}
                                    >
                                      <SelectTrigger className="w-32">
                                        <SelectValue />
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="member">成员</SelectItem>
                                        <SelectItem value="admin">管理员</SelectItem>
                                        <SelectItem value="owner">所有者</SelectItem>
                                      </SelectContent>
                                    </Select>
                                  </TenantRoleGuard>

                                  <TenantRoleGuard
                                    tenantId={selectedTenantId}
                                    allowedRoles={['owner', 'admin']}
                                    currentUserRole={currentUserRole}
                                  >
                                    <Button
                                      variant="secondary"
                                      size="sm"
                                      onClick={() => handleRemoveClick(m)}
                                      disabled={m.role === 'owner'}
                                      className="text-red-600 hover:text-red-700"
                                    >
                                      移除
                                    </Button>
                                  </TenantRoleGuard>
                                </div>
                              </TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>

              <TenantRoleGuard
                tenantId={selectedTenantId}
                allowedRoles={['owner', 'admin']}
                currentUserRole={currentUserRole}
              >
                <Card>
                  <CardHeader>
                    <CardTitle>添加成员</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          成员邮箱
                        </label>
                        <Input
                          placeholder="输入成员邮箱地址"
                          value={email}
                          onChange={e => setEmail(e.target.value)}
                          onKeyPress={e => e.key === 'Enter' && addMember()}
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          角色
                        </label>
                        <Select value={role} onValueChange={(value) => setRole(value as 'admin' | 'member')}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="member">成员</SelectItem>
                            <SelectItem value="admin">管理员</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <Button 
                        onClick={addMember} 
                        disabled={isAdding}
                        className="w-full"
                      >
                        {isAdding ? '添加中...' : '添加成员'}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </TenantRoleGuard>
            </>
          )}
        </>
      )}

      <Dialog open={removeDialogOpen} onOpenChange={setRemoveDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>确认移除成员</DialogTitle>
            <DialogDescription>
              您确定要移除成员 <strong>{memberToRemove?.user?.email || memberToRemove?.userId}</strong> 吗？
              此操作无法撤销。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setRemoveDialogOpen(false)}>
              取消
            </Button>
            <Button className="bg-red-600 hover:bg-red-700" onClick={confirmRemoveMember}>
              确认移除
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
