// @ts-nocheck
'use client';
import React, { useState, useEffect } from 'react';
import { Box, Group, Button, Title, Table, Badge, TextInput, Select, Loader, Text } from '@mantine/core';
import { api, unwrap, fmt, statusLabel, statusColor, saveXlsx } from '../lib/api';
import { IconFileTypePdf, IconFileSpreadsheet } from '@tabler/icons-react';
import * as XLSX from 'xlsx';

function exportExcel(data: any[], from: string, to: string, filterBarangNama?: string) {
    const dateStr = new Date().toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' });
    const periodeStr = from && to ? `${from} s/d ${to}` : from ? `Dari ${from}` : to ? `Sampai ${to}` : 'Semua Periode';
    const headerRows = [
        ['LAPORAN INBOUND - PENERIMAAN BARANG'],
        [`Dicetak: ${dateStr}`],
        [`Periode: ${periodeStr}`],
        filterBarangNama ? [`Filter Produk: ${filterBarangNama}`] : [],
        [],
        ['No.PO/SJ', 'Item / Produk', 'Tanggal Income', 'Shift', 'Tanggal Expired', 'Qty', 'Satuan', 'Status', 'Zone', 'Lokasi Rak', 'Supplier', 'Batch No', 'Jam Datang', 'Jam Bongkar', 'Jam Selesai'],
    ].filter(r => r.length > 0);
    const rows = data.map((r: any) => [
        r.no_po || '-',
        r.barang?.nama || '',
        r.tanggal_income ? r.tanggal_income : fmt(r.created_at),
        r.shift?.name || '-',
        r.expiry_date ? fmt(r.expiry_date) : '-',
        r.qty,
        r.satuan || '',
        statusLabel(r.expiry_date),
        r.gudang?.zone || '-',
        r.gudang?.name || '-',
        r.supplier || '-',
        r.batch_no || '-',
        r.jam_datang || '-',
        r.jam_bongkar || '-',
        r.jam_selesai || '-',
    ]);
    const ws = XLSX.utils.aoa_to_sheet([...headerRows, ...rows]);
    const mergeEndRow = filterBarangNama ? 4 : 3;
    ws['!merges'] = [
        { s: { r: 0, c: 0 }, e: { r: 0, c: 14 } },
        { s: { r: 1, c: 0 }, e: { r: 1, c: 14 } },
        { s: { r: 2, c: 0 }, e: { r: 2, c: 14 } },
        ...(filterBarangNama ? [{ s: { r: 3, c: 0 }, e: { r: 3, c: 14 } }] : []),
    ];
    ws['!cols'] = [
        { wch: 16 }, { wch: 28 }, { wch: 14 }, { wch: 12 }, { wch: 14 }, { wch: 8 },
        { wch: 8 }, { wch: 12 }, { wch: 12 }, { wch: 14 }, { wch: 20 }, { wch: 16 },
        { wch: 12 }, { wch: 12 }, { wch: 12 },
    ];
    const wb = XLSX.utils.book_new();
    const sheetName = filterBarangNama ? `Inbound-${filterBarangNama.slice(0, 20)}` : 'Inbound';
    XLSX.utils.book_append_sheet(wb, ws, sheetName);

    // Nama file: ReportInbound_[NamaProduk_]Periode.xlsx
    const produkPart = filterBarangNama ? `_${filterBarangNama.replace(/[^a-zA-Z0-9]/g, '_').slice(0, 20)}` : '';
    const periodePart = from && to
        ? `_${from.replace(/-/g, '')}-${to.replace(/-/g, '')}`
        : `_${new Date().toISOString().split('T')[0].replace(/-/g, '')}`;
    saveXlsx(XLSX, wb, `ReportInbound${produkPart}${periodePart}.xlsx`);
}

export default function ReportInboundPage() {
    const [logs, setLogs] = useState<any[]>([]);
    const [shifts, setShifts] = useState<any[]>([]);  // ← LINK KE MASTER SHIFTS
    const [customers, setCustomers] = useState<any[]>([]);  // ← LINK KE MASTER CUSTOMER
    const [barangs, setBarangs] = useState<any[]>([]);  // ← LINK KE MASTER PRODUK
    const [search, setSearch] = useState('');
    const [filterShift, setFilterShift] = useState('');
    const [filterSupplier, setFilterSupplier] = useState('');
    const [filterBarang, setFilterBarang] = useState('');
    const [from, setFrom] = useState('');
    const [to, setTo] = useState('');
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // Load master data untuk filter
        api().get('/shifts').then(r => setShifts(unwrap(r)));
        api().get('/customers').then(r => setCustomers(unwrap(r)));
        api().get('/barang').then(r => setBarangs(unwrap(r)));
        load();
    }, []);

    const load = async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams();
            if (from) params.set('from', from);
            if (to) params.set('to', to);
            const res = await api().get(`/inventory/logs/inbound?${params}`);
            setLogs(unwrap(res));
        } catch (e) { console.error(e); }
        setLoading(false);
    };

    // Opts dari master (mencegah error value missing)
    const shiftOpts = [{ value: '', label: 'Semua Shift' }, ...shifts.filter((s: any) => s?.name).map((s: any) => ({ value: s.name, label: s.name }))];
    const uniqueCustomers = Array.from(new Map(customers.filter((c: any) => c?.name).map((c: any) => [c.name, c])).values());
    const supplierOpts = [{ value: '', label: 'Semua Supplier' }, ...uniqueCustomers.map((c: any) => ({ value: c.name, label: c.name }))];
    const barangOpts = [{ value: '', label: 'Semua Item' }, ...barangs.filter((b: any) => b?.id).map((b: any) => ({ value: String(b.id), label: b.nama }))];

    const filtered = logs
        .filter((r: any) => !search || r.barang?.nama?.toLowerCase().includes(search.toLowerCase()) || r.no_po?.includes(search) || String(r.id) === search)
        .filter((r: any) => !filterShift || r.shift?.name === filterShift)
        .filter((r: any) => !filterSupplier || r.supplier === filterSupplier)
        .filter((r: any) => !filterBarang || String(r.barang?.id) === filterBarang);

    // Grouping
    const groupedLogs: Record<string, any[]> = {};
    filtered.forEach((r: any) => {
        const key = r.no_po || `LOG-${r.id}`;
        if (!groupedLogs[key]) groupedLogs[key] = [];
        groupedLogs[key].push(r);
    });

    const handlePrint = () => {
        const periodeStr = from && to ? `${from} s/d ${to}` : from ? `Dari ${from}` : to ? `Sampai ${to}` : 'Semua Periode';
        const win = window.open('', '_blank');
        if (!win) return;
        win.document.write(`
            <html>
            <head>
                <title>Laporan Inbound - ${periodeStr}</title>
                <style>
                    body { font-family: Arial; padding: 20px; font-size: 10px; }
                    table { width: 100%; border-collapse: collapse; margin-top: 15px; }
                    th, td { border: 1px solid #333; padding: 5px; text-align: left; }
                    th { background: #1f2937; color: #fff; font-size: 10px; }
                    .title { font-size: 15px; font-weight: bold; margin-bottom: 4px; }
                    .subtitle { font-size: 11px; color: #555; margin-bottom: 12px; border-bottom: 2px solid #000; padding-bottom: 8px; }
                </style>
            </head>
            <body>
                <div class="title">LAPORAN INBOUND - PENERIMAAN BARANG</div>
                <div class="subtitle">Periode: ${periodeStr} &nbsp;|&nbsp; Dicetak: ${new Date().toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' })}</div>
                <table>
                    <thead>
                        <tr>
                            <th>No.PO/SJ</th>
                            <th>Item / Produk</th>
                            <th>Supplier</th>
                            <th>Shift</th>
                            <th>Tgl.Income</th>
                            <th>Batch</th>
                            <th>Tgl.Expired</th>
                            <th>Qty</th>
                            <th>Satuan</th>
                            <th>Status</th>
                            <th>Zone / Rak</th>
                            <th>Jam Datang</th>
                            <th>Jam Bongkar</th>
                            <th>Jam Selesai</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${Object.entries(groupedLogs).map(([transId, items]: [string, any[]]) => {
            return items.map((r: any, idx: number) => `
                                <tr>
                                    ${idx === 0 ? `<td rowspan="${items.length}">${transId}</td>` : ''}
                                    <td>${r.barang?.nama || '-'}</td>
                                    ${idx === 0 ? `<td rowspan="${items.length}">${r.supplier || '-'}</td>` : ''}
                                    ${idx === 0 ? `<td rowspan="${items.length}">${r.shift?.name || '-'}</td>` : ''}
                                    ${idx === 0 ? `<td rowspan="${items.length}">${r.tanggal_income || fmt(r.created_at).split(' ')[0]}</td>` : ''}
                                    <td>${r.batch_no || '-'}</td>
                                    <td>${r.expiry_date ? fmt(r.expiry_date).split(' ')[0] : '-'}</td>
                                    <td>${r.qty}</td>
                                    <td>${r.satuan || ''}</td>
                                    <td>${statusLabel(r.expiry_date)}</td>
                                    <td>${r.gudang?.name || '-'} (${r.gudang?.zone || '-'})</td>
                                    ${idx === 0 ? `<td rowspan="${items.length}">${r.jam_datang || '-'}</td>` : ''}
                                    ${idx === 0 ? `<td rowspan="${items.length}">${r.jam_bongkar || '-'}</td>` : ''}
                                    ${idx === 0 ? `<td rowspan="${items.length}">${r.jam_selesai || '-'}</td>` : ''}
                                </tr>
                            `).join('');
        }).join('')}
                    </tbody>
                </table>
                <script>window.onload=()=>{window.print();window.close()}</script>
            </body>
            </html>
        `);
        win.document.close();
    };

    return (
        <Box p="md" bg="#fff" style={{ minHeight: '100vh' }}>
            <Title order={3} mb="xl" style={{ color: '#e6921e', fontWeight: 900 }}>REPORT INBOUND</Title>

            <Group gap="xs" mb="lg">
                <Button size="xs" color="red" radius="md" onClick={handlePrint} leftSection={<IconFileTypePdf size={16} />}>
                    Print PDF
                </Button>
                <Button size="xs" color="green" radius="md" onClick={() => exportExcel(filtered, from, to, barangs.find((b: any) => String(b.id) === filterBarang)?.nama)} leftSection={<IconFileSpreadsheet size={16} />}>
                    Export Excel
                </Button>
            </Group>

            {/* Filter Section - Matching UI Design */}
            <Group gap="md" mb="xl" align="flex-end" wrap="wrap">
                <Group gap="xs" style={{ background: '#fff', border: '1px solid #ddd', borderRadius: 8, padding: '2px 8px' }}>
                    <Text size="sm" c="dimmed">🔍</Text>
                    <TextInput variant="unstyled" placeholder="Cari berdasarkan ID, kod" size="sm" value={search} onChange={(e: any) => setSearch(e.target.value)} style={{ width: 180 }} />
                </Group>

                <Select
                    size="sm" placeholder="Semua Shift" clearable
                    variant="unstyled"
                    data={shiftOpts}
                    value={filterShift}
                    onChange={(v: any) => setFilterShift(v || '')}
                    style={{ width: 140, fontWeight: 700 }}
                />

                <Group gap="xs" ml="auto">
                    <Text size="xs" fw={600} style={{ border: '1px solid #ddd', padding: '6px 10px', borderRadius: 8, background: '#f8f9fa' }}>Dari</Text>
                    <TextInput type="date" size="sm" radius="md" value={from} onChange={(e: any) => setFrom(e.target.value)} style={{ width: 130 }} />
                    <Text size="xs" fw={600} style={{ border: '1px solid #ddd', padding: '6px 10px', borderRadius: 8, background: '#f8f9fa' }}>Sampai</Text>
                    <TextInput type="date" size="sm" radius="md" value={to} onChange={(e: any) => setTo(e.target.value)} style={{ width: 130 }} />
                    <Button size="sm" color="blue" radius="md" onClick={load}>Filter</Button>
                    <Button size="sm" color="gray" variant="outline" radius="md" onClick={() => { setSearch(''); setFilterShift(''); setFilterSupplier(''); setFilterBarang(''); setFrom(''); setTo(''); }}>Reset</Button>
                </Group>
            </Group>

            {loading ? <Loader /> : (
                <Table withColumnBorders style={{ fontSize: 11, border: '1px solid #dee2e6' }}>
                    <Table.Thead style={{ background: '#111827' }}>
                        <Table.Tr>
                            <Table.Th style={{ color: '#fff', fontSize: 11, textAlign: 'center' }}>ID Transaksi</Table.Th>
                            <Table.Th style={{ color: '#fff', fontSize: 11 }}>Item</Table.Th>
                            <Table.Th style={{ color: '#fff', fontSize: 11 }}>Tujuan/Supplier</Table.Th>
                            <Table.Th style={{ color: '#fff', fontSize: 11, textAlign: 'center' }}>Shift</Table.Th>
                            <Table.Th style={{ color: '#fff', fontSize: 11, textAlign: 'center' }}>Tgl.Expired</Table.Th>
                            <Table.Th style={{ color: '#fff', fontSize: 11, textAlign: 'center' }}>Qty</Table.Th>
                            <Table.Th style={{ color: '#fff', fontSize: 11, textAlign: 'center' }}>Status</Table.Th>
                            <Table.Th style={{ color: '#fff', fontSize: 11, textAlign: 'center' }}>Location</Table.Th>
                            <Table.Th style={{ color: '#fff', fontSize: 11, textAlign: 'center' }}>Tanggal Permintaan</Table.Th>
                        </Table.Tr>
                    </Table.Thead>
                    <Table.Tbody>
                        {filtered.length === 0 ? <Table.Tr><Table.Td colSpan={9} ta="center" c="dimmed">Tidak ada log/data ditemukan</Table.Td></Table.Tr> : null}
                        {Object.entries(groupedLogs).map(([transId, items]: [string, any[]]) =>
                            items.map((r: any, idx: number) => (
                                <Table.Tr key={r.id} style={{ background: '#fff', borderTop: idx === 0 ? '1px solid #e5e7eb' : 'none', borderBottom: 'none' }}>
                                    {idx === 0 && (
                                        <Table.Td fw={700} ta="center" style={{ verticalAlign: 'middle', borderRight: '1px solid #eee' }} rowSpan={items.length}>{transId}</Table.Td>
                                    )}
                                    <Table.Td fw={600}>{r.barang?.nama}</Table.Td>
                                    {idx === 0 && <Table.Td ta="center" rowSpan={items.length} style={{ verticalAlign: 'middle', borderRight: '1px solid #eee' }}>{r.supplier || '-'}</Table.Td>}
                                    {idx === 0 && <Table.Td ta="center" rowSpan={items.length} style={{ verticalAlign: 'middle', borderRight: '1px solid #eee' }}>{r.shift?.name || '-'}</Table.Td>}

                                    <Table.Td ta="center">{r.expiry_date ? fmt(r.expiry_date).split(' ')[0] : '-'}</Table.Td>
                                    <Table.Td ta="center">{r.qty} {r.satuan}</Table.Td>

                                    <Table.Td ta="center" fw={700} c={statusColor(r.expiry_date)} style={{ textTransform: 'uppercase' }}>{statusLabel(r.expiry_date)}</Table.Td>
                                    <Table.Td ta="center" fw={700} c="#111827">{r.gudang?.zone || '-'}</Table.Td>

                                    {idx === 0 && <Table.Td ta="center" rowSpan={items.length} style={{ verticalAlign: 'middle', borderLeft: '1px solid #eee' }}>{fmt(r.created_at).split(' ')[0]}</Table.Td>}
                                </Table.Tr>
                            ))
                        )}
                    </Table.Tbody>
                </Table>
            )}
        </Box>
    );
}
