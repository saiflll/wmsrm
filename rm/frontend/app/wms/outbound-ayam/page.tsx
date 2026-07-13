'use client';
// @ts-nocheck
import React, { useState, useEffect, useRef } from 'react';
import { Box, Group, Button, Title, Text, Badge, Paper, Stack, TextInput, Select, NumberInput, Textarea, ActionIcon, Grid, Divider, Autocomplete, Card, ThemeIcon } from '@mantine/core';
import { Table } from '../components/Table';
import { IconPlus, IconEdit, IconTrash, IconMeat, IconSend, IconCheck, IconClipboardCheck, IconHistory, IconRocket } from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import { api, unwrap, fmt } from '../lib/api';

const DEFAULT_TUJUAN = ['Produksi Ayam', 'Waste', 'Reject', 'Premix'];

export default function OutboundAyamPage() {
    const [outbounds, setOutbounds] = useState<any[]>([]);
    const [plans, setPlans] = useState<any[]>([]);
    const [shifts, setShifts] = useState<any[]>([]);
    const [search, setSearch] = useState('');
    const [loading, setLoading] = useState(true);

    // Pending planning queue (from API - already published)
    const [pendingPlans, setPendingPlans] = useState<any[]>([]);

    // Planning Ayam drafts from localStorage
    const [planningDrafts, setPlanningDrafts] = useState<any[]>(() => {
        if (typeof window !== "undefined") {
            try {
                const saved = localStorage.getItem("wms_planning_ayam_drafts");
                return saved ? JSON.parse(saved) : [];
            } catch (e) {}
        }
        return [];
    });
    const planningDraftRef = useRef(false);
    useEffect(() => {
        if (!planningDraftRef.current) { planningDraftRef.current = true; return; }
        localStorage.setItem("wms_planning_ayam_drafts", JSON.stringify(planningDrafts));
    }, [planningDrafts]);

    // Outbound Ayam drafts from localStorage
    const [outboundDrafts, setOutboundDrafts] = useState<any[]>(() => {
        if (typeof window !== "undefined") {
            try {
                const saved = localStorage.getItem("wms_outbound_ayam_drafts");
                return saved ? JSON.parse(saved) : [];
            } catch (e) {}
        }
        return [];
    });
    const outboundDraftRef = useRef(false);
    useEffect(() => {
        if (!outboundDraftRef.current) { outboundDraftRef.current = true; return; }
        localStorage.setItem("wms_outbound_ayam_drafts", JSON.stringify(outboundDrafts));
    }, [outboundDrafts]);

    const [form, setForm] = useState<any>({
        planning_ayam_id: '',
        qty_aktual: 0,
        tujuan: '',
        shift_id: '',
        keterangan: '',
        alokasi: [],
    });

    const [publishing, setPublishing] = useState(false);

    const pf = (k: string, v: any) => setForm((p: any) => ({ ...p, [k]: v }));

    useEffect(() => { load(); }, []);

    const load = async () => {
        setLoading(true);
        try {
            const [oRes, pRes, sRes] = await Promise.all([
                api().get('/outbound-ayam'),
                api().get('/planning-ayam'),
                api().get('/shifts'),
            ]);
            const allPlans = unwrap(pRes);
            setOutbounds(unwrap(oRes));
            setPlans(allPlans);
            setShifts(unwrap(sRes));
            setPendingPlans(allPlans.filter((p: any) => p.status !== 'DONE'));
        } catch (e) {
            console.error('Load outbound ayam failed', e);
        }
        setLoading(false);
    };

    const resetForm = () => {
        setForm({ planning_ayam_id: '', qty_aktual: 0, tujuan: '', shift_id: '', keterangan: '', alokasi: [] });
    };

    const addOutboundDraft = () => {
        if (!form.planning_ayam_id || !form.qty_aktual) {
            return notifications.show({ title: 'Error', message: 'Planning ayam dan qty aktual wajib diisi', color: 'red' });
        }
        const plan = plans.find((p: any) => String(p.id) === String(form.planning_ayam_id));
        setOutboundDrafts(prev => [...prev, {
            ...form,
            id: Date.now(),
            planning_ayam_id: Number(form.planning_ayam_id),
            qty_aktual: Number(form.qty_aktual),
            shift_id: form.shift_id ? Number(form.shift_id) : undefined,
            _planName: plan?.barang?.nama || `Plan #${form.planning_ayam_id}`,
        }]);
        resetForm();
        notifications.show({ title: 'Draft', message: 'Outbound ayam ditambahkan ke draft', color: 'grape' });
    };

    const editOutboundDraft = (idx: number) => {
        const d = outboundDrafts[idx];
        setForm({
            planning_ayam_id: String(d.planning_ayam_id),
            qty_aktual: d.qty_aktual,
            tujuan: d.tujuan || '',
            shift_id: d.shift_id ? String(d.shift_id) : '',
            keterangan: d.keterangan || '',
            alokasi: d.alokasi || [],
        });
        setOutboundDrafts(p => p.filter((_, i) => i !== idx));
    };

    const publishAll = async () => {
        if (!planningDrafts.length && !outboundDrafts.length) {
            return notifications.show({ title: 'Info', message: 'Tidak ada draft untuk dipublish', color: 'yellow' });
        }
        if (!confirm(`Publish ${planningDrafts.length} planning ayam dan ${outboundDrafts.length} outbound ayam?`)) return;

        setPublishing(true);
        try {
            // Submit planning ayam drafts
            for (const d of planningDrafts) {
                await api().post('/planning-ayam', {
                    barang_id: d.barang_id,
                    qty: d.qty,
                    satuan: d.satuan,
                    tanggal_planning: d.tanggal_planning || new Date().toISOString().split('T')[0],
                    shift_id: d.shift_id ? Number(d.shift_id) : undefined,
                    tujuan: d.tujuan,
                    status: d.status || 'WAIT',
                    keterangan: d.keterangan || '',
                });
            }

            // Submit outbound ayam drafts
            for (const d of outboundDrafts) {
                await api().post('/outbound-ayam', {
                    planning_ayam_id: d.planning_ayam_id,
                    qty_aktual: d.qty_aktual,
                    tujuan: d.tujuan,
                    shift_id: d.shift_id ? Number(d.shift_id) : undefined,
                    keterangan: d.keterangan || '',
                    alokasi: d.alokasi || [],
                });
            }

            // Clear both localStorage
            setPlanningDrafts([]);
            setOutboundDrafts([]);
            localStorage.removeItem("wms_planning_ayam_drafts");
            localStorage.removeItem("wms_outbound_ayam_drafts");

            notifications.show({
                title: 'Success',
                message: `${planningDrafts.length} planning + ${outboundDrafts.length} outbound published`,
                color: 'green',
            });
            load();
        } catch (e: any) {
            notifications.show({ title: 'Error', message: unwrap(e.response)?.message || 'Gagal publish', color: 'red' });
        }
        setPublishing(false);
    };

    const planOpts = plans
        .filter((p: any) => p.status !== 'DONE')
        .map((p: any) => ({ value: String(p.id), label: `${p.barang?.nama} - ${p.qty} ${p.satuan} (${fmt(p.tanggal_planning)})` }));

    const selectedPlan = plans.find((p: any) => String(p.id) === String(form.planning_ayam_id));

    const filtered = outbounds.filter((o: any) =>
        !search ||
        o.planning_ayam?.barang?.nama?.toLowerCase().includes(search.toLowerCase()) ||
        o.tujuan?.toLowerCase().includes(search.toLowerCase())
    );

    const statusColor = (s: string) => {
        if (s === 'DONE') return 'green';
        if (s === 'PROGRESS') return 'blue';
        if (s === 'CANCEL') return 'red';
        return 'yellow';
    };

    return (
        <Box>
            <Paper style={{ background: '#fff', borderLeft: '4px solid #f76707', padding: '14px 20px', marginBottom: 16, boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                <Title order={4} style={{ color: '#111827', fontWeight: 800, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <IconMeat size={20} style={{ color: '#f76707' }} />
                    OUTBOUND AYAM
                </Title>
            </Paper>

            <Box p="md">
                <Grid gutter="md">
                    {/* Left Panel: Form + Publish */}
                    <Grid.Col span={{ base: 12, md: 4, lg: 3 }}>
                        <Paper withBorder p="md" radius="md" style={{ background: '#fff' }}>
                            <Stack gap="xs">
                                <Text fw={800} size="sm" c="orange" mb={4} style={{ borderBottom: '1px solid #f1f5f9', paddingBottom: 4 }}>
                                    TAMBAH OUTBOUND AYAM
                                </Text>
                                <Select label="Planning Ayam" size="xs" searchable data={planOpts} value={form.planning_ayam_id} onChange={(v) => pf('planning_ayam_id', v)} placeholder="Pilih planning ayam..." required />
                                {selectedPlan && (
                                    <Box style={{ background: '#fff9db', borderRadius: 6, padding: '6px 8px', fontSize: 11 }}>
                                        <Text size="xs">Qty Planning: <b>{selectedPlan.qty} {selectedPlan.satuan}</b></Text>
                                        <Text size="xs">Tujuan: <b>{selectedPlan.tujuan || '-'}</b></Text>
                                    </Box>
                                )}
                                <NumberInput label="Qty Aktual" size="xs" value={form.qty_aktual} onChange={(v) => pf('qty_aktual', Number(v))} min={0} required />
                                {selectedPlan && form.qty_aktual > 0 && (
                                    <Text size="xs" c="dimmed">
                                        Serapan: <b>{Math.round((form.qty_aktual / selectedPlan.qty) * 100)}%</b>
                                    </Text>
                                )}
                                <Autocomplete label="Shift" size="xs" data={shifts.map((s: any) => s.name)} value={shifts.find((s: any) => String(s.id) === form.shift_id)?.name || form.shift_id} onChange={(v) => { const match = shifts.find((s: any) => s.name.toLowerCase() === v.toLowerCase()); pf('shift_id', match ? String(match.id) : v); }} placeholder="Pilih shift..." />
                                <TextInput label="Tujuan Utama" size="xs" placeholder="Produksi Ayam" value={form.tujuan} onChange={(e) => pf('tujuan', e.target.value)} />
                                <Textarea label="Keterangan" size="xs" value={form.keterangan} onChange={(e) => pf('keterangan', e.target.value)} minRows={2} />
                                <Divider label="Alokasi (opsional)" labelPosition="center" />
                                {DEFAULT_TUJUAN.map((t) => (
                                    <NumberInput
                                        key={t}
                                        label={t}
                                        size="xs"
                                        value={form.alokasi.find((a: any) => a.tujuan === t)?.qty || 0}
                                        onChange={(v) => {
                                            const val = Number(v) || 0;
                                            setForm((p: any) => {
                                                const existing = p.alokasi.filter((a: any) => a.tujuan !== t);
                                                if (val > 0) existing.push({ tujuan: t, qty: val });
                                                return { ...p, alokasi: existing };
                                            });
                                        }}
                                        min={0}
                                    />
                                ))}
                                <Button fullWidth size="xs" color="grape" variant="light" onClick={addOutboundDraft} style={{ fontWeight: 700 }} leftSection={<IconPlus size={14} />}>
                                    + Tambahkan Draft Outbound
                                </Button>

                                <Divider my={4} />

                                <Button
                                    fullWidth
                                    size="sm"
                                    color="green"
                                    onClick={publishAll}
                                    loading={publishing}
                                    style={{ fontWeight: 800 }}
                                    leftSection={<IconRocket size={16} />}
                                >
                                    PUBLISH ({planningDrafts.length + outboundDrafts.length})
                                </Button>
                            </Stack>
                        </Paper>
                    </Grid.Col>

                    {/* Right Panel */}
                    <Grid.Col span={{ base: 12, md: 8, lg: 9 }}>
                        {/* Section 1: Planning Ayam Drafts (from localStorage) */}
                        {planningDrafts.length > 0 && (
                            <Paper withBorder p="md" radius="md" mb="md" style={{ background: '#fff' }}>
                                <Group justify="space-between" mb="xs">
                                    <Box>
                                        <Text fw={800} size="sm" c="grape">DRAFT PLANNING AYAM ({planningDrafts.length})</Text>
                                        <Text size="xs" c="dimmed">Draft dari halaman Planning Ayam - akan dipublish bersama</Text>
                                    </Box>
                                    <Button size="xs" variant="light" color="grape" onClick={() => window.location.href = '/wms/planning-ayam'} leftSection={<IconEdit size={13} />}>
                                        Edit di Planning
                                    </Button>
                                </Group>
                                <Box style={{ overflowX: 'auto' }}>
                                    <Table withTableBorder withColumnBorders style={{ fontSize: 11 }}>
                                        <Table.Thead style={{ background: '#333' }}>
                                            <Table.Tr>
                                                {['Item', 'Qty', 'Tgl Planning', 'Shift', 'Tujuan', 'Status', 'Aksi'].map((h) => (
                                                    <Table.Th key={h} style={{ color: '#fff' }}>{h}</Table.Th>
                                                ))}
                                            </Table.Tr>
                                        </Table.Thead>
                                        <Table.Tbody>
                                            {planningDrafts.map((d: any, i: number) => (
                                                <Table.Tr key={d.id || i}>
                                                    <Table.Td fw={700}>{d._brg}</Table.Td>
                                                    <Table.Td ta="right">{d.qty} {d.satuan}</Table.Td>
                                                    <Table.Td>{d.tanggal_planning || '-'}</Table.Td>
                                                    <Table.Td>{shifts.find((s: any) => s.id === d.shift_id)?.name || d.shift_id || '-'}</Table.Td>
                                                    <Table.Td>{d.tujuan || '-'}</Table.Td>
                                                    <Table.Td><Badge size="xs" color={statusColor(d.status || 'WAIT')} variant="filled">{d.status || 'WAIT'}</Badge></Table.Td>
                                                    <Table.Td>
                                                        <Group gap={4} wrap="nowrap">
                                                            <ActionIcon size="sm" color="red" variant="light" onClick={() => setPlanningDrafts(p => p.filter((_, j) => j !== i))}>
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

                        {/* Section 2: Outbound Ayam Drafts (from localStorage) */}
                        {outboundDrafts.length > 0 && (
                            <Paper withBorder p="md" radius="md" mb="md" style={{ background: '#fff' }}>
                                <Group justify="space-between" mb="xs">
                                    <Box>
                                        <Text fw={800} size="sm" c="orange">DRAFT OUTBOUND AYAM ({outboundDrafts.length})</Text>
                                        <Text size="xs" c="dimmed">Draft outbound - akan dipublish bersama planning</Text>
                                    </Box>
                                </Group>
                                <Box style={{ overflowX: 'auto' }}>
                                    <Table withTableBorder withColumnBorders style={{ fontSize: 11 }}>
                                        <Table.Thead style={{ background: '#333' }}>
                                            <Table.Tr>
                                                {['Planning', 'Qty Aktual', 'Tujuan', 'Shift', 'Keterangan', 'Aksi'].map((h) => (
                                                    <Table.Th key={h} style={{ color: '#fff' }}>{h}</Table.Th>
                                                ))}
                                            </Table.Tr>
                                        </Table.Thead>
                                        <Table.Tbody>
                                            {outboundDrafts.map((d: any, i: number) => (
                                                <Table.Tr key={d.id || i}>
                                                    <Table.Td fw={700}>{d._planName}</Table.Td>
                                                    <Table.Td ta="right">{d.qty_aktual}</Table.Td>
                                                    <Table.Td>{d.tujuan || '-'}</Table.Td>
                                                    <Table.Td>{shifts.find((s: any) => s.id === d.shift_id)?.name || d.shift_id || '-'}</Table.Td>
                                                    <Table.Td>{d.keterangan || '-'}</Table.Td>
                                                    <Table.Td>
                                                        <Group gap={4} wrap="nowrap">
                                                            <ActionIcon size="sm" color="green" variant="light" onClick={() => editOutboundDraft(i)}>
                                                                <IconEdit size={13} />
                                                            </ActionIcon>
                                                            <ActionIcon size="sm" color="red" variant="light" onClick={() => setOutboundDrafts(p => p.filter((_, j) => j !== i))}>
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

                        {/* Section 3: Pending Planning Queue (from API) */}
                        <Paper withBorder p="md" mb="md" radius="md" style={{ background: '#fff' }}>
                            <Group gap="xs" mb="sm" style={{ borderBottom: '1px solid #f1f5f9', paddingBottom: 4 }}>
                                <ThemeIcon color="blue" variant="light" size="sm">
                                    <IconClipboardCheck size={16} />
                                </ThemeIcon>
                                <Text fw={800} size="sm" c="blue">
                                    PENDING PLANS ({pendingPlans.length})
                                </Text>
                            </Group>

                            {pendingPlans.length === 0 ? (
                                <Box p="md" style={{ textAlign: 'center', border: '1px dashed #cbd5e1', borderRadius: 8 }}>
                                    <Text c="dimmed" size="xs">Tidak ada planning ayam pending.</Text>
                                </Box>
                            ) : (
                                <Grid gutter="xs">
                                    {pendingPlans.map((plan: any) => (
                                        <Grid.Col key={plan.id} span={{ base: 12, md: 6 }}>
                                            <Card withBorder p="xs" radius="md" style={{ background: '#f8fafc' }}>
                                                <Group justify="space-between" mb={4}>
                                                    <Box>
                                                        <Text fw={800} size="xs" c="blue">{plan.barang?.nama || '-'}</Text>
                                                        <Text size="10px" c="dimmed">
                                                            {fmt(plan.tanggal_planning)} • {plan.shift?.name || '-'} • {plan.tujuan || '-'}
                                                        </Text>
                                                        <Text size="xs" fw={600}>Qty: {plan.qty} {plan.satuan}</Text>
                                                    </Box>
                                                    <Badge size="xs" color={plan.status === 'DONE' ? 'green' : plan.status === 'PROGRESS' ? 'blue' : 'yellow'} variant="filled">
                                                        {plan.status}
                                                    </Badge>
                                                </Group>
                                            </Card>
                                        </Grid.Col>
                                    ))}
                                </Grid>
                            )}
                        </Paper>

                        {/* Section 4: Outbound History Table */}
                        <Paper withBorder p="md" radius="md" style={{ background: '#fff' }}>
                            <Group justify="space-between" mb="sm">
                                <Group gap="xs">
                                    <ThemeIcon color="dark" variant="light" size="sm">
                                        <IconHistory size={16} />
                                    </ThemeIcon>
                                    <Text fw={800} size="sm">RIWAYAT OUTBOUND AYAM</Text>
                                </Group>
                                <Group gap="xs">
                                    <TextInput placeholder="Cari item, tujuan..." size="xs" value={search} onChange={(e) => setSearch(e.target.value)} style={{ width: 220 }} />
                                    <Button size="xs" variant="outline" color="orange" onClick={load}>Refresh</Button>
                                </Group>
                            </Group>
                            <Box style={{ overflowX: 'auto' }}>
                                <Table withTableBorder withColumnBorders style={{ fontSize: 11 }}>
                                    <Table.Thead style={{ background: '#333' }}>
                                        <Table.Tr>
                                            {['Planning', 'Qty Planning', 'Qty Aktual', 'Serapan', 'Tujuan', 'Shift', 'Keterangan'].map((h) => (
                                                <Table.Th key={h} style={{ color: '#fff' }}>{h}</Table.Th>
                                            ))}
                                        </Table.Tr>
                                    </Table.Thead>
                                    <Table.Tbody>
                                        {filtered.map((o: any) => {
                                            const plan = o.planning_ayam;
                                            const serapan = plan && plan.qty > 0 ? Math.round((o.qty_aktual / plan.qty) * 100) : 0;
                                            return (
                                                <Table.Tr key={o.id}>
                                                    <Table.Td fw={700}>{plan?.barang?.nama || '-'}</Table.Td>
                                                    <Table.Td ta="right">{plan?.qty || 0} {plan?.satuan}</Table.Td>
                                                    <Table.Td ta="right" fw={700}>{o.qty_aktual} {o.satuan}</Table.Td>
                                                    <Table.Td><Badge size="xs" color={serapan >= 100 ? 'green' : serapan >= 75 ? 'yellow' : 'red'}>{serapan}%</Badge></Table.Td>
                                                    <Table.Td>{o.tujuan || '-'}{o.alokasi?.length ? ` (${o.alokasi.map((a: any) => `${a.tujuan}:${a.qty}`).join(', ')})` : ''}</Table.Td>
                                                    <Table.Td>{o.shift?.name || '-'}</Table.Td>
                                                    <Table.Td>{o.keterangan || '-'}</Table.Td>
                                                </Table.Tr>
                                            );
                                        })}
                                        {filtered.length === 0 && (
                                            <Table.Tr>
                                                <Table.Td colSpan={7} ta="center" c="dimmed">
                                                    {loading ? <Text size="xs">Memuat...</Text> : <Text size="xs">Tidak ada data outbound ayam.</Text>}
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
