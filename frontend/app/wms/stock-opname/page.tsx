'use client';
// @ts-nocheck
import React, { useState, useEffect } from 'react';
import { Box, Group, Button, Title, Text, Badge, Paper, Stack, TextInput, Modal, NumberInput, Loader, Divider } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import { api, unwrap, fmt } from '../lib/api';

export default function StockOpnamePage() {
    const [summary, setSummary] = useState([]);
    const [zone, setZone] = useState('DRY A');
    const [loading, setLoading] = useState(true);

    const [opened, { open, close }] = useDisclosure(false);
    const [sel, setSel] = useState(null);
    const [actualQty, setActualQty] = useState('');

    const zones = ['CS FROZEN', 'CHILL', 'DRY A', 'DRY B', 'DRY FG', 'WASTE'];

    useEffect(() => { load(); }, [zone]);

    const load = async () => {
        setLoading(true);
        try {
            const res = await api().get(`/inventory/opname/summary?zone=${zone}`);
            setSummary(unwrap(res));
        } catch (e) { console.error(e); }
        setLoading(false);
    };

    const doOpname = async () => {
        if (!sel || actualQty === '') return;
        try {
            await api().post('/inventory/opname', {
                gudang_id: sel.gudang.id,
                qty_opname: Number(actualQty),
            });
            notifications.show({ title: 'Sukses', message: `Opname ${sel.gudang.name} tersimpan`, color: 'green' });
            close();
            load();
        } catch (e: any) {
            notifications.show({ title: 'Error', message: unwrap(e.response)?.message || 'Gagal', color: 'red' });
        }
    };

    const selRack = (s) => {
        if (!s.filled) return notifications.show({ title: 'Info', message: 'Rak kosong, tidak perlu opname', color: 'blue' });
        setSel(s);
        setActualQty(s.totalQty);
        open();
    };

    // Calculate accuracy percentage
    const locsWithStock = summary.filter(s => s.filled);
    const opnamed = locsWithStock.filter(s => s.opnamed).length;
    const accuracy = locsWithStock.length ? Math.round((opnamed / locsWithStock.length) * 100) : 100;

    // Grouping by Kolom then Level
    const byKolom = {};
    summary.forEach(s => {
        const k = s.gudang.kolom || 'A';
        const lvl = s.gudang.level || 1;
        if (!byKolom[k]) byKolom[k] = {};
        if (!byKolom[k][lvl]) byKolom[k][lvl] = [];
        byKolom[k][lvl].push(s);
    });

    // sort koloms and levels
    const sortedKoloms = Object.keys(byKolom).sort();

    return (
        <Box>
            <Box style={{ background: '#fff', borderBottom: '1px solid #ddd', padding: '20px' }}>
                <Title order={4} style={{ color: '#d98b26', fontWeight: 800 }}>STOCK OPNAME</Title>

                <Group mt="md" gap="sm">
                    {zones.map(z => (
                        <Button
                            key={z}
                            radius="md"
                            size="sm"
                            style={{
                                backgroundColor: zone === z ? '#111827' : '#1f2937',
                                color: '#fff',
                                fontWeight: 700,
                                opacity: zone === z ? 1 : 0.8
                            }}
                            onClick={() => setZone(z)}
                        >
                            {z}
                        </Button>
                    ))}

                    <Box ml="auto" style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
                        <Group gap={6}>
                            <Box w={40} h={16} style={{ background: '#0ea5e9', borderRadius: 10 }}></Box>
                            <Text size="xs" fw={700}>TERISI</Text>
                        </Group>
                        <Group gap={6}>
                            <Box w={40} h={16} style={{ borderBottom: '3px solid #000', borderRadius: 10, position: 'relative' }}>
                                <Box w={40} h={16} style={{ background: '#0ea5e9', borderRadius: 10, position: 'absolute', top: -4 }}></Box>
                            </Box>
                            <Text size="xs" fw={700}>SUDAH DIOPNAME</Text>
                        </Group>
                        <Group gap={6}>
                            <Box w={40} h={16} style={{ background: '#e5e7eb', borderRadius: 10 }}></Box>
                            <Text size="xs" fw={700}>KOSONG</Text>
                        </Group>
                    </Box>
                </Group>
            </Box>

            <Box p="xl">
                <Group justify="space-between" align="flex-end" mb="xl">
                    <Group gap="xs">
                        <TextInput placeholder="Cari berdasarkan ID, Kod..." size="xs" radius="md" style={{ width: 220 }} leftSection="🔍" />
                        <Text size="xs" fw={600} ml="md">dari</Text>
                        <TextInput type="date" size="xs" radius="md" />
                        <Text size="xs" fw={600}>sampai</Text>
                        <TextInput type="date" size="xs" radius="md" />
                        <Button size="xs" color="blue" radius="md">Filter</Button>
                        <Button size="xs" color="gray" variant="outline" radius="md">Reset</Button>
                    </Group>

                    <Box style={{ textAlign: 'right' }}>
                        <Text fw={800} size="md" mb={4}>Stock Akurasi : {accuracy} %</Text>
                        <Group gap="xs">
                            <Button size="xs" color="red" radius="md">🖨 Print PDF</Button>
                            <Button size="xs" color="green" radius="md">📊 Export Excel</Button>
                        </Group>
                    </Box>
                </Group>

                {loading ? <Loader /> : (
                    <Box>
                        {sortedKoloms.map(k => {
                            const levelsMap = byKolom[k];
                            const sortedLevels = Object.keys(levelsMap).sort((a, b) => Number(a) - Number(b));

                            return (
                                <Box key={k} mb="xl">
                                    <Group gap="xl" mb="md" mt="md">
                                        <Text fw={800} size="sm">LEVEL</Text>
                                        <Text fw={800} size="sm">KOLOM : {k}</Text>
                                    </Group>

                                    <Stack gap="md">
                                        {sortedLevels.map(lvl => {
                                            const racks = levelsMap[lvl].sort((a, b) => a.gudang.name.localeCompare(b.gudang.name));
                                            return (
                                                <Group key={lvl} gap="xl" align="center" wrap="nowrap">
                                                    <Text fw={800} size="sm" w={60}>LEVEL {lvl}</Text>

                                                    <Group gap="xs" style={{ flexWrap: 'wrap' }}>
                                                        {racks.map(r => {
                                                            const isFilled = r.filled;
                                                            const isOpnamed = r.opnamed;

                                                            let bgColor = '#e5e7eb'; // kosog
                                                            let color = '#9ca3af'; // gray text
                                                            if (isFilled) {
                                                                bgColor = '#0ea5e9'; // terisi (blue)
                                                                color = '#fff';
                                                            }

                                                            const borderBottom = isOpnamed ? '3px solid #000' : 'none';

                                                            return (
                                                                <Button
                                                                    key={r.gudang.id}
                                                                    radius="xl"
                                                                    size="xs"
                                                                    style={{
                                                                        background: bgColor,
                                                                        color: color,
                                                                        minWidth: 60,
                                                                        height: 28,
                                                                        borderBottom: borderBottom,
                                                                        fontWeight: 700,
                                                                        padding: '0 10px'
                                                                    }}
                                                                    onClick={() => selRack(r)}
                                                                >
                                                                    {r.gudang.name}
                                                                </Button>
                                                            )
                                                        })}
                                                    </Group>
                                                </Group>
                                            )
                                        })}
                                    </Stack>
                                </Box>
                            )
                        })}
                    </Box>
                )}

                <Modal opened={opened} onClose={close} title={<Text fw={900}>STOCK OPNAME POP UP</Text>} centered size="sm" styles={{ content: { backgroundColor: '#e5e7eb', borderRadius: 12 } }}>
                    {sel && (
                        <Stack gap="sm">
                            <TextInput readOnly value={sel.gudang.name} size="sm" radius="md" styles={{ input: { backgroundColor: '#fff', color: '#000', fontWeight: 700 } }} />
                            <TextInput readOnly value={sel.stocks[0]?.barang?.nama || ''} size="sm" radius="md" styles={{ input: { backgroundColor: '#fff', color: '#000', fontSize: 13 } }} />

                            <Box mt="xs">
                                <Text size="xs" fw={700} c="dimmed" mb={2}>Tanggal Expired</Text>
                                <TextInput readOnly value={sel.stocks[0]?.expiry_date ? fmt(sel.stocks[0].expiry_date) : '-'} size="sm" radius="md" styles={{ input: { backgroundColor: '#fff' } }} />
                            </Box>

                            <Box mt="xs">
                                <Text size="xs" fw={700} c="dimmed" mb={2}>Stock Akhir (Sistem)</Text>
                                <Group gap="xs" wrap="nowrap">
                                    <TextInput readOnly value={sel.totalQty} size="sm" radius="md" style={{ flex: 1 }} styles={{ input: { backgroundColor: '#fff', fontWeight: 700, textAlign: 'center' } }} />
                                    <TextInput readOnly value={sel.stocks[0]?.satuan || '-'} size="sm" w={80} radius="md" styles={{ input: { backgroundColor: '#fff' } }} />
                                </Group>
                            </Box>

                            <Box mt="xs">
                                <Text size="xs" fw={700} c="dimmed" mb={2}>Stock Aktual Fisik</Text>
                                <Group gap="xs" wrap="nowrap">
                                    <NumberInput value={actualQty} onChange={v => setActualQty(v)} size="sm" radius="md" hideControls style={{ flex: 1 }} styles={{ input: { backgroundColor: '#fff', fontWeight: 700, textAlign: 'center' } }} />
                                    <TextInput readOnly value={sel.stocks[0]?.satuan || '-'} size="sm" w={80} radius="md" styles={{ input: { backgroundColor: '#fff' } }} />
                                </Group>
                            </Box>

                            <Text fw={800} size="sm" mt="sm">Stock Akurasi : {sel.totalQty > 0 ? Math.round((Number(actualQty) / sel.totalQty) * 100) : 100} %</Text>

                            <Button fullWidth bg="#111827" c="#fff" size="md" radius="md" mt="sm" onClick={doOpname} style={{ fontWeight: 700 }}>
                                Submit
                            </Button>
                            <Button fullWidth bg="#ef4444" c="#fff" size="md" radius="md" onClick={close} style={{ fontWeight: 700 }}>
                                Close
                            </Button>
                        </Stack>
                    )}
                </Modal>
            </Box>
        </Box>
    );
}
