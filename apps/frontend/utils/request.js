import axios from 'axios';

const instance = axios.create({
  baseURL: process.env.NEXT_PUBLIC_BACKEND_URL,
  timeout: 10000,
});

// 可选：添加拦截器
// instance.interceptors.request.use(config => {
//   config.headers.Authorization = `Bearer ${localStorage.getItem('token')}`;
//   return config;
// });

export default instance;
