'use client';
// @ts-nocheck
import React, { useState, useEffect, useMemo } from 'react';
import {
    Box, Group, Paper, Stack, Text, Title, Badge, Button, Loader, TextInput
} from '@mantine/core';
import {
    IconPackage, IconTrendingUp, IconTrendingDown, IconRefresh, IconCalendarStats,
    IconBuildingWarehouse, IconAlertTriangle, IconChartBar, IconChartLine,
    IconChartPie, IconTruckDelivery, IconMeat, IconDownload, IconDatabase,
    IconArrowUpRight, IconArrowDownRight, IconSearch, IconFilter, IconX
} from '@tabler/icons-react';
import { api, unwrap, fmt } from '../lib/api';

/* ─────────────────────────── constants ─────────────────────────── */
const TABS = [
    { key: 'occupancy', label: 'OCCUPANCY',     icon: IconChartPie,     accent: '#228be6', bg: '#e7f5ff' },
    { key: 'ofti',      label: 'OFTI',          icon: IconTruckDelivery,accent: '#2b8a3e', bg: '#d3f9d8' },
    { key: 'serapan',   label: 'Serapan Ayam',  icon: IconMeat,         accent: '#be4bdb', bg: '#f3d9fa' },
    { key: 'report',    label: 'Report',        icon: IconChartBar,     accent: '#e67700', bg: '#fff3bf' },
];

const cardShadow  = '0 2px 12px rgba(0,0,0,0.07)';
const sectionShadow = '0 2px 8px rgba(0,0,0,0.05)';

/* ─────────────────────────── KPI card ─────────────────────────── */
const KpiCard = ({ label, value, sub, icon: Icon, accent, bg, trend }) => (
    <Paper withBorder p="xs" style={{
        borderRadius: 10, background: '#fff', boxShadow: sectionShadow,
        borderLeft: `3px solid ${accent}`, flex: '1 1 0', minWidth: 130
    }}>
        <Group gap={6} wrap="nowrap" align="flex-start">
            <Box style={{ background: bg, borderRadius: 7, padding: 6, flexShrink: 0 }}>
                <Icon size={16} color={accent} />
            </Box>
            <Box style={{ minWidth: 0 }}>
                <Text size="9px" c="dimmed" fw={600} tt="uppercase" style={{ letterSpacing: '0.05em', lineHeight: 1.2, whiteSpace: 'nowrap' }}>{label}</Text>
                <Text size="lg" fw={900} style={{ color: '#1a1a2e', lineHeight: 1.1 }}>{value ?? '—'}</Text>
                {sub && <Text size="9px" c="dimmed" style={{ lineHeight: 1.2 }}>{sub}</Text>}
            </Box>
            {trend !== undefined && (
                <Box style={{ marginLeft: 'auto', flexShrink: 0 }}>
                    {trend >= 0
                        ? <IconArrowUpRight size={14} color="#40c057" />
                        : <IconArrowDownRight size={14} color="#e03131" />
                    }
                </Box>
            )}
        </Group>
    </Paper>
);

/* ─────────────────────────── Occupancy Gauge ─────────────────────────── */
const OccupancyGauge = ({ pct, label, subLabel, color, onClick, selected }) => {
    const size = 90; const cx = size / 2; const cy = size / 2; const r = 36;
    const waveHeight = 4;
    const fillY = cy + r - (pct / 100) * (r * 2);

    const wavePath = () => {
        const startX = cx - r; const endX = cx + r;
        const width = endX - startX; const segments = 4; const segW = width / segments;
        let d = `M ${startX} ${fillY}`;
        for (let i = 0; i < segments; i++) {
            const x1 = startX + i * segW; const x2 = x1 + segW / 2; const x3 = x1 + segW;
            const dir = i % 2 === 0 ? 1 : -1;
            d += ` Q ${x2} ${fillY + dir * waveHeight}, ${x3} ${fillY}`;
        }
        d += ` L ${endX} ${cy + r} L ${startX} ${cy + r} Z`;
        return d;
    };

    const statusColor = pct > 90 ? '#e03131' : pct > 75 ? '#f59f00' : pct > 50 ? '#228be6' : '#40c057';
    const clipId = `cc-${label.replace(/\s+/g, '-')}`;
    const gradId = `lg-${label.replace(/\s+/g, '-')}`;

    return (
        <Paper withBorder p="xs" style={{
            borderRadius: 10,
            background: selected ? '#f0f7ff' : '#fff',
            boxShadow: selected ? `0 0 0 2px ${color}, ${sectionShadow}` : sectionShadow,
            textAlign: 'center', cursor: 'pointer',
            transition: 'all 0.2s ease',
            borderColor: selected ? color : undefined,
        }} onClick={onClick}>
            <svg width={size} height={size} style={{ margin: '0 auto', display: 'block' }}>
                <defs>
                    <clipPath id={clipId}><circle cx={cx} cy={cy} r={r} /></clipPath>
                    <linearGradient id={gradId} x1="0%" y1="0%" x2="0%" y2="100%">
                        <stop offset="0%" stopColor={color} stopOpacity={0.9} />
                        <stop offset="100%" stopColor={color} stopOpacity={0.45} />
                    </linearGradient>
                </defs>
                <circle cx={cx} cy={cy} r={r} fill="#f1f3f5" stroke="#dee2e6" strokeWidth={1.5} />
                <g clipPath={`url(#${clipId})`}>
                    <rect x={cx - r} y={fillY} width={r * 2} height={cy + r - fillY} fill={`url(#${gradId})`} />
                    <path d={wavePath()} fill={color} opacity={0.25} />
                </g>
                <circle cx={cx} cy={cy} r={r} fill="none" stroke={color} strokeWidth={2} opacity={0.5} />
                <text x={cx} y={cy + 1} textAnchor="middle" fontSize={16} fontWeight={800} fill={statusColor}>{pct}%</text>
                <text x={cx} y={cy + 13} textAnchor="middle" fontSize={7.5} fill="#868e96" fontWeight={600}>{label}</text>
            </svg>
            <Text size="8px" c="dimmed" truncate mt={2} px={2}>{subLabel}</Text>
        </Paper>
    );
};

/* ─────────────────────────── Section Header ─────────────────────────── */
const SectionHeader = ({ icon: Icon, accent, bg, title, sub, right }) => (
    <Group justify="space-between" mb={8} wrap="nowrap">
        <Group gap={8} wrap="nowrap">
            <Box style={{ background: bg, borderRadius: 7, padding: 5, flexShrink: 0 }}>
                <Icon size={16} color={accent} />
            </Box>
            <Box>
                <Text size="sm" fw={800} style={{ color: '#1a1a2e', lineHeight: 1.2 }}>{title}</Text>
                {sub && <Text size="9px" c="dimmed" style={{ lineHeight: 1.2 }}>{sub}</Text>}
            </Box>
        </Group>
        {right}
    </Group>
);

/* ─────────────────────────── Table Header ─────────────────────────── */
const TH = ({ children, right = false, style = {} }) => (
    <Box component="th" style={{
        color: '#e9ecef', fontSize: 10, fontWeight: 700, padding: '7px 10px',
        textAlign: right ? 'right' : 'left', letterSpacing: '0.04em',
        textTransform: 'uppercase', whiteSpace: 'nowrap', ...style
    }}>{children}</Box>
);

/* ─────────────────────────── Table Cell ─────────────────────────── */
const TD = ({ children, right = false, style = {} }) => (
    <Box component="td" style={{
        padding: '6px 10px', fontSize: 11, textAlign: right ? 'right' : 'left',
        verticalAlign: 'middle', ...style
    }}>{children}</Box>
);

/* ─────────────────────────── Bar Charts ─────────────────────────── */
const SimpleBarChart = ({ series, labels }) => {
    if (!series?.length) return <Text size="xs" c="dimmed" ta="center" py="md">Tidak ada data.</Text>;
    const labelWidth = 50;
    const width = Math.max(760, labels.length * labelWidth);
    const height = 240;
    const pad = { top: 28, right: 28, bottom: 48, left: 55 };
    const chartW = width - pad.left - pad.right;
    const chartH = height - pad.top - pad.bottom;
    const maxVal = Math.max(...series.flatMap((s) => s.data), 1);
    const groupW = chartW / labels.length;
    const barW = Math.min(26, (groupW - 20) / series.length);

    return (
        <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{ overflow: 'visible' }}>
            {[0, 0.25, 0.5, 0.75, 1].map((p, i) => {
                const y = pad.top + chartH * p;
                const val = Math.round(maxVal * (1 - p));
                return (
                    <g key={i}>
                        <line x1={pad.left} y1={y} x2={width - pad.right} y2={y} stroke="#e9ecef" strokeDasharray="3,3" />
                        <text x={pad.left - 6} y={y + 4} textAnchor="end" fontSize={9} fill="#868e96">{val >= 1000 ? `${(val/1000).toFixed(0)}k` : val}</text>
                    </g>
                );
            })}
            {labels.map((l, wIdx) => (
                <g key={l.key}>
                    {series.map((s, sIdx) => {
                        const val = s.data[wIdx] || 0;
                        const h = (val / maxVal) * chartH;
                        const x = pad.left + wIdx * groupW + (groupW - series.length * barW) / 2 + sIdx * barW;
                        const y = pad.top + chartH - h;
                        return (
                            <g key={s.label}>
                                <rect x={x} y={y} width={barW - 1} height={h} rx={3} fill={s.color} opacity={0.88} />
                                {h > 18 && <text x={x + barW / 2 - 0.5} y={y + h / 2 + 4} textAnchor="middle" fontSize={8} fill="#fff" fontWeight={700}>{val >= 1000 ? `${Math.round(val/1000)}k` : val}</text>}
                            </g>
                        );
                    })}
                    <text x={pad.left + wIdx * groupW + groupW / 2} y={height - 30} textAnchor="middle" fontSize={10} fill="#495057" fontWeight={700}>{l.label}</text>
                </g>
            ))}
            <g transform={`translate(${width - pad.right + 8}, ${pad.top})`}>
                {series.map((s, i) => (
                    <g key={s.label} transform={`translate(0, ${i * 20})`}>
                        <rect x={0} y={0} width={10} height={10} rx={2} fill={s.color} />
                        <text x={14} y={9} fontSize={9} fill="#495057">{s.label}</text>
                    </g>
                ))}
            </g>
        </svg>
    );
};

const HorizontalBarChart = ({ data, leftKey, rightKey, leftColor, rightColor }) => {
    if (!data?.length) return <Text size="xs" c="dimmed" ta="center" py="md">Tidak ada data.</Text>;
    const width = 760; const height = 28 + data.length * 26;
    const pad = { top: 18, right: 28, bottom: 18, left: 58 };
    const chartW = width - pad.left - pad.right;

    return (
        <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} style={{ overflow: 'visible' }}>
            <line x1={pad.left + chartW / 2} y1={pad.top} x2={pad.left + chartW / 2} y2={height - pad.bottom} stroke="#dee2e6" strokeDasharray="3,3" />
            {data.map((d, i) => {
                const y = pad.top + i * 26;
                const total = (d[leftKey] || 0) + (d[rightKey] || 0);
                const leftW  = total > 0 ? (d[leftKey]  / total) * (chartW / 2 - 8) : 0;
                const rightW = total > 0 ? (d[rightKey] / total) * (chartW / 2 - 8) : 0;
                const leftPct  = total > 0 ? Math.round((d[leftKey]  / total) * 100) : 0;
                const rightPct = total > 0 ? Math.round((d[rightKey] / total) * 100) : 0;
                return (
                    <g key={i}>
                        <text x={pad.left - 6} y={y + 14} textAnchor="end" fontSize={10} fill="#495057" fontWeight={700}>{d.week}</text>
                        <rect x={pad.left + chartW / 2 - leftW - 4}  y={y + 4} width={leftW}  height={18} rx={3} fill={leftColor} opacity={0.85} />
                        <rect x={pad.left + chartW / 2 + 4} y={y + 4} width={rightW} height={18} rx={3} fill={rightColor} opacity={0.85} />
                        {leftPct  > 0 && <text x={pad.left + chartW / 2 - 8}  y={y + 16} textAnchor="end" fontSize={9} fill="#fff" fontWeight={700}>{leftPct}%</text>}
                        {rightPct > 0 && <text x={pad.left + chartW / 2 + 8}  y={y + 16} fontSize={9} fill="#fff" fontWeight={700}>{rightPct}%</text>}
                    </g>
                );
            })}
        </svg>
    );
};

const ReportChart = ({ data }) => {
    if (!data?.length) return <Text size="xs" c="dimmed" ta="center" py="md">Tidak ada data.</Text>;
    const labelWidth = 56;
    const width = Math.max(760, data.length * labelWidth);
    const height = 220;
    const pad = { top: 28, right: 28, bottom: 46, left: 55 };
    const chartW = width - pad.left - pad.right; const chartH = height - pad.top - pad.bottom;
    const maxVal = Math.max(...data.flatMap((d) => [d.inbound || 0, d.outbound || 0]), 1);
    const groupW = chartW / data.length; const barW = Math.min(22, (groupW - 12) / 2);

    return (
        <Box style={{ overflowX: 'auto', maxWidth: '100%' }}>
            <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{ overflow: 'visible' }}>
                {[0, 0.25, 0.5, 0.75, 1].map((p, i) => {
                    const y = pad.top + chartH * p; const val = Math.round(maxVal * (1 - p));
                    return (
                        <g key={i}>
                            <line x1={pad.left} y1={y} x2={width - pad.right} y2={y} stroke="#e9ecef" strokeDasharray="3,3" />
                            <text x={pad.left - 6} y={y + 4} textAnchor="end" fontSize={9} fill="#868e96">{val >= 1000 ? `${(val/1000).toFixed(1)}k` : val}</text>
                        </g>
                    );
                })}
                {data.map((d, wIdx) => {
                    const inH = ((d.inbound || 0) / maxVal) * chartH; const outH = ((d.outbound || 0) / maxVal) * chartH;
                    const x = pad.left + wIdx * groupW + (groupW - barW * 2 - 4) / 2;
                    return (
                        <g key={wIdx}>
                            <rect x={x}           y={pad.top + chartH - inH}  width={barW} height={inH}  rx={3} fill="#40c057" opacity={0.88} />
                            <rect x={x + barW + 4} y={pad.top + chartH - outH} width={barW} height={outH} rx={3} fill="#e03131" opacity={0.88} />
                            <text x={pad.left + wIdx * groupW + groupW / 2} y={height - 28} textAnchor="middle" fontSize={9} fill="#495057" fontWeight={600}>{d.week?.slice(5) || `W${wIdx+1}`}</text>
                        </g>
                    );
                })}
                <g transform={`translate(${width - pad.right + 8}, ${pad.top})`}>
                    <g><rect x={0} y={0} width={10} height={10} rx={2} fill="#40c057" /><text x={14} y={9} fontSize={9} fill="#495057">Inbound</text></g>
                    <g transform="translate(0,18)"><rect x={0} y={0} width={10} height={10} rx={2} fill="#e03131" /><text x={14} y={9} fontSize={9} fill="#495057">Outbound</text></g>
                </g>
            </svg>
        </Box>
    );
};

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

    /* ── active tab meta ── */
    const tabMeta = TABS.find(t => t.key === activeTab);

    return (
        <Box style={{ background: '#f4f6fb', minHeight: '100vh' }}>

            {/* ════════ TOP HEADER STRIP ════════ */}
            <Box style={{
                background: 'linear-gradient(135deg, #0c1445 0%, #1a3a6b 60%, #0e4d91 100%)',
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

                {/* KPI cards row */}
                <Group gap={6} mb={10} wrap="nowrap" style={{ overflowX: 'auto', paddingBottom: 2 }}>
                    <KpiCard label="Total SKU"       value={s.totalSku?.toLocaleString() ?? s.skuCount?.toLocaleString()}
                        icon={IconPackage} accent="#228be6" bg="#e7f5ff" sub="aktif di gudang" />
                    <KpiCard label="Total Stock"     value={s.totalStock ? `${Number(s.totalStock).toLocaleString()} kg` : '—'}
                        icon={IconDatabase} accent="#40c057" bg="#d3f9d8" sub="keseluruhan gudang" />
                    <KpiCard label="Inbound Hari Ini" value={s.todayInbound?.toLocaleString() ?? '0'}
                        icon={IconTrendingUp} accent="#0ca678" bg="#c3fae8" sub="transaksi masuk" />
                    <KpiCard label="Outbound Hari Ini" value={s.todayOutbound?.toLocaleString() ?? '0'}
                        icon={IconTrendingDown} accent="#e03131" bg="#ffe3e3" sub="transaksi keluar" />
                    <KpiCard label="Expired" value={s.expiredCount ?? 0}
                        icon={IconAlertTriangle} accent="#e03131" bg="#ffe3e3" sub="item expired" />
                    <KpiCard label="Near Expired" value={s.nearExpiredCount ?? 0}
                        icon={IconCalendarStats} accent="#f59f00" bg="#fff3bf" sub="≤ 7 hari" />
                </Group>

                {/* Tab nav */}
                <Group gap={0} wrap="nowrap" style={{ overflowX: 'auto' }}>
                    {TABS.map((tab) => {
                        const Icon = tab.icon;
                        const active = activeTab === tab.key;
                        return (
                            <Button key={tab.key} size="xs" variant="unstyled"
                                leftSection={<Icon size={13} />}
                                onClick={() => setActiveTab(tab.key)}
                                style={{
                                    height: 34, borderRadius: '8px 8px 0 0',
                                    padding: '0 14px', fontWeight: 700, fontSize: 11,
                                    letterSpacing: '0.04em',
                                    color: active ? tab.accent : 'rgba(255,255,255,0.65)',
                                    background: active ? '#fff' : 'transparent',
                                    borderBottom: active ? 'none' : 'none',
                                    boxShadow: active ? '0 -2px 0 0 inset ' + tab.accent : 'none',
                                    transition: 'all 0.18s',
                                    flexShrink: 0,
                                    borderTop: active ? `2px solid ${tab.accent}` : '2px solid transparent',
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
                            {/* Gauges */}
                            <Paper withBorder p="sm" style={{ borderRadius: 12, background: '#fff', boxShadow: cardShadow }}>
                                <SectionHeader icon={IconChartPie} accent="#228be6" bg="#e7f5ff"
                                    title="Okupansi per Zone" sub="Klik zone untuk melihat detail item & trend harian" />
                                <Box style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                                    {occupancyData?.gauges?.map((g) => (
                                        <Box key={g.id} style={{ flex: '1 1 0', minWidth: 100, maxWidth: 150 }}>
                                            <OccupancyGauge
                                                pct={g.pct} label={g.name}
                                                subLabel={`${Math.round(g.used).toLocaleString()} / ${Math.round(g.capacity).toLocaleString()} kg`}
                                                color={g.color} selected={selectedZone === g.id}
                                                onClick={() => handleZoneClick(g.id)}
                                            />
                                        </Box>
                                    ))}
                                    {!occupancyData && (
                                        <Box py="xl" ta="center" style={{ width: '100%' }}><Loader size="sm" /></Box>
                                    )}
                                </Box>
                            </Paper>

                            {selectedZone ? (
                                <>
                                    {/* Daily trend chart */}
                                    <Paper withBorder p="sm" style={{ borderRadius: 12, background: '#fff', boxShadow: cardShadow }}>
                                        <SectionHeader icon={IconChartBar} accent="#f59f00" bg="#fff3bf"
                                            title={`Trend Harian — Zone ${selectedZone}`}
                                            sub="Scroll horizontal untuk data 1 tahun"
                                            right={
                                                <Badge size="sm" variant="light" color="yellow" style={{ cursor: 'pointer' }}
                                                    onClick={() => { setSelectedZone(null); loadOccupancy(); }}>
                                                    ✕ Kembali ke semua zone
                                                </Badge>
                                            }
                                        />
                                        <Box style={{ overflowX: 'auto', maxWidth: '100%' }}>
                                            <Box style={{ minWidth: (occupancyData?.dailySeries?.length || 0) * 30 || 400 }}>
                                                <SimpleBarChart
                                                    series={[{ label: 'Qty', color: occupancyData?.gauges?.find(g => g.id === selectedZone)?.color || '#228be6', data: occupancyData?.dailySeries?.map(d => d.value) || [] }]}
                                                    labels={occupancyData?.dailySeries?.map((d) => ({ key: d.date, label: d.date.slice(5) })) || []}
                                                />
                                            </Box>
                                        </Box>
                                    </Paper>

                                    {/* Items table for selected zone */}
                                    <Paper withBorder p="sm" style={{ borderRadius: 12, background: '#fff', boxShadow: cardShadow }}>
                                        <SectionHeader icon={IconBuildingWarehouse} accent="#228be6" bg="#e7f5ff"
                                            title={`Item di Zone ${selectedZone}`}
                                            sub={`${occupancyData?.items?.length || 0} item ditemukan`}
                                            right={
                                                <TextInput placeholder="Cari item..." size="xs"
                                                    leftSection={<IconSearch size={12} />}
                                                    value={tableSearch} onChange={(e) => setTableSearch(e.target.value)}
                                                    style={{ width: 180 }} />
                                            }
                                        />
                                        <Box style={{ overflowX: 'auto', borderRadius: 8, border: '1px solid #e9ecef' }}>
                                            <Box component="table" style={{ width: '100%', borderCollapse: 'collapse', minWidth: 620 }}>
                                                <Box component="thead" style={{ background: 'linear-gradient(90deg, #1c2742, #2d3f6b)' }}>
                                                    <Box component="tr">
                                                        {['Barang','Batch','Qty','Satuan','Expired','Rak'].map((h, i) => (
                                                            <TH key={h} right={h === 'Qty'}>{h}</TH>
                                                        ))}
                                                    </Box>
                                                </Box>
                                                <Box component="tbody">
                                                    {occupancyData?.items
                                                        ?.filter(item => !tableSearch || item.barang.toLowerCase().includes(tableSearch.toLowerCase()) || item.batch.toLowerCase().includes(tableSearch.toLowerCase()))
                                                        .map((item, idx) => (
                                                            <Box component="tr" key={item.id} style={{
                                                                borderBottom: '1px solid #f1f3f5',
                                                                background: idx % 2 === 0 ? '#fff' : '#f8f9fa',
                                                            }}>
                                                                <TD style={{ fontWeight: 700, color: '#1a1a2e' }}>{item.barang}</TD>
                                                                <TD><Badge size="xs" color="indigo" variant="light">{item.batch}</Badge></TD>
                                                                <TD right style={{ fontWeight: 700 }}>{item.qty.toLocaleString()}</TD>
                                                                <TD><Text size="10px" c="dimmed">{item.satuan}</Text></TD>
                                                                <TD>
                                                                    {item.expiry
                                                                        ? <Badge size="xs" color={new Date(item.expiry) < new Date() ? 'red' : 'teal'} variant="light">{item.expiry}</Badge>
                                                                        : <Text size="10px" c="dimmed">—</Text>
                                                                    }
                                                                </TD>
                                                                <TD><Badge size="xs" color="gray" variant="outline">{item.rack}</Badge></TD>
                                                            </Box>
                                                        ))
                                                    }
                                                    {(!occupancyData?.items || occupancyData.items.length === 0) && (
                                                        <Box component="tr">
                                                            <Box component="td" colSpan={6} style={{ padding: 20, textAlign: 'center' }}>
                                                                <Text size="xs" c="dimmed">Tidak ada item di zone ini.</Text>
                                                            </Box>
                                                        </Box>
                                                    )}
                                                </Box>
                                            </Box>
                                        </Box>
                                    </Paper>
                                </>
                            ) : (
                                <>
                                    {/* Zone bar chart */}
                                    <Paper withBorder p="sm" style={{ borderRadius: 12, background: '#fff', boxShadow: cardShadow }}>
                                        <SectionHeader icon={IconChartBar} accent="#f59f00" bg="#fff3bf"
                                            title="Okupansi per Zone (1 Tahun)" sub="Scroll horizontal untuk data mingguan" />
                                        <Box style={{ overflowX: 'auto', maxWidth: '100%' }}>
                                            <Box style={{ minWidth: (occupancyData?.weeks?.length || 0) * 60 || 400 }}>
                                                <SimpleBarChart series={occupancyData?.series} labels={occupancyData?.weeks} />
                                            </Box>
                                        </Box>
                                    </Paper>

                                    {/* Summary zone table */}
                                    <Paper withBorder p="sm" style={{ borderRadius: 12, background: '#fff', boxShadow: cardShadow }}>
                                        <SectionHeader icon={IconBuildingWarehouse} accent="#228be6" bg="#e7f5ff"
                                            title="Summary per Zone" sub="Klik baris untuk melihat detail zone"
                                            right={
                                                <TextInput placeholder="Cari zone..." size="xs"
                                                    leftSection={<IconSearch size={12} />}
                                                    value={tableSearch} onChange={(e) => setTableSearch(e.target.value)}
                                                    style={{ width: 160 }} />
                                            }
                                        />
                                        <Box style={{ overflowX: 'auto', borderRadius: 8, border: '1px solid #e9ecef' }}>
                                            <Box component="table" style={{ width: '100%', borderCollapse: 'collapse', minWidth: 580 }}>
                                                <Box component="thead" style={{ background: 'linear-gradient(90deg, #1c2742, #2d3f6b)' }}>
                                                    <Box component="tr">
                                                        {['Zone','Terpakai (kg)','Kapasitas (kg)','%','Status','Trend'].map((h) => (
                                                            <TH key={h} right={['Terpakai (kg)','Kapasitas (kg)'].includes(h)}>{h}</TH>
                                                        ))}
                                                    </Box>
                                                </Box>
                                                <Box component="tbody">
                                                    {occupancyData?.gauges
                                                        ?.filter(g => !tableSearch || g.name.toLowerCase().includes(tableSearch.toLowerCase()))
                                                        .map((g, idx) => {
                                                            const pctColor = g.pct > 90 ? 'red' : g.pct > 75 ? 'orange' : g.pct > 50 ? 'yellow' : 'green';
                                                            const statusLabel = g.pct > 90 ? '🔴 Penuh' : g.pct > 75 ? '🟠 Hampir Penuh' : g.pct > 50 ? '🟡 Sedang' : '🟢 Aman';
                                                            return (
                                                                <Box component="tr" key={g.id}
                                                                    style={{ borderBottom: '1px solid #f1f3f5', background: idx % 2 === 0 ? '#fff' : '#f8f9fa', cursor: 'pointer', transition: 'background 0.15s' }}
                                                                    onClick={() => handleZoneClick(g.id)}
                                                                >
                                                                    <TD style={{ fontWeight: 800, color: '#1a1a2e' }}>{g.name}</TD>
                                                                    <TD right style={{ fontWeight: 700 }}>{Math.round(g.used).toLocaleString()}</TD>
                                                                    <TD right>{Math.round(g.capacity).toLocaleString()}</TD>
                                                                    <TD>
                                                                        <Group gap={6} wrap="nowrap">
                                                                            <Box style={{ flex: 1, background: '#f1f3f5', borderRadius: 4, height: 8, minWidth: 60, maxWidth: 90, overflow: 'hidden' }}>
                                                                                <Box style={{ width: `${g.pct}%`, height: '100%', background: g.color, borderRadius: 4, transition: 'width 0.4s' }} />
                                                                            </Box>
                                                                            <Badge size="xs" color={pctColor} variant="filled" style={{ flexShrink: 0 }}>{g.pct}%</Badge>
                                                                        </Group>
                                                                    </TD>
                                                                    <TD><Text size="10px" fw={600}>{statusLabel}</Text></TD>
                                                                    <TD><Text size="10px" c="blue" style={{ textDecoration: 'underline' }}>Detail →</Text></TD>
                                                                </Box>
                                                            );
                                                        })
                                                    }
                                                    {!occupancyData && (
                                                        <Box component="tr"><Box component="td" colSpan={6} style={{ padding: 20, textAlign: 'center' }}><Loader size="sm" /></Box></Box>
                                                    )}
                                                </Box>
                                            </Box>
                                        </Box>
                                    </Paper>
                                </>
                            )}
                        </>
                    )}

                    {/* ── OFTI tab ── */}
                    {activeTab === 'ofti' && (
                        <>
                            <Paper withBorder p="sm" style={{ borderRadius: 12, background: '#fff', boxShadow: cardShadow }}>
                                <SectionHeader icon={IconTruckDelivery} accent="#2b8a3e" bg="#d3f9d8"
                                    title="Planning Inbound vs Actual Inbound"
                                    sub="On Time (hijau) vs Late (merah) — 1 tahun" />
                                <Box style={{ overflowX: 'auto', maxWidth: '100%' }}>
                                    <Box style={{ minWidth: (oftiData?.weekly?.length || 0) * 60 || 400 }}>
                                        <SimpleBarChart
                                            series={[
                                                { label: 'On Time', color: '#40c057', data: oftiData?.weekly?.map(d => d.ontime) || [] },
                                                { label: 'Late',    color: '#e03131', data: oftiData?.weekly?.map(d => d.late)   || [] },
                                            ]}
                                            labels={oftiData?.weekly?.map(d => ({ key: d.week, label: d.week })) || []}
                                        />
                                    </Box>
                                </Box>
                            </Paper>

                            <Paper withBorder p="sm" style={{ borderRadius: 12, background: '#fff', boxShadow: cardShadow }}>
                                <SectionHeader icon={IconChartLine} accent="#228be6" bg="#e7f5ff"
                                    title="OTIF INBOUND CP3"
                                    sub="% OTIF vs NOT OTIF per minggu — 1 tahun" />
                                <Box style={{ overflowX: 'auto', maxWidth: '100%' }}>
                                    <Box style={{ minWidth: (oftiData?.weekly?.length || 0) * 80 || 400 }}>
                                        <HorizontalBarChart data={oftiData?.weekly} leftKey="otif" rightKey="notOtif" leftColor="#228be6" rightColor="#e03131" />
                                    </Box>
                                </Box>
                            </Paper>

                            {/* OFTI summary table */}
                            {oftiData?.weekly?.length > 0 && (
                                <Paper withBorder p="sm" style={{ borderRadius: 12, background: '#fff', boxShadow: cardShadow }}>
                                    <SectionHeader icon={IconChartBar} accent="#2b8a3e" bg="#d3f9d8"
                                        title="Tabel OTIF per Minggu" sub={`${oftiData.weekly.length} minggu terakhir`} />
                                    <Box style={{ overflowX: 'auto', maxHeight: 320, borderRadius: 8, border: '1px solid #e9ecef' }}>
                                        <Box component="table" style={{ width: '100%', borderCollapse: 'collapse', minWidth: 480 }}>
                                            <Box component="thead" style={{ background: 'linear-gradient(90deg, #1c2742, #2d3f6b)', position: 'sticky', top: 0, zIndex: 1 }}>
                                                <Box component="tr">
                                                    {['Minggu','On Time','Late','Total','OTIF %','NOT OTIF %'].map(h => (
                                                        <TH key={h} right={['On Time','Late','Total','OTIF %','NOT OTIF %'].includes(h)}>{h}</TH>
                                                    ))}
                                                </Box>
                                            </Box>
                                            <Box component="tbody">
                                                {oftiData.weekly.map((d, idx) => {
                                                    const total = (d.ontime || 0) + (d.late || 0);
                                                    const otifPct = total > 0 ? Math.round((d.otif || d.ontime || 0) / total * 100) : 0;
                                                    return (
                                                        <Box component="tr" key={d.week} style={{ borderBottom: '1px solid #f1f3f5', background: idx % 2 === 0 ? '#fff' : '#f8f9fa' }}>
                                                            <TD style={{ fontWeight: 700 }}>{d.week}</TD>
                                                            <TD right><Badge size="xs" color="green" variant="light">{d.ontime ?? 0}</Badge></TD>
                                                            <TD right><Badge size="xs" color="red" variant="light">{d.late ?? 0}</Badge></TD>
                                                            <TD right style={{ fontWeight: 700 }}>{total}</TD>
                                                            <TD right><Badge size="xs" color={otifPct >= 80 ? 'green' : otifPct >= 60 ? 'yellow' : 'red'} variant="filled">{otifPct}%</Badge></TD>
                                                            <TD right><Text size="10px" c="dimmed">{100 - otifPct}%</Text></TD>
                                                        </Box>
                                                    );
                                                })}
                                            </Box>
                                        </Box>
                                    </Box>
                                </Paper>
                            )}
                        </>
                    )}

                    {/* ── SERAPAN tab ── */}
                    {activeTab === 'serapan' && (
                        <>
                            <Paper withBorder p="sm" style={{ borderRadius: 12, background: '#fff', boxShadow: cardShadow }}>
                                <SectionHeader icon={IconMeat} accent="#be4bdb" bg="#f3d9fa"
                                    title="Serapan Ayam" sub="Planning vs Serapan per minggu — 1 tahun" />
                                <Box style={{ overflowX: 'auto', maxWidth: '100%' }}>
                                    <Box style={{ minWidth: (serapanData?.data?.length || 0) * 60 || 400 }}>
                                        <SimpleBarChart
                                            series={[
                                                { label: 'Planning', color: '#4c6ef5', data: serapanData?.data?.map(d => d.planning) || [] },
                                                { label: 'Serapan',  color: '#be4bdb', data: serapanData?.data?.map(d => d.serapan)  || [] },
                                            ]}
                                            labels={serapanData?.data?.map(d => ({ key: d.week, label: d.week })) || []}
                                        />
                                    </Box>
                                </Box>
                            </Paper>

                            {serapanData?.data?.length > 0 && (
                                <Paper withBorder p="sm" style={{ borderRadius: 12, background: '#fff', boxShadow: cardShadow }}>
                                    <SectionHeader icon={IconChartBar} accent="#be4bdb" bg="#f3d9fa"
                                        title="Tabel Serapan per Minggu" sub={`${serapanData.data.length} minggu terakhir`} />
                                    <Box style={{ overflowX: 'auto', maxHeight: 320, borderRadius: 8, border: '1px solid #e9ecef' }}>
                                        <Box component="table" style={{ width: '100%', borderCollapse: 'collapse', minWidth: 420 }}>
                                            <Box component="thead" style={{ background: 'linear-gradient(90deg, #1c2742, #2d3f6b)', position: 'sticky', top: 0, zIndex: 1 }}>
                                                <Box component="tr">
                                                    {['Minggu','Planning','Serapan','Selisih','% Serapan'].map(h => (
                                                        <TH key={h} right={['Planning','Serapan','Selisih','% Serapan'].includes(h)}>{h}</TH>
                                                    ))}
                                                </Box>
                                            </Box>
                                            <Box component="tbody">
                                                {serapanData.data.map((d, idx) => {
                                                    const pct = d.planning > 0 ? Math.round((d.serapan / d.planning) * 100) : 0;
                                                    const selisih = (d.serapan || 0) - (d.planning || 0);
                                                    return (
                                                        <Box component="tr" key={d.week} style={{ borderBottom: '1px solid #f1f3f5', background: idx % 2 === 0 ? '#fff' : '#f8f9fa' }}>
                                                            <TD style={{ fontWeight: 700 }}>{d.week}</TD>
                                                            <TD right style={{ fontWeight: 700 }}>{(d.planning || 0).toLocaleString()}</TD>
                                                            <TD right><Badge size="xs" color="grape" variant="light">{(d.serapan || 0).toLocaleString()}</Badge></TD>
                                                            <TD right>
                                                                <Text size="10px" fw={700} c={selisih >= 0 ? 'green' : 'red'}>
                                                                    {selisih >= 0 ? '+' : ''}{selisih.toLocaleString()}
                                                                </Text>
                                                            </TD>
                                                            <TD right>
                                                                <Badge size="xs" color={pct >= 90 ? 'green' : pct >= 70 ? 'yellow' : 'red'} variant="filled">{pct}%</Badge>
                                                            </TD>
                                                        </Box>
                                                    );
                                                })}
                                            </Box>
                                        </Box>
                                    </Box>
                                </Paper>
                            )}
                        </>
                    )}

                    {/* ── REPORT tab ── */}
                    {activeTab === 'report' && (
                        <>
                            <Paper withBorder p="sm" style={{ borderRadius: 12, background: '#fff', boxShadow: cardShadow }}>
                                <SectionHeader icon={IconChartBar} accent="#e67700" bg="#fff3bf"
                                    title="Inbound vs Outbound (1 Tahun)" sub="Scroll horizontal untuk data mingguan" />
                                <ReportChart data={reportData} />
                            </Paper>

                            {reportData?.length > 0 && (
                                <Paper withBorder p="sm" style={{ borderRadius: 12, background: '#fff', boxShadow: cardShadow }}>
                                    <SectionHeader icon={IconDatabase} accent="#e67700" bg="#fff3bf"
                                        title="Tabel Inbound vs Outbound" sub={`${reportData.length} minggu terakhir`} />
                                    <Box style={{ overflowX: 'auto', maxHeight: 300, borderRadius: 8, border: '1px solid #e9ecef' }}>
                                        <Box component="table" style={{ width: '100%', borderCollapse: 'collapse', minWidth: 380 }}>
                                            <Box component="thead" style={{ background: 'linear-gradient(90deg, #1c2742, #2d3f6b)', position: 'sticky', top: 0, zIndex: 1 }}>
                                                <Box component="tr">
                                                    {['Minggu','Inbound','Outbound','Net','Ratio'].map(h => (
                                                        <TH key={h} right={['Inbound','Outbound','Net','Ratio'].includes(h)}>{h}</TH>
                                                    ))}
                                                </Box>
                                            </Box>
                                            <Box component="tbody">
                                                {reportData.map((d, idx) => {
                                                    const net = (d.inbound || 0) - (d.outbound || 0);
                                                    const total = (d.inbound || 0) + (d.outbound || 0);
                                                    const ratio = total > 0 ? Math.round(((d.inbound || 0) / total) * 100) : 50;
                                                    return (
                                                        <Box component="tr" key={d.week} style={{ borderBottom: '1px solid #f1f3f5', background: idx % 2 === 0 ? '#fff' : '#f8f9fa' }}>
                                                            <TD style={{ fontWeight: 700 }}>{d.week}</TD>
                                                            <TD right><Badge size="xs" color="green" variant="light">{(d.inbound || 0).toLocaleString()}</Badge></TD>
                                                            <TD right><Badge size="xs" color="red" variant="light">{(d.outbound || 0).toLocaleString()}</Badge></TD>
                                                            <TD right>
                                                                <Text size="10px" fw={700} c={net >= 0 ? 'green' : 'red'}>
                                                                    {net >= 0 ? '+' : ''}{net.toLocaleString()}
                                                                </Text>
                                                            </TD>
                                                            <TD right>
                                                                <Box style={{ display: 'flex', gap: 4, alignItems: 'center', justifyContent: 'flex-end' }}>
                                                                    <Box style={{ width: 60, height: 8, background: '#f1f3f5', borderRadius: 4, overflow: 'hidden' }}>
                                                                        <Box style={{ width: `${ratio}%`, height: '100%', background: '#40c057', borderRadius: 4 }} />
                                                                    </Box>
                                                                    <Text size="9px" c="dimmed">{ratio}%</Text>
                                                                </Box>
                                                            </TD>
                                                        </Box>
                                                    );
                                                })}
                                            </Box>
                                        </Box>
                                    </Box>
                                </Paper>
                            )}
                        </>
                    )}

                    {/* ════ MUTASI TABLE — always shown ════ */}
                    <Paper withBorder p="sm" style={{ borderRadius: 12, background: '#fff', boxShadow: cardShadow }}>
                        <SectionHeader
                            icon={IconTrendingUp} accent="#228be6" bg="#e7f5ff"
                            title="Mutasi Terbaru"
                            sub={`${filteredLogs.length} transaksi • menampilkan 15 terbaru`}
                            right={
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
                            }
                        />

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
                        <Box style={{ overflowX: 'auto', maxHeight: 380, borderRadius: 8, border: '1px solid #e9ecef' }}>
                            <Box component="table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11, minWidth: 900 }}>
                                <Box component="thead" style={{ background: 'linear-gradient(90deg, #1c2742, #2d3f6b)', position: 'sticky', top: 0, zIndex: 1 }}>
                                    <Box component="tr">
                                        {['Tipe','No PO/Ref','Item','Qty','Satuan','Batch','Expired','Rak','Tanggal','Supplier/Tujuan','Ket'].map((h, i) => (
                                            <TH key={h} right={h === 'Qty'}>{h}</TH>
                                        ))}
                                    </Box>
                                </Box>
                                <Box component="tbody">
                                    {filteredLogs.slice(0, 15).map((log, idx) => {
                                        const typeColor = log.type === 'INBOUND' ? 'green' : log.type === 'OUTBOUND' ? 'red' : 'blue';
                                        const isExpired = log.expiry_date && new Date(log.expiry_date) < new Date();
                                        return (
                                            <Box component="tr" key={log.id} style={{
                                                borderBottom: '1px solid #f1f3f5',
                                                background: idx % 2 === 0 ? '#fff' : '#f8f9fa',
                                                transition: 'background 0.12s'
                                            }}>
                                                <TD>
                                                    <Badge size="xs" color={typeColor} variant="filled" style={{ letterSpacing: '0.03em' }}>{log.type}</Badge>
                                                </TD>
                                                <TD style={{ fontWeight: 700, color: '#1a1a2e', whiteSpace: 'nowrap' }}>{log.no_po || log.no_ref || '—'}</TD>
                                                <TD style={{ fontWeight: 600, maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{log.barang?.nama || '—'}</TD>
                                                <TD right style={{ fontWeight: 700 }}>{log.qty?.toLocaleString()}</TD>
                                                <TD><Text size="10px" c="dimmed">{log.satuan || '—'}</Text></TD>
                                                <TD><Badge size="xs" color="indigo" variant="light">{log.batch_no || '—'}</Badge></TD>
                                                <TD>
                                                    {log.expiry_date
                                                        ? <Badge size="xs" color={isExpired ? 'red' : 'teal'} variant={isExpired ? 'filled' : 'light'}>
                                                            {new Date(log.expiry_date).toISOString().split('T')[0]}
                                                          </Badge>
                                                        : <Text size="10px" c="dimmed">—</Text>
                                                    }
                                                </TD>
                                                <TD>
                                                    <Group gap={3} wrap="nowrap">
                                                        <Badge size="xs" color="gray" variant="outline">{log.gudang?.name || '—'}</Badge>
                                                        {log.gudang_tujuan && <><Text size="9px">→</Text><Badge size="xs" color="teal">{log.gudang_tujuan.name}</Badge></>}
                                                    </Group>
                                                </TD>
                                                <TD style={{ whiteSpace: 'nowrap' }}>
                                                    <Text size="10px" c="dimmed">{log.tanggal_income || fmt(log.created_at)}</Text>
                                                </TD>
                                                <TD style={{ maxWidth: 130, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                    <Text size="10px">{log.supplier || log.tujuan || '—'}</Text>
                                                </TD>
                                                <TD style={{ maxWidth: 110, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                    <Text size="10px" c="dimmed">{log.note || '—'}</Text>
                                                </TD>
                                            </Box>
                                        );
                                    })}
                                    {filteredLogs.length === 0 && (
                                        <Box component="tr">
                                            <Box component="td" colSpan={11} style={{ padding: 28, textAlign: 'center' }}>
                                                <Stack align="center" gap={4}>
                                                    <IconSearch size={24} color="#ced4da" />
                                                    <Text size="xs" c="dimmed">Tidak ada data mutasi ditemukan.</Text>
                                                </Stack>
                                            </Box>
                                        </Box>
                                    )}
                                </Box>
                            </Box>
                        </Box>

                        {filteredLogs.length > 15 && (
                            <Box mt={6} style={{ background: '#f8f9fa', borderRadius: 6, padding: '5px 10px' }}>
                                <Text size="10px" c="dimmed" ta="center">
                                    ⚠️ Menampilkan <strong>15</strong> dari <strong>{filteredLogs.length}</strong> transaksi. Gunakan <strong>Export CSV</strong> untuk data lengkap.
                                </Text>
                            </Box>
                        )}
                    </Paper>

                </Stack>
            </Box>
        </Box>
    );
}
