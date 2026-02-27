import axios from 'axios';

export const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export const getToken = () => typeof window !== 'undefined' ? localStorage.getItem('token') : '';

export const api = () => axios.create({
    baseURL: API,
    headers: { Authorization: `Bearer ${getToken()}` },
});

export const fmt = (d: string | Date) => {
    if (!d) return '-';
    const dt = new Date(d);
    return `${String(dt.getDate()).padStart(2, '0')}/${String(dt.getMonth() + 1).padStart(2, '0')}/${dt.getFullYear()}`;
};

export const isNearExp = (d: string | Date) => {
    if (!d) return false;
    const diff = (new Date(d).getTime() - Date.now()) / (1000 * 60 * 60 * 24);
    return diff < 30;
};

export const isExpired = (d: string | Date) => {
    if (!d) return false;
    return new Date(d).getTime() < Date.now();
};

export const statusLabel = (d: string | Date) => isExpired(d) ? 'EXPIRED' : isNearExp(d) ? 'NEAR EXPIRED' : 'SAFE';
export const statusColor = (d: string | Date) => isExpired(d) ? 'red' : isNearExp(d) ? 'orange' : 'green';

// Helper: unwrap response wrapped by TransformInterceptor
export const unwrap = (res: any) => res?.data?.data ?? res?.data ?? res;
