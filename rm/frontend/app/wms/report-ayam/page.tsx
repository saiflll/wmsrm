'use client';
import React, { useState, useEffect } from 'react';
import { Box, Paper, Group, Title, Text, Badge, Table, Loader, Stack } from '@mantine/core';
import { IconMeat, IconChartBar } from '@tabler/icons-react';
import { api, unwrap } from '../lib/api';

const cardShadow = '0 4px 20px rgba(0,0,0,0.06)';

export default function ReportAyamPage() {
    const [data, setData] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        try {
            const res = await api().get('/planning-ayam/report');
            setData(unwrap(res));
        } catch (e) {
            console.error('Report ayam load error', e);
        }
        setLoading(false);
    };

    if (loading) return <Box p="xl" style={{ display: 'flex', justifyContent: 'center' }}><Loader size="lg" /></Box>;

    // Support both data.rows and data as array
    const rows = data?.rows || (Array.isArray(data) ? data : []);

    // Compute totals
    const totalPlanning = rows.reduce((sum: number, r: any) => sum + (r.planning || 0), 0);
    const totalOutbound = rows.reduce((sum: number, r: any) => sum + (r.outbound || 0), 0);
    const overallSerapan = totalPlanning > 0 ? Math.round((totalOutbound / totalPlanning) * 100) : 0;

    return (
        <Box>
            <Box style={{ background: 'linear-gradient(135deg, #f8f9fa 0%, #f3d9fa 100%)', borderBottom: '1px solid #dee2e6', padding: '14px 24px' }}>
                <Group gap="sm">
                    <IconMeat size={28} color="#be4bdb" />
                    <Title order={3} style={{ color: '#862e9c', fontWeight: 900 }}>
                        REPORT AYAM
                    </Title>
                </Group>
            </Box>

            <Box p="md">
                {/* Summary Cards */}
                <Group gap="md" mb="md">
                    <Paper withBorder p="md" style={{ borderRadius: 12, background: '#fff', boxShadow: cardShadow, flex: 1 }}>
                        <Text size="xs" c="dimmed" fw={600}>TOTAL PLANNING</Text>
                        <Text size="xl" fw={800} c="pink">{totalPlanning.toLocaleString()} kg</Text>
                    </Paper>
                    <Paper withBorder p="md" style={{ borderRadius: 12, background: '#fff', boxShadow: cardShadow, flex: 1 }}>
                        <Text size="xs" c="dimmed" fw={600}>TOTAL OUTBOUND</Text>
                        <Text size="xl" fw={800} c="orange">{totalOutbound.toLocaleString()} kg</Text>
                    </Paper>
                    <Paper withBorder p="md" style={{ borderRadius: 12, background: '#fff', boxShadow: cardShadow, flex: 1 }}>
                        <Text size="xs" c="dimmed" fw={600}>SERAPAN RATA-RATA</Text>
                        <Text size="xl" fw={800} c={overallSerapan >= 90 ? 'green' : overallSerapan >= 70 ? 'yellow' : 'red'}>{overallSerapan}%</Text>
                    </Paper>
                </Group>

                <Paper withBorder p="md" style={{ borderRadius: 16, background: '#fff', boxShadow: cardShadow, marginBottom: 16 }}>
                    <Group gap="sm" mb="md">
                        <Box style={{ background: '#f3d9fa', borderRadius: 10, padding: 8 }}>
                            <IconChartBar size={22} color="#be4bdb" />
                        </Box>
                        <div>
                            <Title order={5} style={{ color: '#2b2b2b' }}>Planning vs Outbound Ayam</Title>
                            <Text size="xs" c="dimmed">Serapan = actual / planning × 100%</Text>
                        </div>
                    </Group>

                    <Table striped highlightOnHover>
                        <Table.Thead>
                            <Table.Tr>
                                <Table.Th>Tanggal</Table.Th>
                                <Table.Th>Planning (kg)</Table.Th>
                                <Table.Th>Outbound (kg)</Table.Th>
                                <Table.Th>Serapan (%)</Table.Th>
                                <Table.Th>Status</Table.Th>
                            </Table.Tr>
                        </Table.Thead>
                        <Table.Tbody>
                            {rows.map((row: any, i: number) => {
                                const planning = row.planning || 0;
                                const outbound = row.outbound || 0;
                                const serapan = row.serapan != null
                                    ? (typeof row.serapan === 'number' ? row.serapan : Number(row.serapan))
                                    : (planning > 0 ? Math.round((outbound / planning) * 100) : 0);
                                const tanggal = row.tanggal || row.date || '-';
                                const status = row.status || (serapan >= 90 ? 'Tercapai' : serapan >= 70 ? 'Kurang' : 'Rendah');
                                return (
                                    <Table.Tr key={i}>
                                        <Table.Td>{tanggal}</Table.Td>
                                        <Table.Td style={{ textAlign: 'right' }}>{planning.toLocaleString()}</Table.Td>
                                        <Table.Td style={{ textAlign: 'right' }}>{outbound.toLocaleString()}</Table.Td>
                                        <Table.Td>
                                            <Badge color={serapan >= 90 ? 'green' : serapan >= 70 ? 'yellow' : 'red'}>
                                                {typeof serapan === 'number' ? `${serapan.toFixed?.(1) ?? serapan}%` : `${serapan}%`}
                                            </Badge>
                                        </Table.Td>
                                        <Table.Td>{status}</Table.Td>
                                    </Table.Tr>
                                );
                            })}
                            {!rows.length && (
                                <Table.Tr>
                                    <Table.Td colSpan={5} style={{ textAlign: 'center', padding: 20 }}>
                                        <Text size="sm" c="dimmed">Belum ada data report ayam.</Text>
                                    </Table.Td>
                                </Table.Tr>
                            )}
                        </Table.Tbody>
                    </Table>
                </Paper>
            </Box>
        </Box>
    );
}
