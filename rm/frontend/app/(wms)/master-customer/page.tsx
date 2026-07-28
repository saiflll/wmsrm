'use client';
// @ts-nocheck
import React, { useState, useEffect } from 'react';
import { Box, Group, Button, Title, Text, Table, Paper, Stack, TextInput, Grid, Loader, ActionIcon, Tooltip, Badge, Checkbox, Modal, Radio } from '@mantine/core';
import { IconBuildingStore, IconPlus, IconEdit, IconTrash, IconX, IconAlertTriangle } from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import { api, unwrap } from '../lib/api';

export default function MasterCustomerPage() {
    const [list, setList] = useState<any[]>([]);
    const [search, setSearch] = useState('');
    const [loading, setLoading] = useState(true);
    const [editId, setEditId] = useState<number | null>(null);
    const [form, setForm] = useState({ nama: '', alamat: '', telp: '' });
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
        load();
    }, []);

    const load = async () => {
        setLoading(true);
        try {
            setList(unwrap(await api().get('/customers')));
            setSelectedIds([]);
        } catch (e) { console.error(e); }
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
                await api().delete(`/customers/${targetSingleId}${isCascade ? '?cascade=true' : ''}`);
                notifications.show({ title: 'Sukses', message: isCascade ? 'Customer beserta riwayat berhasil dihapus total' : 'Customer dihapus', color: 'teal' });
                if (editId === targetSingleId) resetForm();
                load();
            } catch (e) { console.error(e); }
        } else if (deleteTarget === 'mass') {
            let successCount = 0;
            let failCount = 0;
            for (const id of selectedIds) {
                try {
                    await api().delete(`/customers/${id}${isCascade ? '?cascade=true' : ''}`);
                    successCount++;
                } catch (e: any) {
                    failCount++;
                    console.error(`Gagal menghapus customer ID ${id}:`, e);
                }
            }

            if (successCount > 0) {
                notifications.show({
                    title: 'Informasi Hapus',
                    message: `${successCount} customer berhasil dihapus${failCount > 0 ? `, ${failCount} customer gagal.` : '.'}`,
                    color: failCount > 0 ? 'yellow' : 'green',
                });
            } else if (failCount > 0) {
                notifications.show({
                    title: 'Gagal Hapus',
                    message: 'Customer terpilih gagal dihapus.',
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

    const filtered = search ? list.filter((l: any) => l.nama?.toLowerCase().includes(search.toLowerCase()) || l.alamat?.toLowerCase().includes(search.toLowerCase())) : list;
    const f = (k: any, v: any) => setForm(p => ({ ...p, [k]: v }));

    const handleSelectAll = (checked: boolean) => {
        if (checked) {
            setSelectedIds(filtered.map((c: any) => c.id));
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

    const allChecked = filtered.length > 0 && filtered.every((c: any) => selectedIds.includes(c.id));
    const isIndeterminate = selectedIds.length > 0 && !allChecked;

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
                                                {['Nama Supplier / Customer', 'Alamat', 'No. Telepon'].map((h: any) => (
                                                    <Table.Th key={h} style={{ color: '#0f766e', fontSize: 11 }}>{h}</Table.Th>
                                                ))}
                                                <Table.Th style={{ color: '#0f766e', fontSize: 11, textAlign: 'center' }}>
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
                                                            color="teal"
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
                                            {filtered.map((c: any) => {
                                                const isSelected = selectedIds.includes(c.id);
                                                return (
                                                    <Table.Tr key={c.id} style={{ background: isSelected ? '#e6fffa' : undefined }}>
                                                        <Table.Td fw={700}>{c.nama}</Table.Td>
                                                        <Table.Td>{c.alamat || '-'}</Table.Td>
                                                        <Table.Td>{c.telp || '-'}</Table.Td>
                                                        <Table.Td ta="center">
                                                            <Group gap={6} justify="center" wrap="nowrap">
                                                                <Tooltip label="Edit">
                                                                    <ActionIcon size="sm" color="blue" variant="light" onClick={() => handleEdit(c)}>
                                                                        <IconEdit size={13} />
                                                                    </ActionIcon>
                                                                </Tooltip>
                                                                <Tooltip label="Hapus">
                                                                    <ActionIcon size="sm" color="red" variant="light" onClick={() => openDeleteSingle(c.id)}>
                                                                        <IconTrash size={13} />
                                                                    </ActionIcon>
                                                                </Tooltip>
                                                                <Checkbox
                                                                    size="xs"
                                                                    color="teal"
                                                                    radius="xl"
                                                                    checked={isSelected}
                                                                    onChange={e => handleSelectRow(c.id, e.currentTarget.checked)}
                                                                />
                                                            </Group>
                                                        </Table.Td>
                                                    </Table.Tr>
                                                );
                                            })}
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
                            ? 'Apakah Anda yakin ingin menghapus data customer/supplier ini?'
                            : `Apakah Anda yakin ingin menghapus ${selectedIds.length} customer terpilih?`}
                    </Text>

                    {userRole === 5 && (
                        <Paper withBorder p="xs" radius="sm" style={{ background: '#fff5f5', borderColor: '#ffc9c9' }}>
                            <Text size="xs" fw={700} c="red" mb={6}>Opsi Hak Akses Super Admin:</Text>
                            <Radio.Group value={deleteMode} onChange={(v: any) => setDeleteMode(v)}>
                                <Stack gap={6}>
                                    <Radio value="soft" size="xs" label="Simpan Riwayat (Hapus dari list master saja, riwayat & transaksi lama tetap aman)" />
                                    <Radio value="cascade" size="xs" color="red" label="Hapus Total (Hapus customer SEKALIGUS seluruh riwayat transaksi)" />
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


