'use client';
import React, { useState, useEffect } from 'react';
import {
    Box, Button, Group, Paper, Table, Text, Title, Badge, Loader, Pagination, TextInput, ActionIcon, Tooltip
} from '@mantine/core';
import { IconHistory, IconRefresh, IconSearch } from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import { fetchLoginLogs } from '../lib/api';

export default function LoginLogsPage() {
    const [logs, setLogs] = useState<any[]>([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [search, setSearch] = useState('');
    const [loading, setLoading] = useState(true);
    const limit = 50;

    const loadLogs = async (p: number) => {
        setLoading(true);
        try {
            const data = await fetchLoginLogs(p, limit);
            setLogs(Array.isArray(data.logs) ? data.logs : []);
            setTotal(data.total || 0);
        } catch (e: any) {
            notifications.show({ title: 'Error', message: 'Gagal memuat login logs', color: 'red' });
            setLogs([]);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { loadLogs(page); }, [page]);

    const totalPages = Math.ceil(total / limit);

    const filtered = search
        ? logs.filter((log: any) =>
            log.username?.toLowerCase().includes(search.toLowerCase()) ||
            log.ip?.toLowerCase().includes(search.toLowerCase())
        )
        : logs;

    return (
        <Box>
            <Box style={{ background: '#fff', borderLeft: '4px solid #4c6ef5', padding: '14px 20px', marginBottom: 16, boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}>
                <Group justify="space-between">
                    <Title order={4} style={{ color: '#111827', fontWeight: 800, display: "flex", alignItems: "center", gap: 8 }}>
                        <IconHistory size={20} style={{ color: '#4c6ef5' }} />
                        RIWAYAT LOGIN USER
                    </Title>
                    <Button size="xs" variant="outline" color="indigo" leftSection={<IconRefresh size={14} />} onClick={() => loadLogs(page)}>Refresh</Button>
                </Group>
            </Box>

            <Box p="md">
                <Paper withBorder p="md" radius="md" style={{ background: '#fff' }}>
                    <Group justify="space-between" mb="sm">
                        <TextInput
                            placeholder="Cari username, IP..."
                            size="xs"
                            leftSection={<IconSearch size={14} />}
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            style={{ width: 220 }}
                        />
                        <Badge color="indigo" variant="light">Total Logs: {total}</Badge>
                    </Group>

                    {loading ? <Loader /> : (
                        <Box style={{ overflowX: "auto" }}>
                            <Table withTableBorder withColumnBorders style={{ fontSize: 11 }}>
                                <Table.Thead style={{ background: "#edf2ff", borderBottom: "2px solid #bac8ff" }}>
                                    <Table.Tr>
                                        <Table.Th style={{ color: '#364fc7', fontSize: 11 }}>Waktu Login</Table.Th>
                                        <Table.Th style={{ color: '#364fc7', fontSize: 11 }}>Username</Table.Th>
                                        <Table.Th style={{ color: '#364fc7', fontSize: 11 }}>IP Address</Table.Th>
                                        <Table.Th style={{ color: '#364fc7', fontSize: 11 }}>User Agent</Table.Th>
                                        <Table.Th style={{ color: '#364fc7', fontSize: 11, textAlign: 'center' }}>Status</Table.Th>
                                    </Table.Tr>
                                </Table.Thead>
                                <Table.Tbody>
                                    {filtered.map((log: any) => (
                                        <Table.Tr key={log.id}>
                                            <Table.Td fw={600}>{log.loginAt ? new Date(log.loginAt).toLocaleString('id-ID') : '-'}</Table.Td>
                                            <Table.Td fw={700}>{log.username || '-'}</Table.Td>
                                            <Table.Td>{log.ip || '-'}</Table.Td>
                                            <Table.Td style={{ maxWidth: 280, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{log.userAgent || '-'}</Table.Td>
                                            <Table.Td ta="center">
                                                <Badge size="xs" color={log.success ? 'green' : 'red'}>
                                                    {log.success ? 'Berhasil' : 'Gagal'}
                                                </Badge>
                                            </Table.Td>
                                        </Table.Tr>
                                    ))}
                                    {filtered.length === 0 && (
                                        <Table.Tr>
                                            <Table.Td colSpan={5} ta="center" c="dimmed">Belum ada riwayat login</Table.Td>
                                        </Table.Tr>
                                    )}
                                </Table.Tbody>
                            </Table>
                            {totalPages > 1 && (
                                <Group justify="center" mt="md">
                                    <Pagination size="xs" total={totalPages} value={page} onChange={setPage} color="indigo" />
                                </Group>
                            )}
                        </Box>
                    )}
                </Paper>
            </Box>
        </Box>
    );
}
