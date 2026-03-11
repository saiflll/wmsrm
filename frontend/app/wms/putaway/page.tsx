// @ts-nocheck
'use client';
import React, { useState, useEffect } from 'react';
import {
    Box, Group, Button, Title, Text, Table, Badge, Paper, Stack,
    TextInput, Select, Loader, NumberInput, Divider, Autocomplete
} from '@mantine/core';
import { IconPlus, IconTrash, IconFileTypePdf, IconFileSpreadsheet } from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import { api, unwrap, fmt, statusLabel, statusColor, saveXlsx } from '../lib/api';
import * as XLSX from 'xlsx';

const renderColorfulOption: any = ({ option }: any) => {
    if (option.isEmpty) {
        return (
            <Group gap={6} wrap="nowrap">
                <Badge color="green" variant="filled" style={{ textTransform: 'none' }}>{option.locName}</Badge>
                <Badge color="gray" variant="filled" style={{ textTransform: 'none' }}>KOSONG</Badge>
            </Group>
        );
    }
    if (option.locName) {
        return (
            <Group gap={6} wrap="nowrap">
                <Badge color="green" variant="filled" style={{ textTransform: 'none' }}>{option.locName}</Badge>
                <Badge color="orange" variant="filled" style={{ textTransform: 'none' }}>{option.itemNames}</Badge>
                <Badge color="blue" variant="filled" style={{ textTransform: 'none' }}>{option.qtyStr}</Badge>
            </Group>
        );
    }
    return <Text size="sm">{option.label}</Text>;
};

export default function PutawayPage() {
    const [type, setType] = useState('wet');
    const [stocks, setStocks] = useState<any[]>([]);
    const [barangs, setBarangs] = useState<any[]>([]);
    const [allGudangs, setAllGudangs] = useState<any[]>([]);
    const [inboundLogs, setInboundLogs] = useState<any[]>([]);
    const [search, setSearch] = useState('');
    const [filterStatus, setFilterStatus] = useState('');
    const [filterRak, setFilterRak] = useState('');
    const [loading, setLoading] = useState(true);
    const [form, setForm] = useState({
        no_po: '',
        stock_id: '',
        gudang_tujuan_id: '',
        qty: 0,
    });

    const [selectedBarangId, setSelectedBarangId] = useState('');
    const [selectedZoneTujuan, setSelectedZoneTujuan] = useState('');

    useEffect(() => { load(); }, [type]);

    const load = async () => {
        setLoading(true);
        try {
            const side = type === 'dry';
            const [s, g, il, b] = await Promise.all([
                api().get(`/inventory/stock?side=${side}`),
                api().get(`/gudang?side=${side}`),
                api().get('/inventory/logs/inbound'),
                api().get('/barang'),
            ]);
            setStocks(unwrap(s));
            setAllGudangs(unwrap(g));
            setInboundLogs(unwrap(il).filter((l: any) => type === 'wet' ? !l.barang?.side : l.barang?.side));
            setBarangs(unwrap(b));
        } catch (e) { console.error(e); }
        setLoading(false);
    };

    const relocate = async () => {
        if (!form.stock_id || !form.gudang_tujuan_id || !form.qty) {
            return notifications.show({ title: 'Error', message: 'Pilih stock, lokasi tujuan, dan qty', color: 'red' });
        }
        try {
            await api().post('/inventory/relocation', {
                stock_id: +form.stock_id,
                gudang_tujuan_id: +form.gudang_tujuan_id,
                qty: +form.qty,
            });
            const stk = stocks.find((s: any) => s.id === +form.stock_id);
            notifications.show({ title: 'Sukses', message: `${stk?.barang?.nama} berhasil dipindahkan`, color: 'green' });
            setForm({ no_po: '', stock_id: '', gudang_tujuan_id: '', qty: 0 });
            setSelectedZoneTujuan('');
            load();
        } catch (e: any) {
            notifications.show({ title: 'Error', message: unwrap(e.response)?.message || 'Failed', color: 'red' });
        }
    };

    const ZONES_WET = ['CS FROZEN', 'CHILL', 'WASTE'];
    const ZONES_DRY = ['DRY A', 'DRY B', 'DRY FG'];
    const defaultZones = type === 'wet' ? ZONES_WET : ZONES_DRY;

    const dynamicZones = Array.from(new Set(allGudangs.map((g: any) => g.zone).filter(Boolean)));
    // Add "Reject" option to all zones and merge dynamic + default
    const allZonesWithReject = Array.from(new Set([...defaultZones, ...dynamicZones, 'REJECT']));

    // Stocks for the selected source
    const selStock = stocks.find((s: any) => s.id === +form.stock_id);

    // Rak options for tujuan zone (include Reject as special)
    const tujuanRakOpts = selectedZoneTujuan === 'REJECT'
        ? allGudangs.filter((g: any) => g.zone === 'REJECT').map((g: any) => ({ value: String(g.id), label: `${g.name} (REJECT AREA)`, locName: g.name, isEmpty: true, disabled: false }))
        : selectedZoneTujuan
            ? allGudangs.filter((g: any) => g.zone === selectedZoneTujuan).map((g: any) => {
                const stockInRack = stocks.filter((s: any) => String(s.gudang?.id) === String(g.id));
                const totalQty = stockInRack.reduce((acc: number, s: any) => acc + s.qty, 0);

                let disabled = false;
                if (totalQty > 0) {
                    // If there's stock in the rack, check for product conflict
                    // A rack is disabled if it contains a different product than the one being moved
                    if (selectedBarangId && stockInRack.some((s: any) => s.barang && String(s.barang.id) !== String(selectedBarangId))) {
                        disabled = true;
                    }
                    // If the selected stock is already in this rack, it's also disabled (no self-relocation to same rack)
                    if (selStock && String(selStock.gudang?.id) === String(g.id)) {
                        disabled = true;
                    }

                    const produkNames = Array.from(new Set(stockInRack.map((s: any) => s.barang?.nama).filter(Boolean))).join(', ');
                    return {
                        value: String(g.id),
                        label: `${g.name} — ${produkNames} (${totalQty} qty)`,
                        locName: g.name,
                        itemNames: produkNames,
                        qtyStr: `${totalQty} qty`,
                        disabled,
                        isEmpty: false
                    };
                }
                // If the rack is empty, it's not disabled unless it's the source rack
                if (selStock && String(selStock.gudang?.id) === String(g.id)) {
                    disabled = true;
                }
                return { value: String(g.id), label: `${g.name} (KOSONG)`, locName: g.name, isEmpty: true, disabled: disabled };
            })
            : [];

    // Filter options for current stocks right table
    const filteredStocks = stocks
        .filter((r: any) => !filterRak || r.gudang?.name?.toLowerCase().includes(filterRak.toLowerCase()) || r.barang?.nama?.toLowerCase().includes(filterRak.toLowerCase()))
        .filter((r: any) => !filterStatus || filterStatus === 'all' ||
            (filterStatus === 'reject' ? false : statusLabel(r.expiry_date) === filterStatus));

    const poOpts = Array.from(new Set(inboundLogs.map((l: any) => l.no_po).filter(Boolean)));

    const stockOpts = stocks
        .filter((s: any) => !selectedBarangId || String(s.barang?.id) === String(selectedBarangId))
        .map((s: any) => ({
            value: String(s.id),
            label: `[Zone ${s.gudang?.zone}] Rak ${s.gudang?.name} (Tersedia: ${s.qty} ${s.satuan || ''})`,
            locName: `[Zone ${s.gudang?.zone}] Rak ${s.gudang?.name}`,
            itemNames: s.barang?.nama || 'Unknown',
            qtyStr: `Tersedia: ${s.qty} ${s.satuan || ''}`
        }));

    const barangOpts = barangs.map((b: any) => ({ value: String(b.id), label: b.sku ? `${b.sku} - ${b.nama}` : b.nama }));

    return (
        <Box>
            <Box style={{ background: '#fff', borderBottom: '1px solid #ddd', padding: '12px 20px' }}>
                <Group justify="space-between">
                    <Title order={3} style={{ color: '#e6921e', fontWeight: 900 }}>PUTAWAY (RELOCATION)</Title>
                    <Group gap="xs">
                        <Button size="xs" color={type === 'wet' ? 'yellow' : 'gray'} variant={type === 'wet' ? 'filled' : 'outline'} onClick={() => { setType('wet'); setSelectedZoneTujuan(''); }} style={{ fontWeight: 700 }}>ITEM WET</Button>
                        <Button size="xs" color={type === 'dry' ? 'blue' : 'gray'} variant={type === 'dry' ? 'filled' : 'outline'} onClick={() => { setType('dry'); setSelectedZoneTujuan(''); }} style={{ fontWeight: 700 }}>ITEM DRY</Button>
                    </Group>
                </Group>
            </Box>

            <Box p="md">
                <Group align="flex-start" gap="md">
                    {/* Left form */}
                    <Paper withBorder p="md" style={{ width: 270, flexShrink: 0 }}>
                        <Stack gap="xs">
                            <Autocomplete label="No.PO/SJ" size="xs" data={poOpts} value={form.no_po} onChange={v => setForm(p => ({ ...p, no_po: v }))} placeholder="Ketik / Pilih No PO referensi" />

                            <Select
                                label="Nama Item (Master Produk)"
                                size="xs"
                                searchable
                                clearable
                                data={barangOpts}
                                value={selectedBarangId}
                                onChange={v => {
                                    setSelectedBarangId(v || '');
                                    setForm(p => ({ ...p, stock_id: '', qty: 0 }));
                                }}
                                placeholder="Pilih dari master produk"
                            />

                            <Select
                                label="Stock (Pilih Rak Asal)"
                                size="xs"
                                searchable
                                data={stockOpts}
                                value={form.stock_id}
                                onChange={v => setForm(p => ({ ...p, stock_id: v || '', qty: stocks.find((s: any) => s.id === +v)?.qty || 0 }))}
                                placeholder="Pilih item"
                                renderOption={renderColorfulOption}
                            />

                            {/* Auto-fill info */}
                            {selStock && (
                                <Box style={{ background: '#f8f9fa', borderRadius: 6, padding: '6px 8px', fontSize: 11 }}>
                                    <Text size="xs" c="dimmed">Item: <b>{selStock.barang?.nama}</b></Text>
                                    <Text size="xs" c="dimmed">Tgl Expired: <b style={{ color: selStock.expiry_date ? statusColor(selStock.expiry_date) === 'red' ? 'red' : 'inherit' : 'inherit' }}>{selStock.expiry_date ? fmt(selStock.expiry_date) : '-'} [Otomatis Relasi]</b></Text>
                                    <Text size="xs" c="dimmed">Qty Tersedia: <b>{selStock.qty} {selStock.satuan}</b></Text>
                                </Box>
                            )}

                            <NumberInput
                                label="Qty Dipindahkan (bisa di-split)"
                                size="xs"
                                value={form.qty}
                                onChange={v => setForm(p => ({ ...p, qty: Number(v) }))}
                                min={1}
                                max={selStock?.qty}
                            />
                            {selStock && form.qty < selStock.qty && (
                                <Text size="xs" c="orange" fw={600}>⚠ Split Qty: {form.qty} dari {selStock.qty} {selStock.satuan}</Text>
                            )}

                            <Divider my={4} />
                            <Text size="xs" fw={600}>Transfer Location</Text>
                            <Select
                                label="Zone Tujuan"
                                size="xs"
                                searchable
                                data={allZonesWithReject}
                                value={selectedZoneTujuan}
                                onChange={v => { setSelectedZoneTujuan(v || ''); setForm(p => ({ ...p, gudang_tujuan_id: '' })); }}
                                placeholder="Pilih zone tujuan"
                            />

                            {selectedZoneTujuan && selectedZoneTujuan !== 'REJECT' && (
                                <Select
                                    label="Nomor Rak Tujuan"
                                    size="xs"
                                    searchable
                                    data={tujuanRakOpts}
                                    value={form.gudang_tujuan_id}
                                    onChange={v => setForm(p => ({ ...p, gudang_tujuan_id: v || '' }))}
                                    placeholder="Pilih rak"
                                    renderOption={renderColorfulOption}
                                />
                            )}

                            <Button fullWidth size="sm" color="blue" onClick={relocate} style={{ fontWeight: 700, marginTop: 4 }}>
                                PINDAHKAN
                            </Button>

                            <Text size="xs" c="red" fw={600} style={{ textAlign: 'center' }}>
                                NOTE: RELOCATION INI BISA DI SPLIT DARI QTY INCOMING!
                            </Text>
                        </Stack>
                    </Paper>

                    {/* Right table */}
                    <Box style={{ flex: 1 }}>
                        {/* Filters */}
                        <Group mb="xs" gap="xs">
                            <TextInput
                                placeholder="Cari berdasarkan ID, kode..."
                                size="xs"
                                value={filterRak}
                                onChange={e => setFilterRak(e.target.value)}
                                style={{ width: 200 }}
                            />
                            <Button
                                size="xs"
                                variant={filterStatus === 'NEAR EXPIRED' ? 'filled' : 'outline'}
                                color="orange"
                                onClick={() => setFilterStatus(p => p === 'NEAR EXPIRED' ? '' : 'NEAR EXPIRED')}
                            >
                                Near Expired
                            </Button>
                            <Button
                                size="xs"
                                variant={filterStatus === 'EXPIRED' ? 'filled' : 'outline'}
                                color="red"
                                onClick={() => setFilterStatus(p => p === 'EXPIRED' ? '' : 'EXPIRED')}
                            >
                                Reject
                            </Button>
                            <Button size="xs" color="gray" variant="outline" onClick={() => { setFilterRak(''); setFilterStatus(''); }}>Reset</Button>
                        </Group>

                        <Group mb="xs" gap="xs">
                            <Text size="xs" fw={600}>dari</Text>
                            <TextInput type="date" size="xs" style={{ width: 130 }} />
                            <Text size="xs" fw={600}>sampai</Text>
                            <TextInput type="date" size="xs" style={{ width: 130 }} />
                            <Button size="xs" color="blue">Filter</Button>
                        </Group>

                        <Text fw={700} size="sm" mb="xs">ITEM {type.toUpperCase()} - STOK SAAT INI ({filteredStocks.length})</Text>

                        {loading ? <Loader /> : (
                            <Table withTableBorder withColumnBorders style={{ fontSize: 11 }}>
                                <Table.Thead style={{ background: '#1a1a1a' }}>
                                    <Table.Tr>
                                        {['Batch', 'Item', 'Tgl.Incoming', 'Nomor Rak', 'Tgl.Expired', 'Qty', 'Status', 'Location'].map((h: any) => (
                                            <Table.Th key={h} style={{ color: '#fff', fontSize: 11 }}>{h}</Table.Th>
                                        ))}
                                    </Table.Tr>
                                </Table.Thead>
                                <Table.Tbody>
                                    {filteredStocks.map((r: any) => {
                                        const sl = statusLabel(r.expiry_date);
                                        const isReject = sl === 'EXPIRED';
                                        return (
                                            <Table.Tr key={r.id} style={{ background: isReject ? '#fff5f5' : undefined }}>
                                                <Table.Td>{r.batch_no || '-'}</Table.Td>
                                                <Table.Td fw={600}>{r.barang?.nama}</Table.Td>
                                                <Table.Td>{fmt(r.created_at)}</Table.Td>
                                                <Table.Td><Badge size="xs" color="blue">{r.gudang?.name}</Badge></Table.Td>
                                                <Table.Td>{fmt(r.expiry_date)}</Table.Td>
                                                <Table.Td ta="right">{r.qty} {r.satuan}</Table.Td>
                                                <Table.Td>
                                                    <Badge size="xs" color={isReject ? 'red' : statusColor(r.expiry_date)} variant={isReject ? 'filled' : 'light'}>
                                                        {isReject ? 'Reject' : sl}
                                                    </Badge>
                                                </Table.Td>
                                                <Table.Td><Badge size="xs" color="teal">{r.gudang?.zone}</Badge></Table.Td>
                                            </Table.Tr>
                                        );
                                    })}
                                </Table.Tbody>
                            </Table>
                        )}
                    </Box>
                </Group>
            </Box>
        </Box>
    );
}
