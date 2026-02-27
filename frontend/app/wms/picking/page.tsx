'use client';
// @ts-nocheck
import React, { useState, useEffect } from 'react';
import { Box, Group, Button, Title, Text, Table, Badge, Paper, Stack, TextInput, Select, Loader, NumberInput } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { api, unwrap, fmt, statusLabel, statusColor } from '../lib/api';

export default function PickingPage() {
    const [stocks, setStocks] = useState([]);
    const [logs, setLogs] = useState([]);
    const [customers, setCustomers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [drafts, setDrafts] = useState([]);
    const [form, setForm] = useState({ stock_id: '', qty: 0, tujuan: '', no_ref: '' });

    useEffect(() => { load(); }, []);

    const load = async () => {
        setLoading(true);
        try {
            const [s, l, c] = await Promise.all([
                api().get('/inventory/stock'),
                api().get('/inventory/logs/outbound'),
                api().get('/customers'),
            ]);
            setStocks(unwrap(s));
            setLogs(unwrap(l));
            setCustomers(unwrap(c));
        } catch (e) { console.error(e); }
        setLoading(false);
    };

    const stockOpts = stocks.map(s => ({ value: String(s.id), label: `${s.barang?.nama} @ ${s.gudang?.name} (${s.qty})` }));
    const customerOpts = customers.map(c => ({ value: c.nama, label: c.nama }));

    const addDraft = () => {
        if (!form.stock_id || !form.qty) return notifications.show({ title: 'Error', message: 'Pilih stock & qty', color: 'red' });
        const st = stocks.find(s => s.id === +form.stock_id);
        if (!st) return;
        setDrafts(p => [...p, {
            ...form, id: Date.now(), stock_id: +form.stock_id,
            barang_id: st.barang?.id, gudang_id: st.gudang?.id,
            _brg: st.barang?.nama, _gdg: st.gudang?.name, satuan: st.satuan,
        }]);
        setForm(p => ({ ...p, stock_id: '', qty: 0 }));
    };

    const postAll = async () => {
        if (!drafts.length) return;
        try {
            const items = drafts.map(d => ({
                no_ref: d.no_ref || `OUT-${Date.now()}`,
                barang_id: d.barang_id, gudang_id: d.gudang_id,
                qty: d.qty, satuan: d.satuan, tujuan: d.tujuan,
            }));
            await api().post('/inventory/outbound', { items });
            notifications.show({ title: 'Sukses', message: `${items.length} item picked`, color: 'green' });
            setDrafts([]);
            load();
        } catch (e: any) {
            notifications.show({ title: 'Error', message: unwrap(e.response)?.message || 'Failed', color: 'red' });
        }
    };

    return (
        <Box>
            <Box style={{ background: '#fff', borderBottom: '1px solid #ddd', padding: '12px 20px' }}>
                <Title order={3} style={{ color: '#e6921e', fontWeight: 900 }}>MULTI-ITEM PICKING PLAN</Title>
            </Box>

            <Box p="md">
                <Group align="flex-start" gap="md">
                    <Paper withBorder p="md" style={{ width: 280, flexShrink: 0 }}>
                        <Stack gap="xs">
                            <TextInput label="No. Ref / ID Transaksi" size="xs" value={form.no_ref} onChange={e => setForm(p => ({ ...p, no_ref: e.target.value }))} />
                            <Select label="Pilih Stock" size="xs" searchable data={stockOpts} value={form.stock_id} onChange={v => setForm(p => ({ ...p, stock_id: v || '' }))} placeholder="Item @ Lokasi" />
                            <NumberInput label="Qty" size="xs" value={form.qty} onChange={v => setForm(p => ({ ...p, qty: Number(v) }))} min={1} />
                            <Select label="Tujuan" size="xs" searchable data={customerOpts} value={form.tujuan} onChange={v => setForm(p => ({ ...p, tujuan: v || '' }))} placeholder="Pilih Tujuan / Customer" />
                            <Button fullWidth size="xs" color="yellow" onClick={addDraft} style={{ fontWeight: 700 }}>+ Tambah Picking</Button>
                        </Stack>
                    </Paper>

                    <Box style={{ flex: 1 }}>
                        {drafts.length > 0 && (
                            <Box mb="md">
                                <Group justify="space-between" mb="xs">
                                    <Text fw={700} size="sm">DRAFT PICKING ({drafts.length})</Text>
                                    <Button size="xs" color="green" onClick={postAll} style={{ fontWeight: 700 }}>📤 CONFIRM PICKING</Button>
                                </Group>
                                <Table withTableBorder withColumnBorders style={{ fontSize: 11 }}>
                                    <Table.Thead style={{ background: '#333' }}>
                                        <Table.Tr>
                                            {['Item', 'Lokasi', 'Qty', 'Tujuan', '✕'].map(h => (
                                                <Table.Th key={h} style={{ color: '#fff', fontSize: 11 }}>{h}</Table.Th>
                                            ))}
                                        </Table.Tr>
                                    </Table.Thead>
                                    <Table.Tbody>
                                        {drafts.map((d, i) => (
                                            <Table.Tr key={d.id}>
                                                <Table.Td fw={600}>{d._brg}</Table.Td>
                                                <Table.Td>{d._gdg}</Table.Td>
                                                <Table.Td ta="right">{d.qty}</Table.Td>
                                                <Table.Td>{d.tujuan}</Table.Td>
                                                <Table.Td><Button size="xs" color="red" variant="light" onClick={() => setDrafts(p => p.filter((_, j) => j !== i))}>✕</Button></Table.Td>
                                            </Table.Tr>
                                        ))}
                                    </Table.Tbody>
                                </Table>
                            </Box>
                        )}

                        <Text fw={700} size="sm" mb="xs">RIWAYAT OUTBOUND ({logs.length})</Text>
                        {loading ? <Loader /> : (
                            <Table withTableBorder withColumnBorders style={{ fontSize: 11 }}>
                                <Table.Thead style={{ background: '#1a1a1a' }}>
                                    <Table.Tr>
                                        {['ID Ref', 'Item', 'Gudang', 'Tujuan', 'Qty', 'Shift', 'Tanggal'].map(h => (
                                            <Table.Th key={h} style={{ color: '#fff', fontSize: 11 }}>{h}</Table.Th>
                                        ))}
                                    </Table.Tr>
                                </Table.Thead>
                                <Table.Tbody>
                                    {logs.map(r => (
                                        <Table.Tr key={r.id}>
                                            <Table.Td fw={600} style={{ color: '#1565c0' }}>{r.no_ref || '-'}</Table.Td>
                                            <Table.Td>{r.barang?.nama}</Table.Td>
                                            <Table.Td><Badge size="xs" color="blue">{r.gudang?.name}</Badge></Table.Td>
                                            <Table.Td>{r.tujuan || '-'}</Table.Td>
                                            <Table.Td ta="right">{r.qty} {r.satuan}</Table.Td>
                                            <Table.Td>{r.shift?.name || '-'}</Table.Td>
                                            <Table.Td>{fmt(r.created_at)}</Table.Td>
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
