'use client';
import { useState } from 'react';
import { apiFetch } from '../../lib/api';
import { useRouter } from 'next/navigation';

interface LoginResponseData {
    token: string;
    user?: {
        id: string;
        email: string;
        username: string;
    };
}

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const router = useRouter();

  const handleLogin = async () => {
    const res = await apiFetch<LoginResponseData>('user/login', { data: {email, password }});
    if (res.success && res.data?.token) {
      localStorage.setItem('jwt', res.data.token);
      router.push('/');
    } else {
      setError(res.message || '登录失败');
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen">
      <h2 className="text-2xl mb-4">登录</h2>
      <input className="border p-2 mb-2" placeholder="邮箱" onChange={e => setEmail(e.target.value)} />
      <input
        className="border p-2 mb-2"
        placeholder="密码"
        type="password"
        onChange={e => setPassword(e.target.value)}
      />
      <button onClick={handleLogin} className="bg-blue-600 text-white px-4 py-2 rounded">登录</button>
      {error && <p className="text-red-500 mt-2">{error}</p>}
    </div>
  );
}
