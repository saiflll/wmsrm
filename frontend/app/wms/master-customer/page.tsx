'use client';
// @ts-nocheck
import React, { useState, useEffect } from 'react';
import { Box, Group, Button, Title, Text, Table, Paper, Stack, TextInput, Loader } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { api, unwrap } from '../lib/api';

export default function MasterCustomerPage() {
    const [list, setList] = useState([]);
    const [search, setSearch] = useState('');
    const [loading, setLoading] = useState(true);
    const [form, setForm] = useState({ nama: '', alamat: '', telp: '' });

    useEffect(() => { load(); }, []);

    const load = async () => {
        setLoading(true);
        try { setList(unwrap(await api().get('/customers'))); } catch (e) { console.error(e); }
        setLoading(false);
    };

    const save = async () => {
        if (!form.nama) return notifications.show({ title: 'Error', message: 'Nama wajib', color: 'red' });
        try {
            await api().post('/customers', form);
            notifications.show({ title: 'Sukses', message: 'Customer disimpan', color: 'green' });
            setForm({ nama: '', alamat: '', telp: '' });
            load();
        } catch (e: any) {
            notifications.show({ title: 'Error', message: unwrap(e.response)?.message || 'Failed', color: 'red' });
        }
    };

    const del = async (id) => {
        if (!confirm('Hapus?')) return;
        try { await api().delete(`/customers/${id}`); load(); } catch (e) { console.error(e); }
    };

    const filtered = search ? list.filter(l => l.nama?.toLowerCase().includes(search.toLowerCase())) : list;
    const f = (k, v) => setForm(p => ({ ...p, [k]: v }));

    return (
        <Box>
            <Box style={{ background: '#fff', borderBottom: '1px solid #ddd', padding: '12px 20px' }}>
                <Title order={3} style={{ color: '#e6921e', fontWeight: 900 }}>STORAGE TUJUAN</Title>
            </Box>
            <Box p="md">
                <Group align="flex-start" gap="md">
                    <Paper withBorder p="md" style={{ width: 220, flexShrink: 0 }}>
                        <Stack gap="xs">
                            <TextInput label="Nama Supplier/Customer" size="xs" value={form.nama} onChange={e => f('nama', e.target.value)} />
                            <TextInput label="Alamat" size="xs" value={form.alamat} onChange={e => f('alamat', e.target.value)} />
                            <TextInput label="No. Telp" size="xs" value={form.telp} onChange={e => f('telp', e.target.value)} />
                            <Button fullWidth size="xs" color="dark" mt="xs" onClick={save}>Submit</Button>
                        </Stack>
                    </Paper>
                    <Box style={{ flex: 1 }}>
                        <Group mb="xs" gap="xs">
                            <TextInput placeholder="Cari..." size="xs" value={search} onChange={e => setSearch(e.target.value)} style={{ width: 220 }} />
                        </Group>
                        {loading ? <Loader /> : (
                            <Table withTableBorder withColumnBorders style={{ fontSize: 11 }}>
                                <Table.Thead style={{ background: '#1a1a1a' }}>
                                    <Table.Tr>
                                        {['Nama', 'Alamat', 'Telp', 'Aksi'].map(h => (
                                            <Table.Th key={h} style={{ color: '#fff', fontSize: 11 }}>{h}</Table.Th>
                                        ))}
                                    </Table.Tr>
                                </Table.Thead>
                                <Table.Tbody>
                                    {filtered.map(c => (
                                        <Table.Tr key={c.id}>
                                            <Table.Td fw={600}>{c.nama}</Table.Td>
                                            <Table.Td>{c.alamat || '-'}</Table.Td>
                                            <Table.Td>{c.telp || '-'}</Table.Td>
                                            <Table.Td>
                                                <Button size="xs" color="red" variant="filled" style={{ padding: '0 6px' }} onClick={() => del(c.id)}>✕</Button>
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
