"use client";
import { useState, useEffect } from "react";
import { Title, Group, Text, Badge, Box, Paper, SimpleGrid, Progress, Stack } from "@mantine/core";
import { Table } from '../components/Table';
import {
  IconBuildingWarehouse,
  IconPercentage,
  IconChartBar,
} from "@tabler/icons-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend,
} from "recharts";
import api from "../lib/api";

export default function OccupancyPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get("/master-rak/occupancy")
      .then((res: any) => setData(res))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const chartData =
    data?.rows?.map((r: any) => ({
      name: r.lokasiRak,
      Terpakai: r.used,
      Tersedia: r.available,
      Persen: r.percentage,
    })) || [];

  const fullRows = data?.rows?.filter((r: any) => r.status === "FULL") || [];
  const warningRows = data?.rows?.filter((r: any) => r.status === "WARNING") || [];

  return (
    <Box>
      {/* Header */}
      <Box
        style={{
          background: "#fff",
          borderLeft: "4px solid #0d9488",
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
              <IconPercentage size={20} style={{ color: "#0d9488" }} />
              OKUPANSI GUDANG
            </Title>
            <Text size="xs" c="dimmed" mt={2}>
              Persentase penggunaan rak DEDICATED berdasarkan kapasitas dan
              stock onhand.
            </Text>
          </Box>
          <Badge color="teal" variant="light" size="lg">
            Warehouse Occupancy
          </Badge>
        </Group>
      </Box>

      {loading ? (
        <Paper withBorder p="md" radius="md">
          <Text size="sm" c="dimmed" ta="center">
            Memuat data okupansi...
          </Text>
        </Paper>
      ) : !data ? (
        <Paper withBorder p="md" radius="md">
          <Text size="sm" c="dimmed" ta="center">
            Gagal memuat data okupansi.
          </Text>
        </Paper>
      ) : (
        <Stack gap="md">
          {/* Summary cards */}
          <SimpleGrid cols={5}>
            <Paper withBorder p="sm" radius="md" ta="center">
              <Text size="xl" fw={900} c="teal">
                {data.overall?.percentage || 0}%
              </Text>
              <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
                Overall Occupancy
              </Text>
            </Paper>
            <Paper withBorder p="sm" radius="md" ta="center">
              <Text size="xl" fw={900} c="green">
                {data.overall?.totalRelease || 0}
              </Text>
              <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
                RELEASE
              </Text>
            </Paper>
            <Paper withBorder p="sm" radius="md" ta="center">
              <Text size="xl" fw={900} c="yellow">
                {data.overall?.totalHold || 0}
              </Text>
              <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
                HOLD
              </Text>
            </Paper>
            <Paper withBorder p="sm" radius="md" ta="center">
              <Text size="xl" fw={900} c="red">
                {data.overall?.totalReject || 0}
              </Text>
              <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
                REJECT
              </Text>
            </Paper>
            <Paper withBorder p="sm" radius="md" ta="center">
              <Text size="xl" fw={900} c="red">
                {fullRows.length}
              </Text>
              <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
                Rak Penuh
              </Text>
            </Paper>
          </SimpleGrid>

          {/* Warnings */}
          {(fullRows.length > 0 || warningRows.length > 0) && (
            <Paper withBorder p="md" radius="md">
              <Group gap={6} mb="xs" pb={4} style={{ borderBottom: "1px solid #f1f5f9" }}>
                <IconBuildingWarehouse size={15} style={{ color: "#ef4444" }} />
                <Text fw={700} size="sm">
                  Perhatian Rak
                </Text>
              </Group>
              <Group gap="xs">
                {fullRows.map((r: any) => (
                  <Badge key={r.lokasiRak} color="red" size="sm">
                    {r.lokasiRak} PENUH
                  </Badge>
                ))}
                {warningRows.map((r: any) => (
                  <Badge key={r.lokasiRak} color="yellow" size="sm">
                    {r.lokasiRak} {r.percentage}%
                  </Badge>
                ))}
              </Group>
            </Paper>
          )}

          {/* Chart */}
          <Paper withBorder p="md" radius="md">
            <Group gap={6} mb="md" pb={4} style={{ borderBottom: "1px solid #f1f5f9" }}>
              <IconChartBar size={15} style={{ color: "#0d9488" }} />
              <Text fw={700} size="sm">
                Grafik Okupansi per Rak
              </Text>
            </Group>
            <Box style={{ width: "100%", height: 300 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 10, right: 20, left: 0, bottom: 40 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" angle={-45} textAnchor="end" height={60} tick={{ fontSize: 10 }} />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="Terpakai" stackId="a" fill="#0d9488" />
                  <Bar dataKey="Tersedia" stackId="a" fill="#e5e7eb" />
                </BarChart>
              </ResponsiveContainer>
            </Box>
          </Paper>

          {/* Table */}
          <Paper withBorder p="md" radius="md">
            <Group gap={6} mb="md" pb={4} style={{ borderBottom: "1px solid #f1f5f9" }}>
              <IconBuildingWarehouse size={15} style={{ color: "#0d9488" }} />
              <Text fw={700} size="sm">
                Detail Okupansi per Rak
              </Text>
            </Group>
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
                    {["Rak", "Jenis", "Kapasitas", "Terpakai", "Release", "Hold", "Reject", "Tersedia", "%", "Status"].map((h) => (
                      <Table.Th key={h} style={{ color: "#fff", fontSize: 11 }}>
                        {h}
                      </Table.Th>
                    ))}
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {data.rows?.length === 0 ? (
                    <Table.Tr>
                      <Table.Td colSpan={10} ta="center" c="dimmed" py="xl">
                        Tidak ada data rak.
                      </Table.Td>
                    </Table.Tr>
                  ) : (
                    data.rows?.map((r: any, i: number) => (
                      <Table.Tr key={i}>
                        <Table.Td fw={700} c="blue">
                          {r.lokasiRak}
                        </Table.Td>
                        <Table.Td>
                          <Badge size="xs" color={r.jenisRak === "DEDICATED" ? "blue" : "gray"}>
                            {r.jenisRak}
                          </Badge>
                        </Table.Td>
                        <Table.Td ta="right">{r.capacity}</Table.Td>
                        <Table.Td ta="right" fw={700}>
                          {r.used}
                        </Table.Td>
                        <Table.Td ta="right" c="green">
                          {r.release}
                        </Table.Td>
                        <Table.Td ta="right" c="yellow">
                          {r.hold}
                        </Table.Td>
                        <Table.Td ta="right" c="red">
                          {r.reject}
                        </Table.Td>
                        <Table.Td ta="right">{r.available}</Table.Td>
                        <Table.Td style={{ minWidth: 120 }}>
                          <Group gap="xs">
                            <Text size="xs" fw={700} c={r.percentage >= 80 ? "red" : "teal"}>
                              {r.percentage}%
                            </Text>
                            <Progress
                              value={Math.min(r.percentage, 100)}
                              color={r.percentage >= 100 ? "red" : r.percentage >= 80 ? "yellow" : "teal"}
                              size="sm"
                              style={{ flex: 1 }}
                            />
                          </Group>
                        </Table.Td>
                        <Table.Td>
                          <Badge
                            size="xs"
                            color={r.status === "FULL" ? "red" : r.status === "WARNING" ? "yellow" : "green"}
                          >
                            {r.status}
                          </Badge>
                        </Table.Td>
                      </Table.Tr>
                    ))
                  )}
                </Table.Tbody>
              </Table>
            </Box>
          </Paper>
        </Stack>
      )}
    </Box>
  );
}
