'use client';
// @ts-nocheck
import React, { useState, useEffect } from 'react';
import { Box, Group, Button, Title, Text, Table, Badge, Paper, Stack, TextInput, Select, Loader, NumberInput } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { api, unwrap, fmt, statusLabel, statusColor } from '../lib/api';

export default function RelocationPage() {
    const [type, setType] = useState('wet');
    const [stocks, setStocks] = useState([]);
    const [gudangs, setGudangs] = useState([]);
    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => { load(); }, [type]);

    const load = async () => {
        setLoading(true);
        try {
            const side = type === 'dry';
            const [s, g, l] = await Promise.all([
                api().get(`/inventory/stock?side=${side}`),
                api().get(`/gudang?side=${side}`),
                api().get('/inventory/logs?type=RELOCATION'),
            ]);
            setStocks(unwrap(s));
            setGudangs(unwrap(g));
            setLogs(unwrap(l));
        } catch (e) { console.error(e); }
        setLoading(false);
    };

    const [selStock, setSelStock] = useState('');
    const [selDest, setSelDest] = useState('');
    const [relQty, setRelQty] = useState(0);

    const doRelocate = async () => {
        if (!selStock || !selDest || !relQty) return notifications.show({ title: 'Error', message: 'Lengkapi form', color: 'red' });
        try {
            await api().post('/inventory/relocation', { stock_id: +selStock, gudang_tujuan_id: +selDest, qty: relQty });
            notifications.show({ title: 'Sukses', message: 'Relokasi berhasil', color: 'green' });
            setSelStock(''); setSelDest(''); setRelQty(0);
            load();
        } catch (e: any) {
            notifications.show({ title: 'Error', message: unwrap(e.response)?.message || 'Gagal', color: 'red' });
        }
    };

    const stockOpts = stocks.map(s => ({ value: String(s.id), label: `${s.barang?.nama} @ ${s.gudang?.name} (${s.qty} ${s.satuan})` }));
    const gudangOpts = gudangs.map(g => ({ value: String(g.id), label: g.name }));

    return (
        <Box>
            <Box style={{ background: '#fff', borderBottom: '1px solid #ddd', padding: '12px 20px' }}>
                <Group justify="space-between">
                    <Title order={3} style={{ color: '#e6921e', fontWeight: 900 }}>RELOCATION</Title>
                    <Group gap="xs">
                        <Button size="xs" color={type === 'wet' ? 'yellow' : 'gray'} variant={type === 'wet' ? 'filled' : 'outline'} onClick={() => setType('wet')} style={{ fontWeight: 700 }}>ITEM WET</Button>
                        <Button size="xs" variant={type === 'dry' ? 'filled' : 'outline'} color="gray" onClick={() => setType('dry')} style={{ fontWeight: 700 }}>ITEM DRY</Button>
                    </Group>
                </Group>
            </Box>

            <Box p="md">
                <Group align="flex-start" gap="md">
                    <Paper withBorder p="md" style={{ width: 280, flexShrink: 0 }}>
                        <Stack gap="xs">
                            <Select label="Pilih Stock" size="xs" searchable data={stockOpts} value={selStock} onChange={v => setSelStock(v || '')} placeholder="Item @ Lokasi" />
                            <Select label="Tujuan" size="xs" searchable data={gudangOpts} value={selDest} onChange={v => setSelDest(v || '')} placeholder="Lokasi tujuan" />
                            <NumberInput label="Qty" size="xs" value={relQty} onChange={v => setRelQty(Number(v))} min={1} />
                            <Button fullWidth size="xs" color="blue" onClick={doRelocate} style={{ fontWeight: 700 }}>PINDAHKAN</Button>
                        </Stack>
                    </Paper>

                    <Box style={{ flex: 1 }}>
                        <Text fw={700} size="sm" mb="xs">RIWAYAT RELOKASI ({logs.length})</Text>
                        {loading ? <Loader /> : (
                            <Table withTableBorder withColumnBorders style={{ fontSize: 11 }}>
                                <Table.Thead style={{ background: '#1a1a1a' }}>
                                    <Table.Tr>
                                        {['Item', 'Dari', 'Ke', 'Qty', 'Tgl.Expired', 'Status', 'Tanggal'].map(h => (
                                            <Table.Th key={h} style={{ color: '#fff', fontSize: 11 }}>{h}</Table.Th>
                                        ))}
                                    </Table.Tr>
                                </Table.Thead>
                                <Table.Tbody>
                                    {logs.map(r => (
                                        <Table.Tr key={r.id}>
                                            <Table.Td fw={600}>{r.barang?.nama}</Table.Td>
                                            <Table.Td><Badge size="xs" color="blue">{r.gudang?.name}</Badge></Table.Td>
                                            <Table.Td><Badge size="xs" color="green">{r.gudang_tujuan?.name || '-'}</Badge></Table.Td>
                                            <Table.Td ta="right">{r.qty} {r.satuan}</Table.Td>
                                            <Table.Td>{fmt(r.expiry_date)}</Table.Td>
                                            <Table.Td><Badge size="xs" color={statusColor(r.expiry_date)} variant="filled">{statusLabel(r.expiry_date)}</Badge></Table.Td>
                                            <Table.Td>{fmt(r.created_at)}</Table.Td>
                                        </Table.Tr>
                                    ))}
                                </Table.Tbody>
                            </Table>
                        )}
                    </Box>
                </Group>
            </Box>
        </Box>
    );
}
