// @ts-nocheck
'use client';
import React, { useState, useEffect, useRef } from 'react';
import {
    Box, Group, Button, Title, Text, Table, Badge, Paper, Stack,
    TextInput, Select, Loader, NumberInput, Autocomplete, ActionIcon, Tooltip, Grid, Divider
} from '@mantine/core';
import {
    IconEdit, IconTrash, IconFileTypePdf, IconPlus, IconBuildingWarehouse, IconSend
} from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import { api, unwrap, fmt, statusLabel, statusColor, dedup } from '../lib/api';

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

export default function PlanningOutboundPage() {
    const [allGudangs, setAllGudangs] = useState<any[]>([]);
    const [stocks, setStocks] = useState<any[]>([]);
    const [barangs, setBarangs] = useState<any[]>([]);
    const [logs, setLogs] = useState<any[]>([]);
    const [customers, setCustomers] = useState<any[]>([]);
    const [shifts, setShifts] = useState<any[]>([]);
    const [plans, setPlans] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [editPlanId, setEditPlanId] = useState<number | null>(null);

    // Zone & Product filter for Rak Selector
    const [selectedZone, setSelectedZone] = useState('');
    const [selectedBarangId, setSelectedBarangId] = useState('');

    // Sorting states
    const [sortKey, setSortKey] = useState<string | null>(null);
    const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

    const handleSort = (key: string) => {
        if (sortKey === key) {
            setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
        } else {
            setSortKey(key);
            setSortDir('asc');
        }
    };

    const sortIcon = (key: string) => {
        if (sortKey !== key) return ' ↕';
        return sortDir === 'asc' ? ' ▲' : ' ▼';
    };

    const printPDF = (plan: any) => {
        const printWindow = window.open('', '_blank');
        if (!printWindow) return;
        const itemsHtml = (plan.items || []).map((item: any, idx: number) => {
            const bObj = barangs.find((b: any) => String(b.id) === String(item.barangId));
            const name = bObj ? bObj.nama : `Barang #${item.barangId}`;
            const gObj = allGudangs.find((g: any) => String(g.id) === String(item.gudangId));
            const locStr = gObj ? `[${gObj.zone}] ${gObj.name}` : '-';
            return `<tr>
                <td style="text-align:center">${idx + 1}</td>
                <td><strong>${name}</strong></td>
                <td>${locStr}</td>
                <td>${item.batch_no || '-'}</td>
                <td style="text-align:right"><strong>${item.qty}</strong></td>
                <td>${item.satuan || bObj?.satuan || 'Pcs'}</td>
            </tr>`;
        }).join('');

        const dateStr = plan.tanggal_planning ? fmt(plan.tanggal_planning) : '-';
        const shiftStr = plan.shift?.name || '-';
        const customerStr = plan.customer?.nama || plan.tujuan || '-';

        printWindow.document.write(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>Laporan Outbound - ${plan.no_ref || 'Planning Outbound'}</title>
                <style>
                    body { font-family: 'Segoe UI', Arial, sans-serif; padding: 24px; color: #172033; }
                    .header { border-bottom: 2px solid #e67700; padding-bottom: 12px; margin-bottom: 20px; }
                    .title { font-size: 18px; font-weight: 800; color: #e67700; margin: 0; }
                    .meta { margin-top: 8px; font-size: 12px; color: #4b5563; }
                    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; font-size: 12px; margin-bottom: 20px; background: #fff4e6; padding: 12px; border-radius: 8px; }
                    table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 12px; }
                    th, td { border: 1px solid #cbd5e1; padding: 8px 10px; text-align: left; }
                    th { background: #ffe8cc; color: #d9480f; font-size: 11px; text-transform: uppercase; }
                    .footer { margin-top: 30px; text-align: right; font-size: 11px; color: #6b7280; }
                </style>
            </head>
            <body>
                <div class="header">
                    <h1 class="title">SURAT PLANNING OUTBOUND (PENGELUARAN BARANG)</h1>
                    <div class="meta">No Ref: <strong>${plan.no_ref || `#${plan.id}`}</strong> | Date Generated: ${new Date().toLocaleDateString('id-ID')}</div>
                </div>
                <div class="grid">
                    <div>Tujuan / Customer: <strong>${customerStr}</strong></div>
                    <div>Tanggal Planning: <strong>${dateStr}</strong></div>
                    <div>Shift: <strong>${shiftStr}</strong></div>
                    <div>Status: <strong>${plan.status || 'DONE'}</strong></div>
                </div>
                <table>
                    <thead>
                        <tr>
                            <th style="width:30px;text-align:center">No</th>
                            <th>Item / Produk</th>
                            <th>Gudang / Rak Asal</th>
                            <th>Batch No</th>
                            <th style="text-align:right">Qty</th>
                            <th>Satuan</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${itemsHtml}
                    </tbody>
                </table>
                <div class="footer">Dicetak otomatis dari WMS System</div>
                <script>window.print();<\/script>
            </body>
            </html>
        `);
        printWindow.document.close();
    };

    const [form, setForm] = useState<any>({
        stock_id: '', qty: 1, tujuan: '', no_ref: '', shift_id: '',
        tanggal_permintaan: new Date().toISOString().split('T')[0],
        nomor_batch: '',
        items: [], // [{ stock_id: string, barangId: number, gudangId: number, qty: number, batch_no: string, satuan: string, _brg: string, _gdg: string, _zone: string }]
    });

    const ZONES_WET = ['CS FROZEN', 'CHILL', 'WASTE'];
    const ZONES_DRY = ['DRY A', 'DRY B', 'DRY FG'];
    const zones = [...ZONES_WET, ...ZONES_DRY];

    useEffect(() => { load(); }, []);

    const load = async () => {
        setLoading(true);
        try {
            const [s, l, c, sh, g, b, p] = await Promise.all([
                api().get('/inventory/stock'),
                api().get('/inventory/logs/picking'),
                api().get('/customers'),
                api().get('/shifts'),
                api().get('/gudang'),
                api().get('/barang'),
                api().get('/planning-outbound'),
            ]);
            const stockData = unwrap(s) || [];
            const allStocks = Array.isArray(stockData) ? stockData : stockData?.data || [];
            const allBarangs = unwrap(b) || [];
            const allPlans = unwrap(p) || [];

            // Filter out all chicken items (handled separately in Planning Ayam)
            const nonAyamBarangs = allBarangs.filter((x: any) =>
                !x.nama?.toLowerCase().includes('ayam') && !x.kategori?.toLowerCase().includes('ayam')
            );
            const nonAyamStocks = allStocks.filter((st: any) =>
                !st.barang?.nama?.toLowerCase().includes('ayam') && !st.barang?.kategori?.toLowerCase().includes('ayam')
            );
            const nonAyamPlans = allPlans.filter((plan: any) => {
                return !plan.items?.some((item: any) => {
                    const brg = allBarangs.find((br: any) => String(br.id) === String(item.barangId));
                    return brg?.nama?.toLowerCase().includes('ayam') || brg?.kategori?.toLowerCase().includes('ayam');
                });
            });

            setStocks(nonAyamStocks);
            setLogs(unwrap(l) || []);
            setCustomers(unwrap(c) || []);
            setShifts(unwrap(sh) || []);
            const gudangData = unwrap(g);
            setAllGudangs(Array.isArray(gudangData) ? gudangData : gudangData?.data || []);
            setBarangs(nonAyamBarangs);
            setPlans(nonAyamPlans);
        } catch (e) { console.error(e); }
        setLoading(false);
    };

    // Stocks with available qty > 0
    const availableStocks = stocks.filter((s: any) => (s.qty - (s.reserved_qty || 0)) > 0);

    // Products that currently have available stock
    const availableBarangs = barangs.filter((b: any) =>
        availableStocks.some((s: any) => String(s.barang?.id) === String(b.id))
    );

    // Zones that contain the selected item (or any available stock if no item selected)
    const availableZones = Array.from(new Set(
        availableStocks
            .filter((s: any) => !selectedBarangId || String(s.barang?.id) === String(selectedBarangId))
            .map((s: any) => s.gudang?.zone)
            .filter(Boolean)
    ));

    // Filter stocks by selected zone & selected barang with available stock
    const zoneStocks = availableStocks
        .filter((s: any) => !selectedZone || s.gudang?.zone === selectedZone)
        .filter((s: any) => !selectedBarangId || String(s.barang?.id) === String(selectedBarangId));

    // Group stocks per rak
    const stockOpts = dedup(zoneStocks.map((s: any) => {
        const available = s.qty - (s.reserved_qty || 0);
        return {
            value: String(s.id),
            label: `[${s.gudang?.zone}] Rak ${s.gudang?.name} — ${s.barang?.nama || 'Unknown'} (Tersedia: ${available} ${s.satuan || 'qty'}, Reserved: ${s.reserved_qty || 0}, Exp: ${s.expiry_date ? new Date(s.expiry_date).toLocaleDateString('id-ID') : '-'})`,
            locName: `[${s.gudang?.zone}] Rak ${s.gudang?.name}`,
            itemNames: s.barang?.nama || 'Unknown',
            qtyStr: `Tersedia: ${available} ${s.satuan || 'qty'}`,
            disabled: available <= 0
        };
    }));

    const barangOpts = dedup(availableBarangs.map((b: any) => ({ value: String(b.id), label: b.sku ? `${b.sku} - ${b.nama}` : b.nama })));
    const zoneOpts = dedup(availableZones.map((z: any) => ({ value: z, label: z })));
    const customerOpts = Array.from(new Set(customers.map((c: any) => c.nama || c.name).filter(Boolean)));
    const shiftOpts = dedup(shifts.map((s: any) => ({ value: String(s.id), label: s.name })));
    const batchOpts = Array.from(new Set(availableStocks.map((s: any) => s.batch_no).filter(Boolean)));
    const refOpts = Array.from(new Set(logs.map((l: any) => l.no_ref).filter(Boolean)));

    // Get auto-fill data from selected stock
    const selStock = stocks.find((s: any) => s.id === +form.stock_id);

    const addItemToForm = () => {
        if (!form.stock_id || !form.qty) return notifications.show({ title: 'Error', message: 'Pilih stock & qty', color: 'red' });
        const st = stocks.find((s: any) => s.id === +form.stock_id);
        if (!st) return;

        const exists = form.items.some((it: any) => String(it.stock_id) === String(form.stock_id));
        if (exists) {
            setForm((p: any) => ({
                ...p,
                items: p.items.map((it: any) =>
                    String(it.stock_id) === String(form.stock_id)
                        ? { ...it, qty: it.qty + form.qty }
                        : it
                ),
            }));
        } else {
            setForm((p: any) => ({
                ...p,
                items: [...p.items, {
                    stock_id: form.stock_id,
                    barangId: st.barang?.id,
                    gudangId: st.gudang?.id,
                    qty: form.qty,
                    batch_no: form.nomor_batch || st.batch_no || '',
                    satuan: st.satuan || st.barang?.satuan || 'Pcs',
                    _brg: st.barang?.nama || 'Unknown',
                    _gdg: st.gudang?.name || '-',
                    _zone: st.gudang?.zone || '-',
                }]
            }));
        }
        setForm(p => ({ ...p, stock_id: '', qty: 1, nomor_batch: '' }));
    };

    const removeItemFromForm = (idx: number) => {
        setForm((p: any) => ({
            ...p,
            items: p.items.filter((_: any, i: number) => i !== idx),
        }));
    };

    const submitPlanning = async () => {
        if (!form.items.length) {
            return notifications.show({ title: 'Error', message: 'Tambahkan minimal 1 item ke planning', color: 'red' });
        }

        const custName = form.tujuan;
        const cust = customers.find((c: any) => (c.nama || c.name) === custName);

        const payload = {
            no_ref: form.no_ref || `PLAN-OUT-${Date.now()}`,
            customer_id: cust ? cust.id : undefined,
            shift_id: form.shift_id ? Number(form.shift_id) : undefined,
            tanggal_planning: form.tanggal_permintaan,
            tujuan: custName || undefined,
            items: form.items.map((item: any) => ({
                barang_id: Number(item.barangId),
                gudang_id: Number(item.gudangId),
                qty: Number(item.qty),
                batch_no: item.batch_no || undefined,
                satuan: item.satuan || undefined,
            }))
        };

        try {
            if (editPlanId !== null) {
                await api().put(`/planning-outbound/${editPlanId}`, payload);
                notifications.show({ title: 'Sukses', message: 'Planning Outbound berhasil diupdate', color: 'green' });
            } else {
                await api().post('/planning-outbound', payload);
                notifications.show({ title: 'Sukses', message: 'Planning Outbound berhasil disimpan', color: 'green' });
            }
            setEditPlanId(null);
            setForm({
                stock_id: '', qty: 1, tujuan: '', no_ref: '', shift_id: '',
                tanggal_permintaan: new Date().toISOString().split('T')[0],
                nomor_batch: '',
                items: [],
            });
            setSelectedZone('');
            setSelectedBarangId('');
            load();
        } catch (e: any) {
            notifications.show({
                title: 'Error',
                message: unwrap(e.response)?.message || 'Gagal menyimpan planning outbound',
                color: 'red'
            });
        }
    };

    const cancelEdit = () => {
        setEditPlanId(null);
        setForm({
            stock_id: '', qty: 1, tujuan: '', no_ref: '', shift_id: '',
            tanggal_permintaan: new Date().toISOString().split('T')[0],
            nomor_batch: '',
            items: [],
        });
        setSelectedZone('');
        setSelectedBarangId('');
    };

    const editTrans = (plan: any) => {
        const mappedItems = plan.items.map((r: any) => {
            const barangId = r.barang_id ?? r.barangId;
            const gudangId = r.gudang_id ?? r.gudangId;
            const bObj = barangs.find((b: any) => b.id === barangId);
            const gObj = allGudangs.find((g: any) => g.id === gudangId);
            return {
                barangId,
                gudangId,
                qty: r.qty,
                batch_no: r.batch_no || '',
                satuan: r.satuan || bObj?.satuan || '',
                _brg: bObj ? bObj.nama : '-',
                _gdg: gObj ? gObj.name : '-',
                _zone: gObj ? gObj.zone : '-',
            };
        });
        setForm({
            stock_id: '',
            qty: 1,
            tujuan: plan.customer?.nama || plan.tujuan || '',
            no_ref: plan.no_ref || '',
            shift_id: plan.shift?.id ? String(plan.shift.id) : '',
            tanggal_permintaan: plan.tanggal_planning,
            nomor_batch: '',
            items: mappedItems,
        });
        setEditPlanId(plan.id);
    };

    const deleteTrans = async (planId: number) => {
        if (!confirm('Yakin ingin menghapus Planning Outbound ini?')) return;
        try {
            await api().delete('/planning-outbound/' + planId);
            notifications.show({ title: 'Sukses', message: 'Planning Outbound berhasil dihapus', color: 'green' });
            load();
        } catch (e: any) {
            notifications.show({ title: 'Error', message: unwrap(e.response)?.message || 'Gagal menghapus planning', color: 'red' });
        }
    };

    const activePlans = plans.filter((p: any) => p.status !== 'DONE');
    const donePlans = plans.filter((p: any) => p.status === 'DONE');

    const sortFn = (a: any, b: any) => {
        if (!sortKey) return 0;
        let aVal = a[sortKey];
        let bVal = b[sortKey];

        if (aVal == null) aVal = "";
        if (bVal == null) bVal = "";

        if (typeof aVal === 'number' && typeof bVal === 'number') {
            return sortDir === 'asc' ? aVal - bVal : bVal - aVal;
        }
        const cmp = String(aVal).localeCompare(String(bVal), undefined, { numeric: true });
        return sortDir === 'asc' ? cmp : -cmp;
    };

    const sortedActivePlans = [...activePlans].sort(sortFn);
    const sortedDonePlans = [...donePlans].sort(sortFn);

    return (
        <Box>
            <Box style={{ background: '#fff', borderLeft: '4px solid #e6921e', padding: '14px 20px', marginBottom: 16, boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}>
                <Group justify="space-between">
                    <Title order={4} style={{ color: '#111827', fontWeight: 800, display: "flex", alignItems: "center", gap: 8 }}>
                        <IconBuildingWarehouse size={20} style={{ color: '#e6921e' }} />
                        PLANNING OUTBOUND
                    </Title>
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
                                    clearable
                                    data={stockOpts}
                                    value={form.stock_id}
                                    onChange={v => {
                                        const sObj = stocks.find((s: any) => String(s.id) === String(v));
                                        const avail = sObj ? sObj.qty - (sObj.reserved_qty || 0) : 1;
                                        setForm(p => ({ ...p, stock_id: v || '', qty: avail > 0 ? 1 : 0 }));
                                    }}
                                    placeholder="Cari nomor rak..."
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
                                    allowedDecimalSeparators={[".", ","]}
                                    decimalScale={3}
                                    step={0.1}
                                    value={form.qty}
                                    onChange={v => setForm(p => ({ ...p, qty: Number(v) }))}
                                    min={1}
                                    max={selStock ? selStock.qty - (selStock.reserved_qty || 0) : undefined}
                                    disabled={!form.stock_id}
                                />
                                <Autocomplete label="Nomor Batch" size="xs" data={batchOpts} value={form.nomor_batch} onChange={v => setForm(p => ({ ...p, nomor_batch: v }))} placeholder="Pilih/Ketik Nomor Batch" />

                                <Button size="xs" color="orange" variant="outline" onClick={addItemToForm} leftSection={<IconPlus size={14} />}>+ Tambah Item</Button>

                                {form.items.length > 0 && (
                                    <Box style={{ overflowX: "auto", marginTop: 8 }}>
                                        <table style={{ width: "100%", fontSize: 10, borderCollapse: "collapse" }}>
                                            <thead>
                                                <tr style={{ background: "#f8f9fa", borderBottom: "1px solid #e2e8f0" }}>
                                                    <th style={{ textAlign: "left", padding: 4 }}>Barang</th>
                                                    <th style={{ textAlign: "right", padding: 4 }}>Qty</th>
                                                    <th style={{ textAlign: "center", padding: 4 }}>Aksi</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {form.items.map((it: any, idx: number) => (
                                                    <tr key={idx} style={{ borderBottom: "1px solid #f1f5f9" }}>
                                                        <td style={{ padding: 4 }}>{it._brg} ({it._gdg})</td>
                                                        <td style={{ padding: 4, textAlign: "right", fontWeight: 700 }}>{it.qty} {it.satuan}</td>
                                                        <td style={{ padding: 4, textAlign: "center" }}>
                                                            <ActionIcon size="xs" color="red" variant="subtle" onClick={() => removeItemFromForm(idx)}>
                                                                <IconTrash size={12} />
                                                            </ActionIcon>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </Box>
                                )}

                                <Divider my={4} />

                                <Autocomplete label="Tujuan (Master Customer)" size="xs" data={customerOpts} value={form.tujuan} onChange={v => setForm(p => ({ ...p, tujuan: v }))} placeholder="Produksi AP / Customer..." />
                                <TextInput label="Tanggal Permintaan" size="xs" type="date" value={form.tanggal_permintaan} onChange={e => setForm(p => ({ ...p, tanggal_permintaan: e.target.value }))} />
                                <Autocomplete label="Shift" size="xs" data={shifts.map((s: any) => s.name)} value={shifts.find((s: any) => String(s.id) === form.shift_id)?.name || form.shift_id} onChange={v => { const match = shifts.find((s: any) => s.name.toLowerCase() === v.toLowerCase()); setForm(p => ({ ...p, shift_id: match ? String(match.id) : v })); }} placeholder="Pilih shift" />

                                <Group gap="xs" mt="xs">
                                    <Button fullWidth size="xs" color="orange" onClick={submitPlanning} style={{ fontWeight: 700, flex: 1 }} leftSection={<IconPlus size={14} />}>
                                        {editPlanId !== null ? "Update Planning Outbound" : "Simpan Planning Outbound"}
                                    </Button>
                                    {editPlanId !== null && (
                                        <Button size="xs" color="gray" variant="outline" onClick={cancelEdit}>Batal</Button>
                                    )}
                                </Group>
                            </Stack>
                        </Paper>
                    </Grid.Col>

                    {/* Right Tables Panel */}
                    <Grid.Col span={{ base: 12, md: 8, lg: 9 }}>
                        <Stack gap="md">
                            {/* Table for active plans */}
                            <Paper withBorder p="md" radius="md" style={{ background: '#fff' }}>
                                <Group justify="space-between" mb="sm">
                                    <Text fw={850} size="sm" c="orange">
                                        PLANNING OUTBOUND AKTIF ({activePlans.length} Transaksi)
                                    </Text>
                                </Group>

                                <Box style={{ overflowX: 'auto' }}>
                                    <Table withTableBorder withColumnBorders style={{ fontSize: 11 }}>
                                        <Table.Thead style={{ background: "#fff4e6", borderBottom: "2px solid #ffd8a8" }}>
                                            <Table.Tr>
                                                <Table.Th style={{ color: "#d9480f", cursor: "pointer" }} onClick={() => handleSort('no_ref')}>
                                                    ID Transaksi / Ref{sortIcon('no_ref')}
                                                </Table.Th>
                                                <Table.Th style={{ color: "#d9480f", cursor: "pointer" }} onClick={() => handleSort('tujuan')}>
                                                    Tujuan{sortIcon('tujuan')}
                                                </Table.Th>
                                                <Table.Th style={{ color: "#d9480f", cursor: "pointer" }} onClick={() => handleSort('tanggal_planning')}>
                                                    Tanggal Planning{sortIcon('tanggal_planning')}
                                                </Table.Th>
                                                <Table.Th style={{ color: "#d9480f", cursor: "pointer" }} onClick={() => handleSort('shift.name')}>
                                                    Shift{sortIcon('shift.name')}
                                                </Table.Th>
                                                <Table.Th style={{ color: "#d9480f" }}>
                                                    Items
                                                </Table.Th>
                                                <Table.Th style={{ color: "#d9480f" }}>Status</Table.Th>
                                                <Table.Th style={{ color: "#d9480f" }}>Aksi</Table.Th>
                                            </Table.Tr>
                                        </Table.Thead>
                                        <Table.Tbody>
                                            {sortedActivePlans.map((plan: any) => {
                                                const statusColor = (status: string) => {
                                                    if (status === 'PROGRESS') return 'blue';
                                                    if (status === 'CANCEL') return 'red';
                                                    return 'yellow';
                                                };
                                                return (
                                                    <Table.Tr key={plan.id}>
                                                        <Table.Td fw={700} style={{ color: '#1565c0' }}>{plan.no_ref || `#${plan.id}`}</Table.Td>
                                                        <Table.Td>{plan.customer?.nama || plan.tujuan || '-'}</Table.Td>
                                                        <Table.Td>{fmt(plan.tanggal_planning)}</Table.Td>
                                                        <Table.Td>{plan.shift?.name || '-'}</Table.Td>
                                                        <Table.Td>
                                                            {plan.items?.map((item: any, idx: number) => {
                                                                const bName = barangs.find((b: any) => b.id === item.barangId)?.nama || '-';
                                                                return (
                                                                    <div key={idx} style={{ fontSize: 10, borderBottom: '1px solid #f1f5f9', padding: '2px 0' }}>
                                                                        {bName} <b>x{item.qty}</b>
                                                                    </div>
                                                                );
                                                            })}
                                                        </Table.Td>
                                                        <Table.Td>
                                                            <Badge size="xs" color={statusColor(plan.status)} variant="filled">{plan.status}</Badge>
                                                            <Text size="10px" c="dimmed">Dibuat {plan.created_by_username || 'sistem'} · {fmt(plan.created_at)}</Text>
                                                            {plan.published_at && <Text size="10px" c="dimmed">Eksekusi {plan.executed_by_username || 'sistem'} · {fmt(plan.published_at)}</Text>}
                                                        </Table.Td>
                                                        <Table.Td>
                                                            <Group gap={6} wrap="nowrap">
                                                                {plan.status === 'WAIT' && (
                                                                    <>
                                                                        <Tooltip label="Edit">
                                                                            <ActionIcon size="sm" color="green" variant="light" onClick={() => editTrans(plan)}>
                                                                                <IconEdit size={13} />
                                                                            </ActionIcon>
                                                                        </Tooltip>
                                                                        <Tooltip label="Hapus Transaksi">
                                                                            <ActionIcon size="sm" color="red" variant="light" onClick={() => deleteTrans(plan.id)}>
                                                                                <IconTrash size={13} />
                                                                            </ActionIcon>
                                                                        </Tooltip>
                                                                    </>
                                                                )}
                                                            </Group>
                                                        </Table.Td>
                                                    </Table.Tr>
                                                );
                                            })}
                                            {sortedActivePlans.length === 0 && (
                                                <Table.Tr>
                                                    <Table.Td colSpan={7} ta="center" c="dimmed">
                                                        Tidak ada data planning outbound aktif.
                                                    </Table.Td>
                                                </Table.Tr>
                                            )}
                                        </Table.Tbody>
                                    </Table>
                                </Box>
                            </Paper>

                            {/* Table for completed plans */}
                            <Paper withBorder p="md" radius="md" style={{ background: '#fff' }}>
                                <Group justify="space-between" mb="sm">
                                    <Text fw={850} size="sm" c="dimmed">
                                        RIWAYAT PLANNING OUTBOUND SELESAI ({donePlans.length} Transaksi)
                                    </Text>
                                </Group>

                                <Box style={{ overflowX: 'auto' }}>
                                    <Table withTableBorder withColumnBorders style={{ fontSize: 11 }}>
                                        <Table.Thead style={{ background: "#fff4e6", borderBottom: "2px solid #ffd8a8" }}>
                                            <Table.Tr>
                                                <Table.Th style={{ color: "#d9480f", cursor: "pointer" }} onClick={() => handleSort('no_ref')}>
                                                    ID Transaksi / Ref{sortIcon('no_ref')}
                                                </Table.Th>
                                                <Table.Th style={{ color: "#d9480f", cursor: "pointer" }} onClick={() => handleSort('tujuan')}>
                                                    Tujuan{sortIcon('tujuan')}
                                                </Table.Th>
                                                <Table.Th style={{ color: "#d9480f", cursor: "pointer" }} onClick={() => handleSort('tanggal_planning')}>
                                                    Tanggal Planning{sortIcon('tanggal_planning')}
                                                </Table.Th>
                                                <Table.Th style={{ color: "#d9480f", cursor: "pointer" }} onClick={() => handleSort('shift.name')}>
                                                    Shift{sortIcon('shift.name')}
                                                </Table.Th>
                                                <Table.Th style={{ color: "#d9480f" }}>
                                                    Items
                                                </Table.Th>
                                                <Table.Th style={{ color: "#d9480f" }}>Status</Table.Th>
                                                <Table.Th style={{ color: "#d9480f" }}>Aksi</Table.Th>
                                            </Table.Tr>
                                        </Table.Thead>
                                        <Table.Tbody>
                                            {sortedDonePlans.map((plan: any) => {
                                                return (
                                                    <Table.Tr key={plan.id}>
                                                        <Table.Td fw={700} style={{ color: '#1565c0' }}>{plan.no_ref || `#${plan.id}`}</Table.Td>
                                                        <Table.Td>{plan.customer?.nama || plan.tujuan || '-'}</Table.Td>
                                                        <Table.Td>{fmt(plan.tanggal_planning)}</Table.Td>
                                                        <Table.Td>{plan.shift?.name || '-'}</Table.Td>
                                                        <Table.Td>
                                                            {plan.items?.map((item: any, idx: number) => {
                                                                const bName = barangs.find((b: any) => b.id === item.barangId)?.nama || '-';
                                                                return (
                                                                    <div key={idx} style={{ fontSize: 10, borderBottom: '1px solid #f1f5f9', padding: '2px 0' }}>
                                                                        {bName} <b>x{item.qty}</b>
                                                                    </div>
                                                                );
                                                            })}
                                                        </Table.Td>
                                                        <Table.Td>
                                                            <Badge size="xs" color="green" variant="filled">{plan.status}</Badge>
                                                            <Text size="10px" c="dimmed">Dibuat {plan.created_by_username || 'sistem'} · {fmt(plan.created_at)}</Text>
                                                            <Text size="10px" c="dimmed">Eksekusi {plan.executed_by_username || 'sistem'} · {fmt(plan.published_at)}</Text>
                                                        </Table.Td>
                                                        <Table.Td>
                                                            <Group gap={6} wrap="nowrap">
                                                                <Tooltip label="Print PDF">
                                                                    <ActionIcon size="sm" color="red" variant="light" onClick={() => printPDF(plan)}>
                                                                        <IconFileTypePdf size={13} />
                                                                    </ActionIcon>
                                                                </Tooltip>
                                                            </Group>
                                                        </Table.Td>
                                                    </Table.Tr>
                                                );
                                            })}
                                            {sortedDonePlans.length === 0 && (
                                                <Table.Tr>
                                                    <Table.Td colSpan={7} ta="center" c="dimmed">
                                                        Tidak ada data planning outbound selesai.
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
