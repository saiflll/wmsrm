'use client';
// @ts-nocheck
import React, { useState, useEffect, useMemo } from 'react';
import {
    Box, Group, Paper, Stack, Text, Badge, Button, Loader, TextInput
} from '@mantine/core';
import {
    IconPackage, IconRefresh, IconCalendarStats,
    IconBuildingWarehouse, IconAlertTriangle,
    IconDownload, IconSearch, IconFilter, IconX
} from '@tabler/icons-react';
import { Table } from '../components/Table';
import { api, unwrap, fmt } from '../lib/api';

/* ─────────────────────────── constants ─────────────────────────── */
const cardShadow  = '0 2px 12px rgba(0,0,0,0.07)';
const headerGradient = 'linear-gradient(135deg, #0c1445 0%, #1a3a6b 60%, #0e4d91 100%)';
const tableHeaderGradient = 'linear-gradient(90deg, #1c2742, #2d3f6b)';

const TABS = [
    { key: 'occupancy', label: 'OCCUPANCY' },
    { key: 'ofti',      label: 'OFTI' },
    { key: 'serapan',   label: 'Serapan Ayam' },
    { key: 'report',    label: 'Report' },
];

/* ─────────────────────────── Main Page ─────────────────────────── */
export default function DashboardPage() {
    const [activeTab,       setActiveTab]       = useState('occupancy');
    const [stats,           setStats]           = useState(null);
    const [occupancyData,   setOccupancyData]   = useState(null);
    const [oftiData,        setOftiData]        = useState(null);
    const [serapanData,     setSerapanData]     = useState(null);
    const [logs,            setLogs]            = useState([]);
    const [loading,         setLoading]         = useState(true);
    const [tableSearch,     setTableSearch]     = useState('');
    const [selectedZone,    setSelectedZone]    = useState(null);
    const [exportFrom,      setExportFrom]      = useState<Date | null>(null);
    const [exportTo,        setExportTo]        = useState<Date | null>(null);
    const [showExportFilter,setShowExportFilter]= useState(false);
    const [reportData,      setReportData]      = useState(null);

    useEffect(() => { loadBaseData(); }, []);

    useEffect(() => {
        if (activeTab === 'occupancy' && !occupancyData) loadOccupancy();
        if (activeTab === 'ofti'      && !oftiData)      loadOFTI();
        if (activeTab === 'serapan'   && !serapanData)   loadSerapan();
        if (activeTab === 'report'    && !reportData)    loadReport();
    }, [activeTab]);

    const loadBaseData = async () => {
        try {
            const [dashRes, logRes] = await Promise.all([
                api().get('/inventory/dashboard'),
                api().get('/inventory/logs'),
            ]);
            setStats(unwrap(dashRes));
            setLogs(unwrap(logRes));
        } catch (e) { console.error('Dashboard load error', e); }
        setLoading(false);
    };

    const loadOccupancy = async (zone?: string) => {
        try {
            const params = zone ? `?zone=${zone}` : '';
            setOccupancyData(unwrap(await api().get(`/inventory/dashboard/occupancy${params}`)));
        } catch (e) { console.error('Occupancy load error', e); }
    };

    const handleZoneClick = (zone: string) => {
        if (selectedZone === zone) { setSelectedZone(null); loadOccupancy(); }
        else { setSelectedZone(zone); loadOccupancy(zone); }
    };

    const loadOFTI    = async () => { try { setOftiData(unwrap(await api().get('/inventory/dashboard/ofti'))); } catch (e) {} };
    const loadSerapan = async () => { try { setSerapanData(unwrap(await api().get('/inventory/dashboard/serapan-ayam'))); } catch (e) {} };
    const loadReport  = async () => { try { setReportData(unwrap(await api().get('/inventory/dashboard/inout-chart'))); } catch (e) {} };

    const filteredLogs = useMemo(() => {
        if (!tableSearch) return logs;
        const q = tableSearch.toLowerCase();
        return logs.filter((log) =>
            (log.no_po   && log.no_po.toLowerCase().includes(q)) ||
            (log.no_ref  && log.no_ref.toLowerCase().includes(q)) ||
            (log.barang?.nama && log.barang.nama.toLowerCase().includes(q)) ||
            (log.supplier && log.supplier.toLowerCase().includes(q)) ||
            (log.tujuan  && log.tujuan.toLowerCase().includes(q)) ||
            (log.gudang?.name && log.gudang.name.toLowerCase().includes(q))
        );
    }, [logs, tableSearch]);

    if (loading) return <Box p="xl" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 300 }}><Loader size="lg" /></Box>;

    const s = stats || {};

    /* ── export helper ── */
    const handleExportCSV = () => {
        let exportLogs = filteredLogs;
        if (exportFrom) { const d = new Date(exportFrom); exportLogs = exportLogs.filter(l => new Date(l.created_at) >= d); }
        if (exportTo)   { const d = new Date(exportTo); d.setHours(23,59,59); exportLogs = exportLogs.filter(l => new Date(l.created_at) <= d); }
        const csv = ['Tipe,No PO/Ref,Item,Qty,Satuan,Batch,Expired,Rak,Tanggal,Supplier/Tujuan,Keterangan']
            .concat(exportLogs.map(log => [
                log.type, log.no_po || log.no_ref || '-', log.barang?.nama || '-', log.qty,
                log.satuan || '-', log.batch_no || '-',
                log.expiry_date ? new Date(log.expiry_date).toISOString().split('T')[0] : '-',
                log.gudang?.name || '-',
                log.tanggal_income || fmt(log.created_at),
                log.supplier || log.tujuan || '-',
                log.note || '-'
            ].join(','))).join('\n');
        const blob = new Blob([csv], { type: 'text/csv' });
        const url  = URL.createObjectURL(blob);
        const a    = document.createElement('a');
        a.href = url;
        a.download = `mutasi_${exportFrom ? exportFrom.toISOString().split('T')[0] : 'all'}_to_${exportTo ? exportTo.toISOString().split('T')[0] : 'now'}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    };

    return (
        <Box style={{ background: '#f4f6fb', minHeight: '100vh' }}>

            {/* ════════ TOP HEADER STRIP ════════ */}
            <Box style={{
                background: headerGradient,
                padding: '10px 16px 0',
                boxShadow: '0 2px 16px rgba(0,0,0,0.15)',
            }}>
                {/* Title row */}
                <Group justify="space-between" align="center" mb={10}>
                    <Group gap={8}>
                        <Box style={{ background: 'rgba(255,255,255,0.15)', borderRadius: 8, padding: 6 }}>
                            <IconBuildingWarehouse size={20} color="#90caf9" />
                        </Box>
                        <Box>
                            <Text size="xs" style={{ color: '#90caf9', letterSpacing: '0.1em', fontWeight: 600, lineHeight: 1 }}>WAREHOUSE MANAGEMENT SYSTEM</Text>
                            <Text fw={900} style={{ color: '#fff', fontSize: 15, lineHeight: 1.2, letterSpacing: '0.02em' }}>DASHBOARD MONITORING RAW MATERIALS</Text>
                        </Box>
                        {/* Alert badges */}
                        <Group gap={4} ml={4}>
                            {s.expiredCount > 0 && (
                                <Badge color="red" variant="filled" size="xs" leftSection={<IconAlertTriangle size={10} />}>
                                    EXPIRED {s.expiredCount}
                                </Badge>
                            )}
                            {s.nearExpiredCount > 0 && (
                                <Badge color="yellow" variant="filled" size="xs" leftSection={<IconCalendarStats size={10} />} style={{ color: '#1a1a1a' }}>
                                    NEAR EXP {s.nearExpiredCount}
                                </Badge>
                            )}
                            {s.wasteCount > 0 && (
                                <Badge color="violet" variant="filled" size="xs" leftSection={<IconPackage size={10} />}>
                                    WASTE {s.wasteCount}
                                </Badge>
                            )}
                        </Group>
                    </Group>
                    <Button size="xs" variant="white" color="dark" leftSection={<IconRefresh size={13} />}
                        onClick={() => { loadBaseData(); if (activeTab === 'occupancy') loadOccupancy(); if (activeTab === 'ofti') loadOFTI(); if (activeTab === 'serapan') loadSerapan(); if (activeTab === 'report') loadReport(); }}
                        style={{ fontWeight: 700, borderRadius: 8 }}>
                        Refresh
                    </Button>
                </Group>

                {/* KPI cards row — plain, simple cards */}
                <Group gap={6} mb={10} wrap="wrap">
                    <Paper withBorder p="xs" style={{ borderRadius: 8, background: '#fff', boxShadow: cardShadow, minWidth: 100 }}>
                        <Stack gap={2} align="center">
                            <Text size="9px" c="dimmed" fw={600} tt="uppercase">Total SKU</Text>
                            <Text size="lg" fw={800}>{s.totalSku?.toLocaleString() ?? s.skuCount?.toLocaleString() ?? '—'}</Text>
                            <Text size="8px" c="dimmed">aktif di gudang</Text>
                        </Stack>
                    </Paper>
                    <Paper withBorder p="xs" style={{ borderRadius: 8, background: '#fff', boxShadow: cardShadow, minWidth: 100 }}>
                        <Stack gap={2} align="center">
                            <Text size="9px" c="dimmed" fw={600} tt="uppercase">Total Stock</Text>
                            <Text size="lg" fw={800}>{s.totalStock ? `${Number(s.totalStock).toLocaleString()} kg` : '—'}</Text>
                            <Text size="8px" c="dimmed">keseluruhan gudang</Text>
                        </Stack>
                    </Paper>
                    <Paper withBorder p="xs" style={{ borderRadius: 8, background: '#fff', boxShadow: cardShadow, minWidth: 100 }}>
                        <Stack gap={2} align="center">
                            <Text size="9px" c="dimmed" fw={600} tt="uppercase">Inbound Hari Ini</Text>
                            <Text size="lg" fw={800} c="green">{s.todayInbound?.toLocaleString() ?? '0'}</Text>
                            <Text size="8px" c="dimmed">transaksi masuk</Text>
                        </Stack>
                    </Paper>
                    <Paper withBorder p="xs" style={{ borderRadius: 8, background: '#fff', boxShadow: cardShadow, minWidth: 100 }}>
                        <Stack gap={2} align="center">
                            <Text size="9px" c="dimmed" fw={600} tt="uppercase">Outbound Hari Ini</Text>
                            <Text size="lg" fw={800} c="red">{s.todayOutbound?.toLocaleString() ?? '0'}</Text>
                            <Text size="8px" c="dimmed">transaksi keluar</Text>
                        </Stack>
                    </Paper>
                    <Paper withBorder p="xs" style={{ borderRadius: 8, background: '#fff', boxShadow: cardShadow, minWidth: 100 }}>
                        <Stack gap={2} align="center">
                            <Text size="9px" c="dimmed" fw={600} tt="uppercase">Expired</Text>
                            <Text size="lg" fw={800} c="red">{s.expiredCount ?? 0}</Text>
                            <Text size="8px" c="dimmed">item expired</Text>
                        </Stack>
                    </Paper>
                    <Paper withBorder p="xs" style={{ borderRadius: 8, background: '#fff', boxShadow: cardShadow, minWidth: 100 }}>
                        <Stack gap={2} align="center">
                            <Text size="9px" c="dimmed" fw={600} tt="uppercase">Near Expired</Text>
                            <Text size="lg" fw={800} c="orange">{s.nearExpiredCount ?? 0}</Text>
                            <Text size="8px" c="dimmed">≤ 7 hari</Text>
                        </Stack>
                    </Paper>
                </Group>

                {/* Tab nav — simple buttons, no accent colors */}
                <Group gap={0} wrap="nowrap" style={{ overflowX: 'auto' }}>
                    {TABS.map((tab) => {
                        const active = activeTab === tab.key;
                        return (
                            <Button key={tab.key} size="xs"
                                variant={active ? 'filled' : 'subtle'}
                                color={active ? 'blue' : 'gray'}
                                onClick={() => setActiveTab(tab.key)}
                                style={{
                                    height: 34, borderRadius: '8px 8px 0 0',
                                    padding: '0 14px', fontWeight: 700, fontSize: 11,
                                    letterSpacing: '0.04em',
                                    color: active ? '#fff' : 'rgba(255,255,255,0.65)',
                                    background: active ? undefined : 'transparent',
                                    flexShrink: 0,
                                }}
                            >
                                {tab.label}
                            </Button>
                        );
                    })}
                </Group>
            </Box>

            {/* ════════ TAB CONTENT ════════ */}
            <Box p="sm">
                <Stack gap="sm">

                    {/* ── OCCUPANCY tab ── */}
                    {activeTab === 'occupancy' && (
                        <>
                            {/* Zone occupancy summary */}
                            <Paper withBorder p="md" style={{ borderRadius: 12, background: '#fff', boxShadow: cardShadow }}>
                                <Text fw={800} size="sm" mb="xs">Okupansi per Zone</Text>
                                <Text size="xs" c="dimmed" mb="sm">Klik baris untuk melihat detail item & trend harian</Text>
                                <Box style={{ overflowX: 'auto' }}>
                                    <Table withTableBorder withColumnBorders style={{ fontSize: 11, minWidth: 600 }}>
                                        <Table.Thead style={{ background: tableHeaderGradient }}>
                                            <Table.Tr>
                                                {['Zone','Terpakai (kg)','Kapasitas (kg)','%','Status'].map(h => (
                                                    <Table.Th key={h} style={{ color: '#e9ecef', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                                                        {h}
                                                    </Table.Th>
                                                ))}
                                            </Table.Tr>
                                        </Table.Thead>
                                        <Table.Tbody>
                                            {occupancyData?.gauges?.map((g, idx) => {
                                                const pctColor = g.pct > 90 ? 'red' : g.pct > 75 ? 'orange' : g.pct > 50 ? 'yellow' : 'green';
                                                const statusLabel = g.pct > 90 ? 'Penuh' : g.pct > 75 ? 'Hampir Penuh' : g.pct > 50 ? 'Sedang' : 'Aman';
                                                return (
                                                    <Table.Tr key={g.id} style={{ cursor: 'pointer', background: selectedZone === g.id ? '#f0f7ff' : undefined }}
                                                        onClick={() => handleZoneClick(g.id)}>
                                                        <Table.Td fw={700}>{g.name}</Table.Td>
                                                        <Table.Td ta="right" fw={600}>{Math.round(g.used).toLocaleString()}</Table.Td>
                                                        <Table.Td ta="right">{Math.round(g.capacity).toLocaleString()}</Table.Td>
                                                        <Table.Td>
                                                            <Group gap={6} wrap="nowrap">
                                                                <Box style={{ flex: 1, background: '#f1f3f5', borderRadius: 4, height: 8, minWidth: 60, maxWidth: 100, overflow: 'hidden' }}>
                                                                    <Box style={{ width: `${g.pct}%`, height: '100%', background: g.color, borderRadius: 4 }} />
                                                                </Box>
                                                                <Badge size="xs" color={pctColor} variant="filled">{g.pct}%</Badge>
                                                            </Group>
                                                        </Table.Td>
                                                        <Table.Td><Badge size="xs" color={pctColor} variant="light">{statusLabel}</Badge></Table.Td>
                                                    </Table.Tr>
                                                );
                                            })}
                                            {!occupancyData && (
                                                <Table.Tr><Table.Td colSpan={5} style={{ textAlign: 'center', padding: 20 }}><Loader size="sm" /></Table.Td></Table.Tr>
                                            )}
                                        </Table.Tbody>
                                    </Table>
                                </Box>
                            </Paper>

                            {selectedZone ? (
                                <>
                                    {/* Daily trend — simplified to table */}
                                    <Paper withBorder p="md" style={{ borderRadius: 12, background: '#fff', boxShadow: cardShadow }}>
                                        <Group justify="space-between" mb="xs">
                                            <Box>
                                                <Text fw={800} size="sm">Trend Harian — Zone {selectedZone}</Text>
                                                <Text size="xs" c="dimmed">Data 1 tahun terakhir</Text>
                                            </Box>
                                            <Badge size="sm" variant="light" color="gray" style={{ cursor: 'pointer' }}
                                                onClick={() => { setSelectedZone(null); loadOccupancy(); }}>
                                                Kembali ke semua zone
                                            </Badge>
                                        </Group>
                                        <Box style={{ overflowX: 'auto', maxHeight: 300 }}>
                                            <Table withTableBorder withColumnBorders style={{ fontSize: 11, minWidth: 400 }}>
                                                <Table.Thead style={{ background: tableHeaderGradient }}>
                                                    <Table.Tr>
                                                        <Table.Th style={{ color: '#e9ecef', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Tanggal</Table.Th>
                                                        <Table.Th style={{ color: '#e9ecef', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }} ta="right">Qty (kg)</Table.Th>
                                                    </Table.Tr>
                                                </Table.Thead>
                                                <Table.Tbody>
                                                    {occupancyData?.dailySeries?.slice().reverse().slice(0, 50).map((d) => (
                                                        <Table.Tr key={d.date}>
                                                            <Table.Td fw={600}>{d.date}</Table.Td>
                                                            <Table.Td ta="right" fw={700}>{d.value?.toLocaleString()}</Table.Td>
                                                        </Table.Tr>
                                                    ))}
                                                    {(!occupancyData?.dailySeries || occupancyData.dailySeries.length === 0) && (
                                                        <Table.Tr><Table.Td colSpan={2} style={{ textAlign: 'center', padding: 16 }}>Tidak ada data.</Table.Td></Table.Tr>
                                                    )}
                                                </Table.Tbody>
                                            </Table>
                                        </Box>
                                    </Paper>

                                    {/* Items table for selected zone */}
                                    <Paper withBorder p="md" style={{ borderRadius: 12, background: '#fff', boxShadow: cardShadow }}>
                                        <Group justify="space-between" mb="xs">
                                            <Box>
                                                <Text fw={800} size="sm">Item di Zone {selectedZone}</Text>
                                                <Text size="xs" c="dimmed">{occupancyData?.items?.length || 0} item ditemukan</Text>
                                            </Box>
                                            <TextInput placeholder="Cari item..." size="xs"
                                                leftSection={<IconSearch size={12} />}
                                                value={tableSearch} onChange={(e) => setTableSearch(e.target.value)}
                                                style={{ width: 180 }} />
                                        </Group>
                                        <Box style={{ overflowX: 'auto' }}>
                                            <Table withTableBorder withColumnBorders style={{ fontSize: 11, minWidth: 600 }}>
                                                <Table.Thead style={{ background: tableHeaderGradient }}>
                                                    <Table.Tr>
                                                        {['Barang','Batch','Qty','Satuan','Expired','Rak'].map(h => (
                                                            <Table.Th key={h} style={{ color: '#e9ecef', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                                                                {h}
                                                            </Table.Th>
                                                        ))}
                                                    </Table.Tr>
                                                </Table.Thead>
                                                <Table.Tbody>
                                                    {occupancyData?.items
                                                        ?.filter(item => !tableSearch || item.barang.toLowerCase().includes(tableSearch.toLowerCase()) || item.batch.toLowerCase().includes(tableSearch.toLowerCase()))
                                                        .map((item) => (
                                                            <Table.Tr key={item.id}>
                                                                <Table.Td fw={700}>{item.barang}</Table.Td>
                                                                <Table.Td><Badge size="xs" color="indigo" variant="light">{item.batch}</Badge></Table.Td>
                                                                <Table.Td ta="right" fw={700}>{item.qty.toLocaleString()}</Table.Td>
                                                                <Table.Td><Text size="xs" c="dimmed">{item.satuan}</Text></Table.Td>
                                                                <Table.Td>
                                                                    {item.expiry
                                                                        ? <Badge size="xs" color={new Date(item.expiry) < new Date() ? 'red' : 'teal'} variant="light">{item.expiry}</Badge>
                                                                        : <Text size="xs" c="dimmed">—</Text>
                                                                    }
                                                                </Table.Td>
                                                                <Table.Td><Badge size="xs" color="gray" variant="outline">{item.rack}</Badge></Table.Td>
                                                            </Table.Tr>
                                                        ))
                                                    }
                                                    {(!occupancyData?.items || occupancyData.items.length === 0) && (
                                                        <Table.Tr><Table.Td colSpan={6} style={{ textAlign: 'center', padding: 20 }}>Tidak ada item di zone ini.</Table.Td></Table.Tr>
                                                    )}
                                                </Table.Tbody>
                                            </Table>
                                        </Box>
                                    </Paper>
                                </>
                            ) : (
                                <>
                                    {/* Yearly zone occupancy table */}
                                    <Paper withBorder p="md" style={{ borderRadius: 12, background: '#fff', boxShadow: cardShadow }}>
                                        <Text fw={800} size="sm" mb="xs">Okupansi per Zone (1 Tahun)</Text>
                                        <Text size="xs" c="dimmed" mb="sm">Ringkasan data mingguan per zone</Text>
                                        <Box style={{ overflowX: 'auto', maxHeight: 400 }}>
                                            {occupancyData?.weeks && occupancyData?.series ? (
                                                <Table withTableBorder withColumnBorders style={{ fontSize: 10, minWidth: 500 }}>
                                                    <Table.Thead style={{ background: tableHeaderGradient }}>
                                                        <Table.Tr>
                                                            <Table.Th style={{ color: '#e9ecef', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Minggu</Table.Th>
                                                            {occupancyData.series.map((s) => (
                                                                <Table.Th key={s.label} ta="right" style={{ color: '#e9ecef', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                                                                    {s.label}
                                                                </Table.Th>
                                                            ))}
                                                        </Table.Tr>
                                                    </Table.Thead>
                                                    <Table.Tbody>
                                                        {occupancyData.weeks.slice().reverse().slice(0, 30).map((w, wIdx) => (
                                                            <Table.Tr key={w.key ?? w.label}>
                                                                <Table.Td fw={600}>{w.label}</Table.Td>
                                                                {occupancyData.series.map((s, sIdx) => {
                                                                    const val = s.data?.[occupancyData.weeks.length - 1 - wIdx] ?? 0;
                                                                    return <Table.Td key={sIdx} ta="right" fw={600}>{val.toLocaleString()}</Table.Td>;
                                                                })}
                                                            </Table.Tr>
                                                        ))}
                                                        {(!occupancyData.weeks || occupancyData.weeks.length === 0) && (
                                                            <Table.Tr><Table.Td colSpan={(occupancyData?.series?.length || 1) + 1} style={{ textAlign: 'center', padding: 16 }}>Tidak ada data.</Table.Td></Table.Tr>
                                                        )}
                                                    </Table.Tbody>
                                                </Table>
                                            ) : (
                                                <Box py="xl" ta="center"><Loader size="sm" /></Box>
                                            )}
                                        </Box>
                                    </Paper>
                                </>
                            )}
                        </>
                    )}

                    {/* ── OFTI tab ── */}
                    {activeTab === 'ofti' && (
                        <>
                            <Paper withBorder p="md" style={{ borderRadius: 12, background: '#fff', boxShadow: cardShadow }}>
                                <Text fw={800} size="sm" mb="xs">Planning Inbound vs Actual Inbound</Text>
                                <Text size="xs" c="dimmed" mb="sm">On Time vs Late — 1 tahun</Text>
                                <Box style={{ overflowX: 'auto', maxHeight: 400 }}>
                                    {oftiData?.weekly?.length > 0 ? (
                                        <Table withTableBorder withColumnBorders style={{ fontSize: 11, minWidth: 400 }}>
                                            <Table.Thead style={{ background: tableHeaderGradient }}>
                                                <Table.Tr>
                                                    {['Minggu','On Time','Late','Total'].map(h => (
                                                        <Table.Th key={h} ta={h !== 'Minggu' ? 'right' : undefined} style={{ color: '#e9ecef', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                                                            {h}
                                                        </Table.Th>
                                                    ))}
                                                </Table.Tr>
                                            </Table.Thead>
                                            <Table.Tbody>
                                                {oftiData.weekly.map((d, idx) => {
                                                    const total = (d.ontime || 0) + (d.late || 0);
                                                    return (
                                                        <Table.Tr key={d.week}>
                                                            <Table.Td fw={700}>{d.week}</Table.Td>
                                                            <Table.Td ta="right"><Badge size="xs" color="green" variant="light">{d.ontime ?? 0}</Badge></Table.Td>
                                                            <Table.Td ta="right"><Badge size="xs" color="red" variant="light">{d.late ?? 0}</Badge></Table.Td>
                                                            <Table.Td ta="right" fw={700}>{total}</Table.Td>
                                                        </Table.Tr>
                                                    );
                                                })}
                                            </Table.Tbody>
                                        </Table>
                                    ) : (
                                        <Box py="xl" ta="center"><Loader size="sm" /></Box>
                                    )}
                                </Box>
                            </Paper>

                            {/* OTIF table */}
                            <Paper withBorder p="md" style={{ borderRadius: 12, background: '#fff', boxShadow: cardShadow }}>
                                <Text fw={800} size="sm" mb="xs">OTIF INBOUND CP3</Text>
                                <Text size="xs" c="dimmed" mb="sm">% OTIF vs NOT OTIF per minggu — 1 tahun</Text>
                                <Box style={{ overflowX: 'auto', maxHeight: 400 }}>
                                    {oftiData?.weekly?.length > 0 ? (
                                        <Table withTableBorder withColumnBorders style={{ fontSize: 11, minWidth: 400 }}>
                                            <Table.Thead style={{ background: tableHeaderGradient }}>
                                                <Table.Tr>
                                                    {['Minggu','OTIF %','NOT OTIF %','OTIF','NOT OTIF'].map(h => (
                                                        <Table.Th key={h} ta={h !== 'Minggu' ? 'right' : undefined} style={{ color: '#e9ecef', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                                                            {h}
                                                        </Table.Th>
                                                    ))}
                                                </Table.Tr>
                                            </Table.Thead>
                                            <Table.Tbody>
                                                {oftiData.weekly.map((d, idx) => {
                                                    const total = (d.ontime || 0) + (d.late || 0);
                                                    const otifPct = total > 0 ? Math.round((d.otif || d.ontime || 0) / total * 100) : 0;
                                                    return (
                                                        <Table.Tr key={d.week}>
                                                            <Table.Td fw={700}>{d.week}</Table.Td>
                                                            <Table.Td ta="right"><Badge size="xs" color={otifPct >= 80 ? 'green' : otifPct >= 60 ? 'yellow' : 'red'} variant="filled">{otifPct}%</Badge></Table.Td>
                                                            <Table.Td ta="right"><Text size="xs" c="dimmed">{100 - otifPct}%</Text></Table.Td>
                                                            <Table.Td ta="right" fw={600}>{d.otif || d.ontime || 0}</Table.Td>
                                                            <Table.Td ta="right">{d.notOtif || d.late || 0}</Table.Td>
                                                        </Table.Tr>
                                                    );
                                                })}
                                            </Table.Tbody>
                                        </Table>
                                    ) : (
                                        <Box py="xl" ta="center"><Loader size="sm" /></Box>
                                    )}
                                </Box>
                            </Paper>
                        </>
                    )}

                    {/* ── SERAPAN tab ── */}
                    {activeTab === 'serapan' && (
                        <>
                            <Paper withBorder p="md" style={{ borderRadius: 12, background: '#fff', boxShadow: cardShadow }}>
                                <Text fw={800} size="sm" mb="xs">Serapan Ayam</Text>
                                <Text size="xs" c="dimmed" mb="sm">Planning vs Serapan per minggu — 1 tahun</Text>
                                <Box style={{ overflowX: 'auto', maxHeight: 400 }}>
                                    {serapanData?.data?.length > 0 ? (
                                        <Table withTableBorder withColumnBorders style={{ fontSize: 11, minWidth: 420 }}>
                                            <Table.Thead style={{ background: tableHeaderGradient }}>
                                                <Table.Tr>
                                                    {['Minggu','Planning','Serapan','Selisih','% Serapan'].map(h => (
                                                        <Table.Th key={h} ta={h !== 'Minggu' ? 'right' : undefined} style={{ color: '#e9ecef', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                                                            {h}
                                                        </Table.Th>
                                                    ))}
                                                </Table.Tr>
                                            </Table.Thead>
                                            <Table.Tbody>
                                                {serapanData.data.map((d, idx) => {
                                                    const pct = d.planning > 0 ? Math.round((d.serapan / d.planning) * 100) : 0;
                                                    const selisih = (d.serapan || 0) - (d.planning || 0);
                                                    return (
                                                        <Table.Tr key={d.week}>
                                                            <Table.Td fw={700}>{d.week}</Table.Td>
                                                            <Table.Td ta="right" fw={700}>{(d.planning || 0).toLocaleString()}</Table.Td>
                                                            <Table.Td ta="right"><Badge size="xs" color="grape" variant="light">{(d.serapan || 0).toLocaleString()}</Badge></Table.Td>
                                                            <Table.Td ta="right">
                                                                <Text size="xs" fw={700} c={selisih >= 0 ? 'green' : 'red'}>
                                                                    {selisih >= 0 ? '+' : ''}{selisih.toLocaleString()}
                                                                </Text>
                                                            </Table.Td>
                                                            <Table.Td ta="right">
                                                                <Badge size="xs" color={pct >= 90 ? 'green' : pct >= 70 ? 'yellow' : 'red'} variant="filled">{pct}%</Badge>
                                                            </Table.Td>
                                                        </Table.Tr>
                                                    );
                                                })}
                                            </Table.Tbody>
                                        </Table>
                                    ) : (
                                        <Box py="xl" ta="center"><Loader size="sm" /></Box>
                                    )}
                                </Box>
                            </Paper>
                        </>
                    )}

                    {/* ── REPORT tab ── */}
                    {activeTab === 'report' && (
                        <>
                            <Paper withBorder p="md" style={{ borderRadius: 12, background: '#fff', boxShadow: cardShadow }}>
                                <Text fw={800} size="sm" mb="xs">Inbound vs Outbound (1 Tahun)</Text>
                                <Text size="xs" c="dimmed" mb="sm">Data mingguan</Text>
                                <Box style={{ overflowX: 'auto', maxHeight: 400 }}>
                                    {reportData?.length > 0 ? (
                                        <Table withTableBorder withColumnBorders style={{ fontSize: 11, minWidth: 380 }}>
                                            <Table.Thead style={{ background: tableHeaderGradient }}>
                                                <Table.Tr>
                                                    {['Minggu','Inbound','Outbound','Net','Ratio'].map(h => (
                                                        <Table.Th key={h} ta={h !== 'Minggu' ? 'right' : undefined} style={{ color: '#e9ecef', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                                                            {h}
                                                        </Table.Th>
                                                    ))}
                                                </Table.Tr>
                                            </Table.Thead>
                                            <Table.Tbody>
                                                {reportData.map((d, idx) => {
                                                    const net = (d.inbound || 0) - (d.outbound || 0);
                                                    const total = (d.inbound || 0) + (d.outbound || 0);
                                                    const ratio = total > 0 ? Math.round(((d.inbound || 0) / total) * 100) : 50;
                                                    return (
                                                        <Table.Tr key={d.week}>
                                                            <Table.Td fw={700}>{d.week}</Table.Td>
                                                            <Table.Td ta="right"><Badge size="xs" color="green" variant="light">{(d.inbound || 0).toLocaleString()}</Badge></Table.Td>
                                                            <Table.Td ta="right"><Badge size="xs" color="red" variant="light">{(d.outbound || 0).toLocaleString()}</Badge></Table.Td>
                                                            <Table.Td ta="right">
                                                                <Text size="xs" fw={700} c={net >= 0 ? 'green' : 'red'}>
                                                                    {net >= 0 ? '+' : ''}{net.toLocaleString()}
                                                                </Text>
                                                            </Table.Td>
                                                            <Table.Td ta="right">
                                                                <Box style={{ display: 'flex', gap: 4, alignItems: 'center', justifyContent: 'flex-end' }}>
                                                                    <Box style={{ width: 60, height: 8, background: '#f1f3f5', borderRadius: 4, overflow: 'hidden' }}>
                                                                        <Box style={{ width: `${ratio}%`, height: '100%', background: '#40c057', borderRadius: 4 }} />
                                                                    </Box>
                                                                    <Text size="xs" c="dimmed">{ratio}%</Text>
                                                                </Box>
                                                            </Table.Td>
                                                        </Table.Tr>
                                                    );
                                                })}
                                            </Table.Tbody>
                                        </Table>
                                    ) : (
                                        <Box py="xl" ta="center"><Loader size="sm" /></Box>
                                    )}
                                </Box>
                            </Paper>
                        </>
                    )}

                    {/* ════ MUTASI TABLE — always shown ════ */}
                    <Paper withBorder p="md" style={{ borderRadius: 12, background: '#fff', boxShadow: cardShadow }}>
                        <Group justify="space-between" mb="sm">
                            <Box>
                                <Text fw={800} size="sm">Mutasi Terbaru</Text>
                                <Text size="xs" c="dimmed">{filteredLogs.length} transaksi • menampilkan 15 terbaru</Text>
                            </Box>
                            <Group gap={4} wrap="nowrap">
                                <TextInput
                                    placeholder="Cari PO, Item..." size="xs"
                                    leftSection={<IconSearch size={12} />}
                                    value={tableSearch} onChange={(e) => setTableSearch(e.target.value)}
                                    style={{ width: 150 }}
                                    rightSection={tableSearch && (
                                        <Box style={{ cursor: 'pointer' }} onClick={() => setTableSearch('')}>
                                            <IconX size={12} color="#868e96" />
                                        </Box>
                                    )}
                                />
                                <Button size="xs" variant={showExportFilter ? 'filled' : 'light'} color="gray"
                                    leftSection={<IconFilter size={12} />}
                                    onClick={() => setShowExportFilter(!showExportFilter)}>
                                    Filter
                                </Button>
                                <Button size="xs" variant="light" color="blue"
                                    leftSection={<IconDownload size={12} />}
                                    onClick={handleExportCSV}>
                                    CSV
                                </Button>
                            </Group>
                        </Group>

                        {/* Date filter */}
                        {showExportFilter && (
                            <Box style={{ background: '#f8f9fa', borderRadius: 8, padding: '8px 12px', marginBottom: 8 }}>
                                <Group gap={8} wrap="wrap" align="flex-end">
                                    <Box>
                                        <Text size="9px" c="dimmed" fw={600} mb={2}>DARI</Text>
                                        <input type="date"
                                            value={exportFrom ? exportFrom.toISOString().split('T')[0] : ''}
                                            onChange={(e) => setExportFrom(e.target.value ? new Date(e.target.value) : null)}
                                            style={{ padding: '4px 8px', border: '1px solid #dee2e6', borderRadius: 6, fontSize: 12, background: '#fff' }}
                                        />
                                    </Box>
                                    <Box>
                                        <Text size="9px" c="dimmed" fw={600} mb={2}>SAMPAI</Text>
                                        <input type="date"
                                            value={exportTo ? exportTo.toISOString().split('T')[0] : ''}
                                            onChange={(e) => setExportTo(e.target.value ? new Date(e.target.value) : null)}
                                            style={{ padding: '4px 8px', border: '1px solid #dee2e6', borderRadius: 6, fontSize: 12, background: '#fff' }}
                                        />
                                    </Box>
                                    <Button size="xs" variant="subtle" color="red"
                                        onClick={() => { setExportFrom(null); setExportTo(null); }}>
                                        Reset
                                    </Button>
                                </Group>
                            </Box>
                        )}

                        {/* Table */}
                        <Box style={{ overflowX: 'auto' }}>
                            <Table withTableBorder withColumnBorders style={{ fontSize: 11, minWidth: 900 }}>
                                <Table.Thead style={{ background: tableHeaderGradient, position: 'sticky', top: 0, zIndex: 1 }}>
                                    <Table.Tr>
                                        {['Tipe','No PO/Ref','Item','Qty','Satuan','Batch','Expired','Rak','Tanggal','Supplier/Tujuan','Ket'].map(h => (
                                            <Table.Th key={h} style={{ color: '#e9ecef', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                                                {h}
                                            </Table.Th>
                                        ))}
                                    </Table.Tr>
                                </Table.Thead>
                                <Table.Tbody>
                                    {filteredLogs.slice(0, 15).map((log, idx) => {
                                        const typeColor = log.type === 'INBOUND' ? 'green' : log.type === 'OUTBOUND' ? 'red' : 'blue';
                                        const isExpired = log.expiry_date && new Date(log.expiry_date) < new Date();
                                        return (
                                            <Table.Tr key={log.id}>
                                                <Table.Td>
                                                    <Badge size="xs" color={typeColor} variant="filled">{log.type}</Badge>
                                                </Table.Td>
                                                <Table.Td fw={700} style={{ whiteSpace: 'nowrap' }}>{log.no_po || log.no_ref || '—'}</Table.Td>
                                                <Table.Td fw={600}>{log.barang?.nama || '—'}</Table.Td>
                                                <Table.Td ta="right" fw={700}>{log.qty?.toLocaleString()}</Table.Td>
                                                <Table.Td><Text size="xs" c="dimmed">{log.satuan || '—'}</Text></Table.Td>
                                                <Table.Td><Badge size="xs" color="indigo" variant="light">{log.batch_no || '—'}</Badge></Table.Td>
                                                <Table.Td>
                                                    {log.expiry_date
                                                        ? <Badge size="xs" color={isExpired ? 'red' : 'teal'} variant={isExpired ? 'filled' : 'light'}>
                                                            {new Date(log.expiry_date).toISOString().split('T')[0]}
                                                          </Badge>
                                                        : <Text size="xs" c="dimmed">—</Text>
                                                    }
                                                </Table.Td>
                                                <Table.Td>
                                                    <Group gap={3} wrap="nowrap">
                                                        <Badge size="xs" color="gray" variant="outline">{log.gudang?.name || '—'}</Badge>
                                                        {log.gudang_tujuan && <Text size="xs">→</Text>}
                                                        {log.gudang_tujuan && <Badge size="xs" color="teal">{log.gudang_tujuan.name}</Badge>}
                                                    </Group>
                                                </Table.Td>
                                                <Table.Td style={{ whiteSpace: 'nowrap' }}>
                                                    <Text size="xs" c="dimmed">{log.tanggal_income || fmt(log.created_at)}</Text>
                                                </Table.Td>
                                                <Table.Td><Text size="xs">{log.supplier || log.tujuan || '—'}</Text></Table.Td>
                                                <Table.Td><Text size="xs" c="dimmed">{log.note || '—'}</Text></Table.Td>
                                            </Table.Tr>
                                        );
                                    })}
                                    {filteredLogs.length === 0 && (
                                        <Table.Tr>
                                            <Table.Td colSpan={11} style={{ textAlign: 'center', padding: 28 }}>
                                                <Stack align="center" gap={4}>
                                                    <IconSearch size={24} color="#ced4da" />
                                                    <Text size="xs" c="dimmed">Tidak ada data mutasi ditemukan.</Text>
                                                </Stack>
                                            </Table.Td>
                                        </Table.Tr>
                                    )}
                                </Table.Tbody>
                            </Table>
                        </Box>

                        {filteredLogs.length > 15 && (
                            <Box mt={6} style={{ background: '#f8f9fa', borderRadius: 6, padding: '5px 10px' }}>
                                <Text size="xs" c="dimmed" ta="center">
                                    Menampilkan <strong>15</strong> dari <strong>{filteredLogs.length}</strong> transaksi. Gunakan <strong>Export CSV</strong> untuk data lengkap.
                                </Text>
                            </Box>
                        )}
                    </Paper>

                </Stack>
            </Box>
        </Box>
    );
}
