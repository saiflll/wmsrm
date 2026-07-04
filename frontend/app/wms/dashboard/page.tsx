'use client';
// @ts-nocheck
import React, { useState, useEffect } from 'react';
import {
    Box, Grid, Group, Paper, Stack, Text, Title, Table, Badge, Button, Divider, Loader
} from '@mantine/core';
import { api, unwrap } from '../lib/api';

const statCard = (label: string, val: any, color: string, sub?: string) => (
    <Box key={label} style={{ borderBottom: `3px solid ${color}`, background: '#fff', padding: '16px 20px', borderRadius: 0 }}>
        <Text size="sm" c="dimmed">{label}</Text>
        <Text size="xl" fw={900}>{val}</Text>
        {sub && <Text size="xs" c="dimmed">{sub}</Text>}
    </Box>
);

export default function DashboardPage() {
    const [stats, setStats] = useState<any>(null);
    const [stocks, setStocks] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [userRole, setUserRole] = useState<number>(1);

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
            const [dashRes, stockRes] = await Promise.all([
                api().get('/inventory/dashboard'),
                api().get('/inventory/stock'),
            ]);
            setStats(unwrap(dashRes));
            setStocks(unwrap(stockRes));
        } catch (e) {
            console.error('Dashboard load error', e);
        }
        setLoading(false);
    };

    if (loading) return <Box p="xl"><Loader size="lg" /></Box>;

    const s = stats || {};

    // Group stocks by zone
    const dryStocks = stocks.filter((s: any) => s.barang?.side === true);
    const wetStocks = stocks.filter((s: any) => s.barang?.side === false);

    const TblSection = ({ title, rows }: any) => (
        <Paper withBorder p="sm" style={{ flex: 1 }}>
            <Text fw={700} size="sm" mb="xs">{title}</Text>
            <Table withColumnBorders withTableBorder style={{ fontSize: 11 }}>
                <Table.Thead style={{ background: '#1a1a1a' }}>
                    <Table.Tr>
                        {['Item', 'Lokasi', 'Qty', 'Batch', 'Status'].map((h: any) => (
                            <Table.Th key={h} style={{ color: '#fff', fontSize: 11 }}>{h}</Table.Th>
                        ))}
                    </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                    {rows.slice(0, 10).map((r: any) => {
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
    );

    // Simple SVG bar chart
    const BarChart = ({ data }: any) => {
        const max = Math.max(...data.map((v: any) => v.val), 1);
        return (
            <svg width="100%" height={120} viewBox="0 0 500 120">
                {data.map((v: any, i: number) => {
                    const bw = 500 / data.length - 6;
                    const x = i * (bw + 6) + 3;
                    const h = (v.val / max) * 90;
                    return (
                        <g key={i}>
                            <rect x={x} y={100 - h} width={bw} height={h} fill={v.color || '#4dabf7'} rx={3} />
                            <text x={x + bw / 2} y={115} textAnchor="middle" fontSize={8} fill="#666">{v.label}</text>
                            <text x={x + bw / 2} y={96 - h} textAnchor="middle" fontSize={8} fill="#333">{v.val}</text>
                        </g>
                    );
                })}
            </svg>
        );
    };

    const roleLabels: Record<number, string> = {
        1: 'CHECKER IB - INBOUND & INVENTORY',
        2: 'CHECKER OB - OUTBOUND & INVENTORY',
        3: 'KOORDINATOR - OPERASIONAL GUDANG',
        4: 'SUPERVISOR - SYSTEM MONITORING',
        5: 'SUPER ADMIN - FULL SYSTEM ACCESS',
    };

    const isSupervisor = userRole === 4;
    const isSuperAdmin = userRole === 5;
    const isCheckerIB = userRole === 1;
    const isCheckerOB = userRole === 2;
    const isKoordinator = userRole === 3;
    const canViewStats = isSupervisor || isSuperAdmin || isCheckerIB || isCheckerOB || isKoordinator;

    let titleText = roleLabels[userRole] || "MONITORING STOCK REALTIME";

    return (
        <Box>
            <Box style={{ background: '#fff', borderBottom: '1px solid #ddd', padding: '12px 20px' }}>
                <Title order={3} style={{ color: isSuperAdmin ? '#e60000' : isSupervisor ? '#d9480f' : '#e6921e', fontWeight: 900 }}>
                    {titleText}
                </Title>
            </Box>

            <Box p="md">
                {isSuperAdmin && (
                    <Paper withBorder p="sm" mb="md" style={{ background: '#fff5f5', borderLeft: '4px solid #fa5252' }}>
                        <Group justify="space-between">
                            <Box>
                                <Text fw={700} color="red">System Health & Alert</Text>
                                <Text size="sm" color="dimmed">Status sistem berjalan normal. Tidak ada error log pada WMS.</Text>
                            </Box>
                            <Button color="red" variant="light" onClick={() => window.location.href = '/wms/users'}>Manage Users</Button>
                        </Group>
                    </Paper>
                )}

                {/* Stat cards */}
                {canViewStats && (
                    <Grid mb="md" gutter="md" columns={5}>
                        <Grid.Col span={1}>{statCard('Total SKU', s.totalSku || 0, '#ff6600')}</Grid.Col>
                        <Grid.Col span={1}>{statCard('Total Stok', s.totalStock || 0, '#40c057')}</Grid.Col>
                        <Grid.Col span={1}>{statCard('Transaksi Inbound', s.inboundCount || 0, '#1c7ed6')}</Grid.Col>
                        <Grid.Col span={1}>{statCard('Transaksi Outbound', s.outboundCount || 0, '#f06595')}</Grid.Col>
                        <Grid.Col span={1}>{statCard('Picking Pending', s.pickingPendingCount || 0, '#7c3aed')}</Grid.Col>
                    </Grid>
                )}

                {/* Utilization */}
                {canViewStats && (
                    <Paper withBorder p="sm" mb="md">
                        <Group justify="space-between" mb="xs">
                            <Text fw={700}>Utilisasi Gudang</Text>
                            <Badge color="blue" variant="light">{s.utilization || 0}% terisi ({s.filledSlots || 0}/{s.totalSlots || 0} slot)</Badge>
                        </Group>
                        <BarChart data={[
                            { label: 'Filled', val: s.filledSlots || 0, color: '#4dabf7' },
                            { label: 'Empty', val: (s.totalSlots || 0) - (s.filledSlots || 0), color: '#dee2e6' },
                            { label: 'Inbound', val: s.inboundCount || 0, color: '#40c057' },
                            { label: 'Outbound', val: s.outboundCount || 0, color: '#f06595' },
                        ]} />
                    </Paper>
                )}

                {/* Stock tables - Visible to all */}

                <Group align="flex-start" gap="md">
                    <TblSection title="STOK GUDANG DRY" rows={dryStocks} />
                    <TblSection title="STOK GUDANG WET" rows={wetStocks} />
                </Group>
            </Box>
        </Box>
    );
}
