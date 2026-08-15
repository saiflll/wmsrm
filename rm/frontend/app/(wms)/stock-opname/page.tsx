// @ts-nocheck
"use client";
import React, { useState, useEffect, useMemo } from "react";
import {
  Box,
  Group,
  Button,
  Title,
  Text,
  Badge,
  Paper,
  Stack,
  TextInput,
  Modal,
  NumberInput,
  Loader,
  Autocomplete,
  SegmentedControl,
  Tooltip,
  ActionIcon,
} from "@mantine/core";
import { Table } from "../components/Table";
import { useDisclosure } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";
import {
  IconFileTypePdf,
  IconFileSpreadsheet,
  IconTable,
  IconHistory,
  IconAlertTriangle,
  IconCheck,
  IconSearch,
  IconLayoutGrid,
} from "@tabler/icons-react";
import { api, unwrap, fmt, saveXlsx } from "../lib/api";
import * as XLSX from "xlsx";

// Helper: download Excel dengan format profesional
function downloadExcel(data: any[], zone: string) {
  const title = `STOCK OPNAME - ZONA ${zone}`;
  const dateStr = new Date().toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });

  const headerRows = [
    [title],
    [`Tanggal Cetak: ${dateStr}`],
    [`Zone/Area: ${zone}`],
    [],
    [
      "No",
      "Zone / Area",
      "No. Rak",
      "Item Code",
      "Item Name",
      "Category",
      "UOM",
      "Batch/Lot",
      "Expiry Date",
      "Shift",
      "Tgl & Jam Eksekusi",
      "Stock Akhir (Sistem)",
      "Stock Reserved",
      "Stock Available",
      "Stock Opname (Fisik)",
      "Variance (Fisik-Buku)",
      "Abs Variance",
      "Variance %",
      "Aging Status",
      "Hari ke Expired",
      "Hari Simpan",
      "Status Tolerance",
      "Sudah Dihitung?",
      "Keterangan",
    ],
  ];

  const rows = data.map((r: any, i: number) => [
    i + 1,
    r.location || r.gudang_zone || zone || "-",
    r.nomor_rak,
    r.item_code || "",
    r.item_name || "",
    r.category || "",
    r.uom || "",
    r.batch_lot || "",
    r.expiry_date || "",
    r.shift || "",
    r.created_at ? fmt(r.created_at) : "-",
    r.stock_akhir,
    r.reserved_qty || 0,
    r.available_qty || 0,
    r.stock_opname !== null ? r.stock_opname : "",
    r.variance_phys_book !== null ? r.variance_phys_book : "",
    r.abs_variance !== null ? r.abs_variance : "",
    r.variance_pct !== null ? r.variance_pct + "%" : "",
    r.aging_status,
    r.days_to_exp !== null ? r.days_to_exp : "",
    r.days_in_storage !== null ? r.days_in_storage : "",
    r.tolerance_ok ? "OK" : "TIDAK OK",
    r.stock_opname !== null ? "Y" : "N",
    r.notes || "",
  ]);

  const ws = XLSX.utils.aoa_to_sheet([...headerRows, ...rows]);

  ws["!merges"] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: 23 } },
    { s: { r: 1, c: 0 }, e: { r: 1, c: 23 } },
    { s: { r: 2, c: 0 }, e: { r: 2, c: 23 } },
  ];

  ws["!cols"] = [
    { wch: 4 },
    { wch: 12 },
    { wch: 14 },
    { wch: 28 },
    { wch: 12 },
    { wch: 8 },
    { wch: 14 },
    { wch: 14 },
    { wch: 10 },
    { wch: 16 },
    { wch: 18 },
    { wch: 16 },
    { wch: 16 },
    { wch: 16 },
    { wch: 16 },
    { wch: 12 },
    { wch: 12 },
    { wch: 14 },
    { wch: 14 },
    { wch: 12 },
    { wch: 14 },
    { wch: 14 },
    { wch: 24 },
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, `Opname ${zone}`);

  const shiftMap: Record<
    string,
    { totalRak: number; totalOpname: number; totalSistem: number }
  > = {};
  data.forEach((r: any) => {
    const sh = r.shift || "Tidak ada shift";
    if (!shiftMap[sh])
      shiftMap[sh] = { totalRak: 0, totalOpname: 0, totalSistem: 0 };
    shiftMap[sh].totalRak++;
    if (r.stock_opname !== null) shiftMap[sh].totalOpname += r.stock_opname;
    shiftMap[sh].totalSistem += r.stock_akhir;
  });

  const rekapRows = [
    [`REKAP PER SHIFT - ZONA ${zone}`],
    [`Tanggal: ${dateStr}`],
    [],
    ["Shift", "Jumlah Rak Diopname", "Total Qty Fisik", "Total Qty Sistem"],
    ...Object.entries(shiftMap).map(([sh, d]) => [
      sh,
      d.totalRak,
      d.totalOpname,
      d.totalSistem,
    ]),
  ];

  const wsRekap = XLSX.utils.aoa_to_sheet(rekapRows);
  wsRekap["!merges"] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: 3 } },
    { s: { r: 1, c: 0 }, e: { r: 1, c: 3 } },
  ];
  wsRekap["!cols"] = [{ wch: 16 }, { wch: 22 }, { wch: 18 }, { wch: 18 }];
  XLSX.utils.book_append_sheet(wb, wsRekap, "Rekap Shift");

  const datePart = new Date().toISOString().split("T")[0].replace(/-/g, "");
  saveXlsx(
    XLSX,
    wb,
    `StockOpname_${zone.replace(/\s/g, "_")}_${datePart}.xlsx`,
  );
}

export default function StockOpnamePage() {
  const [summary, setSummary] = useState<any[]>([]);
  const [zone, setZone] = useState("DRY A");
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [viewMode, setViewMode] = useState<"3d" | "table">("3d");
  const [searchQuery, setSearchQuery] = useState("");

  const [opened, { open, close }] = useDisclosure(false);
  const [sel, setSel] = useState<any>(null);
  const [actualQty, setActualQty] = useState("");
  const [shiftId, setShiftId] = useState("");
  const [shifts, setShifts] = useState<any[]>([]);

  const [allZones, setAllZones] = useState<string[]>([
    "CS FROZEN",
    "CHILL",
    "DRY A",
    "DRY B",
    "DRY FG",
  ]);

  const [userRole, setUserRole] = useState<number>(0);
  const [opnameLogs, setOpnameLogs] = useState<any[]>([]);
  const [showHistory, setShowHistory] = useState(false);

  useEffect(() => {
    try {
      const u = JSON.parse(localStorage.getItem("user") || "{}");
      setUserRole(u?.role || 0);
    } catch { }
    api()
      .get("/gudang")
      .then((r) => {
        const gudangData = unwrap(r);
        const gudangList = Array.isArray(gudangData) ? gudangData : gudangData?.data || [];
        const z = Array.from(
          new Set(
            gudangList
              .map((g: any) => g.zone)
              .filter(Boolean),
          ),
        );
        if (z.length) setAllZones(z as string[]);
      })
      .catch(() => { });
    api()
      .get("/shifts")
      .then((r) => setShifts(unwrap(r)))
      .catch(() => { });
  }, []);

  useEffect(() => {
    load();
    loadHistory();
  }, [zone]);

  const load = async () => {
    setLoading(true);
    try {
      const res = await api().get(`/inventory/opname/summary?zone=${zone}`);
      const rows = unwrap(res) || [];
      setSummary(rows.map((row: any) => ({
        ...row,
        totalQty: Number(row.totalQty ?? row.total_qty ?? 0),
        totalReservedQty: Number(row.totalReservedQty ?? row.total_reserved_qty ?? 0),
      })));
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  const loadHistory = async () => {
    try {
      const res = await api().get(`/inventory/logs/opname`);
      const logs = unwrap(res);
      const filtered = logs.filter((l: any) => l.gudang?.zone === zone);
      setOpnameLogs(filtered);
    } catch (e) {
      console.error(e);
    }
  };

  const doOpname = async () => {
    if (!sel || actualQty === "") return;
    if (!shiftId) {
      return notifications.show({
        title: "Error",
        message: "Pilih shift terlebih dahulu",
        color: "red",
      });
    }
    try {
      await api().post("/inventory/opname", {
        stock_id: sel.stocks?.[0]?.id,
        gudang_id: sel.gudang.id,
        qty_opname: Number(actualQty),
        shift_id: Number(shiftId),
      });
      notifications.show({
        title: "Sukses",
        message: `Opname ${sel.gudang.name} tersimpan`,
        color: "green",
      });
      close();
      load();
      loadHistory();
    } catch (e: any) {
      notifications.show({
        title: "Error",
        message: unwrap(e.response)?.message || "Gagal",
        color: "red",
      });
    }
  };

  // Export & Print Scope Selection Modal State
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [exportActionType, setExportActionType] = useState<'excel' | 'print'>('excel');
  const [exportScope, setExportScope] = useState<'current' | 'all'>('current');

  const openExportModal = (action: 'excel' | 'print') => {
    setExportActionType(action);
    setExportScope('current');
    setExportModalOpen(true);
  };

  const executeExportOrPrint = async () => {
    setExportModalOpen(false);
    setExporting(true);
    const targetZoneParam = exportScope === 'all' ? 'ALL' : zone;

    try {
      const res = await api().get(`/inventory/opname/export?zone=${targetZoneParam}`);
      const data = unwrap(res);
      if (!data || !data.length) {
        notifications.show({
          title: "Info",
          message: "Tidak ada data untuk diexport / diprint",
          color: "blue",
        });
        setExporting(false);
        return;
      }

      const zoneTitle = exportScope === 'all' ? 'SEMUA ZONA' : zone;

      if (exportActionType === 'excel') {
        downloadExcel(data, zoneTitle);
        notifications.show({
          title: "Export Berhasil",
          message: `${data.length} baris data (${zoneTitle}) diexport ke Excel`,
          color: "green",
        });
      } else {
        const win = window.open("", "_blank");
        if (!win) return;
        win.document.write(`
        <html>
        <head>
            <title>Stock Opname - ${zoneTitle}</title>
            <style>
                body { font-family: Arial; padding: 20px; font-size: 11px; }
                table { width: 100%; border-collapse: collapse; margin-top: 15px; }
                th, td { border: 1px solid #333; padding: 5px; text-align: left; }
                th { background: #1f2937; color: #fff; }
                .header { font-size: 14px; font-weight: bold; margin-bottom: 6px; }
                .info { display: flex; justify-content: space-between; margin-bottom: 10px; font-size: 11px; }
            </style>
        </head>
        <body>
            <div class="header">STOCK OPNAME REPORT - ${zoneTitle}</div>
            <div class="info">
                <div>
                    <b>Zone / Area:</b> ${zoneTitle}<br/>
                    <b>Total Rak:</b> ${data.length}
                </div>
                <div style="text-align: right">
                    <b>Dicetak:</b> ${new Date().toLocaleString()}<br/>
                </div>
            </div>
            <table>
                <thead>
                    <tr>
                        <th>No</th>
                        <th>Zone / Area</th>
                        <th>No. Rak</th>
                        <th>Item</th>
                        <th>Batch</th>
                        <th>Exp</th>
                        <th>Shift</th>
                        <th>Tgl & Jam Eksekusi</th>
                        <th>Sistem</th>
                        <th>Fisik</th>
                        <th>Selisih</th>
                        <th>Aging</th>
                        <th>Keterangan</th>
                    </tr>
                </thead>
                <tbody>
                    ${data
            .map(
              (r: any, i: number) => `
                        <tr>
                            <td>${i + 1}</td>
                            <td><b>${r.location || r.gudang_zone || zone || "-"}</b></td>
                            <td>${r.nomor_rak}</td>
                            <td>${r.item_name || ""}</td>
                            <td>${r.batch_lot || "-"}</td>
                            <td>${r.expiry_date ?? "-"}</td>
                            <td>${r.shift || "-"}</td>
                            <td>${r.created_at ? fmt(r.created_at) : "-"}</td>
                            <td>${r.stock_akhir}</td>
                            <td>${r.stock_opname !== null ? r.stock_opname : ""}</td>
                            <td>${r.variance_phys_book !== null ? r.variance_phys_book : ""}</td>
                            <td>${r.aging_status}</td>
                            <td style="color: ${r.note_color || "#000"}; font-weight: 600;">${r.notes || ""}</td>
                        </tr>
                    `,
            )
            .join("")}
                </tbody>
            </table>
            <script>window.onload=()=>{window.print();window.close()}</script>
        </body>
        </html>
        `);
        win.document.close();
      }
    } catch (e) {
      notifications.show({
        title: "Error",
        message: "Gagal memproses export / print data",
        color: "red",
      });
    }
    setExporting(false);
  };

  const selRack = (s: any) => {
    if (!s.filled)
      return notifications.show({
        title: "Info",
        message: "Rak kosong, tidak perlu opname",
        color: "blue",
      });
    setSel(s);
    setActualQty(s.totalQty);
    setShiftId("");
    open();
  };

  // Filter summary by search query
  const filteredSummary = useMemo(() => {
    if (!searchQuery.trim()) return summary;
    const q = searchQuery.toLowerCase();
    return summary.filter((s: any) => {
      const rackName = s.gudang?.name?.toLowerCase() || "";
      const hasMatchingStock = s.stocks?.some(
        (st: any) =>
          st.barang?.nama?.toLowerCase().includes(q) ||
          st.barang?.sku?.toLowerCase().includes(q) ||
          st.batch_no?.toLowerCase().includes(q),
      );
      return rackName.includes(q) || hasMatchingStock;
    });
  }, [summary, searchQuery]);

  // Aging count & statistics
  const agingCount = summary.filter((s: any) =>
    s.stocks?.some((st: any) => {
      if (!st.created_at) return false;
      const days =
        (Date.now() - new Date(st.created_at).getTime()) /
        (1000 * 60 * 60 * 24);
      return days > 90;
    }),
  ).length;

  const expiredCount = summary.filter((s: any) =>
    s.stocks?.some(
      (st: any) => st.expiry_date && new Date(st.expiry_date) < new Date(),
    ),
  ).length;

  const reservedCount = summary.filter((s: any) => (s.totalReservedQty || 0) > 0).length;
  const filledCount = summary.filter((s: any) => s.filled).length;
  const emptyCount = summary.length - filledCount;

  // Grouping by Kolom then Level
  const byKolom = useMemo(() => {
    const map: any = {};
    filteredSummary.forEach((s: any) => {
      const k = s.gudang.kolom || "A";
      const lvl = s.gudang.level || 1;
      if (!map[k]) map[k] = {};
      if (!map[k][lvl]) map[k][lvl] = [];
      map[k][lvl].push(s);
    });
    return map;
  }, [filteredSummary]);

  const sortedKoloms = Object.keys(byKolom).sort();

  // Compute Rack Card Fill & Color Ratios
  const calculateRackFill = (s: any) => {
    if (!s.filled) {
      return {
        fillPct: 0,
        isAllReserved: false,
        isAllExpired: false,
        isAllAging: false,
        reservedRatio: 0,
        expiredRatio: 0,
        nearExpRatio: 0,
        agingRatio: 0,
        normalRatio: 1,
      };
    }

    const capacity = Number(s.gudang?.capacity || 1000);
    const totalQty = Number(s.totalQty || 0);
    const reservedQty = Number(s.totalReservedQty || 0);

    const fillPct = Math.min(100, Math.max(14, Math.round((totalQty / capacity) * 100)));

    let expiredQty = 0;
    let nearExpQty = 0;
    let agingQty = 0;

    s.stocks?.forEach((st: any) => {
      const q = Number(st.qty || 0);
      if (st.expiry_date && new Date(st.expiry_date) < new Date()) {
        expiredQty += q;
      } else if (st.expiry_date && (new Date(st.expiry_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24) < 30) {
        nearExpQty += q;
      }
      if (st.created_at && (Date.now() - new Date(st.created_at).getTime()) / (1000 * 60 * 60 * 24) > 90) {
        agingQty += q;
      }
    });

    const isAllReserved = totalQty > 0 && reservedQty >= totalQty;
    const isAllExpired = totalQty > 0 && expiredQty >= totalQty;
    const isAllAging = totalQty > 0 && agingQty >= totalQty;

    const reservedRatio = totalQty > 0 ? Math.min(1, reservedQty / totalQty) : 0;
    const expiredRatio = totalQty > 0 ? Math.min(1, expiredQty / totalQty) : 0;
    const nearExpRatio = totalQty > 0 ? Math.min(1, nearExpQty / totalQty) : 0;
    const agingRatio = totalQty > 0 ? Math.min(1, agingQty / totalQty) : 0;
    const normalRatio = Math.max(0, 1 - reservedRatio - expiredRatio - nearExpRatio - agingRatio);

    return {
      fillPct,
      isAllReserved,
      isAllExpired,
      isAllAging,
      reservedRatio,
      expiredRatio,
      nearExpRatio,
      agingRatio,
      normalRatio,
    };
  };

  return (
    <Box p="md">
      {/* Clean Minimalist Header (Matching App Theme) */}
      <Box mb="md" pb="xs" style={{ background: '#fff', borderLeft: '4px solid #f707abff', padding: '10px 16px', borderRadius: 4, boxShadow: '0 1px 3px rgba(0,0,0,.05)', borderBottom: '1px solid #f1f5f9' }}>
        <Group justify="space-between" align="center" wrap="nowrap" gap="sm">
          {/* Left Side: Title, View Switcher & Zone Buttons Inline */}
          <Group gap="md" align="center" wrap="nowrap">
            <Title order={3} style={{ letterSpacing: "-0.04em", whiteSpace: "nowrap" }}>
              STOCK OPNAME
            </Title>

            <SegmentedControl
              value={viewMode}
              onChange={(val: any) => setViewMode(val)}
              data={[
                {
                  label: (
                    <Group gap={4} wrap="nowrap">
                      <IconLayoutGrid size={14} />
                      <Text size="xs">Visual Rak</Text>
                    </Group>
                  ),
                  value: "3d",
                },
                {
                  label: (
                    <Group gap={4} wrap="nowrap">
                      <IconTable size={14} />
                      <Text size="xs">Tabel List</Text>
                    </Group>
                  ),
                  value: "table",
                },
              ]}
              size="xs"
              radius="md"
            />

            {/* Zone Selector Buttons Inline */}
            <Group gap={4} wrap="nowrap">
              {allZones.map((z: any) => (
                <Button
                  key={z}
                  radius="md"
                  size="xs"
                  variant={zone === z ? "filled" : "subtle"}
                  color={zone === z ? "orange" : "gray"}
                  style={{ fontWeight: 700, padding: "2px 8px" }}
                  onClick={() => setZone(z)}
                >
                  {z}
                </Button>
              ))}
            </Group>
          </Group>

          {/* Right Side: Icon-Only Action Buttons */}
          <Group gap="xs" align="center" wrap="nowrap">
            <Tooltip label="Export Excel / CSV">
              <ActionIcon
                color="teal"
                variant="filled"
                size="md"
                radius="md"
                loading={exporting}
                onClick={() => openExportModal('excel')}
              >
                <IconFileSpreadsheet size={16} />
              </ActionIcon>
            </Tooltip>

            <Tooltip label="Print / Export PDF">
              <ActionIcon
                color="red"
                variant="filled"
                size="md"
                radius="md"
                loading={exporting}
                onClick={() => openExportModal('print')}
              >
                <IconFileTypePdf size={16} />
              </ActionIcon>
            </Tooltip>
          </Group>
        </Group>
      </Box>

      {/* Clean Legend Bar & Search */}
      <Paper p="sm" radius="md" withBorder mb="md" style={{ background: "#f8f9fa" }}>
        <Group justify="space-between" align="center" wrap="wrap" gap="md">
          <Group gap="md" wrap="wrap">
            {/* TERISI NORMAL */}
            <Tooltip label="Rak terisi stok normal">
              <Group gap={6} style={{ cursor: "pointer" }}>
                <Box w={12} h={12} style={{ background: "#0ea5e9", borderRadius: 3 }} />
                <Text size="xs" fw={700} c="dark">
                  TERISI NORMAL ({filledCount})
                </Text>
              </Group>
            </Tooltip>

            {/* RESERVED OUTBOUND (PURPLE) */}
            <Tooltip label="100% Purple jika seluruh stok di-reserved outbound">
              <Group gap={6} style={{ cursor: "pointer" }}>
                <Box w={12} h={12} style={{ background: "#8b5cf6", borderRadius: 3 }} />
                <Text size="xs" fw={800} style={{ color: "#7c3aed" }}>
                  RESERVED OUTBOUND ({reservedCount})
                </Text>
              </Group>
            </Tooltip>

            {/* AGING */}
            <Tooltip label="Stok dengan hari simpan >90 hari">
              <Group gap={6} style={{ cursor: "pointer" }}>
                <Box w={12} h={12} style={{ background: "#eab308", borderRadius: 3 }} />
                <Text size="xs" fw={700} style={{ color: "#ca8a04" }}>
                  AGING ({agingCount})
                </Text>
              </Group>
            </Tooltip>

            {/* NEAR EXPIRED */}
            <Tooltip label="Stok dengan kadaluarsa <30 hari">
              <Group gap={6} style={{ cursor: "pointer" }}>
                <Box w={12} h={12} style={{ background: "#f97316", borderRadius: 3 }} />
                <Text size="xs" fw={700} style={{ color: "#ea580c" }}>
                  NEAR EXPIRED
                </Text>
              </Group>
            </Tooltip>

            {/* EXPIRED */}
            <Tooltip label="Stok kedaluwarsa">
              <Group gap={6} style={{ cursor: "pointer" }}>
                <Box w={12} h={12} style={{ background: "#ef4444", borderRadius: 3 }} />
                <Text size="xs" fw={700} style={{ color: "#dc2626" }}>
                  EXPIRED ({expiredCount})
                </Text>
              </Group>
            </Tooltip>

            {/* KOSONG */}
            <Tooltip label="Rak belum terisi barang">
              <Group gap={6} style={{ cursor: "pointer" }}>
                <Box w={12} h={12} style={{ border: "1.5px dashed #94a3b8", borderRadius: 3 }} />
                <Text size="xs" fw={700} c="dimmed">
                  KOSONG ({emptyCount})
                </Text>
              </Group>
            </Tooltip>
          </Group>

          <TextInput
            placeholder="Cari No. Rak / SKU / Item..."
            size="xs"
            radius="md"
            leftSection={<IconSearch size={14} />}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.currentTarget.value)}
            style={{ width: 220 }}
          />
        </Group>
      </Paper>

      {loading ? (
        <Group justify="center" py={50}>
          <Loader color="orange" size="md" />
        </Group>
      ) : viewMode === "3d" ? (
        /* VISUAL RAK GRID VIEW */
        <Box>
          {sortedKoloms.map((k: any) => {
            const levelsMap = byKolom[k];
            const sortedLevels = Object.keys(levelsMap).sort(
              (a, b) => Number(a) - Number(b),
            );

            return (
              <Paper
                key={k}
                p="md"
                radius="md"
                withBorder
                mb="md"
                style={{ background: "#ffffff" }}
              >
                <Group justify="space-between" align="center" mb="sm" pb="xs" style={{ borderBottom: "1px solid #f1f5f9" }}>
                  <Group gap="xs">
                    <Badge color="orange" size="sm" radius="sm" variant="light">
                      KOLOM {k}
                    </Badge>
                    <Text fw={800} size="sm" c="dark">
                      Sektor Rak Zona {zone}
                    </Text>
                  </Group>
                  <Text size="xs" c="dimmed">
                    Klik rak untuk opname fisik
                  </Text>
                </Group>

                <Stack gap="sm">
                  {sortedLevels.map((lvl: any) => {
                    const racks = levelsMap[lvl].sort((a, b) =>
                      a.gudang.name.localeCompare(b.gudang.name),
                    );
                    return (
                      <Group key={lvl} gap="sm" align="center" wrap="nowrap">
                        <Badge
                          size="sm"
                          variant="outline"
                          color="dark"
                          style={{ width: 65, flexShrink: 0, fontWeight: 800 }}
                        >
                          LVL {lvl}
                        </Badge>

                        <Group gap="xs" style={{ flexWrap: "wrap", flex: 1 }}>
                          {racks.map((r: any) => {
                            const fillInfo = calculateRackFill(r);
                            const isOpnamed = r.opnamed;

                            const tooltipContent = r.filled ? (
                              <Box p={2} style={{ fontSize: 11 }}>
                                <Text fw={800} size="xs" c="yellow">
                                  Rak {r.gudang.name} (Zona {zone})
                                </Text>
                                <Text size="10px">Kapasitas: {r.gudang?.capacity || 1000} Qty</Text>
                                <Text size="10px">Terisi: {r.totalQty} ({fillInfo.fillPct}%)</Text>
                                {r.totalReservedQty > 0 && (
                                  <Text size="10px" c="violet" fw={700}>
                                    Reserved Outbound: {r.totalReservedQty} Qty
                                  </Text>
                                )}
                                <Box style={{ borderTop: "1px solid #475569", marginTop: 4, paddingTop: 4 }}>
                                  {r.stocks?.map((st: any, idx: number) => (
                                    <Text key={idx} size="10px" style={{ color: "#fff" }}>
                                      • {st.barang?.nama}: {st.qty} {st.satuan || ""}
                                    </Text>
                                  ))}
                                </Box>
                              </Box>
                            ) : (
                              `Rak ${r.gudang.name} (KOSONG)`
                            );

                            let fillGradient = "linear-gradient(180deg, #38bdf8 0%, #0284c7 100%)";

                            if (fillInfo.isAllReserved) {
                              fillGradient = "linear-gradient(180deg, #a855f7 0%, #6d28d9 100%)";
                            } else if (fillInfo.isAllExpired) {
                              fillGradient = "linear-gradient(180deg, #f87171 0%, #dc2626 100%)";
                            } else if (fillInfo.isAllAging) {
                              fillGradient = "linear-gradient(180deg, #facc15 0%, #ca8a04 100%)";
                            }

                            return (
                              <Tooltip
                                key={r.gudang.id}
                                label={tooltipContent}
                                multiline
                                withArrow
                                position="top"
                              >
                                <Box
                                  onClick={() => selRack(r)}
                                  style={{
                                    position: "relative",
                                    width: 78,
                                    height: 64,
                                    borderRadius: 6,
                                    cursor: r.filled ? "pointer" : "default",
                                    userSelect: "none",
                                    transition: "all 0.15s ease",
                                    background: r.filled ? "#ffffff" : "rgba(248, 250, 252, 0.8)",
                                    border: isOpnamed ? "2px solid #10b981" : "1px solid #cbd5e1",
                                    boxShadow: "0 2px 4px rgba(0,0,0,0.04)",
                                    overflow: "hidden",
                                    display: "flex",
                                    flexDirection: "column",
                                  }}
                                >
                                  {/* Rak Top Bar */}
                                  <Box
                                    px={4}
                                    py={1}
                                    style={{
                                      background: r.filled ? "#1e293b" : "#e2e8f0",
                                      color: r.filled ? "#fff" : "#64748b",
                                      fontSize: 10,
                                      fontWeight: 800,
                                      display: "flex",
                                      alignItems: "center",
                                      justifyContent: "space-between",
                                      zIndex: 3,
                                    }}
                                  >
                                    <span>{r.gudang.name}</span>
                                    {isOpnamed && (
                                      <IconCheck size={10} stroke={3} color="#10b981" />
                                    )}
                                  </Box>

                                  {/* Percentage Height Visual Fill */}
                                  {r.filled ? (
                                    <Box style={{ flex: 1, position: "relative", width: "100%", background: "#f1f5f9" }}>
                                      <Box
                                        style={{
                                          position: "absolute",
                                          bottom: 0,
                                          left: 0,
                                          right: 0,
                                          height: `${fillInfo.fillPct}%`,
                                          transition: "height 0.3s ease",
                                          display: "flex",
                                          flexDirection: "column-reverse",
                                          overflow: "hidden",
                                        }}
                                      >
                                        {fillInfo.isAllReserved || fillInfo.isAllExpired || fillInfo.isAllAging ? (
                                          <Box
                                            style={{
                                              width: "100%",
                                              height: "100%",
                                              background: fillGradient,
                                            }}
                                          />
                                        ) : (
                                          <>
                                            {fillInfo.reservedRatio > 0 && (
                                              <Box
                                                style={{
                                                  width: "100%",
                                                  height: `${fillInfo.reservedRatio * 100}%`,
                                                  background: "linear-gradient(180deg, #a855f7 0%, #6d28d9 100%)",
                                                }}
                                              />
                                            )}
                                            {fillInfo.expiredRatio > 0 && (
                                              <Box
                                                style={{
                                                  width: "100%",
                                                  height: `${fillInfo.expiredRatio * 100}%`,
                                                  background: "linear-gradient(180deg, #f87171 0%, #dc2626 100%)",
                                                }}
                                              />
                                            )}
                                            {fillInfo.agingRatio > 0 && (
                                              <Box
                                                style={{
                                                  width: "100%",
                                                  height: `${fillInfo.agingRatio * 100}%`,
                                                  background: "linear-gradient(180deg, #facc15 0%, #ca8a04 100%)",
                                                }}
                                              />
                                            )}
                                            {fillInfo.normalRatio > 0 && (
                                              <Box
                                                style={{
                                                  width: "100%",
                                                  height: `${fillInfo.normalRatio * 100}%`,
                                                  background: "linear-gradient(180deg, #38bdf8 0%, #0284c7 100%)",
                                                }}
                                              />
                                            )}
                                          </>
                                        )}
                                      </Box>

                                      <Box
                                        style={{
                                          position: "absolute",
                                          top: 0,
                                          left: 0,
                                          right: 0,
                                          bottom: 0,
                                          display: "flex",
                                          flexDirection: "column",
                                          justify: "center",
                                          alignItems: "center",
                                          zIndex: 4,
                                          pointerEvents: "none",
                                        }}
                                      >
                                        <Text
                                          size="10px"
                                          fw={800}
                                          style={{
                                            color: "#0f172a",
                                            textShadow: "0 1px 2px rgba(255,255,255,0.8)",
                                            lineHeight: 1.1,
                                          }}
                                        >
                                          {r.totalQty}
                                        </Text>
                                        <Text
                                          size="8px"
                                          fw={700}
                                          style={{
                                            color: "#334155",
                                            textShadow: "0 1px 2px rgba(255,255,255,0.8)",
                                          }}
                                        >
                                          {fillInfo.fillPct}%
                                        </Text>
                                      </Box>
                                    </Box>
                                  ) : (
                                    <Box
                                      style={{
                                        flex: 1,
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "center",
                                        background: "rgba(248, 250, 252, 0.5)",
                                      }}
                                    >
                                      <Text size="9px" fw={700} c="dimmed">
                                        KOSONG
                                      </Text>
                                    </Box>
                                  )}
                                </Box>
                              </Tooltip>
                            );
                          })}
                        </Group>
                      </Group>
                    );
                  })}
                </Stack>
              </Paper>
            );
          })}
        </Box>
      ) : (
        /* TABLE LIST VIEW */
        <Paper p="md" radius="md" withBorder style={{ background: "#fff", overflowX: "auto" }}>
          <Table withTableBorder withColumnBorders highlightOnHover style={{ fontSize: 12, minWidth: 750 }}>
            <Table.Thead style={{ background: "#1d1d1f" }}>
              <Table.Tr>
                {["Rak", "Zone", "Item", "Stok Sistem", "Reserved Outbound", "Sisa Available", "Status Opname", "Aksi"].map(
                  (header) => (
                    <Table.Th key={header} style={{ color: "#fff", fontSize: 11 }}>
                      {header}
                    </Table.Th>
                  ),
                )}
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {filteredSummary.map((r: any) => (
                <Table.Tr key={r.gudang.id}>
                  <Table.Td fw={800}>{r.gudang.name}</Table.Td>
                  <Table.Td>{r.gudang.zone}</Table.Td>
                  <Table.Td fw={700}>{r.stocks?.[0]?.barang?.nama || "-"}</Table.Td>
                  <Table.Td ta="right">{r.totalQty} {r.stocks?.[0]?.satuan || ""}</Table.Td>
                  <Table.Td ta="right" style={{ color: r.totalReservedQty > 0 ? "#7c3aed" : "inherit", fontWeight: r.totalReservedQty > 0 ? 800 : 400 }}>
                    {r.totalReservedQty || 0}
                  </Table.Td>
                  <Table.Td ta="right" fw={700}>
                    {Math.max(0, r.totalQty - (r.totalReservedQty || 0))}
                  </Table.Td>
                  <Table.Td ta="center">
                    <Badge size="sm" color={r.opnamed ? "green" : "gray"} variant="light">
                      {r.opnamed ? "Sudah Diopname" : "Belum Diopname"}
                    </Badge>
                  </Table.Td>
                  <Table.Td ta="center">
                    <Button
                      size="xs"
                      color="orange"
                      disabled={!r.filled}
                      onClick={() => selRack(r)}
                      style={{ fontWeight: 800 }}
                    >
                      OPNAME
                    </Button>
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </Paper>
      )}

      {/* Opname History Section */}
      <Box mt="md">
        <Paper p="md" radius="md" withBorder style={{ background: "#ffffff" }}>
          <Group justify="space-between" mb="sm">
            <Group gap="xs">
              <IconHistory size={18} color="#e6921e" />
              <Text fw={800} size="sm">
                Riwayat Opname Zona {zone}
              </Text>
            </Group>
            <Button
              size="xs"
              variant="subtle"
              color="gray"
              onClick={() => setShowHistory(!showHistory)}
            >
              {showHistory ? "Sembunyikan" : "Tampilkan"}
            </Button>
          </Group>
          {showHistory && (
            <Box mt="xs">
              {opnameLogs.length === 0 ? (
                <Text size="sm" c="dimmed" ta="center" py="md">
                  Belum ada riwayat opname untuk zone ini.
                </Text>
              ) : (
                <Box style={{ overflowX: "auto", width: "100%", WebkitOverflowScrolling: "touch" }}>
                  <Table withColumnBorders highlightOnHover style={{ fontSize: 11, border: "1px solid #dee2e6", minWidth: 650 }}>
                  <Table.Thead style={{ background: "#1d1d1f" }}>
                    <Table.Tr>
                      {["ID Log", "Item", "Tanggal", "Shift", "Rak", "Qty Fisik", "Note"].map((h) => (
                        <Table.Th key={h} style={{ color: "#fff", fontSize: 11 }}>
                          {h}
                        </Table.Th>
                      ))}
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {opnameLogs.slice(0, 50).map((l: any) => (
                      <Table.Tr key={l.id}>
                        <Table.Td ta="center" fw={700}>
                          LOG-{l.id}
                        </Table.Td>
                        <Table.Td fw={600}>{l.barang?.nama || "-"}</Table.Td>
                        <Table.Td ta="center">{fmt(l.created_at)}</Table.Td>
                        <Table.Td ta="center">{l.shift?.name || "-"}</Table.Td>
                        <Table.Td ta="center" fw={700}>
                          {l.gudang?.name || "-"}
                        </Table.Td>
                        <Table.Td ta="right" fw={700}>
                          {l.qty} {l.satuan || ""}
                        </Table.Td>
                        <Table.Td>{l.note || "-"}</Table.Td>
                      </Table.Tr>
                    ))}
                  </Table.Tbody>
                </Table>
                </Box>
              )}
            </Box>
          )}
        </Paper>
      </Box>

      {/* Modal Entry Opname */}
      <Modal
        opened={opened}
        onClose={close}
        title={<Text fw={800} size="sm">Entry Stock Opname Fisik</Text>}
        centered
        size="sm"
        styles={{ content: { borderRadius: 12 } }}
      >
        {sel && (
          <Stack gap="sm">
            <TextInput
              readOnly
              value={sel.gudang.name}
              size="sm"
              radius="md"
              label="Lokasi Rak"
              styles={{
                input: {
                  backgroundColor: "#f8f9fa",
                  color: "#000",
                  fontWeight: 700,
                },
              }}
            />
            <TextInput
              readOnly
              value={sel.stocks[0]?.barang?.nama || ""}
              size="sm"
              radius="md"
              label="Nama Item"
              styles={{
                input: {
                  backgroundColor: "#f8f9fa",
                  color: "#000",
                  fontSize: 13,
                },
              }}
            />
            <TextInput
              readOnly
              value={sel.stocks[0]?.batch_no || "-"}
              size="sm"
              radius="md"
              label="Batch/Lot"
              styles={{ input: { backgroundColor: "#f8f9fa" } }}
            />

            <Autocomplete
              label="Shift"
              size="sm"
              radius="md"
              data={shifts.map((s: any) => s.name)}
              value={shifts.find((s: any) => String(s.id) === shiftId)?.name || shiftId}
              onChange={(v) => {
                const match = shifts.find((s: any) => s.name.toLowerCase() === v.toLowerCase());
                setShiftId(match ? String(match.id) : v);
              }}
              placeholder="Pilih Shift"
              required
              styles={{ input: { fontWeight: 600 } }}
            />

            <Box mt="xs">
              <Text size="xs" fw={700} c="dimmed" mb={2}>
                Tanggal Expired
              </Text>
              <TextInput
                readOnly
                value={
                  sel.stocks[0]?.expiry_date
                    ? fmt(sel.stocks[0].expiry_date)
                    : "-"
                }
                size="sm"
                radius="md"
                styles={{
                  input: {
                    backgroundColor: "#f8f9fa",
                    color:
                      sel.stocks[0]?.expiry_date &&
                        new Date(sel.stocks[0].expiry_date) < new Date()
                        ? "red"
                        : "inherit",
                    fontWeight: 600,
                  },
                }}
              />
            </Box>

            <Box mt="xs">
              <Text size="xs" fw={700} c="dimmed" mb={2}>
                Stock Akhir (Sistem)
              </Text>
              <Group gap="xs" wrap="nowrap">
                <TextInput
                  readOnly
                  value={sel.totalQty}
                  size="sm"
                  radius="md"
                  style={{ flex: 1 }}
                  styles={{
                    input: {
                      backgroundColor: "#f8f9fa",
                      fontWeight: 700,
                      textAlign: "center",
                    },
                  }}
                />
                <TextInput
                  readOnly
                  value={sel.stocks[0]?.satuan || "-"}
                  size="sm"
                  w={80}
                  radius="md"
                  styles={{ input: { backgroundColor: "#f8f9fa" } }}
                />
              </Group>
            </Box>

            {sel.totalReservedQty > 0 && (
              <Box mt="xs">
                <Text size="xs" fw={800} style={{ color: "#7c3aed" }} mb={2}>
                  Reserved Outbound (Planning)
                </Text>
                <Group gap="xs" wrap="nowrap">
                  <TextInput
                    readOnly
                    value={sel.totalReservedQty}
                    size="sm"
                    radius="md"
                    style={{ flex: 1 }}
                    styles={{
                      input: {
                        backgroundColor: "#f3e8ff",
                        color: "#6d28d9",
                        fontWeight: 800,
                        textAlign: "center",
                      },
                    }}
                  />
                  <TextInput
                    readOnly
                    value={sel.stocks[0]?.satuan || "-"}
                    size="sm"
                    w={80}
                    radius="md"
                    styles={{ input: { backgroundColor: "#f8f9fa" } }}
                  />
                </Group>
              </Box>
            )}

            <Box mt="xs">
              <Text size="xs" fw={700} c="dimmed" mb={2}>
                Stock Aktual Fisik
              </Text>
              <Group gap="xs" wrap="nowrap">
                <NumberInput
                  value={actualQty}
                  onChange={(v) => setActualQty(v)}
                  size="sm"
                  radius="md"
                  hideControls
                  style={{ flex: 1 }}
                  styles={{
                    input: {
                      fontWeight: 700,
                      textAlign: "center",
                    },
                  }}
                />
                <TextInput
                  readOnly
                  value={sel.stocks[0]?.satuan || "-"}
                  size="sm"
                  w={80}
                  radius="md"
                  styles={{ input: { backgroundColor: "#f8f9fa" } }}
                />
              </Group>
            </Box>

            {actualQty !== "" && actualQty !== sel.totalQty && (
              <Box
                style={{
                  background: "#f8f9fa",
                  borderRadius: 8,
                  padding: "8px 12px",
                  border: "1px solid #cbd5e1",
                }}
              >
                <Text size="xs" fw={700}>
                  Variance: {Number(actualQty) - sel.totalQty > 0 ? "+" : ""}
                  {Number(actualQty) - sel.totalQty}
                </Text>
                <Text size="xs" c="dimmed">
                  Accuracy Rak ini:{" "}
                  {sel.totalQty > 0
                    ? Math.round(
                      (Math.min(Number(actualQty), sel.totalQty) /
                        Math.max(Number(actualQty), sel.totalQty)) *
                      100,
                    )
                    : 100}
                  %
                </Text>
              </Box>
            )}

            <Button
              fullWidth
              color="orange"
              size="sm"
              radius="md"
              mt="sm"
              onClick={doOpname}
              style={{ fontWeight: 800 }}
            >
              {sel.opnamed && userRole >= 3 ? "UPDATE OPNAME" : "SUBMIT OPNAME"}
            </Button>
            <Button
              fullWidth
              variant="subtle"
              color="gray"
              size="xs"
              onClick={close}
            >
              Batal
            </Button>
          </Stack>
        )}
      </Modal>

      {/* Modal Pilihan Scope Export / Print */}
      <Modal
        opened={exportModalOpen}
        onClose={() => setExportModalOpen(false)}
        title={
          <Group gap={8}>
            {exportActionType === 'excel' ? (
              <IconFileSpreadsheet size={20} color="#12b886" />
            ) : (
              <IconFileTypePdf size={20} color="#e03131" />
            )}
            <Text fw={800} size="sm">
              {exportActionType === 'excel' ? 'Export Laporan Excel' : 'Cetak / Print Laporan PDF'}
            </Text>
          </Group>
        }
        centered
        radius="md"
        size="sm"
      >
        <Stack gap="sm">
          <Text size="xs" c="gray.7">
            Silakan pilih cakupan zona data yang ingin {exportActionType === 'excel' ? 'diexport' : 'dicetak'}:
          </Text>

          <Paper withBorder p="sm" radius="md" style={{ background: '#f8f9fa' }}>
            <Group gap="md">
              <Box
                style={{
                  flex: 1,
                  padding: 10,
                  borderRadius: 6,
                  border: exportScope === 'current' ? '2px solid #228be6' : '1px solid #dee2e6',
                  background: exportScope === 'current' ? '#e7f5ff' : '#fff',
                  cursor: 'pointer',
                }}
                onClick={() => setExportScope('current')}
              >
                <Text fw={700} size="xs" c={exportScope === 'current' ? 'blue' : 'dark'}>
                  Zona Saat Ini ({zone})
                </Text>
                <Text size="10px" c="dimmed">
                  Hanya data rak dari zona {zone}
                </Text>
              </Box>

              <Box
                style={{
                  flex: 1,
                  padding: 10,
                  borderRadius: 6,
                  border: exportScope === 'all' ? '2px solid #228be6' : '1px solid #dee2e6',
                  background: exportScope === 'all' ? '#e7f5ff' : '#fff',
                  cursor: 'pointer',
                }}
                onClick={() => setExportScope('all')}
              >
                <Text fw={700} size="xs" c={exportScope === 'all' ? 'blue' : 'dark'}>
                  Seluruh Zona (ALL)
                </Text>
                <Text size="10px" c="dimmed">
                  Gabungan data rak dari semua zona
                </Text>
              </Box>
            </Group>
          </Paper>

          <Group justify="flex-end" gap="xs" mt="xs">
            <Button size="xs" variant="default" onClick={() => setExportModalOpen(false)}>
              Batal
            </Button>
            <Button
              size="xs"
              color={exportActionType === 'excel' ? 'teal' : 'red'}
              onClick={executeExportOrPrint}
              leftSection={
                exportActionType === 'excel' ? (
                  <IconFileSpreadsheet size={14} />
                ) : (
                  <IconFileTypePdf size={14} />
                )
              }
            >
              {exportActionType === 'excel' ? 'Export Excel' : 'Cetak PDF'}
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Box>
  );
}
