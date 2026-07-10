'use client';
// @ts-nocheck
import React, { useState, useEffect, useMemo } from 'react';
import {
    Box, Grid, Group, Paper, Stack, Text, Title, Badge, Button, Loader, TextInput
} from '@mantine/core';
import {
    IconPackage, IconTrendingUp, IconTrendingDown, IconRefresh, IconCalendarStats,
    IconBuildingWarehouse, IconAlertTriangle, IconChartBar, IconChartLine,
    IconChartPie, IconTruckDelivery, IconMeat
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
    const radius = 42;
    const circ = 2 * Math.PI * radius;
    const strokePct = ((100 - pct) / 100) * circ;
    return (
        <Paper 
            withBorder 
            p="md" 
            style={{ 
                borderRadius: 14, 
                background: selected ? '#e7f5ff' : '#fff', 
                boxShadow: selected ? '0 0 0 2px #228be6' : cardShadow, 
                textAlign: 'center',
                cursor: 'pointer',
                transition: 'all 0.2s'
            }}
            onClick={onClick}
        >
            <svg width={110} height={110} style={{ transform: 'rotate(-90deg)', margin: '0 auto', display: 'block' }}>
                <defs>
                    <linearGradient id={`occ-grad-${label.replace(/\s+/g, '')}`} x1="0%" y1="0%" x2="100%" y2="0%">
                        <stop offset="0%" stopColor={color} />
                        <stop offset="100%" stopColor={color} stopOpacity={0.5} />
                    </linearGradient>
                </defs>
                <circle r={radius} cx={55} cy={55} fill="transparent" stroke="#f1f3f5" strokeWidth={9} />
                <circle r={radius} cx={55} cy={55} fill="transparent" stroke={`url(#occ-grad-${label.replace(/\s+/g, '')})`} strokeWidth={9} strokeDasharray={circ} strokeDashoffset={strokePct} strokeLinecap="round" />
            </svg>
            <Text size="xl" fw={800} c={color} style={{ marginTop: -12 }}>{pct}%</Text>
            <Text size="xs" fw={700} truncate>{label}</Text>
            <Text size="10px" c="dimmed" truncate>{subLabel}</Text>
        </Paper>
    );
};

const SimpleBarChart = ({ series, labels, title }) => {
    if (!series?.length) return <Text size="xs" c="dimmed" ta="center" py="xl">Tidak ada data.</Text>;
    const width = 760;
    const height = 320;
    const pad = { top: 40, right: 30, bottom: 60, left: 60 };
    const chartW = width - pad.left - pad.right;
    const chartH = height - pad.top - pad.bottom;
    const maxVal = Math.max(...series.flatMap((s) => s.data), 1);
    const groupW = chartW / labels.length;
    const barW = Math.min(28, (groupW - 24) / series.length);

    return (
        <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} style={{ overflow: 'visible' }}>
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
    if (!data?.length) return <Text size="xs" c="dimmed" ta="center" py="xl">Tidak ada data.</Text>;
    const width = 760;
    const height = 300;
    const pad = { top: 40, right: 30, bottom: 60, left: 60 };
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
    if (!data?.length) return <Text size="xs" c="dimmed" ta="center" py="xl">Tidak ada data.</Text>;
    const width = 760;
    const height = 40 + data.length * 34;
    const pad = { top: 30, right: 30, bottom: 30, left: 60 };
    const chartW = width - pad.left - pad.right;

    return (
        <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} style={{ overflow: 'visible' }}>
            <line x1={pad.left + chartW / 2} y1={pad.top} x2={pad.left + chartW / 2} y2={height - pad.bottom} stroke="#e9ecef" strokeDasharray="3,3" />
            {data.map((d, i) => {
                const y = pad.top + i * 34;
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

    const loadOccupancy = async () => {
        try {
            const res = await api().get('/inventory/dashboard/occupancy');
            setOccupancyData(unwrap(res));
        } catch (e) {
            console.error('Occupancy load error', e);
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
            <Box style={{ background: gradientBg, borderBottom: '1px solid #dee2e6', padding: '14px 24px' }}>
                <Group justify="space-between" align="center" mb="md">
                    <Group gap="sm">
                        <IconBuildingWarehouse size={28} color="#0ea5e9" />
                        <Title order={3} style={{ color: '#0c4a6e', fontWeight: 900 }}>
                            DASHBOARD MONITORING RAW MATERIALS
                        </Title>
                    </Group>
                    <Button size="xs" variant="light" color="gray" leftSection={<IconRefresh size={14} />} onClick={() => { loadBaseData(); loadOccupancy(); loadOFTI(); loadSerapan(); }}>
                        Refresh
                    </Button>
                </Group>

                <Group gap="sm" justify="center" grow>
                    {TABS.map((tab) => {
                        const Icon = tab.icon;
                        const active = activeTab === tab.key;
                        return (
                            <Button
                                key={tab.key}
                                size="sm"
                                color="violet"
                                variant={active ? 'filled' : 'light'}
                                leftSection={<Icon size={16} />}
                                onClick={() => setActiveTab(tab.key)}
                                style={{ flex: '1 1 130px', fontWeight: 700 }}
                            >
                                {tab.label}
                            </Button>
                        );
                    })}
                </Group>
            </Box>

            <Box p="md">
                <Stack gap="md">
                    {/* Alert Banners */}
                    {(s.expiredCount > 0 || s.nearExpiredCount > 0 || s.wasteCount > 0) && (
                        <Grid gutter="sm">
                            {s.expiredCount > 0 && (
                                <Grid.Col span={{ base: 12, md: 4 }}>
                                    <Paper withBorder p="sm" style={{ background: 'linear-gradient(135deg, #fff5f5, #ffe3e3)', borderLeft: '5px solid #fa5252', borderRadius: 12 }}>
                                        <Group gap="sm">
                                            <IconAlertTriangle color="#fa5252" />
                                            <div>
                                                <Text fw={700} size="sm" c="red">BATCH EXPIRED</Text>
                                                <Text size="xs" c="dimmed">{s.expiredCount} lot melewati expired.</Text>
                                            </div>
                                            <Badge color="red" variant="filled" ml="auto">EXPIRED</Badge>
                                        </Group>
                                    </Paper>
                                </Grid.Col>
                            )}
                            {s.nearExpiredCount > 0 && (
                                <Grid.Col span={{ base: 12, md: 4 }}>
                                    <Paper withBorder p="sm" style={{ background: 'linear-gradient(135deg, #fff9db, #fff3bf)', borderLeft: '5px solid #fcc419', borderRadius: 12 }}>
                                        <Group gap="sm">
                                            <IconCalendarStats color="#f59f00" />
                                            <div>
                                                <Text fw={700} size="sm" c="yellow.9">NEAR EXPIRED</Text>
                                                <Text size="xs" c="dimmed">{s.nearExpiredCount} lot &lt; 30 hari.</Text>
                                            </div>
                                            <Badge color="yellow" variant="filled" ml="auto">NEAR EXP</Badge>
                                        </Group>
                                    </Paper>
                                </Grid.Col>
                            )}
                            {s.wasteCount > 0 && (
                                <Grid.Col span={{ base: 12, md: 4 }}>
                                    <Paper withBorder p="sm" style={{ background: 'linear-gradient(135deg, #f3f0ff, #e5dbff)', borderLeft: '5px solid #845ef7', borderRadius: 12 }}>
                                        <Group gap="sm">
                                            <IconPackage color="#845ef7" />
                                            <div>
                                                <Text fw={700} size="sm" c="violet">WASTE ZONE</Text>
                                                <Text size="xs" c="dimmed">{s.wasteCount} item di area waste.</Text>
                                            </div>
                                            <Badge color="violet" variant="filled" ml="auto">WASTE</Badge>
                                        </Group>
                                    </Paper>
                                </Grid.Col>
                            )}
                        </Grid>
                    )}

                    {activeTab === 'occupancy' && (
                        <>
                            <Paper withBorder p="md" style={{ borderRadius: 16, background: '#fff', boxShadow: cardShadow }}>
                                <Group gap="sm" mb="md">
                                    <Box style={{ background: '#e7f5ff', borderRadius: 10, padding: 8 }}>
                                        <IconChartPie size={22} color="#228be6" />
                                    </Box>
                                    <div>
                                        <Title order={5} style={{ color: '#2b2b2b' }}>Okupansi Gudang</Title>
                                        <Text size="xs" c="dimmed">Persentase penggunaan kapasitas per gudang/rak</Text>
                                    </div>
                                </Group>
                                <Grid gutter="md">
                                    {occupancyData?.gauges?.map((g) => (
                                        <Grid.Col key={g.id} span={{ base: 6, sm: 4, md: 3, lg: 'content' }}>
                                            <OccupancyGauge 
                                                pct={g.pct} 
                                                label={g.name} 
                                                subLabel={`${Math.round(g.used)} / ${Math.round(g.capacity)} kg`} 
                                                color={g.color}
                                                selected={selectedZone === g.id}
                                                onClick={() => setSelectedZone(selectedZone === g.id ? null : g.id)}
                                            />
                                        </Grid.Col>
                                    ))}
                                    {!occupancyData && <Grid.Col span={12}><Box py="xl" ta="center"><Loader size="sm" /></Box></Grid.Col>}
                                </Grid>
                            </Paper>

                            <Paper withBorder p="md" style={{ borderRadius: 16, background: '#fff', boxShadow: cardShadow }}>
                                <Group gap="sm" mb="md">
                                    <Box style={{ background: '#fff3bf', borderRadius: 10, padding: 8 }}>
                                        <IconChartBar size={22} color="#f59f00" />
                                    </Box>
                                    <div>
                                        <Title order={5} style={{ color: '#2b2b2b' }}>Okupansi per Zone (4 Minggu)</Title>
                                        <Text size="xs" c="dimmed">Ringkasan transaksi per zone mingguan</Text>
                                    </div>
                                </Group>
                                <SimpleBarChart series={occupancyData?.series} labels={occupancyData?.weeks} />
                            </Paper>

                            <Paper withBorder p="md" style={{ borderRadius: 16, background: '#fff', boxShadow: cardShadow }}>
                                <Group justify="space-between" mb="sm">
                                    <Group gap="sm">
                                        <Box style={{ background: '#e7f5ff', borderRadius: 10, padding: 8 }}>
                                            <IconBuildingWarehouse size={22} color="#228be6" />
                                        </Box>
                                        <div>
                                            <Title order={5} style={{ color: '#2b2b2b' }}>Riwayat Okupansi Harian</Title>
                                            <Text size="xs" c="dimmed">Max 1 bulan + fitur download akan menyusul</Text>
                                        </div>
                                    </Group>
                                    <TextInput placeholder="Cari gudang..." size="xs" value={tableSearch} onChange={(e) => setTableSearch(e.target.value)} style={{ width: 220 }} />
                                </Group>
                                <Box style={{ overflowX: 'auto' }}>
                                    <Box component="table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11, minWidth: 700 }}>
                                        <Box component="thead" style={{ background: 'linear-gradient(90deg, #1a1a1a, #343a40)' }}>
                                            <Box component="tr">
                                                {['Gudang', 'Zone', 'Terpakai', 'Kapasitas', 'Okupansi', 'Status'].map((h) => (
                                                    <Box component="th" key={h} style={{ color: '#fff', fontSize: 11, padding: '8px 10px', textAlign: 'left' }}>{h}</Box>
                                                ))}
                                            </Box>
                                        </Box>
                                        <Box component="tbody">
                                            {occupancyData?.gauges?.filter((g) => !tableSearch || g.name.toLowerCase().includes(tableSearch.toLowerCase()) || g.zone.toLowerCase().includes(tableSearch.toLowerCase())).map((g) => (
                                                <Box component="tr" key={g.id} style={{ borderBottom: '1px solid #eee' }}>
                                                    <Box component="td" style={{ padding: '6px 10px', fontWeight: 700 }}>{g.name}</Box>
                                                    <Box component="td" style={{ padding: '6px 10px' }}><Badge size="xs" color="gray">{g.zone}</Badge></Box>
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
                                            {!occupancyData && <Box component="tr"><Box component="td" colSpan={6} style={{ padding: 20, textAlign: 'center' }}><Loader size="sm" /></Box></Box>}
                                        </Box>
                                    </Box>
                                </Box>
                            </Paper>
                        </>
                    )}

                    {activeTab === 'ofti' && (
                        <>
                            <Paper withBorder p="md" style={{ borderRadius: 16, background: '#fff', boxShadow: cardShadow }}>
                                <Group gap="sm" mb="md">
                                    <Box style={{ background: '#d3f9d8', borderRadius: 10, padding: 8 }}>
                                        <IconTruckDelivery size={22} color="#2b8a3e" />
                                    </Box>
                                    <div>
                                        <Title order={5} style={{ color: '#2b2b2b' }}>Planning Inbound vs Actual Inbound</Title>
                                        <Text size="xs" c="dimmed">On Time (hijau) vs Late (merah) per hari</Text>
                                    </div>
                                </Group>
                                <StackedBarChart data={oftiData?.daily} keys={['ontime', 'late']} colors={['#40c057', '#e03131']} />
                            </Paper>

                            <Paper withBorder p="md" style={{ borderRadius: 16, background: '#fff', boxShadow: cardShadow }}>
                                <Group gap="sm" mb="md">
                                    <Box style={{ background: '#e7f5ff', borderRadius: 10, padding: 8 }}>
                                        <IconChartLine size={22} color="#228be6" />
                                    </Box>
                                    <div>
                                        <Title order={5} style={{ color: '#2b2b2b' }}>OTIF INBOUND CP3</Title>
                                        <Text size="xs" c="dimmed">% OTIF vs NOT OTIF per minggu</Text>
                                    </div>
                                </Group>
                                <HorizontalBarChart data={oftiData?.weekly} leftKey="otif" rightKey="notOtif" leftColor="#228be6" rightColor="#e03131" />
                            </Paper>
                        </>
                    )}

                    {activeTab === 'serapan' && (
                        <Paper withBorder p="md" style={{ borderRadius: 16, background: '#fff', boxShadow: cardShadow }}>
                            <Group gap="sm" mb="md">
                                <Box style={{ background: '#f3d9fa', borderRadius: 10, padding: 8 }}>
                                    <IconMeat size={22} color="#be4bdb" />
                                </Box>
                                <div>
                                    <Title order={5} style={{ color: '#2b2b2b' }}>Serapan Ayam</Title>
                                    <Text size="xs" c="dimmed">Planning vs Serapan per minggu (2 bar per minggu)</Text>
                                </div>
                            </Group>
                            <SimpleBarChart 
                                series={[
                                    { label: 'Planning', color: '#4c6ef5', data: serapanData?.data?.map((d) => d.planning) || [] },
                                    { label: 'Serapan', color: '#be4bdb', data: serapanData?.data?.map((d) => d.serapan) || [] },
                                ]} 
                                labels={serapanData?.data?.map((d) => ({ key: d.date, label: d.label })) || []} 
                            />
                        </Paper>
                    )}

                    {activeTab === 'report' && (
                        <Paper withBorder p="xl" style={{ borderRadius: 16, background: '#fff', boxShadow: cardShadow, textAlign: 'center' }}>
                            <IconChartBar size={48} color="#adb5bd" style={{ marginBottom: 12 }} />
                            <Title order={5} c="dimmed">Report Dashboard</Title>
                            <Text size="sm" c="dimmed" mt="xs">Fitur report lengkap akan menyusul pada tahap berikutnya.</Text>
                        </Paper>
                    )}

                    {/* Common mutation table */}
                    <Paper withBorder p="md" style={{ borderRadius: 16, background: '#fff', boxShadow: cardShadow }}>
                        <Group justify="space-between" mb="sm">
                            <Group gap="sm">
                                <Box style={{ background: '#e7f5ff', borderRadius: 10, padding: 8 }}>
                                    <IconTrendingUp size={22} color="#228be6" />
                                </Box>
                                <div>
                                    <Title order={5} style={{ color: '#2b2b2b' }}>Mutasi Terbaru</Title>
                                    <Text size="xs" c="dimmed">Maks. 100 transaksi terbaru</Text>
                                </div>
                            </Group>
                            <TextInput placeholder="Cari PO, Item, Supplier..." size="xs" value={tableSearch} onChange={(e) => setTableSearch(e.target.value)} style={{ width: 260 }} />
                        </Group>
                        <Box style={{ overflowX: 'auto' }}>
                            <Box component="table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11, minWidth: 900 }}>
                                <Box component="thead" style={{ background: 'linear-gradient(90deg, #1a1a1a, #343a40)' }}>
                                    <Box component="tr">
                                        {['Tipe', 'No PO/Ref', 'Item', 'Qty', 'Satuan', 'Batch', 'Expired', 'Rak', 'Tanggal', 'Supplier/Tujuan', 'Keterangan'].map((h) => (
                                            <Box component="th" key={h} style={{ color: '#fff', fontSize: 11, padding: '8px 10px', textAlign: 'left' }}>{h}</Box>
                                        ))}
                                    </Box>
                                </Box>
                                <Box component="tbody">
                                    {filteredLogs.slice(0, 100).map((log) => {
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
                    </Paper>
                </Stack>
            </Box>
        </Box>
    );
}
