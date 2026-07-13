'use client';
// @ts-nocheck
import React, { useState, useEffect } from 'react';
import { Box, Group, Button, Title, Text, Table, Paper, Stack, TextInput, Loader } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { api, unwrap, saveXlsx } from '../lib/api';
import * as XLSX from 'xlsx';

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

    const save = async () => {
        if (!form.nama) return notifications.show({ title: 'Error', message: 'Nama wajib', color: 'red' });
        // Check duplicate
        const duplicate = list.find((c: any) => c.nama?.toLowerCase() === form.nama.toLowerCase() && c.id !== editId);
        if (duplicate) return notifications.show({ title: 'Error', message: `Customer "${form.nama}" sudah ada`, color: 'red' });
        try {
            if (editId) {
                await api().put(`/customers/${editId}`, form);
                notifications.show({ title: 'Sukses', message: 'Customer diupdate', color: 'green' });
            } else {
                await api().post('/customers', form);
                notifications.show({ title: 'Sukses', message: 'Customer disimpan', color: 'green' });
            }
            setEditId(null);
            setForm({ nama: '', alamat: '', telp: '' });
            load();
        } catch (e: any) {
            notifications.show({ title: 'Error', message: unwrap(e.response)?.message || 'Failed', color: 'red' });
        }
    };

    const downloadTemplate = () => {
        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.aoa_to_sheet([
            ['Nama', 'Alamat', 'Telp'],
            ['PT. Sumber Makmur', 'Jl. Merdeka No. 45, Jakarta', '081234567890']
        ]);
        XLSX.utils.book_append_sheet(wb, ws, 'Template');
        saveXlsx(XLSX, wb, 'Template_Customer.xlsx');
    };

    const handleImport = async (file: File | null) => {
        if (!file) return;
        const data = await file.arrayBuffer();
        const wb = XLSX.read(data, { type: 'array' });
        const rows: any[] = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
        let success = 0, fail = 0;
        for (const row of rows) {
            try {
                await api().post('/customers', {
                    nama: String(row.Nama || ''),
                    alamat: String(row.Alamat || ''),
                    telp: String(row.Telp || ''),
                });
                success++;
            } catch { fail++; }
        }
        notifications.show({ title: 'Import Selesai', message: `${success} berhasil, ${fail} gagal`, color: fail > 0 ? 'yellow' : 'green' });
        load();
    };

    const del = async (id: any) => {
        if (!confirm('Hapus?')) return;
        try { await api().delete(`/customers/${id}`); load(); } catch (e) { console.error(e); }
    };

    const filtered = search ? list.filter((l: any) => l.nama?.toLowerCase().includes(search.toLowerCase())) : list;
    const f = (k: any, v: any) => setForm(p => ({ ...p, [k]: v }));

    const handleEdit = (item: any) => {
        setEditId(item.id);
        setForm({
            nama: item.nama || '',
            alamat: item.alamat || '',
            telp: item.telp || ''
        });
    };

    const handleCancelEdit = () => {
        setEditId(null);
        setForm({ nama: '', alamat: '', telp: '' });
    };

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
                            <Group grow gap="xs" mt="xs">
                                {editId && <Button size="xs" color="gray" variant="outline" onClick={handleCancelEdit}>Batal</Button>}
                                <Button size="xs" color="dark" onClick={save}>{editId ? 'Update' : 'Submit'}</Button>
                            </Group>
                        </Stack>
                    </Paper>
                    <Box style={{ flex: 1 }}>
                        <Group mb="xs" gap="xs">
                            <TextInput placeholder="Cari..." size="xs" value={search} onChange={e => setSearch(e.target.value)} style={{ width: 220 }} />
                            <Button size="xs" variant="outline" color="gray" onClick={downloadTemplate}>Template</Button>
                            <input type="file" accept=".xlsx,.xls" id="import-customer" style={{ display: 'none' }} onChange={e => handleImport(e.target.files?.[0] || null)} />
                            <Button size="xs" variant="outline" color="blue" onClick={() => document.getElementById('import-customer')?.click()}>Import Excel</Button>
                        </Group>
                        {loading ? <Loader /> : (
                            <Table withTableBorder withColumnBorders style={{ fontSize: 11 }}>
                                <Table.Thead style={{ background: '#1a1a1a' }}>
                                    <Table.Tr>
                                        {['Nama', 'Alamat', 'Telp', 'Aksi'].map((h: any) => (
                                            <Table.Th key={h} style={{ color: '#fff', fontSize: 11 }}>{h}</Table.Th>
                                        ))}
                                    </Table.Tr>
                                </Table.Thead>
                                <Table.Tbody>
                                    {filtered.map((c: any) => (
                                        <Table.Tr key={c.id}>
                                            <Table.Td fw={600}>{c.nama}</Table.Td>
                                            <Table.Td>{c.alamat || '-'}</Table.Td>
                                            <Table.Td>{c.telp || '-'}</Table.Td>
                                            <Table.Td>
                                                <Group gap={4}>
                                                    <Button size="xs" color="green" variant="light" style={{ padding: '0 6px' }} onClick={() => handleEdit(c)}>✎</Button>
                                                    <Button size="xs" color="red" variant="filled" style={{ padding: '0 6px' }} onClick={() => del(c.id)}>✕</Button>
                                                </Group>
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
