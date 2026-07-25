'use client';
// @ts-nocheck
import React, { useState, useEffect } from 'react';
import { Box, Group, Button, Title, Text, Table, Badge, Paper, Stack, TextInput, Select, Grid, Loader, ActionIcon, Tooltip } from '@mantine/core';
import { IconPackage, IconPlus, IconEdit, IconTrash, IconX, IconRefresh } from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import { api, unwrap } from '../lib/api';

export default function MasterProdukPage() {
    const [tab, setTab] = useState('items');
    const [items, setItems] = useState<any[]>([]);
    const [search, setSearch] = useState('');
    const [loading, setLoading] = useState(true);
    const [editId, setEditId] = useState<number | null>(null);
    const [form, setForm] = useState({ sku: '', nama: '', satuan: 'Pcs', kategori: 'Dry', min_stok: 0 });

    useEffect(() => { load(); }, []);

    const load = async () => {
        setLoading(true);
        try {
            const res = await api().get('/barang');
            setItems(unwrap(res));
        } catch (e) { console.error(e); }
        setLoading(false);
    };

    const resetForm = () => {
        setEditId(null);
        setForm({ sku: '', nama: '', satuan: 'Pcs', kategori: 'Dry', min_stok: 0 });
    };

    const save = async () => {
        if (!form.nama) return notifications.show({ title: 'Error', message: 'Nama produk wajib diisi', color: 'red' });
        // Check duplicate
        const duplicate = items.find((i: any) => i.nama?.toLowerCase() === form.nama.toLowerCase() && i.id !== editId);
        if (duplicate) return notifications.show({ title: 'Error', message: `Produk "${form.nama}" sudah ada`, color: 'red' });
        try {
            if (editId) {
                await api().put(`/barang/${editId}`, form);
                notifications.show({ title: 'Sukses', message: 'Produk berhasil diupdate', color: 'green' });
            } else {
                await api().post('/barang', form);
                notifications.show({ title: 'Sukses', message: 'Produk berhasil ditambahkan', color: 'green' });
            }
            resetForm();
            load();
        } catch (e: any) {
            notifications.show({ title: 'Error', message: unwrap(e.response)?.message || 'Gagal menyimpan', color: 'red' });
        }
    };

    const syncAll = async () => {
        setLoading(true);
        try {
            await api().get('/inventory/sync-all');
            notifications.show({ title: 'Sukses', message: 'Seluruh stok disinkronkan ulang', color: 'green' });
            load();
        } catch (e) { console.error(e); }
        setLoading(false);
    };

    const del = async (id: number) => {
        if (!confirm('Hapus produk ini?')) return;
        try {
            await api().delete(`/barang/${id}`);
            notifications.show({ title: 'Sukses', message: 'Produk berhasil dihapus', color: 'orange' });
            if (editId === id) resetForm();
            load();
        } catch (e) { console.error(e); }
    };

    const openEdit = (item: any) => {
        setEditId(item.id);
        setForm({ sku: item.sku || '', nama: item.nama || '', satuan: item.satuan || 'Pcs', kategori: item.kategori || 'Dry', min_stok: item.min_stok || 0 });
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const f = (k: string, v: any) => setForm(p => ({ ...p, [k]: v }));
    const filtered = search ? items.filter((i: any) => i.nama?.toLowerCase().includes(search.toLowerCase()) || i.sku?.toLowerCase().includes(search.toLowerCase())) : items;

    // Count by kategori
    const katGroups: Record<string, number> = {};
    items.forEach((i: any) => { katGroups[i.kategori] = (katGroups[i.kategori] || 0) + 1; });

    return (
        <Box>
            <Box style={{ background: '#fff', borderLeft: '4px solid #e6921e', padding: '14px 20px', marginBottom: 16, boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}>
                <Group justify="space-between">
                    <Title order={4} style={{ color: '#111827', fontWeight: 800, display: "flex", alignItems: "center", gap: 8 }}>
                        <IconPackage size={20} style={{ color: '#e6921e' }} />
                        MASTER PRODUK
                    </Title>
                    <Group gap="xs">
                        <Button size="xs" variant={tab === 'items' ? 'filled' : 'outline'} color="orange" onClick={() => setTab('items')}>Items</Button>
                        <Button size="xs" variant={tab === 'kategori' ? 'filled' : 'outline'} color="orange" onClick={() => setTab('kategori')}>Kategori</Button>
                    </Group>
                </Group>
            </Box>

            <Box p="md">
                <Grid gutter="md">
                    {/* Left Panel: Form Input Side Panel */}
                    <Grid.Col span={{ base: 12, md: 4, lg: 3 }}>
                        <Paper withBorder p="md" radius="md" style={{ background: '#fff' }}>
                            <Stack gap="xs">
                                <Group justify="space-between">
                                    <Text fw={800} size="sm" c="orange" style={{ borderBottom: "1px solid #f1f5f9", paddingBottom: 4, flex: 1 }}>
                                        {editId ? 'EDIT PRODUK' : 'TAMBAH PRODUK'}
                                    </Text>
                                    {editId && (
                                        <ActionIcon size="xs" variant="subtle" color="gray" onClick={resetForm}>
                                            <IconX size={14} />
                                        </ActionIcon>
                                    )}
                                </Group>

                                <TextInput label="SKU" size="xs" value={form.sku} onChange={e => f('sku', e.target.value)} placeholder="Auto jika kosong" />
                                <TextInput label="Nama Produk" size="xs" value={form.nama} onChange={e => f('nama', e.target.value)} placeholder="Masukkan nama produk" required />
                                <TextInput label="Satuan" size="xs" value={form.satuan} onChange={e => f('satuan', e.target.value)} placeholder="Pcs, Kg, Box, Ltr..." />
                                <Select label="Kategori" size="xs" data={['Dry', 'Wet', 'Waste', 'Ayam']} value={form.kategori} onChange={v => f('kategori', v || 'Dry')} />
                                <TextInput label="Min Stok" size="xs" type="number" value={form.min_stok} onChange={e => f('min_stok', +e.target.value)} />

                                <Group gap="xs" mt="xs">
                                    <Button fullWidth size="xs" color="orange" onClick={save} style={{ fontWeight: 700, flex: 1 }} leftSection={editId ? <IconEdit size={14} /> : <IconPlus size={14} />}>
                                        {editId ? 'Update Produk' : 'Simpan Produk'}
                                    </Button>
                                    {editId && (
                                        <Button size="xs" color="gray" variant="outline" onClick={resetForm}>Batal</Button>
                                    )}
                                </Group>
                            </Stack>
                        </Paper>
                    </Grid.Col>

                    {/* Right Panel: Tables */}
                    <Grid.Col span={{ base: 12, md: 8, lg: 9 }}>
                        {tab === 'kategori' ? (
                            <Paper withBorder p="md" radius="md" style={{ background: '#fff' }}>
                                <Text fw={800} size="sm" c="orange" mb="sm">RINGKASAN KATEGORI PRODUK</Text>
                                <Box style={{ overflowX: "auto" }}>
                                    <Table withTableBorder withColumnBorders style={{ fontSize: 11 }}>
                                        <Table.Thead style={{ background: "#fff4e6", borderBottom: "2px solid #ffd8a8" }}>
                                            <Table.Tr>
                                                <Table.Th style={{ color: "#d9480f" }}>Kategori</Table.Th>
                                                <Table.Th style={{ color: "#d9480f", textAlign: "right" }}>Jumlah Item</Table.Th>
                                            </Table.Tr>
                                        </Table.Thead>
                                        <Table.Tbody>
                                            {Object.entries(katGroups).map(([k, v]) => (
                                                <Table.Tr key={k}>
                                                    <Table.Td fw={600}>{k}</Table.Td>
                                                    <Table.Td ta="right" fw={700}>{v}</Table.Td>
                                                </Table.Tr>
                                            ))}
                                        </Table.Tbody>
                                    </Table>
                                </Box>
                            </Paper>
                        ) : (
                            <Paper withBorder p="md" radius="md" style={{ background: '#fff' }}>
                                <Group justify="space-between" mb="sm">
                                    <TextInput placeholder="Cari SKU / nama produk..." size="xs" value={search} onChange={e => setSearch(e.target.value)} style={{ width: 220 }} />
                                    <Button size="xs" variant="outline" color="blue" leftSection={<IconRefresh size={14} />} onClick={syncAll}>Sync Stock</Button>
                                </Group>

                                {loading ? <Loader /> : (
                                    <Box style={{ overflowX: "auto" }}>
                                        <Table withTableBorder withColumnBorders style={{ fontSize: 11 }}>
                                            <Table.Thead style={{ background: "#fff4e6", borderBottom: "2px solid #ffd8a8" }}>
                                                <Table.Tr>
                                                    {['SKU', 'Nama', 'Kategori', 'Satuan', 'Stok', 'Min Stok', 'Aksi'].map((h: any) => (
                                                        <Table.Th key={h} style={{ color: '#d9480f', fontSize: 11 }}>{h}</Table.Th>
                                                    ))}
                                                </Table.Tr>
                                            </Table.Thead>
                                            <Table.Tbody>
                                                {filtered.map((item: any) => (
                                                    <Table.Tr key={item.id}>
                                                        <Table.Td>{item.sku || '-'}</Table.Td>
                                                        <Table.Td fw={600}>{item.nama}</Table.Td>
                                                        <Table.Td><Badge size="xs" color={item.kategori === 'Dry' ? 'blue' : item.kategori === 'Wet' ? 'yellow' : 'red'}>{item.kategori}</Badge></Table.Td>
                                                        <Table.Td>{item.satuan}</Table.Td>
                                                        <Table.Td ta="right" fw={700} style={{ color: item.stok <= (item.min_stok || 0) ? '#e03131' : '#111827' }}>{item.stok}</Table.Td>
                                                        <Table.Td ta="right">{item.min_stok || 0}</Table.Td>
                                                        <Table.Td>
                                                            <Group gap={4} wrap="nowrap">
                                                                <Tooltip label="Edit">
                                                                    <ActionIcon size="sm" color="blue" variant="light" onClick={() => openEdit(item)}>
                                                                        <IconEdit size={13} />
                                                                    </ActionIcon>
                                                                </Tooltip>
                                                                <Tooltip label="Hapus">
                                                                    <ActionIcon size="sm" color="red" variant="light" onClick={() => del(item.id)}>
                                                                        <IconTrash size={13} />
                                                                    </ActionIcon>
                                                                </Tooltip>
                                                            </Group>
                                                        </Table.Td>
                                                    </Table.Tr>
                                                ))}
                                                {filtered.length === 0 && (
                                                    <Table.Tr>
                                                        <Table.Td colSpan={7} ta="center" c="dimmed">Tidak ada data produk ditemukan.</Table.Td>
                                                    </Table.Tr>
                                                )}
                                            </Table.Tbody>
                                        </Table>
                                    </Box>
                                )}
                            </Paper>
                        )}
                    </Grid.Col>
                </Grid>
            </Box>
        </Box>
    );
}
