'use client';
// @ts-nocheck
import React, { useState, useEffect, useRef } from 'react';
import {
    Box, Group, Button, Title, Text, Table, Badge, Paper, Stack, TextInput,
    Select, NumberInput, Divider, ActionIcon, Autocomplete
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { api, unwrap } from '../lib/api';

export default function InboundPage() {
    const [type, setType] = useState('wet');
    const [barangs, setBarangs] = useState<any[]>([]);
    const [allGudangs, setAllGudangs] = useState<any[]>([]);
    const [customers, setCustomers] = useState<any[]>([]);
    const [shifts, setShifts] = useState<any[]>([]);
    const [drafts, setDrafts] = useState<any[]>([]);
    const [logs, setLogs] = useState<any[]>([]);
    const [search, setSearch] = useState('');
    const barcodeRef = useRef<any>(null);
    const [selectedZone, setSelectedZone] = useState('');

    const [form, setForm] = useState<any>({
        no_po: '', barang_id: '', qty: 1, satuan: '', batch_no: '',
        expiry_date: '', supplier: '', shift_id: '',
        tanggal_income: new Date().toISOString().split('T')[0],
        jam_datang: '', jam_bongkar: '', jam_selesai: '', gudang_id: ''
    });

    useEffect(() => {
        api().get('/barang').then(r => setBarangs(unwrap(r)));
        api().get('/gudang').then(r => setAllGudangs(unwrap(r)));
        api().get('/customers').then(r => setCustomers(unwrap(r)));
        api().get('/shifts').then(r => setShifts(unwrap(r)));
        loadLogs();
    }, []);

    const loadLogs = () => {
        api().get('/inventory/logs/inbound').then(r => setLogs(unwrap(r)));
    };

    const f = (k: string, v: any) => setForm((p: any) => ({ ...p, [k]: v }));

    const getGudangs = () => {
        if (!selectedZone) return [];
        return allGudangs.filter((g: any) => g.zone?.toUpperCase() === selectedZone.toUpperCase());
    };

    const addDraft = () => {
        if (!form.barang_id && !form.item_manual) return notifications.show({ title: 'Error', message: 'Pilih / isi item', color: 'red' });
        if (!selectedZone) return notifications.show({ title: 'Error', message: 'Pilih Zone Gudang', color: 'red' });

        let brgName = form.item_manual || '';
        if (!brgName && form.barang_id) {
            brgName = barangs.find((b: any) => String(b.id) === String(form.barang_id))?.nama || '';
        }

        setDrafts((p: any[]) => [...p, {
            ...form,
            id: Date.now(),
            _brg: brgName,
            _gdg: allGudangs.find((g: any) => String(g.id) === String(form.gudang_id))?.name || '-',
            _zone: selectedZone
        }]);
        setForm((p: any) => ({ ...p, barang_id: '', item_manual: '', qty: 1, batch_no: '', expiry_date: '', gudang_id: '' }));
        if (barcodeRef.current) barcodeRef.current.focus();
    };

    const postAll = async () => {
        if (!drafts.length) return;
        try {
            await api().post('/inventory/inbound', {
                items: drafts.map((d: any) => ({
                    barang_id: d.barang_id ? Number(d.barang_id) : 0,
                    gudang_id: d.gudang_id ? Number(d.gudang_id) : 0,
                    qty: Number(d.qty),
                    batch_no: d.batch_no,
                    expiry_date: d.expiry_date || null,
                    supplier: d.supplier,
                    no_po: d.no_po,
                    shift_id: d.shift_id ? Number(d.shift_id) : undefined,
                    tanggal_income: d.tanggal_income,
                    jam_datang: d.jam_datang,
                    jam_bongkar: d.jam_bongkar,
                    jam_selesai: d.jam_selesai,
                }))
            });
            notifications.show({ title: 'Sukses', message: 'Semua draft berhasil diposting', color: 'green' });
            setDrafts([]);
            loadLogs();
        } catch (e: any) {
            notifications.show({ title: 'Error', message: unwrap(e.response)?.message || 'Failed', color: 'red' });
        }
    };

    const barangOpts = barangs.map((s: any) => ({ value: String(s.id), label: s.sku ? `${s.sku} - ${s.nama}` : s.nama }));
    const customerOpts = customers.map((c: any) => c.nama || c.name).filter(Boolean);
    const shiftOpts = shifts.map((s: any) => ({ value: String(s.id), label: s.name }));
    const zones = type === 'wet' ? ['CS FROZEN', 'CHILL', 'WASTE'] : ['DRY A', 'DRY B', 'DRY FG'];
    const rakOpts = getGudangs().map((g: any) => ({ value: String(g.id), label: g.name }));
    const poOpts = Array.from(new Set(logs.map((l: any) => l.no_po).filter(Boolean)));
    const satuanOpts = Array.from(new Set([...barangs.map((b: any) => b.satuan), ...logs.map((l: any) => l.satuan)].filter(Boolean)));
    const batchOpts = Array.from(new Set(logs.map((l: any) => l.batch_no).filter(Boolean)));

    const filtered = search ? logs.filter((r: any) => r.barang?.nama?.toLowerCase().includes(search.toLowerCase()) || r.no_po?.includes(search)) : logs;

    return (
        <Box>
            <Box style={{ background: '#fff', borderBottom: '1px solid #ddd', padding: '12px 20px' }}>
                <Group justify="space-between">
                    <Title order={3} style={{ color: '#0ea5e9', fontWeight: 900 }}>INBOUND</Title>
                    <Group gap="xs">
                        <Button size="xs" color={type === 'wet' ? 'yellow' : 'gray'} variant={type === 'wet' ? 'filled' : 'outline'} onClick={() => { setType('wet'); setSelectedZone(''); }} style={{ fontWeight: 700 }}>ITEM WET</Button>
                        <Button size="xs" variant={type === 'dry' ? 'filled' : 'outline'} color={type === 'dry' ? 'blue' : 'gray'} onClick={() => { setType('dry'); setSelectedZone(''); }} style={{ fontWeight: 700 }}>ITEM DRY</Button>
                    </Group>
                </Group>
            </Box>

            <Box p="md">
                <Group align="flex-start" gap="md">
                    <Paper withBorder p="md" style={{ width: 280, flexShrink: 0 }}>
                        <Stack gap="xs">
                            <Autocomplete label="No.PO/SJ" size="xs" ref={barcodeRef} placeholder="Cari / isi No PO..." data={poOpts} value={form.no_po} onChange={(v: string) => f('no_po', v)} />

                            {/* Combobox Select / Input Item Manual */}
                            <Select
                                label="Nama Item"
                                size="xs"
                                searchable
                                data={barangOpts}
                                value={form.barang_id}
                                onChange={(v: any) => f('barang_id', v || '')}
                                placeholder="Pilih dari master produk"
                                clearable
                            />
                            {!form.barang_id && (
                                <TextInput
                                    label="Atau Input Manual" size="xs" placeholder="Ketik nama item manual..."
                                    value={form.item_manual || ''} onChange={(e: any) => f('item_manual', e.target.value)}
                                    styles={{ input: { background: '#fdfbc8' } }}
                                />
                            )}

                            <Divider my={4} />

                            <Box>
                                <Text size="xs" fw={700} mb={4}>Gudang (Zone)</Text>
                                <Group gap={4} style={{ flexWrap: 'wrap' }}>
                                    {zones.map((z: any) => (
                                        <Button key={z} size="xs" variant={selectedZone === z ? 'filled' : 'outline'} color={selectedZone === z ? 'blue' : 'gray'} onClick={() => { setSelectedZone(z); f('gudang_id', ''); }}>{z}</Button>
                                    ))}
                                </Group>
                            </Box>

                            {selectedZone && (
                                <Select label="Sub-Lokasi Gudang / Rak" size="xs" searchable data={rakOpts} value={form.gudang_id} onChange={(v: any) => f('gudang_id', v || '')} placeholder="Pilih rak" />
                            )}

                            <Group gap="xs">
                                <NumberInput label="Qty" size="xs" value={form.qty} onChange={(v: any) => f('qty', v)} style={{ flex: 1 }} />
                                <Autocomplete label="Satuan" size="xs" data={satuanOpts} value={form.satuan} onChange={(v: string) => f('satuan', v)} w={80} placeholder="Pcs/Ltr" />
                            </Group>
                            <Autocomplete label="Batch No" size="xs" data={batchOpts} value={form.batch_no} onChange={(v: string) => f('batch_no', v)} placeholder="Isi / Pilih Batch" />
                            <TextInput label="Tgl Expired" size="xs" type="date" value={form.expiry_date} onChange={(e: any) => f('expiry_date', e.target.value)} />
                            <Autocomplete label="Supplier" size="xs" data={customerOpts} value={form.supplier} onChange={(v: string) => f('supplier', v)} placeholder="Pilih / ketik manual supplier" />
                            <Select label="Shift" size="xs" data={shiftOpts} value={form.shift_id} onChange={(v: any) => f('shift_id', v || '')} placeholder="Pilih shift" clearable />

                            <Divider my={2} />
                            <Text size="xs" fw={700} c="dimmed">Waktu Kedatangan & Income</Text>
                            <TextInput label="Tanggal Income" size="xs" type="date" value={form.tanggal_income} onChange={(e: any) => f('tanggal_income', e.target.value)} mb="xs" />
                            <Group gap="xs">
                                <TextInput label="Jam Datang" size="xs" type="time" value={form.jam_datang} onChange={(e: any) => f('jam_datang', e.target.value)} style={{ flex: 1 }} />
                                <TextInput label="Jam Bongkar" size="xs" type="time" value={form.jam_bongkar} onChange={(e: any) => f('jam_bongkar', e.target.value)} style={{ flex: 1 }} />
                            </Group>
                            <TextInput label="Jam Selesai" size="xs" type="time" value={form.jam_selesai} onChange={(e: any) => f('jam_selesai', e.target.value)} />

                            <Button fullWidth size="xs" color="yellow" onClick={addDraft} style={{ fontWeight: 800, marginTop: '8px' }}>+ Tambah Draft</Button>
                        </Stack>
                    </Paper>

                    {/* Tables omitted detail, using proper types... */}
                    <Box style={{ flex: 1 }}>
                        {drafts.length > 0 && (
                            <Box mb="md">
                                <Group justify="space-between" mb="xs">
                                    <Text fw={700} size="sm">DRAFT INBOUND ({drafts.length} item)</Text>
                                    <Button size="xs" color="green" onClick={postAll} style={{ fontWeight: 800 }}>📥 POSTING SEMUA</Button>
                                </Group>
                                <Table withTableBorder withColumnBorders style={{ fontSize: 11 }}>
                                    <Table.Thead style={{ background: '#333' }}>
                                        <Table.Tr>
                                            {['NoPO', 'Item', 'Zone', 'Rak', 'Qty', 'Tgl Income', 'Batch', 'Expired', 'Supplier', 'Shift', '✕'].map((h: string) => (
                                                <Table.Th key={h} style={{ color: '#fff', fontSize: 11 }}>{h}</Table.Th>
                                            ))}
                                        </Table.Tr>
                                    </Table.Thead>
                                    <Table.Tbody>
                                        {drafts.map((d: any, i: number) => (
                                            <Table.Tr key={d.id || i}>
                                                <Table.Td>{d.no_po}</Table.Td>
                                                <Table.Td fw={700}>{d._brg}</Table.Td>
                                                <Table.Td><Badge size="xs" color="teal">{d._zone}</Badge></Table.Td>
                                                <Table.Td><Badge size="xs" color="blue">{d._gdg}</Badge></Table.Td>
                                                <Table.Td ta="right">{d.qty}</Table.Td>
                                                <Table.Td>{d.tanggal_income}</Table.Td>
                                                <Table.Td>{d.batch_no}</Table.Td>
                                                <Table.Td>{d.expiry_date}</Table.Td>
                                                <Table.Td>{d.supplier}</Table.Td>
                                                <Table.Td>{shifts.find((s: any) => String(s.id) === String(d.shift_id))?.name || '-'}</Table.Td>
                                                <Table.Td>
                                                    <ActionIcon size="sm" color="red" variant="light" onClick={() => setDrafts((p: any[]) => p.filter((_, j: number) => j !== i))}>✕</ActionIcon>
                                                </Table.Td>
                                            </Table.Tr>
                                        ))}
                                    </Table.Tbody>
                                </Table>
                            </Box>
                        )}

                        <Group justify="space-between" mb="xs" mt="lg">
                            <Text fw={700} size="sm">ITEM POSTED HARI INI ({filtered.length})</Text>
                            <TextInput placeholder="Cari posted..." size="xs" value={search} onChange={(e: any) => setSearch(e.target.value)} style={{ width: 250 }} />
                        </Group>
                        <Table withTableBorder withColumnBorders style={{ fontSize: 11 }}>
                            <Table.Thead style={{ background: '#1a1a1a' }}>
                                <Table.Tr>
                                    {['NoPO', 'Item', 'Tanggal Income', 'Zone', 'Rak', 'Qty', 'Expired', 'Supplier', 'Shift'].map((h: string) => (
                                        <Table.Th key={h} style={{ color: '#fff', fontSize: 11 }}>{h}</Table.Th>
                                    ))}
                                </Table.Tr>
                            </Table.Thead>
                            <Table.Tbody>
                                {filtered.map((r: any) => (
                                    <Table.Tr key={r.id}>
                                        <Table.Td>{r.no_po || '-'}</Table.Td>
                                        <Table.Td fw={700}>{r.barang?.nama}</Table.Td>
                                        <Table.Td>{r.tanggal_income ? r.tanggal_income : new Date(r.created_at).toLocaleDateString()}</Table.Td>
                                        <Table.Td><Badge size="xs" color="teal">{r.gudang?.zone || '-'}</Badge></Table.Td>
                                        <Table.Td><Badge size="xs" color="blue">{r.gudang?.name || '-'}</Badge></Table.Td>
                                        <Table.Td ta="right">{r.qty} {r.satuan}</Table.Td>
                                        <Table.Td>{r.expiry_date ? new Date(r.expiry_date).toISOString().split('T')[0] : '-'}</Table.Td>
                                        <Table.Td>{r.supplier || '-'}</Table.Td>
                                        <Table.Td>{r.shift?.name || '-'}</Table.Td>
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
