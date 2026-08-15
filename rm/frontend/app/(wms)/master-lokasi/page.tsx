'use client';
// @ts-nocheck
import React, { useState, useEffect } from 'react';
import { Box, Group, Button, Title, Text, Table, Badge, Paper, Stack, TextInput, Select, Grid, Loader, ActionIcon, Tooltip, Checkbox, Modal, Radio, Pagination } from '@mantine/core';
import { IconMap2, IconPlus, IconEdit, IconTrash, IconX, IconAlertTriangle } from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import { api, unwrap } from '../lib/api';

export default function MasterLokasiPage() {
    const [locs, setLocs] = useState<any[]>([]);
    const [search, setSearch] = useState('');
    const [page, setPage] = useState(1);
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(true);
    const [editId, setEditId] = useState<number | null>(null);
    const [form, setForm] = useState({ name: '', zone: 'DRY A', level: 1, kolom: '', type: 'Single Deep', capacity: 1000 });
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
            const payload = unwrap(await api().get('/gudang/paged', { params: { page, limit: 20, search: search.trim() } }));
            setLocs(payload.data || []);
            setTotal(payload.total || 0);
            setSelectedIds([]);
        } catch (e) { console.error(e); }
        setLoading(false);
    };

    const resetForm = () => {
        setEditId(null);
        setForm({ name: '', zone: 'DRY A', level: 1, kolom: '', type: 'Single Deep', capacity: 1000 });
    };

    const save = async () => {
        if (!form.name) return notifications.show({ title: 'Error', message: 'Nama lokasi rak wajib diisi', color: 'red' });
        // Check duplicate name within the SAME zone
        const duplicate = locs.find((l: any) => l.name?.toLowerCase() === form.name.toLowerCase() && l.zone === form.zone && l.id !== editId);
        if (duplicate) return notifications.show({ title: 'Error', message: `Lokasi "${form.name}" pada zone "${form.zone}" sudah ada`, color: 'red' });
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
                await api().delete(`/gudang/${targetSingleId}${isCascade ? '?cascade=true' : ''}`);
                notifications.show({ title: 'Sukses', message: isCascade ? 'Lokasi beserta riwayat berhasil dihapus total' : 'Lokasi dihapus', color: 'orange' });
                if (editId === targetSingleId) resetForm();
                load();
            } catch (e) { console.error(e); }
        } else if (deleteTarget === 'mass') {
            let successCount = 0;
            let failCount = 0;
            for (const id of selectedIds) {
                try {
                    await api().delete(`/gudang/${id}${isCascade ? '?cascade=true' : ''}`);
                    successCount++;
                } catch (e: any) {
                    failCount++;
                    console.error(`Gagal menghapus lokasi ID ${id}:`, e);
                }
            }

            if (successCount > 0) {
                notifications.show({
                    title: 'Informasi Hapus',
                    message: `${successCount} lokasi berhasil dihapus${failCount > 0 ? `, ${failCount} lokasi gagal.` : '.'}`,
                    color: failCount > 0 ? 'yellow' : 'green',
                });
            } else if (failCount > 0) {
                notifications.show({
                    title: 'Gagal Hapus',
                    message: 'Lokasi terpilih gagal dihapus.',
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

    const f = (k: any, v: any) => setForm(p => ({ ...p, [k]: v }));
    const filtered = locs;
    const pageSize = 20;
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const displayedItems = filtered;

    useEffect(() => { setPage(1); }, [search]);
    useEffect(() => { if (page > totalPages) setPage(totalPages); }, [page, totalPages]);

    const handleSelectAll = (checked: boolean) => {
        if (checked) {
            setSelectedIds(displayedItems.map((l: any) => l.id));
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

    const allChecked = displayedItems.length > 0 && displayedItems.every((l: any) => selectedIds.includes(l.id));
    const isIndeterminate = displayedItems.some((l: any) => selectedIds.includes(l.id)) && !allChecked;

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
                                <Badge color="blue" variant="light">{total} total lokasi</Badge>
                            </Group>

                            {loading ? <Loader /> : (
                                <Box style={{ overflowX: "auto" }}>
                                    <Table withTableBorder withColumnBorders style={{ fontSize: 11 }}>
                                        <Table.Thead style={{ background: "#f0f7ff", borderBottom: "2px solid #a5d8ff" }}>
                                            <Table.Tr>
                                                {['Nama Rak', 'Zone', 'Kolom', 'Level', 'Type', 'Kapasitas', 'Status'].map((h: any) => (
                                                    <Table.Th key={h} style={{ color: '#1864ab', fontSize: 11 }}>{h}</Table.Th>
                                                ))}
                                                <Table.Th style={{ color: '#1864ab', fontSize: 11, textAlign: 'center' }}>
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
                                                             color="blue"
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
                                             {displayedItems.map((l: any) => {
                                                 const isSelected = selectedIds.includes(l.id);
                                                 return (
                                                     <Table.Tr key={l.id} style={{ background: isSelected ? '#e7f5ff' : undefined }}>
                                                         <Table.Td fw={700}>{l.name}</Table.Td>
                                                         <Table.Td><Badge size="xs" color={l.side ? 'blue' : 'yellow'}>{l.zone || (l.side ? 'DRY' : 'WET')}</Badge></Table.Td>
                                                         <Table.Td>{l.kolom || '-'}</Table.Td>
                                                         <Table.Td>{l.level}</Table.Td>
                                                         <Table.Td>{l.type || '-'}</Table.Td>
                                                         <Table.Td ta="right">{l.capacity || '-'}</Table.Td>
                                                         <Table.Td><Badge size="xs" color={l.status ? 'green' : 'red'}>{l.status ? 'Available' : 'Occupied'}</Badge></Table.Td>
                                                         <Table.Td ta="center">
                                                             <Group gap={6} justify="center" wrap="nowrap">
                                                                 <Tooltip label="Edit">
                                                                     <ActionIcon size="sm" color="blue" variant="light" onClick={() => handleEdit(l)}>
                                                                         <IconEdit size={13} />
                                                                     </ActionIcon>
                                                                 </Tooltip>
                                                                 <Tooltip label="Hapus">
                                                                     <ActionIcon size="sm" color="red" variant="light" onClick={() => openDeleteSingle(l.id)}>
                                                                         <IconTrash size={13} />
                                                                     </ActionIcon>
                                                                 </Tooltip>
                                                                 <Checkbox
                                                                     size="xs"
                                                                     color="blue"
                                                                     radius="xl"
                                                                     checked={isSelected}
                                                                     onChange={e => handleSelectRow(l.id, e.currentTarget.checked)}
                                                                 />
                                                             </Group>
                                                         </Table.Td>
                                                    </Table.Tr>
                                                );
                                            })}
                                            {filtered.length === 0 && (
                                                <Table.Tr>
                                                    <Table.Td colSpan={8} ta="center" c="dimmed">Tidak ada data lokasi ditemukan.</Table.Td>
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
                            ? 'Apakah Anda yakin ingin menghapus lokasi rak ini?'
                            : `Apakah Anda yakin ingin menghapus ${selectedIds.length} lokasi terpilih?`}
                    </Text>

                    {userRole === 5 && (
                        <Paper withBorder p="xs" radius="sm" style={{ background: '#fff5f5', borderColor: '#ffc9c9' }}>
                            <Text size="xs" fw={700} c="red" mb={6}>Opsi Hak Akses Super Admin:</Text>
                            <Radio.Group value={deleteMode} onChange={(v: any) => setDeleteMode(v)}>
                                <Stack gap={6}>
                                    <Radio value="soft" size="xs" label="Simpan Riwayat (Hapus dari list master saja, riwayat & stok lama tetap aman)" />
                                    <Radio value="cascade" size="xs" color="red" label="Hapus Total (Hapus lokasi SEKALIGUS seluruh riwayat transaksi & stok)" />
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
