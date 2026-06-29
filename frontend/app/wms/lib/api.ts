import axios from 'axios';

export const API = '/api';

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

/**
 * Download workbook sebagai file .xlsx di browser.
 * Menggunakan data: URI base64 — paling reliable karena:
 * - Tidak ada timing issue (tidak pakai blob URL yang bisa expire sebelum download mulai)
 * - Tidak perlu library eksternal seperti file-saver
 * - Browser langsung pakai attribute `download` sebagai nama file
 *
 * Usage: saveXlsx(XLSX, wb, 'NamaFile.xlsx')
 */
export const fetchUsers = async () => {
    const res = await axios.get(`${API}/users`, { headers: { Authorization: `Bearer ${getToken()}` } });
    return unwrap(res);
};

export const createUser = async (data: { username: string; password: string; role: number }) => {
    const res = await axios.post(`${API}/users`, data, { headers: { Authorization: `Bearer ${getToken()}` } });
    return unwrap(res);
};

export const updateUser = async (id: number, data: { username?: string; password?: string; role?: number }) => {
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
