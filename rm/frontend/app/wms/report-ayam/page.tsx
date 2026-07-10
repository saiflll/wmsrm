'use client';
import React, { useState, useEffect } from 'react';
import { Box, Paper, Group, Title, Text, Badge, Table, Loader } from '@mantine/core';
import { IconMeat, IconChartBar } from '@tabler/icons-react';
import { api, unwrap } from '../lib/api';

const cardShadow = '0 4px 20px rgba(0,0,0,0.06)';

export default function ReportAyamPage() {
    const [data, setData] = useState(null);
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
                            {data?.rows?.map((row, i) => {
                                const serapan = row.planning > 0 ? Math.round((row.outbound / row.planning) * 100) : 0;
                                return (
                                    <Table.Tr key={i}>
                                        <Table.Td>{row.date}</Table.Td>
                                        <Table.Td style={{ textAlign: 'right' }}>{row.planning?.toLocaleString() || 0}</Table.Td>
                                        <Table.Td style={{ textAlign: 'right' }}>{row.outbound?.toLocaleString() || 0}</Table.Td>
                                        <Table.Td>
                                            <Badge color={serapan >= 90 ? 'green' : serapan >= 70 ? 'yellow' : 'red'}>
                                                {serapan}%
                                            </Badge>
                                        </Table.Td>
                                        <Table.Td>
                                            {serapan >= 90 ? 'Tercapai' : serapan >= 70 ? 'Kurang' : 'Rendah'}
                                        </Table.Td>
                                    </Table.Tr>
                                );
                            })}
                            {!data?.rows?.length && (
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
