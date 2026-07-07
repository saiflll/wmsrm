import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config) => {
  const token = typeof window !== 'undefined' ? localStorage.getItem('fg_token') : null;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (res) => res.data?.data !== undefined ? res.data.data : res.data,
  (err) => {
    if (err.response?.status === 401 && typeof window !== 'undefined') {
      localStorage.removeItem('fg_token');
      localStorage.removeItem('fg_user');
      window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);

export default api;

export function unwrap(res: any) {
  return res?.data ?? res;
}

export function fmt(d: string | Date) {
  if (!d) return '-';
  const date = new Date(d);
  return date.toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export function fmtDateTime(d: string | Date) {
  if (!d) return '-';
  const date = new Date(d);
  return date.toLocaleString('id-ID');
}
