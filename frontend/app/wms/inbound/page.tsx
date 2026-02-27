'use client';
// @ts-nocheck
import React, { useState, useEffect, useRef } from 'react';
import {
    Box, Group, Button, Title, Text, Table, Badge, Paper, Stack, TextInput,
    Divider, Loader, Select
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { api, unwrap, fmt, statusLabel, statusColor } from '../lib/api';

export default function InboundPage() {
    const [type, setType] = useState('wet');
    const [barangs, setBarangs] = useState([]);
    const [gudangs, setGudangs] = useState([]);
    const [customers, setCustomers] = useState([]);
    const [shifts, setShifts] = useState([]);
    const [drafts, setDrafts] = useState([]);
    const [logs, setLogs] = useState([]);
    const [search, setSearch] = useState('');
    const barcodeRef = useRef(null);
    const [form, setForm] = useState({
        no_po: '', barang_id: '', gudang_id: '', qty: '', satuan: '',
        batch_no: '', expiry_date: '', supplier: '', shift_id: '', jam_selesai: '',
    });

    useEffect(() => { loadMaster(); loadLogs(); }, [type]);

    const loadMaster = async () => {
        try {
            const side = type === 'dry';
            const [b, g, c] = await Promise.all([
                api().get(`/barang?side=${side}`),
                api().get(`/gudang?side=${side}`),
                api().get('/customers')
            ]);
            setBarangs(unwrap(b));
            setGudangs(unwrap(g));
            setCustomers(unwrap(c));
            // Load shifts separately
            try {
                const sr = await api().get('/barang?side=true'); // dummy, shifts loaded from seed
            } catch { }
        } catch (e) { console.error(e); }
    };

    const loadLogs = async () => {
        try {
            const res = await api().get('/inventory/logs/inbound');
            const data = unwrap(res);
            setLogs(data.filter(l => type === 'wet' ? !l.barang?.side : l.barang?.side));
        } catch (e) { console.error(e); }
    };

    const addDraft = () => {
        if (!form.barang_id || !form.gudang_id || !form.qty) {
            return notifications.show({ title: 'Error', message: 'Barang, Gudang & Qty wajib diisi', color: 'red' });
        }
        const brg = barangs.find(b => b.id === +form.barang_id);
        const gdg = gudangs.find(g => g.id === +form.gudang_id);
        setDrafts(p => [...p, {
            ...form, id: Date.now(),
            barang_id: +form.barang_id, gudang_id: +form.gudang_id, qty: +form.qty,
            _brg: brg?.nama, _gdg: gdg?.name, shift_id: form.shift_id ? +form.shift_id : undefined,
        }]);
        setForm(p => ({ ...p, barang_id: '', qty: '', batch_no: '' }));
        barcodeRef.current?.focus();
    };

    const postAll = async () => {
        if (!drafts.length) return;
        try {
            const items = drafts.map(d => ({
                no_po: d.no_po, barang_id: d.barang_id, gudang_id: d.gudang_id,
                qty: d.qty, satuan: d.satuan, batch_no: d.batch_no,
                expiry_date: d.expiry_date || undefined, supplier: d.supplier,
                shift_id: d.shift_id, jam_selesai: d.jam_selesai,
            }));
            await api().post('/inventory/inbound', { items });
            notifications.show({ title: 'Sukses', message: `${items.length} item posted`, color: 'green' });
            setDrafts([]);
            loadLogs();
        } catch (e: any) {
            notifications.show({ title: 'Error', message: unwrap(e.response)?.message || 'Failed', color: 'red' });
        }
    };

    const f = (k, v) => setForm(p => ({ ...p, [k]: v }));

    const barangOpts = barangs.map(b => ({ value: String(b.id), label: `${b.sku} - ${b.nama}` }));
    const gudangOpts = gudangs.map(g => ({ value: String(g.id), label: g.name }));
    const customerOpts = customers.map(c => ({ value: c.nama, label: c.nama }));

    return (
        <Box>
            <Box style={{ background: '#fff', borderBottom: '1px solid #ddd', padding: '12px 20px' }}>
                <Group justify="space-between">
                    <Title order={3} style={{ color: '#e6921e', fontWeight: 900 }}>INBOUND</Title>
                    <Group gap="xs">
                        <Button size="xs" color={type === 'wet' ? 'yellow' : 'gray'} variant={type === 'wet' ? 'filled' : 'outline'} onClick={() => setType('wet')} style={{ fontWeight: 700 }}>ITEM WET</Button>
                        <Button size="xs" color={type === 'dry' ? 'blue' : 'gray'} variant={type === 'dry' ? 'filled' : 'outline'} onClick={() => setType('dry')} style={{ fontWeight: 700 }}>ITEM DRY</Button>
                    </Group>
                </Group>
            </Box>

            <Box p="md">
                <Group align="flex-start" gap="md">
                    {/* Form */}
                    <Paper withBorder p="md" style={{ width: 260, flexShrink: 0 }}>
                        <Stack gap="xs">
                            <TextInput label="No.PO/SJ" size="xs" ref={barcodeRef} placeholder="Scan barcode..." value={form.no_po} onChange={e => f('no_po', e.target.value)} />
                            <Select label="Item" size="xs" searchable data={barangOpts} value={form.barang_id} onChange={v => f('barang_id', v)} placeholder="Pilih barang" />
                            <Select label="Lokasi Gudang" size="xs" searchable data={gudangOpts} value={form.gudang_id} onChange={v => f('gudang_id', v)} placeholder="Pilih lokasi" />
                            <TextInput label="Qty" size="xs" type="number" value={form.qty} onChange={e => f('qty', e.target.value)} />
                            <TextInput label="Batch No" size="xs" value={form.batch_no} onChange={e => f('batch_no', e.target.value)} />
                            <TextInput label="Tgl Expired" size="xs" type="date" value={form.expiry_date} onChange={e => f('expiry_date', e.target.value)} />
                            <Select label="Supplier" size="xs" searchable data={customerOpts} value={form.supplier} onChange={v => f('supplier', v)} placeholder="Pilih supplier" />
                            <TextInput label="Jam Selesai" size="xs" type="time" value={form.jam_selesai} onChange={e => f('jam_selesai', e.target.value)} />
                            <Button fullWidth size="xs" color="yellow" onClick={addDraft} style={{ fontWeight: 700 }}>+ Tambah Draft</Button>
                        </Stack>
                    </Paper>

                    {/* Tables */}
                    <Box style={{ flex: 1 }}>
                        {/* Draft table */}
                        {drafts.length > 0 && (
                            <Box mb="md">
                                <Group justify="space-between" mb="xs">
                                    <Text fw={700} size="sm">DRAFT INBOUND ({drafts.length} item)</Text>
                                    <Button size="xs" color="green" onClick={postAll} style={{ fontWeight: 700 }}>📥 POSTING SEMUA</Button>
                                </Group>
                                <Table withTableBorder withColumnBorders style={{ fontSize: 11 }}>
                                    <Table.Thead style={{ background: '#333' }}>
                                        <Table.Tr>
                                            {['NoPO', 'Item', 'Gudang', 'Qty', 'Batch', 'Expired', 'Supplier', '✕'].map(h => (
                                                <Table.Th key={h} style={{ color: '#fff', fontSize: 11 }}>{h}</Table.Th>
                                            ))}
                                        </Table.Tr>
                                    </Table.Thead>
                                    <Table.Tbody>
                                        {drafts.map((d, i) => (
                                            <Table.Tr key={d.id}>
                                                <Table.Td>{d.no_po}</Table.Td>
                                                <Table.Td fw={600}>{d._brg}</Table.Td>
                                                <Table.Td>{d._gdg}</Table.Td>
                                                <Table.Td ta="right">{d.qty}</Table.Td>
                                                <Table.Td>{d.batch_no}</Table.Td>
                                                <Table.Td>{d.expiry_date}</Table.Td>
                                                <Table.Td>{d.supplier}</Table.Td>
                                                <Table.Td><Button size="xs" color="red" variant="light" onClick={() => setDrafts(p => p.filter((_, j) => j !== i))}>✕</Button></Table.Td>
                                            </Table.Tr>
                                        ))}
                                    </Table.Tbody>
                                </Table>
                            </Box>
                        )}

                        {/* Posted logs */}
                        <Text fw={700} size="sm" mb="xs">INBOUND POSTED ({logs.length})</Text>
                        <Group mb="xs" gap="xs">
                            <TextInput placeholder="Cari..." size="xs" value={search} onChange={e => setSearch(e.target.value)} style={{ width: 200 }} />
                        </Group>
                        <Table withTableBorder withColumnBorders style={{ fontSize: 11 }}>
                            <Table.Thead style={{ background: '#1a1a1a' }}>
                                <Table.Tr>
                                    {['NoPO', 'Item', 'Tgl.Inbound', 'Gudang', 'Tgl.Expired', 'Qty', 'Status', 'Supplier', 'Batch'].map(h => (
                                        <Table.Th key={h} style={{ color: '#fff', fontSize: 11 }}>{h}</Table.Th>
                                    ))}
                                </Table.Tr>
                            </Table.Thead>
                            <Table.Tbody>
                                {logs
                                    .filter(r => !search || r.barang?.nama?.toLowerCase().includes(search.toLowerCase()) || r.no_po?.includes(search))
                                    .map(r => (
                                        <Table.Tr key={r.id}>
                                            <Table.Td>{r.no_po}</Table.Td>
                                            <Table.Td fw={600}>{r.barang?.nama}</Table.Td>
                                            <Table.Td>{fmt(r.created_at)}</Table.Td>
                                            <Table.Td><Badge size="xs" color="blue">{r.gudang?.name}</Badge></Table.Td>
                                            <Table.Td>{fmt(r.expiry_date)}</Table.Td>
                                            <Table.Td ta="right">{r.qty} {r.satuan}</Table.Td>
                                            <Table.Td><Badge size="xs" color={statusColor(r.expiry_date)}>{statusLabel(r.expiry_date)}</Badge></Table.Td>
                                            <Table.Td>{r.supplier || '-'}</Table.Td>
                                            <Table.Td>{r.batch_no || '-'}</Table.Td>
                                        </Table.Tr>
                                    ))}
                            </Table.Tbody>
                        </Table>
                    </Box>
                </Group>
            </Box>
        </Box>
    );
}
