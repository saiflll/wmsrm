'use client';
// @ts-nocheck
import React, { useState, useEffect } from 'react';
import { Box, Group, Button, Title, Text, Table, Badge, Paper, Stack, TextInput, Select, Grid, Loader, ActionIcon, Tooltip } from '@mantine/core';
import { IconMap2, IconPlus, IconEdit, IconTrash, IconX } from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import { api, unwrap } from '../lib/api';

export default function MasterLokasiPage() {
    const [locs, setLocs] = useState<any[]>([]);
    const [search, setSearch] = useState('');
    const [loading, setLoading] = useState(true);
    const [editId, setEditId] = useState<number | null>(null);
    const [form, setForm] = useState({ name: '', zone: 'DRY A', level: 1, kolom: '', type: 'Single Deep', capacity: 1000 });

    useEffect(() => { load(); }, []);

    const load = async () => {
        setLoading(true);
        try {
            const gudangData = unwrap(await api().get('/gudang'));
            setLocs(Array.isArray(gudangData) ? gudangData : gudangData?.data || []);
        } catch (e) { console.error(e); }
        setLoading(false);
    };

    const resetForm = () => {
        setEditId(null);
        setForm({ name: '', zone: 'DRY A', level: 1, kolom: '', type: 'Single Deep', capacity: 1000 });
    };

    const save = async () => {
        if (!form.name) return notifications.show({ title: 'Error', message: 'Nama lokasi rak wajib diisi', color: 'red' });
        // Check duplicate
        const duplicate = locs.find((l: any) => l.name?.toLowerCase() === form.name.toLowerCase() && l.id !== editId);
        if (duplicate) return notifications.show({ title: 'Error', message: `Lokasi "${form.name}" sudah ada`, color: 'red' });
        try {
            const side = ['DRY A', 'DRY B', 'DRY FG'].includes(form.zone);
            if (editId) {
                await api().put(`/gudang/${editId}`, { ...form, side, status: true });
                notifications.show({ title: 'Sukses', message: 'Lokasi berhasil diupdate', color: 'green' });
            } else {
                await api().post('/gudang', { ...form, side, status: true });
                notifications.show({ title: 'Sukses', message: 'Lokasi berhasil ditambahkan', color: 'green' });
            }
            resetForm();
            load();
        } catch (e: any) {
            notifications.show({ title: 'Error', message: unwrap(e.response)?.message || 'Gagal menyimpan', color: 'red' });
        }
    };

    const del = async (id: any) => {
        if (!confirm('Hapus lokasi ini?')) return;
        try {
            await api().delete(`/gudang/${id}`);
            notifications.show({ title: 'Sukses', message: 'Lokasi dihapus', color: 'orange' });
            if (editId === id) resetForm();
            load();
        } catch (e) { console.error(e); }
    };

    const f = (k: any, v: any) => setForm(p => ({ ...p, [k]: v }));
    const filtered = search ? locs.filter((l: any) => l.name?.toLowerCase().includes(search.toLowerCase()) || l.zone?.toLowerCase().includes(search.toLowerCase())) : locs;

    const handleEdit = (item: any) => {
        setEditId(item.id);
        setForm({
            name: item.name || '',
            zone: item.zone || 'DRY A',
            level: item.level || 1,
            kolom: item.kolom || '',
            type: item.type || 'Single Deep',
            capacity: item.capacity || 1000
        });
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    return (
        <Box>
            <Box style={{ background: '#fff', borderLeft: '4px solid #228be6', padding: '14px 20px', marginBottom: 16, boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}>
                <Title order={4} style={{ color: '#111827', fontWeight: 800, display: "flex", alignItems: "center", gap: 8 }}>
                    <IconMap2 size={20} style={{ color: '#228be6' }} />
                    MASTER LOKASI RAK
                </Title>
            </Box>

            <Box p="md">
                <Grid gutter="md">
                    {/* Left Form Panel */}
                    <Grid.Col span={{ base: 12, md: 4, lg: 3 }}>
                        <Paper withBorder p="md" radius="md" style={{ background: '#fff' }}>
                            <Stack gap="xs">
                                <Group justify="space-between">
                                    <Text fw={800} size="sm" c="blue" style={{ borderBottom: "1px solid #f1f5f9", paddingBottom: 4, flex: 1 }}>
                                        {editId ? 'EDIT LOKASI RAK' : 'TAMBAH LOKASI RAK'}
                                    </Text>
                                    {editId && (
                                        <ActionIcon size="xs" variant="subtle" color="gray" onClick={resetForm}>
                                            <IconX size={14} />
                                        </ActionIcon>
                                    )}
                                </Group>

                                <TextInput label="Nama Rak" size="xs" value={form.name} onChange={e => f('name', e.target.value)} placeholder="A13.1" required />
                                <Select label="Zone" size="xs" data={['CS FROZEN', 'CHILL', 'DRY A', 'DRY B', 'DRY FG', 'WASTE']} value={form.zone} onChange={v => f('zone', v || 'DRY A')} />
                                <TextInput label="Kolom" size="xs" value={form.kolom} onChange={e => f('kolom', e.target.value)} placeholder="A, B, C..." />
                                <TextInput label="Level" size="xs" type="number" value={form.level} onChange={e => f('level', +e.target.value)} />
                                <Select label="Type" size="xs" data={['Single Deep', 'Double Deep']} value={form.type} onChange={v => f('type', v || 'Single Deep')} />
                                <TextInput label="Kapasitas" size="xs" type="number" value={form.capacity} onChange={e => f('capacity', +e.target.value)} />
                                <Group gap="xs" mt="xs">
                                    <Button fullWidth size="xs" color="blue" onClick={save} style={{ fontWeight: 700, flex: 1 }} leftSection={editId ? <IconEdit size={14} /> : <IconPlus size={14} />}>
                                        {editId ? 'Update Lokasi' : 'Simpan Lokasi'}
                                    </Button>
                                    {editId && (
                                        <Button size="xs" color="gray" variant="outline" onClick={resetForm}>Batal</Button>
                                    )}
                                </Group>
                            </Stack>
                        </Paper>
                    </Grid.Col>

                    {/* Right Table Panel */}
                    <Grid.Col span={{ base: 12, md: 8, lg: 9 }}>
                        <Paper withBorder p="md" radius="md" style={{ background: '#fff' }}>
                            <Group justify="space-between" mb="sm">
                                <TextInput placeholder="Cari nama rak, zone..." size="xs" value={search} onChange={e => setSearch(e.target.value)} style={{ width: 220 }} />
                                <Badge color="blue" variant="light">{filtered.length} total lokasi</Badge>
                            </Group>

                            {loading ? <Loader /> : (
                                <Box style={{ overflowX: "auto" }}>
                                    <Table withTableBorder withColumnBorders style={{ fontSize: 11 }}>
                                        <Table.Thead style={{ background: "#f0f7ff", borderBottom: "2px solid #a5d8ff" }}>
                                            <Table.Tr>
                                                {['Nama Rak', 'Zone', 'Kolom', 'Level', 'Type', 'Kapasitas', 'Status', 'Aksi'].map((h: any) => (
                                                    <Table.Th key={h} style={{ color: '#1864ab', fontSize: 11 }}>{h}</Table.Th>
                                                ))}
                                            </Table.Tr>
                                        </Table.Thead>
                                        <Table.Tbody>
                                            {filtered.slice(0, 100).map((l: any) => (
                                                <Table.Tr key={l.id}>
                                                    <Table.Td fw={700}>{l.name}</Table.Td>
                                                    <Table.Td><Badge size="xs" color={l.side ? 'blue' : 'yellow'}>{l.zone || (l.side ? 'DRY' : 'WET')}</Badge></Table.Td>
                                                    <Table.Td>{l.kolom || '-'}</Table.Td>
                                                    <Table.Td>{l.level}</Table.Td>
                                                    <Table.Td>{l.type || '-'}</Table.Td>
                                                    <Table.Td ta="right">{l.capacity || '-'}</Table.Td>
                                                    <Table.Td><Badge size="xs" color={l.status ? 'green' : 'red'}>{l.status ? 'Available' : 'Occupied'}</Badge></Table.Td>
                                                    <Table.Td>
                                                        <Group gap={4} wrap="nowrap">
                                                            <Tooltip label="Edit">
                                                                <ActionIcon size="sm" color="blue" variant="light" onClick={() => handleEdit(l)}>
                                                                    <IconEdit size={13} />
                                                                </ActionIcon>
                                                            </Tooltip>
                                                            <Tooltip label="Hapus">
                                                                <ActionIcon size="sm" color="red" variant="light" onClick={() => del(l.id)}>
                                                                    <IconTrash size={13} />
                                                                </ActionIcon>
                                                            </Tooltip>
                                                        </Group>
                                                    </Table.Td>
                                                </Table.Tr>
                                            ))}
                                            {filtered.length === 0 && (
                                                <Table.Tr>
                                                    <Table.Td colSpan={8} ta="center" c="dimmed">Tidak ada data lokasi ditemukan.</Table.Td>
                                                </Table.Tr>
                                            )}
                                        </Table.Tbody>
                                    </Table>
                                </Box>
                            )}
                        </Paper>
                    </Grid.Col>
                </Grid>
            </Box>
        </Box>
    );
}
