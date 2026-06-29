// @ts-nocheck
'use client';
import React, { useState, useEffect } from 'react';
import {
    Box, Group, Button, Title, Text, Table, Badge, Paper, Stack,
    TextInput, Select, Loader, NumberInput, Divider, Autocomplete, ActionIcon, Tooltip
} from '@mantine/core';
import { IconEdit, IconTrash, IconFileTypePdf } from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import { api, unwrap, fmt, statusLabel, statusColor } from '../lib/api';

const renderColorfulOption: any = ({ option }: any) => {
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

export default function PickingPage() {
    const [type, setType] = useState('wet');
    const [allGudangs, setAllGudangs] = useState<any[]>([]);
    const [stocks, setStocks] = useState<any[]>([]);
    const [barangs, setBarangs] = useState<any[]>([]);
    const [logs, setLogs] = useState<any[]>([]);
    const [customers, setCustomers] = useState<any[]>([]);
    const [shifts, setShifts] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [drafts, setDrafts] = useState<any[]>([]);

    // Zone yang dipilih (sekarang pakai select)
    const [selectedZone, setSelectedZone] = useState('');
    // Barang yang dipilih buat filter Rak
    const [selectedBarangId, setSelectedBarangId] = useState('');

    const [form, setForm] = useState({
        stock_id: '', qty: 1, tujuan: '', no_ref: '', shift_id: '',
        tanggal_permintaan: new Date().toISOString().split('T')[0],
        nomor_batch: '',
    });

    const ZONES_WET = ['CS FROZEN', 'CHILL', 'WASTE'];
    const ZONES_DRY = ['DRY A', 'DRY B', 'DRY FG'];
    const zones = type === 'wet' ? ZONES_WET : ZONES_DRY;

    useEffect(() => { load(); }, [type]);

    const load = async () => {
        setLoading(true);
        try {
            const side = type === 'dry';
            const [s, l, c, sh, g, b] = await Promise.all([
                api().get(`/inventory/stock?side=${side}`),
                api().get('/inventory/logs/outbound'),
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

    // Group stocks per rak lalu buat label lengkap: [Zone X] Rak Y — Produk A, Produk B (Total: Z qty)
    const stockOpts = zoneStocks.map((s: any) => ({
        value: String(s.id),
        label: `[${s.gudang?.zone}] Rak ${s.gudang?.name} — ${s.barang?.nama || 'Unknown'} (Tersedia: ${s.qty} ${s.satuan || 'qty'}, Exp: ${s.expiry_date ? new Date(s.expiry_date).toLocaleDateString('id-ID') : '-'})`,
        locName: `[${s.gudang?.zone}] Rak ${s.gudang?.name}`,
        itemNames: s.barang?.nama || 'Unknown',
        qtyStr: `Tersedia: ${s.qty} ${s.satuan || 'qty'}`
    }));

    const barangOpts = barangs.map((b: any) => ({ value: String(b.id), label: b.sku ? `${b.sku} - ${b.nama}` : b.nama }));
    const zoneOpts = zones.map((z: any) => ({ value: z, label: z }));

    const customerOpts = ['Prod', 'Premix', 'PDI', ...customers.map((c: any) => c.nama || c.name).filter(Boolean)];
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

    const postAll = async () => {
        if (!drafts.length) return;
        const transId = `ID-${String(Date.now()).slice(-6)}`;
        try {
            const items = drafts.map((d: any) => ({
                no_ref: d.no_ref || transId,
                barang_id: d.barang_id, gudang_id: d.gudang_id,
                qty: d.qty, satuan: d.satuan, tujuan: d.tujuan,
                shift_id: d.shift_id,
                batch_no: d.nomor_batch,
            }));
            await api().post('/inventory/outbound', { items });
            notifications.show({ title: 'Sukses', message: `${items.length} item berhasil dipicking (ID: ${transId})`, color: 'green' });
            setDrafts([]);
            load();
        } catch (e: any) {
            notifications.show({ title: 'Error', message: unwrap(e.response)?.message || 'Failed', color: 'red' });
        }
    };

    // Group logs by no_ref (ID Transaksi)
    const groupedLogs: Record<string, any[]> = {};
    logs.forEach((r: any) => {
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
                <title>Picking Plan - ${transId}</title>
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
                <div class="title">PICKING PLAN DOCUMENT</div>
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
        if (!confirm('Yakin ingin menghapus transaksi ini? Stok akan dikembalikan ke master rak gudang.')) return;
        try {
            await api().delete('/inventory/outbound/' + encodeURIComponent(transId));
            notifications.show({ title: 'Sukses', message: 'Transaksi dihapus & stok dikembalikan', color: 'green' });
            load();
        } catch (e: any) {
            notifications.show({ title: 'Error', message: unwrap(e.response)?.message || 'Gagal menghapus', color: 'red' });
        }
    };

    const editTrans = async (transId: string, items: any[]) => {
        if (!confirm('Edit transaksi akan merevert stok ke rak lalu menaruh data ke tabel draft kiri. Lanjutkan?')) return;
        try {
            await api().delete('/inventory/outbound/' + encodeURIComponent(transId));
            const newDrafts = items.map((r: any) => ({
                id: Date.now() + Math.random(),
                stock_id: '', // Empty because we don't map stock easily back, user will just submit new ones directly
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
            notifications.show({ title: 'Edit Mode', message: 'Draft berhasil dimuat ulang ke tabel picking', color: 'yellow' });
            load();
        } catch (e: any) {
            notifications.show({ title: 'Error', message: 'Gagal memuat ulang data ke edit', color: 'red' });
        }
    };

    return (
        <Box>
            <Box style={{ background: '#fff', borderBottom: '1px solid #ddd', padding: '12px 20px' }}>
                <Group justify="space-between">
                    <Title order={3} style={{ color: '#e6921e', fontWeight: 900 }}>MULTI-ITEM PICKING PLAN</Title>
                    <Group gap="xs">
                        <Button size="xs" color={type === 'wet' ? 'yellow' : 'gray'} variant={type === 'wet' ? 'filled' : 'outline'} onClick={() => { setType('wet'); setSelectedZone(''); }} style={{ fontWeight: 700 }}>ITEM WET</Button>
                        <Button size="xs" color={type === 'dry' ? 'blue' : 'gray'} variant={type === 'dry' ? 'filled' : 'outline'} onClick={() => { setType('dry'); setSelectedZone(''); }} style={{ fontWeight: 700 }}>ITEM DRY</Button>
                    </Group>
                </Group>
            </Box>

            <Box p="md">
                <Group align="flex-start" gap="md">
                    {/* Left panel form */}
                    <Paper withBorder p="md" style={{ width: 270, flexShrink: 0 }}>
                        <Stack gap="xs">
                            <Autocomplete label="No. Ref / ID Transaksi" size="xs" data={refOpts} value={form.no_ref} onChange={v => setForm(p => ({ ...p, no_ref: v }))} placeholder="Auto jika kosong" />

                            {/* Autocomplete Nama Item dulu sebagai Filter awal (opsional) */}
                            <Select label="Filter Nama Item (M. Produk)" size="xs" searchable clearable data={barangOpts} value={selectedBarangId} onChange={v => { setSelectedBarangId(v || ''); setForm(p => ({ ...p, stock_id: '' })); }} placeholder="Pilih barang..." />

                            {/* Zone Selector (sekarang pakai dropdown) */}
                            <Select label="Filter Zone (Opsional)" size="xs" clearable data={zoneOpts} value={selectedZone} onChange={v => { setSelectedZone(v || ''); setForm(p => ({ ...p, stock_id: '' })); }} placeholder="Pilih Zone..." />

                            <Select
                                label="Nomor Rak / Stock"
                                size="xs"
                                searchable
                                data={stockOpts}
                                value={form.stock_id}
                                onChange={v => {
                                    setForm(p => ({ ...p, stock_id: v || '', qty: stocks.find((s: any) => String(s.id) === String(v))?.qty || 0 }));
                                }}
                                placeholder="Pilih rak yg berisi produk..."
                                mb="xs"
                                renderOption={renderColorfulOption}
                            />

                            {/* Auto-filled from selected stock */}
                            {selStock && (
                                <Box style={{ background: '#f8f9fa', borderRadius: 6, padding: '6px 8px', fontSize: 11 }}>
                                    <Text size="xs" c="dimmed">Nama Item: <b>{selStock.barang?.nama}</b></Text>
                                    <Text size="xs" c="dimmed">Tgl Expired: <b>{selStock.expiry_date ? fmt(selStock.expiry_date) : '-'}</b></Text>
                                    <Text size="xs" c="dimmed">Stok: <b>{selStock.qty} {selStock.satuan}</b></Text>
                                </Box>
                            )}

                            <NumberInput label="Qty" size="xs" value={form.qty} onChange={v => setForm(p => ({ ...p, qty: Number(v) }))} min={1} />
                            <Autocomplete label="Nomor Batch" size="xs" data={batchOpts} value={form.nomor_batch} onChange={v => setForm(p => ({ ...p, nomor_batch: v }))} placeholder="Pilih/Ketik Nomor Batch" />
                            <Autocomplete label="Tujuan" size="xs" data={customerOpts} value={form.tujuan} onChange={v => setForm(p => ({ ...p, tujuan: v }))} placeholder="Produksi AP / Customer..." />
                            <TextInput label="Tanggal Permintaan" size="xs" type="date" value={form.tanggal_permintaan} onChange={e => setForm(p => ({ ...p, tanggal_permintaan: e.target.value }))} />
                            <Select label="Shift" size="xs" data={shiftOpts} value={form.shift_id} onChange={v => setForm(p => ({ ...p, shift_id: v || '' }))} placeholder="Pilih shift" />
                            <Button fullWidth size="xs" color="yellow" onClick={addDraft} style={{ fontWeight: 700 }}>+ Tambahkan Draft</Button>
                        </Stack>
                    </Paper>

                    <Box style={{ flex: 1 }}>
                        {/* Draft table */}
                        {drafts.length > 0 && (
                            <Box mb="md">
                                <Group justify="space-between" mb="xs">
                                    <Box>
                                        <Text fw={700} size="sm">ITEM {type.toUpperCase()}</Text>
                                        <Text size="xs" c="dimmed">ID Transaksi : {form.no_ref || '(akan digenerate otomatis)'}</Text>
                                    </Box>
                                    <Button size="xs" color="green" onClick={postAll} style={{ fontWeight: 700 }}>📤 SUBMIT</Button>
                                </Group>
                                <Table withTableBorder withColumnBorders style={{ fontSize: 11 }}>
                                    <Table.Thead style={{ background: '#333' }}>
                                        <Table.Tr>
                                            {['Tujuan', 'Batch', 'Item', 'Tgl Permintaan', 'Location', 'Tgl.Expired', 'Qty', 'Status', 'Shift', '✕'].map((h: any) => (
                                                <Table.Th key={h} style={{ color: '#fff', fontSize: 11 }}>{h}</Table.Th>
                                            ))}
                                        </Table.Tr>
                                    </Table.Thead>
                                    <Table.Tbody>
                                        {drafts.map((d: any, i: any) => (
                                            <Table.Tr key={d.id}>
                                                <Table.Td fw={600}>{d.tujuan}</Table.Td>
                                                <Table.Td>{d.nomor_batch || '-'}</Table.Td>
                                                <Table.Td>{d._brg}</Table.Td>
                                                <Table.Td>{d.tanggal_permintaan}</Table.Td>
                                                <Table.Td><Badge size="xs" color="blue">{d._gdg}</Badge></Table.Td>
                                                <Table.Td>{d._exp ? fmt(d._exp) : '-'}</Table.Td>
                                                <Table.Td ta="right">{d.qty} {d.satuan}</Table.Td>
                                                <Table.Td><Badge size="xs" color={statusColor(d._exp)}>{statusLabel(d._exp)}</Badge></Table.Td>
                                                <Table.Td>{shifts.find((s: any) => s.id === d.shift_id)?.name || '-'}</Table.Td>
                                                <Table.Td><Button size="xs" color="red" variant="light" onClick={() => setDrafts(p => p.filter((_, j) => j !== i))}>✕</Button></Table.Td>
                                            </Table.Tr>
                                        ))}
                                    </Table.Tbody>
                                </Table>
                            </Box>
                        )}

                        {/* Filter & Riwayat */}
                        <Divider my="sm" />
                        <Group mb="xs" gap="xs">
                            <TextInput placeholder="Cari berdasarkan ID, kode..." size="xs" style={{ width: 220 }} />
                            <Text size="xs" fw={600}>dari</Text>
                            <TextInput type="date" size="xs" style={{ width: 130 }} />
                            <Text size="xs" fw={600}>sampai</Text>
                            <TextInput type="date" size="xs" style={{ width: 130 }} />
                            <Button size="xs" color="blue">Filter</Button>
                            <Button size="xs" color="gray" variant="outline">Reset</Button>
                        </Group>

                        <Text fw={700} size="sm" mb="xs">RIWAYAT OUTBOUND ({Object.keys(groupedLogs).length} transaksi)</Text>
                        {loading ? <Loader /> : (
                            <Table withTableBorder withColumnBorders style={{ fontSize: 11 }}>
                                <Table.Thead style={{ background: '#1a1a1a' }}>
                                    <Table.Tr>
                                        {['ID Transaksi', 'Tujuan', 'Item', 'Tanggal', 'Shift', 'Qty', 'Gudang', 'Status', 'Aksi'].map((h: any) => (
                                            <Table.Th key={h} style={{ color: '#fff', fontSize: 11 }}>{h}</Table.Th>
                                        ))}
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
                                                <Table.Td ta="right">{r.qty} {r.satuan}</Table.Td>
                                                <Table.Td><Badge size="xs" color="blue">{r.gudang?.name}</Badge></Table.Td>
                                                <Table.Td><Badge size="xs" color={statusColor(r.expiry_date)}>{statusLabel(r.expiry_date)}</Badge></Table.Td>
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
                                </Table.Tbody>
                            </Table>
                        )}
                    </Box>
                </Group>
            </Box>
        </Box>
    );
}
