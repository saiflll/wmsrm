'use client';
import React, { useState, useEffect } from 'react';
import {
    Box, Button, Group, Modal, Paper, Select, Stack, Table, Text, TextInput, Title, Badge, Loader, ActionIcon, Tooltip, PasswordInput
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import { fetchUsers, createUser, updateUser, deleteUser } from '../lib/api';

const roleLabel: Record<number, string> = { 1: 'Checker IB', 2: 'Checker OB', 3: 'Koordinator', 4: 'Supervisor', 5: 'Super Admin' };
const roleColor: Record<number, string> = { 1: 'blue', 2: 'cyan', 3: 'grape', 4: 'orange', 5: 'red' };

export default function UsersPage() {
    const [users, setUsers] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [opened, { open, close }] = useDisclosure(false);
    const [editingUser, setEditingUser] = useState<any>(null);
    const [form, setForm] = useState({ username: '', password: '', role: '1' });

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

    const openCreate = () => {
        setEditingUser(null);
        setForm({ username: '', password: '', role: '1' });
        open();
    };

    const openEdit = (user: any) => {
        setEditingUser(user);
        setForm({ username: user.username, password: '', role: String(user.role) });
        open();
    };

    const handleSave = async () => {
        if (!form.username) {
            notifications.show({ title: 'Validasi', message: 'Username harus diisi', color: 'yellow' });
            return;
        }
        try {
            if (editingUser) {
                const payload: any = { username: form.username, role: Number(form.role) };
                if (form.password) payload.password = form.password;
                await updateUser(editingUser.id, payload);
                notifications.show({ title: 'Sukses', message: 'User berhasil diupdate', color: 'green' });
            } else {
                if (!form.password || form.password.length < 6) {
                    notifications.show({ title: 'Validasi', message: 'Password minimal 6 karakter', color: 'yellow' });
                    return;
                }
                await createUser({ username: form.username, password: form.password, role: Number(form.role) });
                notifications.show({ title: 'Sukses', message: 'User berhasil dibuat', color: 'green' });
            }
            close();
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
            notifications.show({ title: 'Sukses', message: 'User berhasil dihapus', color: 'green' });
            loadUsers();
        } catch (e: any) {
            const msg = e.response?.data?.message || e.message || 'Gagal menghapus user';
            notifications.show({ title: 'Error', message: msg, color: 'red' });
        }
    };

    if (loading) return <Loader mt="xl" />;

    return (
        <Box p="md">
            <Group justify="space-between" mb="lg">
                <Title order={3}>Manajemen User</Title>
                <Button onClick={openCreate}>Tambah User</Button>
            </Group>

            <Paper withBorder>
                <Table striped highlightOnHover>
                    <Table.Thead>
                        <Table.Tr>
                            <Table.Th>ID</Table.Th>
                            <Table.Th>Username</Table.Th>
                            <Table.Th>Role</Table.Th>
                            <Table.Th>Aksi</Table.Th>
                        </Table.Tr>
                    </Table.Thead>
                    <Table.Tbody>
                        {users.map((u: any) => (
                            <Table.Tr key={u.id}>
                                <Table.Td>{u.id}</Table.Td>
                                <Table.Td>{u.username}</Table.Td>
                                <Table.Td>
                                    <Badge color={roleColor[u.role] || 'gray'}>{roleLabel[u.role] || 'Unknown'}</Badge>
                                </Table.Td>
                                <Table.Td>
                                    <Group gap="xs">
                                        <Tooltip label="Edit">
                                            <ActionIcon variant="light" color="blue" onClick={() => openEdit(u)}>
                                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 3a2.85 2.85 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/></svg>
                                            </ActionIcon>
                                        </Tooltip>
                                        <Tooltip label="Hapus">
                                            <ActionIcon variant="light" color="red" onClick={() => handleDelete(u)}>
                                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                                            </ActionIcon>
                                        </Tooltip>
                                    </Group>
                                </Table.Td>
                            </Table.Tr>
                        ))}
                        {users.length === 0 && (
                            <Table.Tr>
                                <Table.Td colSpan={4}><Text c="dimmed" ta="center">Belum ada user</Text></Table.Td>
                            </Table.Tr>
                        )}
                    </Table.Tbody>
                </Table>
            </Paper>

            <Modal opened={opened} onClose={close} title={editingUser ? 'Edit User' : 'Tambah User'} centered>
                <Stack>
                    <TextInput label="Username" required value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} />
                    <PasswordInput label={editingUser ? 'Password (kosongkan jika tidak diubah)' : 'Password'} required={!editingUser} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
                    <Select label="Role" data={[
                        { value: '1', label: 'Checker IB' },
                        { value: '2', label: 'Checker OB' },
                        { value: '3', label: 'Koordinator' },
                        { value: '4', label: 'Supervisor' },
                        { value: '5', label: 'Super Admin' },
                    ]} value={form.role} onChange={(v) => setForm({ ...form, role: v || '1' })} />
                    <Group justify="flex-end" mt="md">
                        <Button variant="default" onClick={close}>Batal</Button>
                        <Button onClick={handleSave}>{editingUser ? 'Simpan' : 'Buat'}</Button>
                    </Group>
                </Stack>
            </Modal>
        </Box>
    );
}
