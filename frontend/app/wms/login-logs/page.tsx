'use client';
import React, { useState, useEffect } from 'react';
import {
    Box, Button, Group, Paper, Table, Text, Title, Badge, Loader, Pagination
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { fetchLoginLogs } from '../lib/api';

export default function LoginLogsPage() {
    const [logs, setLogs] = useState<any[]>([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
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

    return (
        <Box p="md">
            <Group justify="space-between" mb="lg">
                <Title order={3}>Riwayat Login</Title>
                <Button variant="light" onClick={() => loadLogs(page)}>Refresh</Button>
            </Group>

            <Paper withBorder>
                {loading ? <Loader mt="xl" mb="xl" /> : (
                    <>
                        <Table striped highlightOnHover>
                            <Table.Thead>
                                <Table.Tr>
                                    <Table.Th>Waktu</Table.Th>
                                    <Table.Th>Username</Table.Th>
                                    <Table.Th>IP</Table.Th>
                                    <Table.Th>User Agent</Table.Th>
                                    <Table.Th>Status</Table.Th>
                                </Table.Tr>
                            </Table.Thead>
                            <Table.Tbody>
                                {logs.map((log: any) => (
                                    <Table.Tr key={log.id}>
                                        <Table.Td>{log.loginAt ? new Date(log.loginAt).toLocaleString('id-ID') : '-'}</Table.Td>
                                        <Table.Td>{log.username || '-'}</Table.Td>
                                        <Table.Td>{log.ip || '-'}</Table.Td>
                                        <Table.Td style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{log.userAgent || '-'}</Table.Td>
                                        <Table.Td>
                                            <Badge color={log.success ? 'green' : 'red'}>
                                                {log.success ? 'Berhasil' : 'Gagal'}
                                            </Badge>
                                        </Table.Td>
                                    </Table.Tr>
                                ))}
                                {logs.length === 0 && (
                                    <Table.Tr>
                                        <Table.Td colSpan={5}><Text c="dimmed" ta="center">Belum ada data login</Text></Table.Td>
                                    </Table.Tr>
                                )}
                            </Table.Tbody>
                        </Table>
                        {totalPages > 1 && (
                            <Group justify="center" p="md">
                                <Pagination total={totalPages} value={page} onChange={setPage} />
                            </Group>
                        )}
                    </>
                )}
            </Paper>
        </Box>
    );
}
