// @ts-nocheck
'use client';
import React, { useState, useEffect, useRef } from 'react';
import {
    Box, Group, Button, Title, Text, Table, Badge, Paper, Stack,
    TextInput, Select, Loader, NumberInput, Divider, Autocomplete, ActionIcon, Tooltip, Grid, Modal, Textarea
} from '@mantine/core';
import {
    IconEdit, IconTrash, IconFileTypePdf, IconPlus, IconSend, IconBuildingWarehouse, IconHistory
} from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import { api, unwrap, fmt, statusLabel, statusColor } from '../lib/api';

const renderColorfulOption: any = ({ option }: any) => {
    if (option.locName) {
        return (
            <Group gap={6} wrap="nowrap">
                <Badge color="green" variant="filled" size="xs" style={{ textTransform: 'none' }}>{option.locName}</Badge>
                {option.itemNames && (
                    <Badge color="orange" variant="light" size="xs" style={{ textTransform: 'none', maxWidth: 150 }}>
                        {option.itemNames.length > 25 ? option.itemNames.slice(0, 25) + '...' : option.itemNames}
                    </Badge>
                )}
                {option.qtyStr && (
                    <Text size="xs" c="blue" fw={600}>{option.qtyStr}</Text>
                )}
            </Group>
        );
    }
    return <Text size="sm">{option.label}</Text>;
};

export default function PickingPage() {
    const [type, setType] = useState('wet');
    const [allGudangs, setAllGudangs] = useState<any[]>([]);
    const [stocks, setStocks] = useState<any[]>([]);
    const [barangs, setBarangs] = useState<any[]>([]);
    const [logs, setLogs] = useState<any[]>([]);
    const [customers, setCustomers] = useState<any[]>([]);
    const [shifts, setShifts] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [drafts, setDrafts] = useState<any[]>(() => {
        if (typeof window !== "undefined") {
            try {
                const saved = localStorage.getItem("wms_picking_drafts");
                return saved ? JSON.parse(saved) : [];
            } catch (e) {}
        }
        return [];
    });
    const draftSavedRef = useRef(false);

    const [koreksiOpen, setKoreksiOpen] = useState(false);
    const [koreksiItems, setKoreksiItems] = useState<any[]>([]);

    // Zone & Product filter for Rak Selector
    const [selectedZone, setSelectedZone] = useState('');
    const [selectedBarangId, setSelectedBarangId] = useState('');

    // Sorting states
    const [sortKey, setSortKey] = useState<string | null>(null);
    const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

    const [form, setForm] = useState({
        stock_id: '', qty: 1, tujuan: '', no_ref: '', shift_id: '',
        tanggal_permintaan: new Date().toISOString().split('T')[0],
        nomor_batch: '',
    });

    const ZONES_WET = ['CS FROZEN', 'CHILL', 'WASTE'];
    const ZONES_DRY = ['DRY A', 'DRY B', 'DRY FG'];
    const zones = type === 'wet' ? ZONES_WET : ZONES_DRY;

    useEffect(() => { load(); }, [type]);

    // Save drafts to localStorage on change (skip initial render)
    useEffect(() => {
        if (!draftSavedRef.current) { draftSavedRef.current = true; return; }
        localStorage.setItem("wms_picking_drafts", JSON.stringify(drafts));
    }, [drafts]);

    const load = async () => {
        setLoading(true);
        try {
            const side = type === 'dry';
            const [s, l, c, sh, g, b] = await Promise.all([
                api().get(`/inventory/stock?side=${side}`),
                api().get('/inventory/logs/picking'),
                api().get('/customers'),
                api().get('/shifts'),
                api().get(`/gudang?side=${side}`),
                api().get('/barang'),
            ]);
            setStocks(unwrap(s));
            setLogs(unwrap(l).filter((ll: any) => type === 'wet' ? !ll.barang?.side : ll.barang?.side));
            setCustomers(unwrap(c));
            setShifts(unwrap(sh));
            setAllGudangs(unwrap(g));
            setBarangs(unwrap(b));
        } catch (e) { console.error(e); }
        setLoading(false);
    };

    // Filter stocks by selected zone & selected barang
    const zoneStocks = stocks
        .filter((s: any) => !selectedZone || s.gudang?.zone === selectedZone)
        .filter((s: any) => !selectedBarangId || String(s.barang?.id) === String(selectedBarangId));

    // Group stocks per rak
    const stockOpts = zoneStocks.map((s: any) => {
        const available = s.qty - (s.reserved_qty || 0);
        return {
            value: String(s.id),
            label: `[${s.gudang?.zone}] Rak ${s.gudang?.name} — ${s.barang?.nama || 'Unknown'} (Tersedia: ${available} ${s.satuan || 'qty'}, Reserved: ${s.reserved_qty || 0}, Exp: ${s.expiry_date ? new Date(s.expiry_date).toLocaleDateString('id-ID') : '-'})`,
            locName: `[${s.gudang?.zone}] Rak ${s.gudang?.name}`,
            itemNames: s.barang?.nama || 'Unknown',
            qtyStr: `Tersedia: ${available} ${s.satuan || 'qty'}`,
            disabled: available <= 0
        };
    });

    const barangOpts = barangs.map((b: any) => ({ value: String(b.id), label: b.sku ? `${b.sku} - ${b.nama}` : b.nama }));
    const zoneOpts = zones.map((z: any) => ({ value: z, label: z }));
    const customerOpts = customers.map((c: any) => c.nama || c.name).filter(Boolean);
    const shiftOpts = shifts.map((s: any) => ({ value: String(s.id), label: s.name }));
    const batchOpts = Array.from(new Set(stocks.map((s: any) => s.batch_no).filter(Boolean)));
    const refOpts = Array.from(new Set(logs.map((l: any) => l.no_ref).filter(Boolean)));

    // Get auto-fill data from selected stock
    const selStock = stocks.find((s: any) => s.id === +form.stock_id);

    const addDraft = () => {
        if (!form.stock_id || !form.qty) return notifications.show({ title: 'Error', message: 'Pilih stock & qty', color: 'red' });
        if (!form.tujuan) return notifications.show({ title: 'Error', message: 'Tujuan wajib diisi', color: 'red' });
        const st = stocks.find((s: any) => s.id === +form.stock_id);
        if (!st) return;
        setDrafts(p => [...p, {
            ...form, id: Date.now(), stock_id: +form.stock_id,
            barang_id: st.barang?.id, gudang_id: st.gudang?.id,
            _brg: st.barang?.nama, _gdg: st.gudang?.name,
            _zone: st.gudang?.zone,
            _exp: st.expiry_date,
            satuan: st.satuan || st.barang?.satuan,
            shift_id: form.shift_id ? +form.shift_id : undefined,
        }]);
        setForm(p => ({ ...p, stock_id: '', qty: 1, nomor_batch: '' }));
    };

    const editDraft = (idx: number) => {
        const d = drafts[idx];
        setForm({
            stock_id: String(d.stock_id),
            qty: d.qty,
            tujuan: d.tujuan,
            no_ref: d.no_ref,
            shift_id: d.shift_id ? String(d.shift_id) : '',
            tanggal_permintaan: d.tanggal_permintaan,
            nomor_batch: d.nomor_batch || '',
        });
        setSelectedZone(d._zone);
        setSelectedBarangId(String(d.barang_id));
        setDrafts(p => p.filter((_, i) => i !== idx));
    };

    const openKoreksiModal = () => {
        if (!drafts.length) return;
        setKoreksiItems(drafts.map((d: any) => ({
            ...d,
            actual_qty: d.qty,
            alokasi: [],
            keterangan: '',
        })));
        setKoreksiOpen(true);
    };

    const submitKoreksi = async () => {
        const transId = `ID-${String(Date.now()).slice(-6)}`;
        try {
            const items = koreksiItems.map((d: any) => ({
                no_ref: form.no_ref || transId,
                barang_id: d.barang_id, gudang_id: d.gudang_id,
                qty: d.qty, actual_qty: d.actual_qty, satuan: d.satuan, tujuan: d.tujuan,
                shift_id: d.shift_id,
                batch_no: d.nomor_batch,
                alokasi: d.alokasi,
                keterangan: d.keterangan,
            }));
            await api().post('/inventory/picking', { items });
            notifications.show({ title: 'Sukses', message: `${items.length} item berhasil disimpan ke Planning Outbound (ID: ${form.no_ref || transId})`, color: 'green' });
            setDrafts([]);
            setForm(p => ({ ...p, no_ref: '' }));
            setKoreksiOpen(false);
            setKoreksiItems([]);
            load();
        } catch (e: any) {
            notifications.show({ title: 'Error', message: unwrap(e.response)?.message || 'Failed', color: 'red' });
        }
    };

    // Sort functions
    const handleSort = (key: string) => {
        if (sortKey === key) {
            setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
        } else {
            setSortKey(key);
            setSortDir('asc');
        }
    };

    const sortIcon = (key: string) => {
        if (sortKey !== key) return " ↕";
        return sortDir === 'asc' ? " ▲" : " ▼";
    };

    // Sort logs array before grouping
    const sortedLogs = [...logs].sort((a, b) => {
        if (!sortKey) return 0;
        let aVal = a[sortKey];
        let bVal = b[sortKey];

        if (sortKey === 'barang.nama') {
            aVal = a.barang?.nama || '';
            bVal = b.barang?.nama || '';
        } else if (sortKey === 'gudang.name') {
            aVal = a.gudang?.name || '';
            bVal = b.gudang?.name || '';
        }

        if (aVal == null) aVal = "";
        if (bVal == null) bVal = "";

        if (typeof aVal === 'number' && typeof bVal === 'number') {
            return sortDir === 'asc' ? aVal - bVal : bVal - aVal;
        }
        const cmp = String(aVal).localeCompare(String(bVal), undefined, { numeric: true });
        return sortDir === 'asc' ? cmp : -cmp;
    });

    // Group logs by no_ref
    const groupedLogs: Record<string, any[]> = {};
    sortedLogs.forEach((r: any) => {
        const key = r.no_ref || `LOG-${r.id}`;
        if (!groupedLogs[key]) groupedLogs[key] = [];
        groupedLogs[key].push(r);
    });

    const printPDF = (transId: string, items: any[]) => {
        const win = window.open('', '_blank');
        if (!win) return;
        win.document.write(`
            <html>
            <head>
                <title>Planning Outbound - ${transId}</title>
                <style>
                    body { font-family: Arial; padding: 20px; font-size: 10px; }
                    table { width: 100%; border-collapse: collapse; margin-top: 12px; }
                    th, td { border: 1px solid #333; padding: 5px; text-align: left; }
                    th { background: #1f2937; color: #fff; font-size: 10px; }
                    .title { font-size: 14px; font-weight: bold; margin-bottom: 4px; }
                    .meta { display: flex; justify-content: space-between; font-size: 10px; margin-bottom: 10px; border-bottom: 2px solid #000; padding-bottom: 8px; color: #333; }
                    .badge { display: inline-block; background: #1f2937; color:#fff; border-radius: 4px; padding: 1px 6px; font-size: 9px; font-weight: bold; }
                </style>
            </head>
            <body>
                <div class="title">PLANNING OUTBOUND DOCUMENT</div>
                <div class="meta">
                    <div>
                        <b>ID Transaksi:</b> ${transId}<br/>
                        <b>Tujuan:</b> ${items[0]?.tujuan || '-'}<br/>
                        <b>Shift:</b> ${items[0]?.shift?.name || '-'}
                    </div>
                    <div style="text-align: right">
                        <b>Dicetak:</b> ${new Date().toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' })}<br/>
                        <b>Tgl Transaksi:</b> ${items[0]?.created_at ? fmt(items[0].created_at) : '-'}<br/>
                        <b>Total Item:</b> ${items.length} baris
                    </div>
                </div>
                <table>
                    <thead>
                        <tr>
                            <th>No.</th>
                            <th>Item / Produk</th>
                            <th>Batch No</th>
                            <th>Tgl Expired</th>
                            <th>Zone / Rak Asal</th>
                            <th>Qty</th>
                            <th>Satuan</th>
                            <th>Status</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${items.map((r: any, i: number) => `
                            <tr>
                                <td>${i + 1}</td>
                                <td><b>${r.barang?.nama || '-'}</b></td>
                                <td>${r.batch_no || '-'}</td>
                                <td>${r.expiry_date ? new Date(r.expiry_date).toLocaleDateString('id-ID') : '-'}</td>
                                <td>${r.gudang?.name || '-'} <span class="badge">${r.gudang?.zone || '-'}</span></td>
                                <td>${r.qty}</td>
                                <td>${r.satuan || ''}</td>
                                <td>${statusLabel(r.expiry_date)}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
                <div style="margin-top: 30px; display: flex; justify-content: space-between; font-size: 10px;">
                    <div>Checker / Pengambil:<br/><br/>______________________________</div>
                    <div>Supervisor / Approved:<br/><br/>______________________________</div>
                </div>
                <script>window.onload=()=>{window.print();window.close()}</script>
            </body>
            </html>
        `);
        win.document.close();
    };

    const deleteTrans = async (transId: string) => {
        if (!confirm('Yakin ingin membatalkan Planning Outbound ini? Stok reserved akan dibebaskan kembali.')) return;
        try {
            await api().delete('/inventory/picking/' + encodeURIComponent(transId));
            notifications.show({ title: 'Sukses', message: 'Planning Outbound dibatalkan & stok reserved dilepas', color: 'green' });
            load();
        } catch (e: any) {
            notifications.show({ title: 'Error', message: unwrap(e.response)?.message || 'Gagal membatalkan', color: 'red' });
        }
    };

    const editTrans = async (transId: string, items: any[]) => {
        if (!confirm('Edit planning outbound akan membatalkan reservasi rak lalu menaruh data ke tabel draft kiri. Lanjutkan?')) return;
        try {
            await api().delete('/inventory/picking/' + encodeURIComponent(transId));
            const newDrafts = items.map((r: any) => ({
                id: Date.now() + Math.random(),
                stock_id: '',
                barang_id: r.barang?.id,
                gudang_id: r.gudang?.id,
                qty: r.qty,
                tujuan: r.tujuan,
                no_ref: r.no_ref,
                shift_id: r.shift?.id ? String(r.shift.id) : '',
                tanggal_permintaan: new Date().toISOString().split('T')[0],
                nomor_batch: r.batch_no || '',
                _brg: r.barang?.nama,
                _gdg: r.gudang?.name,
                _zone: r.gudang?.zone,
                _exp: r.expiry_date,
                satuan: r.satuan,
            }));

            setDrafts(newDrafts);
            setForm(p => ({ ...p, no_ref: transId }));
            notifications.show({ title: 'Edit Mode', message: 'Draft berhasil dimuat ulang ke tabel planning outbound', color: 'yellow' });
            load();
        } catch (e: any) {
            notifications.show({ title: 'Error', message: 'Gagal memuat ulang data ke edit', color: 'red' });
        }
    };

    return (
        <Box>
            <Box style={{ background: '#fff', borderLeft: '4px solid #e6921e', padding: '14px 20px', marginBottom: 16, boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}>
                <Group justify="space-between">
                    <Title order={4} style={{ color: '#111827', fontWeight: 800, display: "flex", alignItems: "center", gap: 8 }}>
                        <IconBuildingWarehouse size={20} style={{ color: '#e6921e' }} />
                        PLANNING OUTBOUND
                    </Title>
                    <Group gap="xs">
                        <Button size="xs" color={type === 'wet' ? 'yellow' : 'gray'} variant={type === 'wet' ? 'filled' : 'outline'} onClick={() => { setType('wet'); setSelectedZone(''); }} style={{ fontWeight: 700 }}>ITEM WET</Button>
                        <Button size="xs" color={type === 'dry' ? 'blue' : 'gray'} variant={type === 'dry' ? 'filled' : 'outline'} onClick={() => { setType('dry'); setSelectedZone(''); }} style={{ fontWeight: 700 }}>ITEM DRY</Button>
                    </Group>
                </Group>
            </Box>

            <Box p="md">
                <Grid gutter="md">
                    {/* Left Form Panel */}
                    <Grid.Col span={{ base: 12, md: 4, lg: 3 }}>
                        <Paper withBorder p="md" radius="md" style={{ background: '#fff' }}>
                            <Stack gap="xs">
                                <Text fw={800} size="sm" c="orange" mb={4} style={{ borderBottom: "1px solid #f1f5f9", paddingBottom: 4 }}>
                                    Buat Planning Outbound
                                </Text>
                                <Autocomplete label="No. Ref / ID Transaksi" size="xs" data={refOpts} value={form.no_ref} onChange={v => setForm(p => ({ ...p, no_ref: v }))} placeholder="Auto jika kosong" />

                                <Select label="Filter Nama Item (M. Produk)" size="xs" searchable clearable data={barangOpts} value={selectedBarangId} onChange={v => { setSelectedBarangId(v || ''); setForm(p => ({ ...p, stock_id: '' })); }} placeholder="Pilih barang..." />

                                <Select label="Filter Zone (Opsional)" size="xs" clearable data={zoneOpts} value={selectedZone} onChange={v => { setSelectedZone(v || ''); setForm(p => ({ ...p, stock_id: '' })); }} placeholder="Pilih Zone..." />

                                <Select
                                    label="Nomor Rak / Stock"
                                    size="xs"
                                    searchable
                                    data={stockOpts}
                                    value={form.stock_id}
                                    onChange={v => {
                                        const sObj = stocks.find((s: any) => String(s.id) === String(v));
                                        const avail = sObj ? sObj.qty - (sObj.reserved_qty || 0) : 1;
                                        setForm(p => ({ ...p, stock_id: v || '', qty: avail > 0 ? 1 : 0 }));
                                    }}
                                    placeholder="Pilih rak yg berisi produk..."
                                    mb="xs"
                                    renderOption={renderColorfulOption}
                                />

                                {selStock && (
                                    <Box style={{ background: '#f8f9fa', borderRadius: 6, padding: '6px 8px', fontSize: 11 }}>
                                        <Text size="xs" c="dimmed">Nama Item: <b>{selStock.barang?.nama}</b></Text>
                                        <Text size="xs" c="dimmed">Tgl Expired: <b>{selStock.expiry_date ? fmt(selStock.expiry_date) : '-'}</b></Text>
                                        <Text size="xs" c="dimmed">Stok Fisik: <b>{selStock.qty} {selStock.satuan}</b></Text>
                                        <Text size="xs" c="orange" fw={600}>Stok Tersedia: <b>{selStock.qty - (selStock.reserved_qty || 0)} {selStock.satuan}</b></Text>
                                    </Box>
                                )}

                                <NumberInput
                                    label="Qty"
                                    size="xs"
                                    value={form.qty}
                                    onChange={v => setForm(p => ({ ...p, qty: Number(v) }))}
                                    min={1}
                                    max={selStock ? selStock.qty - (selStock.reserved_qty || 0) : undefined}
                                    disabled={!form.stock_id}
                                />
                                <Autocomplete label="Nomor Batch" size="xs" data={batchOpts} value={form.nomor_batch} onChange={v => setForm(p => ({ ...p, nomor_batch: v }))} placeholder="Pilih/Ketik Nomor Batch" />
                                <Autocomplete label="Tujuan (Master Customer)" size="xs" data={customerOpts} value={form.tujuan} onChange={v => setForm(p => ({ ...p, tujuan: v }))} placeholder="Produksi AP / Customer..." />
                                <TextInput label="Tanggal Permintaan" size="xs" type="date" value={form.tanggal_permintaan} onChange={e => setForm(p => ({ ...p, tanggal_permintaan: e.target.value }))} />
                                <Select label="Shift" size="xs" data={shiftOpts} value={form.shift_id} onChange={v => setForm(p => ({ ...p, shift_id: v || '' }))} placeholder="Pilih shift" />
                                <Button fullWidth size="xs" color="orange" onClick={addDraft} style={{ fontWeight: 700 }} leftSection={<IconPlus size={14} />}>+ Tambahkan Draft</Button>
                            </Stack>
                        </Paper>
                    </Grid.Col>

                    {/* Right Tables Panel */}
                    <Grid.Col span={{ base: 12, md: 8, lg: 9 }}>
                        {drafts.length > 0 && (
                            <Paper withBorder p="md" radius="md" mb="md" style={{ background: '#fff' }}>
                                <Group justify="space-between" mb="xs">
                                    <Box>
                                        <Text fw={800} size="sm" c="orange">DRAFT ANTRIAN PLANNING OUTBOUND {type.toUpperCase()}</Text>
                                        <Text size="xs" c="dimmed">ID Transaksi: <b>{form.no_ref || '(akan digenerate otomatis)'}</b></Text>
                                    </Box>
                                    <Button size="xs" color="green" onClick={openKoreksiModal} style={{ fontWeight: 800 }} leftSection={<IconSend size={14} />}>SUBMIT PLANNING OUTBOUND</Button>
                                </Group>
                                <Box style={{ overflowX: 'auto' }}>
                                    <Table withTableBorder withColumnBorders style={{ fontSize: 11 }}>
                                        <Table.Thead style={{ background: '#333' }}>
                                            <Table.Tr>
                                                {['Tujuan', 'Batch', 'Item', 'Tgl Permintaan', 'Location', 'Tgl.Expired', 'Qty', 'Status', 'Shift', 'Aksi'].map((h: any) => (
                                                    <Table.Th key={h} style={{ color: '#fff', fontSize: 11 }}>{h}</Table.Th>
                                                ))}
                                            </Table.Tr>
                                        </Table.Thead>
                                        <Table.Tbody>
                                            {drafts.map((d: any, i: any) => (
                                                <Table.Tr key={d.id || i}>
                                                    <Table.Td fw={600}>{d.tujuan}</Table.Td>
                                                    <Table.Td>{d.nomor_batch || '-'}</Table.Td>
                                                    <Table.Td>{d._brg}</Table.Td>
                                                    <Table.Td>{d.tanggal_permintaan}</Table.Td>
                                                    <Table.Td><Badge size="xs" color="blue">{d._gdg}</Badge></Table.Td>
                                                    <Table.Td>{d._exp ? fmt(d._exp) : '-'}</Table.Td>
                                                    <Table.Td ta="right" fw={700}>{d.qty} {d.satuan}</Table.Td>
                                                    <Table.Td><Badge size="xs" color={statusColor(d._exp)}>{statusLabel(d._exp)}</Badge></Table.Td>
                                                    <Table.Td>{shifts.find((s: any) => s.id === d.shift_id)?.name || '-'}</Table.Td>
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

                        <Paper withBorder p="md" radius="md" style={{ background: '#fff' }}>
                            <Group justify="space-between" mb="sm">
                                <Text fw={850} size="sm">
                                    RIWAYAT PLANNING OUTBOUND ({Object.keys(groupedLogs).length} Transaksi)
                                </Text>
                            </Group>

                            <Box style={{ overflowX: 'auto' }}>
                                <Table withTableBorder withColumnBorders style={{ fontSize: 11 }}>
                                    <Table.Thead style={{ background: '#1a1a1a' }}>
                                        <Table.Tr>
                                            <Table.Th style={{ color: '#fff', cursor: 'pointer' }} onClick={() => handleSort('no_ref')}>
                                                ID Transaksi{sortIcon('no_ref')}
                                            </Table.Th>
                                            <Table.Th style={{ color: '#fff', cursor: 'pointer' }} onClick={() => handleSort('tujuan')}>
                                                Tujuan{sortIcon('tujuan')}
                                            </Table.Th>
                                            <Table.Th style={{ color: '#fff', cursor: 'pointer' }} onClick={() => handleSort('barang.nama')}>
                                                Item{sortIcon('barang.nama')}
                                            </Table.Th>
                                            <Table.Th style={{ color: '#fff', cursor: 'pointer' }} onClick={() => handleSort('created_at')}>
                                                Tanggal{sortIcon('created_at')}
                                            </Table.Th>
                                            <Table.Th style={{ color: '#fff', cursor: 'pointer' }} onClick={() => handleSort('shift.name')}>
                                                Shift{sortIcon('shift.name')}
                                            </Table.Th>
                                            <Table.Th style={{ color: '#fff', cursor: 'pointer' }} onClick={() => handleSort('qty')}>
                                                Qty{sortIcon('qty')}
                                            </Table.Th>
                                            <Table.Th style={{ color: '#fff', cursor: 'pointer' }} onClick={() => handleSort('gudang.name')}>
                                                Gudang{sortIcon('gudang.name')}
                                            </Table.Th>
                                            <Table.Th style={{ color: '#fff' }}>Status</Table.Th>
                                            <Table.Th style={{ color: '#fff' }}>Aksi</Table.Th>
                                        </Table.Tr>
                                    </Table.Thead>
                                    <Table.Tbody>
                                        {Object.entries(groupedLogs).slice(0, 50).map(([transId, items]) => (
                                            items.map((r: any, idx: any) => (
                                                <Table.Tr key={r.id}>
                                                    {idx === 0 && (
                                                        <Table.Td fw={700} style={{ color: '#1565c0' }} rowSpan={items.length}>{transId}</Table.Td>
                                                    )}
                                                    <Table.Td>{r.tujuan || '-'}</Table.Td>
                                                    <Table.Td fw={600}>{r.barang?.nama}</Table.Td>
                                                    <Table.Td>{fmt(r.created_at)}</Table.Td>
                                                    <Table.Td>{r.shift?.name || '-'}</Table.Td>
                                                    <Table.Td ta="right" fw={700}>{r.qty} {r.satuan}</Table.Td>
                                                    <Table.Td><Badge size="xs" color="blue">{r.gudang?.name}</Badge></Table.Td>
                                                    <Table.Td>
                                                        <Group gap={4} wrap="nowrap">
                                                            <Badge size="xs" color={statusColor(r.expiry_date)}>{statusLabel(r.expiry_date)}</Badge>
                                                            <Badge size="xs" color={r.status === 'RESERVED' ? 'yellow' : 'green'}>{r.status || 'CONFIRMED'}</Badge>
                                                        </Group>
                                                    </Table.Td>
                                                    {idx === 0 && (
                                                        <Table.Td rowSpan={items.length}>
                                                            <Group gap={6} wrap="nowrap">
                                                                <Tooltip label="Edit">
                                                                    <ActionIcon size="md" color="green" variant="light" onClick={() => editTrans(transId, items)}>
                                                                        <IconEdit size={16} />
                                                                    </ActionIcon>
                                                                </Tooltip>
                                                                <Tooltip label="Hapus Transaksi">
                                                                    <ActionIcon size="md" color="red" variant="light" onClick={() => deleteTrans(transId)}>
                                                                        <IconTrash size={16} />
                                                                    </ActionIcon>
                                                                </Tooltip>
                                                                <Button size="xs" color="red" leftSection={<IconFileTypePdf size={16} />} onClick={() => printPDF(transId, items)}>
                                                                    Print PDF
                                                                </Button>
                                                            </Group>
                                                        </Table.Td>
                                                    )}
                                                </Table.Tr>
                                            ))
                                        ))}
                                        {Object.keys(groupedLogs).length === 0 && (
                                            <Table.Tr>
                                                <Table.Td colSpan={9} ta="center" c="dimmed">
                                                    Tidak ada data riwayat planning outbound.
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

            <Modal opened={koreksiOpen} onClose={() => setKoreksiOpen(false)} title="Koreksi Planning Outbound" size="lg">
                <Stack gap="xs">
                    <Text size="xs" c="dimmed">Sesuaikan qty aktual, alokasi, dan keterangan untuk setiap item sebelum publish.</Text>
                    {koreksiItems.map((d, idx) => (
                        <Paper key={d.id || idx} withBorder p="sm" radius="md">
                            <Group justify="space-between" mb={4}>
                                <Text size="sm" fw={700}>{d._brg}</Text>
                                <Text size="xs" c="dimmed">Rak: {d._gdg}</Text>
                            </Group>
                            <Grid gutter="xs">
                                <Grid.Col span={6}>
                                    <NumberInput label="Qty Planning" size="xs" value={d.qty} disabled />
                                </Grid.Col>
                                <Grid.Col span={6}>
                                    <NumberInput
                                        label="Qty Aktual"
                                        size="xs"
                                        value={d.actual_qty}
                                        onChange={(v) => setKoreksiItems(items => items.map((it, i) => i === idx ? { ...it, actual_qty: Number(v) } : it))}
                                        min={0}
                                    />
                                </Grid.Col>
                            </Grid>
                            <Text size="xs" c="dimmed" mt={4}>Selisih: <b>{d.qty - d.actual_qty}</b> {d.satuan}</Text>
                            <Divider label="Alokasi (opsional)" labelPosition="center" my={6} />
                            {['Produksi Ayam', 'Waste', 'Reject', 'Premix'].map((t) => (
                                <NumberInput
                                    key={t}
                                    label={t}
                                    size="xs"
                                    value={d.alokasi.find((a: any) => a.tujuan === t)?.qty || 0}
                                    onChange={(v) => {
                                        const val = Number(v) || 0;
                                        setKoreksiItems(items => items.map((it, i) => {
                                            if (i !== idx) return it;
                                            const existing = it.alokasi.filter((a: any) => a.tujuan !== t);
                                            if (val > 0) existing.push({ tujuan: t, qty: val });
                                            return { ...it, alokasi: existing };
                                        }));
                                    }}
                                    min={0}
                                />
                            ))}
                            <Textarea
                                label="Keterangan"
                                size="xs"
                                value={d.keterangan}
                                onChange={(e) => setKoreksiItems(items => items.map((it, i) => i === idx ? { ...it, keterangan: e.target.value } : it))}
                                minRows={2}
                                mt={6}
                            />
                        </Paper>
                    ))}
                    <Group justify="flex-end" mt="sm">
                        <Button size="xs" color="gray" variant="outline" onClick={() => setKoreksiOpen(false)}>Batal</Button>
                        <Button size="xs" color="green" onClick={submitKoreksi}>OK / Publish</Button>
                    </Group>
                </Stack>
            </Modal>
        </Box>
    );
}
