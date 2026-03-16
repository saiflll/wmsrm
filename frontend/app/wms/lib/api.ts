import axios from 'axios';

export const API = process.env.NEXT_PUBLIC_API_URL || 'http://172.20.100.11:3002';

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
