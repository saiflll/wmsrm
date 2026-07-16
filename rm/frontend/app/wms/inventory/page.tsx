'use client';
// @ts-nocheck
import React, { useState, useEffect } from 'react';
import { Box, Group, Button, Title, Text, Table, Badge, Loader, TextInput, Paper, ScrollArea } from '@mantine/core';
import { api, unwrap, fmt } from '../lib/api';

export default function InventoryPage() {
    const [side, setSide] = useState(true);
    const [data, setData] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');

    useEffect(() => { load(); }, [side]);

    const load = async () => {
        setLoading(true);
        try {
            const res = await api().get(`/inventory/matrix?side=${side}`);
            setData(unwrap(res));
        } catch (e) { console.error(e); }
        setLoading(false);
    };

    const allDates = [...new Set(data.flatMap((d: any) => Object.keys(d.daily || {})))].sort();
    const filtered = search ? data.filter((d: any) => d.nama?.toLowerCase().includes(search.toLowerCase())) : data;

    return (
        <Box p="md" bg="#fff" style={{ minHeight: '100vh' }}>
            <Title order={3} mb="xl" style={{ color: '#059669', fontWeight: 900 }}>INVENTORY DATA</Title>

            <Group justify="space-between" align="flex-end" mb="xl">
                <Group gap="xs">
                    <Button
                        radius="md"
                        size="md"
                        style={{ width: 180, background: !side ? '#0ea5e9' : '#e5e7eb', color: !side ? '#fff' : '#000', fontWeight: 800, fontSize: 13 }}
                        onClick={() => setSide(false)}
                    >
                        ITEM WET
                    </Button>
                    <Button
                        radius="md"
                        size="md"
                        style={{ width: 180, background: side ? '#0ea5e9' : '#e5e7eb', color: side ? '#fff' : '#000', fontWeight: 800, fontSize: 13 }}
                        onClick={() => setSide(true)}
                    >
                        ITEM DRY
                    </Button>
                </Group>
                <Group gap="xs">
                    <TextInput placeholder="Cari berdasarkan ID, kode" size="sm" radius="md" style={{ width: 220 }} leftSection="🔍" value={search} onChange={(e: any) => setSearch(e.target.value)} />
                    <Text size="xs" fw={600} ml="xs">Dari</Text>
                    <TextInput type="date" size="sm" radius="md" />
                    <Text size="xs" fw={600}>Sampai</Text>
                    <TextInput type="date" size="sm" radius="md" />
                    <Button size="sm" color="blue" radius="md">Filter</Button>
                    <Button size="sm" color="gray" variant="outline" radius="md" onClick={() => setSearch('')}>Reset</Button>
                </Group>
            </Group>

            {loading ? <Loader /> : (
                <ScrollArea type="always" offsetScrollbars>
                    <Box style={{ minWidth: 900, paddingBottom: 20 }}>
                        <Table withTableBorder withColumnBorders style={{ fontSize: 11 }}>
                            <Table.Thead style={{ background: '#fff' }}>
                                <Table.Tr>
                                    <Table.Th rowSpan={2} style={{ position: 'sticky', left: 0, background: '#fff', zIndex: 2, borderBottom: '2px solid #10b981', minWidth: 200, verticalAlign: 'middle', textAlign: 'center' }}>Nama Item</Table.Th>
                                    <Table.Th rowSpan={2} style={{ background: '#10b981', color: '#fff', borderBottom: '2px solid #059669', textAlign: 'center', verticalAlign: 'middle' }}>SATUAN</Table.Th>
                                    <Table.Th rowSpan={2} style={{ background: '#fff', borderBottom: '2px solid #10b981' }}></Table.Th>
                                    <Table.Th rowSpan={2} style={{ background: '#fff', borderBottom: '2px solid #10b981', textAlign: 'center', verticalAlign: 'middle', whiteSpace: 'nowrap' }}>TOTAL STOK</Table.Th>
                                    {allDates.map((dt: string) => (
                                        <Table.Th key={dt} colSpan={3} style={{ background: '#fff', textAlign: 'center', borderLeft: '2px solid #555', borderBottom: '1px solid #ddd', fontSize: 12 }}>{fmt(dt).split(' ')[0]}</Table.Th>
                                    ))}
                                </Table.Tr>
                                {allDates.length > 0 && (
                                    <Table.Tr>
                                        {allDates.map((dt: string) => (
                                            <React.Fragment key={dt}>
                                                <Table.Th style={{ textAlign: 'center', background: '#fff', borderLeft: '2px solid #555' }}>1</Table.Th>
                                                <Table.Th style={{ textAlign: 'center', background: '#fff', borderLeft: '1px solid #ddd' }}>2</Table.Th>
                                                <Table.Th style={{ textAlign: 'center', background: '#fff', borderLeft: '1px solid #ddd' }}>3</Table.Th>
                                            </React.Fragment>
                                        ))}
                                    </Table.Tr>
                                )}
                            </Table.Thead>
                            <Table.Tbody>
                                {filtered.length === 0 ? <Table.Tr><Table.Td colSpan={50} ta="center" c="dimmed">Tidak ada data</Table.Td></Table.Tr> : filtered.map((item: any) => {
                                    // To calculate running balance correctly for the view:
                                    // We start currentBal from the REAL-TIME total stock and subtract backwards
                                    // if we wanted a historical flow, but user wants 'Saldo Awal' to be 'Total Stock'.
                                    // If we interpret 'Saldo Awal' as 'Current Total', then the daily stock row 
                                    // should show the state at that point.
                                    
                                    // Logic: Find total IN/OUT for ALL dates in the view
                                    let totalInInView = 0;
                                    let totalOutInView = 0;
                                    filtered.forEach(it => {
                                        if(it.id === item.id) {
                                            Object.values(it.daily || {}).forEach((day: any) => {
                                                Object.values(day).forEach((sh: any) => {
                                                    totalInInView += (sh.in || 0);
                                                    totalOutInView += (sh.out || 0);
                                                });
                                            });
                                        }
                                    });

                                    // Starting balance for the VERY FIRST cell in this view
                                    let runningStock = (item.saldoAwal || 0) - totalInInView + totalOutInView;

                                    const tdIn: any[] = [];
                                    const tdOut: any[] = [];
                                    const tdStock: any[] = [];

                                    allDates.forEach(dt => {
                                        ['1', '2', '3'].forEach((sh, shIdx) => {
                                            const inQty = item.daily?.[dt]?.[sh]?.in || 0;
                                            const outQty = item.daily?.[dt]?.[sh]?.out || 0;
                                            runningStock = runningStock + inQty - outQty;

                                            const cellStyle = { borderLeft: shIdx === 0 ? '2px solid #555' : '1px solid #ddd' };
                                            tdIn.push(<Table.Td key={`in-${dt}-${sh}`} ta="right" bg="#fff" style={cellStyle}>{inQty || 0}</Table.Td>);
                                            tdOut.push(<Table.Td key={`out-${dt}-${sh}`} ta="right" bg="#fff" style={cellStyle}>{outQty || 0}</Table.Td>);
                                            tdStock.push(<Table.Td key={`stk-${dt}-${sh}`} ta="right" bg="#fef08a" fw={700} c={runningStock < 0 ? 'red' : 'inherit'} style={cellStyle}>{runningStock}</Table.Td>);
                                        });
                                    });

                                    return (
                                        <React.Fragment key={item.id}>
                                            <Table.Tr>
                                                <Table.Td rowSpan={3} style={{ position: 'sticky', left: 0, background: '#fff', zIndex: 1, borderRight: '1px solid #ddd', fontWeight: 600, verticalAlign: 'top', paddingTop: 8 }}>
                                                    {item.nama}
                                                </Table.Td>
                                                <Table.Td rowSpan={3} align="center" style={{ verticalAlign: 'top', paddingTop: 8 }}>{item.satuan}</Table.Td>
                                                <Table.Td style={{ background: '#f8f9fa' }}>in</Table.Td>
                                                <Table.Td rowSpan={3} ta="right" bg="#fff" fw={700} style={{ verticalAlign: 'top', paddingTop: 8 }}>{item.saldoAwal}</Table.Td>
                                                {tdIn}
                                            </Table.Tr>
                                            <Table.Tr>
                                                <Table.Td style={{ background: '#f8f9fa' }}>out</Table.Td>
                                                {tdOut}
                                            </Table.Tr>
                                            <Table.Tr>
                                                <Table.Td fw={700} style={{ background: '#f8f9fa' }}>stock</Table.Td>
                                                {tdStock}
                                            </Table.Tr>
                                        </React.Fragment>
                                    );
                                })}
                            </Table.Tbody>
                        </Table>
                    </Box>
                </ScrollArea>
            )}
        </Box>
    );
}
