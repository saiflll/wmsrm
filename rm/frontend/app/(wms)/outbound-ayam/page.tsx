'use client';
// @ts-nocheck
import React, { useEffect, useState } from 'react';
import { ActionIcon, Badge, Box, Button, Divider, Grid, Group, Loader, NumberInput, Paper, Select, Stack, Table, Text, Textarea, TextInput, Title, Tooltip } from '@mantine/core';
import { IconCheck, IconHistory, IconMeat, IconPlayerPlay, IconPlus, IconTrash, IconX } from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import { api, unwrap, fmt, dedup } from '../lib/api';



export default function OutboundAyamPage() {
    const [plans, setPlans] = useState<any[]>([]);
    const [outbounds, setOutbounds] = useState<any[]>([]);
    const [shifts, setShifts] = useState<any[]>([]);
    const [selectedPlan, setSelectedPlan] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [posting, setPosting] = useState(false);
    const [search, setSearch] = useState('');
    const [form, setForm] = useState<any>({ planning_ayam_id: '', qty_aktual: 0, tujuan: '', shift_id: '', keterangan: '', alokasi: [], qty_terserap: 0, qty_waste: 0 });

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
        setForm({ planning_ayam_id: '', qty_aktual: 0, tujuan: '', shift_id: '', keterangan: '', alokasi: [], qty_terserap: 0, qty_waste: 0 });
    };

    const openProcess = (plan: any) => {
        setSelectedPlan(plan);
        setForm({
            planning_ayam_id: String(plan.id), qty_aktual: Number(plan.qty || 0),
            tujuan: plan.tujuan || '', shift_id: String(plan.shift_id || plan.shift?.id || ''),
            keterangan: plan.keterangan || '', alokasi: [], qty_terserap: 0, qty_waste: 0,
        });
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const rejectPlan = async (plan: any) => {
        if (!confirm(`Reject / batalkan planning ayam untuk ${plan.barang?.nama || 'item ini'}?`)) return;
        try {
            await api().put(`/planning-ayam/${plan.id}/status`, { status: 'CANCEL' });
            notifications.show({ title: 'Sukses', message: 'Planning ayam berhasil di-reject', color: 'green' });
            if (selectedPlan?.id === plan.id) resetProcess();
            load();
        } catch (e: any) {
            notifications.show({ title: 'Error', message: unwrap(e.response)?.message || 'Gagal me-reject planning ayam', color: 'red' });
        }
    };

    const submitOutbound = async () => {
        if (!selectedPlan || !form.qty_aktual) {
            return notifications.show({ title: 'Error', message: 'Planning dan qty aktual wajib diisi', color: 'red' });
        }
        const qtyTerserap = Number(form.qty_terserap) || 0;
        const qtyWaste = Number(form.qty_waste) || 0;
        const qtyReject = Math.max(0, Number(form.qty_aktual) - qtyTerserap - qtyWaste);
        if (qtyTerserap + qtyWaste > Number(form.qty_aktual)) {
            return notifications.show({ title: 'Error', message: 'Terserap + Waste tidak boleh melebihi qty aktual', color: 'red' });
        }
        const alokasiPayload = [
            { tujuan: 'Terserap', qty: qtyTerserap },
            { tujuan: 'Waste', qty: qtyWaste },
            ...(qtyReject > 0 ? [{ tujuan: 'Reject', qty: qtyReject }] : []),
        ];
        if (!confirm(`Posting outbound ${selectedPlan.barang?.nama || ''} — Terserap ${qtyTerserap}, Waste ${qtyWaste}, Reject ${qtyReject} ${selectedPlan.satuan || ''}?`)) return;
        setPosting(true);
        try {
            await api().post('/outbound-ayam', {
                planning_ayam_id: Number(form.planning_ayam_id), qty_aktual: Number(form.qty_aktual),
                tujuan: form.tujuan || undefined, shift_id: form.shift_id ? Number(form.shift_id) : undefined,
                keterangan: form.keterangan || '', alokasi: alokasiPayload,
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

    const EmptyState = ({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) => (
        <Box style={{ textAlign: 'center', padding: '60px 20px', opacity: 0.6 }}>
            <Box style={{ fontSize: 48, marginBottom: 16 }}>{icon}</Box>
            <Text fw={700} size="lg" mb={4}>{title}</Text>
            <Text size="sm" c="dimmed">{description}</Text>
        </Box>
    );

    if (loading) return (
        <Box style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh' }}>
            <Loader size="lg" />
        </Box>
    );

    return (
        <Box>
        <Box style={{ background: '#fff', borderLeft: '4px solid #f76707', padding: '14px 20px', marginBottom: 16, boxShadow: '0 1px 3px rgba(0,0,0,.05)' }}>
            <Title order={4} style={{ fontWeight: 800, display: 'flex', alignItems: 'center', gap: 8 }}><IconMeat size={20} color="#f76707" /> EKSEKUSI OUTBOUND AYAM</Title>
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
                    <Text size="xs" c="dimmed">Serapan: <b style={{ color: selectedPlan.qty ? (Math.round((form.qty_terserap / selectedPlan.qty) * 100) >= 50 ? 'green' : 'red') : '#999' }}>{selectedPlan.qty ? Math.round((form.qty_terserap / selectedPlan.qty) * 100) : 0}%</b> (Terserap/{selectedPlan.qty})</Text>
                    <Select label="Shift" size="xs" searchable clearable data={dedup(shifts.map((s: any) => ({ value: String(s.id), label: s.name })))} value={form.shift_id} onChange={v => setForm((p: any) => ({ ...p, shift_id: v || '' }))} />
                    <TextInput label="Tujuan Utama" size="xs" value={form.tujuan} onChange={e => setForm((p: any) => ({ ...p, tujuan: e.target.value }))} />
                    <Textarea label="Keterangan" size="xs" value={form.keterangan} onChange={e => setForm((p: any) => ({ ...p, keterangan: e.target.value }))} />
                    <Divider label="Alokasi" labelPosition="center" />
                    <Group gap="xs" grow>
                        <NumberInput label="Terserap" size="xs" min={0} value={form.qty_terserap} onChange={v => setForm((p: any) => ({ ...p, qty_terserap: Number(v) || 0 }))} />
                        <NumberInput label="Waste" size="xs" min={0} value={form.qty_waste} onChange={v => setForm((p: any) => ({ ...p, qty_waste: Number(v) || 0 }))} />
                    </Group>
                    {(() => {
                        const qtyReject = Math.max(0, Number(form.qty_aktual || 0) - Number(form.qty_terserap || 0) - Number(form.qty_waste || 0));
                        const total = Number(form.qty_aktual) || 1;
                        const pT = Math.round((form.qty_terserap || 0) / total * 100);
                        const pW = Math.round((form.qty_waste || 0) / total * 100);
                        const pR = Math.round(qtyReject / total * 100);
                        const segments = [
                            { label: 'Terserap', pct: pT, color: '#2f9e44' },
                            { label: 'Waste', pct: pW, color: '#f76707' },
                            { label: 'Reject', pct: pR, color: '#e03131' },
                        ].filter(s => s.pct > 0);
                        return <>
                            <Text size="xs" c="dimmed">Reject: <b>{qtyReject}</b> (sisa otomatis)</Text>
                            {segments.length > 0 && (
                                <Box style={{ display: 'flex', height: 20, borderRadius: 4, overflow: 'hidden', marginTop: 2, border: '1px solid #dee2e6' }}>
                                    {segments.map(s => (
                                        <Tooltip key={s.label} label={`${s.label}: ${s.pct}%`}>
                                            <Box style={{ flex: s.pct, background: s.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, color: '#fff', fontWeight: 700, transition: 'flex 0.2s' }}>{s.pct}%</Box>
                                        </Tooltip>
                                    ))}
                                </Box>
                            )}
                        </>;
                    })()}
                    <Button color="green" size="xs" onClick={submitOutbound} loading={posting} leftSection={<IconCheck size={14} />}>Selesaikan & Posting</Button>
                </Stack></Paper> : <Paper withBorder p="md" radius="md"><Stack align="center" py="xl" gap="xs">
                    <IconPlayerPlay size={30} color="#adb5bd" /><Text fw={700} size="sm">Pilih Planning Ayam</Text><Text size="xs" c="dimmed" ta="center">Klik ikon proses pada tabel Planning Ayam Aktif. Form proses akan muncul di sini.</Text>
                </Stack></Paper>}
            </Grid.Col>
            <Grid.Col span={{ base: 12, md: 8, lg: 9 }}>
                <Stack gap="md">
                    <Paper withBorder p="md" radius="md">
                        <Group justify="space-between" mb="xs">
                            <Text fw={850} size="sm" c="orange">PLANNING AYAM AKTIF ({activePlans.length})</Text>
                        </Group>
                        <Box style={{ overflowX: 'auto' }}>
                            {activePlans.length === 0 ? (
                                <EmptyState icon={<IconMeat size={48} />} title="Tidak ada planning aktif" description="Semua planning ayam sudah diproses atau status DONE" />
                            ) : (
                                <Table withTableBorder withColumnBorders style={{ fontSize: 11 }}>
                                    <Table.Thead style={{ background: "#fff4e6", borderBottom: "2px solid #ffd8a8" }}>
                                        <Table.Tr>
                                            {['Item Ayam', 'Qty Planning', 'Tgl Planning', 'Shift', 'Tujuan', 'Status', 'Aksi'].map(h => <Table.Th key={h} style={{ color: '#d9480f' }}>{h}</Table.Th>)}
                                        </Table.Tr>
                                    </Table.Thead>
                                    <Table.Tbody>
                                        {activePlans.map((p: any, i: number) => (
                                            <Table.Tr key={p.id} style={{ background: i % 2 ? '#f8f9fa' : '#fff' }}>
                                                <Table.Td fw={700}>{p.barang?.nama || '-'}</Table.Td>
                                                <Table.Td ta="right">{p.qty} {p.satuan}</Table.Td>
                                                <Table.Td>{fmt(p.tanggal_planning)}</Table.Td>
                                                <Table.Td>{p.shift?.name || '-'}</Table.Td>
                                                <Table.Td>{p.tujuan || '-'}</Table.Td>
                                                <Table.Td><Badge size="xs" color={statusColor(p.status)}>{p.status}</Badge></Table.Td>
                                                <Table.Td>
                                                    <Group gap={4} wrap="nowrap">
                                                        <Tooltip label="Proses Outbound Ayam">
                                                            <ActionIcon size="sm" color="green" variant="light" onClick={() => openProcess(p)}>
                                                                <IconCheck size={13} />
                                                            </ActionIcon>
                                                        </Tooltip>
                                                        <Tooltip label="Reject Planning">
                                                            <ActionIcon size="sm" color="red" variant="light" onClick={() => rejectPlan(p)}>
                                                                <IconX size={13} />
                                                            </ActionIcon>
                                                        </Tooltip>
                                                    </Group>
                                                </Table.Td>
                                            </Table.Tr>
                                        ))}
                                    </Table.Tbody>
                                </Table>
                            )}
                        </Box>
                    </Paper>

                    <Paper withBorder p="md" radius="md">
                        <Group justify="space-between" mb="xs">
                            <Text fw={850} size="sm"><IconHistory size={14} /> RIWAYAT OUTBOUND AYAM ({filteredHistory.length})</Text>
                            <Group gap="xs">
                                <TextInput size="xs" placeholder="Cari item, tujuan..." value={search} onChange={e => setSearch(e.target.value)} w={200} />
                                <Button size="xs" variant="outline" color="orange" onClick={load}>Refresh</Button>
                            </Group>
                        </Group>
                        <Box style={{ overflowX: 'auto' }}>
                            <Table withTableBorder withColumnBorders style={{ fontSize: 11 }}>
                                <Table.Thead style={{ background: "#fff0f6", borderBottom: "2px solid #fcc2d7" }}>
                                    <Table.Tr>
                                        {['Planning', 'Qty Planning', 'Qty Aktual', 'Serapan', 'Tujuan', 'Shift', 'Keterangan'].map(h => <Table.Th key={h} style={{ color: '#c2255c' }}>{h}</Table.Th>)}
                                    </Table.Tr>
                                </Table.Thead>
                                <Table.Tbody>
                                    {filteredHistory.map((o: any, i: number) => {
                                        const p = o.planning_ayam;
                                        const terserapQty = o.alokasi?.find((a: any) => a.tujuan === 'Terserap')?.qty || 0;
                                        const serapan = p?.qty ? Math.round(terserapQty / p.qty * 100) : 0;
                                        return (
                                            <Table.Tr key={o.id} style={{ background: i % 2 ? '#f8f9fa' : '#fff' }}>
                                                <Table.Td fw={700}>{p?.barang?.nama || '-'}</Table.Td>
                                                <Table.Td ta="right">{p?.qty || 0} {p?.satuan}</Table.Td>
                                                <Table.Td ta="right" fw={700}>{o.qty_aktual} {o.satuan || p?.satuan}</Table.Td>
                                                <Table.Td><Badge size="xs" color={serapan >= 75 ? 'green' : serapan >= 50 ? 'yellow' : 'red'}>{serapan}%</Badge></Table.Td>
                                                <Table.Td style={{ maxWidth: 200, whiteSpace: 'normal', wordBreak: 'break-all' }}>
                                                    {o.tujuan || '-'}
                                                    {o.alokasi?.length ? (
                                                        <Box mt={2} style={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                                                            {o.alokasi.map((a: any) => (
                                                                <Badge key={a.tujuan} size="xs" color={a.tujuan === 'Terserap' ? 'green' : a.tujuan === 'Waste' ? 'orange' : 'red'} variant="light">
                                                                    {a.tujuan}:{a.qty}
                                                                </Badge>
                                                            ))}
                                                        </Box>
                                                    ) : ''}
                                                </Table.Td>
                                                <Table.Td>{o.shift?.name || '-'}</Table.Td>
                                                <Table.Td>{o.keterangan || '-'}</Table.Td>
                                            </Table.Tr>
                                        );
                                    })}
                                    {!filteredHistory.length && (
                                        <Table.Tr>
                                            <Table.Td colSpan={7} ta="center" c="dimmed">
                                                {loading ? 'Memuat...' : 'Tidak ada riwayat outbound ayam.'}
                                            </Table.Td>
                                        </Table.Tr>
                                    )}
                                </Table.Tbody>
                            </Table>
                        </Box>
                    </Paper>
                </Stack>
            </Grid.Col>
        </Grid>
      </Box>
    </Box>
    );
}