'use client';
// @ts-nocheck
import React, { useState, useEffect } from 'react';
import {
    Box, Button, Group, Paper, Select, Stack, Table, Text, TextInput, Title, Badge, Loader, ActionIcon, Tooltip, PasswordInput, Switch, Grid
} from '@mantine/core';
import { IconUsers, IconUserPlus, IconEdit, IconTrash, IconX, IconShield } from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import { fetchUsers, createUser, updateUser, deleteUser } from '../lib/api';

const roleLabel: Record<number, string> = { 1: 'Checker IB', 2: 'Checker OB', 3: 'Koordinator', 4: 'Supervisor', 5: 'Super Admin', 6: 'Manager' };
const roleColor: Record<number, string> = { 1: 'blue', 2: 'cyan', 3: 'grape', 4: 'orange', 5: 'red', 6: 'violet' };

export default function UsersPage() {
    const [users, setUsers] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [editingUser, setEditingUser] = useState<any>(null);
    const [search, setSearch] = useState('');
    const [form, setForm] = useState({ username: '', nama: '', password: '', role: '1', is_active: true });

    // Sort states
    const [sortKey, setSortKey] = useState<string | null>(null);
    const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

    const handleSort = (key: string) => {
        if (sortKey === key) {
            setSortDir(sortDir === "asc" ? "desc" : "asc");
        } else {
            setSortKey(key);
            setSortDir("asc");
        }
    };

    const sortIcon = (key: string) => {
        if (sortKey !== key) return " ↕";
        return sortDir === "asc" ? " ▲" : " ▼";
    };

    const loadUsers = async () => {
        setLoading(true);
        try {
            const data = await fetchUsers();
            setUsers(Array.isArray(data) ? data : []);
        } catch (e: any) {
            notifications.show({ title: 'Error', message: 'Gagal memuat data user', color: 'red' });
            setUsers([]);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { loadUsers(); }, []);

    const resetForm = () => {
        setEditingUser(null);
        setForm({ username: '', nama: '', password: '', role: '1', is_active: true });
    };

    const openEdit = (user: any) => {
        setEditingUser(user);
        setForm({
            username: user.username,
            nama: user.nama || '',
            password: '',
            role: String(user.role),
            is_active: user.is_active !== false,
        });
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const handleSave = async () => {
        if (!form.username) {
            notifications.show({ title: 'Validasi', message: 'Username harus diisi', color: 'yellow' });
            return;
        }
        try {
            if (editingUser) {
                const payload: any = {
                    username: form.username,
                    nama: form.nama,
                    role: Number(form.role),
                    is_active: form.is_active,
                };
                if (form.password) payload.password = form.password;
                await updateUser(editingUser.id, payload);
                notifications.show({ title: 'Sukses', message: 'User berhasil diupdate', color: 'green' });
            } else {
                if (!form.password || form.password.length < 6) {
                    notifications.show({ title: 'Validasi', message: 'Password minimal 6 karakter', color: 'yellow' });
                    return;
                }
                await createUser({
                    username: form.username,
                    nama: form.nama,
                    password: form.password,
                    role: Number(form.role),
                    is_active: form.is_active,
                });
                notifications.show({ title: 'Sukses', message: 'User berhasil dibuat', color: 'green' });
            }
            resetForm();
            loadUsers();
        } catch (e: any) {
            const msg = e.response?.data?.message || e.message || 'Gagal menyimpan user';
            notifications.show({ title: 'Error', message: msg, color: 'red' });
        }
    };

    const handleDelete = async (user: any) => {
        if (!confirm(`Hapus user "${user.username}"?`)) return;
        try {
            await deleteUser(user.id);
            notifications.show({ title: 'Sukses', message: 'User berhasil dihapus', color: 'orange' });
            if (editingUser?.id === user.id) resetForm();
            loadUsers();
        } catch (e: any) {
            const msg = e.response?.data?.message || e.message || 'Gagal menghapus user';
            notifications.show({ title: 'Error', message: msg, color: 'red' });
        }
    };

    const filtered = users.filter((u: any) =>
        !search ||
        u.nama?.toLowerCase().includes(search.toLowerCase()) ||
        u.username?.toLowerCase().includes(search.toLowerCase())
    ).sort((a: any, b: any) => {
        if (!sortKey) return 0;
        let valA = a[sortKey];
        let valB = b[sortKey];
        if (typeof valA === 'string') valA = valA.toLowerCase();
        if (typeof valB === 'string') valB = valB.toLowerCase();
        if (valA < valB) return sortDir === 'asc' ? -1 : 1;
        if (valA > valB) return sortDir === 'asc' ? 1 : -1;
        return 0;
    });

    return (
        <Box>
            <Box style={{ background: '#fff', borderLeft: '4px solid #862e9c', padding: '14px 20px', marginBottom: 16, boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}>
                <Title order={4} style={{ color: '#111827', fontWeight: 800, display: "flex", alignItems: "center", gap: 8 }}>
                    <IconUsers size={20} style={{ color: '#862e9c' }} />
                    MANAJEMEN USER
                </Title>
            </Box>

            <Box p="md">
                <Grid gutter="md">
                    {/* Left Form Panel */}
                    <Grid.Col span={{ base: 12, md: 4, lg: 3 }}>
                        <Paper withBorder p="md" radius="md" style={{ background: '#fff' }}>
                            <Stack gap="xs">
                                <Group justify="space-between">
                                    <Text fw={800} size="sm" c="grape" style={{ borderBottom: "1px solid #f1f5f9", paddingBottom: 4, flex: 1 }}>
                                        {editingUser ? 'EDIT USER' : 'TAMBAH USER'}
                                    </Text>
                                    {editingUser && (
                                        <ActionIcon size="xs" variant="subtle" color="gray" onClick={resetForm}>
                                            <IconX size={14} />
                                        </ActionIcon>
                                    )}
                                </Group>

                                <TextInput label="Nama Lengkap" size="xs" value={form.nama} onChange={(e) => setForm({ ...form, nama: e.target.value })} placeholder="Masukkan nama..." required />
                                <TextInput label="Username" size="xs" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} placeholder="Username login" required />
                                <PasswordInput label={editingUser ? 'Password (isi jika ubah)' : 'Password'} size="xs" required={!editingUser} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="Min 6 karakter" />
                                <Select label="Role" size="xs" data={[
                                    { value: '1', label: 'Checker IB' },
                                    { value: '2', label: 'Checker OB' },
                                    { value: '3', label: 'Koordinator' },
                                    { value: '4', label: 'Supervisor' },
                                    { value: '5', label: 'Super Admin' },
                                    { value: '6', label: 'Manager' },
                                ]} value={form.role} onChange={(v) => setForm({ ...form, role: v || '1' })} />
                                <Switch
                                    label="Akun Aktif"
                                    size="xs"
                                    checked={form.is_active}
                                    onChange={(e) => setForm({ ...form, is_active: e.currentTarget.checked })}
                                    mt={4}
                                />

                                <Group gap="xs" mt="xs">
                                    <Button fullWidth size="xs" color="grape" onClick={handleSave} style={{ fontWeight: 700, flex: 1 }} leftSection={editingUser ? <IconEdit size={14} /> : <IconUserPlus size={14} />}>
                                        {editingUser ? 'Update User' : 'Simpan User'}
                                    </Button>
                                    {editingUser && (
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
                                <TextInput placeholder="Cari nama, username..." size="xs" value={search} onChange={e => setSearch(e.target.value)} style={{ width: 220 }} />
                                <Badge color="grape" variant="light">{filtered.length} total user</Badge>
                            </Group>

                            {loading ? <Loader /> : (
                                <Box style={{ overflowX: "auto" }}>
                                    <Table withTableBorder withColumnBorders style={{ fontSize: 11 }}>
                                        <Table.Thead style={{ background: "#f8f0fc", borderBottom: "2px solid #eebefa" }}>
                                            <Table.Tr>
                                                {[
                                                    { label: 'ID', key: 'id' },
                                                    { label: 'Nama', key: 'nama' },
                                                    { label: 'Username', key: 'username' },
                                                    { label: 'Role', key: 'role' },
                                                    { label: 'Status', key: 'is_active' },
                                                    { label: 'Aksi', key: '' },
                                                ].map((col) => (
                                                    <Table.Th
                                                        key={col.label}
                                                        style={{ color: '#862e9c', fontSize: 11, cursor: col.key ? 'pointer' : 'default' }}
                                                        onClick={() => col.key && handleSort(col.key)}
                                                    >
                                                        {col.label}
                                                        {col.key ? sortIcon(col.key) : ''}
                                                    </Table.Th>
                                                ))}
                                            </Table.Tr>
                                        </Table.Thead>
                                        <Table.Tbody>
                                            {filtered.map((u: any) => (
                                                <Table.Tr key={u.id}>
                                                    <Table.Td fw={600}>{u.id}</Table.Td>
                                                    <Table.Td fw={600}>{u.nama || '-'}</Table.Td>
                                                    <Table.Td>{u.username}</Table.Td>
                                                    <Table.Td>
                                                        <Badge size="xs" color={roleColor[u.role] || 'gray'}>{roleLabel[u.role] || 'Unknown'}</Badge>
                                                    </Table.Td>
                                                    <Table.Td>
                                                        <Badge size="xs" color={u.is_active === false ? 'red' : 'green'}>
                                                            {u.is_active === false ? 'Nonaktif' : 'Aktif'}
                                                        </Badge>
                                                    </Table.Td>
                                                    <Table.Td>
                                                        <Group gap={4} wrap="nowrap">
                                                            <Tooltip label="Edit">
                                                                <ActionIcon size="sm" color="blue" variant="light" onClick={() => openEdit(u)}>
                                                                    <IconEdit size={13} />
                                                                </ActionIcon>
                                                            </Tooltip>
                                                            <Tooltip label="Hapus">
                                                                <ActionIcon size="sm" color="red" variant="light" onClick={() => handleDelete(u)}>
                                                                    <IconTrash size={13} />
                                                                </ActionIcon>
                                                            </Tooltip>
                                                        </Group>
                                                    </Table.Td>
                                                </Table.Tr>
                                            ))}
                                            {filtered.length === 0 && (
                                                <Table.Tr>
                                                    <Table.Td colSpan={6} ta="center" c="dimmed">Tidak ada user ditemukan.</Table.Td>
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
