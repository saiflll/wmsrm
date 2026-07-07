"use client";
import { useState, useEffect } from "react";
import {
  Title,
  Table,
  Group,
  TextInput,
  Select,
  Stack,
  Text,
  Badge,
  Box,
  Paper,
  Tabs,
  Button,
} from "@mantine/core";
import {
  IconArrowsExchange,
  IconArrowUp,
  IconArrowDown,
  IconArrowsShuffle,
  IconAdjustmentsHorizontal,
  IconDownload,
} from "@tabler/icons-react";
import api from "../lib/api";

export default function MutasiPage() {
  const [mutasiList, setMutasiList] = useState<any[]>([]);
  const [filterJenis, setFilterJenis] = useState("");
  const [activeTab, setActiveTab] = useState<string | null>("all");
  const [mutasiFilterBarang, setMutasiFilterBarang] = useState<string | null>(null);
  const [mutasiFilterRak, setMutasiFilterRak] = useState<string | null>(null);
  const [mutasiSortKey, setMutasiSortKey] = useState<string | null>(null);
  const [mutasiSortDir, setMutasiSortDir] = useState<"asc" | "desc">("asc");

  const mutasiSortData = (data: any[], key: string | null, dir: "asc" | "desc") => {
    if (!key) return data;
    return [...data].sort((a, b) => {
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

  const mutasiColumns = [
    { label: "Tanggal", key: "tanggalTransaksi" },
    { label: "Jenis", key: "jenisMutasi" },
    { label: "Barang", key: "namaBarang" },
    { label: "Batch", key: "nomorBatch" },
    { label: "Rak", key: "lokasiRak" },
    { label: "In", key: "qtyMasuk" },
    { label: "Out", key: "qtyKeluar" },
    { label: "Saldo", key: "saldoAkhirLot" },
    { label: "Stock ID", key: "idStock" },
    { label: "User", key: "namaUserTransaksi" },
  ];

  useEffect(() => {
    const params: any = {};
    if (filterJenis) params.jenis = filterJenis;
    api
      .get("/mutasi", { params })
      .then((res: any) => setMutasiList(res || []))
      .catch(() => {});
  }, [filterJenis]);

  const jenisTabs = [
    { value: "all", label: "Semua", icon: IconArrowsExchange, color: "gray" },
    { value: "IN", label: "IN", icon: IconArrowDown, color: "green" },
    { value: "OUT", label: "OUT", icon: IconArrowUp, color: "red" },
    { value: "PINDAH_LOKASI", label: "Pindah Lokasi", icon: IconArrowsShuffle, color: "blue" },
    { value: "KOREKSI OUT TAMBAH", label: "Koreksi (+)", icon: IconAdjustmentsHorizontal, color: "orange" },
    { value: "KOREKSI OUT KURANG", label: "Koreksi (-)", icon: IconAdjustmentsHorizontal, color: "violet" },
  ];

  const mutasiBarangOpts = [...new Set(mutasiList.map((m) => m.namaBarang).filter(Boolean))].sort();
  const mutasiRakOpts = [...new Set(mutasiList.map((m) => m.lokasiRak).filter(Boolean))].sort();

  const filtered = (() => {
    let items = mutasiList;
    if (activeTab !== "all") {
      items = items.filter((m) => m.jenisMutasi === activeTab);
    }
    if (mutasiFilterBarang) {
      items = items.filter((m) => m.namaBarang === mutasiFilterBarang);
    }
    if (mutasiFilterRak) {
      items = items.filter((m) => m.lokasiRak === mutasiFilterRak);
    }
    return items;
  })();

  const tabCounts = jenisTabs.reduce(
    (acc, t) => {
      if (t.value === "all") acc.all = mutasiList.length;
      else acc[t.value] = mutasiList.filter((m) => m.jenisMutasi === t.value).length;
      return acc;
    },
    {} as Record<string, number>,
  );

  const exportCsv = () => {
    const headers = [
      "Tanggal Transaksi",
      "Jenis Mutasi",
      "Nama Barang",
      "Nomor Batch",
      "Lokasi Rak",
      "Qty Masuk",
      "Qty Keluar",
      "Saldo Akhir Lot",
      "ID Stock",
      "Satuan",
      "User",
    ];
    const rows = filtered.map((m: any) => [
      m.tanggalTransaksi,
      m.jenisMutasi,
      m.namaBarang,
      m.nomorBatch,
      m.lokasiRak,
      m.qtyMasuk || 0,
      m.qtyKeluar || 0,
      m.saldoAkhirLot,
      m.idStock,
      m.satuan,
      m.namaUserTransaksi,
    ]);
    const csv = [headers, ...rows]
      .map((r) =>
        r
          .map((cell) => {
            const v = cell === null || cell === undefined ? "" : String(cell);
            return `"${v.replace(/"/g, '""')}"`;
          })
          .join(","),
      )
      .join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `mutasi-${activeTab}-${new Date().toISOString().split("T")[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <Box>
      {/* Header */}
      <Box
        style={{
          background: "#fff",
          borderLeft: "4px solid #0ea5e9",
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
              <IconArrowsExchange size={20} style={{ color: "#0ea5e9" }} />
              MUTASI BARANG
            </Title>
            <Text size="xs" c="dimmed" mt={2}>
              Riwayat pergerakan stok barang di gudang (IN / OUT / Pindah Lokasi /
              Koreksi).
            </Text>
          </Box>
          <Badge color="cyan" variant="light" size="lg">
            Stock Movement
          </Badge>
        </Group>
      </Box>

      <Paper withBorder p="md" radius="md">
        <Group mb="md" wrap="wrap">
          <Select
            size="xs"
            placeholder="Filter Barang"
            data={mutasiBarangOpts}
            value={mutasiFilterBarang}
            onChange={setMutasiFilterBarang}
            clearable
            searchable
            style={{ width: 180 }}
          />
          <Select
            size="xs"
            placeholder="Filter Rak"
            data={mutasiRakOpts}
            value={mutasiFilterRak}
            onChange={setMutasiFilterRak}
            clearable
            searchable
            style={{ width: 140 }}
          />
        </Group>
        <Tabs value={activeTab} onChange={setActiveTab}>
          <Group justify="space-between" mb="md">
            <Tabs.List>
              {jenisTabs.map((t) => {
                const Icon = t.icon;
                return (
                  <Tabs.Tab key={t.value} value={t.value} leftSection={<Icon size={15} />}>
                    {t.label}{" "}
                    <Badge ml={6} color={t.color} size="xs">
                      {tabCounts[t.value] || 0}
                    </Badge>
                  </Tabs.Tab>
                );
              })}
            </Tabs.List>
            <Button
              size="xs"
              variant="light"
              color="cyan"
              leftSection={<IconDownload size={14} />}
              onClick={exportCsv}
            >
              Export CSV
            </Button>
          </Group>

          {jenisTabs.map((t) => (
            <Tabs.Panel key={t.value} value={t.value}>
              <Text size="xs" c="dimmed" mb="sm">
                Menampilkan {filtered.length} transaksi mutasi.
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
                      {mutasiColumns.map((c) => (
                        <Table.Th
                          key={c.key}
                          style={{
                            color: "#fff",
                            fontSize: 11,
                            cursor: "pointer",
                            userSelect: "none",
                          }}
                          onClick={() => {
                            if (mutasiSortKey === c.key) {
                              setMutasiSortDir((d) =>
                                d === "asc" ? "desc" : "asc",
                              );
                            } else {
                              setMutasiSortKey(c.key);
                              setMutasiSortDir("asc");
                            }
                          }}
                        >
                          {c.label}
                          {mutasiSortKey !== c.key
                            ? " ↕"
                            : mutasiSortDir === "asc"
                              ? " ▲"
                              : " ▼"}
                        </Table.Th>
                      ))}
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {mutasiSortData(filtered, mutasiSortKey, mutasiSortDir).length === 0 ? (
                      <Table.Tr>
                        <Table.Td colSpan={10} ta="center" c="dimmed" py="xl">
                          Tidak ada data mutasi.
                        </Table.Td>
                      </Table.Tr>
                    ) : (
                      mutasiSortData(filtered, mutasiSortKey, mutasiSortDir).map((m: any, i: number) => (
                        <Table.Tr key={i}>
                          <Table.Td>{m.tanggalTransaksi}</Table.Td>
                          <Table.Td>
                            <Badge
                              size="xs"
                              color={
                                m.jenisMutasi === "IN"
                                  ? "green"
                                  : m.jenisMutasi === "OUT"
                                    ? "red"
                                    : m.jenisMutasi === "PINDAH_LOKASI"
                                      ? "blue"
                                      : "orange"
                              }
                            >
                              {m.jenisMutasi}
                            </Badge>
                          </Table.Td>
                          <Table.Td fw={500}>{m.namaBarang}</Table.Td>
                          <Table.Td>
                            <Badge size="xs" variant="light" color="gray">
                              {m.nomorBatch}
                            </Badge>
                          </Table.Td>
                          <Table.Td>
                            <Badge size="xs" variant="light" color="blue">
                              {m.lokasiRak}
                            </Badge>
                          </Table.Td>
                          <Table.Td ta="right" fw={700} c="green">
                            {m.qtyMasuk || "-"}
                          </Table.Td>
                          <Table.Td ta="right" fw={700} c="red">
                            {m.qtyKeluar || "-"}
                          </Table.Td>
                          <Table.Td ta="right" fw={700}>
                            {m.saldoAkhirLot}
                          </Table.Td>
                          <Table.Td>
                            <Badge size="xs" variant="light" color="gray">
                              {m.idStock}
                            </Badge>
                          </Table.Td>
                          <Table.Td>{m.namaUserTransaksi}</Table.Td>
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
