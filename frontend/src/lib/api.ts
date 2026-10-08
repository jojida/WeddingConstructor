import axios from 'axios';
import { readAuthToken } from './browser-storage';

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000',
});

api.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = readAuthToken();
    const trustedOrigin = new URL(api.defaults.baseURL || '/', window.location.origin).origin;
    const requestBase = new URL(config.baseURL || '/', window.location.origin);
    const requestOrigin = new URL(config.url || '', requestBase).origin;
    if (token && requestOrigin === trustedOrigin) config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export default api;
