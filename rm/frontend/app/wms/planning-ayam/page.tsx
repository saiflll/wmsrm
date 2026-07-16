'use client';
// @ts-nocheck
import React, { useEffect, useState } from 'react';
import { ActionIcon, Autocomplete, Badge, Box, Button, Grid, Group, NumberInput, Paper, Select, Stack, Table, Text, Textarea, TextInput, Title, Tooltip } from '@mantine/core';
import { IconBuildingWarehouse, IconEdit, IconMeat, IconPlus, IconTrash, IconX } from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import { api, unwrap, fmt } from '../lib/api';

export default function PlanningAyamPage() {
    const [plans, setPlans] = useState<any[]>([]);
    const [barangs, setBarangs] = useState<any[]>([]);
    const [customers, setCustomers] = useState<any[]>([]);
    const [shifts, setShifts] = useState<any[]>([]);
    const [gudangs, setGudangs] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [editId, setEditId] = useState<number | null>(null);
    const [search, setSearch] = useState('');
    const [form, setForm] = useState<any>({
        barang_id: '', qty: 1, tanggal_planning: new Date().toISOString().split('T')[0],
        shift_id: '', tujuan: '', rak_asal: '', keterangan: '', status: 'WAIT',
    });

    useEffect(() => { load(); }, []);

    const load = async () => {
        setLoading(true);
        try {
            const [p, b, c, s, g] = await Promise.all([
                api().get('/planning-ayam'), api().get('/barang'), api().get('/customers'),
                api().get('/shifts'), api().get('/gudang'),
            ]);
            setPlans(unwrap(p) || []);
            setBarangs((unwrap(b) || []).filter((x: any) =>
                x.nama?.toLowerCase().includes('ayam') || x.kategori?.toLowerCase().includes('ayam')
            ));
            setCustomers(unwrap(c) || []);
            setShifts(unwrap(s) || []);
            setGudangs(unwrap(g) || []);
        } catch (e) {
            notifications.show({ title: 'Error', message: 'Gagal memuat planning ayam', color: 'red' });
        }
        setLoading(false);
    };

    const resetForm = () => {
        setEditId(null);
        setForm({ barang_id: '', qty: 1, tanggal_planning: new Date().toISOString().split('T')[0], shift_id: '', tujuan: '', rak_asal: '', keterangan: '', status: 'WAIT' });
    };

    const submit = async () => {
        if (!form.barang_id || !form.qty || !form.tanggal_planning) {
            return notifications.show({ title: 'Error', message: 'Item, qty, dan tanggal wajib diisi', color: 'red' });
        }
        setSaving(true);
        const barang = barangs.find((b: any) => String(b.id) === String(form.barang_id));
        const payload = {
            ...form,
            barang_id: Number(form.barang_id), qty: Number(form.qty),
            shift_id: form.shift_id ? Number(form.shift_id) : undefined,
            satuan: barang?.satuan || 'kg', status: form.status || 'WAIT',
        };
        try {
            if (editId) await api().put(`/planning-ayam/${editId}`, payload);
            else await api().post('/planning-ayam', payload);
            notifications.show({ title: 'Sukses', message: editId ? 'Planning ayam diperbarui' : 'Planning ayam disimpan', color: 'green' });
            resetForm();
            load();
        } catch (e: any) {
            notifications.show({ title: 'Error', message: unwrap(e.response)?.message || 'Gagal menyimpan planning ayam', color: 'red' });
        }
        setSaving(false);
    };

    const editPlan = (p: any) => {
        setEditId(p.id);
        setForm({
            barang_id: String(p.barang_id || p.barang?.id || ''), qty: Number(p.qty || 1),
            tanggal_planning: p.tanggal_planning?.slice(0, 10) || '',
            shift_id: String(p.shift_id || p.shift?.id || ''), tujuan: p.tujuan || '',
            rak_asal: p.rak_asal || '', keterangan: p.keterangan || '', status: p.status || 'WAIT',
        });
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const deletePlan = async (id: number) => {
        if (!confirm('Hapus planning ayam ini?')) return;
        try {
            await api().delete(`/planning-ayam/${id}`);
            notifications.show({ title: 'Sukses', message: 'Planning ayam dihapus', color: 'green' });
            if (editId === id) resetForm();
            load();
        } catch (e) {
            notifications.show({ title: 'Error', message: 'Gagal menghapus planning ayam', color: 'red' });
        }
    };

    const statusColor = (s: string) => s === 'DONE' ? 'green' : s === 'CANCEL' ? 'red' : s === 'PROGRESS' ? 'blue' : s === 'PUBLISH_READY' ? 'grape' : 'yellow';
    const matches = (p: any) => !search || [p.barang?.nama, p.tujuan, p.status].some(v => v?.toLowerCase().includes(search.toLowerCase()));
    const activePlans = plans.filter((p: any) => ['WAIT', 'PROGRESS', 'PUBLISH_READY'].includes(p.status) && matches(p));
    const donePlans = plans.filter((p: any) => ['DONE', 'CANCEL'].includes(p.status) && matches(p));
    const barangOpts = barangs.map((b: any) => ({ value: String(b.id), label: b.sku ? `${b.sku} - ${b.nama}` : b.nama }));
    const shiftOpts = shifts.map((s: any) => ({ value: String(s.id), label: s.name }));
    const customerOpts = customers.map((c: any) => c.nama || c.name).filter(Boolean);
    const rakOpts = Array.from(new Set(gudangs.map((g: any) => g.name).filter(Boolean)));

    const PlanningTable = ({ rows, history = false }: any) => (
        <Box style={{ overflowX: 'auto' }}>
            <Table withTableBorder withColumnBorders style={{ fontSize: 11 }}>
                <Table.Thead style={{ background: '#1a1a1a' }}><Table.Tr>
                    {['Item Ayam', 'Qty', 'Tgl Planning', 'Shift', 'Tujuan', 'Rak Asal', 'Status', 'Keterangan', ...(history ? [] : ['Aksi'])].map(h => <Table.Th key={h} style={{ color: '#fff' }}>{h}</Table.Th>)}
                </Table.Tr></Table.Thead>
                <Table.Tbody>
                    {rows.map((p: any, i: number) => <Table.Tr key={p.id} style={{ background: i % 2 ? '#f8f9fa' : '#fff' }}>
                        <Table.Td fw={700}>{p.barang?.nama || '-'}</Table.Td><Table.Td ta="right">{p.qty} {p.satuan}</Table.Td>
                        <Table.Td>{fmt(p.tanggal_planning)}</Table.Td><Table.Td>{p.shift?.name || '-'}</Table.Td>
                        <Table.Td>{p.tujuan || '-'}</Table.Td><Table.Td>{p.rak_asal || '-'}</Table.Td>
                        <Table.Td><Badge size="xs" color={statusColor(p.status)}>{p.status}</Badge></Table.Td><Table.Td>{p.keterangan || '-'}</Table.Td>
                        {!history && <Table.Td><Group gap={4} wrap="nowrap">
                            <Tooltip label="Edit"><ActionIcon size="sm" color="blue" variant="light" onClick={() => editPlan(p)}><IconEdit size={13} /></ActionIcon></Tooltip>
                            <Tooltip label="Hapus"><ActionIcon size="sm" color="red" variant="light" onClick={() => deletePlan(p.id)}><IconTrash size={13} /></ActionIcon></Tooltip>
                        </Group></Table.Td>}
                    </Table.Tr>)}
                    {!rows.length && <Table.Tr><Table.Td colSpan={history ? 8 : 9} ta="center" c="dimmed">{loading ? 'Memuat...' : 'Tidak ada data.'}</Table.Td></Table.Tr>}
                </Table.Tbody>
            </Table>
        </Box>
    );

    return <Box>
        <Box style={{ background: '#fff', borderLeft: '4px solid #be4bdb', padding: '14px 20px', marginBottom: 16, boxShadow: '0 1px 3px rgba(0,0,0,.05)' }}>
            <Title order={4} style={{ fontWeight: 800, display: 'flex', alignItems: 'center', gap: 8 }}><IconMeat size={20} color="#be4bdb" /> PLANNING OUTBOUND AYAM</Title>
            <Text size="xs" c="dimmed">Perencanaan pengeluaran khusus produk ayam sebelum diproses pada Outbound Ayam.</Text>
        </Box>
        <Box p="md"><Grid gutter="md">
            <Grid.Col span={{ base: 12, md: 4, lg: 3 }}><Paper withBorder p="md" radius="md"><Stack gap="xs">
                <Group justify="space-between"><Text fw={800} size="sm" c="grape">{editId ? 'EDIT PLANNING AYAM' : 'BUAT PLANNING AYAM'}</Text>{editId && <ActionIcon size="sm" variant="subtle" color="gray" onClick={resetForm}><IconX size={14} /></ActionIcon>}</Group>
                <Select label="Item Ayam" size="xs" searchable data={barangOpts} value={form.barang_id} onChange={v => setForm((p: any) => ({ ...p, barang_id: v || '' }))} required />
                <NumberInput label="Qty Planning" size="xs" min={1} value={form.qty} onChange={v => setForm((p: any) => ({ ...p, qty: Number(v) }))} required />
                <TextInput label="Tanggal Planning" type="date" size="xs" value={form.tanggal_planning} onChange={e => setForm((p: any) => ({ ...p, tanggal_planning: e.target.value }))} required />
                <Select label="Shift" size="xs" data={shiftOpts} value={form.shift_id} onChange={v => setForm((p: any) => ({ ...p, shift_id: v || '' }))} searchable clearable />
                <Autocomplete label="Tujuan" size="xs" data={customerOpts} value={form.tujuan} onChange={v => setForm((p: any) => ({ ...p, tujuan: v }))} />
                <Autocomplete label="Rak Asal" size="xs" data={rakOpts} value={form.rak_asal} onChange={v => setForm((p: any) => ({ ...p, rak_asal: v }))} />
                <Textarea label="Keterangan" size="xs" value={form.keterangan} onChange={e => setForm((p: any) => ({ ...p, keterangan: e.target.value }))} />
                <Button size="xs" color="grape" onClick={submit} loading={saving} leftSection={editId ? <IconEdit size={14} /> : <IconPlus size={14} />}>{editId ? 'Simpan Perubahan' : 'Simpan Planning'}</Button>
                {editId && <Button size="xs" variant="subtle" color="gray" onClick={resetForm}>Batal Edit</Button>}
            </Stack></Paper></Grid.Col>
            <Grid.Col span={{ base: 12, md: 8, lg: 9 }}><Stack gap="md">
                <Paper withBorder p="md" radius="md"><Group justify="space-between" mb="xs"><Text fw={800} size="sm" c="grape">PLANNING AYAM AKTIF ({activePlans.length})</Text><TextInput size="xs" placeholder="Cari..." value={search} onChange={e => setSearch(e.target.value)} w={200} /></Group><PlanningTable rows={activePlans} /></Paper>
                <Paper withBorder p="md" radius="md"><Text fw={800} size="sm" mb="xs">RIWAYAT PLANNING AYAM SELESAI ({donePlans.length})</Text><PlanningTable rows={donePlans} history /></Paper>
            </Stack></Grid.Col>
        </Grid></Box>
    </Box>;
}
