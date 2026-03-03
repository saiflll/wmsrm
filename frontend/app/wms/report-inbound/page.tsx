// @ts-nocheck
'use client';
import React, { useState, useEffect } from 'react';
import { Box, Group, Button, Title, Table, Badge, TextInput, Select, Loader, Text } from '@mantine/core';
import { api, unwrap, fmt, statusLabel, statusColor } from '../lib/api';
import { IconFileTypePdf, IconFileSpreadsheet } from '@tabler/icons-react';

function exportCsv(data: any[]) {
    const headers = ['NoPO', 'Item', 'Tgl.Incoming', 'Shift', 'Tgl.Expired', 'Qty', 'Satuan', 'Status', 'Zone', 'Lokasi', 'Supplier', 'Batch', 'Jam Datang', 'Jam Bongkar', 'Jam Selesai'];
    const rows = data.map((r: any) => [
        r.no_po, r.barang?.nama, fmt(r.created_at), r.shift?.name || '',
        r.expiry_date ? fmt(r.expiry_date) : '', r.qty, r.satuan,
        statusLabel(r.expiry_date), r.gudang?.zone, r.gudang?.name, r.supplier, r.batch_no,
        r.jam_datang || '', r.jam_bongkar || '', r.jam_selesai || ''
    ]);
    const csv = [headers, ...rows]
        .map((row: any) => row.map((c: any) => `"${String(c ?? '').replace(/"/g, '""')}"`).join(','))
        .join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `ReportInbound_${new Date().toISOString().split('T')[0]}.csv`;
    a.click(); URL.revokeObjectURL(url);
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
    const supplierOpts = [{ value: '', label: 'Semua Supplier' }, ...customers.filter((c: any) => c?.name).map((c: any) => ({ value: c.name, label: c.name }))];
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
        const win = window.open('', '_blank');
        if (!win) return;
        win.document.write(`
            <html>
            <head>
                <title>Report Inbound</title>
                <style>
                    body { font-family: Arial; padding: 20px; font-size: 11px; }
                    table { width: 100%; border-collapse: collapse; margin-top: 15px; }
                    th, td { border: 1px solid #333; padding: 6px; text-align: left; }
                    th { background: #eee; }
                    .header { font-size: 16px; font-weight: bold; margin-bottom: 20px; border-bottom: 2px solid #000; padding-bottom: 10px; }
                </style>
            </head>
            <body>
                <div class="header">REPORT INBOUND DOCUMENT (Dari: ${from || '-'}, Sampai: ${to || '-'})</div>
                <table>
                    <thead>
                        <tr>
                            <th>ID Transaksi/PO</th>
                            <th>Item Name</th>
                            <th>Pemasok (Tujuan)</th>
                            <th>Shift</th>
                            <th>Tgl.Expired</th>
                            <th>Qty</th>
                            <th>Status/Satuan</th>
                            <th>Location (Lokasi)</th>
                            <th>Tanggal Masuk</th>
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
                                    <td>${r.expiry_date ? fmt(r.expiry_date).split(' ')[0] : '-'}</td>
                                    <td>${r.qty} ${r.satuan || ''}</td>
                                    <td>${statusLabel(r.expiry_date)}</td>
                                    <td>${r.gudang?.name} (${r.gudang?.zone || '-'})</td>
                                    ${idx === 0 ? `<td rowspan="${items.length}">${fmt(r.created_at).split(' ')[0]}</td>` : ''}
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
                <Button size="xs" color="green" radius="md" onClick={() => exportCsv(filtered)} leftSection={<IconFileSpreadsheet size={16} />}>
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
