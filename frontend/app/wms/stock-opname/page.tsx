// @ts-nocheck
'use client';
import React, { useState, useEffect, useCallback } from 'react';
import {
    Box, Group, Button, Title, Text, Badge, Paper, Stack, TextInput,
    Modal, NumberInput, Loader, Table
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import { IconFileTypePdf, IconFileSpreadsheet } from '@tabler/icons-react';
import { api, unwrap, fmt } from '../lib/api';

// Helper: generate & download CSV
function downloadCsv(data: any[], zone: string) {
    const headers = [
        'Nomor Rak', 'Item Code', 'Item Name', 'Category', 'UOM', 'Location',
        'Batch/Lot', 'Expiry Date', 'Stock Akhir (Sistem)', 'Stock Opname',
        'Variance (Phys-Book)', 'Abs Variance', 'Variance %', 'Accuracy %',
        'Aging Status', 'Hari ke Expired', 'Status Tolerance', 'Counted?', 'Notes'
    ];
    const rows = data.map((r: any) => [
        r.nomor_rak, r.item_code, r.item_name, r.category, r.uom, r.location,
        r.batch_lot, r.expiry_date, r.stock_akhir,
        r.stock_opname !== null ? r.stock_opname : '',
        r.variance_phys_book !== null ? r.variance_phys_book : '',
        r.abs_variance !== null ? r.abs_variance : '',
        r.variance_pct !== null ? r.variance_pct + '%' : '',
        r.accuracy_pct + '%',
        r.aging_status,
        r.days_to_exp !== null ? r.days_to_exp : '',
        r.tolerance_ok ? 'OK' : 'TIDAK OK',
        r.stock_opname !== null ? 'Y' : 'N',
        r.notes,
    ]);

    const csvContent = [headers, ...rows]
        .map((row: any) => row.map((cell: any) => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(','))
        .join('\n');

    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `StockOpname_${zone}_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
}

export default function StockOpnamePage() {
    const [summary, setSummary] = useState<any[]>([]);
    const [zone, setZone] = useState('DRY A');
    const [loading, setLoading] = useState(true);
    const [exporting, setExporting] = useState(false);

    const [opened, { open, close }] = useDisclosure(false);
    const [sel, setSel] = useState(null);
    const [actualQty, setActualQty] = useState('');

    const [allZones, setAllZones] = useState<string[]>(['CS FROZEN', 'CHILL', 'DRY A', 'DRY B', 'DRY FG']);

    useEffect(() => {
        api().get('/gudang').then(r => {
            const z = Array.from(new Set(unwrap(r).map((g: any) => g.zone).filter(Boolean)));
            if (z.length) setAllZones(z as string[]);
        }).catch(() => { });
    }, []);

    useEffect(() => { load(); }, [zone]);

    const load = async () => {
        setLoading(true);
        try {
            const res = await api().get(`/inventory/opname/summary?zone=${zone}`);
            setSummary(unwrap(res));
        } catch (e) { console.error(e); }
        setLoading(false);
    };

    const doOpname = async () => {
        if (!sel || actualQty === '') return;
        try {
            await api().post('/inventory/opname', {
                gudang_id: sel.gudang.id,
                qty_opname: Number(actualQty),
            });
            notifications.show({ title: 'Sukses', message: `Opname ${sel.gudang.name} tersimpan`, color: 'green' });
            close();
            load();
        } catch (e: any) {
            notifications.show({ title: 'Error', message: unwrap(e.response)?.message || 'Gagal', color: 'red' });
        }
    };

    const handleExport = async () => {
        setExporting(true);
        try {
            const res = await api().get(`/inventory/opname/export?zone=${zone}`);
            const data = unwrap(res);
            if (!data || !data.length) {
                notifications.show({ title: 'Info', message: 'Tidak ada data untuk diexport', color: 'blue' });
                setExporting(false);
                return;
            }
            downloadCsv(data, zone);
            notifications.show({ title: 'Export Berhasil', message: `${data.length} baris data diexport`, color: 'green' });
        } catch (e) {
            notifications.show({ title: 'Error', message: 'Gagal export data', color: 'red' });
        }
        setExporting(false);
    };

    const handlePrint = async () => {
        setExporting(true);
        try {
            const res = await api().get(`/inventory/opname/export?zone=${zone}`);
            const data = unwrap(res);
            if (!data || !data.length) {
                notifications.show({ title: 'Info', message: 'Tidak ada data untuk diprint', color: 'blue' });
                setExporting(false);
                return;
            }

            const win = window.open('', '_blank');
            if (!win) return;
            win.document.write(`
                <html>
                <head>
                    <title>Stock Opname - ${zone}</title>
                    <style>
                        body { font-family: Arial; padding: 20px; font-size: 11px; }
                        table { width: 100%; border-collapse: collapse; margin-top: 15px; }
                        th, td { border: 1px solid #333; padding: 6px; text-align: left; }
                        th { background: #eee; }
                        .header { font-size: 16px; font-weight: bold; margin-bottom: 10px; border-bottom: 2px solid #000; padding-bottom: 10px; }
                        .info { display: flex; justify-content: space-between; margin-bottom: 10px; }
                    </style>
                </head>
                <body>
                    <div class="header">STOCK OPNAME REPORT</div>
                    <div class="info">
                        <div>
                            <b>Zone / Area:</b> ${zone}<br/>
                            <b>Total Rak:</b> ${data.length}
                        </div>
                        <div style="text-align: right">
                            <b>Dicetak:</b> ${new Date().toLocaleString()}<br/>
                        </div>
                    </div>
                    <table>
                        <thead>
                            <tr>
                                <th>Rak</th>
                                <th>Item</th>
                                <th>Batch</th>
                                <th>Exp</th>
                                <th>Sistem</th>
                                <th>Fisik</th>
                                <th>Selisih</th>
                                <th>Akurasi</th>
                                <th>Notes</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${data.map((r: any) => `
                                <tr>
                                    <td>${r.nomor_rak}</td>
                                    <td>${r.item_name || ''}</td>
                                    <td>${r.batch_lot || '-'}</td>
                                    <td>${r.expiry_date ? fmt(r.expiry_date) : '-'}</td>
                                    <td>${r.stock_akhir}</td>
                                    <td>${r.stock_opname !== null ? r.stock_opname : ''}</td>
                                    <td>${r.variance_phys_book !== null ? r.variance_phys_book : ''}</td>
                                    <td>${r.accuracy_pct !== null ? r.accuracy_pct + '%' : ''}</td>
                                    <td>${r.notes || ''}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                    <script>window.onload=()=>{window.print();window.close()}</script>
                </body>
                </html>
            `);
            win.document.close();

        } catch (e) {
            notifications.show({ title: 'Error', message: 'Gagal fetch laporan', color: 'red' });
        }
        setExporting(false);
    };


    const selRack = (s) => {
        if (!s.filled) return notifications.show({ title: 'Info', message: 'Rak kosong, tidak perlu opname', color: 'blue' });
        setSel(s);
        setActualQty(s.totalQty);
        open();
    };

    // Calculate accuracy percentage
    const locsWithStock = summary.filter((s: any) => s.filled);
    const opnamed = locsWithStock.filter((s: any) => s.opnamed).length;
    const accuracy = locsWithStock.length ? Math.round((opnamed / locsWithStock.length) * 100) : 100;

    // Aging count
    const agingCount = summary.filter((s: any) =>
        s.stocks?.some(st => {
            if (!st.expiry_date) return false;
            const days = (new Date(st.expiry_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24);
            return days < 90;
        })
    ).length;
    const expiredCount = summary.filter((s: any) =>
        s.stocks?.some(st => st.expiry_date && new Date(st.expiry_date) < new Date())
    ).length;

    // Grouping by Kolom then Level
    const byKolom = {};
    summary.forEach((s: any) => {
        const k = s.gudang.kolom || 'A';
        const lvl = s.gudang.level || 1;
        if (!byKolom[k]) byKolom[k] = {};
        if (!byKolom[k][lvl]) byKolom[k][lvl] = [];
        byKolom[k][lvl].push(s);
    });
    const sortedKoloms = Object.keys(byKolom).sort();

    // Get aging color for rack
    const getRackColor = (s) => {
        if (!s.filled) return { bg: '#e5e7eb', text: '#9ca3af' };
        const hasExpired = s.stocks?.some(st => st.expiry_date && new Date(st.expiry_date) < new Date());
        if (hasExpired) return { bg: '#ef4444', text: '#fff' };
        const hasNearExp = s.stocks?.some(st => {
            if (!st.expiry_date) return false;
            const days = (new Date(st.expiry_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24);
            return days < 30;
        });
        if (hasNearExp) return { bg: '#f97316', text: '#fff' };
        const hasAging = s.stocks?.some(st => {
            if (!st.expiry_date) return false;
            const days = (new Date(st.expiry_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24);
            return days < 90;
        });
        if (hasAging) return { bg: '#eab308', text: '#fff' };
        return { bg: '#0ea5e9', text: '#fff' };
    };

    return (
        <Box>
            <Box style={{ background: '#fff', borderBottom: '1px solid #ddd', padding: '20px' }}>
                <Title order={4} style={{ color: '#d98b26', fontWeight: 800 }}>STOCK OPNAME</Title>

                <Group mt="md" gap="sm">
                    {allZones.map((z: any) => (
                        <Button
                            key={z}
                            radius="md"
                            size="sm"
                            style={{
                                backgroundColor: zone === z ? '#111827' : '#1f2937',
                                color: '#fff',
                                fontWeight: 700,
                                opacity: zone === z ? 1 : 0.8
                            }}
                            onClick={() => setZone(z)}
                        >
                            {z}
                        </Button>
                    ))}

                    <Box ml="auto" style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
                        <Group gap={6}>
                            <Box w={40} h={16} style={{ background: '#0ea5e9', borderRadius: 10 }}></Box>
                            <Text size="xs" fw={700}>TERISI</Text>
                        </Group>
                        <Group gap={6}>
                            <Box w={40} h={16} style={{ background: '#eab308', borderRadius: 10 }}></Box>
                            <Text size="xs" fw={700}>AGING (&lt;90hr)</Text>
                        </Group>
                        <Group gap={6}>
                            <Box w={40} h={16} style={{ background: '#f97316', borderRadius: 10 }}></Box>
                            <Text size="xs" fw={700}>NEAR EXPIRED</Text>
                        </Group>
                        <Group gap={6}>
                            <Box w={40} h={16} style={{ background: '#ef4444', borderRadius: 10 }}></Box>
                            <Text size="xs" fw={700}>EXPIRED</Text>
                        </Group>
                        <Group gap={6}>
                            <Box w={40} h={16} style={{ background: '#e5e7eb', borderRadius: 10 }}></Box>
                            <Text size="xs" fw={700}>KOSONG</Text>
                        </Group>
                    </Box>
                </Group>
            </Box>

            <Box p="xl">
                <Group justify="space-between" align="flex-end" mb="xl">
                    <Group gap="xs">
                        <TextInput placeholder="Cari berdasarkan ID, Kode..." size="xs" radius="md" style={{ width: 220 }} leftSection="🔍" />
                        <Text size="xs" fw={600} ml="md">dari</Text>
                        <TextInput type="date" size="xs" radius="md" />
                        <Text size="xs" fw={600}>sampai</Text>
                        <TextInput type="date" size="xs" radius="md" />
                        <Button size="xs" color="blue" radius="md">Filter</Button>
                        <Button size="xs" color="gray" variant="outline" radius="md">Reset</Button>
                    </Group>

                    <Box style={{ textAlign: 'right' }}>
                        <Text fw={800} size="md" mb={4}>Stock Akurasi : {accuracy} %</Text>
                        {agingCount > 0 && (
                            <Text size="xs" c="orange" fw={700} mb={4}>⚠ Aging Material: {agingCount} rak | Expired: {expiredCount} rak</Text>
                        )}
                        <Group gap="xs">
                            <Button
                                size="xs"
                                color="red"
                                radius="md"
                                loading={exporting}
                                leftSection={<IconFileTypePdf size={16} />}
                                onClick={handlePrint}
                            >
                                Print PDF
                            </Button>
                            <Button
                                size="xs"
                                color="green"
                                radius="md"
                                loading={exporting}
                                leftSection={<IconFileSpreadsheet size={16} />}
                                onClick={handleExport}
                            >
                                Export Excel
                            </Button>
                        </Group>
                    </Box>
                </Group>

                {loading ? <Loader /> : (
                    <Box>
                        {sortedKoloms.map((k: any) => {
                            const levelsMap = byKolom[k];
                            const sortedLevels = Object.keys(levelsMap).sort((a, b) => Number(a) - Number(b));

                            return (
                                <Box key={k} mb="xl">
                                    <Group gap="xl" mb="md" mt="md">
                                        <Text fw={800} size="sm">LEVEL</Text>
                                        <Text fw={800} size="sm">KOLOM : {k}</Text>
                                    </Group>

                                    <Stack gap="md">
                                        {sortedLevels.map((lvl: any) => {
                                            const racks = levelsMap[lvl].sort((a, b) => a.gudang.name.localeCompare(b.gudang.name));
                                            return (
                                                <Group key={lvl} gap="xl" align="center" wrap="nowrap">
                                                    <Text fw={800} size="sm" w={60}>LEVEL {lvl}</Text>

                                                    <Group gap="xs" style={{ flexWrap: 'wrap' }}>
                                                        {racks.map((r: any) => {
                                                            const { bg, text } = getRackColor(r);
                                                            const isOpnamed = r.opnamed;
                                                            const borderBottom = isOpnamed ? '3px solid #000' : 'none';

                                                            return (
                                                                <Box key={r.gudang.id} style={{ position: 'relative' }}>
                                                                    <Button
                                                                        radius="md"
                                                                        style={{
                                                                            background: bg,
                                                                            color: text,
                                                                            width: 75,
                                                                            height: 36,
                                                                            borderBottom: borderBottom,
                                                                            fontWeight: 800,
                                                                            fontSize: 12,
                                                                            padding: 0
                                                                        }}
                                                                        onClick={() => selRack(r)}
                                                                        title={r.stocks?.map((s: any) => `${s.barang?.nama}: ${s.qty}${s.satuan ? ' ' + s.satuan : ''}`).join('\n')}
                                                                    >
                                                                        {r.gudang.name}
                                                                    </Button>
                                                                </Box>
                                                            );
                                                        })}
                                                    </Group>
                                                </Group>
                                            );
                                        })}
                                    </Stack>
                                </Box>
                            );
                        })}
                    </Box>
                )}

                <Modal
                    opened={opened}
                    onClose={close}
                    title={<Text fw={900}>STOCK OPNAME</Text>}
                    centered
                    size="sm"
                    styles={{ content: { backgroundColor: '#e5e7eb', borderRadius: 12 } }}
                >
                    {sel && (
                        <Stack gap="sm">
                            <TextInput readOnly value={sel.gudang.name} size="sm" radius="md" label="Lokasi Rak" styles={{ input: { backgroundColor: '#fff', color: '#000', fontWeight: 700 } }} />
                            <TextInput readOnly value={sel.stocks[0]?.barang?.nama || ''} size="sm" radius="md" label="Nama Item" styles={{ input: { backgroundColor: '#fff', color: '#000', fontSize: 13 } }} />
                            <TextInput readOnly value={sel.stocks[0]?.batch_no || '-'} size="sm" radius="md" label="Batch/Lot" styles={{ input: { backgroundColor: '#fff' } }} />

                            <Box mt="xs">
                                <Text size="xs" fw={700} c="dimmed" mb={2}>Tanggal Expired</Text>
                                <TextInput
                                    readOnly
                                    value={sel.stocks[0]?.expiry_date ? fmt(sel.stocks[0].expiry_date) : '-'}
                                    size="sm"
                                    radius="md"
                                    styles={{
                                        input: {
                                            backgroundColor: '#fff',
                                            color: sel.stocks[0]?.expiry_date && new Date(sel.stocks[0].expiry_date) < new Date() ? 'red' : 'inherit',
                                            fontWeight: 600
                                        }
                                    }}
                                />
                                {sel.stocks[0]?.expiry_date && (() => {
                                    const days = Math.floor((new Date(sel.stocks[0].expiry_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
                                    return days < 0
                                        ? <Text size="xs" c="red" fw={700}>EXPIRED ({Math.abs(days)} hari lalu)</Text>
                                        : days < 90
                                            ? <Text size="xs" c="orange" fw={700}>AGING: {days} hari tersisa</Text>
                                            : null;
                                })()}
                            </Box>

                            <Box mt="xs">
                                <Text size="xs" fw={700} c="dimmed" mb={2}>Stock Akhir (Sistem)</Text>
                                <Group gap="xs" wrap="nowrap">
                                    <TextInput readOnly value={sel.totalQty} size="sm" radius="md" style={{ flex: 1 }} styles={{ input: { backgroundColor: '#fff', fontWeight: 700, textAlign: 'center' } }} />
                                    <TextInput readOnly value={sel.stocks[0]?.satuan || '-'} size="sm" w={80} radius="md" styles={{ input: { backgroundColor: '#fff' } }} />
                                </Group>
                            </Box>

                            <Box mt="xs">
                                <Text size="xs" fw={700} c="dimmed" mb={2}>Stock Aktual Fisik</Text>
                                <Group gap="xs" wrap="nowrap">
                                    <NumberInput
                                        value={actualQty}
                                        onChange={v => setActualQty(v)}
                                        size="sm"
                                        radius="md"
                                        hideControls
                                        style={{ flex: 1 }}
                                        styles={{ input: { backgroundColor: '#fff', fontWeight: 700, textAlign: 'center' } }}
                                    />
                                    <TextInput readOnly value={sel.stocks[0]?.satuan || '-'} size="sm" w={80} radius="md" styles={{ input: { backgroundColor: '#fff' } }} />
                                </Group>
                            </Box>

                            {/* Variance display */}
                            {actualQty !== '' && actualQty !== sel.totalQty && (
                                <Box style={{ background: '#fff', borderRadius: 8, padding: '8px 12px' }}>
                                    <Text size="xs" fw={700}>Variance: {Number(actualQty) - sel.totalQty > 0 ? '+' : ''}{Number(actualQty) - sel.totalQty}</Text>
                                    <Text size="xs" c="dimmed">Accuracy: {sel.totalQty > 0 ? Math.round((Math.min(Number(actualQty), sel.totalQty) / Math.max(Number(actualQty), sel.totalQty)) * 100) : 100}%</Text>
                                </Box>
                            )}

                            <Text fw={800} size="sm" mt="sm">
                                Stock Akurasi : {sel.totalQty > 0 ? Math.round((Number(actualQty) / sel.totalQty) * 100) : 100} %
                            </Text>

                            <Button fullWidth bg="#111827" c="#fff" size="md" radius="md" mt="sm" onClick={doOpname} style={{ fontWeight: 700 }}>
                                Submit
                            </Button>
                            <Button fullWidth bg="#ef4444" c="#fff" size="md" radius="md" onClick={close} style={{ fontWeight: 700 }}>
                                Close
                            </Button>
                        </Stack>
                    )}
                </Modal>
            </Box>
        </Box>
    );
}
