import axios from 'axios';
import { readAuthToken } from './browser-storage';

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000',
});

api.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = readAuthToken();
    const apiBase = new URL(config.baseURL || '/', window.location.origin);
    const requestOrigin = new URL(config.url || '', apiBase).origin;
    if (token && requestOrigin === apiBase.origin) config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export default api;
