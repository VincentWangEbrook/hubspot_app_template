'use client';
import { useState } from 'react';
import { apiFetch } from '../../lib/api';
import { useRouter } from 'next/navigation';

interface ChangePasswordResponseData {
    token: string;
    user?: {
        id: string;
        email: string;
        username: string;
    };
}

export default function ChangePasswordPage() {
  const [oldPwd, setOldPwd] = useState('');
  const [newPwd, setNewPwd] = useState('');
  const [msg, setMsg] = useState('');

  const handleChange = async () => {
    const res = await apiFetch<ChangePasswordResponseData>('user/change-password', { data: {oldPassword: oldPwd, newPassword: newPwd }} );
    setMsg(res.message || '修改成功');
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen">
      <h2 className="text-2xl mb-4">修改密码</h2>
      <input className="border p-2 mb-2" placeholder="旧密码" type="password" onChange={e => setOldPwd(e.target.value)} />
      <input className="border p-2 mb-2" placeholder="新密码" type="password" onChange={e => setNewPwd(e.target.value)} />
      <button onClick={handleChange} className="bg-blue-600 text-white px-4 py-2 rounded">提交</button>
      {msg && <p className="mt-2">{msg}</p>}
    </div>
  );
}
