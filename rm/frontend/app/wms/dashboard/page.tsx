'use client';
// @ts-nocheck
import React, { useState, useEffect, useMemo } from 'react';
import {
    Box, Group, Paper, Stack, Text, Title, Badge, Button, Loader, TextInput
} from '@mantine/core';
import {
    IconPackage, IconTrendingUp, IconTrendingDown, IconRefresh, IconCalendarStats,
    IconBuildingWarehouse, IconAlertTriangle, IconChartBar, IconChartLine,
    IconChartPie, IconTruckDelivery, IconMeat, IconDownload
} from '@tabler/icons-react';
import { api, unwrap, fmt } from '../lib/api';

const gradientBg = 'linear-gradient(135deg, #f8f9fa 0%, #e7f5ff 100%)';
const cardShadow = '0 4px 20px rgba(0,0,0,0.06)';

const TABS = [
    { key: 'occupancy', label: 'OCCUPANCY', icon: IconChartPie },
    { key: 'ofti', label: 'OFTI', icon: IconTruckDelivery },
    { key: 'serapan', label: 'Serapan Ayam', icon: IconMeat },
    { key: 'report', label: 'Report', icon: IconChartBar },
];

const OccupancyGauge = ({ pct, label, subLabel, color, onClick, selected }) => {
    const size = 100;
    const cx = size / 2;
    const cy = size / 2;
    const r = 40;
    const waveHeight = 5;
    const fillY = cy + r - (pct / 100) * (r * 2);

    const wavePath = () => {
        const startX = cx - r;
        const endX = cx + r;
        const width = endX - startX;
        const segments = 4;
        const segW = width / segments;
        let d = `M ${startX} ${fillY}`;
        for (let i = 0; i < segments; i++) {
            const x1 = startX + i * segW;
            const x2 = x1 + segW / 2;
            const x3 = x1 + segW;
            const dir = i % 2 === 0 ? 1 : -1;
            d += ` Q ${x2} ${fillY + dir * waveHeight}, ${x3} ${fillY}`;
        }
        d += ` L ${endX} ${cy + r} L ${startX} ${cy + r} Z`;
        return d;
    };

    return (
        <Paper
            withBorder
            p="xs"
            style={{
                borderRadius: 10,
                background: selected ? '#e7f5ff' : '#fff',
                boxShadow: selected ? '0 0 0 2px #228be6' : cardShadow,
                textAlign: 'center',
                cursor: 'pointer',
                transition: 'all 0.2s'
            }}
            onClick={onClick}
        >
            <svg width={size} height={size} style={{ margin: '0 auto', display: 'block' }}>
                <defs>
                    <clipPath id={`circle-clip-${label.replace(/\s+/g, '')}`}>
                        <circle cx={cx} cy={cy} r={r} />
                    </clipPath>
                    <linearGradient id={`liquid-grad-${label.replace(/\s+/g, '')}`} x1="0%" y1="0%" x2="0%" y2="100%">
                        <stop offset="0%" stopColor={color} stopOpacity={0.9} />
                        <stop offset="100%" stopColor={color} stopOpacity={0.5} />
                    </linearGradient>
                </defs>
                <circle cx={cx} cy={cy} r={r} fill="#f1f3f5" stroke="#dee2e6" strokeWidth={2} />
                <g clipPath={`url(#circle-clip-${label.replace(/\s+/g, '')})`}>
                    <rect x={cx - r} y={fillY} width={r * 2} height={cy + r - fillY} fill={`url(#liquid-grad-${label.replace(/\s+/g, '')})`} />
                    <path d={wavePath()} fill={color} opacity={0.3} />
                </g>
                <circle cx={cx} cy={cy} r={r} fill="none" stroke={color} strokeWidth={3} opacity={0.6} />
                <text x={cx} y={cy - 2} textAnchor="middle" fontSize={18} fontWeight={800} fill={color}>{pct}%</text>
                <text x={cx} y={cy + 12} textAnchor="middle" fontSize={8} fill="#868e96" fontWeight={600}>{label}</text>
            </svg>
            <Text size="9px" c="dimmed" truncate mt={2}>{subLabel}</Text>
        </Paper>
    );
};

const SimpleBarChart = ({ series, labels, title }) => {
    if (!series?.length) return <Text size="xs" c="dimmed" ta="center" py="md">Tidak ada data.</Text>;
    const labelWidth = 50;
    const width = Math.max(760, labels.length * labelWidth);
    const height = 260;
    const pad = { top: 30, right: 30, bottom: 50, left: 60 };
    const chartW = width - pad.left - pad.right;
    const chartH = height - pad.top - pad.bottom;
    const maxVal = Math.max(...series.flatMap((s) => s.data), 1);
    const groupW = chartW / labels.length;
    const barW = Math.min(28, (groupW - 24) / series.length);

    return (
        <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{ overflow: 'visible' }}>
            {[0, 0.25, 0.5, 0.75, 1].map((p, i) => {
                const y = pad.top + chartH * p;
                const val = Math.round(maxVal * (1 - p));
                return (
                    <g key={i}>
                        <line x1={pad.left} y1={y} x2={width - pad.right} y2={y} stroke="#e9ecef" strokeDasharray="3,3" />
                        <text x={pad.left - 8} y={y + 4} textAnchor="end" fontSize={10} fill="#868e96">{val.toLocaleString()}</text>
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
                                <rect x={x} y={y} width={barW} height={h} rx={4} fill={s.color} opacity={0.9} />
                                {h > 18 && <text x={x + barW / 2} y={y + h / 2 + 4} textAnchor="middle" fontSize={9} fill="#fff" fontWeight={700}>{val >= 100 ? `${Math.round(val / 1000)}k` : val}</text>}
                            </g>
                        );
                    })}
                    <text x={pad.left + wIdx * groupW + groupW / 2} y={height - 35} textAnchor="middle" fontSize={11} fill="#495057" fontWeight={700}>{l.label}</text>
                </g>
            ))}
            <g transform={`translate(${width - pad.right + 8}, ${pad.top})`}>
                {series.map((s, i) => (
                    <g key={s.label} transform={`translate(0, ${i * 22})`}>
                        <rect x={0} y={0} width={12} height={12} rx={2} fill={s.color} />
                        <text x={18} y={10} fontSize={10} fill="#495057">{s.label}</text>
                    </g>
                ))}
            </g>
        </svg>
    );
};

const StackedBarChart = ({ data, keys, colors }) => {
    if (!data?.length) return <Text size="xs" c="dimmed" ta="center" py="md">Tidak ada data.</Text>;
    const width = 760;
    const height = 240;
    const pad = { top: 30, right: 30, bottom: 50, left: 60 };
    const chartW = width - pad.left - pad.right;
    const chartH = height - pad.top - pad.bottom;
    const maxVal = Math.max(...data.map((d) => keys.reduce((s, k) => s + (d[k] || 0), 0)), 1);
    const barW = Math.min(60, chartW / data.length * 0.5);

    return (
        <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} style={{ overflow: 'visible' }}>
            {[0, 0.25, 0.5, 0.75, 1].map((p, i) => {
                const y = pad.top + chartH * p;
                const val = Math.round(maxVal * (1 - p));
                return (
                    <g key={i}>
                        <line x1={pad.left} y1={y} x2={width - pad.right} y2={y} stroke="#e9ecef" strokeDasharray="3,3" />
                        <text x={pad.left - 8} y={y + 4} textAnchor="end" fontSize={10} fill="#868e96">{val}</text>
                    </g>
                );
            })}
            {data.map((d, i) => {
                const x = pad.left + (i + 0.5) * (chartW / data.length) - barW / 2;
                let y = pad.top + chartH;
                return (
                    <g key={i}>
                        {keys.map((k, ki) => {
                            const val = d[k] || 0;
                            const h = (val / maxVal) * chartH;
                            y -= h;
                            return (
                                <g key={k}>
                                    <rect x={x} y={y} width={barW} height={h} rx={4} fill={colors[ki]} />
                                    {h > 16 && <text x={x + barW / 2} y={y + h / 2 + 4} textAnchor="middle" fontSize={10} fill="#fff" fontWeight={700}>{val}</text>}
                                </g>
                            );
                        })}
                        <text x={x + barW / 2} y={height - 30} textAnchor="middle" fontSize={11} fill="#495057" fontWeight={700}>{d.label}</text>
                    </g>
                );
            })}
            <g transform={`translate(${pad.left}, 15)`}>
                {keys.map((k, i) => (
                    <g key={k} transform={`translate(${i * 90}, 0)`}>
                        <rect x={0} y={0} width={12} height={12} rx={2} fill={colors[i]} />
                        <text x={18} y={10} fontSize={11} fill="#495057" fontWeight={600}>{k === 'ontime' ? 'On Time' : k === 'late' ? 'Late' : k === 'otif' ? 'OTIF' : 'NOT OTIF'}</text>
                    </g>
                ))}
            </g>
        </svg>
    );
};

const HorizontalBarChart = ({ data, leftKey, rightKey, leftColor, rightColor }) => {
    if (!data?.length) return <Text size="xs" c="dimmed" ta="center" py="md">Tidak ada data.</Text>;
    const width = 760;
    const height = 30 + data.length * 28;
    const pad = { top: 20, right: 30, bottom: 20, left: 60 };
    const chartW = width - pad.left - pad.right;

    return (
        <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} style={{ overflow: 'visible' }}>
            <line x1={pad.left + chartW / 2} y1={pad.top} x2={pad.left + chartW / 2} y2={height - pad.bottom} stroke="#e9ecef" strokeDasharray="3,3" />
            {data.map((d, i) => {
                const y = pad.top + i * 28;
                const total = (d[leftKey] || 0) + (d[rightKey] || 0);
                const leftW = total > 0 ? (d[leftKey] / total) * (chartW / 2 - 10) : 0;
                const rightW = total > 0 ? (d[rightKey] / total) * (chartW / 2 - 10) : 0;
                const leftPct = total > 0 ? Math.round((d[leftKey] / total) * 100) : 0;
                const rightPct = total > 0 ? Math.round((d[rightKey] / total) * 100) : 0;
                return (
                    <g key={i}>
                        <text x={pad.left - 8} y={y + 16} textAnchor="end" fontSize={11} fill="#495057" fontWeight={700}>{d.week}</text>
                        <rect x={pad.left + chartW / 2 - leftW - 5} y={y + 4} width={leftW} height={18} rx={4} fill={leftColor} />
                        <rect x={pad.left + chartW / 2 + 5} y={y + 4} width={rightW} height={18} rx={4} fill={rightColor} />
                        <text x={pad.left + chartW / 2 - leftW - 10} y={y + 16} textAnchor="end" fontSize={10} fill="#fff" fontWeight={700}>{leftPct > 0 ? `${leftPct}%` : ''}</text>
                        <text x={pad.left + chartW / 2 + rightW + 10} y={y + 16} fontSize={10} fill="#fff" fontWeight={700}>{rightPct > 0 ? `${rightPct}%` : ''}</text>
                    </g>
                );
            })}
        </svg>
    );
};

export default function DashboardPage() {
    const [activeTab, setActiveTab] = useState('occupancy');
    const [stats, setStats] = useState(null);
    const [occupancyData, setOccupancyData] = useState(null);
    const [oftiData, setOftiData] = useState(null);
    const [serapanData, setSerapanData] = useState(null);
    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [tableSearch, setTableSearch] = useState('');
    const [selectedZone, setSelectedZone] = useState(null);

    useEffect(() => {
        loadBaseData();
    }, []);

    useEffect(() => {
        if (activeTab === 'occupancy' && !occupancyData) loadOccupancy();
        if (activeTab === 'ofti' && !oftiData) loadOFTI();
        if (activeTab === 'serapan' && !serapanData) loadSerapan();
    }, [activeTab]);

    const loadBaseData = async () => {
        try {
            const [dashRes, logRes] = await Promise.all([
                api().get('/inventory/dashboard'),
                api().get('/inventory/logs'),
            ]);
            setStats(unwrap(dashRes));
            setLogs(unwrap(logRes));
        } catch (e) {
            console.error('Dashboard load error', e);
        }
        setLoading(false);
    };

    const loadOccupancy = async (zone?: string) => {
        try {
            const params = zone ? `?zone=${zone}` : '';
            const res = await api().get(`/inventory/dashboard/occupancy${params}`);
            setOccupancyData(unwrap(res));
        } catch (e) {
            console.error('Occupancy load error', e);
        }
    };

    const handleZoneClick = (zone: string) => {
        if (selectedZone === zone) {
            setSelectedZone(null);
            loadOccupancy();
        } else {
            setSelectedZone(zone);
            loadOccupancy(zone);
        }
    };

    const loadOFTI = async () => {
        try {
            const res = await api().get('/inventory/dashboard/ofti');
            setOftiData(unwrap(res));
        } catch (e) {
            console.error('OFTI load error', e);
        }
    };

    const loadSerapan = async () => {
        try {
            const res = await api().get('/inventory/dashboard/serapan-ayam');
            setSerapanData(unwrap(res));
        } catch (e) {
            console.error('Serapan load error', e);
        }
    };

    const filteredLogs = useMemo(() => {
        if (!tableSearch) return logs;
        const q = tableSearch.toLowerCase();
        return logs.filter((log) =>
            (log.no_po && log.no_po.toLowerCase().includes(q)) ||
            (log.no_ref && log.no_ref.toLowerCase().includes(q)) ||
            (log.barang?.nama && log.barang.nama.toLowerCase().includes(q)) ||
            (log.supplier && log.supplier.toLowerCase().includes(q)) ||
            (log.tujuan && log.tujuan.toLowerCase().includes(q)) ||
            (log.gudang?.name && log.gudang.name.toLowerCase().includes(q))
        );
    }, [logs, tableSearch]);

    if (loading) return <Box p="xl" style={{ display: 'flex', justifyContent: 'center' }}><Loader size="lg" /></Box>;

    const s = stats || {};

    return (
        <Box>
            <Box style={{ background: gradientBg, borderBottom: '1px solid #dee2e6', padding: '8px 16px' }}>
                <Group justify="space-between" align="center" mb={6}>
                    <Group gap="xs">
                        <IconBuildingWarehouse size={22} color="#0ea5e9" />
                        <Title order={4} style={{ color: '#0c4a6e', fontWeight: 900 }}>
                            DASHBOARD MONITORING RAW MATERIALS
                        </Title>
                        {(s.expiredCount > 0 || s.nearExpiredCount > 0 || s.wasteCount > 0) && (
                            <Group gap={4}>
                                {s.expiredCount > 0 && (
                                    <Badge color="red" variant="filled" size="sm">
                                        <IconAlertTriangle size={12} style={{ marginRight: 4 }} />
                                        EXPIRED {s.expiredCount}
                                    </Badge>
                                )}
                                {s.nearExpiredCount > 0 && (
                                    <Badge color="yellow" variant="filled" size="sm" style={{ color: '#f59f00' }}>
                                        <IconCalendarStats size={12} style={{ marginRight: 4 }} />
                                        NEAR EXP {s.nearExpiredCount}
                                    </Badge>
                                )}
                                {s.wasteCount > 0 && (
                                    <Badge color="violet" variant="filled" size="sm">
                                        <IconPackage size={12} style={{ marginRight: 4 }} />
                                        WASTE {s.wasteCount}
                                    </Badge>
                                )}
                            </Group>
                        )}
                    </Group>
                    <Button size="xs" variant="light" color="gray" leftSection={<IconRefresh size={14} />} onClick={() => { loadBaseData(); loadOccupancy(); loadOFTI(); loadSerapan(); }}>
                        Refresh
                    </Button>
                </Group>

                <Group gap={4} justify="center" grow style={{
                    width: 'calc(100% + var(--grid-gutter))',
                    display: 'flex',
                    flexWrap: 'nowrap',
                    justifyContent: 'space-evenly',
                    alignItems: 'center',
                    margin: 'var(--grid-margin)',
                    flexDirection: 'row',
                    alignContent: 'center',
                }}>
                    {TABS.map((tab) => {
                        const Icon = tab.icon;
                        const active = activeTab === tab.key;
                        return (
                            <Button
                                key={tab.key}
                                size="xs"
                                color="violet"
                                variant={active ? 'filled' : 'light'}
                                leftSection={<Icon size={14} />}
                                onClick={() => setActiveTab(tab.key)}
                                style={{ flex: '1 1 130px', fontWeight: 700, height: 30 }}
                            >
                                {tab.label}
                            </Button>
                        );
                    })}
                </Group>
            </Box>

            <Box p="sm">
                <Stack gap="sm">
                    {activeTab === 'occupancy' && (
                        <>
                            <Paper withBorder p="sm" style={{ borderRadius: 12, background: '#fff', boxShadow: cardShadow }}>
                                <Group gap="xs" mb={6}>
                                    <Box style={{ background: '#e7f5ff', borderRadius: 8, padding: 5 }}>
                                        <IconChartPie size={18} color="#228be6" />
                                    </Box>
                                    <div>
                                        <Title order={6} style={{ color: '#2b2b2b', lineHeight: 1.2 }}>Okupansi per Zone</Title>
                                        <Text size="xs" c="dimmed" style={{ lineHeight: 1.2 }}>Klik zone untuk detail item & trend</Text>
                                    </div>
                                </Group>
                                <Box style={{ display: 'flex', justifyContent: 'space-between', gap: 'sm', flexWrap: 'wrap' }}>
                                    {occupancyData?.gauges?.map((g) => (
                                        <Box key={g.id} style={{ flex: '1 1 0', minWidth: 120, maxWidth: 180 }}>
                                            <OccupancyGauge 
                                                pct={g.pct} 
                                                label={g.name} 
                                                subLabel={`${Math.round(g.used)} / ${Math.round(g.capacity)} kg`} 
                                                color={g.color}
                                                selected={selectedZone === g.id}
                                                onClick={() => handleZoneClick(g.id)}
                                            />
                                        </Box>
                                    ))}
                                    {!occupancyData && <Box py="xl" ta="center" style={{ width: '100%' }}><Loader size="sm" /></Box>}
                                </Box>
                            </Paper>

                            {selectedZone ? (
                                <>
                                    <Paper withBorder p="sm" style={{ borderRadius: 12, background: '#fff', boxShadow: cardShadow }}>
                                        <Group gap="xs" mb={6}>
                                            <Box style={{ background: '#fff3bf', borderRadius: 8, padding: 5 }}>
                                                <IconChartBar size={18} color="#f59f00" />
                                            </Box>
                                            <div>
                                                <Title order={6} style={{ color: '#2b2b2b', lineHeight: 1.2 }}>Trend Harian - Zone {selectedZone}</Title>
                                                <Text size="xs" c="dimmed" style={{ lineHeight: 1.2 }}>Scroll horizontal untuk data 1 tahun</Text>
                                            </div>
                                        </Group>
                                        <Box style={{ overflowX: 'auto', maxWidth: '100%' }}>
                                            <Box style={{ minWidth: occupancyData?.dailySeries?.length * 30 || 400 }}>
                                                <SimpleBarChart 
                                                    series={[{ label: 'Qty', color: occupancyData?.gauges?.find(g => g.id === selectedZone)?.color || '#228be6', data: occupancyData?.dailySeries?.map(d => d.value) || [] }]} 
                                                    labels={occupancyData?.dailySeries?.map((d, i) => ({ key: d.date, label: d.date.slice(5) })) || []} 
                                                />
                                            </Box>
                                        </Box>
                                    </Paper>

                                    <Paper withBorder p="sm" style={{ borderRadius: 12, background: '#fff', boxShadow: cardShadow }}>
                                        <Group justify="space-between" mb={4}>
                                            <Group gap="xs">
                                                <Box style={{ background: '#e7f5ff', borderRadius: 8, padding: 5 }}>
                                                    <IconBuildingWarehouse size={18} color="#228be6" />
                                                </Box>
                                                <div>
                                                    <Title order={6} style={{ color: '#2b2b2b', lineHeight: 1.2 }}>Item di Zone {selectedZone}</Title>
                                                    <Text size="xs" c="dimmed" style={{ lineHeight: 1.2 }}>{occupancyData?.items?.length || 0} item</Text>
                                                </div>
                                            </Group>
                                            <TextInput placeholder="Cari item..." size="xs" value={tableSearch} onChange={(e) => setTableSearch(e.target.value)} style={{ width: 180 }} />
                                        </Group>
                                        <Box style={{ overflowX: 'auto' }}>
                                            <Box component="table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11, minWidth: 700 }}>
                                                <Box component="thead" style={{ background: 'linear-gradient(90deg, #1a1a1a, #343a40)' }}>
                                                    <Box component="tr">
                                                        {['Barang', 'Batch', 'Qty', 'Satuan', 'Expired', 'Rak'].map((h) => (
                                                            <Box component="th" key={h} style={{ color: '#fff', fontSize: 11, padding: '8px 10px', textAlign: 'left' }}>{h}</Box>
                                                        ))}
                                                    </Box>
                                                </Box>
                                                <Box component="tbody">
                                                    {occupancyData?.items?.filter((item) => !tableSearch || item.barang.toLowerCase().includes(tableSearch.toLowerCase()) || item.batch.toLowerCase().includes(tableSearch.toLowerCase())).map((item) => (
                                                        <Box component="tr" key={item.id} style={{ borderBottom: '1px solid #eee' }}>
                                                            <Box component="td" style={{ padding: '6px 10px', fontWeight: 700 }}>{item.barang}</Box>
                                                            <Box component="td" style={{ padding: '6px 10px' }}><Badge size="xs" color="gray">{item.batch}</Badge></Box>
                                                            <Box component="td" style={{ padding: '6px 10px', textAlign: 'right' }}>{item.qty.toLocaleString()}</Box>
                                                            <Box component="td" style={{ padding: '6px 10px' }}>{item.satuan}</Box>
                                                            <Box component="td" style={{ padding: '6px 10px' }}>{item.expiry}</Box>
                                                            <Box component="td" style={{ padding: '6px 10px' }}>{item.rack}</Box>
                                                        </Box>
                                                    ))}
                                                    {(!occupancyData?.items || occupancyData.items.length === 0) && (
                                                        <Box component="tr"><Box component="td" colSpan={6} style={{ padding: 20, textAlign: 'center' }}><Text size="xs" c="dimmed">Tidak ada item di zone ini.</Text></Box></Box>
                                                    )}
                                                </Box>
                                            </Box>
                                        </Box>
                                    </Paper>
                                </>
                            ) : (
                                <>
                                    <Paper withBorder p="sm" style={{ borderRadius: 12, background: '#fff', boxShadow: cardShadow }}>
                                        <Group gap="xs" mb={6}>
                                            <Box style={{ background: '#fff3bf', borderRadius: 8, padding: 5 }}>
                                                <IconChartBar size={18} color="#f59f00" />
                                            </Box>
                                            <div>
                                                <Title order={6} style={{ color: '#2b2b2b', lineHeight: 1.2 }}>Okupansi per Zone (1 Tahun)</Title>
                                                <Text size="xs" c="dimmed" style={{ lineHeight: 1.2 }}>Scroll horizontal untuk data mingguan</Text>
                                            </div>
                                        </Group>
                                        <Box style={{ overflowX: 'auto', maxWidth: '100%' }}>
                                            <Box style={{ minWidth: occupancyData?.weeks?.length * 60 || 400 }}>
                                                <SimpleBarChart series={occupancyData?.series} labels={occupancyData?.weeks} />
                                            </Box>
                                        </Box>
                                    </Paper>

                                    <Paper withBorder p="sm" style={{ borderRadius: 12, background: '#fff', boxShadow: cardShadow }}>
                                        <Group justify="space-between" mb={4}>
                                            <Group gap="xs">
                                                <Box style={{ background: '#e7f5ff', borderRadius: 8, padding: 5 }}>
                                                    <IconBuildingWarehouse size={18} color="#228be6" />
                                                </Box>
                                                <div>
                                                    <Title order={6} style={{ color: '#2b2b2b', lineHeight: 1.2 }}>Summary per Zone</Title>
                                                    <Text size="xs" c="dimmed" style={{ lineHeight: 1.2 }}>Klik zone untuk detail</Text>
                                                </div>
                                            </Group>
                                            <TextInput placeholder="Cari zone..." size="xs" value={tableSearch} onChange={(e) => setTableSearch(e.target.value)} style={{ width: 180 }} />
                                        </Group>
                                        <Box style={{ overflowX: 'auto' }}>
                                            <Box component="table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11, minWidth: 700 }}>
                                                <Box component="thead" style={{ background: 'linear-gradient(90deg, #1a1a1a, #343a40)' }}>
                                                    <Box component="tr">
                                                        {['Zone', 'Terpakai', 'Kapasitas', 'Okupansi', 'Status'].map((h) => (
                                                            <Box component="th" key={h} style={{ color: '#fff', fontSize: 11, padding: '8px 10px', textAlign: 'left' }}>{h}</Box>
                                                        ))}
                                                    </Box>
                                                </Box>
                                                <Box component="tbody">
                                                    {occupancyData?.gauges?.filter((g) => !tableSearch || g.name.toLowerCase().includes(tableSearch.toLowerCase()) || g.zone.toLowerCase().includes(tableSearch.toLowerCase())).map((g) => (
                                                        <Box component="tr" key={g.id} style={{ borderBottom: '1px solid #eee', cursor: 'pointer' }} onClick={() => handleZoneClick(g.id)}>
                                                            <Box component="td" style={{ padding: '6px 10px', fontWeight: 700 }}>{g.name}</Box>
                                                            <Box component="td" style={{ padding: '6px 10px', textAlign: 'right' }}>{Math.round(g.used).toLocaleString()}</Box>
                                                            <Box component="td" style={{ padding: '6px 10px', textAlign: 'right' }}>{Math.round(g.capacity).toLocaleString()}</Box>
                                                            <Box component="td" style={{ padding: '6px 10px' }}>
                                                                <Badge size="xs" color={g.pct > 90 ? 'red' : g.pct > 75 ? 'orange' : g.pct > 50 ? 'yellow' : 'green'}>{g.pct}%</Badge>
                                                            </Box>
                                                            <Box component="td" style={{ padding: '6px 10px', fontSize: 11 }}>
                                                                {g.pct > 90 ? 'Penuh' : g.pct > 75 ? 'Hampir Penuh' : g.pct > 50 ? 'Sedang' : 'Aman'}
                                                            </Box>
                                                        </Box>
                                                    ))}
                                                    {!occupancyData && <Box component="tr"><Box component="td" colSpan={5} style={{ padding: 20, textAlign: 'center' }}><Loader size="sm" /></Box></Box>}
                                                </Box>
                                            </Box>
                                        </Box>
                                    </Paper>
                                </>
                            )}
                        </>
                    )}

                    {activeTab === 'ofti' && (
                        <>
                            <Paper withBorder p="sm" style={{ borderRadius: 12, background: '#fff', boxShadow: cardShadow }}>
                                <Group gap="xs" mb={6}>
                                    <Box style={{ background: '#d3f9d8', borderRadius: 8, padding: 5 }}>
                                        <IconTruckDelivery size={18} color="#2b8a3e" />
                                    </Box>
                                    <div>
                                        <Title order={6} style={{ color: '#2b2b2b', lineHeight: 1.2 }}>Planning Inbound vs Actual Inbound</Title>
                                        <Text size="xs" c="dimmed" style={{ lineHeight: 1.2 }}>On Time (hijau) vs Late (merah) - Scroll 1 tahun</Text>
                                    </div>
                                </Group>
                                <Box style={{ overflowX: 'auto', maxWidth: '100%' }}>
                                    <Box style={{ minWidth: oftiData?.daily?.length * 40 || 400 }}>
                                        <StackedBarChart data={oftiData?.daily} keys={['ontime', 'late']} colors={['#40c057', '#e03131']} />
                                    </Box>
                                </Box>
                            </Paper>

                            <Paper withBorder p="sm" style={{ borderRadius: 12, background: '#fff', boxShadow: cardShadow }}>
                                <Group gap="xs" mb={6}>
                                    <Box style={{ background: '#e7f5ff', borderRadius: 8, padding: 5 }}>
                                        <IconChartLine size={18} color="#228be6" />
                                    </Box>
                                    <div>
                                        <Title order={6} style={{ color: '#2b2b2b', lineHeight: 1.2 }}>OTIF INBOUND CP3</Title>
                                        <Text size="xs" c="dimmed" style={{ lineHeight: 1.2 }}>% OTIF vs NOT OTIF per minggu - Scroll 1 tahun</Text>
                                    </div>
                                </Group>
                                <Box style={{ overflowX: 'auto', maxWidth: '100%' }}>
                                    <Box style={{ minWidth: oftiData?.weekly?.length * 80 || 400 }}>
                                        <HorizontalBarChart data={oftiData?.weekly} leftKey="otif" rightKey="notOtif" leftColor="#228be6" rightColor="#e03131" />
                                    </Box>
                                </Box>
                            </Paper>
                        </>
                    )}

                    {activeTab === 'serapan' && (
                        <Paper withBorder p="sm" style={{ borderRadius: 12, background: '#fff', boxShadow: cardShadow }}>
                            <Group gap="xs" mb={6}>
                                <Box style={{ background: '#f3d9fa', borderRadius: 8, padding: 5 }}>
                                    <IconMeat size={18} color="#be4bdb" />
                                </Box>
                                <div>
                                    <Title order={6} style={{ color: '#2b2b2b', lineHeight: 1.2 }}>Serapan Ayam</Title>
                                    <Text size="xs" c="dimmed" style={{ lineHeight: 1.2 }}>Planning vs Serapan per minggu - Scroll 1 tahun</Text>
                                </div>
                            </Group>
                            <Box style={{ overflowX: 'auto', maxWidth: '100%' }}>
                                <Box style={{ minWidth: (serapanData?.data?.length || 0) * 60 || 400 }}>
                                    <SimpleBarChart 
                                        series={[
                                            { label: 'Planning', color: '#4c6ef5', data: serapanData?.data?.map((d) => d.planning) || [] },
                                            { label: 'Serapan', color: '#be4bdb', data: serapanData?.data?.map((d) => d.serapan) || [] },
                                        ]} 
                                        labels={serapanData?.data?.map((d) => ({ key: d.date, label: d.label })) || []} 
                                    />
                                </Box>
                            </Box>
                        </Paper>
                    )}

                    {activeTab === 'report' && (
                        <Paper withBorder p="sm" style={{ borderRadius: 12, background: '#fff', boxShadow: cardShadow, textAlign: 'center' }}>
                            <IconChartBar size={32} color="#adb5bd" />
                            <Title order={6} c="dimmed">Report Dashboard</Title>
                            <Text size="xs" c="dimmed">Fitur report lengkap akan menyusul.</Text>
                        </Paper>
                    )}

                    {/* Common mutation table */}
                    <Paper withBorder p="sm" style={{ borderRadius: 12, background: '#fff', boxShadow: cardShadow }}>
                        <Group justify="space-between" mb={4}>
                            <Group gap="xs">
                                <Box style={{ background: '#e7f5ff', borderRadius: 8, padding: 5 }}>
                                    <IconTrendingUp size={18} color="#228be6" />
                                </Box>
                                <div>
                                    <Title order={6} style={{ color: '#2b2b2b', lineHeight: 1.2 }}>Mutasi Terbaru</Title>
                                    <Text size="xs" c="dimmed" style={{ lineHeight: 1.2 }}>15 transaksi terbaru</Text>
                                </div>
                            </Group>
                            <Group gap={4}>
                                <TextInput placeholder="Cari PO, Item..." size="xs" value={tableSearch} onChange={(e) => setTableSearch(e.target.value)} style={{ width: 160 }} />
                                <Button size="xs" variant="light" color="blue" leftSection={<IconDownload size={12} />} onClick={() => {
                                    const csv = ['Tipe,No PO/Ref,Item,Qty,Satuan,Batch,Expired,Rak,Tanggal,Supplier/Tujuan,Keterangan'].concat(
                                        filteredLogs.slice(0, 100).map(log => [
                                            log.type,
                                            log.no_po || log.no_ref || '-',
                                            log.barang?.nama || '-',
                                            log.qty,
                                            log.satuan || '-',
                                            log.batch_no || '-',
                                            log.expiry_date ? new Date(log.expiry_date).toISOString().split('T')[0] : '-',
                                            log.gudang?.name || '-',
                                            log.tanggal_income || fmt(log.created_at),
                                            log.supplier || log.tujuan || '-',
                                            log.note || '-'
                                        ].join(','))
                                    ).join('\n');
                                    const blob = new Blob([csv], { type: 'text/csv' });
                                    const url = URL.createObjectURL(blob);
                                    const a = document.createElement('a');
                                    a.href = url;
                                    a.download = `mutasi_${new Date().toISOString().split('T')[0]}.csv`;
                                    a.click();
                                    URL.revokeObjectURL(url);
                                }}>Export CSV</Button>
                            </Group>
                        </Group>
                        <Box style={{ overflowX: 'auto', maxHeight: 400 }}>
                            <Box component="table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11, minWidth: 900 }}>
                                <Box component="thead" style={{ background: 'linear-gradient(90deg, #1a1a1a, #343a40)', position: 'sticky', top: 0, zIndex: 1 }}>
                                    <Box component="tr">
                                        {['Tipe', 'No PO/Ref', 'Item', 'Qty', 'Satuan', 'Batch', 'Expired', 'Rak', 'Tanggal', 'Supplier/Tujuan', 'Keterangan'].map((h) => (
                                            <Box component="th" key={h} style={{ color: '#fff', fontSize: 11, padding: '8px 10px', textAlign: 'left' }}>{h}</Box>
                                        ))}
                                    </Box>
                                </Box>
                                <Box component="tbody">
                                    {filteredLogs.slice(0, 15).map((log) => {
                                        const typeColor = log.type === 'INBOUND' ? 'green' : log.type === 'OUTBOUND' ? 'red' : 'blue';
                                        return (
                                            <Box component="tr" key={log.id} style={{ borderBottom: '1px solid #eee' }}>
                                                <Box component="td" style={{ padding: '6px 10px' }}><Badge size="xs" color={typeColor} variant="light">{log.type}</Badge></Box>
                                                <Box component="td" style={{ padding: '6px 10px', fontWeight: 700 }}>{log.no_po || log.no_ref || '-'}</Box>
                                                <Box component="td" style={{ padding: '6px 10px', fontWeight: 600 }}>{log.barang?.nama || '-'}</Box>
                                                <Box component="td" style={{ padding: '6px 10px', textAlign: 'right' }}>{log.qty}</Box>
                                                <Box component="td" style={{ padding: '6px 10px' }}>{log.satuan || '-'}</Box>
                                                <Box component="td" style={{ padding: '6px 10px' }}>{log.batch_no || '-'}</Box>
                                                <Box component="td" style={{ padding: '6px 10px' }}>{log.expiry_date ? new Date(log.expiry_date).toISOString().split('T')[0] : '-'}</Box>
                                                <Box component="td" style={{ padding: '6px 10px' }}>
                                                    <Badge size="xs" color="gray">{log.gudang?.name || '-'}</Badge>
                                                    {log.gudang_tujuan && <> ➔ <Badge size="xs" color="teal">{log.gudang_tujuan.name}</Badge></>}
                                                </Box>
                                                <Box component="td" style={{ padding: '6px 10px' }}>{log.tanggal_income || fmt(log.created_at)}</Box>
                                                <Box component="td" style={{ padding: '6px 10px' }}>{log.supplier || log.tujuan || '-'}</Box>
                                                <Box component="td" style={{ padding: '6px 10px' }}>{log.note || '-'}</Box>
                                            </Box>
                                        );
                                    })}
                                    {filteredLogs.length === 0 && (
                                        <Box component="tr">
                                            <Box component="td" colSpan={11} style={{ padding: '20px', textAlign: 'center' }}>
                                                <Text size="xs" c="dimmed">Tidak ada data mutasi.</Text>
                                            </Box>
                                        </Box>
                                    )}
                                </Box>
                            </Box>
                        </Box>
                        {filteredLogs.length > 15 && (
                            <Text size="xs" c="dimmed" mt="xs" ta="center">Menampilkan 15 dari {filteredLogs.length} transaksi. Export CSV untuk data lengkap.</Text>
                        )}
                    </Paper>
                </Stack>
            </Box>
        </Box>
    );
}
