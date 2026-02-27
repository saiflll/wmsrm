'use client';
// @ts-nocheck
import React, { useState, useEffect } from 'react';
import { Box, Group, Button, Title, Table, Badge, TextInput, Select, Loader } from '@mantine/core';
import { api, unwrap, fmt, statusLabel, statusColor } from '../lib/api';

export default function ReportInboundPage() {
    const [logs, setLogs] = useState([]);
    const [search, setSearch] = useState('');
    const [filterShift, setFilterShift] = useState('');
    const [from, setFrom] = useState('');
    const [to, setTo] = useState('');
    const [loading, setLoading] = useState(true);

    useEffect(() => { load(); }, []);

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

    const filtered = logs
        .filter(r => !search || r.barang?.nama?.toLowerCase().includes(search.toLowerCase()) || r.no_po?.includes(search))
        .filter(r => !filterShift || r.shift?.name === filterShift);

    return (
        <Box>
            <Box style={{ background: '#fff', borderBottom: '1px solid #ddd', padding: '12px 20px' }}>
                <Title order={3} style={{ color: '#e6921e', fontWeight: 900 }}>REPORT INBOUND</Title>
            </Box>
            <Box p="md">
                <Group mb="md" gap="xs">
                    <Button size="xs" color="red" variant="filled" style={{ fontWeight: 700 }}>🖨 Print PDF</Button>
                    <Button size="xs" color="green" variant="filled" style={{ fontWeight: 700 }}>📊 Export Excel</Button>
                </Group>
                <Group mb="xs" gap="xs">
                    <TextInput placeholder="Cari..." size="xs" value={search} onChange={e => setSearch(e.target.value)} style={{ width: 200 }} />
                    <Select size="xs" placeholder="Shift" data={['Shift 1', 'Shift 2', 'Shift 3']} value={filterShift} onChange={v => setFilterShift(v || '')} clearable style={{ width: 100 }} />
                    <TextInput size="xs" type="date" value={from} onChange={e => setFrom(e.target.value)} style={{ width: 130 }} />
                    <TextInput size="xs" type="date" value={to} onChange={e => setTo(e.target.value)} style={{ width: 130 }} />
                    <Button size="xs" color="blue" onClick={load}>Filter</Button>
                    <Button size="xs" color="gray" variant="outline" onClick={() => { setSearch(''); setFilterShift(''); setFrom(''); setTo(''); }}>Reset</Button>
                </Group>
                {loading ? <Loader /> : (
                    <Table withTableBorder withColumnBorders style={{ fontSize: 11 }}>
                        <Table.Thead style={{ background: '#1a1a1a' }}>
                            <Table.Tr>
                                {['NoPO', 'Item', 'Tgl.Incoming', 'Shift', 'Tgl.Expired', 'Qty', 'Status', 'Location', 'Supplier', 'Batch'].map(h => (
                                    <Table.Th key={h} style={{ color: '#fff', fontSize: 11 }}>{h}</Table.Th>
                                ))}
                            </Table.Tr>
                        </Table.Thead>
                        <Table.Tbody>
                            {filtered.map(r => (
                                <Table.Tr key={r.id}>
                                    <Table.Td fw={600}>{r.no_po || '-'}</Table.Td>
                                    <Table.Td>{r.barang?.nama}</Table.Td>
                                    <Table.Td>{fmt(r.created_at)}</Table.Td>
                                    <Table.Td>{r.shift?.name || '-'}</Table.Td>
                                    <Table.Td>{fmt(r.expiry_date)}</Table.Td>
                                    <Table.Td ta="right">{r.qty} {r.satuan}</Table.Td>
                                    <Table.Td><Badge size="xs" color={statusColor(r.expiry_date)} variant="filled">{statusLabel(r.expiry_date)}</Badge></Table.Td>
                                    <Table.Td><Badge size="xs" color="blue">{r.gudang?.name || '-'}</Badge></Table.Td>
                                    <Table.Td>{r.supplier || '-'}</Table.Td>
                                    <Table.Td>{r.batch_no || '-'}</Table.Td>
                                </Table.Tr>
                            ))}
                        </Table.Tbody>
                    </Table>
                )}
            </Box>
        </Box>
    );
}
