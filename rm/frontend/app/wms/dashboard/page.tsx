'use client';
// @ts-nocheck
import React, { useState, useEffect } from 'react';
import {
    Box, Grid, Group, Paper, Stack, Text, Title, Table, Badge, Button, Divider, Loader, TextInput, Slider
} from '@mantine/core';
import { api, unwrap, fmt } from '../lib/api';

const statCard = (label: string, val: any, color: string, sub?: string) => (
    <Paper withBorder key={label} style={{ borderLeft: `4px solid ${color}`, background: '#fff', padding: '16px 20px', borderRadius: 8, flex: 1, minWidth: 160 }}>
        <Text size="xs" c="dimmed" fw={700} style={{ textTransform: 'uppercase' }}>{label}</Text>
        <Text size="xl" fw={900} mt={4}>{val}</Text>
        {sub && <Text size="xs" c="dimmed" mt={2}>{sub}</Text>}
    </Paper>
);

const ProgressRing = ({ pct, label, subLabel, color }) => {
    const radius = 28;
    const circ = 2 * Math.PI * radius;
    const strokePct = ((100 - pct) / 100) * circ;
    return (
        <Paper withBorder p="xs" style={{ background: '#fff', borderRadius: 8 }}>
            <Group gap="sm" wrap="nowrap">
                <svg width={72} height={72} style={{ transform: 'rotate(-90deg)', flexShrink: 0 }}>
                    <circle r={radius} cx={36} cy={36} fill="transparent" stroke="#f1f3f5" strokeWidth={6} />
                    <circle r={radius} cx={36} cy={36} fill="transparent" stroke={color} strokeWidth={6} strokeDasharray={circ} strokeDashoffset={strokePct} strokeLinecap="round" />
                </svg>
                <div style={{ overflow: 'hidden' }}>
                    <Text size="xs" fw={700} truncate style={{ color: '#2b2b2b' }}>{label}</Text>
                    <Text size="xs" c="dimmed" truncate>{subLabel}</Text>
                    <Badge size="xs" color={pct > 90 ? 'red' : pct > 75 ? 'orange' : 'teal'} mt={4}>{pct}% Terisi</Badge>
                </div>
            </Group>
        </Paper>
    );
};

export default function DashboardPage() {
    const [stats, setStats] = useState<any>(null);
    const [stocks, setStocks] = useState<any[]>([]);
    const [products, setProducts] = useState<any[]>([]);
    const [chartData, setChartData] = useState<any[]>([]);
    const [logs, setLogs] = useState<any[]>([]);
    const [plans, setPlans] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [userRole, setUserRole] = useState<number>(1);
    
    // Filters and controls
    const [onlyR, setOnlyR] = useState(false);
    const [chartOffset, setChartOffset] = useState(0);
    const [tableSearch, setTableSearch] = useState("");

    useEffect(() => {
        const storedUser = localStorage.getItem('user');
        if (storedUser) {
            try {
                const u = JSON.parse(storedUser);
                if (u && u.role) setUserRole(u.role);
            } catch (e) { }
        }
        loadData();
    }, []);

    const loadData = async () => {
        try {
            const [dashRes, stockRes, chartRes, prodRes, logRes, planRes] = await Promise.all([
                api().get('/inventory/dashboard'),
                api().get('/inventory/stock'),
                api().get('/inventory/dashboard/inout-chart'),
                api().get('/barang'),
                api().get('/inventory/logs'),
                api().get('/inbound-planning'),
            ]);
            setStats(unwrap(dashRes));
            setStocks(unwrap(stockRes));
            setChartData(unwrap(chartRes));
            setProducts(unwrap(prodRes));
            setLogs(unwrap(logRes));
            setPlans(unwrap(planRes));
        } catch (e) {
            console.error('Dashboard load error', e);
        }
        setLoading(false);
    };

    if (loading) return <Box p="xl" style={{ display: 'flex', justifyContent: 'center' }}><Loader size="lg" /></Box>;

    const s = stats || {};

    // Group stocks by zones for layout table
    const dryStocks = stocks.filter((st: any) => st.barang?.side === true);
    const wetStocks = stocks.filter((st: any) => st.barang?.side === false);

    // Filter stocks based on R-column filter
    const capacityStocks = onlyR 
        ? stocks.filter((st: any) => st.gudang?.kolom?.toUpperCase() === 'R') 
        : stocks;

    // Sum qty per product
    const prodQtyMap: Record<number, number> = {};
    capacityStocks.forEach((st: any) => {
        const bid = st.barang?.id;
        if (bid) {
            prodQtyMap[bid] = (prodQtyMap[bid] || 0) + (st.qty || 0);
        }
    });

    // Inbound vs Outbound chart rendering variables
    const visibleChartWeeksCount = 12;
    const maxOffset = Math.max(0, chartData.length - visibleChartWeeksCount);
    // Bind offset to valid range
    const currentOffset = Math.min(chartOffset, maxOffset);
    const visibleChartData = chartData.slice(currentOffset, currentOffset + visibleChartWeeksCount);

    // Interactive custom SVG Line Chart calculation
    const ChartSVG = () => {
        if (!visibleChartData || visibleChartData.length === 0) {
            return (
                <div style={{ height: 160, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8f9fa' }}>
                    <Text size="xs" c="dimmed">Tidak ada data inbound/outbound bulanan.</Text>
                </div>
            );
        }

        const width = 600;
        const height = 180;
        const padding = 25;
        const chartWidth = width - padding * 2;
        const chartHeight = height - padding * 2;

        const maxVal = Math.max(
            ...visibleChartData.map((d: any) => Math.max(d.inbound, d.outbound)),
            100
        );

        const getX = (index: number) => padding + (index * (chartWidth / (visibleChartData.length - 1 || 1)));
        const getY = (val: number) => padding + chartHeight - ((val / maxVal) * chartHeight);

        // Path generators
        let inboundPath = "";
        let outboundPath = "";

        visibleChartData.forEach((d: any, i: number) => {
            const x = getX(i);
            const yIn = getY(d.inbound);
            const yOut = getY(d.outbound);

            if (i === 0) {
                inboundPath = `M ${x} ${yIn}`;
                outboundPath = `M ${x} ${yOut}`;
            } else {
                inboundPath += ` L ${x} ${yIn}`;
                outboundPath += ` L ${x} ${yOut}`;
            }
        });

        return (
            <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} style={{ overflow: 'visible' }}>
                {/* Grid lines */}
                {[0, 0.25, 0.5, 0.75, 1].map((p: number, i: number) => {
                    const y = padding + chartHeight * p;
                    const val = Math.round(maxVal * (1 - p));
                    return (
                        <g key={i}>
                            <line x1={padding} y1={y} x2={width - padding} y2={y} stroke="#e9ecef" strokeDasharray="3,3" />
                            <text x={padding - 5} y={y + 3} textAnchor="end" fontSize={8} fill="#868e96">{val}</text>
                        </g>
                    );
                })}

                {/* X labels */}
                {visibleChartData.map((d: any, i: number) => {
                    const x = getX(i);
                    const dateParts = d.week.split("-");
                    const label = dateParts.length >= 3 ? `${dateParts[2]}/${dateParts[1]}` : d.week;
                    return (
                        <g key={i}>
                            <text x={x} y={height - 5} textAnchor="middle" fontSize={8} fill="#868e96">{label}</text>
                            <line x1={x} y1={padding} x2={x} y2={padding + chartHeight} stroke="#f1f3f5" strokeWidth={1} />
                        </g>
                    );
                })}

                {/* Lines */}
                {visibleChartData.length > 1 && (
                    <>
                        <path d={inboundPath} fill="none" stroke="#2b8a3e" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
                        <path d={outboundPath} fill="none" stroke="#e03131" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
                    </>
                )}

                {/* Dots */}
                {visibleChartData.map((d: any, i: number) => {
                    const x = getX(i);
                    const yIn = getY(d.inbound);
                    const yOut = getY(d.outbound);
                    return (
                        <g key={i}>
                            <circle cx={x} cy={yIn} r={4} fill="#2b8a3e" stroke="#fff" strokeWidth={1.5} />
                            <circle cx={x} cy={yOut} r={4} fill="#e03131" stroke="#fff" strokeWidth={1.5} />
                            <text x={x} y={yIn - 6} textAnchor="middle" fontSize={8} fontWeight={700} fill="#2b8a3e">{d.inbound}</text>
                            <text x={x} y={yOut - 6} textAnchor="middle" fontSize={8} fontWeight={700} fill="#e03131">{d.outbound}</text>
                        </g>
                    );
                })}
            </svg>
        );
    };

    // Filter transaction logs for the detailed table
    const filteredLogs = logs.filter((log: any) => {
        if (!tableSearch) return true;
        const sLower = tableSearch.toLowerCase();
        return (
            (log.no_po && log.no_po.toLowerCase().includes(sLower)) ||
            (log.no_ref && log.no_ref.toLowerCase().includes(sLower)) ||
            (log.barang?.nama && log.barang.nama.toLowerCase().includes(sLower)) ||
            (log.supplier && log.supplier.toLowerCase().includes(sLower)) ||
            (log.tujuan && log.tujuan.toLowerCase().includes(sLower)) ||
            (log.gudang?.name && log.gudang.name.toLowerCase().includes(sLower))
        );
    });

    const isSupervisor = userRole === 4;
    const isSuperAdmin = userRole === 5;
    const isCheckerIB = userRole === 1;
    const isCheckerOB = userRole === 2;
    const isKoordinator = userRole === 3;
    const isReviewer = userRole === 6;
    const canViewStats = isSupervisor || isSuperAdmin || isCheckerIB || isCheckerOB || isKoordinator || isReviewer;

    let titleText = "DASHBOARD MONITORING RAW MATERIALS";

    // Format punctuality delay card
    const delayMinutes = s.avgDelay || 0;
    const delayColor = delayMinutes > 0 ? '#fa5252' : delayMinutes < 0 ? '#40c057' : '#868e96';
    const delayText = delayMinutes > 0 
        ? `Rata-rata Terlambat +${delayMinutes} Menit` 
        : delayMinutes < 0 
        ? `Rata-rata Lebih Cepat ${Math.abs(delayMinutes)} Menit` 
        : "Tepat Waktu";

    return (
        <Box>
            {/* Header banner */}
            <Box style={{ background: '#fff', borderBottom: '1px solid #ddd', padding: '12px 20px' }}>
                <Title order={3} style={{ color: '#0ea5e9', fontWeight: 900 }}>
                    {titleText}
                </Title>
            </Box>

            <Box p="md">
                {/* Alert Banners */}
                <Stack gap="xs" mb="md">
                    {s.expiredCount > 0 && (
                        <Paper withBorder p="sm" style={{ background: '#fff5f5', borderLeft: '5px solid #fa5252', borderRadius: 8 }}>
                            <Group justify="space-between">
                                <div>
                                    <Text fw={700} size="sm" color="red">⚠ TERDETEKSI BATCH EXPIRED</Text>
                                    <Text size="xs" color="dimmed">Terdapat <b>{s.expiredCount} lot/batch</b> yang telah melewati masa kedaluwarsa. Mohon segera lakukan pemindahan ke area Reject/Waste.</Text>
                                </div>
                                <Badge color="red" variant="filled">EXPIRED</Badge>
                            </Group>
                        </Paper>
                    )}
                    {s.nearExpiredCount > 0 && (
                        <Paper withBorder p="sm" style={{ background: '#fff9db', borderLeft: '5px solid #fcc419', borderRadius: 8 }}>
                            <Group justify="space-between">
                                <div>
                                    <Text fw={700} size="sm" color="yellow.9">⚠ PERINGATAN BATCH MENDEKATI EXPIRED</Text>
                                    <Text size="xs" color="dimmed">Terdapat <b>{s.nearExpiredCount} lot/batch</b> yang akan kedaluwarsa dalam <b>&lt; 30 hari</b>. Prioritaskan item ini pada rencana picking outbound berikutnya.</Text>
                                </div>
                                <Badge color="yellow" variant="filled">NEAR EXP</Badge>
                            </Group>
                        </Paper>
                    )}
                    {s.wasteCount > 0 && (
                        <Paper withBorder p="sm" style={{ background: '#f3f0ff', borderLeft: '5px solid #845ef7', borderRadius: 8 }}>
                            <Group justify="space-between">
                                <div>
                                    <Text fw={700} size="sm" color="violet">⚠ INFORMASI AREA WASTE</Text>
                                    <Text size="xs" color="dimmed">Terdapat <b>{s.wasteCount} item</b> yang berada di Zone WASTE. Lakukan proses audit berkala untuk pembuangan atau pemusnahan barang.</Text>
                                </div>
                                <Badge color="violet" variant="filled">WASTE ZONE</Badge>
                            </Group>
                        </Paper>
                    )}
                </Stack>

                {/* Primary Stat Cards */}
                {canViewStats && (
                    <Group align="stretch" gap="md" mb="md">
                        {statCard('Total SKU', s.totalSku || 0, '#ff6600', 'Master produk aktif')}
                        {statCard('Total Stok Fisik', (s.totalStock || 0).toLocaleString(), '#40c057', 'Unit Raw Materials')}
                        {statCard('Inbound Transaksi', s.inboundCount || 0, '#1c7ed6', 'Total penerimaan')}
                        {statCard('Outbound Transaksi', s.outboundCount || 0, '#f06595', 'Total pengiriman')}
                        {statCard('Picking Pending', s.pickingPendingCount || 0, '#7c3aed', 'Rencana picking pending')}
                    </Group>
                )}

                {/* Driver Planning & Punctuality KPI Section */}
                <Grid mb="md" gutter="md">
                    <Grid.Col span={{ base: 12, md: 6 }}>
                        <Paper withBorder p="md" style={{ borderRadius: 8, height: '100%', background: '#fff' }}>
                            <Title order={5} mb="md" style={{ color: '#4f46e5' }}>KPI & Ketepatan Waktu Driver Inbound</Title>
                            <Grid gutter="sm">
                                <Grid.Col span={6}>
                                    <Box p="sm" style={{ background: '#f8fafc', borderRadius: 8, borderLeft: `4px solid ${delayColor}` }}>
                                        <Text size="xs" c="dimmed" fw={700}>KPI KETEPATAN WAKTU ETA</Text>
                                        <Text size="md" fw={900} mt={4} style={{ color: delayColor }}>{delayText}</Text>
                                        <Text size="10px" c="dimmed" mt={2}>Selisih jam realisasi kedatangan terhadap jadwal estimasi PO.</Text>
                                    </Box>
                                </Grid.Col>
                                <Grid.Col span={6}>
                                    <Stack gap="xs">
                                        <Box p="xs" style={{ background: '#f8fafc', borderRadius: 6, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                          <Text size="xs" fw={700}>SCHEDULE (WAIT):</Text>
                                          <Badge color="yellow" variant="filled">{s.planWaitCount || 0}</Badge>
                                        </Box>
                                        <Box p="xs" style={{ background: '#f8fafc', borderRadius: 6, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                          <Text size="xs" fw={700}>TERLAMBAT (FAIL):</Text>
                                          <Badge color="red" variant="filled">{s.planFailCount || 0}</Badge>
                                        </Box>
                                        <Box p="xs" style={{ background: '#f8fafc', borderRadius: 6, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                          <Text size="xs" fw={700}>REALISASI (DONE):</Text>
                                          <Badge color="green" variant="filled">{s.planDoneCount || 0}</Badge>
                                        </Box>
                                    </Stack>
                                </Grid.Col>
                            </Grid>
                        </Paper>
                    </Grid.Col>

                    <Grid.Col span={{ base: 12, md: 6 }}>
                        <Paper withBorder p="md" style={{ borderRadius: 8, height: '100%', background: '#fff' }}>
                            <Title order={5} mb="sm" style={{ color: '#2b2b2b' }}>Summary Waktu Logistics (Inbound)</Title>
                            <Group align="stretch" gap="sm">
                                <Box p="sm" style={{ background: '#f8f9fa', borderRadius: 8, borderLeft: '3px solid #1c7ed6', flex: 1 }}>
                                    <Text size="xs" c="dimmed" fw={700}>AVG WAKTU TUNGGU BONGKAR</Text>
                                    <Text size="lg" fw={800} mt={4}>{s.avgWaitingTime || 0} Menit</Text>
                                    <Text size="xs" c="dimmed">Dari kedatangan driver hingga mulai bongkar.</Text>
                                </Box>
                                <Box p="sm" style={{ background: '#f8f9fa', borderRadius: 8, borderLeft: '3px solid #2b8a3e', flex: 1 }}>
                                    <Text size="xs" c="dimmed" fw={700}>AVG DURASI BONGKAR SELESAI</Text>
                                    <Text size="lg" fw={800} mt={4}>{s.avgUnloadingTime || 0} Menit</Text>
                                    <Text size="xs" c="dimmed">Durasi proses bongkar PO hingga selesai.</Text>
                                </Box>
                            </Group>
                        </Paper>
                    </Grid.Col>
                </Grid>

                {/* Recent Driver Schedules / Arrivals */}
                <Paper withBorder p="md" mb="md" style={{ borderRadius: 8 }}>
                    <Title order={5} mb="xs" style={{ color: '#2b2b2b' }}>Monitoring Realisasi Arrival Driver</Title>
                    <Text size="xs" c="dimmed" mb="md">Riwayat jadwal driver PO beserta tanggal realisasi dan selisih ketepatan waktu datang.</Text>
                    <Box style={{ overflowX: 'auto' }}>
                        <Table withTableBorder withColumnBorders style={{ fontSize: 10, minWidth: 700 }}>
                            <Table.Thead style={{ background: '#f8f9fa' }}>
                                <Table.Tr>
                                    <Table.Th>No PO</Table.Th>
                                    <Table.Th>Driver</Table.Th>
                                    <Table.Th>Plat</Table.Th>
                                    <Table.Th>Supplier</Table.Th>
                                    <Table.Th>Jadwal ETA</Table.Th>
                                    <Table.Th>Waktu Realisasi</Table.Th>
                                    <Table.Th>Selisih</Table.Th>
                                    <Table.Th>Status</Table.Th>
                                    <Table.Th>Catatan</Table.Th>
                                </Table.Tr>
                            </Table.Thead>
                            <Table.Tbody>
                                {plans.slice(0, 10).map((p: any) => {
                                    let etaStr = "-";
                                    if (p.estimasi_datang) {
                                        const d = new Date(p.estimasi_datang);
                                        etaStr = `${d.toLocaleDateString("id-ID")} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
                                    }
                                    let realStr = "-";
                                    if (p.tanggal_realisasi) {
                                        const d = new Date(p.tanggal_realisasi);
                                        realStr = `${d.toLocaleDateString("id-ID")} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
                                    }

                                    let diffBadge = null;
                                    if (p.status === "DONE" && p.selisih_menit !== null) {
                                        const diff = p.selisih_menit;
                                        diffBadge = diff > 0 
                                            ? <Badge color="red" size="xs">Terlambat +{diff}m</Badge> 
                                            : diff < 0 
                                            ? <Badge color="green" size="xs">Cepat {diff}m</Badge> 
                                            : <Badge color="teal" size="xs">Tepat Waktu</Badge>;
                                    }

                                    return (
                                        <Table.Tr key={p.id}>
                                            <Table.Td fw={700}>{p.no_po}</Table.Td>
                                            <Table.Td>{p.driver_name || "-"}</Table.Td>
                                            <Table.Td>{p.plat_nomor || "-"}</Table.Td>
                                            <Table.Td>{p.supplier || "-"}</Table.Td>
                                            <Table.Td>{etaStr}</Table.Td>
                                            <Table.Td>{realStr}</Table.Td>
                                            <Table.Td>{diffBadge || "-"}</Table.Td>
                                            <Table.Td>
                                                <Badge color={p.status === "DONE" ? "green" : p.status === "FAIL" ? "red" : "yellow"} variant="filled" size="xs">
                                                    {p.status}
                                                </Badge>
                                            </Table.Td>
                                            <Table.Td>{p.note || "-"}</Table.Td>
                                        </Table.Tr>
                                    );
                                })}
                                {plans.length === 0 && (
                                    <Table.Tr>
                                        <Table.Td colSpan={9} align="center">
                                            <Text size="xs" c="dimmed">Tidak ada data jadwal realisasi driver.</Text>
                                        </Table.Td>
                                    </Table.Tr>
                                )}
                            </Table.Tbody>
                        </Table>
                    </Box>
                </Paper>

                {/* Product Capacity Daily Gauges */}
                <Paper withBorder p="md" mb="md" style={{ borderRadius: 8 }}>
                    <Group justify="space-between" mb="md">
                        <div>
                            <Title order={5} style={{ color: '#2b2b2b' }}>Kapasitas per Produk (Harian)</Title>
                            <Text size="xs" c="dimmed">Visualisasi persentase keterisian produk terhadap kapasitas maksimal</Text>
                        </div>
                        <Button 
                            size="xs" 
                            variant={onlyR ? 'filled' : 'outline'} 
                            color={onlyR ? 'teal' : 'gray'} 
                            onClick={() => setOnlyR(!onlyR)}
                            style={{ fontWeight: 700 }}
                        >
                            {onlyR ? '✓ Hanya Kolom R' : 'Filter Kolom R'}
                        </Button>
                    </Group>
                    <Grid gutter="sm">
                        {products.map((p: any) => {
                            const curQty = prodQtyMap[p.id] || 0;
                            const maxQty = p.max_stok || 1000;
                            const pct = Math.min(100, Math.round((curQty / maxQty) * 100));
                            const color = p.kategori === 'Wet' ? '#fcc419' : p.kategori === 'Waste' ? '#845ef7' : '#1c7ed6';

                            return (
                                <Grid.Col key={p.id} span={{ base: 12, sm: 6, md: 4, lg: 3 }}>
                                    <ProgressRing 
                                        pct={pct} 
                                        label={p.nama} 
                                        subLabel={`${curQty} / ${maxQty} ${p.satuan}`}
                                        color={color}
                                    />
                                </Grid.Col>
                            );
                        })}
                    </Grid>
                </Paper>

                {/* Weekly Inbound vs Outbound Line Chart */}
                <Paper withBorder p="md" mb="md" style={{ borderRadius: 8 }}>
                    <Title order={5} mb="xs" style={{ color: '#2b2b2b' }}>Grafik Inbound vs Outbound Bulanan (Week)</Title>
                    <Text size="xs" c="dimmed" mb="md">Tinjauan volume transaksi penerimaan (hijau) dan pengiriman (merah) dalam periode 1 tahun.</Text>
                    
                    <Box style={{ background: '#fff', padding: '10px 0' }}>
                        <ChartSVG />
                    </Box>

                    {maxOffset > 0 && (
                        <Box mt="md" px="md">
                            <Group justify="space-between" mb={6}>
                                <Text size="xs" c="dimmed">Geser Timeline Tahun ini (Offset Minggu):</Text>
                                <Text size="xs" fw={700} c="blue">Geser Grafik</Text>
                            </Group>
                            <Slider 
                                min={0} 
                                max={maxOffset} 
                                step={1} 
                                value={chartOffset} 
                                onChange={setChartOffset} 
                                label={(val) => `Minggu ke-${val}`}
                            />
                        </Box>
                    )}
                </Paper>

                {/* Detailed Logs Table */}
                <Paper withBorder p="md" style={{ borderRadius: 8 }}>
                    <Group justify="space-between" mb="sm">
                        <Title order={5} style={{ color: '#2b2b2b' }}>Tabel Riwayat Lengkap Mutasi</Title>
                        <TextInput 
                            placeholder="Cari PO, Item, Supplier, Rak..." 
                            size="xs" 
                            value={tableSearch} 
                            onChange={(e) => setTableSearch(e.target.value)} 
                            style={{ width: 300 }}
                        />
                    </Group>
                    <Box style={{ overflowX: 'auto' }}>
                        <Table withTableBorder withColumnBorders style={{ fontSize: 11, minWidth: 900 }}>
                            <Table.Thead style={{ background: '#1a1a1a' }}>
                                <Table.Tr>
                                    {[
                                        'Tipe', 'No PO/Ref', 'Item', 'Qty', 'Satuan', 'Batch No', 'Expired', 'Rak/Lokasi', 'Tgl Transaksi', 'Jam Datang', 'Jam Bongkar', 'Jam Selesai', 'Supplier/Tujuan', 'Keterangan'
                                    ].map((h) => (
                                        <Table.Th key={h} style={{ color: '#fff', fontSize: 11 }}>{h}</Table.Th>
                                    ))}
                                </Table.Tr>
                            </Table.Thead>
                            <Table.Tbody>
                                {filteredLogs.slice(0, 100).map((log: any) => {
                                    const typeColor = log.type === 'INBOUND' ? 'green' : log.type === 'OUTBOUND' ? 'red' : 'blue';
                                    return (
                                        <Table.Tr key={log.id}>
                                            <Table.Td><Badge size="xs" color={typeColor} variant="light">{log.type}</Badge></Table.Td>
                                            <Table.Td fw={700}>{log.no_po || log.no_ref || '-'}</Table.Td>
                                            <Table.Td fw={600}>{log.barang?.nama || '-'}</Table.Td>
                                            <Table.Td ta="right">{log.qty}</Table.Td>
                                            <Table.Td>{log.satuan || '-'}</Table.Td>
                                            <Table.Td>{log.batch_no || '-'}</Table.Td>
                                            <Table.Td>{log.expiry_date ? new Date(log.expiry_date).toISOString().split('T')[0] : '-'}</Table.Td>
                                            <Table.Td>
                                                <Badge size="xs" color="gray">{log.gudang?.name || '-'}</Badge>
                                                {log.gudang_tujuan && <> ➔ <Badge size="xs" color="teal">{log.gudang_tujuan.name}</Badge></>}
                                            </Table.Td>
                                            <Table.Td>{log.tanggal_income || fmt(log.created_at)}</Table.Td>
                                            <Table.Td>{log.jam_datang || '-'}</Table.Td>
                                            <Table.Td>{log.jam_bongkar || '-'}</Table.Td>
                                            <Table.Td>{log.jam_selesai || '-'}</Table.Td>
                                            <Table.Td>{log.supplier || log.tujuan || '-'}</Table.Td>
                                            <Table.Td>{log.note || '-'}</Table.Td>
                                        </Table.Tr>
                                    );
                                })}
                            </Table.Tbody>
                        </Table>
                    </Box>
                </Paper>

                {/* Legacy warehouse zone tables displaying dry/wet stocks */}
                <Group align="flex-start" gap="md" mt="md">
                    <Paper withBorder p="sm" style={{ flex: 1 }}>
                        <Text fw={700} size="sm" mb="xs">STOK GUDANG DRY</Text>
                        <Table withColumnBorders withTableBorder style={{ fontSize: 11 }}>
                            <Table.Thead style={{ background: '#1a1a1a' }}>
                                <Table.Tr>
                                    {['Item', 'Lokasi', 'Qty', 'Batch', 'Status'].map((h: any) => (
                                        <Table.Th key={h} style={{ color: '#fff', fontSize: 11 }}>{h}</Table.Th>
                                    ))}
                                </Table.Tr>
                            </Table.Thead>
                            <Table.Tbody>
                                {dryStocks.slice(0, 10).map((r: any) => {
                                    const exp = r.expiry_date;
                                    const isNear = exp && (new Date(exp).getTime() - Date.now()) / 86400000 < 30;
                                    const isExp = exp && new Date(exp).getTime() < Date.now();
                                    const st = isExp ? 'EXPIRED' : isNear ? 'NEAR EXP' : 'SAFE';
                                    const sc = isExp ? 'red' : isNear ? 'orange' : 'green';
                                    return (
                                        <Table.Tr key={r.id}>
                                            <Table.Td fw={600}>{r.barang?.nama || '-'}</Table.Td>
                                            <Table.Td>{r.gudang?.name || '-'}</Table.Td>
                                            <Table.Td ta="right">{r.qty} {r.satuan}</Table.Td>
                                            <Table.Td>{r.batch_no || '-'}</Table.Td>
                                            <Table.Td><Badge size="xs" color={sc}>{st}</Badge></Table.Td>
                                        </Table.Tr>
                                    );
                                })}
                            </Table.Tbody>
                        </Table>
                    </Paper>

                    <Paper withBorder p="sm" style={{ flex: 1 }}>
                        <Text fw={700} size="sm" mb="xs">STOK GUDANG WET</Text>
                        <Table withColumnBorders withTableBorder style={{ fontSize: 11 }}>
                            <Table.Thead style={{ background: '#1a1a1a' }}>
                                <Table.Tr>
                                    {['Item', 'Lokasi', 'Qty', 'Batch', 'Status'].map((h: any) => (
                                        <Table.Th key={h} style={{ color: '#fff', fontSize: 11 }}>{h}</Table.Th>
                                    ))}
                                </Table.Tr>
                            </Table.Thead>
                            <Table.Tbody>
                                {wetStocks.slice(0, 10).map((r: any) => {
                                    const exp = r.expiry_date;
                                    const isNear = exp && (new Date(exp).getTime() - Date.now()) / 86400000 < 30;
                                    const isExp = exp && new Date(exp).getTime() < Date.now();
                                    const st = isExp ? 'EXPIRED' : isNear ? 'NEAR EXP' : 'SAFE';
                                    const sc = isExp ? 'red' : isNear ? 'orange' : 'green';
                                    return (
                                        <Table.Tr key={r.id}>
                                            <Table.Td fw={600}>{r.barang?.nama || '-'}</Table.Td>
                                            <Table.Td>{r.gudang?.name || '-'}</Table.Td>
                                            <Table.Td ta="right">{r.qty} {r.satuan}</Table.Td>
                                            <Table.Td>{r.batch_no || '-'}</Table.Td>
                                            <Table.Td><Badge size="xs" color={sc}>{st}</Badge></Table.Td>
                                        </Table.Tr>
                                    );
                                })}
                            </Table.Tbody>
                        </Table>
                    </Paper>
                </Group>
            </Box>
        </Box>
    );
}
