'use client';
import React, { useEffect } from 'react';
import { AppShell, Burger, Group, NavLink, Title, Text, Button } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { usePathname, useRouter } from 'next/navigation';

export default function WMSLayout({ children }: { children: React.ReactNode }) {
    const [opened, { toggle }] = useDisclosure();
    const pathname = usePathname();
    const router = useRouter();

    useEffect(() => {
        if (!localStorage.getItem('token')) {
            router.push('/login');
        }
    }, [router]);

    const logout = () => {
        localStorage.removeItem('token');
        router.push('/login');
    };

    const links = [
        { label: 'Dashboard', href: '/wms/dashboard', c: 'blue' },
        { label: 'Inbound', href: '/wms/inbound', c: 'green' },
        { label: 'Putaway', href: '/wms/putaway', c: 'orange' },
        { label: 'Relocation', href: '/wms/relocation', c: 'orange' },
        { label: 'Picking Plan', href: '/wms/picking', c: 'red' },
        { label: 'Stock Opname', href: '/wms/stock-opname', c: 'grape' },
        { label: 'Inventory Matrix', href: '/wms/inventory', c: 'teal' },
        { label: 'Report Inbound', href: '/wms/report-inbound', c: 'gray' },
        { label: 'Report Outbound', href: '/wms/report-outbound', c: 'gray' },
        { label: 'Master Produk', href: '/wms/master-produk', c: 'dark' },
        { label: 'Master Lokasi', href: '/wms/master-lokasi', c: 'dark' },
        { label: 'Master Customer', href: '/wms/master-customer', c: 'dark' },
    ];

    return (
        <AppShell
            header={{ height: 60 }}
            navbar={{ width: 250, breakpoint: 'sm', collapsed: { mobile: !opened } }}
            padding="md"
            style={{ background: '#f8f9fa' }}
        >
            <AppShell.Header>
                <Group h="100%" px="md" justify="space-between" style={{ background: '#1c1c1c', color: 'white' }}>
                    <Group>
                        <Burger opened={opened} onClick={toggle} hiddenFrom="sm" size="sm" color="white" />
                        <Title order={3} style={{ color: '#e6921e' }}>WMS PRO</Title>
                    </Group>
                    <Button variant="subtle" color="red" size="xs" onClick={logout}>LOGOUT</Button>
                </Group>
            </AppShell.Header>

            <AppShell.Navbar p="sm" style={{ background: '#fff' }}>
                <Text fw={700} c="dimmed" size="xs" mb="sm" pl="sm">MAIN MENU</Text>
                {links.map((link) => (
                    <NavLink
                        key={link.label}
                        label={link.label}
                        active={pathname === link.href}
                        onClick={() => {
                            router.push(link.href);
                            if (opened) toggle();
                        }}
                        color={link.c}
                        variant="light"
                        style={{ borderRadius: 6, fontWeight: 600, marginBottom: 4 }}
                    />
                ))}
            </AppShell.Navbar>

            <AppShell.Main>
                {children}
            </AppShell.Main>
        </AppShell>
    );
}
