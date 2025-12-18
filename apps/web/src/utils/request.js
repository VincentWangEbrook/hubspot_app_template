import axios from 'axios';

const instance = axios.create({
  baseURL: process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001/api',
  timeout: 10000,
  withCredentials: true, // 允许发送cookies（session认证需要）
});

// 附带认证头
instance.interceptors.request.use(config => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('jwt');
    if (token) {
      config.headers = config.headers || {};
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

export default instance;
