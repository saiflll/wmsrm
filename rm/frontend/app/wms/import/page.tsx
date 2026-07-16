'use client';
// @ts-nocheck
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import * as XLSX from 'xlsx';
import {
    Box, Paper, Title, Text, Button, Group, Stack, FileInput, Alert,
    Badge, Table, Loader, ScrollArea, Center, Progress, Overlay, ThemeIcon
} from '@mantine/core';
import {
    IconUpload, IconDownload, IconFileSpreadsheet, IconAlertCircle,
    IconCheck, IconTruck, IconPackage, IconBuildingWarehouse, IconUsers,
    IconBoxSeam, IconMapPin, IconTransferIn, IconTransferOut, IconClipboardList,
    IconRefresh, IconDatabase, IconCircleCheck
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
    process: (rows: any[], refs: RefData, apiInstance: any, onProgress?: (completed: number, total: number) => void) => Promise<{ success: number; fail: number; errors: string[] }>;
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
        sampleRows: [
            ['PO-001', 'Dada Ayam Broiler', 100, 'Kg', 'BATCH-001', '2026-12-31', 'PT JAPFA', 'Shift 1', 'CS FROZEN', 'CS-F-01-01'],
            ['PO-001', 'Paha Ayam Atas', 50, 'Kg', 'BATCH-002', '2026-12-28', 'PT JAPFA', 'Shift 1', 'CHILL', 'CH-01-02'],
            ['PO-002', 'Beras Premium', 200, 'Kg', 'BATCH-003', '2027-06-30', 'PT Bulog', 'Shift 2', 'DRY A', 'DRY-A-01-01'],
            ['PO-003', 'Minyak Goreng', 100, 'Liter', 'BATCH-004', '2027-03-15', 'PT Bimoli', 'Shift 2', 'DRY B', 'DRY-B-02-01'],
        ],
        process: async (rows, refs, apiInstance, onProgress) => {
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
                } finally {
                    onProgress?.(i + 1, rows.length);
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
        sampleRows: [
            ['SJ-001', 'Dada Ayam Broiler', 'CS-F-01-01', 'BATCH-001', 50, 'Kg', 'PT Produksi Ayam', 'Shift 1'],
            ['SJ-001', 'Paha Ayam Atas', 'CH-01-02', 'BATCH-002', 30, 'Kg', 'PT Produksi Ayam', 'Shift 1'],
            ['SJ-002', 'Beras Premium', 'DRY-A-01-01', 'BATCH-003', 100, 'Kg', 'Customer A', 'Shift 2'],
        ],
        process: async (rows, refs, apiInstance, onProgress) => {
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
                } finally {
                    onProgress?.(i + 1, rows.length);
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
        sampleRows: [
            ['PK-001', 'Dada Ayam Broiler', 'CS-F-01-01', 'BATCH-001', 50, 'Kg', 'PT Produksi Ayam', 'Shift 1', '2026-07-15'],
            ['PK-001', 'Paha Ayam Atas', 'CH-01-02', 'BATCH-002', 30, 'Kg', 'PT Produksi Ayam', 'Shift 1', '2026-07-15'],
            ['PK-002', 'Beras Premium', 'DRY-A-01-01', 'BATCH-003', 100, 'Kg', 'Customer A', 'Shift 2', '2026-07-16'],
        ],
        process: async (rows, refs, apiInstance, onProgress) => {
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
                        }]
                    });
                    success++;
                } catch (e: any) {
                    fail++;
                    errors.push(`Baris ${i + 1}: ${e?.response?.data?.message || e.message || 'Gagal'}`);
                } finally {
                    onProgress?.(i + 1, rows.length);
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
        sampleRows: [
            ['RL-001', 'Dada Ayam Broiler', 'CS-F-01-01', 'CS-F-02-01', 'BATCH-001', 30, 'Pindah ke rak lebih dekat'],
            ['RL-002', 'Beras Premium', 'DRY-A-01-01', 'DRY-A-02-01', 'BATCH-003', 50, 'Reorganisasi gudang'],
        ],
        process: async (rows, refs, apiInstance, onProgress) => {
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
                        target_gudang_id: gudTujuan.id,
                        qty: Number(r.Qty) || 0,
                        note: String(r.Note || ''),
                    });
                    success++;
                } catch (e: any) {
                    fail++;
                    errors.push(`Baris ${i + 1}: ${e?.response?.data?.message || e.message || 'Gagal'}`);
                } finally {
                    onProgress?.(i + 1, rows.length);
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
        sampleRows: [
            ['CS FROZEN', 'CS-F-01-01', 'Dada Ayam Broiler', 'BATCH-001', 95, 'Shift 1', 'Selisih -5kg'],
            ['CHILL', 'CH-01-02', 'Paha Ayam Atas', 'BATCH-002', 48, 'Shift 1', ''],
            ['DRY A', 'DRY-A-01-01', 'Beras Premium', 'BATCH-003', 198, 'Shift 2', 'Selisih -2kg'],
        ],
        process: async (rows, refs, apiInstance, onProgress) => {
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
                } finally {
                    onProgress?.(i + 1, rows.length);
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
        headers: ['SKU', 'Nama', 'Satuan', 'Kategori'],
        sampleRows: [
            ['SKU-001', 'Dada Ayam Broiler', 'Kg', 'Wet'],
            ['SKU-002', 'Paha Ayam Atas', 'Kg', 'Wet'],
            ['SKU-003', 'Beras Premium', 'Kg', 'Dry'],
            ['SKU-004', 'Minyak Goreng', 'Liter', 'Dry'],
            ['SKU-005', 'Telur Ayam', 'Butir', 'Wet'],
        ],
        process: async (rows, refs, apiInstance, onProgress) => {
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
                    });
                    success++;
                } catch (e: any) {
                    fail++;
                    errors.push(`Baris ${i + 1}: ${e?.response?.data?.message || e.message || 'Gagal'}`);
                } finally {
                    onProgress?.(i + 1, rows.length);
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
        headers: ['NamaRak', 'Zone', 'Kolom', 'Level', 'Type', 'Capacity'],
        sampleRows: [
            ['CS-F-01-01', 'CS FROZEN', '01', 1, 'Single Deep', 1000],
            ['CS-F-01-02', 'CS FROZEN', '01', 2, 'Single Deep', 1000],
            ['CH-01-01', 'CHILL', '01', 1, 'Single Deep', 750],
            ['DRY-A-01-01', 'DRY A', '01', 1, 'Double Deep', 2000],
            ['DRY-B-02-01', 'DRY B', '02', 1, 'Single Deep', 1500],
        ],
        process: async (rows, refs, apiInstance, onProgress) => {
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
                        capacity: Number(r.Capacity) || 0,
                        side: ['DRY A', 'DRY B', 'DRY FG'].includes(zone),
                        status: true,
                    });
                    success++;
                } catch (e: any) {
                    fail++;
                    errors.push(`Baris ${i + 1}: ${e?.response?.data?.message || e.message || 'Gagal'}`);
                } finally {
                    onProgress?.(i + 1, rows.length);
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
        sampleRows: [
            ['PT Produksi Ayam', 'Jl. Industri No.1, Jakarta', '021-12345678', 'customer'],
            ['PT JAPFA Comfeed', 'Jl. Raya Bogor Km.22', '021-87654321', 'customer'],
            ['PT Bulog', 'Jl. Gatot Subroto No.1, Jakarta', '021-55555555', 'customer'],
            ['Customer A', 'Jl. Mawar No.10, Bandung', '022-11111111', 'customer'],
        ],
        process: async (rows, refs, apiInstance, onProgress) => {
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
                } finally {
                    onProgress?.(i + 1, rows.length);
                }
            }
            return { success, fail, errors };
        }
    },
    {
        key: 'inbound-planning',
        title: 'Inbound Planning',
        description: 'Import bulk rencana kedatangan inbound.',
        color: 'indigo',
        icon: <IconTruck size={20} />,
        filename: 'Template_Inbound_Planning.xlsx',
        headers: ['NoPO', 'Supplier', 'Item', 'Qty', 'Satuan', 'ETA', 'Zone', 'Rak', 'Status', 'Note'],
        sampleRows: [
            ['PO-001', 'PT JAPFA', 'Dada Ayam Broiler', 600, 'Kg', '2026-07-15 08:00', 'CS FROZEN', 'CS-F-01-01', 'WAIT', ''],
            ['PO-001', 'PT JAPFA', 'Dada Ayam Broiler', 400, 'Kg', '2026-07-15 08:00', 'CS FROZEN', 'CS-F-01-02', 'WAIT', ''],
            ['PO-002', 'PT Bulog', 'Beras Premium', 500, 'Kg', '2026-07-15 10:00', 'DRY A', 'DRY-A-01-01', 'WAIT', ''],
        ],
        process: async (rows, refs, apiInstance, onProgress) => {
            let success = 0, fail = 0;
            const errors: string[] = [];

            // Group rows by NoPO
            const groups: Record<string, any[]> = {};
            for (const r of rows) {
                const po = String(r.NoPO || '').trim();
                if (!po) continue;
                if (!groups[po]) groups[po] = [];
                groups[po].push(r);
            }

            const poKeys = Object.keys(groups);
            for (let i = 0; i < poKeys.length; i++) {
                const po = poKeys[i];
                const poRows = groups[po];
                const firstRow = poRows[0];

                try {
                    const itemsMap: Record<number, {
                        barangId: number;
                        qty: number;
                        satuan: string;
                        zone: string;
                        rackAllocations: { gudangId: number; qty: number }[];
                    }> = {};

                    let totalQty = 0;

                    for (let rIdx = 0; rIdx < poRows.length; rIdx++) {
                        const r = poRows[rIdx];
                        const brg = findBarang(refs, r.Item);
                        if (!brg) {
                            throw new Error(`Baris ${rIdx + 1}: Item "${r.Item}" tidak ditemukan`);
                        }
                        const gud = r.Rak ? findGudang(refs, r.Rak) : null;
                        const rowQty = Number(r.Qty) || 0;
                        totalQty += rowQty;

                        if (!itemsMap[brg.id]) {
                            itemsMap[brg.id] = {
                                barangId: brg.id,
                                qty: 0,
                                satuan: String(r.Satuan || brg.satuan || ''),
                                zone: String(r.Zone || ''),
                                rackAllocations: []
                            };
                        }

                        itemsMap[brg.id].qty += rowQty;
                        if (gud) {
                            itemsMap[brg.id].rackAllocations.push({
                                gudangId: gud.id,
                                qty: rowQty
                            });
                            if (!itemsMap[brg.id].zone && gud.zone) {
                                itemsMap[brg.id].zone = gud.zone;
                            }
                        }
                    }

                    const payload = {
                        no_po: po,
                        supplier: String(firstRow.Supplier || ''),
                        qty: totalQty,
                        estimasi_datang: parseDateTime(firstRow.ETA) || undefined,
                        status: String(firstRow.Status || 'WAIT'),
                        note: String(firstRow.Note || ''),
                        items: Object.values(itemsMap).map(it => ({
                            ...it,
                            rackAllocations: it.rackAllocations.length > 0 ? it.rackAllocations : undefined
                        }))
                    };

                    await apiInstance.post('/inbound-planning', payload);
                    success++;
                } catch (e: any) {
                    fail++;
                    errors.push(`PO "${po}": ${e?.response?.data?.message || e.message || 'Gagal'}`);
                } finally {
                    onProgress?.(i + 1, poKeys.length);
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
        sampleRows: [
            ['checker1', 'password123', 1],
            ['admin1', 'admin123', 2],
            ['koordinator1', 'koord123', 3],
            ['supervisor1', 'super123', 4],
            ['superadmin', 'superadmin123', 5],
        ],
        process: async (rows, refs, apiInstance, onProgress) => {
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
                } finally {
                    onProgress?.(i + 1, rows.length);
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
    completedRows: number;
    progress: number;
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

const fetchRefData = async (apiInstance: any): Promise<RefData> => {
    const [barangRes, gudangRes, stockRes, shiftRes, customerRes] = await Promise.all([
        apiInstance.get('/barang'),
        apiInstance.get('/gudang'),
        apiInstance.get('/inventory/stock'),
        apiInstance.get('/shifts'),
        apiInstance.get('/customers'),
    ]);

    return {
        barangs: unwrap(barangRes) || [],
        gudangs: unwrap(gudangRes) || [],
        stocks: unwrap(stockRes) || [],
        shifts: unwrap(shiftRes) || [],
        customers: unwrap(customerRes) || [],
    };
};

const IMPORT_PRIORITY: Record<string, number> = {
    produk: 1,
    lokasi: 2,
    customer: 3,
    users: 4,
    'inbound-planning': 5,
    inbound: 6,
    picking: 7,
    outbound: 8,
    relocation: 9,
    opname: 10,
};

export default function ImportPage() {
    const [userRole, setUserRole] = useState<number | null>(null);
    const [loading, setLoading] = useState(true);
    const [refs, setRefs] = useState<RefData>({ barangs: [], gudangs: [], stocks: [], shifts: [], customers: [] });
    const [error, setError] = useState<string | null>(null);
    const [sheetImports, setSheetImports] = useState<SheetImport[]>([]);
    const [unrecognizedSheets, setUnrecognizedSheets] = useState<string[]>([]);
    const [importingAll, setImportingAll] = useState(false);
    const [importPhase, setImportPhase] = useState<'idle' | 'reading' | 'importing' | 'done' | 'error'>('idle');
    const [activeSheetName, setActiveSheetName] = useState('');

    const totalRows = useMemo(() => sheetImports.reduce((sum, sheet) => sum + sheet.rows.length, 0), [sheetImports]);
    const completedRows = useMemo(() => sheetImports.reduce((sum, sheet) => sum + sheet.completedRows, 0), [sheetImports]);
    const successfulRows = useMemo(() => sheetImports.reduce((sum, sheet) => sum + (sheet.results?.success || 0), 0), [sheetImports]);
    const failedRows = useMemo(() => sheetImports.reduce((sum, sheet) => sum + (sheet.results?.fail || 0), 0), [sheetImports]);
    const overallProgress = totalRows === 0 ? 0 : Math.min(100, Math.round((completedRows / totalRows) * 100));
    const allRowsStored = totalRows > 0 && completedRows === totalRows && failedRows === 0 && successfulRows === totalRows;

    useEffect(() => {
        const u = JSON.parse(localStorage.getItem('user') || '{}');
        setUserRole(u?.role || null);
    }, []);

    useEffect(() => {
        const loadRefs = async () => {
            try {
                const apiInstance = api();
                setRefs(await fetchRefData(apiInstance));
            } catch (e: any) {
                setError('Gagal memuat data referensi: ' + (e?.message || 'Unknown error'));
            }
            setLoading(false);
        };
        loadRefs();
    }, []);

    const runSheetImport = useCallback(async (sheetImport: SheetImport, apiInstance: any, currentRefs: RefData = refs) => {
        setActiveSheetName(sheetImport.sheetName);
        setSheetImports(prev => prev.map(sheet => sheet.sheetName === sheetImport.sheetName
            ? { ...sheet, status: 'importing', completedRows: 0, progress: 0, results: undefined }
            : sheet
        ));

        try {
            const results = await sheetImport.config.process(sheetImport.rows, currentRefs, apiInstance, (completed, total) => {
                const progress = total === 0 ? 100 : Math.round((completed / total) * 100);
                setSheetImports(prev => prev.map(sheet => sheet.sheetName === sheetImport.sheetName
                    ? { ...sheet, completedRows: completed, progress }
                    : sheet
                ));
            });

            setSheetImports(prev => prev.map(sheet => sheet.sheetName === sheetImport.sheetName
                ? { ...sheet, status: results.fail === 0 ? 'success' : 'error', completedRows: sheetImport.rows.length, progress: 100, results }
                : sheet
            ));
            return results;
        } catch (err: any) {
            const results = { success: 0, fail: sheetImport.rows.length, errors: [err?.message || 'Gagal mengimport'] };
            setSheetImports(prev => prev.map(sheet => sheet.sheetName === sheetImport.sheetName
                ? { ...sheet, status: 'error', completedRows: sheetImport.rows.length, progress: 100, results }
                : sheet
            ));
            return results;
        }
    }, [refs]);

    const handleFileUpload = async (file: File | null) => {
        if (!file) {
            setImportPhase('idle');
            setActiveSheetName('');
            setSheetImports([]);
            setUnrecognizedSheets([]);
            return;
        }
        try {
            setError(null);
            setImportPhase('reading');
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
                    completedRows: 0,
                    progress: 0,
                });
            }

            recognized.sort((a, b) => (IMPORT_PRIORITY[a.config.key] || 999) - (IMPORT_PRIORITY[b.config.key] || 999));

            setSheetImports(recognized);
            setUnrecognizedSheets(unrecognized);

            // Auto-import semua sheet yang dikenali secara berurutan.
            if (recognized.length > 0) {
                setImportingAll(true);
                setImportPhase('importing');
                const apiInstance = api();
                let totalFail = 0;
                let latestRefs = await fetchRefData(apiInstance);
                setRefs(latestRefs);

                for (const sheet of recognized) {
                    const result = await runSheetImport(sheet, apiInstance, latestRefs);
                    totalFail += result.fail;

                    // Ambil ulang referensi setelah setiap sheet agar produk, rak, dan stok
                    // yang baru disimpan langsung tersedia untuk sheet berikutnya.
                    latestRefs = await fetchRefData(apiInstance);
                    setRefs(latestRefs);
                }
                setActiveSheetName('');
                setImportingAll(false);
                setImportPhase(totalFail === 0 ? 'done' : 'error');
            } else {
                setImportPhase('idle');
            }
        } catch (err) {
            setSheetImports([]);
            setUnrecognizedSheets([]);
            setImportPhase('error');
            setError('Gagal membaca file Excel: ' + (err instanceof Error ? err.message : 'Unknown error'));
        }
    };

    const importSheet = async (sheetImport: SheetImport) => {
        setImportingAll(true);
        setImportPhase('importing');
        const apiInstance = api();
        const latestRefs = await fetchRefData(apiInstance);
        setRefs(latestRefs);
        const result = await runSheetImport(sheetImport, apiInstance, latestRefs);
        setRefs(await fetchRefData(apiInstance));
        setActiveSheetName('');
        setImportingAll(false);
        setImportPhase(result.fail === 0 ? 'done' : 'error');
    };

    const importAll = async () => {
        setImportingAll(true);
        setImportPhase('importing');
        const apiInstance = api();
        let totalFail = 0;
        let latestRefs = await fetchRefData(apiInstance);
        setRefs(latestRefs);

        const pendingSheets = sheetImports
            .filter(sheet => sheet.status !== 'success')
            .sort((a, b) => (IMPORT_PRIORITY[a.config.key] || 999) - (IMPORT_PRIORITY[b.config.key] || 999));

        for (const sheet of pendingSheets) {
            const result = await runSheetImport(sheet, apiInstance, latestRefs);
            totalFail += result.fail;
            latestRefs = await fetchRefData(apiInstance);
            setRefs(latestRefs);
        }
        setActiveSheetName('');
        setImportingAll(false);
        setImportPhase(totalFail === 0 ? 'done' : 'error');
    };

    const downloadTemplate = (config: ImportConfig) => {
        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.aoa_to_sheet([config.headers, ...config.sampleRows]);
        XLSX.utils.book_append_sheet(wb, ws, 'Template');
        saveXlsx(XLSX, wb, config.filename);
    };

    const downloadAllTemplates = () => {
        const wb = XLSX.utils.book_new();
        IMPORT_CONFIGS.forEach((config) => {
            const ws = XLSX.utils.aoa_to_sheet([config.headers, ...config.sampleRows]);
            XLSX.utils.book_append_sheet(wb, ws, config.key);
        });
        saveXlsx(XLSX, wb, 'Template_Lengkap_WMS.xlsx');
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


    return (
        <Box>
            <Paper withBorder p="md" mb="md" radius="md" style={{ background: 'linear-gradient(135deg, #e7f5ff 0%, #d0ebff 100%)' }}>
                <Group justify="space-between" align="center">
                    <Group gap="sm">
                        <IconUpload size={28} color="#228be6" />
                        <div>
                            <Title order={4}>Import Data WMS</Title>
                            <Text size="sm" c="dimmed">Download template → isi data → upload → otomatis terimport. Semua sheet langsung diproses.</Text>
                        </div>
                    </Group>
                    <Button
                        size="md"
                        variant="filled"
                        color="green"
                        leftSection={<IconDownload size={18} />}
                        onClick={downloadAllTemplates}
                    >
                        Download Template Lengkap
                    </Button>
                </Group>
            </Paper>

            {/* File Upload */}
            <Paper withBorder p="md" mb="md" radius="md" style={{ background: '#fff' }}>
                <FileInput
                    label="Upload Excel File"
                    description="File akan otomatis diimport setelah dipilih. Sheet harus sesuai nama: inbound, outbound, picking, relocation, opname, produk, lokasi, customer, inbound-planning, users"
                    placeholder="Pilih file Excel..."
                    accept=".xlsx,.xls"
                    onChange={handleFileUpload}
                    disabled={importingAll}
                    leftSection={<IconFileSpreadsheet size={16} />}
                    size="md"
                />
            </Paper>

            {(importPhase !== 'idle' || sheetImports.length > 0) && (
                <Paper withBorder p="lg" mb="md" radius="md" pos="relative" style={{ overflow: 'hidden' }}>
                    {importingAll && <Overlay backgroundOpacity={0.02} blur={0} zIndex={0} />}
                    <Stack gap="sm" pos="relative" style={{ zIndex: 1 }}>
                        <Group justify="space-between" align="flex-start">
                            <Group gap="sm">
                                <ThemeIcon size="lg" radius="xl" color={allRowsStored ? 'green' : importPhase === 'error' ? 'red' : 'blue'} variant="light">
                                    {allRowsStored ? <IconCircleCheck size={22} /> : <IconDatabase size={22} />}
                                </ThemeIcon>
                                <div>
                                    <Text fw={700}>
                                        {importPhase === 'reading' && 'Membaca file Excel...'}
                                        {importPhase === 'importing' && `Menyimpan data${activeSheetName ? `: ${activeSheetName}` : ''}`}
                                        {allRowsStored && 'Import selesai — seluruh data tersimpan'}
                                        {importPhase === 'error' && !allRowsStored && 'Import selesai dengan data gagal'}
                                    </Text>
                                    <Text size="xs" c="dimmed">{completedRows} dari {totalRows} baris diproses · {successfulRows} tersimpan · {failedRows} gagal</Text>
                                </div>
                            </Group>
                            <Text fw={800} size="xl" c={allRowsStored ? 'green' : undefined}>{allRowsStored ? 100 : overallProgress}%</Text>
                        </Group>
                        <Progress value={allRowsStored ? 100 : overallProgress} size="xl" radius="xl" animated={importingAll} striped={importingAll} color={allRowsStored ? 'green' : importPhase === 'error' ? 'red' : 'blue'} />
                        {allRowsStored && (
                            <Alert color="green" variant="light" icon={<IconCheck size={18} />}>
                                Seluruh request berhasil. Progress 100% hanya tampil saat semua baris sudah tersimpan tanpa kegagalan.
                            </Alert>
                        )}
                    </Stack>
                </Paper>
            )}

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

                            {(sheet.status === 'importing' || sheet.progress > 0) && (
                                <Box mb="sm">
                                    <Group justify="space-between" mb={4}>
                                        <Text size="xs" c="dimmed">{sheet.completedRows}/{sheet.rows.length} baris</Text>
                                        <Text size="xs" fw={700}>{sheet.progress}%</Text>
                                    </Group>
                                    <Progress value={sheet.progress} size="sm" animated={sheet.status === 'importing'} striped={sheet.status === 'importing'} color={sheet.status === 'error' ? 'red' : sheet.status === 'success' ? 'green' : sheet.config.color} />
                                </Box>
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
                        </Paper>
                    );
                })}
            </Stack>

            {/* Retry Failed Imports Button */}
            {sheetImports.length > 0 && sheetImports.some(s => s.status === 'error') && (
                <Paper withBorder p="md" mt="md" radius="md" style={{ background: '#fff' }}>
                    <Group justify="space-between">
                        <div>
                            <Text fw={600} c="red">{sheetImports.filter(s => s.status === 'error').length} sheet gagal diimport</Text>
                            <Text size="xs" c="dimmed">Klik untuk mencoba ulang sheet yang gagal</Text>
                        </div>
                        <Button
                            size="lg"
                            color="orange"
                            leftSection={<IconRefresh size={18} />}
                            onClick={() => {
                                const failed = sheetImports.filter(s => s.status === 'error');
                                (async () => {
                                    setImportingAll(true);
                                    const apiInstance = api();
                                    for (const sheet of failed) {
                                        setSheetImports(prev => prev.map(s =>
                                            s.sheetName === sheet.sheetName ? { ...s, status: 'importing' } : s
                                        ));
                                        try {
                                            const results = await sheet.config.process(sheet.rows, refs, apiInstance);
                                            setSheetImports(prev => prev.map(s =>
                                                s.sheetName === sheet.sheetName
                                                    ? { ...s, status: results.fail === 0 ? 'success' : 'error', results }
                                                    : s
                                            ));
                                        } catch (err: any) {
                                            setSheetImports(prev => prev.map(s =>
                                                s.sheetName === sheet.sheetName
                                                    ? { ...s, status: 'error', results: { success: 0, fail: sheet.rows.length, errors: [err?.message || 'Gagal mengimport'] } }
                                                    : s
                                            ));
                                        }
                                    }
                                    setImportingAll(false);
                                })();
                            }}
                            loading={importingAll}
                        >
                            Retry Import
                        </Button>
                    </Group>
                </Paper>
            )}
        </Box>
    );
}
