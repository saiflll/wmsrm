'use client';
import React, { useEffect, useState } from 'react';
import {
    Box, Paper, Group, Text, Title, Select, TextInput, Loader, Center, Alert,
} from '@mantine/core';
import { IconAlertCircle, IconPackages } from '@tabler/icons-react';
import api, { unwrap } from '../lib/api';
import { Table } from '../components/Table';

interface DailyStockItem {
    namaBarang: string;
    satuan: string;
    release: number;
    hold: number;
    waste: number;
    total: number;
}

interface DailyStockResponse {
    date: string;
    area: string;
    areas: string[];
    items: DailyStockItem[];
}

const formatDateId = (dateStr: string) => {
    if (!dateStr) return '-';
    const d = new Date(dateStr);
    return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
};

export default function DailyStockPage() {
    const [date, setDate] = useState<Date | null>(new Date());
    const [area, setArea] = useState<string>('');
    const [data, setData] = useState<DailyStockResponse | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        loadData();
    }, [area]);

    const loadData = async () => {
        setLoading(true);
        setError(null);
        try {
            const res = unwrap(await api.get(`/stock/daily-stock${area ? `?area=${encodeURIComponent(area)}` : ''}`));
            setData(res);
            if (!area && res?.areas?.length) {
                setArea(res.areas[0]);
            }
        } catch (e: any) {
            setError(e?.response?.data?.message || e.message || 'Gagal memuat data');
        }
        setLoading(false);
    };

    const totals = data?.items?.reduce(
        (acc, item) => {
            acc.release += item.release;
            acc.hold += item.hold;
            acc.waste += item.waste;
            acc.total += item.total;
            return acc;
        },
        { release: 0, hold: 0, waste: 0, total: 0 }
    ) || { release: 0, hold: 0, waste: 0, total: 0 };

    return (
        <Box>
            <Paper withBorder p="md" radius="md" mb="md" style={{ background: 'linear-gradient(135deg, #fff9db 0%, #ffec99 100%)' }}>
                <Group justify="space-between" align="flex-end" gap="md">
                    <Group gap="sm">
                        <IconPackages size={28} color="#f59f00" />
                        <div>
                            <Title order={4}>Daily Stock FG</Title>
                            <Text size="xs" c="dimmed">Cek stok harian per area/group berdasarkan data STOCK_ONHAND saat ini.</Text>
                        </div>
                    </Group>
                    <Group gap="sm" align="flex-end">
                        <TextInput
                            label="Cek Stock Per Tanggal"
                            type="date"
                            value={date ? date.toISOString().split('T')[0] : ''}
                            onChange={(e) => setDate(e.target.value ? new Date(e.target.value) : null)}
                            size="sm"
                            style={{ width: 180 }}
                        />
                        <Select
                            label="Area / Group"
                            placeholder="Pilih area"
                            data={(data?.areas || []).map((a) => ({ value: a, label: a }))}
                            value={area}
                            onChange={(val) => setArea(val || '')}
                            size="sm"
                            style={{ width: 180 }}
                            allowDeselect={false}
                        />
                    </Group>
                </Group>
            </Paper>

            {loading && (
                <Center py="xl"><Loader size="lg" /></Center>
            )}

            {error && (
                <Alert icon={<IconAlertCircle size={20} />} color="red" mb="md">{error}</Alert>
            )}

            {!loading && data && (
                <Paper withBorder radius="md" style={{ overflow: 'hidden' }}>
                    {/* Header row */}
                    <Box style={{ background: '#ffec99', padding: '12px 16px', borderBottom: '1px solid #dee2e6' }}>
                        <Group justify="space-between" align="center">
                            <Title order={5} ta="center" style={{ flex: 1, color: '#2b2b2b' }}>{formatDateId(data.date)}</Title>
                            <Box style={{ flex: 1, textAlign: 'center' }}>
                                <span style={{ background: '#91c788', color: '#fff', padding: '4px 16px', borderRadius: 6, fontWeight: 700, fontSize: 14 }}>
                                    {area || 'ALL'}
                                </span>
                            </Box>
                            <Title order={5} ta="center" style={{ flex: 1, color: '#2b2b2b' }}>DAILY STOCK</Title>
                        </Group>
                    </Box>

                    {/* Subtitle */}
                    <Box style={{ background: '#fff', padding: '8px 16px', textAlign: 'center', borderBottom: '1px solid #dee2e6' }}>
                        <Text fw={700} size="sm">STOCK CP3</Text>
                    </Box>

                    {/* Table */}
                    <Box style={{ overflowX: 'auto' }}>
                        <Table withTableBorder withColumnBorders style={{ fontSize: 13, minWidth: 700 }}>
                            <Table.Thead>
                                <Table.Tr>
                                    <Table.Th style={{ background: '#1c4fd1', color: '#fff', textAlign: 'center', fontWeight: 700 }}>NAMA BARANG</Table.Th>
                                    <Table.Th style={{ background: '#1c4fd1', color: '#fff', textAlign: 'center', fontWeight: 700 }}>SATUAN</Table.Th>
                                    <Table.Th style={{ background: '#d4edda', color: '#155724', textAlign: 'center', fontWeight: 700 }}>RELEASE</Table.Th>
                                    <Table.Th style={{ background: '#fff3cd', color: '#856404', textAlign: 'center', fontWeight: 700 }}>HOLD</Table.Th>
                                    <Table.Th style={{ background: '#f8d7da', color: '#721c24', textAlign: 'center', fontWeight: 700 }}>WASTE</Table.Th>
                                    <Table.Th style={{ background: '#1c4fd1', color: '#fff', textAlign: 'center', fontWeight: 700 }}>QTY CARTON</Table.Th>
                                </Table.Tr>
                            </Table.Thead>
                            <Table.Tbody>
                                {data.items.map((item, idx) => (
                                    <Table.Tr key={idx}>
                                        <Table.Td style={{ fontWeight: 700 }}>{item.namaBarang}</Table.Td>
                                        <Table.Td ta="center">{item.satuan}</Table.Td>
                                        <Table.Td ta="right" fw={700}>{item.release.toLocaleString()}</Table.Td>
                                        <Table.Td ta="right" fw={700}>{item.hold.toLocaleString()}</Table.Td>
                                        <Table.Td ta="right" fw={700}>{item.waste.toLocaleString()}</Table.Td>
                                        <Table.Td ta="right" fw={700}>{item.total.toLocaleString()}</Table.Td>
                                    </Table.Tr>
                                ))}
                                {data.items.length === 0 && (
                                    <Table.Tr>
                                        <Table.Td colSpan={6} ta="center" py="xl">
                                            <Text c="dimmed">Tidak ada data stok untuk area ini.</Text>
                                        </Table.Td>
                                    </Table.Tr>
                                )}
                            </Table.Tbody>
                        </Table>
                    </Box>

                    {/* Total row */}
                    <Box style={{ background: '#1c1c1c', color: '#fff', padding: '10px 16px' }}>
                        <Group justify="space-between" style={{ fontWeight: 800, fontSize: 14 }}>
                            <Text c="#fff" style={{ flex: 2 }}>TOTAL</Text>
                            <Text c="#fff" style={{ flex: 1, textAlign: 'right' }}>{totals.release.toLocaleString()}</Text>
                            <Text c="#fff" style={{ flex: 1, textAlign: 'right' }}>{totals.hold.toLocaleString()}</Text>
                            <Text c="#fff" style={{ flex: 1, textAlign: 'right' }}>{totals.waste.toLocaleString()}</Text>
                            <Text c="#fff" style={{ flex: 1, textAlign: 'right' }}>{totals.total.toLocaleString()}</Text>
                        </Group>
                    </Box>

                    {/* Footer notes */}
                    <Box p="md" style={{ background: '#f8f9fa' }}>
                        <Text size="xs" c="dimmed">
                            Mode hari ini/masa depan: menggunakan data current dari STOCK_ONHAND.
                        </Text>
                        <Text size="xs" c="dimmed">
                            Kolom RELEASE mencakup status RELEASE/GOOD. Kolom WASTE mencakup WASTE/REJECT/DAMAGED/EXP.
                        </Text>
                    </Box>
                </Paper>
            )}
        </Box>
    );
}
