'use client';
// @ts-nocheck
import React, { useState, useEffect, useMemo } from 'react';
import {
    Box, Grid, Group, Paper, Stack, Text, Title, Badge, Button, Loader, TextInput
} from '@mantine/core';
import {
    IconPackage, IconTrendingUp, IconTrendingDown, IconRefresh, IconCalendarStats,
    IconBuildingWarehouse, IconAlertTriangle, IconChartBar, IconChartLine
} from '@tabler/icons-react';
import { api, unwrap, fmt } from '../lib/api';

const gradientBg = 'linear-gradient(135deg, #f8f9fa 0%, #e7f5ff 100%)';
const cardShadow = '0 4px 20px rgba(0,0,0,0.06)';

const ClickableGauge = ({ pct, label, subLabel, color, active, onClick }) => {
    const radius = 34;
    const circ = 2 * Math.PI * radius;
    const strokePct = ((100 - pct) / 100) * circ;
    return (
        <Paper
            withBorder
            p="sm"
            onClick={onClick}
            style={{
                cursor: 'pointer',
                borderRadius: 14,
                background: active
                    ? 'linear-gradient(135deg, #e7f5ff 0%, #d0ebff 100%)'
                    : 'linear-gradient(135deg, #ffffff 0%, #f8f9fa 100%)',
                border: active ? '2px solid #228be6' : '1px solid #e9ecef',
                boxShadow: active ? '0 6px 24px rgba(34,139,230,0.18)' : cardShadow,
                transition: 'all 0.2s ease',
                transform: active ? 'scale(1.02)' : 'scale(1)',
            }}
        >
            <Group gap="sm" wrap="nowrap">
                <svg width={82} height={82} style={{ transform: 'rotate(-90deg)', flexShrink: 0 }}>
                    <defs>
                        <linearGradient id={`grad-${label.replace(/\s+/g, '')}`} x1="0%" y1="0%" x2="100%" y2="0%">
                            <stop offset="0%" stopColor={color} />
                            <stop offset="100%" stopColor={color} stopOpacity={0.5} />
                        </linearGradient>
                    </defs>
                    <circle r={radius} cx={41} cy={41} fill="transparent" stroke="#f1f3f5" strokeWidth={7} />
                    <circle r={radius} cx={41} cy={41} fill="transparent" stroke={`url(#grad-${label.replace(/\s+/g, '')})`} strokeWidth={7} strokeDasharray={circ} strokeDashoffset={strokePct} strokeLinecap="round" />
                </svg>
                <div style={{ overflow: 'hidden' }}>
                    <Text size="xs" fw={700} truncate style={{ color: '#2b2b2b' }}>{label}</Text>
                    <Text size="xs" c="dimmed" truncate>{subLabel}</Text>
                    <Badge size="xs" color={pct > 90 ? 'red' : pct > 75 ? 'orange' : 'teal'} mt={4} radius="sm">{pct}%</Badge>
                </div>
            </Group>
        </Paper>
    );
};

const Single3DBar = ({ x, y, width, height, color, label }) => {
    const depth = Math.min(width * 0.55, 22);
    const w = width;
    const h = height;

    const front = `M${x},${y + h} L${x},${y} L${x + w},${y} L${x + w},${y + h} Z`;
    const top = `M${x},${y} L${x + depth * 0.6},${y - depth * 0.45} L${x + w + depth * 0.6},${y - depth * 0.45} L${x + w},${y} Z`;
    const right = `M${x + w},${y} L${x + w + depth * 0.6},${y - depth * 0.45} L${x + w + depth * 0.6},${y + h - depth * 0.45} L${x + w},${y + h} Z`;

    return (
        <g>
            <path d={top} fill={color} opacity={0.5} />
            <path d={right} fill={color} opacity={0.35} />
            <path d={front} fill={color} opacity={0.9} />
            <text x={x + w / 2} y={y + h / 2 + 4} textAnchor="middle" fontSize={10} fontWeight={700} fill="#fff" style={{ pointerEvents: 'none' }}>
                {h > 20 ? label : ''}
            </text>
        </g>
    );
};

const aggregateStockToWeekly = (series, dates) => {
    if (!series?.length || !dates?.length) return { weeks: [], series: [] };
    const daysPerWeek = 7;
    const numWeeks = 4;
    const totalDays = Math.min(dates.length, daysPerWeek * numWeeks);
    const startIdx = Math.max(0, dates.length - totalDays);

    const weeks = [];
    const weeklySeries = series.map((s) => ({ ...s, data: [] }));

    for (let w = 0; w < numWeeks; w++) {
        const weekEndIdx = Math.min(startIdx + (w + 1) * daysPerWeek - 1, dates.length - 1);
        if (weekEndIdx < startIdx) break;
        const weekEndDate = dates[weekEndIdx];
        weeks.push(weekEndDate);
        for (let i = 0; i < series.length; i++) {
            weeklySeries[i].data.push(series[i].data[weekEndIdx]?.stock || 0);
        }
    }
    return { weeks, series: weeklySeries };
};

const StockBar3DChart = ({ series, dates }) => {
    const { weeks, series: weeklySeries } = aggregateStockToWeekly(series, dates);
    const topSeries = useMemo(() => {
        return [...weeklySeries]
            .sort((a, b) => Math.max(...b.data) - Math.max(...a.data))
            .slice(0, 6);
    }, [weeklySeries]);

    if (!weeks.length || !topSeries.length) {
        return <Text size="xs" c="dimmed" ta="center" py="xl">Tidak ada data stok.</Text>;
    }

    const width = 760;
    const height = 340;
    const pad = { top: 50, right: 30, bottom: 70, left: 60 };
    const chartW = width - pad.left - pad.right;
    const chartH = height - pad.top - pad.bottom;
    const groupW = chartW / weeks.length;
    const barW = Math.min(34, (groupW - 20) / topSeries.length);
    const maxVal = Math.max(...topSeries.flatMap((s) => s.data), 1);

    const getX = (wIdx, sIdx) => pad.left + wIdx * groupW + (groupW - topSeries.length * barW) / 2 + sIdx * barW;
    const getY = (val) => pad.top + chartH - (val / maxVal) * chartH;

    return (
        <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} style={{ overflow: 'visible' }}>
            <defs>
                {topSeries.map((s) => (
                    <linearGradient key={s.id} id={`bar-grad-${s.id}`} x1="0%" y1="0%" x2="0%" y2="100%">
                        <stop offset="0%" stopColor={s.color} />
                        <stop offset="100%" stopColor={s.color} stopOpacity={0.6} />
                    </linearGradient>
                ))}
            </defs>
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
            {weeks.map((w, wIdx) => (
                <g key={w}>
                    {topSeries.map((s, sIdx) => {
                        const val = s.data[wIdx] || 0;
                        const h = (val / maxVal) * chartH;
                        const x = getX(wIdx, sIdx);
                        const y = getY(val);
                        return (
                            <Single3DBar
                                key={s.id}
                                x={x}
                                y={y}
                                width={barW}
                                height={h}
                                color={`url(#bar-grad-${s.id})`}
                                label={val >= 100 ? `${Math.round(val / 1000)}k` : val.toString()}
                            />
                        );
                    })}
                    <text x={pad.left + wIdx * groupW + groupW / 2} y={height - 35} textAnchor="middle" fontSize={10} fill="#868e96">
                        Minggu {wIdx + 1}
                    </text>
                    <text x={pad.left + wIdx * groupW + groupW / 2} y={height - 20} textAnchor="middle" fontSize={9} fill="#adb5bd">
                        {w.slice(5)}
                    </text>
                </g>
            ))}
            <g transform={`translate(${width - pad.right + 5}, ${pad.top})`}>
                {topSeries.map((s, i) => (
                    <g key={s.id} transform={`translate(0, ${i * 22})`}>
                        <rect x={0} y={0} width={12} height={12} rx={2} fill={s.color} />
                        <text x={18} y={10} fontSize={10} fill="#495057">{s.nama.slice(0, 18)}</text>
                    </g>
                ))}
            </g>
        </svg>
    );
};

const InOutLineChart = ({ data }) => {
    if (!data || data.length === 0) {
        return <Text size="xs" c="dimmed" ta="center" py="xl">Tidak ada data inbound/outbound.</Text>;
    }
    const width = 760;
    const height = 300;
    const pad = { top: 40, right: 40, bottom: 50, left: 60 };
    const chartW = width - pad.left - pad.right;
    const chartH = height - pad.top - pad.bottom;
    const maxVal = Math.max(...data.map((d) => Math.max(d.inbound || 0, d.outbound || 0)), 1);

    const getX = (i) => pad.left + (i / Math.max(data.length - 1, 1)) * chartW;
    const getY = (val) => pad.top + chartH - (val / maxVal) * chartH;

    const inPath = data.reduce((acc, d, i) => {
        const x = getX(i);
        const y = getY(d.inbound || 0);
        return i === 0 ? `M${x},${y}` : `${acc} L${x},${y}`;
    }, '');
    const outPath = data.reduce((acc, d, i) => {
        const x = getX(i);
        const y = getY(d.outbound || 0);
        return i === 0 ? `M${x},${y}` : `${acc} L${x},${y}`;
    }, '');

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
            {data.map((d, i) => (
                <text key={i} x={getX(i)} y={height - 15} textAnchor="middle" fontSize={10} fill="#868e96">
                    {d.week?.slice(5)}
                </text>
            ))}
            <path d={inPath} fill="none" stroke="#2b8a3e" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
            <path d={outPath} fill="none" stroke="#e03131" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
            {data.map((d, i) => {
                const x = getX(i);
                const yIn = getY(d.inbound || 0);
                const yOut = getY(d.outbound || 0);
                return (
                    <g key={i}>
                        <circle cx={x} cy={yIn} r={5} fill="#2b8a3e" stroke="#fff" strokeWidth={2} />
                        <circle cx={x} cy={yOut} r={5} fill="#e03131" stroke="#fff" strokeWidth={2} />
                    </g>
                );
            })}
            <g transform={`translate(${pad.left}, 15)`}>
                <circle cx={0} cy={0} r={5} fill="#2b8a3e" />
                <text x={12} y={4} fontSize={11} fill="#495057" fontWeight={600}>Inbound</text>
                <circle cx={90} cy={0} r={5} fill="#e03131" />
                <text x={102} y={4} fontSize={11} fill="#495057" fontWeight={600}>Outbound</text>
            </g>
        </svg>
    );
};

export default function DashboardPage() {
    const [stats, setStats] = useState(null);
    const [products, setProducts] = useState([]);
    const [logs, setLogs] = useState([]);
    const [stockChart, setStockChart] = useState(null);
    const [chartData, setChartData] = useState([]);
    const [stockChartLoading, setStockChartLoading] = useState(false);
    const [loading, setLoading] = useState(true);
    const [selectedProductId, setSelectedProductId] = useState(null);
    const [tableSearch, setTableSearch] = useState('');

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        try {
            const [dashRes, prodRes, logRes, chartRes] = await Promise.all([
                api().get('/inventory/dashboard'),
                api().get('/barang'),
                api().get('/inventory/logs'),
                api().get('/inventory/dashboard/inout-chart'),
            ]);
            setStats(unwrap(dashRes));
            setProducts(unwrap(prodRes));
            setLogs(unwrap(logRes));
            setChartData(unwrap(chartRes));
        } catch (e) {
            console.error('Dashboard load error', e);
        }
        setLoading(false);
    };

    useEffect(() => {
        loadStockChart();
    }, [selectedProductId]);

    const loadStockChart = async () => {
        setStockChartLoading(true);
        try {
            const endpoint = selectedProductId
                ? `/inventory/dashboard/stock-chart?barang_id=${selectedProductId}`
                : '/inventory/dashboard/stock-chart';
            const res = await api().get(endpoint);
            setStockChart(unwrap(res));
        } catch (e) {
            console.error('Stock chart load error', e);
        }
        setStockChartLoading(false);
    };

    const handleGaugeClick = (productId) => {
        setSelectedProductId((prev) => (prev === productId ? null : productId));
    };

    const filteredLogs = useMemo(() => {
        return logs.filter((log) => {
            if (selectedProductId && log.barang?.id !== selectedProductId) return false;
            if (!tableSearch) return true;
            const q = tableSearch.toLowerCase();
            return (
                (log.no_po && log.no_po.toLowerCase().includes(q)) ||
                (log.no_ref && log.no_ref.toLowerCase().includes(q)) ||
                (log.barang?.nama && log.barang.nama.toLowerCase().includes(q)) ||
                (log.supplier && log.supplier.toLowerCase().includes(q)) ||
                (log.tujuan && log.tujuan.toLowerCase().includes(q)) ||
                (log.gudang?.name && log.gudang.name.toLowerCase().includes(q))
            );
        });
    }, [logs, selectedProductId, tableSearch]);

    const last4Weeks = useMemo(() => {
        if (!chartData?.length) return [];
        return chartData.slice(-4);
    }, [chartData]);

    const prodQtyMap = useMemo(() => {
        const m = {};
        const now = new Date();
        const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        for (const log of logs) {
            if (log.type !== 'INBOUND') continue;
            const logDate = log.created_at ? new Date(log.created_at) : null;
            if (!logDate || logDate < sevenDaysAgo) continue;
            const bid = log.barang?.id;
            if (bid) m[bid] = (m[bid] || 0) + (log.qty || 0);
        }
        return m;
    }, [logs]);

    if (loading) return <Box p="xl" style={{ display: 'flex', justifyContent: 'center' }}><Loader size="lg" /></Box>;

    const s = stats || {};

    return (
        <Box>
            <Box style={{ background: gradientBg, borderBottom: '1px solid #dee2e6', padding: '14px 24px' }}>
                <Group justify="space-between" align="center">
                    <Group gap="sm">
                        <IconBuildingWarehouse size={28} color="#0ea5e9" />
                        <Title order={3} style={{ color: '#0c4a6e', fontWeight: 900 }}>
                            DASHBOARD MONITORING RAW MATERIALS
                        </Title>
                    </Group>
                    {selectedProductId && (
                        <Button
                            size="xs"
                            variant="light"
                            color="gray"
                            leftSection={<IconRefresh size={14} />}
                            onClick={() => setSelectedProductId(null)}
                        >
                            Reset Filter
                        </Button>
                    )}
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

                    {/* Row 1: Gauges - Last 7 Days Inbound */}
                    <Paper withBorder p="md" style={{ borderRadius: 16, background: '#fff', boxShadow: cardShadow }}>
                        <Group justify="space-between" mb="md">
                            <Group gap="sm">
                                <Box style={{ background: '#e7f5ff', borderRadius: 10, padding: 8 }}>
                                    <IconPackage size={22} color="#228be6" />
                                </Box>
                                <div>
                                    <Title order={5} style={{ color: '#2b2b2b' }}>
                                        Performa Inbound 7 Hari Terakhir
                                    </Title>
                                    <Text size="xs" c="dimmed">Klik gauge produk untuk filter chart & tabel di bawah</Text>
                                </div>
                            </Group>
                            {selectedProductId && (
                                <Badge size="lg" color="blue" variant="filled" radius="sm">
                                    Filter: {products.find((p) => p.id === selectedProductId)?.nama}
                                </Badge>
                            )}
                        </Group>
                        <Grid gutter="sm">
                            {products.map((p) => {
                                const inbound7 = prodQtyMap[p.id] || 0;
                                const maxQty = p.max_stok || 1000;
                                const pct = Math.min(100, Math.round((inbound7 / maxQty) * 100));
                                const color = p.kategori === 'Wet' ? '#fab005' : p.kategori === 'Waste' ? '#845ef7' : '#228be6';
                                return (
                                    <Grid.Col key={p.id} span={{ base: 12, sm: 6, md: 4, lg: 3 }}>
                                        <ClickableGauge
                                            pct={pct}
                                            label={p.nama}
                                            subLabel={`${inbound7.toLocaleString()} ${p.satuan || ''} / 7 hari`}
                                            color={color}
                                            active={selectedProductId === p.id}
                                            onClick={() => handleGaugeClick(p.id)}
                                        />
                                    </Grid.Col>
                                );
                            })}
                        </Grid>
                    </Paper>

                    {/* Row 2: 3D Bar Stock Chart (1 month / 4 weeks) */}
                    <Paper withBorder p="md" style={{ borderRadius: 16, background: '#fff', boxShadow: cardShadow }}>
                        <Group gap="sm" mb="md">
                            <Box style={{ background: '#fff3bf', borderRadius: 10, padding: 8 }}>
                                <IconChartBar size={22} color="#f59f00" />
                            </Box>
                            <div>
                                <Title order={5} style={{ color: '#2b2b2b' }}>Grafik Stok 1 Bulan (3D Bar)</Title>
                                <Text size="xs" c="dimmed">Tren stok mingguan per produk (4 minggu terakhir)</Text>
                            </div>
                        </Group>
                        {stockChartLoading ? (
                            <Box py="xl" ta="center"><Loader size="sm" /></Box>
                        ) : (
                            <StockBar3DChart series={stockChart?.series} dates={stockChart?.dates} />
                        )}
                    </Paper>

                    {/* Row 3: Line Chart Inbound vs Outbound (1 month / 4 weeks) */}
                    <Paper withBorder p="md" style={{ borderRadius: 16, background: '#fff', boxShadow: cardShadow }}>
                        <Group gap="sm" mb="md">
                            <Box style={{ background: '#d3f9d8', borderRadius: 10, padding: 8 }}>
                                <IconChartLine size={22} color="#2b8a3e" />
                            </Box>
                            <div>
                                <Title order={5} style={{ color: '#2b2b2b' }}>Inbound vs Outbound 1 Bulan (Line)</Title>
                                <Text size="xs" c="dimmed">Perbandingan volume mingguan (4 minggu terakhir)</Text>
                            </div>
                        </Group>
                        <InOutLineChart data={last4Weeks} />
                    </Paper>

                    {/* Row 4: Mutation Table */}
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
                            <TextInput
                                placeholder="Cari PO, Item, Supplier..."
                                size="xs"
                                value={tableSearch}
                                onChange={(e) => setTableSearch(e.target.value)}
                                style={{ width: 260 }}
                            />
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
