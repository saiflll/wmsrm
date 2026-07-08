'use client';
// @ts-nocheck
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import * as XLSX from 'xlsx';
import {
    Box, Tabs, Paper, Title, Text, Button, Group, Stack, FileInput, Alert,
    Progress, Badge, Table, Loader, ScrollArea, Center
} from '@mantine/core';
import {
    IconUpload, IconDownload, IconFileSpreadsheet, IconAlertCircle,
    IconCheck, IconTruck, IconPackage, IconBuildingWarehouse, IconUsers,
    IconBoxSeam, IconMapPin, IconTransferIn, IconTransferOut, IconClipboardList,
    IconCalendarStats
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

const ImportSection = ({ config, refs }: { config: ImportConfig; refs: RefData }) => {
    const [file, setFile] = useState<File | null>(null);
    const [rows, setRows] = useState<any[]>([]);
    const [importing, setImporting] = useState(false);
    const [progress, setProgress] = useState(0);
    const [result, setResult] = useState<{ success: number; fail: number; errors: string[] } | null>(null);

    const downloadTemplate = () => {
        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.aoa_to_sheet([config.headers, ...config.sampleRows]);
        XLSX.utils.book_append_sheet(wb, ws, 'Template');
        saveXlsx(XLSX, wb, config.filename);
    };

    const handleFile = (f: File | null) => {
        setFile(f);
        setResult(null);
        setProgress(0);
        if (!f) { setRows([]); return; }
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = new Uint8Array(e.target?.result as ArrayBuffer);
                const wb = XLSX.read(data, { type: 'array', cellDates: true });
                const json = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
                setRows(json);
            } catch (err) {
                setRows([]);
                setResult({ success: 0, fail: 0, errors: ['Gagal membaca file Excel.'] });
            }
        };
        reader.readAsArrayBuffer(f);
    };

    const runImport = async () => {
        if (!rows.length) return;
        setImporting(true);
        setProgress(0);
        setResult(null);
        const apiInstance = api();
        const res = await config.process(rows, refs, apiInstance);
        setResult(res);
        setProgress(100);
        setImporting(false);
    };

    const previewRows = rows.slice(0, 5);

    return (
        <Paper withBorder p="md" radius="md" style={{ background: '#fff', boxShadow: '0 2px 12px rgba(0,0,0,0.04)' }}>
            <Group justify="space-between" mb="sm">
                <Group gap="sm">
                    <Box style={{ color: `var(--mantine-color-${config.color}-filled)` }}>{config.icon}</Box>
                    <div>
                        <Text fw={700}>{config.title}</Text>
                        <Text size="xs" c="dimmed">{config.description}</Text>
                    </div>
                </Group>
                <Button size="xs" variant="light" leftSection={<IconDownload size={14} />} onClick={downloadTemplate}>
                    Download Template
                </Button>
            </Group>

            <Group align="flex-end" gap="sm" mb="md">
                <FileInput
                    placeholder="Pilih file Excel..."
                    accept=".xlsx,.xls"
                    value={file}
                    onChange={handleFile}
                    leftSection={<IconFileSpreadsheet size={16} />}
                    style={{ flex: 1 }}
                    disabled={importing}
                />
                <Button
                    color={config.color}
                    leftSection={<IconUpload size={16} />}
                    onClick={runImport}
                    loading={importing}
                    disabled={!rows.length}
                >
                    Import {rows.length > 0 && `(${rows.length})`}
                </Button>
            </Group>

            {importing && <Progress value={progress} animated color={config.color} mb="md" />}

            {previewRows.length > 0 && !result && (
                <Box mb="md">
                    <Text size="xs" fw={700} mb={6}>Preview ({Math.min(rows.length, 5)} dari {rows.length} baris):</Text>
                    <ScrollArea>
                        <Table withTableBorder withColumnBorders style={{ fontSize: 11 }}>
                            <Table.Thead style={{ background: '#f8f9fa' }}>
                                <Table.Tr>
                                    {config.headers.map((h) => (
                                        <Table.Th key={h} style={{ fontSize: 10 }}>{h}</Table.Th>
                                    ))}
                                </Table.Tr>
                            </Table.Thead>
                            <Table.Tbody>
                                {previewRows.map((r, i) => (
                                    <Table.Tr key={i}>
                                        {config.headers.map((h) => (
                                            <Table.Td key={h} style={{ fontSize: 10 }}>{String(r[h] ?? '')}</Table.Td>
                                        ))}
                                    </Table.Tr>
                                ))}
                            </Table.Tbody>
                        </Table>
                    </ScrollArea>
                </Box>
            )}

            {result && (
                <Alert
                    icon={<IconAlertCircle size={18} />}
                    color={result.fail === 0 ? 'green' : result.success === 0 ? 'red' : 'yellow'}
                    variant="light"
                    radius="md"
                >
                    <Group gap="sm" mb="xs">
                        <Badge color="green" leftSection={<IconCheck size={12} />}>{result.success} sukses</Badge>
                        <Badge color="red">{result.fail} gagal</Badge>
                    </Group>
                    {result.errors.length > 0 && (
                        <Box style={{ maxHeight: 120, overflowY: 'auto', fontSize: 11 }}>
                            {result.errors.slice(0, 20).map((err, i) => (
                                <Text key={i} c="red" size="xs">• {err}</Text>
                            ))}
                            {result.errors.length > 20 && <Text size="xs" c="dimmed">...dan {result.errors.length - 20} error lainnya</Text>}
                        </Box>
                    )}
                </Alert>
            )}
        </Paper>
    );
};

export default function ImportPage() {
    const [userRole, setUserRole] = useState<number | null>(null);
    const [loading, setLoading] = useState(true);
    const [refs, setRefs] = useState<RefData>({ barangs: [], gudangs: [], stocks: [], shifts: [], customers: [] });
    const [error, setError] = useState<string | null>(null);

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

    if (error) {
        return (
            <Center h="60vh">
                <Alert icon={<IconAlertCircle size={20} />} color="red" title="Error">{error}</Alert>
            </Center>
        );
    }

    const transactionConfigs = IMPORT_CONFIGS.filter((c) => ['inbound', 'outbound', 'picking', 'relocation', 'opname'].includes(c.key));
    const masterConfigs = IMPORT_CONFIGS.filter((c) => ['produk', 'lokasi', 'customer'].includes(c.key));
    const planningConfigs = IMPORT_CONFIGS.filter((c) => ['driver', 'users'].includes(c.key));

    return (
        <Box>
            <Paper withBorder p="md" mb="md" radius="md" style={{ background: 'linear-gradient(135deg, #e7f5ff 0%, #d0ebff 100%)' }}>
                <Group gap="sm">
                    <IconUpload size={28} color="#228be6" />
                    <div>
                        <Title order={4}>Import Data WMS</Title>
                        <Text size="sm" c="dimmed">Import massal untuk transaksi, master data, planning, dan user. Gunakan template yang tersedia.</Text>
                    </div>
                </Group>
            </Paper>

            <Tabs defaultValue="transaction" variant="outline" radius="md">
                <Tabs.List mb="md">
                    <Tabs.Tab value="transaction" leftSection={<IconTransferIn size={16} />}>Transaksi</Tabs.Tab>
                    <Tabs.Tab value="master" leftSection={<IconPackage size={16} />}>Master Data</Tabs.Tab>
                    <Tabs.Tab value="planning" leftSection={<IconCalendarStats size={16} />}>Planning & User</Tabs.Tab>
                </Tabs.List>

                <Tabs.Panel value="transaction">
                    <Stack gap="md">
                        {transactionConfigs.map((c) => <ImportSection key={c.key} config={c} refs={refs} />)}
                    </Stack>
                </Tabs.Panel>

                <Tabs.Panel value="master">
                    <Stack gap="md">
                        {masterConfigs.map((c) => <ImportSection key={c.key} config={c} refs={refs} />)}
                    </Stack>
                </Tabs.Panel>

                <Tabs.Panel value="planning">
                    <Stack gap="md">
                        {planningConfigs.map((c) => <ImportSection key={c.key} config={c} refs={refs} />)}
                    </Stack>
                </Tabs.Panel>
            </Tabs>
        </Box>
    );
}
