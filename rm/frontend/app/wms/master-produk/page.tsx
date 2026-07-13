'use client';
// @ts-nocheck
import React, { useState, useEffect } from 'react';
import { Box, Group, Button, Title, Text, Table, Badge, Paper, Stack, TextInput, Select, Modal, Loader } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import { api, unwrap, saveXlsx } from '../lib/api';
import * as XLSX from 'xlsx';

export default function MasterProdukPage() {
    const [tab, setTab] = useState('items');
    const [items, setItems] = useState<any[]>([]);
    const [search, setSearch] = useState('');
    const [loading, setLoading] = useState(true);
    const [opened, { open, close }] = useDisclosure(false);
    const [editId, setEditId] = useState(null);
    const [form, setForm] = useState({ sku: '', nama: '', satuan: '', kategori: 'Dry', min_stok: 0, max_stok: 1000 });

    useEffect(() => { load(); }, []);

    const load = async () => {
        setLoading(true);
        try {
            const res = await api().get('/barang');
            setItems(unwrap(res));
        } catch (e) { console.error(e); }
        setLoading(false);
    };

    const save = async () => {
        if (!form.nama) return notifications.show({ title: 'Error', message: 'Nama produk wajib', color: 'red' });
        // Check duplicate
        const duplicate = items.find((i: any) => i.nama?.toLowerCase() === form.nama.toLowerCase() && i.id !== editId);
        if (duplicate) return notifications.show({ title: 'Error', message: `Produk "${form.nama}" sudah ada`, color: 'red' });
        try {
            if (editId) {
                await api().put(`/barang/${editId}`, form);
            } else {
                await api().post('/barang', form);
            }
            notifications.show({ title: 'Sukses', message: editId ? 'Produk diupdate' : 'Produk ditambah', color: 'green' });
            close(); setEditId(null);
            setForm({ sku: '', nama: '', satuan: '', kategori: 'Dry', min_stok: 0, max_stok: 1000 });
            load();
        } catch (e: any) {
            notifications.show({ title: 'Error', message: unwrap(e.response)?.message || 'Failed', color: 'red' });
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

    const downloadTemplate = () => {
        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.aoa_to_sheet([
            ['SKU', 'Nama', 'Satuan', 'Kategori', 'Min Stok'],
            ['BRG999', 'Ayam Fillet Premium', 'Kg', 'Wet', 10]
        ]);
        XLSX.utils.book_append_sheet(wb, ws, 'Template');
        saveXlsx(XLSX, wb, 'Template_Produk.xlsx');
    };

    const handleImport = async (file: File | null) => {
        if (!file) return;
        const data = await file.arrayBuffer();
        const wb = XLSX.read(data, { type: 'array' });
        const rows: any[] = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
        let success = 0, fail = 0;
        for (const row of rows) {
            try {
                await api().post('/barang', {
                    sku: String(row.SKU || ''),
                    nama: String(row.Nama || ''),
                    satuan: String(row.Satuan || 'Kg'),
                    kategori: String(row.Kategori || 'Dry'),
                    min_stok: Number(row['Min Stok']) || 0,
                    max_stok: Number(row['Max Stok'] || row['Kapasitas']) || 1000,
                });
                success++;
            } catch { fail++; }
        }
        notifications.show({ title: 'Import Selesai', message: `${success} berhasil, ${fail} gagal`, color: fail > 0 ? 'yellow' : 'green' });
        load();
    };

    const del = async (id: number) => {
        if (!confirm('Hapus produk ini?')) return;
        try {
            await api().delete(`/barang/${id}`);
            notifications.show({ title: 'Dihapus', message: 'Produk dihapus', color: 'orange' });
            load();
        } catch (e) { console.error(e); }
    };

    const openEdit = (item: any) => {
        setEditId(item.id);
        setForm({ sku: item.sku, nama: item.nama, satuan: item.satuan, kategori: item.kategori, min_stok: item.min_stok || 0, max_stok: item.max_stok || 1000 });
        open();
    };

    const f = (k: string, v: any) => setForm(p => ({ ...p, [k]: v }));
    const filtered = search ? items.filter((i: any) => i.nama?.toLowerCase().includes(search.toLowerCase()) || i.sku?.includes(search)) : items;

    // Count by kategori
    const katGroups: Record<string, number> = {};
    items.forEach((i: any) => { katGroups[i.kategori] = (katGroups[i.kategori] || 0) + 1; });

    return (
        <Box>
            <Box style={{ background: '#fff', borderBottom: '1px solid #ddd', padding: '12px 20px' }}>
                <Group justify="space-between">
                    <Title order={3} style={{ color: '#e6921e', fontWeight: 900 }}>MASTER PRODUK</Title>
                    <Group gap="xs">
                        <Button size="xs" variant={tab === 'items' ? 'filled' : 'outline'} color="dark" onClick={() => setTab('items')}>Items</Button>
                        <Button size="xs" variant={tab === 'kategori' ? 'filled' : 'outline'} color="gray" onClick={() => setTab('kategori')}>Kategori</Button>
                    </Group>
                </Group>
            </Box>

            <Box p="md">
                {tab === 'kategori' ? (
                    <Box>
                        <Text fw={700} mb="md">KATEGORI PRODUK</Text>
                        <Table withTableBorder withColumnBorders style={{ fontSize: 12, maxWidth: 400 }}>
                            <Table.Thead style={{ background: '#1a1a1a' }}>
                                <Table.Tr>
                                    <Table.Th style={{ color: '#fff' }}>Kategori</Table.Th>
                                    <Table.Th style={{ color: '#fff' }}>Jumlah Item</Table.Th>
                                </Table.Tr>
                            </Table.Thead>
                            <Table.Tbody>
                                {Object.entries(katGroups).map(([k, v]) => (
                                    <Table.Tr key={k}>
                                        <Table.Td fw={600}>{k}</Table.Td>
                                        <Table.Td ta="right">{v}</Table.Td>
                                    </Table.Tr>
                                ))}
                            </Table.Tbody>
                        </Table>
                    </Box>
                ) : (
                    <Box>
                        <Group mb="xs" gap="xs">
                            <TextInput placeholder="Cari SKU / nama..." size="xs" value={search} onChange={e => setSearch(e.target.value)} style={{ width: 220 }} />
                            <Button size="xs" color="green" onClick={() => { setEditId(null); setForm({ sku: '', nama: '', satuan: '', kategori: 'Dry', min_stok: 0, max_stok: 1000 }); open(); }} style={{ fontWeight: 700 }}>+ Tambah Produk</Button>
                            <Button size="xs" variant="light" color="blue" onClick={syncAll}>Sync Stock</Button>
                            <Button size="xs" variant="outline" color="gray" onClick={downloadTemplate}>Template</Button>
                            <input type="file" accept=".xlsx,.xls" id="import-produk" style={{ display: 'none' }} onChange={e => handleImport(e.target.files?.[0] || null)} />
                            <Button size="xs" variant="outline" color="blue" onClick={() => document.getElementById('import-produk')?.click()}>Import Excel</Button>
                        </Group>

                        {loading ? <Loader /> : (
                            <Table withTableBorder withColumnBorders style={{ fontSize: 11 }}>
                                <Table.Thead style={{ background: '#1a1a1a' }}>
                                    <Table.Tr>
                                        {['SKU', 'Nama', 'Kategori', 'Satuan', 'Stok', 'Min Stok', 'Max Stok (Kapasitas)', 'Aksi'].map((h: any) => (
                                            <Table.Th key={h} style={{ color: '#fff', fontSize: 11 }}>{h}</Table.Th>
                                        ))}
                                    </Table.Tr>
                                </Table.Thead>
                                <Table.Tbody>
                                    {filtered.map((item: any) => (
                                        <Table.Tr key={item.id}>
                                            <Table.Td>{item.sku}</Table.Td>
                                            <Table.Td fw={600}>{item.nama}</Table.Td>
                                            <Table.Td><Badge size="xs" color={item.kategori === 'Dry' ? 'blue' : item.kategori === 'Wet' ? 'yellow' : 'red'}>{item.kategori}</Badge></Table.Td>
                                            <Table.Td>{item.satuan}</Table.Td>
                                            <Table.Td ta="right" fw={600} style={{ color: item.stok <= (item.min_stok || 0) ? '#e03131' : '#333' }}>{item.stok}</Table.Td>
                                            <Table.Td ta="right">{item.min_stok || 0}</Table.Td>
                                            <Table.Td ta="right">{item.max_stok || 1000}</Table.Td>
                                            <Table.Td>
                                                <Group gap={4}>
                                                    <Button size="xs" color="green" variant="light" style={{ padding: '0 6px' }} onClick={() => openEdit(item)}>✎</Button>
                                                    <Button size="xs" color="red" variant="filled" style={{ padding: '0 6px' }} onClick={() => del(item.id)}>✕</Button>
                                                </Group>
                                            </Table.Td>
                                        </Table.Tr>
                                    ))}
                                </Table.Tbody>
                            </Table>
                        )}
                    </Box>
                )}
            </Box>

            <Modal opened={opened} onClose={close} title={editId ? 'Edit Produk' : 'Tambah Produk'} centered>
                <Stack gap="xs">
                    <TextInput label="SKU" size="xs" value={form.sku} onChange={e => f('sku', e.target.value)} placeholder="Auto jika kosong" />
                    <TextInput label="Nama" size="xs" value={form.nama} onChange={e => f('nama', e.target.value)} />
                    <TextInput label="Satuan" size="xs" value={form.satuan} onChange={e => f('satuan', e.target.value)} placeholder="Kg, Box, Ltr..." />
                    <Select label="Kategori" size="xs" data={['Dry', 'Wet', 'Waste']} value={form.kategori} onChange={v => f('kategori', v)} />
                    <TextInput label="Min Stok" size="xs" type="number" value={form.min_stok} onChange={e => f('min_stok', +e.target.value)} />
                    <TextInput label="Max Stok (Kapasitas)" size="xs" type="number" value={form.max_stok} onChange={e => f('max_stok', +e.target.value)} />
                    <Button fullWidth color="dark" onClick={save}>{editId ? 'Update' : 'Simpan'}</Button>
                </Stack>
            </Modal>
        </Box>
    );
}
