'use client';
import React, { useEffect, useState } from 'react';
import {
    AppShell,
    Burger,
    Group,
    NavLink,
    Title,
    Text,
    Loader,
    Box,
    Menu,
    Avatar,
    UnstyledButton,
    Badge,
    ActionIcon,
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { usePathname, useRouter } from 'next/navigation';
import {
    IconLayoutDashboard,
    IconCalendarEvent,
    IconArrowBadgeDown,
    IconClipboardList,
    IconArrowBadgeUp,
    IconCalendarStats,
    IconTruck,
    IconArrowsMaximize,
    IconClipboardCheck,
    IconGridDots,
    IconReport,
    IconReportAnalytics,
    IconPackage,
    IconMap2,
    IconBuildingStore,
    IconFileImport,
    IconUsers,
    IconLogin,
    IconInfoCircle,
    IconLogout,
    IconChevronDown,
    IconUser,
} from '@tabler/icons-react';

const roleLabel: Record<number, string> = {
    1: 'Checker',
    2: 'Admin',
    3: 'Koordinator',
    4: 'Supervisor',
    5: 'Super Admin',
    6: 'Manager',
};

const menuPermissions: Record<string, number[]> = {
    '/dashboard': [2, 4, 5, 6], // Checker(1) & Koordinator(3) tidak bisa dashboard
    '/planning-inbound': [3, 4, 5], // Koordinator, Supervisor, Super Admin
    '/inbound': [1, 3, 4, 5], // Checker (eksekutor), Koordinator, Supervisor, Super Admin
    '/planning-outbound': [3, 4, 5],
    '/outbound': [1, 3, 4, 5], // Checker (eksekutor), Koordinator, Supervisor, Super Admin
    '/planning-ayam': [3, 4, 5],
    '/outbound-ayam': [1, 3, 4, 5], // Checker (eksekutor), Koordinator, Supervisor, Super Admin
    '/relocation': [1, 3, 4, 5], // Checker, Koordinator, Supervisor, Super Admin
    '/stock-opname': [1, 2, 3, 4, 5], // Checker, Admin, Koordinator, Supervisor, Super Admin
    '/inventory': [2, 3, 4, 5], // Admin, Koordinator, Supervisor, Super Admin
    '/report-inbound': [2, 3, 4, 5], // Admin, Koordinator, Supervisor, Super Admin
    '/report-outbound': [2, 3, 4, 5], // Admin, Koordinator, Supervisor, Super Admin
    '/report-ayam': [2, 3, 4, 5], // Admin, Koordinator, Supervisor, Super Admin
    '/report-opname': [2, 3, 4, 5], // Admin, Koordinator, Supervisor, Super Admin
    '/master-produk': [4, 5],
    '/master-lokasi': [4, 5],
    '/master-customer': [4, 5],
    '/import': [5],
    '/users': [5],
    '/login-logs': [5],
    '/about': [1, 2, 3, 4, 5, 6],
};

type MenuLink = { label: string; href: string; c: string; icon: React.ComponentType<any> };

const menuGroups: { label: string; links: MenuLink[] }[] = [
    {
        label: 'MAIN MENU',
        links: [
            { label: 'Dashboard', href: '/dashboard', c: 'blue', icon: IconLayoutDashboard },
            { label: 'Planning Inbound', href: '/planning-inbound', c: 'indigo', icon: IconCalendarEvent },
            { label: 'Inbound', href: '/inbound', c: 'green', icon: IconArrowBadgeDown },
            { label: 'Planning Outbound', href: '/planning-outbound', c: 'red', icon: IconClipboardList },
            { label: 'Outbound', href: '/outbound', c: 'red', icon: IconArrowBadgeUp },
            { label: 'Planning Ayam', href: '/planning-ayam', c: 'pink', icon: IconCalendarStats },
            { label: 'Outbound Ayam', href: '/outbound-ayam', c: 'orange', icon: IconTruck },
            { label: 'Relocation', href: '/relocation', c: 'orange', icon: IconArrowsMaximize },
            { label: 'Stock Opname', href: '/stock-opname', c: 'grape', icon: IconClipboardCheck },
            { label: 'Inventory', href: '/inventory', c: 'teal', icon: IconGridDots },
        ],
    },
    {
        label: 'REPORT',
        links: [
            { label: 'Report Inbound', href: '/report-inbound', c: 'gray', icon: IconReport },
            { label: 'Report Outbound', href: '/report-outbound', c: 'gray', icon: IconReportAnalytics },
            { label: 'Report Ayam', href: '/report-ayam', c: 'pink', icon: IconReportAnalytics },
            { label: 'Report Opname', href: '/report-opname', c: 'gray', icon: IconReport },
        ],
    },
    {
        label: 'MASTER',
        links: [
            { label: 'Master Produk', href: '/master-produk', c: 'dark', icon: IconPackage },
            { label: 'Master Lokasi', href: '/master-lokasi', c: 'dark', icon: IconMap2 },
            { label: 'Master Customer', href: '/master-customer', c: 'dark', icon: IconBuildingStore },
        ],
    },
    {
        label: 'ADMIN',
        links: [
            { label: 'Manajemen User', href: '/users', c: 'pink', icon: IconUsers },
            { label: 'Riwayat Login', href: '/login-logs', c: 'pink', icon: IconLogin },
            { label: 'Import Data', href: '/import', c: 'teal', icon: IconFileImport },
        ],
    },
];

export default function WMSLayout({ children }: { children: React.ReactNode }) {
    const [mobileOpened, { toggle: toggleMobile, close: closeMobile }] = useDisclosure(false);
    const [desktopOpened, { toggle: toggleDesktop }] = useDisclosure(false);
    const pathname = usePathname();
    const router = useRouter();
    const [userRole, setUserRole] = useState<number | null>(null);
    const [userName, setUserName] = useState<string>('User');

    useEffect(() => {
        if (!localStorage.getItem('token')) {
            router.push('/login');
        }
        const storedUser = localStorage.getItem('user');
        if (storedUser) {
            try {
                const u = JSON.parse(storedUser);
                if (u && u.role) setUserRole(u.role);
                if (u && (u.username || u.name)) setUserName(u.username || u.name);
            } catch (e) { }
        }
    }, [router]);

    useEffect(() => {
        if (userRole === null) return;
        const base = '/' + pathname.split('/').filter(Boolean)[0];
        const roles = menuPermissions[base];
        if (roles && !roles.includes(userRole)) {
            // Pick first allowed route for this role
            const allowedRoute = Object.keys(menuPermissions).find(route => menuPermissions[route].includes(userRole)) || '/about';
            router.push(allowedRoute);
        }
    }, [userRole, pathname, router]);

    const logout = () => {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        document.cookie = 'token=; path=/; max-age=0';
        router.push('/login');
    };

    const canAccess = (href: string) => {
        if (userRole === null) return false;
        const roles = menuPermissions[href];
        if (!roles) return true;
        return roles.includes(userRole);
    };

    const handleNavigation = (href: string) => {
        router.push(href);
        closeMobile();
    };

    if (userRole === null) {
        return (
            <Box style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
                <Loader size="lg" />
            </Box>
        );
    }

    return (
        <AppShell
            header={{ height: 56 }}
            navbar={{
                width: 220,
                breakpoint: 'sm',
                collapsed: { mobile: !mobileOpened, desktop: !desktopOpened },
            }}
            padding={{ base: 'xs', sm: 'md' }}
            style={{ background: '#f8f9fa' }}
        >
            <AppShell.Header>
                <Group
                    h="100%"
                    px="md"
                    justify="space-between"
                    wrap="nowrap"
                    style={{
                        background: '#ffffff',
                        color: '#0f172a',
                        borderBottom: '1px solid #e2e8f0',
                        boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
                    }}
                >
                    {/* Left Section: Sleek Toggle & Logo */}
                    <Group gap="xs" wrap="nowrap" align="center">
                        <Burger opened={mobileOpened} onClick={toggleMobile} hiddenFrom="sm" size="xs" color="#334155" />
                        <Burger opened={desktopOpened} onClick={toggleDesktop} visibleFrom="sm" size="xs" color="#334155" />

                        <Group gap={0} align="center" wrap="nowrap">
                            <img src="/dw_logo.png" alt="DW Logo" style={{ height: 50, margin: 0, padding: '0 6px', objectFit: 'contain', display: 'block' }} />
                            <Box style={{ width: 1, height: 32, background: '#cbd5e1', margin: '0 10px' }} />
                            <Text fw={900} size="lg" style={{ color: '#0ea5e9', letterSpacing: '0.05em' }}>
                                RM
                            </Text>
                        </Group>
                    </Group>

                    {/* Right Section: Compact Profile Dropdown Popover */}
                    <Group gap="xs" align="center" wrap="nowrap">
                        <Menu shadow="md" width={220} position="bottom-end" radius="md" transitionProps={{ transition: 'pop-top-right', duration: 150 }}>
                            <Menu.Target>
                                <UnstyledButton
                                    style={{
                                        padding: '4px 10px',
                                        borderRadius: 8,
                                        border: '1px solid #e2e8f0',
                                        background: '#f8fafc',
                                        transition: 'all 150ms ease',
                                    }}
                                >
                                    <Group gap={8} wrap="nowrap" align="center">
                                        <Avatar size={24} radius="xl" color="orange" variant="filled">
                                            {(userName?.[0] || 'U').toUpperCase()}
                                        </Avatar>
                                        <Box visibleFrom="xs" style={{ textAlign: 'left' }}>
                                            <Text size="xs" fw={800} c="dark" style={{ lineHeight: 1.1 }}>
                                                {userName}
                                            </Text>
                                            <Text size="10px" c="dimmed" style={{ lineHeight: 1 }}>
                                                {roleLabel[userRole] || 'User'}
                                            </Text>
                                        </Box>
                                        <IconChevronDown size={14} color="#64748b" />
                                    </Group>
                                </UnstyledButton>
                            </Menu.Target>

                            <Menu.Dropdown p={6}>
                                <Box px="xs" py={8} mb={4} style={{ background: '#f8fafc', borderRadius: 6, border: '1px solid #f1f5f9' }}>
                                    <Group gap={8} wrap="nowrap">
                                        <Avatar size={30} radius="xl" color="orange">
                                            {(userName?.[0] || 'U').toUpperCase()}
                                        </Avatar>
                                        <Box style={{ overflow: 'hidden' }}>
                                            <Text size="xs" fw={800} c="dark" style={{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                                                {userName}
                                            </Text>
                                            <Badge size="xs" color="orange" variant="light" radius="xs" mt={2}>
                                                {roleLabel[userRole] || 'User'}
                                            </Badge>
                                        </Box>
                                    </Group>
                                </Box>

                                <Menu.Item
                                    leftSection={<IconInfoCircle size={16} color="#e6921e" />}
                                    onClick={() => router.push('/about')}
                                    style={{ fontSize: 12, fontWeight: 600, borderRadius: 4 }}
                                >
                                    About System
                                </Menu.Item>

                                <Menu.Divider my={4} />

                                <Menu.Item
                                    color="red"
                                    leftSection={<IconLogout size={16} />}
                                    onClick={logout}
                                    style={{ fontSize: 12, fontWeight: 700, borderRadius: 4 }}
                                >
                                    Logout
                                </Menu.Item>
                            </Menu.Dropdown>
                        </Menu>
                    </Group>
                </Group>
            </AppShell.Header>

            <AppShell.Navbar p={4} style={{ background: '#fff', overflowY: 'auto', height: 'calc(100vh - 48px)' }}>
                {menuGroups.map((group, groupIdx) => {
                    const visibleLinks = group.links.filter(l => canAccess(l.href));
                    if (visibleLinks.length === 0) return null;
                    return (
                        <React.Fragment key={group.label}>
                            <Text fw={700} c="dimmed" size="xs" mt={groupIdx === 0 ? 2 : 10} mb={2} pl={6} tt="uppercase" style={{ fontSize: 9, lineHeight: 1.2, letterSpacing: '0.5px' }}>{group.label}</Text>
                            {visibleLinks.map((link: any) => (
                                <NavLink
                                    key={link.label}
                                    label={link.label}
                                    leftSection={<link.icon size={15} />}
                                    active={pathname === link.href}
                                    onClick={() => handleNavigation(link.href)}
                                    color={link.c}
                                    variant="light"
                                    styles={{
                                        root: { borderRadius: 4, fontWeight: 600, marginBottom: 1, minHeight: 26, padding: '3px 8px' },
                                        label: { fontSize: 11 }
                                    }}
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
