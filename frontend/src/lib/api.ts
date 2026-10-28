import axios from 'axios';
import { readAuthToken } from './browser-storage';
import { GOAL, errorRoute, reportError } from './metrika';

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

// Сервер не ответил или упал (5xx) — цель api_error с адресом без id. Ответы 4xx
// штатные (не вошёл, неверный код), отменённые запросы — тоже не ошибка.
api.interceptors.response.use(undefined, (error) => {
  const status = error?.response?.status;
  if (typeof window !== 'undefined' && !axios.isCancel(error) && (!status || status >= 500)) {
    reportError(GOAL.apiError, { route: errorRoute(String(error?.config?.url || '')), status: status || 'network' });
  }
  return Promise.reject(error);
});

export default api;
