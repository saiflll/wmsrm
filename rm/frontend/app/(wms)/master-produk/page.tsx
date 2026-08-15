'use client';
// @ts-nocheck
import React, { useState, useEffect } from 'react';
import { Box, Group, Button, Title, Text, Table, Badge, Paper, Stack, TextInput, Select, Grid, Loader, ActionIcon, Tooltip, Checkbox, Modal, Radio, Pagination } from '@mantine/core';
import { IconPackage, IconPlus, IconEdit, IconTrash, IconX, IconRefresh, IconAlertTriangle } from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import { api, unwrap } from '../lib/api';

export default function MasterProdukPage() {
    const [tab, setTab] = useState('items');
    const [items, setItems] = useState<any[]>([]);
    const [search, setSearch] = useState('');
    const [page, setPage] = useState(1);
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(true);
    const [editId, setEditId] = useState<number | null>(null);
    const [form, setForm] = useState({ sku: '', nama: '', satuan: 'Pcs', kategori: 'Dry', min_stok: 0 });
    const [selectedIds, setSelectedIds] = useState<number[]>([]);
    const [deleting, setDeleting] = useState(false);
    const [userRole, setUserRole] = useState<number | null>(null);

    // Modern Modal Delete State
    const [confirmOpen, setConfirmOpen] = useState(false);
    const [deleteTarget, setDeleteTarget] = useState<'single' | 'mass'>('single');
    const [targetSingleId, setTargetSingleId] = useState<number | null>(null);
    const [deleteMode, setDeleteMode] = useState<'soft' | 'cascade'>('soft');

    useEffect(() => {
        try {
            const u = JSON.parse(localStorage.getItem('user') || '{}');
            if (u && u.role) setUserRole(u.role);
        } catch (e) { }
    }, []);

    useEffect(() => {
        const timer = window.setTimeout(load, 300);
        return () => window.clearTimeout(timer);
    }, [page, search]);

    const load = async () => {
        setLoading(true);
        try {
            const payload = unwrap(await api().get('/barang/paged', { params: { page, limit: 20, search: search.trim() } }));
            setItems(payload.data || []);
            setTotal(payload.total || 0);
            setSelectedIds([]);
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

    const openDeleteSingle = (id: number) => {
        setTargetSingleId(id);
        setDeleteTarget('single');
        setDeleteMode('soft');
        setConfirmOpen(true);
    };

    const openDeleteMass = () => {
        if (selectedIds.length === 0) return;
        setDeleteTarget('mass');
        setDeleteMode('soft');
        setConfirmOpen(true);
    };

    const executeDelete = async () => {
        setDeleting(true);
        const isCascade = userRole === 5 && deleteMode === 'cascade';

        if (deleteTarget === 'single' && targetSingleId) {
            try {
                await api().delete(`/barang/${targetSingleId}${isCascade ? '?cascade=true' : ''}`);
                notifications.show({ title: 'Sukses', message: isCascade ? 'Produk beserta riwayat berhasil dihapus total' : 'Produk berhasil dihapus', color: 'orange' });
                if (editId === targetSingleId) resetForm();
                load();
            } catch (e) { console.error(e); }
        } else if (deleteTarget === 'mass') {
            let successCount = 0;
            let failCount = 0;
            for (const id of selectedIds) {
                try {
                    await api().delete(`/barang/${id}${isCascade ? '?cascade=true' : ''}`);
                    successCount++;
                } catch (e: any) {
                    failCount++;
                    console.error(`Gagal menghapus produk ID ${id}:`, e);
                }
            }

            if (successCount > 0) {
                notifications.show({
                    title: 'Informasi Hapus',
                    message: `${successCount} produk berhasil dihapus${failCount > 0 ? `, ${failCount} produk gagal.` : '.'}`,
                    color: failCount > 0 ? 'yellow' : 'green',
                });
            } else if (failCount > 0) {
                notifications.show({
                    title: 'Gagal Hapus',
                    message: 'Produk terpilih gagal dihapus.',
                    color: 'red',
                });
            }

            if (editId && selectedIds.includes(editId)) resetForm();
            setSelectedIds([]);
            load();
        }
        setDeleting(false);
        setConfirmOpen(false);
    };

    const openEdit = (item: any) => {
        setEditId(item.id);
        setForm({ sku: item.sku || '', nama: item.nama || '', satuan: item.satuan || 'Pcs', kategori: item.kategori || 'Dry', min_stok: item.min_stok || 0 });
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const f = (k: string, v: any) => setForm(p => ({ ...p, [k]: v }));
    const filtered = items;
    const pageSize = 20;
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const paginatedItems = filtered;

    useEffect(() => { setPage(1); }, [search]);
    useEffect(() => { if (page > totalPages) setPage(totalPages); }, [page, totalPages]);

    const handleSelectAll = (checked: boolean) => {
        if (checked) {
            setSelectedIds(paginatedItems.map((i: any) => i.id));
        } else {
            setSelectedIds([]);
        }
    };

    const handleSelectRow = (id: number, checked: boolean) => {
        if (checked) {
            setSelectedIds(prev => [...prev, id]);
        } else {
            setSelectedIds(prev => prev.filter(i => i !== id));
        }
    };

    const allChecked = paginatedItems.length > 0 && paginatedItems.every((i: any) => selectedIds.includes(i.id));
    const isIndeterminate = paginatedItems.some((i: any) => selectedIds.includes(i.id)) && !allChecked;

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
                                                    {['SKU', 'Nama', 'Kategori', 'Satuan', 'Stok', 'Min Stok'].map((h: any) => (
                                                        <Table.Th key={h} style={{ color: '#d9480f', fontSize: 11 }}>{h}</Table.Th>
                                                    ))}
                                                    <Table.Th style={{ color: '#d9480f', fontSize: 11, textAlign: 'center' }}>
                                                        <Group gap={6} justify="center" wrap="nowrap">
                                                            <span>Aksi</span>
                                                            <Tooltip label={selectedIds.length > 0 ? `Hapus ${selectedIds.length} Terpilih` : 'Hapus Terpilih'}>
                                                                <ActionIcon
                                                                    size="xs"
                                                                    color="red"
                                                                    variant={selectedIds.length > 0 ? "filled" : "light"}
                                                                    disabled={selectedIds.length === 0}
                                                                    onClick={openDeleteMass}
                                                                    loading={deleting}
                                                                    radius="xl"
                                                                >
                                                                    <IconTrash size={12} />
                                                                </ActionIcon>
                                                            </Tooltip>
                                                            <Checkbox
                                                                size="xs"
                                                                color="orange"
                                                                radius="xl"
                                                                checked={allChecked}
                                                                indeterminate={isIndeterminate}
                                                                onChange={e => handleSelectAll(e.currentTarget.checked)}
                                                            />
                                                        </Group>
                                                    </Table.Th>
                                                </Table.Tr>
                                            </Table.Thead>
                                            <Table.Tbody>
                                                {paginatedItems.map((item: any) => {
                                                    const isSelected = selectedIds.includes(item.id);
                                                    return (
                                                        <Table.Tr key={item.id} style={{ background: isSelected ? '#fff8f0' : undefined }}>
                                                            <Table.Td>{item.sku || '-'}</Table.Td>
                                                            <Table.Td fw={600}>{item.nama}</Table.Td>
                                                            <Table.Td><Badge size="xs" color={item.kategori === 'Dry' ? 'blue' : item.kategori === 'Wet' ? 'yellow' : 'red'}>{item.kategori}</Badge></Table.Td>
                                                            <Table.Td>{item.satuan}</Table.Td>
                                                            <Table.Td ta="right" fw={700} style={{ color: item.stok <= (item.min_stok || 0) ? '#e03131' : '#111827' }}>{item.stok}</Table.Td>
                                                            <Table.Td ta="right">{item.min_stok || 0}</Table.Td>
                                                            <Table.Td ta="center">
                                                                <Group gap={6} justify="center" wrap="nowrap">
                                                                    <Tooltip label="Edit">
                                                                        <ActionIcon size="sm" color="blue" variant="light" onClick={() => openEdit(item)}>
                                                                            <IconEdit size={13} />
                                                                        </ActionIcon>
                                                                    </Tooltip>
                                                                    <Tooltip label="Hapus">
                                                                        <ActionIcon size="sm" color="red" variant="light" onClick={() => openDeleteSingle(item.id)}>
                                                                            <IconTrash size={13} />
                                                                        </ActionIcon>
                                                                    </Tooltip>
                                                                    <Checkbox
                                                                        size="xs"
                                                                        color="orange"
                                                                        radius="xl"
                                                                        checked={isSelected}
                                                                        onChange={e => handleSelectRow(item.id, e.currentTarget.checked)}
                                                                    />
                                                                </Group>
                                                            </Table.Td>
                                                        </Table.Tr>
                                                    );
                                                })}
                                            {filtered.length === 0 && (
                                                    <Table.Tr>
                                                        <Table.Td colSpan={7} ta="center" c="dimmed">Tidak ada data produk ditemukan.</Table.Td>
                                                    </Table.Tr>
                                                )}
                                            </Table.Tbody>
                                    </Table>
                                    {total > pageSize && (
                                        <Group justify="space-between" mt="md">
                                            <Text size="xs" c="dimmed">Halaman {page} dari {totalPages} · maksimal {pageSize} data</Text>
                                            <Pagination value={page} onChange={setPage} total={totalPages} size="sm" withEdges />
                                        </Group>
                                    )}
                                    </Box>
                                )}
                            </Paper>
                        )}
                    </Grid.Col>
                </Grid>
            </Box>

            <Modal
                opened={confirmOpen}
                onClose={() => setConfirmOpen(false)}
                title={
                    <Group gap={8}>
                        <IconAlertTriangle size={20} color="#e03131" />
                        <Text fw={800} size="sm" c="red">Konfirmasi Penghapusan</Text>
                    </Group>
                }
                centered
                radius="md"
                size="md"
            >
                <Stack gap="sm">
                    <Text size="xs" c="gray.7">
                        {deleteTarget === 'single'
                            ? 'Apakah Anda yakin ingin menghapus data produk ini?'
                            : `Apakah Anda yakin ingin menghapus ${selectedIds.length} produk terpilih?`}
                    </Text>

                    {userRole === 5 && (
                        <Paper withBorder p="xs" radius="sm" style={{ background: '#fff5f5', borderColor: '#ffc9c9' }}>
                            <Text size="xs" fw={700} c="red" mb={6}>Opsi Hak Akses Super Admin:</Text>
                            <Radio.Group value={deleteMode} onChange={(v: any) => setDeleteMode(v)}>
                                <Stack gap={6}>
                                    <Radio value="soft" size="xs" label="Simpan Riwayat (Hapus dari list master saja, riwayat & stok lama tetap aman)" />
                                    <Radio value="cascade" size="xs" color="red" label="Hapus Total (Hapus produk SEKALIGUS seluruh riwayat transaksi & stok)" />
                                </Stack>
                            </Radio.Group>
                        </Paper>
                    )}

                    <Group justify="flex-end" gap="xs" mt="xs">
                        <Button size="xs" variant="default" onClick={() => setConfirmOpen(false)}>Batal</Button>
                        <Button size="xs" color="red" onClick={executeDelete} loading={deleting} leftSection={<IconTrash size={14} />}>
                            {deleteMode === 'cascade' && userRole === 5 ? 'Hapus Total Data' : 'Hapus Data'}
                        </Button>
                    </Group>
                </Stack>
            </Modal>
        </Box>
    );
}
