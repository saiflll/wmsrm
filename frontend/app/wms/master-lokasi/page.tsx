'use client';
// @ts-nocheck
import React, { useState, useEffect } from 'react';
import { Box, Group, Button, Title, Text, Table, Badge, Paper, Stack, TextInput, Select, Loader } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { api, unwrap } from '../lib/api';

export default function MasterLokasiPage() {
    const [locs, setLocs] = useState([]);
    const [search, setSearch] = useState('');
    const [loading, setLoading] = useState(true);
    const [form, setForm] = useState({ name: '', zone: 'DRY A', level: 1, kolom: '', type: 'Single Deep' });

    useEffect(() => { load(); }, []);

    const load = async () => {
        setLoading(true);
        try { setLocs(unwrap(await api().get('/gudang'))); } catch (e) { console.error(e); }
        setLoading(false);
    };

    const save = async () => {
        if (!form.name) return notifications.show({ title: 'Error', message: 'Nama lokasi wajib', color: 'red' });
        try {
            const side = ['DRY A', 'DRY B', 'DRY FG'].includes(form.zone);
            await api().post('/gudang', { ...form, side, status: true });
            notifications.show({ title: 'Sukses', message: 'Lokasi ditambah', color: 'green' });
            setForm({ name: '', zone: 'DRY A', level: 1, kolom: '', type: 'Single Deep' });
            load();
        } catch (e: any) {
            notifications.show({ title: 'Error', message: unwrap(e.response)?.message || 'Failed', color: 'red' });
        }
    };

    const del = async (id) => {
        if (!confirm('Hapus lokasi?')) return;
        try { await api().delete(`/gudang/${id}`); load(); } catch (e) { console.error(e); }
    };

    const f = (k, v) => setForm(p => ({ ...p, [k]: v }));
    const filtered = search ? locs.filter(l => l.name?.toLowerCase().includes(search.toLowerCase())) : locs;

    return (
        <Box>
            <Box style={{ background: '#fff', borderBottom: '1px solid #ddd', padding: '12px 20px' }}>
                <Title order={3} style={{ color: '#e6921e', fontWeight: 900 }}>MASTER LOKASI</Title>
            </Box>

            <Box p="md">
                <Group align="flex-start" gap="md">
                    <Paper withBorder p="md" style={{ width: 220, flexShrink: 0 }}>
                        <Stack gap="xs">
                            <TextInput label="Nama Rak" size="xs" value={form.name} onChange={e => f('name', e.target.value)} placeholder="A13.1" />
                            <Select label="Zone" size="xs" data={['CS FROZEN', 'CHILL', 'DRY A', 'DRY B', 'DRY FG', 'WASTE']} value={form.zone} onChange={v => f('zone', v)} />
                            <TextInput label="Kolom" size="xs" value={form.kolom} onChange={e => f('kolom', e.target.value)} placeholder="A, B, C..." />
                            <TextInput label="Level" size="xs" type="number" value={form.level} onChange={e => f('level', +e.target.value)} />
                            <Select label="Type" size="xs" data={['Single Deep', 'Double Deep']} value={form.type} onChange={v => f('type', v)} />
                            <Button fullWidth size="xs" color="dark" onClick={save}>Submit</Button>
                        </Stack>
                    </Paper>

                    <Box style={{ flex: 1 }}>
                        <Group mb="xs" gap="xs">
                            <TextInput placeholder="Cari lokasi..." size="xs" value={search} onChange={e => setSearch(e.target.value)} style={{ width: 200 }} />
                            <Badge color="blue" variant="light">{filtered.length} lokasi</Badge>
                        </Group>
                        {loading ? <Loader /> : (
                            <Table withTableBorder withColumnBorders style={{ fontSize: 11 }}>
                                <Table.Thead style={{ background: '#1a1a1a' }}>
                                    <Table.Tr>
                                        {['Nama Rak', 'Zone', 'Kolom', 'Level', 'Type', 'Status', 'Aksi'].map(h => (
                                            <Table.Th key={h} style={{ color: '#fff', fontSize: 11 }}>{h}</Table.Th>
                                        ))}
                                    </Table.Tr>
                                </Table.Thead>
                                <Table.Tbody>
                                    {filtered.slice(0, 50).map(l => (
                                        <Table.Tr key={l.id}>
                                            <Table.Td fw={600}>{l.name}</Table.Td>
                                            <Table.Td><Badge size="xs" color={l.side ? 'blue' : 'yellow'}>{l.zone || (l.side ? 'DRY' : 'WET')}</Badge></Table.Td>
                                            <Table.Td>{l.kolom || '-'}</Table.Td>
                                            <Table.Td>{l.level}</Table.Td>
                                            <Table.Td>{l.type || '-'}</Table.Td>
                                            <Table.Td><Badge size="xs" color={l.status ? 'green' : 'red'}>{l.status ? 'Available' : 'Occupied'}</Badge></Table.Td>
                                            <Table.Td>
                                                <Button size="xs" color="red" variant="filled" style={{ padding: '0 6px' }} onClick={() => del(l.id)}>✕</Button>
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
