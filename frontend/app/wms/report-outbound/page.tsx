'use client';
// @ts-nocheck
import React, { useState, useEffect } from 'react';
import { Box, Group, Button, Title, Table, Badge, TextInput, Select, Loader, Text } from '@mantine/core';
import { api, unwrap, fmt } from '../lib/api';

export default function ReportOutboundPage() {
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
            // also load outbound logs
            const res = await api().get(`/inventory/logs/outbound?${params}`);
            setLogs(unwrap(res));
        } catch (e) { console.error(e); }
        setLoading(false);
    };

    const filtered = logs
        .filter(r => !search || r.barang?.nama?.toLowerCase().includes(search.toLowerCase()) || r.no_ref?.includes(search) || r.tujuan?.toLowerCase().includes(search.toLowerCase()))
        .filter(r => !filterShift || r.shift?.name === filterShift);

    // Grouping by no_ref
    let currentRef = '';
    const rows = [];

    filtered.forEach((r, i) => {
        const isNewGroup = r.no_ref !== currentRef;
        if (isNewGroup) currentRef = r.no_ref;
        rows.push(
            <Table.Tr key={r.id} style={{ background: isNewGroup ? '#f8f9fa' : 'transparent', borderTop: isNewGroup ? '2px solid #dee2e6' : 'none' }}>
                <Table.Td>{isNewGroup ? <Text fw={700} c="blue">{r.no_ref || '-'}</Text> : ''}</Table.Td>
                <Table.Td fw={600}>{r.barang?.nama}</Table.Td>
                <Table.Td>{isNewGroup ? fmt(r.created_at) : ''}</Table.Td>
                <Table.Td><Badge size="xs" color="blue" variant="light">{r.gudang?.name}</Badge></Table.Td>
                <Table.Td ta="right">{r.qty} {r.satuan}</Table.Td>
                <Table.Td>{isNewGroup ? r.tujuan || '-' : ''}</Table.Td>
                <Table.Td>{isNewGroup ? r.shift?.name || '-' : ''}</Table.Td>
                <Table.Td>{r.batch_no || '-'}</Table.Td>
            </Table.Tr>
        );
    });

    return (
        <Box>
            <Box style={{ background: '#fff', borderBottom: '1px solid #ddd', padding: '12px 20px' }}>
                <Title order={3} style={{ color: '#e6921e', fontWeight: 900 }}>REPORT OUTBOUND (PICKING)</Title>
            </Box>
            <Box p="md">
                <Group mb="md" gap="xs">
                    <Button size="xs" color="red" variant="filled" style={{ fontWeight: 700 }}>🖨 Print PDF</Button>
                    <Button size="xs" color="green" variant="filled" style={{ fontWeight: 700 }}>📊 Export Excel</Button>
                </Group>
                <Group mb="xs" gap="xs">
                    <TextInput placeholder="Cari ref/tujuan/item..." size="xs" value={search} onChange={e => setSearch(e.target.value)} style={{ width: 220 }} />
                    <Select size="xs" placeholder="Shift" data={['Shift 1', 'Shift 2', 'Shift 3']} value={filterShift} onChange={v => setFilterShift(v || '')} clearable style={{ width: 100 }} />
                    <TextInput size="xs" type="date" value={from} onChange={e => setFrom(e.target.value)} style={{ width: 130 }} />
                    <TextInput size="xs" type="date" value={to} onChange={e => setTo(e.target.value)} style={{ width: 130 }} />
                    <Button size="xs" color="blue" onClick={load}>Filter</Button>
                    <Button size="xs" color="gray" variant="outline" onClick={() => { setSearch(''); setFilterShift(''); setFrom(''); setTo(''); load(); }}>Reset</Button>
                </Group>

                {loading ? <Loader /> : (
                    <Table withColumnBorders style={{ fontSize: 11, border: '1px solid #dee2e6' }}>
                        <Table.Thead style={{ background: '#1a1a1a' }}>
                            <Table.Tr>
                                {['ID Transaksi (Ref)', 'Item', 'Tgl.Picking', 'Location', 'Qty', 'Tujuan', 'Shift', 'Batch'].map(h => (
                                    <Table.Th key={h} style={{ color: '#fff', fontSize: 11 }}>{h}</Table.Th>
                                ))}
                            </Table.Tr>
                        </Table.Thead>
                        <Table.Tbody>
                            {rows}
                        </Table.Tbody>
                    </Table>
                )}
            </Box>
        </Box>
    );
}
