"use client";
import { useState, useEffect } from "react";
import {
  Title,
  Table,
  Group,
  TextInput,
  Select,
  Badge,
  Text,
  Box,
  Paper,
  Tabs,
  Button,
  Textarea,
  Stack,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import {
  IconPackages,
  IconCircleCheck,
  IconLock,
  IconX,
  IconListDetails,
  IconUpload,
} from "@tabler/icons-react";
import api from "../lib/api";

export default function StockPage() {
  const [stocks, setStocks] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [filterBarang, setFilterBarang] = useState<string | null>(null);
  const [filterRak, setFilterRak] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<string | null>("all");
  const [csvText, setCsvText] = useState("");
  const [importResult, setImportResult] = useState<any>(null);
  const [importLoading, setImportLoading] = useState(false);
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  const handleSort = (key: string) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  const sortData = (data: any[]) => {
    if (!sortKey) return data;
    return [...data].sort((a, b) => {
      let aVal = a[sortKey];
      let bVal = b[sortKey];
      if (aVal == null) aVal = "";
      if (bVal == null) bVal = "";
      if (typeof aVal === "number" && typeof bVal === "number") {
        return sortDir === "asc" ? aVal - bVal : bVal - aVal;
      }
      const cmp = String(aVal).localeCompare(String(bVal), undefined, { numeric: true });
      return sortDir === "asc" ? cmp : -cmp;
    });
  };

  const sortIcon = (key: string) => {
    if (sortKey !== key) return " ↕";
    return sortDir === "asc" ? " ▲" : " ▼";
  };

  const columns = [
    { label: "ID Stock", key: "idStock" },
    { label: "Barang", key: "namaBarang" },
    { label: "Rak", key: "lokasiRak" },
    { label: "Batch", key: "nomorBatch" },
    { label: "Produksi", key: "tanggalProduksi" },
    { label: "Expired", key: "tanggalExpired" },
    { label: "Status", key: "status" },
    { label: "Sisa", key: "stockOnhand" },
    { label: "Satuan", key: "satuan" },
  ];

  useEffect(() => {
      api
        .get("/stock?available=true")
        .then((r: any) => setStocks(r || []))
        .catch(() => {});
  }, []);

  const barangOpts = [...new Set(stocks.map((s) => s.namaBarang).filter(Boolean))].sort();
  const rakOpts = [...new Set(stocks.map((s) => s.lokasiRak).filter(Boolean))].sort();

  const filtered = stocks.filter(
    (s) =>
      (!search ||
        s.namaBarang?.toLowerCase().includes(search.toLowerCase()) ||
        s.idStock?.toLowerCase().includes(search.toLowerCase()) ||
        s.lokasiRak?.toLowerCase().includes(search.toLowerCase()) ||
        s.nomorBatch?.toLowerCase().includes(search.toLowerCase())) &&
      (!filterBarang || s.namaBarang === filterBarang) &&
      (!filterRak || s.lokasiRak === filterRak),
  );

  const tabDefs = [
    { value: "all", label: "All", icon: IconListDetails, filter: () => true },
    { value: "GOOD", label: "GOOD", icon: IconCircleCheck, filter: (s: any) => s.status === "GOOD" },
    { value: "HOLD", label: "HOLD", icon: IconLock, filter: (s: any) => s.status === "HOLD" },
    { value: "REJECT", label: "REJECT", icon: IconX, filter: (s: any) => s.status === "REJECT" },
  ];

  const tabData = tabDefs.reduce(
    (acc, t) => {
      acc[t.value] = filtered.filter(t.filter);
      return acc;
    },
    {} as Record<string, any[]>,
  );

  const currentData = sortData(tabData[activeTab || "all"] || []);

  const statusBadge = (status: string) => {
    const color =
      status === "GOOD"
        ? "green"
        : status === "HOLD"
          ? "yellow"
          : status === "REJECT"
            ? "red"
            : "gray";
    return (
      <Badge size="xs" color={color}>
        {status}
      </Badge>
    );
  };

  const handleImportCsv = async () => {
    setImportLoading(true);
    try {
      const res: any = await api.post("/stock/import-csv", { csvText });
      setImportResult(res);
      notifications.show({
        title: "Import Selesai",
        message: res?.message || "CSV diproses",
        color: res?.failed ? "orange" : "green",
      });
      setCsvText("");
      api
      .get("/stock?available=true")
        .then((r: any) => setStocks(r || []))
        .catch(() => {});
    } catch (err: any) {
      notifications.show({
        title: "Gagal",
        message: err.response?.data?.message || "Error",
        color: "red",
      });
    } finally {
      setImportLoading(false);
    }
  };

  return (
    <Box>
      {/* Header */}
      <Box
        style={{
          background: "#fff",
          borderLeft: "4px solid #f59e0b",
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
              <IconPackages size={20} style={{ color: "#f59e0b" }} />
              STOCK ONHAND
            </Title>
            <Text size="xs" c="dimmed" mt={2}>
              Seluruh stok barang di gudang, termasuk riwayat masuk/keluar per
              lot.
            </Text>
          </Box>
          <Badge color="yellow" variant="light" size="lg">
            Inventory Stock
          </Badge>
        </Group>
      </Box>

      <Paper withBorder p="md" radius="md">
        <Group mb="md" wrap="wrap">
          <TextInput
            placeholder="Cari barang, ID stock, rak, batch..."
            value={search}
            onChange={(e) => setSearch(e.currentTarget.value)}
            style={{ flex: 1, minWidth: 200 }}
          />
          <Select
            size="xs"
            placeholder="Filter Barang"
            data={barangOpts}
            value={filterBarang}
            onChange={setFilterBarang}
            clearable
            style={{ width: 160 }}
          />
          <Select
            size="xs"
            placeholder="Filter Rak"
            data={rakOpts}
            value={filterRak}
            onChange={setFilterRak}
            clearable
            style={{ width: 140 }}
          />
        </Group>

        <Tabs value={activeTab} onChange={setActiveTab}>
          <Tabs.List mb="md">
            {tabDefs.map((t) => {
              const Icon = t.icon;
              return (
                <Tabs.Tab key={t.value} value={t.value} leftSection={<Icon size={15} />}>
                  {t.label}{" "}
                  <Badge ml={6} color={t.value === "all" ? "gray" : t.value === "GOOD" ? "green" : t.value === "HOLD" ? "yellow" : "red"} size="xs">
                    {tabData[t.value].length}
                  </Badge>
                </Tabs.Tab>
              );
            })}
            <Tabs.Tab value="import" leftSection={<IconUpload size={15} />}>
              Import CSV{" "}
            </Tabs.Tab>
          </Tabs.List>

          {tabDefs.map((t) => (
            <Tabs.Panel key={t.value} value={t.value}>
              <Text size="xs" c="dimmed" mb="sm">
                Menampilkan {currentData.length} lot.
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
                      {columns.map((c) => (
                        <Table.Th
                          key={c.key}
                          style={{ color: "#fff", fontSize: 11, cursor: "pointer", userSelect: "none" }}
                          onClick={() => handleSort(c.key)}
                        >
                          {c.label}{sortIcon(c.key)}
                        </Table.Th>
                      ))}
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {currentData.length === 0 ? (
                      <Table.Tr>
                        <Table.Td colSpan={11} ta="center" c="dimmed" py="xl">
                          Tidak ada data stok.
                        </Table.Td>
                      </Table.Tr>
                    ) : (
                      currentData.map((s: any, i: number) => (
                        <Table.Tr key={i}>
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
                          <Table.Td>{s.tanggalProduksi}</Table.Td>
                          <Table.Td>{s.tanggalExpired}</Table.Td>
                          <Table.Td>{statusBadge(s.status)}</Table.Td>
                          <Table.Td ta="right" fw={700} c={s.stockOnhand > 0 ? "green" : "red"}>
                            {s.stockOnhand} {s.satuan}
                          </Table.Td>
                          <Table.Td>{s.satuan}</Table.Td>
                        </Table.Tr>
                      ))
                    )}
                  </Table.Tbody>
                </Table>
              </Box>
            </Tabs.Panel>
          ))}

          <Tabs.Panel value="import">
            <Stack>
              <Text size="xs" c="dimmed">
                Paste konten CSV di bawah. Header wajib: namaBarang, lokasiRak,
                tanggalProduksi, qty. Optional: nomorBatch, tanggalExpired,
                status, satuan, nomorBstb, tanggalBstb.
              </Text>
              <Textarea
                value={csvText}
                onChange={(e) => setCsvText(e.currentTarget.value)}
                placeholder={`namaBarang,nomorBatch,tanggalProduksi,tanggalExpired,status,lokasiRak,qty,satuan,nomorBstb,tanggalBstb\nNugget,B001,2026-01-01,2026-07-01,GOOD,R-A-01,50,Carton,BSTB-001,2026-01-02`}
                minRows={8}
                style={{ fontFamily: "monospace", fontSize: 12 }}
              />
              <Group>
                <Button
                  size="xs"
                  color="orange"
                  leftSection={<IconUpload size={14} />}
                  onClick={handleImportCsv}
                  loading={importLoading}
                  disabled={!csvText.trim()}
                >
                  Import Stock
                </Button>
              </Group>
              {importResult && (
                <Box
                  p="sm"
                  style={{
                    background: importResult.failed
                      ? "#fff7ed"
                      : "#f0fdf4",
                    border: `1px solid ${importResult.failed ? "#fed7aa" : "#86efac"}`,
                    borderRadius: 8,
                  }}
                >
                  <Text size="sm" fw={700} c={importResult.failed ? "orange" : "green"}>
                    {importResult.message}
                  </Text>
                  {importResult.errors?.length > 0 && (
                    <Stack gap={2} mt="xs">
                      {importResult.errors.map((e: string, i: number) => (
                        <Text key={i} size="xs" c="red">
                          {e}
                        </Text>
                      ))}
                    </Stack>
                  )}
                </Box>
              )}
            </Stack>
          </Tabs.Panel>
        </Tabs>
      </Paper>
    </Box>
  );
}
