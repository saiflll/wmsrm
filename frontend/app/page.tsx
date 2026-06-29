'use client';
// @ts-nocheck
import React, { useState, useEffect } from 'react';
import { AppShell, Group, Title, Button, Text, UnstyledButton, Stack, Box, Badge, rem, ScrollArea } from '@mantine/core';
import { useRouter } from 'next/navigation';
import axios from 'axios';
import DashboardPage from './wms/dashboard/page';
import InboundPage from './wms/inbound/page';
import PutawayPage from './wms/putaway/page';
import RelocationPage from './wms/relocation/page';
import PickingPage from './wms/picking/page';
import InventoryPage from './wms/inventory/page';
import MasterProdukPage from './wms/master-produk/page';
import MasterLokasiPage from './wms/master-lokasi/page';
import MasterCustomerPage from './wms/master-customer/page';
import ReportInboundPage from './wms/report-inbound/page';
import ReportOutboundPage from './wms/report-outbound/page';
import StockOpnamePage from './wms/stock-opname/page';

const API = '/api';

const NAV = [
  { id: 'dashboard', label: 'DASHBOARD' },
  { id: 'inbound', label: 'INBOUND' },
  { id: 'putaway', label: 'PUTAWAY BIN' },
  { id: 'relocation', label: 'RELOCATION' },
  { id: 'picking', label: 'PICKING (MULTI)' },
  { id: 'inventory', label: 'INVENTORY' },
  { id: 'master-produk', label: 'MASTER PRODUK' },
  { id: 'master-lokasi', label: 'MASTER LOKASI' },
  { id: 'master-customer', label: 'MASTER CUSTOMER' },
  { id: 'report-inbound', label: 'REPORT INBOUND', yellow: true },
  { id: 'report-outbound', label: 'REPORT OUTBOUND', yellow: true },
  { id: 'stock-opname', label: 'STOCK OPNAME', yellow: true },
];

export default function App() {
  const [tab, setTab] = useState('dashboard');
  const [user, setUser] = useState(null);
  const router = useRouter();

  useEffect(() => {
    const u = localStorage.getItem('user');
    const t = localStorage.getItem('token');
    if (!u || !t) return router.push('/login');
    setUser(JSON.parse(u));
  }, []);

  const logout = () => {
    localStorage.clear();
    router.push('/login');
  };

  if (!user) return null;

  const pages: Record<string, React.ReactNode> = {
    dashboard: <DashboardPage />,
    inbound: <InboundPage />,
    putaway: <PutawayPage />,
    relocation: <RelocationPage />,
    picking: <PickingPage />,
    inventory: <InventoryPage />,
    'master-produk': <MasterProdukPage />,
    'master-lokasi': <MasterLokasiPage />,
    'master-customer': <MasterCustomerPage />,
    'report-inbound': <ReportInboundPage />,
    'report-outbound': <ReportOutboundPage />,
    'stock-opname': <StockOpnamePage />,
  };

  return (
    <AppShell navbar={{ width: 120, breakpoint: 'sm' }} padding={0}>
      <AppShell.Navbar
        style={{
          background: '#0d1b2a',
          borderRight: '1px solid #1e3a5f',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* Logo */}
        <Box p="md" style={{ borderBottom: '1px solid #1e3a5f', textAlign: 'center' }}>
          <Title
            order={5}
            style={{
              color: '#00e5a0',
              fontStyle: 'italic',
              fontWeight: 900,
              letterSpacing: 1,
              lineHeight: 1.2,
            }}
          >
            WMS PRO
          </Title>
        </Box>

        {/* Nav Items */}
        <ScrollArea style={{ flex: 1 }} p={0}>
          <Stack gap={0} p={0}>
            {NAV.map((n: any) => {
              const active = tab === n.id;
              return (
                <UnstyledButton
                  key={n.id}
                  onClick={() => setTab(n.id)}
                  style={{
                    display: 'block',
                    width: '100%',
                    padding: '10px 14px',
                    fontSize: 11,
                    fontWeight: active ? 700 : 500,
                    color: active ? '#fff' : n.yellow ? '#f4c430' : '#8bafc7',
                    background: active ? '#1e6b3c' : 'transparent',
                    borderLeft: active ? '3px solid #00e5a0' : '3px solid transparent',
                    letterSpacing: 0.3,
                    transition: 'all .15s',
                  }}
                >
                  {n.label}
                </UnstyledButton>
              );
            })}
          </Stack>
        </ScrollArea>

        {/* Logout */}
        <Box p="md">
          <Button
            fullWidth
            size="xs"
            color="red"
            variant="filled"
            onClick={logout}
            style={{ fontSize: 11, fontWeight: 700, borderRadius: 4 }}
          >
            LOGOUT
          </Button>
        </Box>
      </AppShell.Navbar>

      <AppShell.Main style={{ background: '#f0f4f8', minHeight: '100vh' }}>
        {pages[tab] || <Box p="xl"><Text>Page not found</Text></Box>}
      </AppShell.Main>
    </AppShell>
  );
}
