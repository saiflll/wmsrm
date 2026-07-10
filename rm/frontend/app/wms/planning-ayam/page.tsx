'use client';
// @ts-nocheck
import React, { useState, useEffect } from 'react';
import { Box, Group, Button, Title, Text, Badge, Paper, Stack, TextInput, Select, NumberInput, Textarea, ActionIcon, Grid } from '@mantine/core';
import { Table } from '../components/Table';
import { IconPlus, IconEdit, IconTrash, IconMeat } from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import { api, unwrap, fmt } from '../lib/api';

const STATUS_OPTIONS = [
    { value: 'WAIT', label: 'WAIT' },
    { value: 'PROGRESS', label: 'PROGRESS' },
    { value: 'DONE', label: 'DONE' },
    { value: 'CANCEL', label: 'CANCEL' },
];

export default function PlanningAyamPage() {
    const [plans, setPlans] = useState<any[]>([]);
    const [barangs, setBarangs] = useState<any[]>([]);
    const [shifts, setShifts] = useState<any[]>([]);
    const [editId, setEditId] = useState<number | null>(null);
    const [search, setSearch] = useState('');
    const [loading, setLoading] = useState(true);

    const [form, setForm] = useState<any>({
        barang_id: '',
        qty: 0,
        tanggal_planning: '',
        shift_id: '',
        tujuan: '',
        status: 'WAIT',
        keterangan: '',
    });

    const pf = (k: string, v: any) => setForm((p: any) => ({ ...p, [k]: v }));

    useEffect(() => { load(); }, []);

    const load = async () => {
        setLoading(true);
        try {
            const [pRes, bRes, sRes] = await Promise.all([
                api().get('/planning-ayam'),
                api().get('/barang'),
                api().get('/shifts'),
            ]);
            setPlans(unwrap(pRes));
            setBarangs(unwrap(bRes).filter((b: any) => b.nama?.toLowerCase().includes('ayam')));
            setShifts(unwrap(sRes));
        } catch (e) {
            console.error('Load planning ayam failed', e);
        }
        setLoading(false);
    };

    const resetForm = () => {
        setForm({ barang_id: '', qty: 0, tanggal_planning: '', shift_id: '', tujuan: '', status: 'WAIT', keterangan: '' });
        setEditId(null);
    };

    const save = async () => {
        if (!form.barang_id || !form.qty || !form.tanggal_planning) {
            return notifications.show({ title: 'Error', message: 'Barang, qty, dan tanggal planning wajib diisi', color: 'red' });
        }
        try {
            const payload = { ...form, barang_id: +form.barang_id, shift_id: form.shift_id ? +form.shift_id : undefined };
            if (editId) {
                await api().put(`/planning-ayam/${editId}`, payload);
                notifications.show({ title: 'Sukses', message: 'Planning ayam diupdate', color: 'green' });
            } else {
                await api().post('/planning-ayam', payload);
                notifications.show({ title: 'Sukses', message: 'Planning ayam disimpan', color: 'green' });
            }
            resetForm();
            load();
        } catch (e: any) {
            notifications.show({ title: 'Error', message: unwrap(e.response)?.message || 'Gagal menyimpan', color: 'red' });
        }
    };

    const remove = async (id: number) => {
        if (!confirm('Hapus planning ayam ini?')) return;
        try {
            await api().delete(`/planning-ayam/${id}`);
            notifications.show({ title: 'Sukses', message: 'Planning ayam dihapus', color: 'orange' });
            load();
        } catch (e: any) {
            notifications.show({ title: 'Error', message: unwrap(e.response)?.message || 'Gagal menghapus', color: 'red' });
        }
    };

    const barangOpts = barangs.map((b: any) => ({ value: String(b.id), label: `${b.sku || ''} ${b.nama}`.trim() }));
    const shiftOpts = shifts.map((s: any) => ({ value: String(s.id), label: s.name }));

    const filtered = plans.filter((p: any) =>
        !search ||
        p.barang?.nama?.toLowerCase().includes(search.toLowerCase()) ||
        p.tujuan?.toLowerCase().includes(search.toLowerCase()) ||
        p.status?.toLowerCase().includes(search.toLowerCase())
    );

    const statusColor = (s: string) => {
        if (s === 'DONE') return 'green';
        if (s === 'PROGRESS') return 'blue';
        if (s === 'CANCEL') return 'red';
        return 'yellow';
    };

    return (
        <Box>
            <Paper style={{ background: '#fff', borderLeft: '4px solid #be4bdb', padding: '14px 20px', marginBottom: 16, boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                <Title order={4} style={{ color: '#111827', fontWeight: 800, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <IconMeat size={20} style={{ color: '#be4bdb' }} />
                    PLANNING AYAM
                </Title>
            </Paper>

            <Box p="md">
                <Grid gutter="md">
                    <Grid.Col span={{ base: 12, md: 4, lg: 3 }}>
                        <Paper withBorder p="md" radius="md" style={{ background: '#fff' }}>
                            <Stack gap="xs">
                                <Text fw={800} size="sm" c="pink" mb={4} style={{ borderBottom: '1px solid #f1f5f9', paddingBottom: 4 }}>
                                    {editId ? 'EDIT PLANNING AYAM' : 'TAMBAH PLANNING AYAM'}
                                </Text>
                                <Select label="Item Ayam" size="xs" searchable data={barangOpts} value={form.barang_id} onChange={(v) => pf('barang_id', v)} placeholder="Pilih item ayam..." required />
                                <NumberInput label="Qty Planning" size="xs" value={form.qty} onChange={(v) => pf('qty', Number(v))} min={0} required />
                                <TextInput label="Tanggal Planning" size="xs" type="date" value={form.tanggal_planning} onChange={(e) => pf('tanggal_planning', e.target.value)} required />
                                <Select label="Shift" size="xs" clearable data={shiftOpts} value={form.shift_id} onChange={(v) => pf('shift_id', v)} placeholder="Pilih shift..." />
                                <TextInput label="Tujuan" size="xs" placeholder="Produksi Ayam / dll" value={form.tujuan} onChange={(e) => pf('tujuan', e.target.value)} />
                                <Select label="Status" size="xs" data={STATUS_OPTIONS} value={form.status} onChange={(v) => pf('status', v || 'WAIT')} />
                                <Textarea label="Keterangan" size="xs" value={form.keterangan} onChange={(e) => pf('keterangan', e.target.value)} minRows={2} />
                                <Group gap="xs" mt="xs">
                                    <Button size="xs" color="pink" style={{ flex: 1 }} onClick={save} leftSection={<IconPlus size={14} />}>
                                        {editId ? 'Update' : 'Simpan'}
                                    </Button>
                                    {editId && <Button size="xs" color="gray" variant="outline" onClick={resetForm}>Batal</Button>}
                                </Group>
                            </Stack>
                        </Paper>
                    </Grid.Col>

                    <Grid.Col span={{ base: 12, md: 8, lg: 9 }}>
                        <Paper withBorder p="md" radius="md" style={{ background: '#fff' }}>
                            <Group justify="space-between" mb="xs">
                                <TextInput placeholder="Cari item, tujuan, status..." size="xs" value={search} onChange={(e) => setSearch(e.target.value)} style={{ width: 260 }} />
                                <Button size="xs" variant="outline" color="pink" onClick={load}>Refresh</Button>
                            </Group>
                            <Box style={{ overflowX: 'auto' }}>
                                <Table withTableBorder withColumnBorders style={{ fontSize: 11 }}>
                                    <Table.Thead style={{ background: '#333' }}>
                                        <Table.Tr>
                                            {['Item', 'Qty', 'Tgl Planning', 'Shift', 'Tujuan', 'Status', 'Keterangan', 'Aksi'].map((h) => (
                                                <Table.Th key={h} style={{ color: '#fff' }}>{h}</Table.Th>
                                            ))}
                                        </Table.Tr>
                                    </Table.Thead>
                                    <Table.Tbody>
                                        {filtered.map((p: any) => (
                                            <Table.Tr key={p.id}>
                                                <Table.Td fw={700}>{p.barang?.nama || '-'}</Table.Td>
                                                <Table.Td ta="right">{p.qty} {p.satuan}</Table.Td>
                                                <Table.Td>{fmt(p.tanggal_planning)}</Table.Td>
                                                <Table.Td>{p.shift?.name || '-'}</Table.Td>
                                                <Table.Td>{p.tujuan || '-'}</Table.Td>
                                                <Table.Td><Badge size="xs" color={statusColor(p.status)} variant="filled">{p.status}</Badge></Table.Td>
                                                <Table.Td>{p.keterangan || '-'}</Table.Td>
                                                <Table.Td>
                                                    <Group gap={4} wrap="nowrap">
                                                        <ActionIcon size="sm" color="green" variant="light" onClick={() => { setEditId(p.id); setForm({ barang_id: String(p.barang?.id), qty: p.qty, tanggal_planning: p.tanggal_planning ? new Date(p.tanggal_planning).toISOString().split('T')[0] : '', shift_id: p.shift ? String(p.shift.id) : '', tujuan: p.tujuan || '', status: p.status || 'WAIT', keterangan: p.keterangan || '' }); }}>
                                                            <IconEdit size={13} />
                                                        </ActionIcon>
                                                        <ActionIcon size="sm" color="red" variant="light" onClick={() => remove(p.id)}>
                                                            <IconTrash size={13} />
                                                        </ActionIcon>
                                                    </Group>
                                                </Table.Td>
                                            </Table.Tr>
                                        ))}
                                        {filtered.length === 0 && (
                                            <Table.Tr>
                                                <Table.Td colSpan={8} ta="center" c="dimmed">
                                                    {loading ? <Text size="xs">Memuat...</Text> : <Text size="xs">Tidak ada data planning ayam.</Text>}
                                                </Table.Td>
                                            </Table.Tr>
                                        )}
                                    </Table.Tbody>
                                </Table>
                            </Box>
                        </Paper>
                    </Grid.Col>
                </Grid>
            </Box>
        </Box>
    );
}
