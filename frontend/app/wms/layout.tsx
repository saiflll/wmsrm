'use client';
import React, { useEffect, useState } from 'react';
import { AppShell, Burger, Group, NavLink, Title, Text, Button } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { usePathname, useRouter } from 'next/navigation';

const roleLabel: Record<number, string> = {
    1: 'Checker IB',
    2: 'Checker OB',
    3: 'Koordinator',
    4: 'Supervisor',
    5: 'Super Admin',
};

const roleLineColor: Record<number, string> = {
    1: '#2e7d32',
    2: '#1565c0',
    3: '#6a1b9a',
    4: '#1c1c1c',
    5: '#e60000',
};

const menuPermissions: Record<string, number[]> = {
    '/wms/dashboard': [1, 2, 3, 4, 5],
    '/wms/inbound': [1, 4, 5],
    '/wms/putaway': [2, 4, 5],
    '/wms/relocation': [3, 4, 5],
    '/wms/picking': [2, 3, 4, 5],
    '/wms/stock-opname': [3, 4, 5],
    '/wms/inventory': [1, 2, 3, 4, 5],
    '/wms/report-inbound': [1, 4, 5],
    '/wms/report-outbound': [2, 4, 5],
    '/wms/report-opname': [3, 4, 5],
    '/wms/master-produk': [4, 5],
    '/wms/master-lokasi': [4, 5],
    '/wms/master-customer': [4, 5],
    '/wms/users': [5],
    '/wms/login-logs': [5],
};

const menuGroups: { label: string; links: { label: string; href: string; c: string }[] }[] = [
    {
        label: 'ADMIN',
        links: [
            { label: 'Manajemen User', href: '/wms/users', c: 'pink' },
            { label: 'Riwayat Login', href: '/wms/login-logs', c: 'pink' },
        ],
    },
    {
        label: 'MAIN MENU',
        links: [
            { label: 'Dashboard', href: '/wms/dashboard', c: 'blue' },
            { label: 'Inbound', href: '/wms/inbound', c: 'green' },
            { label: 'Outbound', href: '/wms/putaway', c: 'red' },
            { label: 'Relocation', href: '/wms/relocation', c: 'orange' },
            { label: 'Picking Plan', href: '/wms/picking', c: 'red' },
            { label: 'Stock Opname', href: '/wms/stock-opname', c: 'grape' },
            { label: 'Inventory Matrix', href: '/wms/inventory', c: 'teal' },
        ],
    },
    {
        label: 'REPORT',
        links: [
            { label: 'Report Inbound', href: '/wms/report-inbound', c: 'gray' },
            { label: 'Report Outbound', href: '/wms/report-outbound', c: 'gray' },
            { label: 'Report Opname', href: '/wms/report-opname', c: 'gray' },
        ],
    },
    {
        label: 'MASTER',
        links: [
            { label: 'Master Produk', href: '/wms/master-produk', c: 'dark' },
            { label: 'Master Lokasi', href: '/wms/master-lokasi', c: 'dark' },
            { label: 'Master Customer', href: '/wms/master-customer', c: 'dark' },
        ],
    },
];

export default function WMSLayout({ children }: { children: React.ReactNode }) {
    const [opened, { toggle }] = useDisclosure();
    const pathname = usePathname();
    const router = useRouter();
    const [userRole, setUserRole] = useState<number>(() => {
        if (typeof window !== 'undefined') {
            try {
                const u = JSON.parse(localStorage.getItem('user') || '{}');
                return u?.role || 4;
            } catch { }
        }
        return 4;
    });

    useEffect(() => {
        if (!localStorage.getItem('token')) {
            router.push('/login');
        }
        const storedUser = localStorage.getItem('user');
        if (storedUser) {
            try {
                const u = JSON.parse(storedUser);
                if (u && u.role) setUserRole(u.role);
            } catch (e) { }
        }
    }, [router]);

    const logout = () => {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        router.push('/login');
    };

    const canAccess = (href: string) => {
        const roles = menuPermissions[href];
        if (!roles) return true;
        return roles.includes(userRole);
    };

    return (
        <AppShell
            header={{ height: 60 }}
            navbar={{ width: 250, breakpoint: 'sm', collapsed: { mobile: !opened } }}
            padding="md"
            style={{ background: '#f8f9fa' }}
        >
            <AppShell.Header>
                <Group h="100%" px="md" justify="space-between" style={{ background: '#1c1c1c', color: 'white', borderBottom: `3px solid ${roleLineColor[userRole] || '#1c1c1c'}` }}>
                    <Group>
                        <Burger opened={opened} onClick={toggle} hiddenFrom="sm" size="sm" color="white" />
                        <Title order={3} style={{ color: '#e6921e' }}>WMS PRO</Title>
                        <Text size="xs" c="dimmed" ml="sm">| {roleLabel[userRole] || 'User'}</Text>
                    </Group>
                    <Button variant="subtle" color="red" size="xs" onClick={logout}>LOGOUT</Button>
                </Group>
            </AppShell.Header>

            <AppShell.Navbar p="sm" style={{ background: '#fff', overflowY: 'auto', height: 'calc(100vh - 60px)' }}>
                {menuGroups.map((group) => {
                    const visibleLinks = group.links.filter(l => canAccess(l.href));
                    if (visibleLinks.length === 0) return null;
                    return (
                        <React.Fragment key={group.label}>
                            <Text fw={700} c="dimmed" size="xs" mb="sm" pl="sm" mt="xs">{group.label}</Text>
                            {visibleLinks.map((link: any) => (
                                <NavLink
                                    key={link.label}
                                    label={link.label}
                                    active={pathname === link.href}
                                    onClick={() => { router.push(link.href); if (opened) toggle(); }}
                                    color={link.c}
                                    variant="light"
                                    style={{ borderRadius: 6, fontWeight: 600, marginBottom: 4 }}
                                />
                            ))}
                        </React.Fragment>
                    );
                })}
            </AppShell.Navbar>

            <AppShell.Main>
                {children}
            </AppShell.Main>
        </AppShell>
    );
}
