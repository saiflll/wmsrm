'use client';
// @ts-nocheck
import React, { useState, useEffect } from 'react';
import { Box, Group, Button, Title, Text, Badge, Paper, Stack, TextInput, Select, NumberInput, Textarea, ActionIcon, Grid, Divider } from '@mantine/core';
import { Table } from '../components/Table';
import { IconPlus, IconEdit, IconTrash, IconMeat, IconSend } from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import { api, unwrap, fmt } from '../lib/api';

const DEFAULT_TUJUAN = ['Produksi Ayam', 'Waste', 'Reject', 'Premix'];

export default function OutboundAyamPage() {
    const [outbounds, setOutbounds] = useState<any[]>([]);
    const [plans, setPlans] = useState<any[]>([]);
    const [shifts, setShifts] = useState<any[]>([]);
    const [editId, setEditId] = useState<number | null>(null);
    const [search, setSearch] = useState('');
    const [loading, setLoading] = useState(true);

    const [form, setForm] = useState<any>({
        planning_ayam_id: '',
        qty_aktual: 0,
        tujuan: '',
        shift_id: '',
        keterangan: '',
        alokasi: [],
    });

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
            setOutbounds(unwrap(oRes));
            setPlans(unwrap(pRes));
            setShifts(unwrap(sRes));
        } catch (e) {
            console.error('Load outbound ayam failed', e);
        }
        setLoading(false);
    };

    const resetForm = () => {
        setForm({ planning_ayam_id: '', qty_aktual: 0, tujuan: '', shift_id: '', keterangan: '', alokasi: [] });
        setEditId(null);
    };

    const save = async () => {
        if (!form.planning_ayam_id || !form.qty_aktual) {
            return notifications.show({ title: 'Error', message: 'Planning ayam dan qty aktual wajib diisi', color: 'red' });
        }
        try {
            const payload = { ...form, planning_ayam_id: +form.planning_ayam_id, shift_id: form.shift_id ? +form.shift_id : undefined };
            if (editId) {
                await api().put(`/outbound-ayam/${editId}`, payload);
                notifications.show({ title: 'Sukses', message: 'Outbound ayam diupdate', color: 'green' });
            } else {
                await api().post('/outbound-ayam', payload);
                notifications.show({ title: 'Sukses', message: 'Outbound ayam disimpan', color: 'green' });
            }
            resetForm();
            load();
        } catch (e: any) {
            notifications.show({ title: 'Error', message: unwrap(e.response)?.message || 'Gagal menyimpan', color: 'red' });
        }
    };

    const remove = async (id: number) => {
        if (!confirm('Hapus outbound ayam ini? Status planning akan kembali ke WAIT.')) return;
        try {
            await api().delete(`/outbound-ayam/${id}`);
            notifications.show({ title: 'Sukses', message: 'Outbound ayam dihapus', color: 'orange' });
            load();
        } catch (e: any) {
            notifications.show({ title: 'Error', message: unwrap(e.response)?.message || 'Gagal menghapus', color: 'red' });
        }
    };

    const planOpts = plans
        .filter((p: any) => p.status !== 'DONE')
        .map((p: any) => ({ value: String(p.id), label: `${p.barang?.nama} - ${p.qty} ${p.satuan} (${fmt(p.tanggal_planning)})` }));
    const shiftOpts = shifts.map((s: any) => ({ value: String(s.id), label: s.name }));

    const selectedPlan = plans.find((p: any) => String(p.id) === String(form.planning_ayam_id));

    const filtered = outbounds.filter((o: any) =>
        !search ||
        o.planning_ayam?.barang?.nama?.toLowerCase().includes(search.toLowerCase()) ||
        o.tujuan?.toLowerCase().includes(search.toLowerCase())
    );

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
                    <Grid.Col span={{ base: 12, md: 4, lg: 3 }}>
                        <Paper withBorder p="md" radius="md" style={{ background: '#fff' }}>
                            <Stack gap="xs">
                                <Text fw={800} size="sm" c="orange" mb={4} style={{ borderBottom: '1px solid #f1f5f9', paddingBottom: 4 }}>
                                    {editId ? 'EDIT OUTBOUND AYAM' : 'TAMBAH OUTBOUND AYAM'}
                                </Text>
                                <Select label="Planning Ayam" size="xs" searchable data={planOpts} value={form.planning_ayam_id} onChange={(v) => pf('planning_ayam_id', v)} placeholder="Pilih planning ayam..." required disabled={!!editId} />
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
                                <Select label="Shift" size="xs" searchable clearable data={shiftOpts} value={form.shift_id} onChange={(v) => pf('shift_id', v)} placeholder="Pilih shift..." nothingFoundMessage="Tidak ada shift" />
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
                                <Group gap="xs" mt="xs">
                                    <Button size="xs" color="orange" style={{ flex: 1 }} onClick={save} leftSection={<IconSend size={14} />}>
                                        {editId ? 'Update' : 'Proses'}
                                    </Button>
                                    {editId && <Button size="xs" color="gray" variant="outline" onClick={resetForm}>Batal</Button>}
                                </Group>
                            </Stack>
                        </Paper>
                    </Grid.Col>

                    <Grid.Col span={{ base: 12, md: 8, lg: 9 }}>
                        <Paper withBorder p="md" radius="md" style={{ background: '#fff' }}>
                            <Group justify="space-between" mb="xs">
                                <TextInput placeholder="Cari item, tujuan..." size="xs" value={search} onChange={(e) => setSearch(e.target.value)} style={{ width: 260 }} />
                                <Button size="xs" variant="outline" color="orange" onClick={load}>Refresh</Button>
                            </Group>
                            <Box style={{ overflowX: 'auto' }}>
                                <Table withTableBorder withColumnBorders style={{ fontSize: 11 }}>
                                    <Table.Thead style={{ background: '#333' }}>
                                        <Table.Tr>
                                            {['Planning', 'Qty Planning', 'Qty Aktual', 'Serapan', 'Tujuan', 'Shift', 'Keterangan', 'Aksi'].map((h) => (
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
                                                    <Table.Td>
                                                        <Group gap={4} wrap="nowrap">
                                                            <ActionIcon size="sm" color="green" variant="light" onClick={() => { setEditId(o.id); setForm({ planning_ayam_id: String(plan?.id), qty_aktual: o.qty_aktual, tujuan: o.tujuan || '', shift_id: o.shift ? String(o.shift.id) : '', keterangan: o.keterangan || '', alokasi: o.alokasi || [] }); }}>
                                                                <IconEdit size={13} />
                                                            </ActionIcon>
                                                            <ActionIcon size="sm" color="red" variant="light" onClick={() => remove(o.id)}>
                                                                <IconTrash size={13} />
                                                            </ActionIcon>
                                                        </Group>
                                                    </Table.Td>
                                                </Table.Tr>
                                            );
                                        })}
                                        {filtered.length === 0 && (
                                            <Table.Tr>
                                                <Table.Td colSpan={8} ta="center" c="dimmed">
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
