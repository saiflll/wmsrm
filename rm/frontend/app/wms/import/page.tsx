'use client';
// @ts-nocheck
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import * as XLSX from 'xlsx';
import {
    Box, Paper, Title, Text, Button, Group, Stack, FileInput, Alert,
    Badge, Table, Loader, ScrollArea, Center
} from '@mantine/core';
import {
    IconUpload, IconDownload, IconFileSpreadsheet, IconAlertCircle,
    IconCheck, IconTruck, IconPackage, IconBuildingWarehouse, IconUsers,
    IconBoxSeam, IconMapPin, IconTransferIn, IconTransferOut, IconClipboardList
} from '@tabler/icons-react';
import { api, unwrap, saveXlsx, parseExcelDate } from '../lib/api';

const ROLE_OPTIONS = [
    { value: '1', label: '1 - Checker IB' },
    { value: '2', label: '2 - Checker OB' },
    { value: '3', label: '3 - Koordinator' },
    { value: '4', label: '4 - Supervisor' },
    { value: '5', label: '5 - Super Admin' },
    { value: '6', label: '6 - Reviewer' },
];

const parseDateTime = (val: any): string | null => {
    if (!val) return null;
    if (val instanceof Date) return val.toISOString();
    if (typeof val === 'number') {
        const date = new Date(Math.round((val - 25569) * 86400 * 1000));
        return isNaN(date.getTime()) ? null : date.toISOString();
    }
    if (typeof val === 'string') {
        const cleaned = val.trim();
        if (!cleaned) return null;
        const d = new Date(cleaned);
        return isNaN(d.getTime()) ? null : d.toISOString();
    }
    return null;
};

const normalize = (s: any) => String(s || '').trim().toLowerCase();

interface ImportConfig {
    key: string;
    title: string;
    description: string;
    color: string;
    icon: React.ReactNode;
    filename: string;
    headers: string[];
    sampleRows: any[][];
    process: (rows: any[], refs: RefData, apiInstance: any) => Promise<{ success: number; fail: number; errors: string[] }>;
}

interface RefData {
    barangs: any[];
    gudangs: any[];
    stocks: any[];
    shifts: any[];
    customers: any[];
}

const findBarang = (refs: RefData, item: any) => {
    const q = normalize(item);
    return refs.barangs.find((b) => normalize(b.nama) === q || normalize(b.sku) === q);
};

const findGudang = (refs: RefData, name: any) => {
    const q = normalize(name);
    return refs.gudangs.find((g) => normalize(g.name) === q);
};

const findShift = (refs: RefData, name: any) => {
    const q = normalize(name);
    return refs.shifts.find((s) => normalize(s.name) === q);
};

const findStock = (refs: RefData, barangId: number, gudangId: number, batch?: string) => {
    return refs.stocks.find((s) =>
        s.barang?.id === barangId &&
        s.gudang?.id === gudangId &&
        (batch === undefined || batch === '' || normalize(s.batch_no) === normalize(batch))
    );
};

const IMPORT_CONFIGS: ImportConfig[] = [
    {
        key: 'inbound',
        title: 'Inbound / Penerimaan',
        description: 'Import bulk penerimaan barang (wet/dry) ke gudang.',
        color: 'green',
        icon: <IconTransferIn size={20} />,
        filename: 'Template_Inbound.xlsx',
        headers: ['NoPO', 'Item', 'Qty', 'Satuan', 'Batch', 'Expired', 'Supplier', 'Shift', 'Zone', 'Rak'],
        sampleRows: [['PO-001', 'Dada Ayam', 100, 'Kg', 'B001', '2026-12-31', 'Supplier A', 'Shift 1', 'WET A', 'WET A-01-01']],
        process: async (rows, refs, apiInstance) => {
            let success = 0, fail = 0;
            const errors: string[] = [];
            for (let i = 0; i < rows.length; i++) {
                const r = rows[i];
                try {
                    const brg = findBarang(refs, r.Item);
                    const gud = findGudang(refs, r.Rak);
                    const shift = r.Shift ? findShift(refs, r.Shift) : null;
                    if (!brg) { fail++; errors.push(`Baris ${i + 1}: Item "${r.Item}" tidak ditemukan`); continue; }
                    if (!gud) { fail++; errors.push(`Baris ${i + 1}: Rak "${r.Rak}" tidak ditemukan`); continue; }
                    await apiInstance.post('/inventory/inbound', {
                        items: [{
                            no_po: String(r.NoPO || ''),
                            barang_id: brg.id,
                            gudang_id: gud.id,
                            qty: Number(r.Qty) || 0,
                            satuan: String(r.Satuan || brg.satuan || ''),
                            batch_no: String(r.Batch || ''),
                            expiry_date: parseExcelDate(r.Expired),
                            supplier: String(r.Supplier || ''),
                            shift_id: shift?.id,
                        }]
                    });
                    success++;
                } catch (e: any) {
                    fail++;
                    errors.push(`Baris ${i + 1}: ${e?.response?.data?.message || e.message || 'Gagal'}`);
                }
            }
            return { success, fail, errors };
        }
    },
    {
        key: 'outbound',
        title: 'Outbound / Pengiriman',
        description: 'Import bulk pengeluaran barang langsung (bukan picking).',
        color: 'red',
        icon: <IconTransferOut size={20} />,
        filename: 'Template_Outbound.xlsx',
        headers: ['NoRef', 'Item', 'RakAsal', 'Batch', 'Qty', 'Satuan', 'Tujuan', 'Shift'],
        sampleRows: [['SJ-001', 'Dada Ayam', 'WET A-01-01', 'B001', 50, 'Kg', 'Customer A', 'Shift 1']],
        process: async (rows, refs, apiInstance) => {
            let success = 0, fail = 0;
            const errors: string[] = [];
            for (let i = 0; i < rows.length; i++) {
                const r = rows[i];
                try {
                    const brg = findBarang(refs, r.Item);
                    const gud = findGudang(refs, r.RakAsal);
                    const shift = r.Shift ? findShift(refs, r.Shift) : null;
                    if (!brg) { fail++; errors.push(`Baris ${i + 1}: Item "${r.Item}" tidak ditemukan`); continue; }
                    if (!gud) { fail++; errors.push(`Baris ${i + 1}: RakAsal "${r.RakAsal}" tidak ditemukan`); continue; }
                    await apiInstance.post('/inventory/outbound', {
                        items: [{
                            no_ref: String(r.NoRef || ''),
                            barang_id: brg.id,
                            gudang_id: gud.id,
                            qty: Number(r.Qty) || 0,
                            satuan: String(r.Satuan || brg.satuan || ''),
                            tujuan: String(r.Tujuan || ''),
                            shift_id: shift?.id,
                            batch_no: String(r.Batch || ''),
                        }]
                    });
                    success++;
                } catch (e: any) {
                    fail++;
                    errors.push(`Baris ${i + 1}: ${e?.response?.data?.message || e.message || 'Gagal'}`);
                }
            }
            return { success, fail, errors };
        }
    },
    {
        key: 'picking',
        title: 'Picking Plan',
        description: 'Import bulk rencana picking (reservasi stok).',
        color: 'orange',
        icon: <IconClipboardList size={20} />,
        filename: 'Template_Picking.xlsx',
        headers: ['NoRef', 'Item', 'RakAsal', 'Batch', 'Qty', 'Satuan', 'Tujuan', 'Shift', 'TanggalPermintaan'],
        sampleRows: [['PK-001', 'Dada Ayam', 'WET A-01-01', 'B001', 50, 'Kg', 'Customer A', 'Shift 1', '2026-12-31']],
        process: async (rows, refs, apiInstance) => {
            let success = 0, fail = 0;
            const errors: string[] = [];
            for (let i = 0; i < rows.length; i++) {
                const r = rows[i];
                try {
                    const brg = findBarang(refs, r.Item);
                    const gud = findGudang(refs, r.RakAsal);
                    const shift = r.Shift ? findShift(refs, r.Shift) : null;
                    if (!brg) { fail++; errors.push(`Baris ${i + 1}: Item "${r.Item}" tidak ditemukan`); continue; }
                    if (!gud) { fail++; errors.push(`Baris ${i + 1}: RakAsal "${r.RakAsal}" tidak ditemukan`); continue; }
                    await apiInstance.post('/inventory/picking', {
                        items: [{
                            no_ref: String(r.NoRef || ''),
                            barang_id: brg.id,
                            gudang_id: gud.id,
                            qty: Number(r.Qty) || 0,
                            satuan: String(r.Satuan || brg.satuan || ''),
                            tujuan: String(r.Tujuan || ''),
                            shift_id: shift?.id,
                            batch_no: String(r.Batch || ''),
                            tanggal_permintaan: parseExcelDate(r.TanggalPermintaan),
                        }]
                    });
                    success++;
                } catch (e: any) {
                    fail++;
                    errors.push(`Baris ${i + 1}: ${e?.response?.data?.message || e.message || 'Gagal'}`);
                }
            }
            return { success, fail, errors };
        }
    },
    {
        key: 'relocation',
        title: 'Relocation / Pemindahan',
        description: 'Import bulk pemindahan stok antar rak.',
        color: 'grape',
        icon: <IconBoxSeam size={20} />,
        filename: 'Template_Relocation.xlsx',
        headers: ['NoPO', 'Item', 'RakAsal', 'RakTujuan', 'Batch', 'Qty', 'Note'],
        sampleRows: [['SJ-001', 'Dada Ayam', 'WET A-01-01', 'WET A-02-01', 'B001', 30, 'Pindah rack']],
        process: async (rows, refs, apiInstance) => {
            let success = 0, fail = 0;
            const errors: string[] = [];
            for (let i = 0; i < rows.length; i++) {
                const r = rows[i];
                try {
                    const brg = findBarang(refs, r.Item);
                    const gudAsal = findGudang(refs, r.RakAsal);
                    const gudTujuan = findGudang(refs, r.RakTujuan);
                    if (!brg) { fail++; errors.push(`Baris ${i + 1}: Item "${r.Item}" tidak ditemukan`); continue; }
                    if (!gudAsal) { fail++; errors.push(`Baris ${i + 1}: RakAsal "${r.RakAsal}" tidak ditemukan`); continue; }
                    if (!gudTujuan) { fail++; errors.push(`Baris ${i + 1}: RakTujuan "${r.RakTujuan}" tidak ditemukan`); continue; }
                    const stock = findStock(refs, brg.id, gudAsal.id, r.Batch);
                    if (!stock) { fail++; errors.push(`Baris ${i + 1}: Stok tidak ditemukan untuk ${r.Item} di ${r.RakAsal}`); continue; }
                    await apiInstance.post('/inventory/relocation', {
                        stock_id: stock.id,
                        gudang_tujuan_id: gudTujuan.id,
                        qty: Number(r.Qty) || 0,
                        no_po: String(r.NoPO || ''),
                        note: String(r.Note || ''),
                    });
                    success++;
                } catch (e: any) {
                    fail++;
                    errors.push(`Baris ${i + 1}: ${e?.response?.data?.message || e.message || 'Gagal'}`);
                }
            }
            return { success, fail, errors };
        }
    },
    {
        key: 'opname',
        title: 'Stock Opname',
        description: 'Import bulk hasil opname fisik per rak.',
        color: 'violet',
        icon: <IconClipboardList size={20} />,
        filename: 'Template_Opname.xlsx',
        headers: ['Zone', 'Rak', 'Item', 'Batch', 'QtyFisik', 'Shift', 'Note'],
        sampleRows: [['WET A', 'WET A-01-01', 'Dada Ayam', 'B001', 95, 'Shift 1', '']],
        process: async (rows, refs, apiInstance) => {
            let success = 0, fail = 0;
            const errors: string[] = [];
            for (let i = 0; i < rows.length; i++) {
                const r = rows[i];
                try {
                    const gud = findGudang(refs, r.Rak);
                    const brg = r.Item ? findBarang(refs, r.Item) : null;
                    const shift = r.Shift ? findShift(refs, r.Shift) : null;
                    if (!gud) { fail++; errors.push(`Baris ${i + 1}: Rak "${r.Rak}" tidak ditemukan`); continue; }
                    let stockId = undefined;
                    if (brg) {
                        const stock = findStock(refs, brg.id, gud.id, r.Batch);
                        if (stock) stockId = stock.id;
                    }
                    await apiInstance.post('/inventory/opname', {
                        gudang_id: gud.id,
                        stock_id: stockId,
                        qty_opname: Number(r.QtyFisik) || 0,
                        shift_id: shift?.id,
                    });
                    success++;
                } catch (e: any) {
                    fail++;
                    errors.push(`Baris ${i + 1}: ${e?.response?.data?.message || e.message || 'Gagal'}`);
                }
            }
            return { success, fail, errors };
        }
    },
    {
        key: 'produk',
        title: 'Master Produk',
        description: 'Import bulk master barang/produk.',
        color: 'blue',
        icon: <IconPackage size={20} />,
        filename: 'Template_Produk.xlsx',
        headers: ['SKU', 'Nama', 'Satuan', 'Kategori', 'MinStok', 'MaxStok'],
        sampleRows: [['SKU001', 'Dada Ayam', 'Kg', 'Wet', 50, 1000]],
        process: async (rows, refs, apiInstance) => {
            let success = 0, fail = 0;
            const errors: string[] = [];
            for (let i = 0; i < rows.length; i++) {
                const r = rows[i];
                try {
                    await apiInstance.post('/barang', {
                        sku: String(r.SKU || ''),
                        nama: String(r.Nama || ''),
                        satuan: String(r.Satuan || 'Kg'),
                        kategori: String(r.Kategori || 'Dry'),
                        min_stok: Number(r.MinStok) || 0,
                        max_stok: Number(r.MaxStok) || 1000,
                    });
                    success++;
                } catch (e: any) {
                    fail++;
                    errors.push(`Baris ${i + 1}: ${e?.response?.data?.message || e.message || 'Gagal'}`);
                }
            }
            return { success, fail, errors };
        }
    },
    {
        key: 'lokasi',
        title: 'Master Lokasi / Rak',
        description: 'Import bulk master gudang/rak.',
        color: 'cyan',
        icon: <IconMapPin size={20} />,
        filename: 'Template_Lokasi.xlsx',
        headers: ['NamaRak', 'Zone', 'Kolom', 'Level', 'Type'],
        sampleRows: [['WET A-01-01', 'WET A', '01', 1, 'Single Deep']],
        process: async (rows, refs, apiInstance) => {
            let success = 0, fail = 0;
            const errors: string[] = [];
            for (let i = 0; i < rows.length; i++) {
                const r = rows[i];
                try {
                    const zone = String(r.Zone || '').toUpperCase();
                    await apiInstance.post('/gudang', {
                        name: String(r.NamaRak || ''),
                        zone,
                        kolom: String(r.Kolom || ''),
                        level: Number(r.Level) || 1,
                        type: String(r.Type || 'Single Deep'),
                        side: ['DRY A', 'DRY B', 'DRY FG'].includes(zone),
                        status: true,
                    });
                    success++;
                } catch (e: any) {
                    fail++;
                    errors.push(`Baris ${i + 1}: ${e?.response?.data?.message || e.message || 'Gagal'}`);
                }
            }
            return { success, fail, errors };
        }
    },
    {
        key: 'customer',
        title: 'Master Customer / Supplier',
        description: 'Import bulk master customer atau supplier.',
        color: 'pink',
        icon: <IconBuildingWarehouse size={20} />,
        filename: 'Template_Customer.xlsx',
        headers: ['Nama', 'Alamat', 'Telp', 'Tipe'],
        sampleRows: [['Customer A', 'Jl. Mawar No.1', '08123456789', 'customer']],
        process: async (rows, refs, apiInstance) => {
            let success = 0, fail = 0;
            const errors: string[] = [];
            for (let i = 0; i < rows.length; i++) {
                const r = rows[i];
                try {
                    await apiInstance.post('/customers', {
                        nama: String(r.Nama || ''),
                        alamat: String(r.Alamat || ''),
                        telp: String(r.Telp || ''),
                        tipe: String(r.Tipe || 'customer'),
                    });
                    success++;
                } catch (e: any) {
                    fail++;
                    errors.push(`Baris ${i + 1}: ${e?.response?.data?.message || e.message || 'Gagal'}`);
                }
            }
            return { success, fail, errors };
        }
    },
    {
        key: 'driver',
        title: 'Driver Planning',
        description: 'Import bulk jadwal kedatangan driver inbound.',
        color: 'indigo',
        icon: <IconTruck size={20} />,
        filename: 'Template_Driver_Planning.xlsx',
        headers: ['NoPO', 'DriverName', 'PlatNomor', 'Supplier', 'ETA', 'Status', 'Note'],
        sampleRows: [['PO-001', 'Budi', 'B 1234 ABC', 'Supplier A', '2026-12-31 08:00', 'WAIT', '']],
        process: async (rows, refs, apiInstance) => {
            let success = 0, fail = 0;
            const errors: string[] = [];
            for (let i = 0; i < rows.length; i++) {
                const r = rows[i];
                try {
                    await apiInstance.post('/inbound-planning', {
                        no_po: String(r.NoPO || ''),
                        driver_name: String(r.DriverName || ''),
                        plat_nomor: String(r.PlatNomor || ''),
                        supplier: String(r.Supplier || ''),
                        estimasi_datang: parseDateTime(r.ETA),
                        status: String(r.Status || 'WAIT'),
                        note: String(r.Note || ''),
                    });
                    success++;
                } catch (e: any) {
                    fail++;
                    errors.push(`Baris ${i + 1}: ${e?.response?.data?.message || e.message || 'Gagal'}`);
                }
            }
            return { success, fail, errors };
        }
    },
    {
        key: 'users',
        title: 'Users / Pengguna',
        description: 'Import bulk user akun (khusus Super Admin).',
        color: 'teal',
        icon: <IconUsers size={20} />,
        filename: 'Template_Users.xlsx',
        headers: ['Username', 'Password', 'RoleID'],
        sampleRows: [['admin2', 'password123', 5]],
        process: async (rows, refs, apiInstance) => {
            let success = 0, fail = 0;
            const errors: string[] = [];
            for (let i = 0; i < rows.length; i++) {
                const r = rows[i];
                try {
                    await apiInstance.post('/users', {
                        username: String(r.Username || ''),
                        password: String(r.Password || ''),
                        role: Number(r.RoleID) || 1,
                    });
                    success++;
                } catch (e: any) {
                    fail++;
                    errors.push(`Baris ${i + 1}: ${e?.response?.data?.message || e.message || 'Gagal'}`);
                }
            }
            return { success, fail, errors };
        }
    },
];

interface SheetImport {
    sheetName: string;
    config: ImportConfig;
    rows: any[];
    status: 'pending' | 'importing' | 'success' | 'error';
    results?: { success: number; fail: number; errors: string[] };
}

const statusColor = (status: SheetImport['status']): string => {
    switch (status) {
        case 'pending': return 'gray';
        case 'importing': return 'blue';
        case 'success': return 'green';
        case 'error': return 'red';
        default: return 'gray';
    }
};

export default function ImportPage() {
    const [userRole, setUserRole] = useState<number | null>(null);
    const [loading, setLoading] = useState(true);
    const [refs, setRefs] = useState<RefData>({ barangs: [], gudangs: [], stocks: [], shifts: [], customers: [] });
    const [error, setError] = useState<string | null>(null);
    const [sheetImports, setSheetImports] = useState<SheetImport[]>([]);
    const [unrecognizedSheets, setUnrecognizedSheets] = useState<string[]>([]);
    const [importingAll, setImportingAll] = useState(false);

    useEffect(() => {
        const u = JSON.parse(localStorage.getItem('user') || '{}');
        setUserRole(u?.role || null);
    }, []);

    useEffect(() => {
        const loadRefs = async () => {
            try {
                const apiInstance = api();
                const [barangRes, gudangRes, stockRes, shiftRes, customerRes] = await Promise.all([
                    apiInstance.get('/barang'),
                    apiInstance.get('/gudang'),
                    apiInstance.get('/inventory/stock'),
                    apiInstance.get('/shifts'),
                    apiInstance.get('/customers'),
                ]);
                setRefs({
                    barangs: unwrap(barangRes) || [],
                    gudangs: unwrap(gudangRes) || [],
                    stocks: unwrap(stockRes) || [],
                    shifts: unwrap(shiftRes) || [],
                    customers: unwrap(customerRes) || [],
                });
            } catch (e: any) {
                setError('Gagal memuat data referensi: ' + (e?.message || 'Unknown error'));
            }
            setLoading(false);
        };
        loadRefs();
    }, []);

    const handleFileUpload = async (file: File | null) => {
        if (!file) {
            setSheetImports([]);
            setUnrecognizedSheets([]);
            return;
        }
        try {
            const data = await file.arrayBuffer();
            const wb = XLSX.read(data, { type: 'array', cellDates: true });

            const recognized: SheetImport[] = [];
            const unrecognized: string[] = [];

            for (const sheetName of wb.SheetNames) {
                const config = IMPORT_CONFIGS.find(c => c.key === sheetName.toLowerCase());
                if (!config) {
                    unrecognized.push(sheetName);
                    continue;
                }
                const json = XLSX.utils.sheet_to_json(wb.Sheets[sheetName]);
                recognized.push({
                    sheetName,
                    config,
                    rows: json,
                    status: 'pending',
                });
            }

            setSheetImports(recognized);
            setUnrecognizedSheets(unrecognized);
        } catch (err) {
            setSheetImports([]);
            setUnrecognizedSheets([]);
            setError('Gagal membaca file Excel: ' + (err instanceof Error ? err.message : 'Unknown error'));
        }
    };

    const importSheet = async (sheetImport: SheetImport) => {
        setSheetImports(prev => prev.map(s =>
            s.sheetName === sheetImport.sheetName ? { ...s, status: 'importing' } : s
        ));

        try {
            const apiInstance = api();
            const results = await sheetImport.config.process(sheetImport.rows, refs, apiInstance);
            setSheetImports(prev => prev.map(s =>
                s.sheetName === sheetImport.sheetName
                    ? { ...s, status: results.fail === 0 ? 'success' : 'error', results }
                    : s
            ));
        } catch (err: any) {
            setSheetImports(prev => prev.map(s =>
                s.sheetName === sheetImport.sheetName
                    ? { ...s, status: 'error', results: { success: 0, fail: sheetImport.rows.length, errors: [err?.message || 'Gagal mengimport'] } }
                    : s
            ));
        }
    };

    const importAll = async () => {
        setImportingAll(true);
        for (const sheet of sheetImports) {
            if (sheet.status === 'pending') {
                await importSheet(sheet);
            }
        }
        setImportingAll(false);
    };

    const downloadTemplate = (config: ImportConfig) => {
        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.aoa_to_sheet([config.headers, ...config.sampleRows]);
        XLSX.utils.book_append_sheet(wb, ws, 'Template');
        saveXlsx(XLSX, wb, config.filename);
    };

    if (userRole !== null && userRole !== 5) {
        return (
            <Center h="60vh">
                <Alert icon={<IconAlertCircle size={20} />} color="red" title="Akses Ditolak">
                    Halaman Import Data hanya dapat diakses oleh Super Admin.
                </Alert>
            </Center>
        );
    }

    if (loading) {
        return <Center h="60vh"><Loader size="lg" /></Center>;
    }

    if (error && sheetImports.length === 0) {
        return (
            <Center h="60vh">
                <Alert icon={<IconAlertCircle size={20} />} color="red" title="Error">{error}</Alert>
            </Center>
        );
    }

    const pendingCount = sheetImports.filter(s => s.status === 'pending').length;

    return (
        <Box>
            <Paper withBorder p="md" mb="md" radius="md" style={{ background: 'linear-gradient(135deg, #e7f5ff 0%, #d0ebff 100%)' }}>
                <Group gap="sm">
                    <IconUpload size={28} color="#228be6" />
                    <div>
                        <Title order={4}>Import Data WMS</Title>
                        <Text size="sm" c="dimmed">Upload satu file Excel dengan beberapa sheet. Setiap sheet akan diimpor sesuai namanya (inbound, outbound, picking, relocation, opname, produk, lokasi, customer, driver, users).</Text>
                    </div>
                </Group>
            </Paper>

            {/* File Upload */}
            <Paper withBorder p="md" mb="md" radius="md" style={{ background: '#fff' }}>
                <FileInput
                    label="Upload Excel File"
                    description="Pilih file Excel (.xlsx / .xls) yang berisi sheet-sheet data untuk diimport"
                    placeholder="Pilih file Excel..."
                    accept=".xlsx,.xls"
                    onChange={handleFileUpload}
                    leftSection={<IconFileSpreadsheet size={16} />}
                    size="md"
                />
            </Paper>

            {/* Error banner (non-fatal, e.g. read error after file was already loaded) */}
            {error && (
                <Alert icon={<IconAlertCircle size={18} />} color="red" variant="light" mb="md" withCloseButton onClose={() => setError(null)}>
                    {error}
                </Alert>
            )}

            {/* Unrecognized sheets warning */}
            {unrecognizedSheets.length > 0 && (
                <Alert icon={<IconAlertCircle size={18} />} color="yellow" variant="light" mb="md">
                    <Text fw={600} size="sm">Sheet tidak dikenali (dilewati):</Text>
                    <Text size="xs" c="dimmed">{unrecognizedSheets.join(', ')}</Text>
                </Alert>
            )}

            {/* Sheet Previews */}
            <Stack gap="md">
                {sheetImports.map((sheet) => {
                    const previewRows = sheet.rows.slice(0, 3);
                    const columns = previewRows.length > 0 ? Object.keys(previewRows[0]) : sheet.config.headers;

                    return (
                        <Paper key={sheet.sheetName} withBorder p="md" radius="md" style={{ background: '#fff', boxShadow: '0 2px 12px rgba(0,0,0,0.04)' }}>
                            <Group justify="space-between" mb="sm">
                                <Group gap="sm">
                                    <Box style={{ color: `var(--mantine-color-${sheet.config.color}-filled)` }}>{sheet.config.icon}</Box>
                                    <div>
                                        <Text fw={700}>{sheet.sheetName}</Text>
                                        <Text size="xs" c="dimmed">{sheet.config.title} — {sheet.rows.length} rows</Text>
                                    </div>
                                </Group>
                                <Group gap="xs">
                                    <Badge color={statusColor(sheet.status)} variant="light">
                                        {sheet.status === 'pending' ? 'Pending' : sheet.status === 'importing' ? 'Importing...' : sheet.status === 'success' ? 'Success' : 'Error'}
                                    </Badge>
                                    <Button size="xs" variant="light" leftSection={<IconDownload size={14} />} onClick={() => downloadTemplate(sheet.config)}>
                                        Template
                                    </Button>
                                </Group>
                            </Group>

                            {/* Preview Table */}
                            {previewRows.length > 0 && (
                                <Box mb="sm">
                                    <Text size="xs" fw={700} mb={6}>Preview (3 dari {sheet.rows.length} baris):</Text>
                                    <ScrollArea>
                                        <Table withTableBorder withColumnBorders style={{ fontSize: 11 }}>
                                            <Table.Thead style={{ background: '#f8f9fa' }}>
                                                <Table.Tr>
                                                    {columns.map((col) => (
                                                        <Table.Th key={col} style={{ fontSize: 10 }}>{col}</Table.Th>
                                                    ))}
                                                </Table.Tr>
                                            </Table.Thead>
                                            <Table.Tbody>
                                                {previewRows.map((row, idx) => (
                                                    <Table.Tr key={idx}>
                                                        {columns.map((col) => (
                                                            <Table.Td key={col} style={{ fontSize: 10 }}>{String(row[col] ?? '')}</Table.Td>
                                                        ))}
                                                    </Table.Tr>
                                                ))}
                                            </Table.Tbody>
                                        </Table>
                                    </ScrollArea>
                                </Box>
                            )}

                            {sheet.rows.length === 0 && (
                                <Text size="xs" c="dimmed" mb="sm">Sheet ini kosong, tidak ada data untuk diimport.</Text>
                            )}

                            {/* Results */}
                            {sheet.results && (
                                <Alert
                                    icon={<IconAlertCircle size={18} />}
                                    color={sheet.results.fail === 0 ? 'green' : sheet.results.success === 0 ? 'red' : 'yellow'}
                                    variant="light"
                                    radius="md"
                                    mb="sm"
                                >
                                    <Group gap="sm" mb="xs">
                                        <Badge color="green" leftSection={<IconCheck size={12} />}>{sheet.results.success} sukses</Badge>
                                        <Badge color="red">{sheet.results.fail} gagal</Badge>
                                    </Group>
                                    {sheet.results.errors.length > 0 && (
                                        <Box style={{ maxHeight: 120, overflowY: 'auto', fontSize: 11 }}>
                                            {sheet.results.errors.slice(0, 20).map((err, i) => (
                                                <Text key={i} c="red" size="xs">• {err}</Text>
                                            ))}
                                            {sheet.results.errors.length > 20 && <Text size="xs" c="dimmed">...dan {sheet.results.errors.length - 20} error lainnya</Text>}
                                        </Box>
                                    )}
                                </Alert>
                            )}

                            {/* Import Button */}
                            <Button
                                color={sheet.config.color}
                                leftSection={<IconUpload size={16} />}
                                onClick={() => importSheet(sheet)}
                                loading={sheet.status === 'importing'}
                                disabled={sheet.status !== 'pending' || sheet.rows.length === 0}
                            >
                                Import Sheet {sheet.rows.length > 0 && `(${sheet.rows.length})`}
                            </Button>
                        </Paper>
                    );
                })}
            </Stack>

            {/* Import All Button */}
            {sheetImports.length > 0 && (
                <Paper withBorder p="md" mt="md" radius="md" style={{ background: '#fff' }}>
                    <Group justify="space-between">
                        <div>
                            <Text fw={600}>{pendingCount} sheet siap diimport</Text>
                            <Text size="xs" c="dimmed">dari {sheetImports.length} sheet terdeteksi</Text>
                        </div>
                        <Button
                            size="lg"
                            color="blue"
                            leftSection={<IconUpload size={18} />}
                            onClick={importAll}
                            loading={importingAll}
                            disabled={pendingCount === 0}
                        >
                            Import All Sheets
                        </Button>
                    </Group>
                </Paper>
            )}
        </Box>
    );
}
