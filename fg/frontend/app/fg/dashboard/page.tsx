"use client";
import { useEffect, useState } from "react";
import {
  SimpleGrid,
  Text,
  Title,
  Group,
  Table,
  Badge,
  Box,
  Paper,
  Tabs,
} from "@mantine/core";
import {
  IconPackages,
  IconAlertTriangle,
  IconLayoutDashboard,
  IconClock,
  IconReportAnalytics,
  IconTruckDelivery,
  IconChartBar,
} from "@tabler/icons-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import api from "../lib/api";

export default function DashboardPage() {
  const [summary, setSummary] = useState<any>(null);
  const [stocks, setStocks] = useState<any[]>([]);
  const [allStocks, setAllStocks] = useState<any[]>([]);
  const [expiring, setExpiring] = useState<any[]>([]);
  const [otdrSummary, setOtdrSummary] = useState<any>(null);
  const [perItemData, setPerItemData] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<string | null>("overview");

  useEffect(() => {
    api.get("/stock/summary").then(setSummary).catch(() => {});
    api
      .get("/stock?available=true")
      .then((res: any) => setStocks((res || []).slice(0, 20)))
      .catch(() => {});
    api
      .get("/stock?available=false")
      .then((res: any) => setAllStocks(res || []))
      .catch(() => {});
    api
      .get("/stock/expiring?days=30")
      .then((res: any) => setExpiring(res || []))
      .catch(() => {});
    api
      .get("/otdr/summary")
      .then((res: any) => setOtdrSummary(res || null))
      .catch(() => {});
    api
      .get("/stock/per-item")
      .then((res: any) => setPerItemData(res || []))
      .catch(() => {});
  }, []);

  const stats = [
    {
      label: "Total Stock",
      value: summary?.totalQty || 0,
      icon: IconPackages,
      color: "blue",
    },
    {
      label: "Total Lot",
      value: summary?.totalLot || 0,
      icon: IconPackages,
      color: "green",
    },
    {
      label: "Expired Soon",
      value: summary?.expSoon || 0,
      icon: IconAlertTriangle,
      color: "orange",
    },
  ];

  // Stock CP Report: group by item with status breakdown
  const cpMap: Record<string, any> = {};
  allStocks.forEach((s) => {
    if (!cpMap[s.namaBarang]) {
      cpMap[s.namaBarang] = {
        namaBarang: s.namaBarang,
        total: 0,
        RELEASE: 0,
        HOLD: 0,
        GOOD: 0,
        REJECT: 0,
        count: 0,
        nearestExp: null,
      };
    }
    const r = cpMap[s.namaBarang];
    r.total += s.stockOnhand || 0;
    r.count += 1;
    const st = s.status === "RELEASE" ? "RELEASE" : s.status === "HOLD" ? "HOLD" : s.status === "REJECT" ? "REJECT" : "GOOD";
    r[st] += s.stockOnhand || 0;
    if (s.tanggalExpired) {
      const exp = new Date(s.tanggalExpired).getTime();
      if (!r.nearestExp || exp < new Date(r.nearestExp).getTime()) {
        r.nearestExp = s.tanggalExpired;
      }
    }
  });
  const cpRows = Object.values(cpMap).sort((a: any, b: any) =>
    a.namaBarang.localeCompare(b.namaBarang),
  );

  return (
    <Box>
      {/* Header */}
      <Box
        style={{
          background: "#fff",
          borderLeft: "4px solid #1d4ed8",
          padding: "14px 20px",
          marginBottom: 16,
          borderRadius: 8,
          boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
        }}
      >
        <Group justify="space-between">
          <Box>
            <Title
              order={4}
              style={{
                color: "#111827",
                fontWeight: 800,
                display: "flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              <IconLayoutDashboard size={20} style={{ color: "#1d4ed8" }} />
              DASHBOARD FINISHED GOODS
            </Title>
            <Text size="xs" c="dimmed" mt={2}>
              Ringkasan stok, lot, dan status gudang FG.
            </Text>
          </Box>
          <Badge color="blue" variant="light" size="lg">
            Overview
          </Badge>
        </Group>
      </Box>

      <Tabs value={activeTab} onChange={setActiveTab}>
        <Tabs.List mb="md">
          <Tabs.Tab value="overview" leftSection={<IconLayoutDashboard size={15} />}>
            Overview
          </Tabs.Tab>
          <Tabs.Tab value="stock" leftSection={<IconPackages size={15} />}>
            Stock Terbaru
          </Tabs.Tab>
          <Tabs.Tab value="expiring" leftSection={<IconClock size={15} />}>
            Priority Expired{" "}
            <Badge ml={6} color="orange" size="xs">
              {expiring.length}
            </Badge>
          </Tabs.Tab>
          <Tabs.Tab value="cp" leftSection={<IconReportAnalytics size={15} />}>
            Stock CP Report{" "}
            <Badge ml={6} color="blue" size="xs">
              {cpRows.length}
            </Badge>
          </Tabs.Tab>
          <Tabs.Tab value="otdr" leftSection={<IconTruckDelivery size={15} />}>
            OTDR Summary{" "}
            <Badge ml={6} color="orange" size="xs">
              {otdrSummary?.total || 0}
            </Badge>
          </Tabs.Tab>
          <Tabs.Tab value="per-item" leftSection={<IconChartBar size={15} />}>
            Per Item{" "}
            <Badge ml={6} color="yellow" size="xs">
              {perItemData.length}
            </Badge>
          </Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="overview">
          <SimpleGrid cols={3} mb="md">
            {stats.map((s) => {
              const Icon = s.icon;
              return (
                <Paper key={s.label} withBorder p="md" radius="md">
                  <Group justify="space-between">
                    <Box>
                      <Text size="xs" c="dimmed" tt="uppercase">
                        {s.label}
                      </Text>
                      <Title order={3}>{s.value}</Title>
                    </Box>
                    <Icon size={32} color={`var(--mantine-color-${s.color}-6)`} />
                  </Group>
                </Paper>
              );
            })}
          </SimpleGrid>
        </Tabs.Panel>

        <Tabs.Panel value="stock">
          <Paper withBorder p="md" radius="md">
            <Text size="xs" c="dimmed" mb="sm">
              20 lot stok terbaru.
            </Text>
            <Box style={{ maxHeight: 500, overflow: "auto" }}>
              <Table striped style={{ fontSize: 11 }}>
                <Table.Thead
                  style={{
                    background: "#111827",
                    position: "sticky",
                    top: 0,
                    zIndex: 1,
                  }}
                >
                  <Table.Tr>
                    {[
                      "ID Stock",
                      "Barang",
                      "Rak",
                      "Batch",
                      "Expired",
                      "Status",
                      "Onhand",
                    ].map((h) => (
                      <Table.Th key={h} style={{ color: "#fff", fontSize: 11 }}>
                        {h}
                      </Table.Th>
                    ))}
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {stocks.length === 0 ? (
                    <Table.Tr>
                      <Table.Td colSpan={7} ta="center" c="dimmed" py="xl">
                        Tidak ada data.
                      </Table.Td>
                    </Table.Tr>
                  ) : (
                    stocks.map((s) => (
                      <Table.Tr key={s.idStock || s.id}>
                        <Table.Td>
                          <Badge size="xs" variant="light" color="gray">
                            {s.idStock}
                          </Badge>
                        </Table.Td>
                        <Table.Td fw={500}>{s.namaBarang}</Table.Td>
                        <Table.Td>
                          <Badge size="xs" variant="light" color="blue">
                            {s.lokasiRak}
                          </Badge>
                        </Table.Td>
                        <Table.Td>
                          <Badge size="xs" variant="light" color="gray">
                            {s.nomorBatch}
                          </Badge>
                        </Table.Td>
                        <Table.Td>{s.tanggalExpired}</Table.Td>
                        <Table.Td>
                          <Badge
                            size="xs"
                            color={
                              s.status === "GOOD"
                                ? "green"
                                : s.status === "HOLD"
                                  ? "yellow"
                                  : "red"
                            }
                          >
                            {s.status}
                          </Badge>
                        </Table.Td>
                        <Table.Td ta="right" fw={700}>
                          {s.stockOnhand}
                        </Table.Td>
                      </Table.Tr>
                    ))
                  )}
                </Table.Tbody>
              </Table>
            </Box>
          </Paper>
        </Tabs.Panel>

        <Tabs.Panel value="expiring">
          <Paper withBorder p="md" radius="md">
            <Text size="xs" c="dimmed" mb="sm">
              Lot dengan masa expired &le;30 hari — prioritaskan FEFO.
            </Text>
            <Box style={{ maxHeight: 500, overflow: "auto" }}>
              <Table striped style={{ fontSize: 11 }}>
                <Table.Thead
                  style={{
                    background: "#111827",
                    position: "sticky",
                    top: 0,
                    zIndex: 1,
                  }}
                >
                  <Table.Tr>
                    {[
                      "Barang",
                      "Rak",
                      "Batch",
                      "Expired",
                      "Status",
                      "Onhand",
                      "Sisa Hari",
                    ].map((h) => (
                      <Table.Th key={h} style={{ color: "#fff", fontSize: 11 }}>
                        {h}
                      </Table.Th>
                    ))}
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {expiring.length === 0 ? (
                    <Table.Tr>
                      <Table.Td colSpan={7} ta="center" c="dimmed" py="xl">
                        Tidak ada lot yang akan expired.
                      </Table.Td>
                    </Table.Tr>
                  ) : (
                    expiring.map((s: any, i: number) => {
                      const hari = Math.ceil(
                        (new Date(s.tanggalExpired).getTime() - Date.now()) /
                          (1000 * 60 * 60 * 24),
                      );
                      return (
                        <Table.Tr key={i}>
                          <Table.Td fw={500}>{s.namaBarang}</Table.Td>
                          <Table.Td>
                            <Badge size="xs" variant="light" color="blue">
                              {s.lokasiRak}
                            </Badge>
                          </Table.Td>
                          <Table.Td>
                            <Badge size="xs" variant="light" color="gray">
                              {s.nomorBatch}
                            </Badge>
                          </Table.Td>
                          <Table.Td>{s.tanggalExpired}</Table.Td>
                          <Table.Td>
                            <Badge
                              size="xs"
                              color={
                                s.status === "GOOD"
                                  ? "green"
                                  : "yellow"
                              }
                            >
                              {s.status}
                            </Badge>
                          </Table.Td>
                          <Table.Td ta="right" fw={700}>
                            {s.stockOnhand}
                          </Table.Td>
                          <Table.Td>
                            <Badge
                              size="xs"
                              color={
                                hari <= 0
                                  ? "red"
                                  : hari <= 7
                                    ? "orange"
                                    : "yellow"
                              }
                            >
                              {hari <= 0 ? "EXPIRED" : `${hari} hari`}
                            </Badge>
                          </Table.Td>
                        </Table.Tr>
                      );
                    })
                  )}
                </Table.Tbody>
              </Table>
            </Box>
          </Paper>
        </Tabs.Panel>

        <Tabs.Panel value="cp">
          <Paper withBorder p="md" radius="md">
            <Text size="xs" c="dimmed" mb="sm">
              Stock snapshot per barang dengan breakdown status (RELEASE / HOLD
              / GOOD / REJECT).
            </Text>
            <Box style={{ maxHeight: 500, overflow: "auto" }}>
              <Table striped style={{ fontSize: 11 }}>
                <Table.Thead
                  style={{
                    background: "#111827",
                    position: "sticky",
                    top: 0,
                    zIndex: 1,
                  }}
                >
                  <Table.Tr>
                    {[
                      "Barang",
                      "Total Qty",
                      "RELEASE",
                      "HOLD",
                      "GOOD",
                      "REJECT",
                      "Lot",
                      "Expired Terdekat",
                    ].map((h) => (
                      <Table.Th
                        key={h}
                        style={{ color: "#fff", fontSize: 11 }}
                      >
                        {h}
                      </Table.Th>
                    ))}
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {cpRows.length === 0 ? (
                    <Table.Tr>
                      <Table.Td colSpan={8} ta="center" c="dimmed" py="xl">
                        Tidak ada data stock.
                      </Table.Td>
                    </Table.Tr>
                  ) : (
                    cpRows.map((r: any, i: number) => (
                      <Table.Tr key={i}>
                        <Table.Td fw={500}>{r.namaBarang}</Table.Td>
                        <Table.Td ta="right" fw={700}>
                          {r.total}
                        </Table.Td>
                        <Table.Td ta="right" c="green" fw={600}>
                          {r.RELEASE || "-"}
                        </Table.Td>
                        <Table.Td ta="right" c="yellow" fw={600}>
                          {r.HOLD || "-"}
                        </Table.Td>
                        <Table.Td ta="right" c="blue" fw={600}>
                          {r.GOOD || "-"}
                        </Table.Td>
                        <Table.Td ta="right" c="red" fw={600}>
                          {r.REJECT || "-"}
                        </Table.Td>
                        <Table.Td ta="center">{r.count}</Table.Td>
                        <Table.Td>{r.nearestExp || "-"}</Table.Td>
                      </Table.Tr>
                    ))
                  )}
                </Table.Tbody>
              </Table>
            </Box>
          </Paper>
        </Tabs.Panel>

        <Tabs.Panel value="per-item">
          <Paper withBorder p="md" radius="md">
            <Text size="xs" c="dimmed" mb="sm">Total stock per item (dari yang terbesar).</Text>
            <Box mb="md">
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={perItemData.slice(0, 20)}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="namaBarang" fontSize={10} angle={-45} textAnchor="end" height={80} />
                  <YAxis fontSize={11} />
                  <Tooltip />
                  <Bar dataKey="totalQty" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </Box>
            <Box style={{ maxHeight: 500, overflow: "auto" }}>
              <Table striped style={{ fontSize: 11 }}>
                <Table.Thead style={{ background: "#111827", position: "sticky", top: 0, zIndex: 1 }}>
                  <Table.Tr>
                    {["Barang", "Satuan", "Total Qty", "Lot", "Status Breakdown"].map(h => (
                      <Table.Th key={h} style={{ color: "#fff", fontSize: 11 }}>{h}</Table.Th>
                    ))}
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {perItemData.map((r: any, i: number) => (
                    <Table.Tr key={i}>
                      <Table.Td fw={500}>{r.namaBarang}</Table.Td>
                      <Table.Td>{r.satuan}</Table.Td>
                      <Table.Td ta="right" fw={700}>{r.totalQty}</Table.Td>
                      <Table.Td ta="center">{r.totalLot}</Table.Td>
                      <Table.Td>
                        <Group gap={4}>
                          {(Object.entries(r.statuses) as [string, number][]).map(([s, qty]) => (
                            <Badge key={s} size="xs" color={s === "GOOD" ? "green" : s === "HOLD" ? "yellow" : s === "RELEASE" ? "blue" : "red"}>
                              {s}: {qty}
                            </Badge>
                          ))}
                        </Group>
                      </Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            </Box>
          </Paper>
        </Tabs.Panel>

        <Tabs.Panel value="otdr">
          <SimpleGrid cols={5} mb="md">
            {[
              { label: "Total OTDR", value: otdrSummary?.total || 0, color: "blue" },
              { label: "Draft", value: otdrSummary?.draft || 0, color: "gray" },
              { label: "Sedang Muat", value: otdrSummary?.inProgress || 0, color: "yellow" },
              { label: "Complete", value: otdrSummary?.complete || 0, color: "green" },
              { label: "Total Qty", value: otdrSummary?.totalQty || 0, color: "orange" },
            ].map((s, i) => (
              <Paper key={i} withBorder p="sm" radius="md" ta="center">
                <Text size="xl" fw={900} c={s.color}>
                  {s.value}
                </Text>
                <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
                  {s.label}
                </Text>
              </Paper>
            ))}
          </SimpleGrid>
          <Paper withBorder p="md" radius="md">
            <Text size="xs" c="dimmed" mb="sm">
              10 OTDR terbaru.
            </Text>
            <Box style={{ maxHeight: 400, overflow: "auto" }}>
              <Table striped style={{ fontSize: 11 }}>
                <Table.Thead
                  style={{
                    background: "#111827",
                    position: "sticky",
                    top: 0,
                    zIndex: 1,
                  }}
                >
                  <Table.Tr>
                    {["ID OTDR", "Tanggal", "Resto", "SJ", "Qty", "Status"].map((h) => (
                      <Table.Th key={h} style={{ color: "#fff", fontSize: 11 }}>
                        {h}
                      </Table.Th>
                    ))}
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {otdrSummary?.recent?.length === 0 ? (
                    <Table.Tr>
                      <Table.Td colSpan={6} ta="center" c="dimmed" py="xl">
                        Tidak ada data OTDR.
                      </Table.Td>
                    </Table.Tr>
                  ) : (
                    otdrSummary?.recent?.map((o: any, i: number) => (
                      <Table.Tr key={i}>
                        <Table.Td fw={700}>{o.idOtdr}</Table.Td>
                        <Table.Td>{o.tanggalDimuat}</Table.Td>
                        <Table.Td>
                          {o.kodeResto} - {o.namaResto}
                        </Table.Td>
                        <Table.Td>{o.nomorSuratJalan}</Table.Td>
                        <Table.Td ta="right" fw={700}>
                          {o.totalQtyOutput}
                        </Table.Td>
                        <Table.Td>
                          <Badge
                            size="xs"
                            color={o.statusOtdr === "COMPLETE" ? "green" : "orange"}
                          >
                            {o.statusOtdr}
                          </Badge>
                        </Table.Td>
                      </Table.Tr>
                    ))
                  )}
                </Table.Tbody>
              </Table>
            </Box>
          </Paper>
        </Tabs.Panel>
      </Tabs>
    </Box>
  );
}
