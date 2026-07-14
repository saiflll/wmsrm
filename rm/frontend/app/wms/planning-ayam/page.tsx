'use client';
// @ts-nocheck
import React, { useState, useEffect, useRef } from 'react';
import { Box, Group, Button, Title, Text, Badge, Paper, Stack, TextInput, Select, NumberInput, Textarea, ActionIcon, Grid, Autocomplete, Tabs, Modal } from '@mantine/core';
import { Table } from '../components/Table';
import { IconPlus, IconEdit, IconTrash, IconMeat, IconCheck, IconPlayerPlay, IconSend, IconX, IconPrinter } from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import { api, unwrap, fmt } from '../lib/api';

const STATUS_OPTIONS = [
    { value: 'WAIT', label: 'WAIT' },
    { value: 'PROGRESS', label: 'PROGRESS' },
    { value: 'PUBLISH_READY', label: 'PUBLISH READY' },
    { value: 'DONE', label: 'DONE' },
    { value: 'CANCEL', label: 'CANCEL' },
];

export default function PlanningAyamPage() {
    const [plans, setPlans] = useState<any[]>([]);
    const [barangs, setBarangs] = useState<any[]>([]);
    const [customers, setCustomers] = useState<any[]>([]);
    const [shifts, setShifts] = useState<any[]>([]);
    const [raks, setRaks] = useState<any[]>([]);
    const [search, setSearch] = useState('');
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<string>('draft');
    const [publishModal, setPublishModal] = useState<{ open: boolean; items: any[]; currentIndex: number }>({ open: false, items: [], currentIndex: 0 });
    const [editingId, setEditingId] = useState<number | null>(null);

    const [form, setForm] = useState<any>({
        barang_id: '',
        qty: 0,
        tanggal_planning: '',
        shift_id: '',
        tujuan: '',
        rak_asal: '',
        status: 'WAIT',
        keterangan: '',
    });

    // Draft system (localStorage persistence)
    const [drafts, setDrafts] = useState<any[]>(() => {
        if (typeof window !== "undefined") {
            try {
                const saved = localStorage.getItem("wms_planning_ayam_drafts");
                return saved ? JSON.parse(saved) : [];
            } catch (e) {}
        }
        return [];
    });
    const draftSavedRef = useRef(false);

    // Persist drafts to localStorage
    useEffect(() => {
        if (!draftSavedRef.current) { draftSavedRef.current = true; return; }
        localStorage.setItem("wms_planning_ayam_drafts", JSON.stringify(drafts));
    }, [drafts]);

    const pf = (k: string, v: any) => setForm((p: any) => ({ ...p, [k]: v }));

    useEffect(() => { load(); }, []);

    const load = async () => {
        setLoading(true);
        try {
            const [pRes, bRes, sRes, cRes] = await Promise.all([
                api().get('/planning-ayam'),
                api().get('/barang'),
                api().get('/shifts'),
                api().get('/customers'),
            ]);
            setPlans(unwrap(pRes));
            setBarangs(unwrap(bRes).filter((b: any) => b.nama?.toLowerCase().includes('ayam')));
            setShifts(unwrap(sRes));
            setCustomers(unwrap(cRes));
        } catch (e) {
            console.error('Load planning ayam failed', e);
        }
        setLoading(false);
    };

    const resetForm = () => {
        setForm({ barang_id: '', qty: 0, tanggal_planning: '', shift_id: '', tujuan: '', rak_asal: '', status: 'WAIT', keterangan: '' });
    };

    // Draft functions
    const addDraft = () => {
        if (!form.barang_id || !form.qty) {
            return notifications.show({ title: 'Error', message: 'Item dan qty wajib diisi', color: 'red' });
        }
        const barang = barangs.find((b: any) => String(b.id) === String(form.barang_id));
        setDrafts(prev => [...prev, {
            ...form,
            id: Date.now(),
            barang_id: Number(form.barang_id),
            qty: Number(form.qty),
            _brg: barang?.nama || '',
            satuan: barang?.satuan || 'kg',
        }]);
        resetForm();
    };

    const editDraft = (idx: number) => {
        const d = drafts[idx];
        setForm({
            barang_id: String(d.barang_id),
            qty: d.qty,
            tanggal_planning: d.tanggal_planning || '',
            shift_id: d.shift_id ? String(d.shift_id) : '',
            tujuan: d.tujuan || '',
            rak_asal: d.rak_asal || '',
            status: d.status || 'WAIT',
            keterangan: d.keterangan || '',
        });
        setDrafts(p => p.filter((_, i) => i !== idx));
    };

    const barangOpts = barangs.map((b: any) => ({ value: String(b.id), label: `${b.sku || ''} ${b.nama}`.trim() }));
    const customerOpts = customers.map((c: any) => c.nama || c.name).filter(Boolean);

    const filtered = plans.filter((p: any) =>
        !search ||
        p.barang?.nama?.toLowerCase().includes(search.toLowerCase()) ||
        p.tujuan?.toLowerCase().includes(search.toLowerCase()) ||
        p.status?.toLowerCase().includes(search.toLowerCase())
    );

    const statusColor = (s: string) => {
        if (s === 'DONE') return 'green';
        if (s === 'PROGRESS') return 'yellow';
        if (s === 'PUBLISH_READY') return 'blue';
        if (s === 'CANCEL') return 'red';
        return 'gray'; // WAIT
    };

    // Status update handlers
    const updateStatus = async (id: number, newStatus: string) => {
        try {
            await api().put(`/planning-ayam/${id}/status`, { status: newStatus });
            notifications.show({ title: 'Sukses', message: `Status diubah ke ${newStatus}`, color: 'green' });
            load();
        } catch (e) {
            notifications.show({ title: 'Error', message: 'Gagal update status', color: 'red' });
        }
    };

    const openPublishModal = () => {
        const readyItems = plans.filter(p => p.status === 'PUBLISH_READY');
        if (readyItems.length === 0) {
            return notifications.show({ title: 'Info', message: 'Tidak ada item PUBLISH_READY', color: 'yellow' });
        }
        setPublishModal({ open: true, items: readyItems, currentIndex: 0 });
    };

    const handlePublishAction = async (status: 'DONE' | 'CANCEL') => {
        const item = publishModal.items[publishModal.currentIndex];
        if (!item) return;
        
        await updateStatus(item.id, status);
        
        if (publishModal.currentIndex < publishModal.items.length - 1) {
            setPublishModal(prev => ({ ...prev, currentIndex: prev.currentIndex + 1 }));
        } else {
            setPublishModal({ open: false, items: [], currentIndex: 0 });
            notifications.show({ title: 'Sukses', message: 'Semua item selesai diproses', color: 'green' });
        }
    };

    return (
        <Box>
            <Paper style={{ background: '#fff', borderLeft: '4px solid #be4bdb', padding: '14px 20px', marginBottom: 16, boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                <Group justify="space-between">
                    <Title order={4} style={{ color: '#111827', fontWeight: 800, display: 'flex', alignItems: 'center', gap: 8 }}>
                        <IconMeat size={20} style={{ color: '#be4bdb' }} />
                        PLANNING AYAM
                    </Title>
                    {plans.filter(p => p.status === 'PUBLISH_READY').length > 0 && (
                        <Button size="xs" color="blue" onClick={openPublishModal} leftSection={<IconSend size={14} />}>
                            Publish ({plans.filter(p => p.status === 'PUBLISH_READY').length})
                        </Button>
                    )}
                </Group>
            </Paper>

            {/* Publish Modal - 1 by 1 */}
            <Modal opened={publishModal.open} onClose={() => setPublishModal({ open: false, items: [], currentIndex: 0 })} title="Publish Planning" size="md">
                {publishModal.items.length > 0 && publishModal.items[publishModal.currentIndex] && (
                    <Stack>
                        <Text size="sm" fw={700}>
                            Item {publishModal.currentIndex + 1} dari {publishModal.items.length}
                        </Text>
                        <Paper withBorder p="md">
                            <Stack gap="xs">
                                <Text size="sm"><b>Item:</b> {publishModal.items[publishModal.currentIndex].barang?.nama}</Text>
                                <Text size="sm"><b>Qty:</b> {publishModal.items[publishModal.currentIndex].qty} {publishModal.items[publishModal.currentIndex].satuan}</Text>
                                <Text size="sm"><b>Tujuan:</b> {publishModal.items[publishModal.currentIndex].tujuan}</Text>
                                <Text size="sm"><b>Tanggal:</b> {fmt(publishModal.items[publishModal.currentIndex].tanggal_planning)}</Text>
                            </Stack>
                        </Paper>
                        <Group justify="flex-end" gap="xs">
                            <Button color="red" variant="light" onClick={() => handlePublishAction('CANCEL')}>
                                Cancel
                            </Button>
                            <Button color="green" onClick={() => handlePublishAction('DONE')}>
                                Done
                            </Button>
                        </Group>
                    </Stack>
                )}
            </Modal>

            <Box p="md">
                <Tabs value={activeTab} onChange={setActiveTab}>
                    <Tabs.List>
                        <Tabs.Tab value="draft">Draft (WAIT/PROGRESS)</Tabs.Tab>
                        <Tabs.Tab value="history">Riwayat (DONE/CANCEL)</Tabs.Tab>
                    </Tabs.List>

                    <Tabs.Panel value="draft" pt="md">
                        <Grid gutter="md">
                            <Grid.Col span={{ base: 12, md: 4, lg: 3 }}>
                                <Paper withBorder p="md" radius="md" style={{ background: '#fff' }}>
                                    <Stack gap="xs">
                                        <Text fw={800} size="sm" c="pink" mb={4} style={{ borderBottom: '1px solid #f1f5f9', paddingBottom: 4 }}>
                                            TAMBAH PLANNING AYAM
                                        </Text>
                                        <Select label="Item Ayam" size="xs" searchable data={barangOpts} value={form.barang_id} onChange={(v) => pf('barang_id', v)} placeholder="Pilih item ayam..." required />
                                        <NumberInput label="Qty Planning" size="xs" value={form.qty} onChange={(v) => pf('qty', Number(v))} min={0} required />
                                        <TextInput label="Tanggal Planning" size="xs" type="date" value={form.tanggal_planning} onChange={(e) => pf('tanggal_planning', e.target.value)} required />
                                        <Autocomplete label="Shift" size="xs" data={shifts.map((s: any) => s.name)} value={shifts.find((s: any) => String(s.id) === form.shift_id)?.name || form.shift_id} onChange={(v) => { const match = shifts.find((s: any) => s.name.toLowerCase() === v.toLowerCase()); pf('shift_id', match ? String(match.id) : v); }} placeholder="Pilih shift..." />
                                        <Autocomplete label="Tujuan" size="xs" data={customerOpts} value={form.tujuan} onChange={(v) => pf('tujuan', v)} placeholder="Produksi Ayam / Customer..." />
                                        <TextInput label="Rak Asal" size="xs" value={form.rak_asal} onChange={(e) => pf('rak_asal', e.target.value)} placeholder="Contoh: A1, B2" />
                                        <Textarea label="Keterangan" size="xs" value={form.keterangan} onChange={(e) => pf('keterangan', e.target.value)} minRows={2} />
                                        <Button fullWidth size="xs" color="grape" variant="light" onClick={addDraft} style={{ fontWeight: 700 }} leftSection={<IconPlus size={14} />}>
                                            + Tambahkan ke Draft
                                        </Button>
                                    </Stack>
                                </Paper>
                            </Grid.Col>

                            <Grid.Col span={{ base: 12, md: 8, lg: 9 }}>
                                {/* Draft Queue */}
                                {drafts.length > 0 && (
                                    <Paper withBorder p="md" radius="md" mb="md" style={{ background: '#fff' }}>
                                        <Group justify="space-between" mb="xs">
                                            <Box>
                                                <Text fw={800} size="sm" c="grape">DRAFT ANTRIAN PLANNING AYAM ({drafts.length})</Text>
                                                <Text size="xs" c="dimmed">Draft akan dipublish dari halaman Outbound Ayam</Text>
                                            </Box>
                                        </Group>
                                        <Box style={{ overflowX: 'auto' }}>
                                            <Table withTableBorder withColumnBorders style={{ fontSize: 11 }}>
                                                <Table.Thead style={{ background: '#333' }}>
                                                    <Table.Tr>
                                                        {['Item', 'Qty', 'Tgl Planning', 'Shift', 'Tujuan', 'Rak Asal', 'Keterangan', 'Aksi'].map((h) => (
                                                            <Table.Th key={h} style={{ color: '#fff' }}>{h}</Table.Th>
                                                        ))}
                                                    </Table.Tr>
                                                </Table.Thead>
                                                <Table.Tbody>
                                                    {drafts.map((d: any, i: number) => (
                                                        <Table.Tr key={d.id || i} style={{ backgroundColor: i % 2 === 0 ? '#fff' : '#f8f9fa' }}>
                                                            <Table.Td fw={700}>{d._brg}</Table.Td>
                                                            <Table.Td ta="right">{d.qty} {d.satuan}</Table.Td>
                                                            <Table.Td>{d.tanggal_planning || '-'}</Table.Td>
                                                            <Table.Td>{shifts.find((s: any) => s.id === d.shift_id)?.name || d.shift_id || '-'}</Table.Td>
                                                            <Table.Td>{d.tujuan || '-'}</Table.Td>
                                                            <Table.Td>{d.rak_asal || '-'}</Table.Td>
                                                            <Table.Td>{d.keterangan || '-'}</Table.Td>
                                                            <Table.Td>
                                                                <Group gap={4} wrap="nowrap">
                                                                    <ActionIcon size="sm" color="green" variant="light" onClick={() => editDraft(i)}>
                                                                        <IconEdit size={13} />
                                                                    </ActionIcon>
                                                                    <ActionIcon size="sm" color="red" variant="light" onClick={() => setDrafts(p => p.filter((_, j) => j !== i))}>
                                                                        <IconTrash size={13} />
                                                                    </ActionIcon>
                                                                </Group>
                                                            </Table.Td>
                                                        </Table.Tr>
                                                    ))}
                                                </Table.Tbody>
                                            </Table>
                                        </Box>
                                    </Paper>
                                )}

                                {/* Existing Plans Table - WAIT & PROGRESS */}
                                <Paper withBorder p="md" radius="md" style={{ background: '#fff' }}>
                                    <Group justify="space-between" mb="xs">
                                        <Text fw={800} size="sm">PLANNING AYAM AKTIF</Text>
                                        <Group gap="xs">
                                            <TextInput placeholder="Cari item, tujuan, status..." size="xs" value={search} onChange={(e) => setSearch(e.target.value)} style={{ width: 260 }} />
                                            <Button size="xs" variant="outline" color="pink" onClick={load}>Refresh</Button>
                                        </Group>
                                    </Group>
                                    <Box style={{ overflowX: 'auto' }}>
                                        <Table withTableBorder withColumnBorders style={{ fontSize: 11 }}>
                                            <Table.Thead style={{ background: '#333' }}>
                                                <Table.Tr>
                                                    {['Item', 'Qty', 'Tgl Planning', 'Shift', 'Tujuan', 'Rak Asal', 'Status', 'Keterangan', 'Aksi'].map((h) => (
                                                        <Table.Th key={h} style={{ color: '#fff' }}>{h}</Table.Th>
                                                    ))}
                                                </Table.Tr>
                                            </Table.Thead>
                                            <Table.Tbody>
                                                {filtered.filter(p => p.status === 'WAIT' || p.status === 'PROGRESS').map((p: any, idx: number) => (
                                                    <Table.Tr key={p.id} style={{ backgroundColor: idx % 2 === 0 ? '#fff' : '#f8f9fa' }}>
                                                        <Table.Td fw={700}>{p.barang?.nama || '-'}</Table.Td>
                                                        <Table.Td ta="right">{p.qty} {p.satuan}</Table.Td>
                                                        <Table.Td>{fmt(p.tanggal_planning)}</Table.Td>
                                                        <Table.Td>{p.shift?.name || '-'}</Table.Td>
                                                        <Table.Td>{p.tujuan || '-'}</Table.Td>
                                                        <Table.Td>{p.rak_asal || '-'}</Table.Td>
                                                        <Table.Td><Badge size="xs" color={statusColor(p.status)} variant="filled">{p.status}</Badge></Table.Td>
                                                        <Table.Td>{p.keterangan || '-'}</Table.Td>
                                                        <Table.Td>
                                                            <Group gap={4} wrap="nowrap">
                                                                {p.status === 'WAIT' && (
                                                                    <ActionIcon size="sm" color="yellow" variant="light" onClick={() => updateStatus(p.id, 'PROGRESS')} title="Ubah ke PROGRESS">
                                                                        <IconPlayerPlay size={13} />
                                                                    </ActionIcon>
                                                                )}
                                                                {p.status === 'PROGRESS' && (
                                                                    <ActionIcon size="sm" color="blue" variant="light" onClick={() => updateStatus(p.id, 'PUBLISH_READY')} title="Publish">
                                                                        <IconSend size={13} />
                                                                    </ActionIcon>
                                                                )}
                                                            </Group>
                                                        </Table.Td>
                                                    </Table.Tr>
                                                ))}
                                                {filtered.filter(p => p.status === 'WAIT' || p.status === 'PROGRESS').length === 0 && (
                                                    <Table.Tr>
                                                        <Table.Td colSpan={9} ta="center" c="dimmed">
                                                            {loading ? <Text size="xs">Memuat...</Text> : <Text size="xs">Tidak ada planning aktif.</Text>}
                                                        </Table.Td>
                                                    </Table.Tr>
                                                )}
                                            </Table.Tbody>
                                        </Table>
                                    </Box>
                                </Paper>
                            </Grid.Col>
                        </Grid>
                    </Tabs.Panel>

                    <Tabs.Panel value="history" pt="md">
                        {/* History - DONE & CANCEL (print only) */}
                        <Paper withBorder p="md" radius="md" style={{ background: '#fff' }}>
                            <Group justify="space-between" mb="xs">
                                <Text fw={800} size="sm">RIWAYAT PLANNING AYAM</Text>
                                <Group gap="xs">
                                    <TextInput placeholder="Cari item, tujuan, status..." size="xs" value={search} onChange={(e) => setSearch(e.target.value)} style={{ width: 260 }} />
                                    <Button size="xs" variant="outline" color="pink" onClick={load}>Refresh</Button>
                                </Group>
                            </Group>
                            <Box style={{ overflowX: 'auto' }}>
                                <Table withTableBorder withColumnBorders style={{ fontSize: 11 }}>
                                    <Table.Thead style={{ background: '#333' }}>
                                        <Table.Tr>
                                            {['Item', 'Qty', 'Tgl Planning', 'Shift', 'Tujuan', 'Rak Asal', 'Status', 'Keterangan', 'Print'].map((h) => (
                                                <Table.Th key={h} style={{ color: '#fff' }}>{h}</Table.Th>
                                            ))}
                                        </Table.Tr>
                                    </Table.Thead>
                                    <Table.Tbody>
                                        {filtered.filter(p => p.status === 'DONE' || p.status === 'CANCEL').map((p: any, idx: number) => (
                                            <Table.Tr key={p.id} style={{ backgroundColor: idx % 2 === 0 ? '#fff' : '#f8f9fa' }}>
                                                <Table.Td fw={700}>{p.barang?.nama || '-'}</Table.Td>
                                                <Table.Td ta="right">{p.qty} {p.satuan}</Table.Td>
                                                <Table.Td>{fmt(p.tanggal_planning)}</Table.Td>
                                                <Table.Td>{p.shift?.name || '-'}</Table.Td>
                                                <Table.Td>{p.tujuan || '-'}</Table.Td>
                                                <Table.Td>{p.rak_asal || '-'}</Table.Td>
                                                <Table.Td><Badge size="xs" color={statusColor(p.status)} variant="filled">{p.status}</Badge></Table.Td>
                                                <Table.Td>{p.keterangan || '-'}</Table.Td>
                                                <Table.Td>
                                                    <ActionIcon size="sm" color="blue" variant="light" title="Print">
                                                        <IconPrinter size={13} />
                                                    </ActionIcon>
                                                </Table.Td>
                                            </Table.Tr>
                                        ))}
                                        {filtered.filter(p => p.status === 'DONE' || p.status === 'CANCEL').length === 0 && (
                                            <Table.Tr>
                                                <Table.Td colSpan={9} ta="center" c="dimmed">
                                                    {loading ? <Text size="xs">Memuat...</Text> : <Text size="xs">Tidak ada riwayat.</Text>}
                                                </Table.Td>
                                            </Table.Tr>
                                        )}
                                    </Table.Tbody>
                                </Table>
                            </Box>
                        </Paper>
                    </Tabs.Panel>
                </Tabs>
            </Box>
        </Box>
    );
}
