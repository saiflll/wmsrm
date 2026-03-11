'use client';
// @ts-nocheck
import {
    ActionIcon,
    Badge,
    Button,
    Container,
    Group,
    Modal,
    NumberInput,
    Select,
    Table,
    TextInput,
    Title,
    Menu,
    rem,
    Text,
    Stack,
    Box,
    SimpleGrid,
    Paper
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import {
    IconDeviceFloppy,
    IconPlus,
    IconTrash,
    IconEdit,
    IconDownload,
    IconArrowsExchange
} from '@tabler/icons-react';
import axios from 'axios';
import React, { useEffect, useState } from 'react';
import * as XLSX from 'xlsx';

const API_URL = 'http://localhost:3001';

interface Barang {
    id: number;
    sku: string;
    nama: string;
    satuan: string;
    satuan_kecil: string;
    faktor_konversi: number;
    side: boolean;
    stok: number;
}

export default function BarangPage() {
    const [items, setItems] = useState<Barang[]>([]);
    const [opened, { open, close }] = useDisclosure(false);
    const [editOpened, { open: openEdit, close: closeEdit }] = useDisclosure(false);
    const [formData, setFormData] = useState({
        sku: '',
        nama: '',
        satuan: '',
        satuan_kecil: '',
        faktor_konversi: 1,
        side: '1',
        stok: 0
    });
    const [editingItem, setEditingItem] = useState<Barang | null>(null);
    const [token, setToken] = useState('');

    useEffect(() => {
        const storedToken = localStorage.getItem('token');
        if (storedToken) setToken(storedToken);
        fetchData(storedToken);
    }, []);

    const fetchData = async (t: string | null) => {
        if (!t) return;
        try {
            const res = await axios.get(`${API_URL}/barang`, {
                headers: { Authorization: `Bearer ${t}` }
            });
            setItems(res.data);
        } catch (e) {
            console.error(e);
        }
    };

    const handleSave = async () => {
        try {
            await axios.post(`${API_URL}/barang`, {
                ...formData,
                side: formData.side === '1'
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });
            notifications.show({ title: 'Sukses', message: 'Barang berhasil disimpan', color: 'green' });
            resetForm();
            close();
            fetchData(token);
        } catch (e) {
            notifications.show({ title: 'Gagal', message: 'Terjadi kesalahan saat menyimpan', color: 'red' });
        }
    };

    const handleUpdate = async () => {
        if (!editingItem) return;
        try {
            await axios.put(`${API_URL}/barang/${editingItem.id}`, {
                ...formData,
                side: formData.side === '1'
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });
            notifications.show({ title: 'Sukses', message: 'Barang berhasil diperbarui', color: 'green' });
            closeEdit();
            fetchData(token);
        } catch (e) {
            notifications.show({ title: 'Gagal', message: 'Terjadi kesalahan saat memperbarui', color: 'red' });
        }
    };

    const handleDelete = async (id: number) => {
        if (!confirm('Yakin ingin menghapus barang ini?')) return;
        try {
            await axios.delete(`${API_URL}/barang/${id}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            notifications.show({ title: 'Sukses', message: 'Barang berhasil dihapus', color: 'green' });
            fetchData(token);
        } catch (e) {
            notifications.show({ title: 'Gagal', message: 'Terjadi kesalahan saat menghapus', color: 'red' });
        }
    };

    const startEdit = (item: Barang) => {
        setEditingItem(item);
        setFormData({
            sku: item.sku || '',
            nama: item.nama,
            satuan: item.satuan,
            satuan_kecil: item.satuan_kecil || '',
            faktor_konversi: item.faktor_konversi || 1,
            side: item.side ? '1' : '0',
            stok: item.stok
        });
        openEdit();
    };

    const resetForm = () => {
        setFormData({
            sku: '',
            nama: '',
            satuan: '',
            satuan_kecil: '',
            faktor_konversi: 1,
            side: '1',
            stok: 0
        });
    };

    const handleExport = () => {
        const dateStr = new Date().toISOString().split('T')[0];
        const worksheet = XLSX.utils.json_to_sheet(items);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Inventory");
        const wbout: string = XLSX.write(workbook, { bookType: 'xlsx', type: 'base64' });
        const a = document.createElement('a');
        a.href = `data:application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;base64,${wbout}`;
        a.download = `Inventory_Data_${dateStr}.xlsx`;
        a.style.display = 'none';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    };

    return (
        <Stack gap="lg">
            <Group justify="space-between">
                <Title order={2}>Inventory & Kartu Stok</Title>
                <Group>
                    <Button variant="light" color="green" leftSection={<IconDownload size={18} />} onClick={handleExport}>
                        Export to Excel
                    </Button>
                    <Button onClick={open} leftSection={<IconPlus size={18} />}>Tambah Barang</Button>
                </Group>
            </Group>

            <Paper withBorder p="0">
                <Table highlightOnHover verticalSpacing="sm">
                    <Table.Thead bg="gray.0">
                        <Table.Tr>
                            <Table.Th>SKU</Table.Th>
                            <Table.Th>Nama Barang</Table.Th>
                            <Table.Th>Konversi Satuan</Table.Th>
                            <Table.Th>Tipe</Table.Th>
                            <Table.Th>Stok (Besar)</Table.Th>
                            <Table.Th>Aksi</Table.Th>
                        </Table.Tr>
                    </Table.Thead>
                    <Table.Tbody>
                        {items.map((item: Barang) => (
                            <Table.Tr key={item.id}>
                                <Table.Td><Text fw={700}>{item.sku}</Text></Table.Td>
                                <Table.Td>{item.nama}</Table.Td>
                                <Table.Td>
                                    <Text size="sm">1 {item.satuan} = {item.faktor_konversi} {item.satuan_kecil}</Text>
                                </Table.Td>
                                <Table.Td>
                                    <Badge color={item.side ? 'orange' : 'blue'}>{item.side ? 'Dry' : 'Wet'}</Badge>
                                </Table.Td>
                                <Table.Td><Text fw={700} size="md">{item.stok} {item.satuan}</Text></Table.Td>
                                <Table.Td>
                                    <Group gap="xs">
                                        <ActionIcon color="blue" variant="light" onClick={() => startEdit(item)}>
                                            <IconEdit size={16} />
                                        </ActionIcon>
                                        <ActionIcon color="red" variant="light" onClick={() => handleDelete(item.id)}>
                                            <IconTrash size={16} />
                                        </ActionIcon>
                                    </Group>
                                </Table.Td>
                            </Table.Tr>
                        ))}
                    </Table.Tbody>
                </Table>
            </Paper>

            {/* Modal Tambah & Edit */}
            <Modal opened={opened || editOpened} onClose={opened ? close : closeEdit} title={opened ? "Tambah Barang Baru" : "Edit Barang"} centered size="lg">
                <SimpleGrid cols={2} spacing="md">
                    <TextInput label="SKU" placeholder="SKU-XXX" required value={formData.sku} onChange={(e) => setFormData({ ...formData, sku: e.target.value })} />
                    <TextInput label="Nama Barang" placeholder="Contoh: Beras" required value={formData.nama} onChange={(e) => setFormData({ ...formData, nama: e.target.value })} />

                    <TextInput label="Satuan Besar" placeholder="Karung, Pack, Box" required value={formData.satuan} onChange={(e) => setFormData({ ...formData, satuan: e.target.value })} />
                    <TextInput label="Satuan Kecil" placeholder="kg, gram, pcs" required value={formData.satuan_kecil} onChange={(e) => setFormData({ ...formData, satuan_kecil: e.target.value })} />

                    <NumberInput label="Faktor Konversi" value={formData.faktor_konversi} onChange={(val) => setFormData({ ...formData, faktor_konversi: Number(val) })} />
                    <Select label="Tipe Gudang" data={[{ value: '1', label: 'Dry' }, { value: '0', label: 'Wet' }]} value={formData.side} onChange={(val) => setFormData({ ...formData, side: val })} />

                    <NumberInput label="Stok (Satuan Besar)" value={formData.stok} onChange={(val) => setFormData({ ...formData, stok: Number(val) })} />
                </SimpleGrid>

                <Button fullWidth mt="xl" onClick={opened ? handleSave : handleUpdate} leftSection={<IconDeviceFloppy size={18} />}>
                    {opened ? 'Simpan Barang' : 'Simpan Perubahan'}
                </Button>
            </Modal>
        </Stack>
    );
}
