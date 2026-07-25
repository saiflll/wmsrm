import axios from 'axios';

export const API = '/api';

export const getToken = () => typeof window !== 'undefined' ? localStorage.getItem('token') : '';

export const api = () => {
    const instance = axios.create({
        baseURL: API,
        headers: { Authorization: `Bearer ${getToken()}` },
    });
    instance.interceptors.response.use(
        (res) => res,
        (error) => {
            if (error.response?.status === 401 && typeof window !== 'undefined') {
                localStorage.removeItem('token');
                localStorage.removeItem('user');
                window.location.href = '/login';
            }
            return Promise.reject(error);
        }
    );
    return instance;
};

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

// Deduplicate Mantine Select options by value to prevent duplicate error
export const dedup = <T extends { value: string }>(arr: T[]): T[] => {
  const seen = new Set<string>();
  return arr.filter(item => {
    if (seen.has(item.value)) return false;
    seen.add(item.value);
    return true;
  });
};

export const fetchUsers = async () => {
    const res = await axios.get(`${API}/users`, { headers: { Authorization: `Bearer ${getToken()}` } });
    return unwrap(res);
};

export const createUser = async (data: { username: string; password: string; role: number; nama?: string; is_active?: boolean }) => {
    const res = await axios.post(`${API}/users`, data, { headers: { Authorization: `Bearer ${getToken()}` } });
    return unwrap(res);
};

export const updateUser = async (id: number, data: { username?: string; password?: string; role?: number; nama?: string; is_active?: boolean }) => {
    const res = await axios.patch(`${API}/users/${id}`, data, { headers: { Authorization: `Bearer ${getToken()}` } });
    return unwrap(res);
};

export const deleteUser = async (id: number) => {
    const res = await axios.delete(`${API}/users/${id}`, { headers: { Authorization: `Bearer ${getToken()}` } });
    return unwrap(res);
};

export const fetchLoginLogs = async (page = 1, limit = 50) => {
    const res = await axios.get(`${API}/auth/login-logs?page=${page}&limit=${limit}`, { headers: { Authorization: `Bearer ${getToken()}` } });
    return unwrap(res);
};

export const saveXlsx = (XLSXLib: any, wb: any, filename: string) => {
    const fname = filename.endsWith('.xlsx') ? filename : `${filename}.xlsx`;
    // Tulis workbook ke base64 string
    const wbout: string = XLSXLib.write(wb, { bookType: 'xlsx', type: 'base64' });
    // Data URI — tidak ada blob URL, tidak ada timing issue
    const dataUri = `data:application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;base64,${wbout}`;
    const a = document.createElement('a');
    a.href = dataUri;
    a.download = fname;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
};

export const parseExcelDate = (val: any): string | null => {
    if (!val) return null;
    if (val instanceof Date) {
        if (isNaN(val.getTime())) return null;
        return val.toISOString().split('T')[0];
    }
    if (typeof val === 'number') {
        const date = new Date(Math.round((val - 25569) * 86400 * 1000));
        if (isNaN(date.getTime())) return null;
        return date.toISOString().split('T')[0];
    }
    if (typeof val === 'string') {
        const cleaned = val.trim();
        if (!cleaned) return null;
        if (/^\d{4}-\d{2}-\d{2}$/.test(cleaned)) {
            return cleaned;
        }
        const parts = cleaned.split(/[-/]/);
        if (parts.length === 3) {
            if (parts[0].length === 4) {
                return `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
            } else if (parts[2].length === 4) {
                return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
            }
        }
        const parsed = new Date(cleaned);
        if (!isNaN(parsed.getTime())) {
            return parsed.toISOString().split('T')[0];
        }
    }
    return null;
};

