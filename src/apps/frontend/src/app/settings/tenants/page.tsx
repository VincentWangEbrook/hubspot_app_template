'use client'

import { useEffect, useMemo, useState } from 'react';
import { apiFetch } from '../../../lib/api';

type Tenant = { id: string; name: string; createdBy?: string };
type Member = { id: string; tenantId: string; userId: string; role: 'owner'|'admin'|'member'; user?: { id: string; email: string; username?: string } };

export default function TenantsSettingsPage() {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [selectedTenantId, setSelectedTenantId] = useState<string>('');
  const [members, setMembers] = useState<Member[]>([]);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'admin'|'member'>('member');
  const [error, setError] = useState<string>('');
  const [message, setMessage] = useState<string>('');

  const selectedTenant = useMemo(() => tenants.find(t => t.id === selectedTenantId) || null, [tenants, selectedTenantId]);

  useEffect(() => {
    apiFetch<Tenant[]>('tenant/my').then(res => {
      if (res.success) {
        const data = (res.data as any) as Tenant[];
        setTenants(data);
        if (data.length) setSelectedTenantId(data[0].id);
      } else {
        setError(res.message || 'Failed to load tenants');
      }
    }).catch(err => setError(err.message));
  }, []);

  useEffect(() => {
    if (!selectedTenantId) return;
    apiFetch<Member[]>(`tenant/${selectedTenantId}/members`).then(res => {
      if (res.success) setMembers((res.data as any) || []);
      else setError(res.message || 'Failed to load members');
    }).catch(err => setError(err.message));
  }, [selectedTenantId]);

  const addMember = async () => {
    setError(''); setMessage('');
    if (!email) { setError('请输入邮箱'); return; }
    const res = await apiFetch('tenant/members/addByEmail', { data: { tenantId: selectedTenantId, email, role } });
    if (!res.success) { setError(res.message || '添加失败'); return; }
    setEmail(''); setRole('member');
    const refreshed = await apiFetch<Member[]>(`tenant/${selectedTenantId}/members`);
    if (refreshed.success) setMembers((refreshed.data as any) || []);
    setMessage('已添加成员');
  };

  const removeMember = async (userId: string) => {
    setError(''); setMessage('');
    const res = await apiFetch('tenant/members/remove', { data: { tenantId: selectedTenantId, userId } });
    if (!res.success) { setError(res.message || '移除失败'); return; }
    setMembers(members.filter(m => m.userId !== userId));
    setMessage('已移除成员');
  };

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold">Tenants & Members</h2>

      {error && <div className="text-red-600">{error}</div>}
      {message && <div className="text-green-600">{message}</div>}

      <div className="flex items-center gap-3">
        <span>选择租户:</span>
        <select className="border px-2 py-1 rounded" value={selectedTenantId} onChange={e => setSelectedTenantId(e.target.value)}>
          {tenants.map(t => <option key={t.id} value={t.id}>{t.name || t.id}</option>)}
        </select>
      </div>

      {selectedTenant && (
        <div className="space-y-4">
          <div>
            <h3 className="font-medium mb-2">成员列表</h3>
            <ul className="space-y-1">
              {members.map(m => (
                <li key={m.id} className="flex items-center justify-between border rounded px-3 py-2">
                  <div className="flex-1">
                    <div className="text-sm">{m.user?.email || m.userId} {m.user?.username ? `(${m.user.username})` : ''}</div>
                    <div className="text-xs text-gray-500">userId: {m.userId}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <select
                      disabled={m.role === 'owner'}
                      className="border px-2 py-1 rounded"
                      value={m.role}
                      onChange={async (e) => {
                        const role = e.target.value as 'admin'|'member'|'owner';
                        const res = await apiFetch('tenant/members/updateRole', { data: { tenantId: selectedTenantId, userId: m.userId, role } });
                        if (!res.success) { setError(res.message || '更新失败'); return; }
                        setMembers(prev => prev.map(x => x.userId === m.userId ? { ...x, role } : x));
                        setMessage('已更新成员角色');
                      }}
                    >
                      <option value="member">member</option>
                      <option value="admin">admin</option>
                      <option value="owner">owner</option>
                    </select>
                    <button className="text-red-600" onClick={() => removeMember(m.userId)} disabled={m.role === 'owner'}>移除</button>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          <div className="border rounded p-3 space-y-2">
            <h3 className="font-medium">添加成员</h3>
            <input
              className="border px-2 py-1 rounded w-full"
              placeholder="成员邮箱"
              value={email}
              onChange={e => setEmail(e.target.value)}
            />
            <select className="border px-2 py-1 rounded" value={role} onChange={e => setRole(e.target.value as any)}>
              <option value="member">member</option>
              <option value="admin">admin</option>
            </select>
            <div>
              <button className="px-3 py-1 bg-blue-600 text-white rounded" onClick={addMember}>添加</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


