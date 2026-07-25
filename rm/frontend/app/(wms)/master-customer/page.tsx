'use client';
// @ts-nocheck
import React, { useState, useEffect } from 'react';
import { Box, Group, Button, Title, Text, Table, Paper, Stack, TextInput, Grid, Loader, ActionIcon, Tooltip, Badge } from '@mantine/core';
import { IconBuildingStore, IconPlus, IconEdit, IconTrash, IconX } from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import { api, unwrap } from '../lib/api';

export default function MasterCustomerPage() {
    const [list, setList] = useState<any[]>([]);
    const [search, setSearch] = useState('');
    const [loading, setLoading] = useState(true);
    const [editId, setEditId] = useState<number | null>(null);
    const [form, setForm] = useState({ nama: '', alamat: '', telp: '' });

    useEffect(() => { load(); }, []);

    const load = async () => {
        setLoading(true);
        try { setList(unwrap(await api().get('/customers'))); } catch (e) { console.error(e); }
        setLoading(false);
    };

    const resetForm = () => {
        setEditId(null);
        setForm({ nama: '', alamat: '', telp: '' });
    };

    const save = async () => {
        if (!form.nama) return notifications.show({ title: 'Error', message: 'Nama supplier/customer wajib diisi', color: 'red' });
        // Check duplicate
        const duplicate = list.find((c: any) => c.nama?.toLowerCase() === form.nama.toLowerCase() && c.id !== editId);
        if (duplicate) return notifications.show({ title: 'Error', message: `Customer "${form.nama}" sudah ada`, color: 'red' });
        try {
            if (editId) {
                await api().put(`/customers/${editId}`, form);
                notifications.show({ title: 'Sukses', message: 'Customer berhasil diupdate', color: 'green' });
            } else {
                await api().post('/customers', form);
                notifications.show({ title: 'Sukses', message: 'Customer berhasil ditambahkan', color: 'green' });
            }
            resetForm();
            load();
        } catch (e: any) {
            notifications.show({ title: 'Error', message: unwrap(e.response)?.message || 'Gagal menyimpan', color: 'red' });
        }
    };

    const del = async (id: any) => {
        if (!confirm('Hapus customer/supplier ini?')) return;
        try {
            await api().delete(`/customers/${id}`);
            notifications.show({ title: 'Sukses', message: 'Customer dihapus', color: 'teal' });
            if (editId === id) resetForm();
            load();
        } catch (e) { console.error(e); }
    };

    const filtered = search ? list.filter((l: any) => l.nama?.toLowerCase().includes(search.toLowerCase()) || l.alamat?.toLowerCase().includes(search.toLowerCase())) : list;
    const f = (k: any, v: any) => setForm(p => ({ ...p, [k]: v }));

    const handleEdit = (item: any) => {
        setEditId(item.id);
        setForm({
            nama: item.nama || '',
            alamat: item.alamat || '',
            telp: item.telp || ''
        });
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    return (
        <Box>
            <Box style={{ background: '#fff', borderLeft: '4px solid #12b886', padding: '14px 20px', marginBottom: 16, boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}>
                <Title order={4} style={{ color: '#111827', fontWeight: 800, display: "flex", alignItems: "center", gap: 8 }}>
                    <IconBuildingStore size={20} style={{ color: '#12b886' }} />
                    MASTER CUSTOMER / SUPPLIER
                </Title>
            </Box>

            <Box p="md">
                <Grid gutter="md">
                    {/* Left Form Panel */}
                    <Grid.Col span={{ base: 12, md: 4, lg: 3 }}>
                        <Paper withBorder p="md" radius="md" style={{ background: '#fff' }}>
                            <Stack gap="xs">
                                <Group justify="space-between">
                                    <Text fw={800} size="sm" c="teal" style={{ borderBottom: "1px solid #f1f5f9", paddingBottom: 4, flex: 1 }}>
                                        {editId ? 'EDIT CUSTOMER/SUPPLIER' : 'TAMBAH CUSTOMER/SUPPLIER'}
                                    </Text>
                                    {editId && (
                                        <ActionIcon size="xs" variant="subtle" color="gray" onClick={resetForm}>
                                            <IconX size={14} />
                                        </ActionIcon>
                                    )}
                                </Group>

                                <TextInput label="Nama Supplier / Customer" size="xs" value={form.nama} onChange={e => f('nama', e.target.value)} placeholder="PT / CV / Perorangan" required />
                                <TextInput label="Alamat" size="xs" value={form.alamat} onChange={e => f('alamat', e.target.value)} placeholder="Alamat lengkap..." />
                                <TextInput label="No. Telepon" size="xs" value={form.telp} onChange={e => f('telp', e.target.value)} placeholder="08xxxxxxxx" />

                                <Group gap="xs" mt="xs">
                                    <Button fullWidth size="xs" color="teal" onClick={save} style={{ fontWeight: 700, flex: 1 }} leftSection={editId ? <IconEdit size={14} /> : <IconPlus size={14} />}>
                                        {editId ? 'Update Customer' : 'Simpan Customer'}
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
                                <TextInput placeholder="Cari nama, alamat..." size="xs" value={search} onChange={e => setSearch(e.target.value)} style={{ width: 220 }} />
                                <Badge color="teal" variant="light">{filtered.length} total customer</Badge>
                            </Group>

                            {loading ? <Loader /> : (
                                <Box style={{ overflowX: "auto" }}>
                                    <Table withTableBorder withColumnBorders style={{ fontSize: 11 }}>
                                        <Table.Thead style={{ background: "#f0fdfa", borderBottom: "2px solid #99f6e4" }}>
                                            <Table.Tr>
                                                {['Nama Supplier / Customer', 'Alamat', 'No. Telepon', 'Aksi'].map((h: any) => (
                                                    <Table.Th key={h} style={{ color: '#0f766e', fontSize: 11 }}>{h}</Table.Th>
                                                ))}
                                            </Table.Tr>
                                        </Table.Thead>
                                        <Table.Tbody>
                                            {filtered.map((c: any) => (
                                                <Table.Tr key={c.id}>
                                                    <Table.Td fw={700}>{c.nama}</Table.Td>
                                                    <Table.Td>{c.alamat || '-'}</Table.Td>
                                                    <Table.Td>{c.telp || '-'}</Table.Td>
                                                    <Table.Td>
                                                        <Group gap={4} wrap="nowrap">
                                                            <Tooltip label="Edit">
                                                                <ActionIcon size="sm" color="blue" variant="light" onClick={() => handleEdit(c)}>
                                                                    <IconEdit size={13} />
                                                                </ActionIcon>
                                                            </Tooltip>
                                                            <Tooltip label="Hapus">
                                                                <ActionIcon size="sm" color="red" variant="light" onClick={() => del(c.id)}>
                                                                    <IconTrash size={13} />
                                                                </ActionIcon>
                                                            </Tooltip>
                                                        </Group>
                                                    </Table.Td>
                                                </Table.Tr>
                                            ))}
                                            {filtered.length === 0 && (
                                                <Table.Tr>
                                                    <Table.Td colSpan={4} ta="center" c="dimmed">Tidak ada data customer/supplier ditemukan.</Table.Td>
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
