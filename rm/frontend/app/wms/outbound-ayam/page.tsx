'use client';
// @ts-nocheck
import React, { useEffect, useState } from 'react';
import { ActionIcon, Badge, Box, Button, Divider, Grid, Group, NumberInput, Paper, Select, Stack, Table, Text, Textarea, TextInput, Title, Tooltip } from '@mantine/core';
import { IconCheck, IconHistory, IconMeat, IconPlayerPlay, IconPlus, IconTrash, IconX } from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import { api, unwrap, fmt } from '../lib/api';

const ALOKASI = ['Produksi Ayam', 'Waste', 'Reject', 'Premix'];

export default function OutboundAyamPage() {
    const [plans, setPlans] = useState<any[]>([]);
    const [outbounds, setOutbounds] = useState<any[]>([]);
    const [shifts, setShifts] = useState<any[]>([]);
    const [selectedPlan, setSelectedPlan] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [posting, setPosting] = useState(false);
    const [search, setSearch] = useState('');
    const [form, setForm] = useState<any>({ planning_ayam_id: '', qty_aktual: 0, tujuan: '', shift_id: '', keterangan: '', alokasi: [] });

    useEffect(() => { load(); }, []);

    const load = async () => {
        setLoading(true);
        try {
            const [p, o, s] = await Promise.all([api().get('/planning-ayam'), api().get('/outbound-ayam'), api().get('/shifts')]);
            setPlans(unwrap(p) || []);
            setOutbounds(unwrap(o) || []);
            setShifts(unwrap(s) || []);
        } catch (e) {
            notifications.show({ title: 'Error', message: 'Gagal memuat outbound ayam', color: 'red' });
        }
        setLoading(false);
    };

    const resetProcess = () => {
        setSelectedPlan(null);
        setForm({ planning_ayam_id: '', qty_aktual: 0, tujuan: '', shift_id: '', keterangan: '', alokasi: [] });
    };

    const openProcess = (plan: any) => {
        setSelectedPlan(plan);
        setForm({
            planning_ayam_id: String(plan.id), qty_aktual: Number(plan.qty || 0),
            tujuan: plan.tujuan || '', shift_id: String(plan.shift_id || plan.shift?.id || ''),
            keterangan: plan.keterangan || '', alokasi: [],
        });
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const setAllocation = (tujuan: string, qty: number) => {
        setForm((p: any) => {
            const next = p.alokasi.filter((a: any) => a.tujuan !== tujuan);
            if (qty > 0) next.push({ tujuan, qty });
            return { ...p, alokasi: next };
        });
    };

    const submitOutbound = async () => {
        if (!selectedPlan || !form.qty_aktual) {
            return notifications.show({ title: 'Error', message: 'Planning dan qty aktual wajib diisi', color: 'red' });
        }
        const allocationTotal = form.alokasi.reduce((n: number, a: any) => n + Number(a.qty || 0), 0);
        if (allocationTotal > Number(form.qty_aktual)) {
            return notifications.show({ title: 'Error', message: 'Total alokasi tidak boleh melebihi qty aktual', color: 'red' });
        }
        if (!confirm(`Posting outbound ${selectedPlan.barang?.nama || ''} sebanyak ${form.qty_aktual} ${selectedPlan.satuan || ''}?`)) return;
        setPosting(true);
        try {
            await api().post('/outbound-ayam', {
                planning_ayam_id: Number(form.planning_ayam_id), qty_aktual: Number(form.qty_aktual),
                tujuan: form.tujuan || undefined, shift_id: form.shift_id ? Number(form.shift_id) : undefined,
                keterangan: form.keterangan || '', alokasi: form.alokasi || [],
            });
            notifications.show({ title: 'Sukses', message: 'Outbound ayam berhasil diproses dan diposting', color: 'green' });
            resetProcess();
            load();
        } catch (e: any) {
            notifications.show({ title: 'Error', message: unwrap(e.response)?.message || 'Gagal memposting outbound ayam', color: 'red' });
        }
        setPosting(false);
    };

    const activePlans = plans.filter((p: any) => ['WAIT', 'PROGRESS', 'PUBLISH_READY'].includes(p.status));
    const filteredPlans = activePlans.filter((p: any) => !search || [p.barang?.nama, p.tujuan, p.status].some(v => v?.toLowerCase().includes(search.toLowerCase())));
    const filteredHistory = outbounds.filter((o: any) => !search || [o.planning_ayam?.barang?.nama, o.tujuan].some(v => v?.toLowerCase().includes(search.toLowerCase())));
    const statusColor = (s: string) => s === 'PROGRESS' ? 'blue' : s === 'PUBLISH_READY' ? 'grape' : 'yellow';
    const allocationTotal = form.alokasi.reduce((n: number, a: any) => n + Number(a.qty || 0), 0);

    return <Box>
        <Box style={{ background: '#fff', borderLeft: '4px solid #f76707', padding: '14px 20px', marginBottom: 16, boxShadow: '0 1px 3px rgba(0,0,0,.05)' }}>
            <Title order={4} style={{ fontWeight: 800, display: 'flex', alignItems: 'center', gap: 8 }}><IconMeat size={20} color="#f76707" /> EKSEKUSI OUTBOUND AYAM</Title>
            <Text size="xs" c="dimmed">Proses realisasi pengeluaran khusus produk ayam berdasarkan Planning Ayam aktif.</Text>
        </Box>
        <Box p="md"><Grid gutter="md">
            <Grid.Col span={{ base: 12, md: 4, lg: 3 }}>
                {selectedPlan ? <Paper withBorder p="md" radius="md"><Stack gap="xs">
                    <Group justify="space-between" style={{ borderBottom: '1px solid #f1f5f9', paddingBottom: 4 }}>
                        <Text fw={800} size="xs" c="orange"><IconCheck size={14} /> PROSES OUTBOUND AYAM</Text>
                        <ActionIcon size="xs" variant="subtle" color="gray" onClick={resetProcess}><IconX size={14} /></ActionIcon>
                    </Group>
                    <Box style={{ background: '#fff4e6', borderRadius: 6, padding: 8 }}>
                        <Text size="xs" fw={800}>{selectedPlan.barang?.nama || '-'}</Text>
                        <Text size="xs">Qty Planning: <b>{selectedPlan.qty} {selectedPlan.satuan}</b></Text>
                        <Text size="xs">Tanggal: <b>{fmt(selectedPlan.tanggal_planning)}</b></Text>
                    </Box>
                    <NumberInput label="Qty Aktual" size="xs" min={1} value={form.qty_aktual} onChange={v => setForm((p: any) => ({ ...p, qty_aktual: Number(v) }))} required />
                    <Text size="xs" c="dimmed">Serapan: <b>{selectedPlan.qty ? Math.round((form.qty_aktual / selectedPlan.qty) * 100) : 0}%</b></Text>
                    <Select label="Shift" size="xs" searchable clearable data={shifts.map((s: any) => ({ value: String(s.id), label: s.name }))} value={form.shift_id} onChange={v => setForm((p: any) => ({ ...p, shift_id: v || '' }))} />
                    <TextInput label="Tujuan Utama" size="xs" value={form.tujuan} onChange={e => setForm((p: any) => ({ ...p, tujuan: e.target.value }))} />
                    <Textarea label="Keterangan" size="xs" value={form.keterangan} onChange={e => setForm((p: any) => ({ ...p, keterangan: e.target.value }))} />
                    <Divider label="Alokasi (opsional)" labelPosition="center" />
                    {ALOKASI.map(t => <NumberInput key={t} label={t} size="xs" min={0} value={form.alokasi.find((a: any) => a.tujuan === t)?.qty || 0} onChange={v => setAllocation(t, Number(v) || 0)} />)}
                    <Text size="xs" c={allocationTotal > form.qty_aktual ? 'red' : 'dimmed'}>Total alokasi: <b>{allocationTotal}</b> / {form.qty_aktual}</Text>
                    <Button color="green" size="xs" onClick={submitOutbound} loading={posting} leftSection={<IconCheck size={14} />}>Selesaikan & Posting</Button>
                </Stack></Paper> : <Paper withBorder p="md" radius="md"><Stack align="center" py="xl" gap="xs">
                    <IconPlayerPlay size={30} color="#adb5bd" /><Text fw={700} size="sm">Pilih Planning Ayam</Text><Text size="xs" c="dimmed" ta="center">Klik ikon proses pada tabel Planning Ayam Aktif. Form proses akan muncul di sini.</Text>
                </Stack></Paper>}
            </Grid.Col>
            <Grid.Col span={{ base: 12, md: 8, lg: 9 }}><Stack gap="md">
                <Paper withBorder p="md" radius="md"><Group justify="space-between" mb="xs"><Text fw={800} size="sm" c="orange">PLANNING AYAM AKTIF ({filteredPlans.length})</Text><TextInput size="xs" placeholder="Cari..." value={search} onChange={e => setSearch(e.target.value)} w={200} /></Group>
                    <Box style={{ overflowX: 'auto' }}><Table withTableBorder withColumnBorders style={{ fontSize: 11 }}><Table.Thead style={{ background: '#333' }}><Table.Tr>{['Item Ayam', 'Qty Planning', 'Tgl Planning', 'Shift', 'Tujuan', 'Status', 'Aksi'].map(h => <Table.Th key={h} style={{ color: '#fff' }}>{h}</Table.Th>)}</Table.Tr></Table.Thead><Table.Tbody>
                        {filteredPlans.map((p: any, i: number) => <Table.Tr key={p.id} style={{ background: i % 2 ? '#f8f9fa' : '#fff' }}><Table.Td fw={700}>{p.barang?.nama || '-'}</Table.Td><Table.Td ta="right">{p.qty} {p.satuan}</Table.Td><Table.Td>{fmt(p.tanggal_planning)}</Table.Td><Table.Td>{p.shift?.name || '-'}</Table.Td><Table.Td>{p.tujuan || '-'}</Table.Td><Table.Td><Badge size="xs" color={statusColor(p.status)}>{p.status}</Badge></Table.Td><Table.Td><Tooltip label="Proses Outbound Ayam"><ActionIcon size="sm" color="green" variant="light" onClick={() => openProcess(p)}><IconCheck size={13} /></ActionIcon></Tooltip></Table.Td></Table.Tr>)}
                        {!filteredPlans.length && <Table.Tr><Table.Td colSpan={7} ta="center" c="dimmed">{loading ? 'Memuat...' : 'Tidak ada planning ayam aktif.'}</Table.Td></Table.Tr>}
                    </Table.Tbody></Table></Box>
                </Paper>
                <Paper withBorder p="md" radius="md"><Group justify="space-between" mb="xs"><Text fw={800} size="sm"><IconHistory size={14} /> RIWAYAT OUTBOUND AYAM</Text><Button size="xs" variant="outline" color="orange" onClick={load}>Refresh</Button></Group>
                    <Box style={{ overflowX: 'auto' }}><Table withTableBorder withColumnBorders style={{ fontSize: 11 }}><Table.Thead style={{ background: '#1a1a1a' }}><Table.Tr>{['Planning', 'Qty Planning', 'Qty Aktual', 'Serapan', 'Tujuan', 'Shift', 'Keterangan'].map(h => <Table.Th key={h} style={{ color: '#fff' }}>{h}</Table.Th>)}</Table.Tr></Table.Thead><Table.Tbody>
                        {filteredHistory.map((o: any, i: number) => { const p = o.planning_ayam; const serapan = p?.qty ? Math.round(o.qty_aktual / p.qty * 100) : 0; return <Table.Tr key={o.id} style={{ background: i % 2 ? '#f8f9fa' : '#fff' }}><Table.Td fw={700}>{p?.barang?.nama || '-'}</Table.Td><Table.Td ta="right">{p?.qty || 0} {p?.satuan}</Table.Td><Table.Td ta="right" fw={700}>{o.qty_aktual} {o.satuan || p?.satuan}</Table.Td><Table.Td><Badge size="xs" color={serapan >= 100 ? 'green' : serapan >= 75 ? 'yellow' : 'red'}>{serapan}%</Badge></Table.Td><Table.Td>{o.tujuan || '-'}{o.alokasi?.length ? ` (${o.alokasi.map((a: any) => `${a.tujuan}:${a.qty}`).join(', ')})` : ''}</Table.Td><Table.Td>{o.shift?.name || '-'}</Table.Td><Table.Td>{o.keterangan || '-'}</Table.Td></Table.Tr> })}
                        {!filteredHistory.length && <Table.Tr><Table.Td colSpan={7} ta="center" c="dimmed">{loading ? 'Memuat...' : 'Tidak ada riwayat outbound ayam.'}</Table.Td></Table.Tr>}
                    </Table.Tbody></Table></Box>
                </Paper>
            </Stack></Grid.Col>
        </Grid></Box>
    </Box>;
}