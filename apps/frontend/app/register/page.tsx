'use client';
import { useState } from 'react';
import { apiFetch } from '../../lib/api';
import { useRouter } from 'next/navigation';

// 注册成功后后端返回的格式
interface RegisterResponseData {
    token: string;
    user?: {
        id: string;
        email: string;
        username: string;
    };
}

export default function RegisterPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const router = useRouter();

  const handleRegister = async () => {
    const res = await apiFetch<RegisterResponseData>('user/register', { data: { email, password, username }} );
    if (res.success && res.data?.token) {
      localStorage.setItem('jwt', res.data.token);
      router.push('/');
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen">
      <h2 className="text-2xl mb-4">注册</h2>
      <input className="border p-2 mb-2" placeholder="用户名" onChange={e => setUsername(e.target.value)} />
      <input className="border p-2 mb-2" placeholder="邮箱" onChange={e => setEmail(e.target.value)} />
      <input className="border p-2 mb-2" placeholder="密码" type="password" onChange={e => setPassword(e.target.value)} />
      <button onClick={handleRegister} className="bg-green-600 text-white px-4 py-2 rounded">注册</button>
    </div>
  );
}
