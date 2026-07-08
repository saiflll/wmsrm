"use client";
import { useState, useEffect } from "react";
import { Title, Group, Badge, Button, SimpleGrid, Text, Box, Paper, Tabs, TextInput, NumberInput, Select } from "@mantine/core";
import { Table } from '../components/Table';
import { notifications } from "@mantine/notifications";
import {
  IconAlertTriangle,
  IconFlask,
  IconCircleCheck,
  IconLock,
  IconListDetails,
  IconSearch,
  IconRefresh,
} from "@tabler/icons-react";
import api, { unwrap } from "../lib/api";

export default function QcFifoPage() {
  const [data, setData] = useState<{
    rows: any[];
    summary: Record<string, any>;
  }>({ rows: [], summary: {} });
  const [activeTab, setActiveTab] = useState<string | null>("all");
  const [search, setSearch] = useState("");
  const [maxDays, setMaxDays] = useState<number | "">("");
  const [statusFilter, setStatusFilter] = useState<string | null>("");
  const [qcSortKey, setQcSortKey] = useState<string | null>(null);
  const [qcSortDir, setQcSortDir] = useState<"asc" | "desc">("asc");
  const [qcFilterBarang, setQcFilterBarang] = useState<string | null>(null);
  const [qcFilterRak, setQcFilterRak] = useState<string | null>(null);

  const load = () => {
    api
      .get("/qc-fifo")
      .then((res) => setData(unwrap(res) || { rows: [], summary: {} }))
      .catch(() => {});
  };

  useEffect(() => {
    load();
  }, []);

  const [statusChanges, setStatusChanges] = useState<Record<string, string>>({});

  const handleStatusChange = async (idStock: string) => {
    const newStatus = statusChanges[idStock];
    if (!newStatus) return;
    try {
      await api.put("/qc-fifo/status", { idStock, status: newStatus });
      notifications.show({
        title: "Status Diubah",
        message: `${idStock} -> ${newStatus}`,
        color: "green",
      });
      setStatusChanges((prev) => {
        const next = { ...prev };
        delete next[idStock];
        return next;
      });
      load();
    } catch (err) {
      notifications.show({
        title: "Gagal",
        message: err.response?.data?.message || "Error",
        color: "red",
      });
    }
  };

  const qcSortData = (d: any[], key: string | null, dir: "asc" | "desc") => {
    if (!key) return d;
    return [...d].sort((a, b) => {
      let aVal = a[key];
      let bVal = b[key];
      if (aVal == null) aVal = "";
      if (bVal == null) bVal = "";
      if (typeof aVal === "number" && typeof bVal === "number") {
        return dir === "asc" ? aVal - bVal : bVal - aVal;
      }
      const cmp = String(aVal).localeCompare(String(bVal), undefined, { numeric: true });
      return dir === "asc" ? cmp : -cmp;
    });
  };

  const qcColumns = [
    { label: "ID Stock", key: "idStock" },
    { label: "Barang", key: "namaBarang" },
    { label: "Rak", key: "lokasiRak" },
    { label: "Batch", key: "nomorBatch" },
    { label: "Expired", key: "tanggalExpired" },
    { label: "Hari ke Expired", key: "hariKeExpired" },
    { label: "Status", key: "status" },
  ];

  const { rows, summary } = data;

  const barangOptions = [...new Set(rows.map((r) => r.namaBarang).filter(Boolean))].sort();
  const rakOptions = [...new Set(rows.map((r) => r.lokasiRak).filter(Boolean))].sort();

  const tabDefs = [
    {
      value: "all",
      label: "All",
      icon: IconListDetails,
      color: "gray",
      filter: () => true,
    },
    {
      value: "priority",
      label: "Priority",
      icon: IconAlertTriangle,
      color: "orange",
      filter: (r: any) =>
        r.daysToExpired <= 30 && r.daysToExpired >= 0,
    },
    {
      value: "expired",
      label: "Expired",
      icon: IconFlask,
      color: "red",
      filter: (r: any) => r.daysToExpired < 0,
    },
    {
      value: "hold",
      label: "HOLD",
      icon: IconLock,
      color: "yellow",
      filter: (r: any) => r.status === "HOLD",
    },
    {
      value: "release",
      label: "RELEASE",
      icon: IconCircleCheck,
      color: "green",
      filter: (r: any) => r.status === "RELEASE",
    },
  ];

  const filteredRows = rows.filter((r) => {
    const tabMatch = tabDefs.find((t) => t.value === activeTab)?.filter(r) ?? true;
    if (!tabMatch) return false;

    const kw = search.toLowerCase();
    const searchMatch =
      !kw ||
      r.namaBarang?.toLowerCase().includes(kw) ||
      r.idStock?.toLowerCase().includes(kw) ||
      r.nomorBatch?.toLowerCase().includes(kw) ||
      r.lokasiRak?.toLowerCase().includes(kw);
    if (!searchMatch) return false;

    if (maxDays !== "" && typeof maxDays === "number" && r.daysToExpired > maxDays) {
      return false;
    }

    if (statusFilter && r.status !== statusFilter) {
      return false;
    }

    if (qcFilterBarang && r.namaBarang !== qcFilterBarang) {
      return false;
    }

    if (qcFilterRak && r.lokasiRak !== qcFilterRak) {
      return false;
    }

    return true;
  });

  const sortedRows = qcSortData(filteredRows, qcSortKey, qcSortDir);

  return (
    <Box>
      {/* Header */}
      <Box
        style={{
          background: "#fff",
          borderLeft: "4px solid #16a34a",
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
              <IconFlask size={20} style={{ color: "#16a34a" }} />
              QC FIFO / FEFO MONITORING
            </Title>
            <Text size="xs" c="dimmed" mt={2}>
              Monitoring kualitas stok berdasarkan tanggal expired (FEFO) dan
              status QC.
            </Text>
          </Box>
          <Badge color="green" variant="light" size="lg">
            Quality Control
          </Badge>
        </Group>
      </Box>

      {/* Summary Cards */}
      <SimpleGrid cols={{ base: 2, sm: 4 }} mb="md">
        <Paper withBorder p="md" radius="md">
          <Text size="xs" c="dimmed">
            Total Lot
          </Text>
          <Text fw={700}>{summary.totalLot || 0}</Text>
        </Paper>
        <Paper withBorder p="md" radius="md" style={{ borderLeft: "3px solid #f59e0b" }}>
          <Text size="xs" c="dimmed">
            Priority (&le;30 hari)
          </Text>
          <Text fw={700} c="orange">
            {summary.priorityLot || 0}
          </Text>
        </Paper>
        <Paper withBorder p="md" radius="md" style={{ borderLeft: "3px solid #ef4444" }}>
          <Text size="xs" c="dimmed">
            Expired
          </Text>
          <Text fw={700} c="red">
            {summary.expiredLot || 0}
          </Text>
        </Paper>
        <Paper withBorder p="md" radius="md" style={{ borderLeft: "3px solid #eab308" }}>
          <Text size="xs" c="dimmed">
            HOLD
          </Text>
          <Text fw={700} c="yellow">
            {summary.holdLot || 0}
          </Text>
        </Paper>
      </SimpleGrid>

      <Paper withBorder p="md" radius="md">
        {/* Filters */}
        <Group mb="md" grow align="flex-end">
          <TextInput
            size="xs"
            placeholder="Cari barang, batch, ID stock, rak..."
            value={search}
            onChange={(e) => setSearch(e.currentTarget.value)}
            leftSection={<IconSearch size={14} />}
          />
          <NumberInput
            size="xs"
            label="Max Hari ke Expired"
            placeholder="Contoh: 30"
            value={maxDays}
            onChange={(v) => setMaxDays(v === "" ? "" : (v as number))}
            min={0}
          />
          <Select
            size="xs"
            label="Status"
            data={[
              { value: "", label: "Semua" },
              { value: "GOOD", label: "GOOD" },
              { value: "HOLD", label: "HOLD" },
              { value: "RELEASE", label: "RELEASE" },
              { value: "REJECT", label: "REJECT" },
            ]}
            value={statusFilter}
            onChange={setStatusFilter}
            clearable
          />
          <Select
            size="xs"
            label="Barang"
            placeholder="Semua"
            data={barangOptions.map((b) => ({ value: b, label: b }))}
            value={qcFilterBarang}
            onChange={setQcFilterBarang}
            clearable
            searchable
          />
          <Select
            size="xs"
            label="Rak"
            placeholder="Semua"
            data={rakOptions.map((r) => ({ value: r, label: r }))}
            value={qcFilterRak}
            onChange={setQcFilterRak}
            clearable
            searchable
          />
          <Button
            size="xs"
            variant="light"
            color="green"
            leftSection={<IconRefresh size={14} />}
            onClick={load}
          >
            Refresh
          </Button>
        </Group>

        <Tabs value={activeTab} onChange={setActiveTab}>
          <Tabs.List mb="md">
            {tabDefs.map((t) => {
              const Icon = t.icon;
              return (
                <Tabs.Tab key={t.value} value={t.value} leftSection={<Icon size={15} />}>
                  {t.label}
                </Tabs.Tab>
              );
            })}
          </Tabs.List>

          {tabDefs.map((t) => (
            <Tabs.Panel key={t.value} value={t.value}>
              <Text size="xs" c="dimmed" mb="sm">
                Menampilkan {filteredRows.length} lot.
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
                      {qcColumns.map((col) => (
                        <Table.Th
                          key={col.key}
                          style={{
                            color: "#fff",
                            fontSize: 11,
                            cursor: "pointer",
                            userSelect: "none",
                          }}
                          onClick={() => {
                            if (qcSortKey === col.key) {
                              setQcSortDir((d) => (d === "asc" ? "desc" : "asc"));
                            } else {
                              setQcSortKey(col.key);
                              setQcSortDir("asc");
                            }
                          }}
                        >
                          {col.label}
                          {qcSortKey === col.key
                            ? qcSortDir === "asc"
                              ? " ▲"
                              : " ▼"
                            : ""}
                        </Table.Th>
                      ))}
                      <Table.Th style={{ color: "#fff", fontSize: 11 }}>
                        Aksi
                      </Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {sortedRows.length === 0 ? (
                      <Table.Tr>
                        <Table.Td colSpan={8} ta="center" c="dimmed" py="xl">
                          Tidak ada data.
                        </Table.Td>
                      </Table.Tr>
                    ) : (
                      sortedRows.map((r, i) => (
                        <Table.Tr key={i}>
                          <Table.Td>
                            <Badge size="xs" variant="light" color="gray">
                              {r.idStock}
                            </Badge>
                          </Table.Td>
                          <Table.Td fw={500}>{r.namaBarang}</Table.Td>
                          <Table.Td>
                            <Badge size="xs" variant="light" color="blue">
                              {r.lokasiRak}
                            </Badge>
                          </Table.Td>
                          <Table.Td>
                            <Badge size="xs" variant="light" color="gray">
                              {r.nomorBatch}
                            </Badge>
                          </Table.Td>
                          <Table.Td>{r.tanggalExpired}</Table.Td>
                          <Table.Td>
                            <Badge
                              size="xs"
                              color={
                                r.daysToExpired < 0
                                  ? "red"
                                  : r.daysToExpired <= 30
                                    ? "orange"
                                    : "green"
                              }
                            >
                              {r.daysToExpired} hari
                            </Badge>
                          </Table.Td>
                          <Table.Td>
                            <Badge
                              size="xs"
                              color={
                                r.status === "HOLD"
                                  ? "yellow"
                                  : r.status === "RELEASE"
                                    ? "green"
                                    : "gray"
                              }
                            >
                              {r.status}
                            </Badge>
                          </Table.Td>
                          <Table.Td>
                            <Group gap={4}>
                              <Select
                                size="xs"
                                data={["GOOD", "HOLD", "RELEASE", "REJECT"]}
                                value={statusChanges[r.idStock] || r.status}
                                onChange={(v) =>
                                  setStatusChanges((prev) => ({
                                    ...prev,
                                    [r.idStock]: v || r.status,
                                  }))
                                }
                                style={{ width: 110 }}
                              />
                              {statusChanges[r.idStock] &&
                                statusChanges[r.idStock] !== r.status && (
                                  <Button
                                    size="xs"
                                    variant="light"
                                    color="green"
                                    onClick={() =>
                                      handleStatusChange(r.idStock)
                                    }
                                  >
                                    Simpan
                                  </Button>
                                )}
                            </Group>
                          </Table.Td>
                        </Table.Tr>
                      ))
                    )}
                  </Table.Tbody>
                </Table>
              </Box>
            </Tabs.Panel>
          ))}
        </Tabs>
      </Paper>
    </Box>
  );
}
