"use client";
import { useState, useEffect } from "react";
import {
  Title,
  Table,
  Group,
  TextInput,
  Button,
  Text,
  Badge,
  Box,
  Paper,
  Tabs,
  Select,
  Stack,
  SimpleGrid,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import {
  IconReportAnalytics,
  IconArrowUp,
  IconArrowDown,
  IconPackage,
  IconCalendar,
  IconListDetails,
  IconDownload,
  IconClock,
  IconFileAnalytics,
} from "@tabler/icons-react";
import api from "../lib/api";

const sortData = (data: any[], key: string | null, dir: "asc" | "desc") => {
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

export default function ReportPage() {
  const [mutasiList, setMutasiList] = useState<any[]>([]);
  const [stockList, setStockList] = useState<any[]>([]);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [reportFilterBarang, setReportFilterBarang] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<string | null>("summary");
  const [motionRows, setMotionRows] = useState<any[]>([]);
  const [motionSummary, setMotionSummary] = useState<any>({});
  const [motionLoading, setMotionLoading] = useState(false);
  const [motionType, setMotionType] = useState<string>("ALL");
  const [summarySortKey, setSummarySortKey] = useState<string | null>(null);
  const [summarySortDir, setSummarySortDir] = useState<"asc" | "desc">("asc");
  const [stockSortKey, setStockSortKey] = useState<string | null>(null);
  const [stockSortDir, setStockSortDir] = useState<"asc" | "desc">("asc");
  const [motionSortKey, setMotionSortKey] = useState<string | null>(null);
  const [motionSortDir, setMotionSortDir] = useState<"asc" | "desc">("asc");
  const [reportInOut, setReportInOut] = useState<any>(null);
  const [reportInOutLoading, setReportInOutLoading] = useState(false);

  const toggleSort = (
    key: string,
    curKey: string | null,
    curDir: "asc" | "desc",
    setKey: (k: string | null) => void,
    setDir: (d: "asc" | "desc") => void,
  ) => {
    if (curKey === key) {
      setDir(curDir === "asc" ? "desc" : "asc");
    } else {
      setKey(key);
      setDir("asc");
    }
  };

  const sortIcon = (key: string, curKey: string | null, curDir: "asc" | "desc") => {
    if (curKey !== key) return " ↕";
    return curDir === "asc" ? " ▲" : " ▼";
  };

  const reportSummaryColumns = [
    { label: "Tanggal", key: "tanggal" },
    { label: "Barang", key: "namaBarang" },
    { label: "Inbound", key: "in" },
    { label: "Outbound", key: "out" },
    { label: "Net", key: "net" },
  ];

  const reportStockColumns = [
    { label: "Barang", key: "namaBarang" },
    { label: "Status", key: "status" },
    { label: "Total Qty", key: "total" },
    { label: "Jumlah Lot", key: "count" },
    { label: "Expired Terdekat", key: "nearestExp" },
  ];

  const reportMotionColumns = [
    { label: "Jenis", key: "jenis" },
    { label: "Tanggal", key: "tanggal" },
    { label: "Referensi", key: "referensi" },
    { label: "Objek", key: "barangResto" },
    { label: "Waktu", key: "start" },
    { label: "Durasi", key: "durasiMenit" },
    { label: "PIC/Team", key: "koordinatorTeam" },
  ];

  const parseWaktuCs = (text: string) => {
    if (!text) return null;
    const [m, s] = text.split(":").map((v) => parseInt(v, 10));
    if (isNaN(m) || isNaN(s)) return null;
    return m + s / 60;
  };

  const sameDay = (a: Date, b: Date) =>
    a.toISOString().split("T")[0] === b.toISOString().split("T")[0];

  const formatDuration = (minutes: number | null) => {
    if (minutes === null || minutes === undefined || isNaN(minutes)) return "-";
    const m = Math.floor(minutes);
    const s = Math.round((minutes - m) * 60);
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  const loadMotion = async () => {
    setMotionLoading(true);
    try {
      const params: any = {};
      if (startDate) params.startDate = startDate;
      if (endDate) params.endDate = endDate;
      const [bmRes, otdrRes]: [any, any] = await Promise.all([
        api.get("/barang-masuk", { params }),
        api.get("/otdr", { params }),
      ]);
      const bmRows: any[] = (bmRes || []).sort(
        (a: any, b: any) =>
          new Date(a.timestampInput).getTime() -
          new Date(b.timestampInput).getTime(),
      );
      const otdrRows: any[] = otdrRes || [];
      const rows: any[] = [];

      // INBOUND
      if (motionType === "ALL" || motionType === "IN") {
        bmRows.forEach((item: any, index: number) => {
          const prev = index > 0 ? bmRows[index - 1] : null;
          const hasPrevSameDay =
            prev &&
            sameDay(new Date(item.timestampInput), new Date(prev.timestampInput));
          const waktuCsManual = parseWaktuCs(item.waktuMasukCS);
          const durasiInterval = hasPrevSameDay
            ? (new Date(item.timestampInput).getTime() -
                new Date(prev.timestampInput).getTime()) /
              60000
            : null;
          const durasi =
            waktuCsManual !== null ? waktuCsManual : durasiInterval;
          const manualCs = waktuCsManual !== null;

          rows.push({
            jenis: "IN",
            tanggal: item.tanggalBstb,
            referensi: item.nomorBstb,
            barangResto: item.namaBarang,
            qty: item.totalQty,
            satuan: item.satuan,
            koordinatorTeam: item.namaUserTransaksi,
            lokasi: item.lokasiRak,
            startLabel: "Jam In",
            endLabel: manualCs ? "Durasi Masuk CS" : "Jam In Sebelumnya",
            start: new Date(item.timestampInput).toLocaleString("id-ID"),
            selesai: manualCs
              ? item.waktuMasukCS
              : hasPrevSameDay
                ? new Date(prev.timestampInput).toLocaleString("id-ID")
                : "-",
            durasiMenit: durasi,
            status: manualCs
              ? "TERUKUR MANUAL MASUK CS"
              : durasi === null
                ? "AWAL DATA / BELUM ADA PEMBANDING"
                : "TERUKUR DARI INTERVAL JAM IN",
            detail: `Jam In: ${item.jamIn} | Batch: ${item.nomorBatch} | User: ${item.namaUserTransaksi}`,
          });
        });
      }

      // OUTBOUND
      if (motionType === "ALL" || motionType === "OUT") {
        otdrRows.forEach((item: any) => {
          const start = item.startMuat ? new Date(item.startMuat) : null;
          const selesai = item.selesaiMuat ? new Date(item.selesaiMuat) : null;
          let durasi: number | null = null;
          if (start && selesai && selesai.getTime() > start.getTime()) {
            durasi = (selesai.getTime() - start.getTime()) / 60000;
          }
          rows.push({
            jenis: "OUT",
            tanggal: item.tanggalDimuat,
            referensi: item.nomorSuratJalan,
            barangResto: `${item.kodeResto} - ${item.namaResto}`,
            qty: item.totalQtyOutput,
            satuan: "Qty",
            koordinatorTeam: item.namaNamaYangMuat,
            lokasi: item.nopol,
            startLabel: "Start Muat",
            endLabel: "Selesai Muat",
            start: start ? start.toLocaleString("id-ID") : "-",
            selesai: selesai ? selesai.toLocaleString("id-ID") : "-",
            durasiMenit: durasi,
            status:
              durasi === null
                ? start && selesai
                  ? "CEK JAM: SELESAI LEBIH AWAL"
                  : "BELUM TERUKUR"
                : item.statusOtdr || "TERUKUR",
            detail: `OTDR: ${item.idOtdr} | Sopir: ${item.namaSopir} | Team: ${item.namaNamaYangMuat}`,
          });
        });
      }

      rows.sort(
        (a, b) =>
          new Date(b.tanggal || 0).getTime() -
          new Date(a.tanggal || 0).getTime(),
      );

      const measured = rows.filter((r) => r.durasiMenit !== null);
      const inRows = measured.filter((r) => r.jenis === "IN");
      const outRows = measured.filter((r) => r.jenis === "OUT");
      const avg = (arr: any[]) =>
        arr.length ? arr.reduce((s, r) => s + r.durasiMenit, 0) / arr.length : 0;

      setMotionRows(rows);
      setMotionSummary({
        totalInTerukur: inRows.length,
        totalOutTerukur: outRows.length,
        rataInMenit: avg(inRows),
        rataOutMenit: avg(outRows),
        rataSemuaMenit: avg(measured),
        belumTerukur: rows.filter((r) => r.durasiMenit === null).length,
        totalData: rows.length,
      });
    } catch (e) {
      notifications.show({
        title: "Gagal",
        message: "Gagal memuat time motion study.",
        color: "red",
      });
    } finally {
      setMotionLoading(false);
    }
  };

  const load = () => {
    const params: any = {};
    if (startDate) params.startDate = startDate;
    if (endDate) params.endDate = endDate;
    api
      .get("/mutasi", { params })
      .then((res: any) => setMutasiList(res || []))
      .catch(() => {});
  };

  const loadReportInOut = async () => {
    setReportInOutLoading(true);
    try {
      const params: any = {};
      if (startDate) params.startDate = startDate;
      if (endDate) params.endDate = endDate;
      const res: any = await api.get("/report/inbound-outbound", { params });
      setReportInOut(res);
    } catch (e) {
      notifications.show({
        title: "Gagal",
        message: "Gagal memuat report inbound/outbound.",
        color: "red",
      });
    } finally {
      setReportInOutLoading(false);
    }
  };

  const loadStock = () => {
    api
      .get("/stock?available=false")
      .then((res: any) => setStockList(res || []))
      .catch(() => {});
  };

  useEffect(() => {
    load();
    loadStock();
  }, []);

  const barangOptsReport = [...new Set(mutasiList.map((m) => m.namaBarang).filter(Boolean))].sort();
  const filteredMutasi = reportFilterBarang
    ? mutasiList.filter((m) => m.namaBarang === reportFilterBarang)
    : mutasiList;

  const inbound = filteredMutasi.filter((m) => m.jenisMutasi === "IN");
  const outbound = filteredMutasi.filter((m) => m.jenisMutasi === "OUT");

  const totalIn = inbound.reduce((s, m) => s + (m.qtyMasuk || 0), 0);
  const totalOut = outbound.reduce((s, m) => s + (m.qtyKeluar || 0), 0);

  // Summary per item per day
  const dailySummary: Record<string, { in: number; out: number }> = {};
  filteredMutasi.forEach((m) => {
    const key = `${m.tanggalTransaksi}|${m.namaBarang}`;
    if (!dailySummary[key]) dailySummary[key] = { in: 0, out: 0 };
    if (m.jenisMutasi === "IN") dailySummary[key].in += m.qtyMasuk || 0;
    if (m.jenisMutasi === "OUT") dailySummary[key].out += m.qtyKeluar || 0;
  });
  const dailyRows = Object.entries(dailySummary)
    .map(([key, v]) => {
      const [tanggal, namaBarang] = key.split("|");
      return { tanggal, namaBarang, ...v, net: v.in - v.out };
    })
    .sort((a, b) => a.tanggal.localeCompare(b.tanggal) || a.namaBarang.localeCompare(b.namaBarang));

  // Grouped stock report
  const groupedStock: Record<string, any[]> = {};
  stockList.forEach((s) => {
    const key = `${s.namaBarang}|${s.status}`;
    if (!groupedStock[key]) groupedStock[key] = [];
    groupedStock[key].push(s);
  });
  const groupedRows = Object.entries(groupedStock)
    .map(([key, rows]) => {
      const [namaBarang, status] = key.split("|");
      const total = rows.reduce((sum, r) => sum + (r.stockOnhand || 0), 0);
      const nearestExp = rows
        .filter((r) => r.tanggalExpired)
        .sort(
          (a, b) =>
            new Date(a.tanggalExpired).getTime() -
            new Date(b.tanggalExpired).getTime(),
        )[0]?.tanggalExpired;
      return { namaBarang, status, total, count: rows.length, nearestExp };
    })
    .sort((a, b) => a.namaBarang.localeCompare(b.namaBarang));

  const exportCsv = () => {
    let rows: any[] = [];
    let headers: string[] = [];
    if (activeTab === "summary") {
      headers = ["Tanggal", "Nama Barang", "Inbound", "Outbound"];
      rows = dailyRows.map((r) => [r.tanggal, r.namaBarang, r.in, r.out]);
    } else if (activeTab === "stock") {
      headers = ["Nama Barang", "Status", "Total Qty", "Jumlah Lot", "Expired Terdekat"];
      rows = groupedRows.map((r) => [r.namaBarang, r.status, r.total, r.count, r.nearestExp || "-"]);
    } else if (activeTab === "inout") {
      if (!reportInOut) return;
      headers = ["Nama Barang", "Satuan", "Inbound", "Outbound", "Net"];
      rows = (reportInOut.rangeRows || []).map((r: any) => [r.namaBarang, r.satuan, r.inbound, r.outbound, r.net]);
    } else if (activeTab === "motion") {
      headers = ["Jenis", "Tanggal", "Referensi", "Barang/Resto", "Qty", "Start", "Selesai", "Durasi Menit", "Status", "PIC/Team"];
      rows = motionRows.map((r) => [
        r.jenis,
        r.tanggal,
        r.referensi,
        r.barangResto,
        r.qty,
        r.start,
        r.selesai,
        r.durasiMenit === null ? "" : Math.round(r.durasiMenit * 100) / 100,
        r.status,
        r.koordinatorTeam,
      ]);
    } else {
      headers = ["Tanggal", "Jenis", "Barang", "Batch", "Rak", "Qty", "Saldo", "User"];
      const data = activeTab === "inbound" ? inbound : outbound;
      rows = data.map((m) => [
        m.tanggalTransaksi,
        m.jenisMutasi,
        m.namaBarang,
        m.nomorBatch,
        m.lokasiRak,
        activeTab === "inbound" ? m.qtyMasuk : m.qtyKeluar,
        m.saldoAkhirLot,
        m.namaUserTransaksi,
      ]);
    }
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
    a.download = `report-${activeTab}-${new Date().toISOString().split("T")[0]}.csv`;
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
          borderLeft: "4px solid #6366f1",
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
              <IconReportAnalytics size={20} style={{ color: "#6366f1" }} />
              REPORT INBOUND / OUTBOUND
            </Title>
            <Text size="xs" c="dimmed" mt={2}>
              Laporan mutasi, summary per item/hari, dan stock grouped.
            </Text>
          </Box>
          <Badge color="indigo" variant="light" size="lg">
            Report
          </Badge>
        </Group>

        <Group mt="sm" wrap="wrap">
          <TextInput
            size="xs"
            label="Dari Tanggal"
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.currentTarget.value)}
          />
          <TextInput
            size="xs"
            label="Sampai Tanggal"
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.currentTarget.value)}
          />
          <Select
            size="xs"
            label="Barang"
            placeholder="Semua Barang"
            data={barangOptsReport}
            value={reportFilterBarang}
            onChange={setReportFilterBarang}
            clearable
            searchable
            style={{ width: 180 }}
          />
          <Button size="xs" onClick={load} mt="md">
            Filter
          </Button>
        </Group>

        <Group mt="sm" gap="xl">
          <Text size="sm">
            Total Inbound:{" "}
            <Text span fw={700} c="green">
              {totalIn}
            </Text>
          </Text>
          <Text size="sm">
            Total Outbound:{" "}
            <Text span fw={700} c="red">
              {totalOut}
            </Text>
          </Text>
        </Group>
      </Box>

      <Paper withBorder p="md" radius="md">
        <Tabs value={activeTab} onChange={setActiveTab}>
          <Group justify="space-between" mb="md">
            <Tabs.List>
              <Tabs.Tab value="summary" leftSection={<IconCalendar size={15} />}>
                Summary/Hari{" "}
                <Badge ml={6} color="blue" size="xs">
                  {dailyRows.length}
                </Badge>
              </Tabs.Tab>
              <Tabs.Tab value="stock" leftSection={<IconPackage size={15} />}>
                Stock Grouped{" "}
                <Badge ml={6} color="violet" size="xs">
                  {groupedRows.length}
                </Badge>
              </Tabs.Tab>
              <Tabs.Tab value="inbound" leftSection={<IconArrowDown size={15} />}>
                INBOUND{" "}
                <Badge ml={6} color="green" size="xs">
                  {inbound.length}
                </Badge>
              </Tabs.Tab>
              <Tabs.Tab value="outbound" leftSection={<IconArrowUp size={15} />}>
                OUTBOUND{" "}
                <Badge ml={6} color="red" size="xs">
                  {outbound.length}
                </Badge>
              </Tabs.Tab>
              <Tabs.Tab value="motion" leftSection={<IconClock size={15} />}>
                TIME MOTION{" "}
                <Badge ml={6} color="orange" size="xs">
                  {motionRows.length}
                </Badge>
              </Tabs.Tab>
              <Tabs.Tab value="inout" leftSection={<IconFileAnalytics size={15} />}>
                Inbound/Outbound{" "}
                <Badge ml={6} color="teal" size="xs">
                  {reportInOut?.rangeRows?.length || 0}
                </Badge>
              </Tabs.Tab>
            </Tabs.List>
            <Button
              size="xs"
              variant="light"
              color="indigo"
              leftSection={<IconDownload size={14} />}
              onClick={exportCsv}
            >
              Export CSV
            </Button>
          </Group>

          <Tabs.Panel value="summary">
            <Text size="xs" c="dimmed" mb="sm">
              Summary inbound/outbound per barang per tanggal.
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
                    {reportSummaryColumns.map((c) => (
                      <Table.Th
                        key={c.key}
                        style={{ color: "#fff", fontSize: 11, cursor: "pointer", userSelect: "none" }}
                        onClick={() => toggleSort(c.key, summarySortKey, summarySortDir, setSummarySortKey, setSummarySortDir)}
                      >
                        {c.label}{sortIcon(c.key, summarySortKey, summarySortDir)}
                      </Table.Th>
                    ))}
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {sortData(dailyRows, summarySortKey, summarySortDir).length === 0 ? (
                    <Table.Tr>
                      <Table.Td colSpan={5} ta="center" c="dimmed" py="xl">
                        Tidak ada data.
                      </Table.Td>
                    </Table.Tr>
                  ) : (
                    sortData(dailyRows, summarySortKey, summarySortDir).map((r, i) => (
                      <Table.Tr key={i}>
                        <Table.Td>{r.tanggal}</Table.Td>
                        <Table.Td fw={500}>{r.namaBarang}</Table.Td>
                        <Table.Td ta="right" fw={700} c="green">
                          {r.in}
                        </Table.Td>
                        <Table.Td ta="right" fw={700} c="red">
                          {r.out}
                        </Table.Td>
                        <Table.Td ta="right" fw={700}>
                          {r.net}
                        </Table.Td>
                      </Table.Tr>
                    ))
                  )}
                </Table.Tbody>
              </Table>
            </Box>
          </Tabs.Panel>

          <Tabs.Panel value="stock">
            <Text size="xs" c="dimmed" mb="sm">
              Stock saat ini dikelompokkan per barang + status.
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
                    {reportStockColumns.map((c) => (
                      <Table.Th
                        key={c.key}
                        style={{ color: "#fff", fontSize: 11, cursor: "pointer", userSelect: "none" }}
                        onClick={() => toggleSort(c.key, stockSortKey, stockSortDir, setStockSortKey, setStockSortDir)}
                      >
                        {c.label}{sortIcon(c.key, stockSortKey, stockSortDir)}
                      </Table.Th>
                    ))}
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {sortData(groupedRows, stockSortKey, stockSortDir).length === 0 ? (
                    <Table.Tr>
                      <Table.Td colSpan={5} ta="center" c="dimmed" py="xl">
                        Tidak ada data stock.
                      </Table.Td>
                    </Table.Tr>
                  ) : (
                    sortData(groupedRows, stockSortKey, stockSortDir).map((r, i) => (
                      <Table.Tr key={i}>
                        <Table.Td fw={500}>{r.namaBarang}</Table.Td>
                        <Table.Td>
                          <Badge
                            size="xs"
                            color={
                              r.status === "GOOD"
                                ? "green"
                                : r.status === "HOLD"
                                  ? "yellow"
                                  : "gray"
                            }
                          >
                            {r.status}
                          </Badge>
                        </Table.Td>
                        <Table.Td ta="right" fw={700}>
                          {r.total}
                        </Table.Td>
                        <Table.Td ta="center">{r.count}</Table.Td>
                        <Table.Td>{r.nearestExp || "-"}</Table.Td>
                      </Table.Tr>
                    ))
                  )}
                </Table.Tbody>
              </Table>
            </Box>
          </Tabs.Panel>

          <Tabs.Panel value="inbound">
            <ReportTable data={inbound} type="in" />
          </Tabs.Panel>
          <Tabs.Panel value="outbound">
            <ReportTable data={outbound} type="out" />
          </Tabs.Panel>

          <Tabs.Panel value="inout">
            <Stack gap="md">
              <Group justify="space-between">
                <Text size="xs" c="dimmed">Laporan inbound/outbound per item & harian (style script.gs).</Text>
                <Button size="xs" color="teal" leftSection={<IconFileAnalytics size={14} />} onClick={loadReportInOut} loading={reportInOutLoading}>
                  Tampilkan
                </Button>
              </Group>

              {reportInOut && (
                <>
                  <SimpleGrid cols={5}>
                    {[
                      { label: "Total Hari", value: reportInOut.summary?.totalHari || 0, color: "blue" },
                      { label: "Total Item", value: reportInOut.summary?.totalItemRange || 0, color: "violet" },
                      { label: "Total Inbound", value: reportInOut.summary?.totalInbound || 0, color: "green" },
                      { label: "Total Outbound", value: reportInOut.summary?.totalOutbound || 0, color: "red" },
                      { label: "Net", value: reportInOut.summary?.totalNet || 0, color: "orange" },
                    ].map((s, i) => (
                      <Paper key={i} withBorder p="sm" radius="md" ta="center">
                        <Text size="xl" fw={900} c={s.color}>{s.value}</Text>
                        <Text size="xs" c="dimmed" tt="uppercase" fw={700}>{s.label}</Text>
                      </Paper>
                    ))}
                  </SimpleGrid>

                  <Text fw={700} size="sm">Per Item Summary</Text>
                  <Box style={{ maxHeight: 400, overflow: "auto" }}>
                    <Table striped style={{ fontSize: 11 }}>
                      <Table.Thead style={{ background: "#111827", position: "sticky", top: 0, zIndex: 1 }}>
                        <Table.Tr>
                          {["Barang", "Satuan", "Inbound", "Outbound", "Net"].map(h => (
                            <Table.Th key={h} style={{ color: "#fff", fontSize: 11 }}>{h}</Table.Th>
                          ))}
                        </Table.Tr>
                      </Table.Thead>
                      <Table.Tbody>
                        {(reportInOut.rangeRows || []).length === 0 ? (
                          <Table.Tr><Table.Td colSpan={5} ta="center" c="dimmed" py="xl">Tidak ada data.</Table.Td></Table.Tr>
                        ) : (
                          (reportInOut.rangeRows || []).map((r: any, i: number) => (
                            <Table.Tr key={i}>
                              <Table.Td fw={500}>{r.namaBarang}</Table.Td>
                              <Table.Td>{r.satuan}</Table.Td>
                              <Table.Td ta="right" fw={700} c="green">{r.inbound}</Table.Td>
                              <Table.Td ta="right" fw={700} c="red">{r.outbound}</Table.Td>
                              <Table.Td ta="right" fw={700}>{r.net}</Table.Td>
                            </Table.Tr>
                          ))
                        )}
                      </Table.Tbody>
                    </Table>
                  </Box>

                  <Text fw={700} size="sm" mt="md">Daily Summary</Text>
                  <Box style={{ maxHeight: 400, overflow: "auto" }}>
                    <Table striped style={{ fontSize: 11 }}>
                      <Table.Thead style={{ background: "#111827", position: "sticky", top: 0, zIndex: 1 }}>
                        <Table.Tr>
                          {["Tanggal", "Inbound", "Outbound", "Net", "Total Item"].map(h => (
                            <Table.Th key={h} style={{ color: "#fff", fontSize: 11 }}>{h}</Table.Th>
                          ))}
                        </Table.Tr>
                      </Table.Thead>
                      <Table.Tbody>
                        {(reportInOut.dailyRows || []).length === 0 ? (
                          <Table.Tr><Table.Td colSpan={5} ta="center" c="dimmed" py="xl">Tidak ada data.</Table.Td></Table.Tr>
                        ) : (
                          (reportInOut.dailyRows || []).map((r: any, i: number) => (
                            <Table.Tr key={i}>
                              <Table.Td>{r.tanggal}</Table.Td>
                              <Table.Td ta="right" fw={700} c="green">{r.inbound}</Table.Td>
                              <Table.Td ta="right" fw={700} c="red">{r.outbound}</Table.Td>
                              <Table.Td ta="right" fw={700}>{r.net}</Table.Td>
                              <Table.Td ta="center">{r.totalItem}</Table.Td>
                            </Table.Tr>
                          ))
                        )}
                      </Table.Tbody>
                    </Table>
                  </Box>

                  <Text fw={700} size="sm" mt="md">Detail Transaksi</Text>
                  <Box style={{ maxHeight: 400, overflow: "auto" }}>
                    <Table striped style={{ fontSize: 11 }}>
                      <Table.Thead style={{ background: "#111827", position: "sticky", top: 0, zIndex: 1 }}>
                        <Table.Tr>
                          {["Tanggal", "Barang", "Satuan", "Jenis", "Qty", "Saldo", "User"].map(h => (
                            <Table.Th key={h} style={{ color: "#fff", fontSize: 11 }}>{h}</Table.Th>
                          ))}
                        </Table.Tr>
                      </Table.Thead>
                      <Table.Tbody>
                        {(reportInOut.detailRows || []).length === 0 ? (
                          <Table.Tr><Table.Td colSpan={7} ta="center" c="dimmed" py="xl">Tidak ada data.</Table.Td></Table.Tr>
                        ) : (
                          (reportInOut.detailRows || []).map((r: any, i: number) => (
                            <Table.Tr key={i}>
                              <Table.Td>{r.tanggal}</Table.Td>
                              <Table.Td fw={500}>{r.namaBarang}</Table.Td>
                              <Table.Td>{r.satuan}</Table.Td>
                              <Table.Td>
                                <Badge size="xs" color={r.jenis === "IN" ? "green" : "red"}>{r.jenis}</Badge>
                              </Table.Td>
                              <Table.Td ta="right" fw={700}>{r.qty}</Table.Td>
                              <Table.Td ta="right">{r.saldo}</Table.Td>
                              <Table.Td>{r.user}</Table.Td>
                            </Table.Tr>
                          ))
                        )}
                      </Table.Tbody>
                    </Table>
                  </Box>
                </>
              )}
            </Stack>
          </Tabs.Panel>

          <Tabs.Panel value="motion">
            <Stack gap="md">
              <Group justify="space-between">
                <Text size="xs" c="dimmed">
                  Mengukur durasi barang masuk (Waktu Masuk CS / interval Jam In)
                  dan barang keluar (Start/Selesai Muat OTDR).
                </Text>
                <Group>
                  <Select
                    size="xs"
                    label="Tipe"
                    value={motionType}
                    onChange={(v) => setMotionType(v || "ALL")}
                    data={[
                      { value: "ALL", label: "Semua" },
                      { value: "IN", label: "INBOUND" },
                      { value: "OUT", label: "OUTBOUND" },
                    ]}
                    style={{ width: 120 }}
                  />
                  <Button
                    size="xs"
                    color="orange"
                    leftSection={<IconClock size={14} />}
                    onClick={loadMotion}
                    loading={motionLoading}
                  >
                    Tampilkan Time Motion
                  </Button>
                </Group>
              </Group>

              <SimpleGrid cols={5}>
                {[
                  { label: "Avg Inbound", value: formatDuration(motionSummary.rataInMenit), color: "green" },
                  { label: "Avg Outbound", value: formatDuration(motionSummary.rataOutMenit), color: "red" },
                  { label: "Avg Semua", value: formatDuration(motionSummary.rataSemuaMenit), color: "blue" },
                  { label: "Terukur", value: (motionSummary.totalData || 0) - (motionSummary.belumTerukur || 0), color: "orange" },
                  { label: "Belum Terukur", value: motionSummary.belumTerukur || 0, color: "gray" },
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

              <Box style={{ maxHeight: 500, overflow: "auto" }}>
                <Table striped style={{ fontSize: 10 }}>
                  <Table.Thead
                    style={{
                      background: "#111827",
                      position: "sticky",
                      top: 0,
                      zIndex: 1,
                    }}
                  >
                    <Table.Tr>
                      {reportMotionColumns.map((c) => (
                        <Table.Th
                          key={c.key}
                          style={{ color: "#fff", fontSize: 10, cursor: "pointer", userSelect: "none" }}
                          onClick={() => toggleSort(c.key, motionSortKey, motionSortDir, setMotionSortKey, setMotionSortDir)}
                        >
                          {c.label}{sortIcon(c.key, motionSortKey, motionSortDir)}
                        </Table.Th>
                      ))}
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {sortData(motionRows, motionSortKey, motionSortDir).length === 0 ? (
                      <Table.Tr>
                        <Table.Td colSpan={7} ta="center" c="dimmed" py="xl">
                          Klik "Tampilkan Time Motion" untuk memuat data.
                        </Table.Td>
                      </Table.Tr>
                    ) : (
                      sortData(motionRows, motionSortKey, motionSortDir).slice(0, 300).map((r, i) => (
                        <Table.Tr key={i}>
                          <Table.Td>
                            <Badge
                              size="xs"
                              color={
                                r.durasiMenit === null
                                  ? "yellow"
                                  : r.jenis === "IN"
                                    ? "green"
                                    : "red"
                              }
                            >
                              {r.jenis}
                            </Badge>
                            <Text size="xs" c="dimmed">
                              {r.status}
                            </Text>
                          </Table.Td>
                          <Table.Td>{r.tanggal}</Table.Td>
                          <Table.Td>
                            <Text size="xs" fw={700}>
                              {r.referensi}
                            </Text>
                            <Text size="xs" c="dimmed">
                              {r.detail}
                            </Text>
                          </Table.Td>
                          <Table.Td style={{ minWidth: 160 }}>
                            <Text size="xs" fw={500}>
                              {r.barangResto}
                            </Text>
                            <Text size="xs" c="dimmed">
                              Qty: {r.qty} {r.satuan} | Lok/Nopol: {r.lokasi}
                            </Text>
                          </Table.Td>
                          <Table.Td style={{ minWidth: 150 }}>
                            <Text size="xs">
                              {r.startLabel}: {r.start}
                            </Text>
                            <Text size="xs">
                              {r.endLabel}: {r.selesai}
                            </Text>
                          </Table.Td>
                          <Table.Td>
                            <Text
                              size="xs"
                              fw={700}
                              c={
                                r.durasiMenit === null
                                  ? "dimmed"
                                  : r.durasiMenit > 60
                                    ? "red"
                                    : "green"
                              }
                            >
                              {r.durasiMenit === null
                                ? "Belum terukur"
                                : `${Math.round(r.durasiMenit * 100) / 100} menit`}
                            </Text>
                          </Table.Td>
                          <Table.Td>{r.koordinatorTeam || "-"}</Table.Td>
                        </Table.Tr>
                      ))
                    )}
                  </Table.Tbody>
                </Table>
                {sortData(motionRows, motionSortKey, motionSortDir).length > 300 && (
                  <Text size="xs" c="dimmed" ta="center" mt="xs">
                    Menampilkan 300 baris pertama.
                  </Text>
                )}
              </Box>
            </Stack>
          </Tabs.Panel>
        </Tabs>
      </Paper>
    </Box>
  );
}

function ReportTable({ data, type }: { data: any[]; type: "in" | "out" }) {
  const [rtSortKey, setRtSortKey] = useState<string | null>(null);
  const [rtSortDir, setRtSortDir] = useState<"asc" | "desc">("asc");
  const rtSortData = (d: any[], key: string | null, dir: "asc" | "desc") => {
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
  const rtColumns = [
    { label: "Tanggal", key: "tanggalTransaksi" },
    { label: "Barang", key: "namaBarang" },
    { label: "Batch", key: "nomorBatch" },
    { label: "Rak", key: "lokasiRak" },
    { label: type === "in" ? "Masuk" : "Keluar", key: type === "in" ? "qtyMasuk" : "qtyKeluar" },
    { label: "Saldo", key: "saldoAkhirLot" },
    { label: "User", key: "namaUserTransaksi" },
  ];
  const sorted = rtSortData(data, rtSortKey, rtSortDir);
  return (
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
            {rtColumns.map((c) => (
              <Table.Th
                key={c.key}
                style={{ color: "#fff", fontSize: 11, cursor: "pointer", userSelect: "none" }}
                onClick={() => {
                  if (rtSortKey === c.key) {
                    setRtSortDir((d) => (d === "asc" ? "desc" : "asc"));
                  } else {
                    setRtSortKey(c.key);
                    setRtSortDir("asc");
                  }
                }}
              >
                {c.label}
                {rtSortKey !== c.key ? " ↕" : rtSortDir === "asc" ? " ▲" : " ▼"}
              </Table.Th>
            ))}
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {sorted.length === 0 ? (
            <Table.Tr>
              <Table.Td colSpan={7} ta="center" c="dimmed" py="xl">
                Tidak ada data.
              </Table.Td>
            </Table.Tr>
          ) : (
            sorted.map((m: any, i: number) => (
              <Table.Tr key={i}>
                <Table.Td>{m.tanggalTransaksi}</Table.Td>
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
                <Table.Td
                  ta="right"
                  fw={700}
                  c={type === "in" ? "green" : "red"}
                >
                  {type === "in" ? m.qtyMasuk : m.qtyKeluar}
                </Table.Td>
                <Table.Td ta="right" fw={700}>
                  {m.saldoAkhirLot}
                </Table.Td>
                <Table.Td>{m.namaUserTransaksi}</Table.Td>
              </Table.Tr>
            ))
          )}
        </Table.Tbody>
      </Table>
    </Box>
  );
}
