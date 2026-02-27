'use client';
// @ts-nocheck
import React, { useState, useEffect } from 'react';
import { Box, Group, Button, Title, Text, Table, Badge, Loader, TextInput } from '@mantine/core';
import { api, unwrap, fmt } from '../lib/api';

export default function InventoryPage() {
    const [side, setSide] = useState(true);
    const [data, setData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');

    useEffect(() => { load(); }, [side]);

    const load = async () => {
        setLoading(true);
        try {
            const res = await api().get(`/inventory/matrix?side=${side}`);
            setData(unwrap(res));
        } catch (e) { console.error(e); }
        setLoading(false);
    };

    // Collect all dates
    const allDates = [...new Set(data.flatMap(d => Object.keys(d.daily || {})))].sort();
    const filtered = search ? data.filter(d => d.nama?.toLowerCase().includes(search.toLowerCase())) : data;

    return (
        <Box>
            <Box style={{ background: '#fff', borderBottom: '1px solid #ddd', padding: '12px 20px' }}>
                <Group justify="space-between">
                    <Title order={3} style={{ color: '#e6921e', fontWeight: 900 }}>DATA INVENTORY</Title>
                    <Group gap="xs">
                        <Button size="xs" color={side ? 'blue' : 'gray'} variant={side ? 'filled' : 'outline'} onClick={() => setSide(true)} style={{ fontWeight: 700 }}>DRY</Button>
                        <Button size="xs" color={!side ? 'yellow' : 'gray'} variant={!side ? 'filled' : 'outline'} onClick={() => setSide(false)} style={{ fontWeight: 700 }}>WET</Button>
                    </Group>
                </Group>
            </Box>

            <Box p="md">
                <Group mb="xs" gap="xs">
                    <TextInput placeholder="Cari item..." size="xs" value={search} onChange={e => setSearch(e.target.value)} style={{ width: 200 }} />
                </Group>

                {loading ? <Loader /> : (
                    <Box style={{ overflowX: 'auto' }}>
                        <Table withTableBorder withColumnBorders style={{ fontSize: 10, minWidth: 800 }}>
                            <Table.Thead style={{ background: '#1a1a1a' }}>
                                <Table.Tr>
                                    <Table.Th style={{ color: '#fff', fontSize: 10, position: 'sticky', left: 0, background: '#1a1a1a', zIndex: 1 }}>Item</Table.Th>
                                    <Table.Th style={{ color: '#fff', fontSize: 10 }}>Satuan</Table.Th>
                                    <Table.Th style={{ color: '#fff', fontSize: 10 }}>Saldo</Table.Th>
                                    {allDates.map(dt => (
                                        <Table.Th key={dt} colSpan={3} style={{ color: '#fff', fontSize: 10, textAlign: 'center' }}>{dt}</Table.Th>
                                    ))}
                                </Table.Tr>
                                <Table.Tr>
                                    <Table.Th style={{ color: '#aaa', fontSize: 9, position: 'sticky', left: 0, background: '#222', zIndex: 1 }}></Table.Th>
                                    <Table.Th style={{ color: '#aaa', fontSize: 9 }}></Table.Th>
                                    <Table.Th style={{ color: '#aaa', fontSize: 9 }}>Awal</Table.Th>
                                    {allDates.map(dt => (
                                        <React.Fragment key={dt}>
                                            <Table.Th style={{ color: '#4dabf7', fontSize: 9, textAlign: 'center' }}>IN</Table.Th>
                                            <Table.Th style={{ color: '#f06595', fontSize: 9, textAlign: 'center' }}>OUT</Table.Th>
                                            <Table.Th style={{ color: '#40c057', fontSize: 9, textAlign: 'center' }}>BAL</Table.Th>
                                        </React.Fragment>
                                    ))}
                                </Table.Tr>
                            </Table.Thead>
                            <Table.Tbody>
                                {filtered.map(item => {
                                    let bal = item.saldoAwal || 0;
                                    return (
                                        <Table.Tr key={item.id}>
                                            <Table.Td fw={600} style={{ position: 'sticky', left: 0, background: '#fff', zIndex: 1 }}>{item.nama}</Table.Td>
                                            <Table.Td>{item.satuan}</Table.Td>
                                            <Table.Td ta="right">{item.saldoAwal}</Table.Td>
                                            {allDates.map(dt => {
                                                const d = item.daily?.[dt] || { in: 0, out: 0 };
                                                bal = bal + d.in - d.out;
                                                return (
                                                    <React.Fragment key={dt}>
                                                        <Table.Td ta="right" style={{ color: '#1c7ed6' }}>{d.in || '-'}</Table.Td>
                                                        <Table.Td ta="right" style={{ color: '#e64980' }}>{d.out || '-'}</Table.Td>
                                                        <Table.Td ta="right" fw={600}>{bal}</Table.Td>
                                                    </React.Fragment>
                                                );
                                            })}
                                        </Table.Tr>
                                    );
                                })}
                            </Table.Tbody>
                        </Table>
                    </Box>
                )}
            </Box>
        </Box>
    );
}
