'use client';
// @ts-nocheck
import React, { useState, useEffect } from 'react';
import { Box, Group, Button, Title, Text, Table, Badge, Paper, Stack, TextInput, Select, Loader } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { api, unwrap, fmt, statusLabel, statusColor } from '../lib/api';

export default function PutawayPage() {
    const [type, setType] = useState('wet');
    const [stocks, setStocks] = useState([]);
    const [gudangs, setGudangs] = useState([]);
    const [search, setSearch] = useState('');
    const [filterStatus, setFilterStatus] = useState('');
    const [selectedLoc, setSelectedLoc] = useState('');
    const [loading, setLoading] = useState(true);

    useEffect(() => { load(); }, [type]);

    const load = async () => {
        setLoading(true);
        try {
            const side = type === 'dry';
            const [s, g] = await Promise.all([
                api().get(`/inventory/stock?side=${side}`),
                api().get(`/gudang?side=${side}`),
            ]);
            setStocks(unwrap(s));
            setGudangs(unwrap(g));
        } catch (e) { console.error(e); }
        setLoading(false);
    };

    const relocate = async (stock) => {
        if (!selectedLoc) return notifications.show({ title: 'Error', message: 'Pilih lokasi tujuan dulu', color: 'red' });
        try {
            await api().post('/inventory/relocation', {
                stock_id: stock.id,
                gudang_tujuan_id: +selectedLoc,
                qty: stock.qty,
            });
            notifications.show({ title: 'Sukses', message: `${stock.barang?.nama} dipindahkan`, color: 'green' });
            load();
        } catch (e: any) {
            notifications.show({ title: 'Error', message: unwrap(e.response)?.message || 'Failed', color: 'red' });
        }
    };

    const filtered = stocks
        .filter(r => !search || r.barang?.nama?.toLowerCase().includes(search.toLowerCase()))
        .filter(r => !filterStatus || statusLabel(r.expiry_date) === filterStatus);

    const gudangOpts = gudangs.map(g => ({ value: String(g.id), label: g.name }));

    return (
        <Box>
            <Box style={{ background: '#fff', borderBottom: '1px solid #ddd', padding: '12px 20px' }}>
                <Group justify="space-between">
                    <Title order={3} style={{ color: '#e6921e', fontWeight: 900 }}>PUTAWAY</Title>
                    <Group gap="xs">
                        <Button size="xs" color={type === 'wet' ? 'yellow' : 'gray'} variant={type === 'wet' ? 'filled' : 'outline'} onClick={() => setType('wet')} style={{ fontWeight: 700 }}>ITEM WET</Button>
                        <Button size="xs" variant={type === 'dry' ? 'filled' : 'outline'} color="gray" onClick={() => setType('dry')} style={{ fontWeight: 700 }}>ITEM DRY</Button>
                    </Group>
                </Group>
            </Box>

            <Box p="md">
                <Group align="flex-start" gap="md">
                    {/* Side panel */}
                    <Paper withBorder p="md" style={{ width: 220, flexShrink: 0 }}>
                        <Stack gap="xs">
                            <Text size="xs" fw={600}>Transfer Location</Text>
                            <Select size="xs" searchable data={gudangOpts} value={selectedLoc} onChange={v => setSelectedLoc(v || '')} placeholder="Pilih lokasi tujuan" />
                            <Text size="xs" c="dimmed">Pilih lokasi lalu klik PINDAHKAN pada item</Text>
                        </Stack>
                    </Paper>

                    {/* Table */}
                    <Box style={{ flex: 1 }}>
                        <Group mb="xs" gap="xs">
                            <TextInput placeholder="Cari item..." size="xs" value={search} onChange={e => setSearch(e.target.value)} style={{ width: 200 }} />
                            <Button size="xs" variant={filterStatus === 'NEAR EXPIRED' ? 'filled' : 'outline'} color="orange" onClick={() => setFilterStatus(p => p === 'NEAR EXPIRED' ? '' : 'NEAR EXPIRED')}>▼ NEAR EXPIRED</Button>
                            <Button size="xs" color="gray" variant="outline" onClick={() => { setSearch(''); setFilterStatus(''); }}>Reset</Button>
                        </Group>

                        <Text fw={700} size="sm" mb="xs">ITEM {type.toUpperCase()} ({filtered.length})</Text>

                        {loading ? <Loader /> : (
                            <Table withTableBorder withColumnBorders style={{ fontSize: 11 }}>
                                <Table.Thead style={{ background: '#1a1a1a' }}>
                                    <Table.Tr>
                                        {['Item', 'Lokasi', 'Batch', 'Tgl.Expired', 'Qty', 'Status', 'Aksi'].map(h => (
                                            <Table.Th key={h} style={{ color: '#fff', fontSize: 11 }}>{h}</Table.Th>
                                        ))}
                                    </Table.Tr>
                                </Table.Thead>
                                <Table.Tbody>
                                    {filtered.map(r => (
                                        <Table.Tr key={r.id}>
                                            <Table.Td fw={600}>{r.barang?.nama}</Table.Td>
                                            <Table.Td><Badge size="xs" color="blue">{r.gudang?.name}</Badge></Table.Td>
                                            <Table.Td>{r.batch_no || '-'}</Table.Td>
                                            <Table.Td>{fmt(r.expiry_date)}</Table.Td>
                                            <Table.Td ta="right">{r.qty} {r.satuan}</Table.Td>
                                            <Table.Td><Badge size="xs" color={statusColor(r.expiry_date)} variant="filled">{statusLabel(r.expiry_date)}</Badge></Table.Td>
                                            <Table.Td>
                                                <Button size="xs" color="blue" variant="light" onClick={() => relocate(r)} disabled={!selectedLoc}>PINDAHKAN</Button>
                                            </Table.Td>
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
