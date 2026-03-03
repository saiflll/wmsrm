// @ts-nocheck
'use client';
import React, { useState, useEffect } from 'react';
import {
    Box, Group, Button, Title, Text, Table, Badge, Paper, Stack,
    TextInput, Select, Loader, NumberInput, Divider, Autocomplete
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { api, unwrap, fmt, statusLabel, statusColor } from '../lib/api';

export default function RelocationPage() {
    const [type, setType] = useState('wet');
    const [stocks, setStocks] = useState<any[]>([]);
    const [barangs, setBarangs] = useState<any[]>([]);
    const [allGudangs, setAllGudangs] = useState<any[]>([]);
    const [logs, setLogs] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [filterSearch, setFilterSearch] = useState('');
    const [filterRak, setFilterRak] = useState('');

    const [selectedZoneTujuan, setSelectedZoneTujuan] = useState('');
    const [selectedBarangId, setSelectedBarangId] = useState('');

    const [selStock, setSelStock] = useState('');
    const [selDest, setSelDest] = useState('');
    const [relQty, setRelQty] = useState(0);
    const [noPo, setNoPo] = useState('');

    useEffect(() => { load(); }, [type]);

    const load = async () => {
        setLoading(true);
        try {
            const side = type === 'dry';
            const [s, g, l, b] = await Promise.all([
                api().get(`/inventory/stock?side=${side}`),
                api().get(`/gudang?side=${side}`),
                api().get('/inventory/logs'),
                api().get('/barang')
            ]);
            setStocks(unwrap(s));
            setAllGudangs(unwrap(g));
            setLogs(unwrap(l).filter((log: any) => type === 'wet' ? !log.barang?.side : log.barang?.side));
            setBarangs(unwrap(b));
        } catch (e) { console.error(e); }
        setLoading(false);
    };

    const doRelocate = async () => {
        if (!selStock || !selDest || !relQty) return notifications.show({ title: 'Error', message: 'Lengkapi form', color: 'red' });
        try {
            await api().post('/inventory/relocation', {
                stock_id: +selStock,
                gudang_tujuan_id: +selDest,
                qty: relQty,
                no_po: noPo || '-'
            });
            notifications.show({ title: 'Sukses', message: 'Relokasi berhasil', color: 'green' });
            setSelStock(''); setSelDest(''); setRelQty(0); setNoPo(''); setSelectedZoneTujuan('');
            load();
        } catch (e: any) {
            notifications.show({ title: 'Error', message: unwrap(e.response)?.message || 'Gagal', color: 'red' });
        }
    };

    const stockOpts = stocks
        .filter((s: any) => !selectedBarangId || String(s.barang?.id) === String(selectedBarangId))
        .map((s: any) => ({
            value: String(s.id),
            label: `[Zone ${s.gudang?.zone}] Rak ${s.gudang?.name} (Tersedia: ${s.qty} ${s.satuan || ''})`
        }));

    const barangOpts = barangs.map((b: any) => ({ value: String(b.id), label: b.sku ? `${b.sku} - ${b.nama}` : b.nama }));
    const ZONES_WET = ['CS FROZEN', 'CHILL', 'WASTE'];
    const ZONES_DRY = ['DRY A', 'DRY B', 'DRY FG'];
    const defaultZones = type === 'wet' ? ZONES_WET : ZONES_DRY;

    const dynamicZones = Array.from(new Set(allGudangs.map((g: any) => g.zone).filter(Boolean)));
    const allZonesWithReject = Array.from(new Set([...defaultZones, ...dynamicZones, 'REJECT']));
    const tujuanRakOpts = selectedZoneTujuan === 'REJECT'
        ? [{ value: 'reject', label: 'Reject Area' }]
        : selectedZoneTujuan
            ? allGudangs.filter((g: any) => g.zone === selectedZoneTujuan).map((g: any) => {
                const stockInRack = stocks.filter((s: any) => String(s.gudang?.id) === String(g.id));
                const isItemExistInRack = stockInRack.reduce((acc: number, s: any) => acc + s.qty, 0);
                const label = isItemExistInRack > 0
                    ? `${g.name} (Terisi ${isItemExistInRack} qty dari ${stockInRack.length} jenis)`
                    : `${g.name} (KOSONG)`;
                return { value: String(g.id), label };
            })
            : [];

    const poOpts = Array.from(new Set(logs.map((l: any) => l.no_po || l.no_ref).filter(Boolean)));

    const selStockObj = stocks.find((s: any) => s.id === +selStock);
    const filteredLogs = logs
        .filter((r: any) => r.type === 'RELOCATION')
        .filter((r: any) => !filterSearch || r.barang?.nama?.toLowerCase().includes(filterSearch.toLowerCase()))
        .filter((r: any) => !filterRak || r.gudang?.name?.includes(filterRak) || r.gudang_tujuan?.name?.includes(filterRak));

    return (
        <Box>
            <Box style={{ background: '#fff', borderBottom: '1px solid #ddd', padding: '12px 20px' }}>
                <Group justify="space-between">
                    <Title order={3} style={{ color: '#e6921e', fontWeight: 900 }}>RELOCATION</Title>
                    <Group gap="xs">
                        <Button size="xs" color={type === 'wet' ? 'yellow' : 'gray'} variant={type === 'wet' ? 'filled' : 'outline'} onClick={() => { setType('wet'); setSelectedZoneTujuan(''); }} style={{ fontWeight: 700 }}>ITEM WET</Button>
                        <Button size="xs" variant={type === 'dry' ? 'filled' : 'outline'} color={type === 'dry' ? 'blue' : 'gray'} onClick={() => { setType('dry'); setSelectedZoneTujuan(''); }} style={{ fontWeight: 700 }}>ITEM DRY</Button>
                    </Group>
                </Group>
            </Box>

            <Box p="md">
                <Group align="flex-start" gap="md">
                    {/* Left form */}
                    <Paper withBorder p="md" style={{ width: 260, flexShrink: 0 }}>
                        <Stack gap="xs">
                            <Autocomplete label="No.PO/SJ" size="xs" data={poOpts} value={noPo} onChange={v => setNoPo(v)} placeholder="Cari / Isi Referensi" />

                            <Select
                                label="Nama Item (Master Produk)"
                                size="xs"
                                searchable
                                clearable
                                data={barangOpts}
                                value={selectedBarangId}
                                onChange={v => {
                                    setSelectedBarangId(v || '');
                                    setSelStock('');
                                    setRelQty(0);
                                }}
                                placeholder="Pilih dari master produk"
                            />

                            <Select
                                label="Stock (Pilih Rak Asal)"
                                size="xs"
                                searchable
                                data={stockOpts}
                                value={selStock}
                                onChange={v => {
                                    setSelStock(v || '');
                                    const st = stocks.find((s: any) => s.id === +(v || ''));
                                    setRelQty(st?.qty || 0);
                                    if (st) {
                                        // Auto-fetch original PO
                                        const inLog = logs.find((l: any) => l.type === 'INBOUND' && l.barang?.id === st.barang?.id && l.gudang?.id === st.gudang?.id);
                                        if (inLog && inLog.no_po) setNoPo(inLog.no_po);
                                    }
                                }}
                                placeholder="Pilih item dari rak"
                            />

                            {/* Auto-info */}
                            {selStockObj && (
                                <Box style={{ background: '#f8f9fa', borderRadius: 6, padding: '6px 8px', fontSize: 11 }}>
                                    <Text size="xs" c="dimmed">Tgl Expired: <b>{selStockObj.expiry_date ? fmt(selStockObj.expiry_date) : '-'}</b> [Otomatis Relasi]</Text>
                                    <Text size="xs" c="dimmed">Qty: <b>{selStockObj.qty} {selStockObj.satuan}</b></Text>
                                </Box>
                            )}

                            <NumberInput
                                label="Qty"
                                size="xs"
                                value={relQty}
                                onChange={v => setRelQty(Number(v))}
                                min={1}
                                max={selStockObj?.qty}
                            />
                            {selStockObj && relQty < selStockObj.qty && relQty > 0 && (
                                <Text size="xs" c="orange" fw={600}>⚠ Split: {relQty} dari {selStockObj.qty}</Text>
                            )}

                            <Divider my={4} />
                            <Select
                                label="Zone Tujuan"
                                size="xs"
                                searchable
                                data={allZonesWithReject}
                                value={selectedZoneTujuan}
                                onChange={v => { setSelectedZoneTujuan(v || ''); setSelDest(''); }}
                                placeholder="Pilih zone tujuan"
                            />

                            {selectedZoneTujuan && selectedZoneTujuan !== 'REJECT' && (
                                <Select
                                    label="Nomor Rak Tujuan"
                                    size="xs"
                                    searchable
                                    data={tujuanRakOpts}
                                    value={selDest}
                                    onChange={v => setSelDest(v || '')}
                                    placeholder="A1.1, A1.2..."
                                />
                            )}

                            <Button fullWidth size="sm" color="blue" onClick={doRelocate} style={{ fontWeight: 700, marginTop: 4 }}>
                                PINDAHKAN
                            </Button>
                            <Text size="xs" c="red" fw={600} ta="center" size="xs">
                                NOTE: RELOCATION INI BISA DI SPLIT DARI QTY INCOMING!
                            </Text>
                        </Stack>
                    </Paper>

                    {/* Right table */}
                    <Box style={{ flex: 1 }}>
                        <Group mb="xs" gap="xs">
                            <TextInput placeholder="Cari item..." size="xs" value={filterSearch} onChange={e => setFilterSearch(e.target.value)} style={{ width: 180 }} />
                            <TextInput placeholder="Filter rak..." size="xs" value={filterRak} onChange={e => setFilterRak(e.target.value)} style={{ width: 120 }} />
                            <Button size="xs" color="gray" variant="outline" onClick={() => { setFilterSearch(''); setFilterRak(''); }}>Reset</Button>
                            <Group gap="xs" ml="auto">
                                <Text size="xs" fw={600}>dari</Text>
                                <TextInput type="date" size="xs" style={{ width: 130 }} />
                                <Text size="xs" fw={600}>sampai</Text>
                                <TextInput type="date" size="xs" style={{ width: 130 }} />
                                <Button size="xs" color="blue">Filter</Button>
                            </Group>
                        </Group>

                        <Text fw={700} size="sm" mb="xs">RIWAYAT RELOKASI ({filteredLogs.length})</Text>
                        {loading ? <Loader /> : (
                            <Table withTableBorder withColumnBorders style={{ fontSize: 11 }}>
                                <Table.Thead style={{ background: '#1a1a1a' }}>
                                    <Table.Tr>
                                        {['NoPO', 'Item', 'Tgl.Incoming', 'Nomor Rak (Asal)', 'Tgl.Expired', 'Qty', 'Status', 'Location (Tujuan)'].map((h: any) => (
                                            <Table.Th key={h} style={{ color: '#fff', fontSize: 11 }}>{h}</Table.Th>
                                        ))}
                                    </Table.Tr>
                                </Table.Thead>
                                <Table.Tbody>
                                    {filteredLogs.map((r: any) => (
                                        <Table.Tr key={r.id}>
                                            <Table.Td>{r.no_po || '-'}</Table.Td>
                                            <Table.Td fw={600}>{r.barang?.nama}</Table.Td>
                                            <Table.Td>{fmt(r.created_at)}</Table.Td>
                                            <Table.Td><Badge size="xs" color="blue">{r.gudang?.name}</Badge></Table.Td>
                                            <Table.Td>{fmt(r.expiry_date)}</Table.Td>
                                            <Table.Td ta="right">{r.qty} {r.satuan}</Table.Td>
                                            <Table.Td>
                                                <Badge size="xs" color={statusColor(r.expiry_date)} variant="filled">
                                                    {statusLabel(r.expiry_date)}
                                                </Badge>
                                            </Table.Td>
                                            <Table.Td><Badge size="xs" color="green">{r.gudang_tujuan?.name || '-'}</Badge></Table.Td>
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
