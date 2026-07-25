// @ts-nocheck
'use client';
import { Box } from '@mantine/core';
import StatCard from './StatCard';

export default function StatsRow({ stats }: { stats: any }) {
  if (!stats) return null;
  return (
    <Box style={{ display: "grid", gridTemplateColumns: "repeat(5, minmax(104px, 1fr))", gap: 8, overflowX: "auto" }} className="custom-scroll-blue">
      <StatCard title="Total SKU" value={stats.totalSku} color="blue" />
      <StatCard title="Total Stok" value={stats.totalStock} color="teal" />
      <StatCard title="Inbound Hari Ini" value={stats.inboundHariIni} color="green" />
      <StatCard title="Outbound Hari Ini" value={stats.outboundHariIni} color="red" />
      <StatCard title="Planning Outbound Pending" value={stats.pickingPendingCount || 0} color="orange" />
    </Box>
  );
}