// @ts-nocheck
"use client";
import React, { useState, useEffect, useCallback } from "react";
import { Box, Group, Button, Title, Text, Badge, Paper, Stack, TextInput, Modal, NumberInput, Loader, Select } from "@mantine/core";
import { Table } from '../components/Table';
import { useDisclosure } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";
import { IconFileTypePdf, IconFileSpreadsheet } from "@tabler/icons-react";
import { api, unwrap, fmt, saveXlsx } from "../lib/api";
import * as XLSX from "xlsx";

// Helper: download Excel dengan format profesional (mirip referensi xlsx)
function downloadExcel(data: any[], zone: string) {
  const title = `STOCK OPNAME - ZONA ${zone}`;
  const dateStr = new Date().toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });

  // Header rows seperti template referensi
  const headerRows = [
    [title],
    [`Tanggal Cetak: ${dateStr}`],
    [`Zone/Area: ${zone}`],
    [],
    [
      "No",
      "No. Rak",
      "Item Code",
      "Item Name",
      "Category",
      "UOM",
      "Batch/Lot",
      "Expiry Date",
      "Shift",
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
    r.nomor_rak,
    r.item_code || "",
    r.item_name || "",
    r.category || "",
    r.uom || "",
    r.batch_lot || "",
    r.expiry_date || "",
    r.shift || "",
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

  // Merge title row
  ws["!merges"] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: 21 } },
    { s: { r: 1, c: 0 }, e: { r: 1, c: 21 } },
    { s: { r: 2, c: 0 }, e: { r: 2, c: 21 } },
  ];

  // Column widths
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
    { wch: 16 }, // Stock Akhir
    { wch: 16 }, // Reserved
    { wch: 16 }, // Available
    { wch: 16 }, // Opname
    { wch: 16 }, // Variance
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

  // Rekap per shift sheet
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

  const [opened, { open, close }] = useDisclosure(false);
  const [sel, setSel] = useState(null);
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
    } catch {}
    api()
      .get("/gudang")
      .then((r) => {
        const z = Array.from(
          new Set(
            unwrap(r)
              .map((g: any) => g.zone)
              .filter(Boolean),
          ),
        );
        if (z.length) setAllZones(z as string[]);
      })
      .catch(() => {});
    api()
      .get("/shifts")
      .then((r) => setShifts(unwrap(r)))
      .catch(() => {});
  }, []);

  useEffect(() => {
    load();
    loadHistory();
  }, [zone]);

  const load = async () => {
    setLoading(true);
    try {
      const res = await api().get(`/inventory/opname/summary?zone=${zone}`);
      setSummary(unwrap(res));
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

  const handleExport = async () => {
    setExporting(true);
    try {
      const res = await api().get(`/inventory/opname/export?zone=${zone}`);
      const data = unwrap(res);
      if (!data || !data.length) {
        notifications.show({
          title: "Info",
          message: "Tidak ada data untuk diexport",
          color: "blue",
        });
        setExporting(false);
        return;
      }
      downloadExcel(data, zone);
      notifications.show({
        title: "Export Berhasil",
        message: `${data.length} baris data diexport ke Excel`,
        color: "green",
      });
    } catch (e) {
      notifications.show({
        title: "Error",
        message: "Gagal export data",
        color: "red",
      });
    }
    setExporting(false);
  };

  const handlePrint = async () => {
    setExporting(true);
    try {
      const res = await api().get(`/inventory/opname/export?zone=${zone}`);
      const data = unwrap(res);
      if (!data || !data.length) {
        notifications.show({
          title: "Info",
          message: "Tidak ada data untuk diprint",
          color: "blue",
        });
        setExporting(false);
        return;
      }

      const win = window.open("", "_blank");
      if (!win) return;
      win.document.write(`
                <html>
                <head>
                    <title>Stock Opname - ${zone}</title>
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
                    <div class="header">STOCK OPNAME REPORT - ZONA ${zone}</div>
                    <div class="info">
                        <div>
                            <b>Zone / Area:</b> ${zone}<br/>
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
                                <th>Rak</th>
                                <th>Item</th>
                                <th>Batch</th>
                                <th>Exp</th>
                                <th>Shift</th>
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
                                    <td>${r.nomor_rak}</td>
                                    <td>${r.item_name || ""}</td>
                                    <td>${r.batch_lot || "-"}</td>
                                    <td>${r.expiry_date ?? "-"}</td>
                                    <td>${r.shift || "-"}</td>
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
    } catch (e) {
      notifications.show({
        title: "Error",
        message: "Gagal fetch laporan",
        color: "red",
      });
    }
    setExporting(false);
  };

  const selRack = (s) => {
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

  // === UNIVERSAL ACCURACY: hitung per barang melintasi semua rak ===
  const barangAccMap: Record<
    number,
    { totalSistem: number; totalOpname: number }
  > = {};
  summary.forEach((s: any) => {
    s.stocks?.forEach((st: any) => {
      const bid = st.barang?.id;
      if (!bid) return;
      if (!barangAccMap[bid])
        barangAccMap[bid] = { totalSistem: 0, totalOpname: 0 };
      barangAccMap[bid].totalSistem += st.qty;
      if (s.opnamed) barangAccMap[bid].totalOpname += st.qty;
    });
  });

  // Hitung global accuracy dari barang-barang yang sudah diopname
  const allBarangs = Object.values(barangAccMap);
  const opnamedBarangs = allBarangs.filter((b) => b.totalOpname > 0);
  const avgAccuracy =
    opnamedBarangs.length > 0
      ? Math.round(
          opnamedBarangs.reduce((sum, b) => {
            const acc =
              b.totalSistem > 0
                ? (Math.min(b.totalOpname, b.totalSistem) /
                    Math.max(b.totalOpname, b.totalSistem)) *
                  100
                : 100;
            return sum + acc;
          }, 0) / opnamedBarangs.length,
        )
      : 100;

  // Aging count (menggunakan storage time > 90 hari)
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

  // Grouping by Kolom then Level
  const byKolom = {};
  summary.forEach((s: any) => {
    const k = s.gudang.kolom || "A";
    const lvl = s.gudang.level || 1;
    if (!byKolom[k]) byKolom[k] = {};
    if (!byKolom[k][lvl]) byKolom[k][lvl] = [];
    byKolom[k][lvl].push(s);
  });
  const sortedKoloms = Object.keys(byKolom).sort();

  // Get aging color for rack
  const getRackColor = (s) => {
    if (!s.filled) return { bg: "#9ca3af", text: "#fff" }; // Abu kosong
    const hasExpired = s.stocks?.some(
      (st) => st.expiry_date && new Date(st.expiry_date) < new Date(),
    );
    if (hasExpired) return { bg: "#ef4444", text: "#fff" };
    const hasNearExp = s.stocks?.some((st) => {
      if (!st.expiry_date) return false;
      const days =
        (new Date(st.expiry_date).getTime() - Date.now()) /
        (1000 * 60 * 60 * 24);
      return days < 30;
    });
    if (hasNearExp) return { bg: "#f97316", text: "#fff" };
    const hasAging = s.stocks?.some((st) => {
      if (!st.created_at) return false;
      const days =
        (Date.now() - new Date(st.created_at).getTime()) /
        (1000 * 60 * 60 * 24);
      return days > 90;
    });
    if (hasAging) return { bg: "#eab308", text: "#fff" };
    return { bg: "#0ea5e9", text: "#fff" }; // Biru = berisi normal
  };

  const shiftOpts = shifts.map((s: any) => ({
    value: String(s.id),
    label: s.name,
  }));

  return (
    <Box>
      <Box
        style={{
          background: "#fff",
          borderBottom: "1px solid #ddd",
          padding: "20px",
        }}
      >
        <Title order={4} style={{ color: "#d98b26", fontWeight: 800 }}>
          STOCK OPNAME
        </Title>

        <Group mt="md" gap="sm">
          {allZones.map((z: any) => (
            <Button
              key={z}
              radius="md"
              size="sm"
              style={{
                backgroundColor: zone === z ? "#111827" : "#1f2937",
                color: "#fff",
                fontWeight: 700,
                opacity: zone === z ? 1 : 0.8,
              }}
              onClick={() => setZone(z)}
            >
              {z}
            </Button>
          ))}

          <Box
            ml="auto"
            style={{ display: "flex", alignItems: "center", gap: 20 }}
          >
            <Group gap={6}>
              <Box
                w={40}
                h={16}
                style={{ background: "#0ea5e9", borderRadius: 10 }}
              ></Box>
              <Text size="xs" fw={700}>
                TERISI
              </Text>
            </Group>
            <Group gap={6}>
              <Box
                w={40}
                h={16}
                style={{ background: "#eab308", borderRadius: 10 }}
              ></Box>
              <Text size="xs" fw={700}>
                AGING (&gt;90 hari simpan)
              </Text>
            </Group>
            <Group gap={6}>
              <Box
                w={40}
                h={16}
                style={{ background: "#f97316", borderRadius: 10 }}
              ></Box>
              <Text size="xs" fw={700}>
                NEAR EXPIRED
              </Text>
            </Group>
            <Group gap={6}>
              <Box
                w={40}
                h={16}
                style={{ background: "#ef4444", borderRadius: 10 }}
              ></Box>
              <Text size="xs" fw={700}>
                EXPIRED
              </Text>
            </Group>
             <Group gap={6}>
              <Box
                w={40}
                h={16}
                style={{ border: "2px solid #7c3aed", borderRadius: 10 }}
              ></Box>
              <Text size="xs" fw={700}>
                RESERVED (PICKING PLAN)
              </Text>
            </Group>
            <Group gap={6}>
              <Box
                w={40}
                h={16}
                style={{ background: "#9ca3af", borderRadius: 10 }}
              ></Box>
              <Text size="xs" fw={700}>
                KOSONG
              </Text>
            </Group>
          </Box>
        </Group>
      </Box>

      <Box p="xl">
        <Group justify="space-between" align="flex-end" mb="xl">
          <Group gap="xs">
            <TextInput
              placeholder="Cari berdasarkan ID, Kode..."
              size="xs"
              radius="md"
              style={{ width: 220 }}
              leftSection="🔍"
            />
          </Group>

          <Box style={{ textAlign: "right" }}>
            {agingCount > 0 && (
              <Text size="xs" c="orange" fw={700} mb={4}>
                ⚠ Aging Material: {agingCount} rak | Expired: {expiredCount} rak
              </Text>
            )}
            <Group gap="xs">
              <Button
                size="xs"
                color="red"
                radius="md"
                loading={exporting}
                leftSection={<IconFileTypePdf size={16} />}
                onClick={handlePrint}
              >
                Print PDF
              </Button>
              <Button
                size="xs"
                color="green"
                radius="md"
                loading={exporting}
                leftSection={<IconFileSpreadsheet size={16} />}
                onClick={handleExport}
              >
                Export Excel
              </Button>
            </Group>
          </Box>
        </Group>

        {loading ? (
          <Loader />
        ) : (
          <Box>
            {sortedKoloms.map((k: any) => {
              const levelsMap = byKolom[k];
              const sortedLevels = Object.keys(levelsMap).sort(
                (a, b) => Number(a) - Number(b),
              );

              return (
                <Box key={k} mb="xl">
                  <Group gap="xl" mb="md" mt="md">
                    <Text fw={800} size="sm">
                      LEVEL
                    </Text>
                    <Text fw={800} size="sm">
                      KOLOM : {k}
                    </Text>
                  </Group>

                  <Stack gap="md">
                    {sortedLevels.map((lvl: any) => {
                      const racks = levelsMap[lvl].sort((a, b) =>
                        a.gudang.name.localeCompare(b.gudang.name),
                      );
                      return (
                        <Group key={lvl} gap="xl" align="center" wrap="nowrap">
                          <Text fw={800} size="sm" w={60}>
                            LEVEL {lvl}
                          </Text>

                          <Group gap="xs" style={{ flexWrap: "wrap" }}>
                            {racks.map((r: any) => {
                              const { bg, text } = getRackColor(r);
                              const isOpnamed = r.opnamed;
                              const hasReserved = r.totalReservedQty > 0;
                              const borderBottom = hasReserved
                                ? "3px solid #7c3aed"
                                : isOpnamed
                                ? "3px solid #000"
                                : "none";

                              // Tooltip: info barang dan qty di tiap rak
                              const tooltipText = r.filled
                                ? r.stocks
                                    ?.map(
                                      (s: any) =>
                                        `${s.barang?.nama}: ${s.qty} ${s.satuan || ""} (Reserved: ${s.reserved_qty || 0})`,
                                    )
                                    .join("\n")
                                : "KOSONG";

                              return (
                                <Box
                                  key={r.gudang.id}
                                  style={{ position: "relative" }}
                                >
                                  <Button
                                    radius="md"
                                    style={{
                                      background: bg,
                                      color: text,
                                      width: 75,
                                      height: 36,
                                      borderBottom: borderBottom,
                                      fontWeight: 800,
                                      fontSize: 12,
                                      padding: 0,
                                    }}
                                    onClick={() => selRack(r)}
                                    title={tooltipText}
                                  >
                                    {r.gudang.name}
                                  </Button>
                                  {/* Indikator kecil qty */}
                                  {r.filled && (
                                    <Text
                                      size="xs"
                                      style={{
                                        position: "absolute",
                                        bottom: -14,
                                        left: 0,
                                        right: 0,
                                        textAlign: "center",
                                        fontSize: 9,
                                        color: "#374151",
                                        fontWeight: 600,
                                      }}
                                    >
                                      {r.totalQty} {r.stocks?.[0]?.satuan || ""}
                                    </Text>
                                  )}
                                </Box>
                              );
                            })}
                          </Group>
                        </Group>
                      );
                    })}
                  </Stack>
                </Box>
              );
            })}
          </Box>
        )}

        {/* Opname History */}
        <Box mt="xl">
          <Group justify="space-between" mb="sm">
            <Title order={5} style={{ color: "#111827", fontWeight: 800 }}>
              RIWAYAT OPNAME - {zone}
            </Title>
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
            <Box>
              {opnameLogs.length === 0 ? (
                <Text size="sm" c="dimmed" ta="center" py="md">
                  Belum ada riwayat opname untuk zone ini.
                </Text>
              ) : (
                <Table
                  withColumnBorders
                  style={{ fontSize: 11, border: "1px solid #dee2e6" }}
                >
                  <Table.Thead style={{ background: "#111827" }}>
                    <Table.Tr>
                      <Table.Th
                        style={{
                          color: "#fff",
                          fontSize: 11,
                          textAlign: "center",
                        }}
                      >
                        ID
                      </Table.Th>
                      <Table.Th style={{ color: "#fff", fontSize: 11 }}>
                        Item
                      </Table.Th>
                      <Table.Th
                        style={{
                          color: "#fff",
                          fontSize: 11,
                          textAlign: "center",
                        }}
                      >
                        Tanggal
                      </Table.Th>
                      <Table.Th
                        style={{
                          color: "#fff",
                          fontSize: 11,
                          textAlign: "center",
                        }}
                      >
                        Shift
                      </Table.Th>
                      <Table.Th
                        style={{
                          color: "#fff",
                          fontSize: 11,
                          textAlign: "center",
                        }}
                      >
                        Rak
                      </Table.Th>
                      <Table.Th
                        style={{
                          color: "#fff",
                          fontSize: 11,
                          textAlign: "center",
                        }}
                      >
                        Qty
                      </Table.Th>
                      <Table.Th style={{ color: "#fff", fontSize: 11 }}>
                        Keterangan
                      </Table.Th>
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
                        <Table.Td ta="center">
                          {l.qty} {l.satuan || ""}
                        </Table.Td>
                        <Table.Td>{l.note || "-"}</Table.Td>
                      </Table.Tr>
                    ))}
                  </Table.Tbody>
                </Table>
              )}
            </Box>
          )}
        </Box>

        <Modal
          opened={opened}
          onClose={close}
          title={<Text fw={900}>STOCK OPNAME</Text>}
          centered
          size="sm"
          styles={{ content: { backgroundColor: "#e5e7eb", borderRadius: 12 } }}
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
                    backgroundColor: "#fff",
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
                    backgroundColor: "#fff",
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
                styles={{ input: { backgroundColor: "#fff" } }}
              />

              {/* Shift selector - required */}
              <Select
                label="Shift"
                size="sm"
                radius="md"
                data={shiftOpts}
                value={shiftId}
                onChange={(v) => setShiftId(v || "")}
                placeholder="Pilih Shift"
                required
                nothingFoundMessage="Tidak ada shift tersedia"
                styles={{ input: { backgroundColor: "#fff", fontWeight: 600 } }}
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
                      backgroundColor: "#fff",
                      color:
                        sel.stocks[0]?.expiry_date &&
                        new Date(sel.stocks[0].expiry_date) < new Date()
                          ? "red"
                          : "inherit",
                      fontWeight: 600,
                    },
                  }}
                />
                {sel.stocks[0]?.expiry_date &&
                  (() => {
                    const days = Math.floor(
                      (new Date(sel.stocks[0].expiry_date).getTime() -
                        Date.now()) /
                        (1000 * 60 * 60 * 24),
                    );
                    return days < 0 ? (
                      <Text size="xs" c="red" fw={700}>
                        EXPIRED ({Math.abs(days)} hari lalu)
                      </Text>
                    ) : days < 30 ? (
                      <Text size="xs" c="orange" fw={700}>
                        NEAR EXPIRED: {days} hari
                      </Text>
                    ) : null;
                  })()}
              </Box>

              {/* Aging storage info */}
              {sel.stocks[0]?.created_at &&
                (() => {
                  const days = Math.floor(
                    (Date.now() -
                      new Date(sel.stocks[0].created_at).getTime()) /
                      (1000 * 60 * 60 * 24),
                  );
                  return days > 90 ? (
                    <Text size="xs" c="orange" fw={700}>
                      ⚠ AGING: Sudah {days} hari di gudang
                    </Text>
                  ) : (
                    <Text size="xs" c="dimmed">
                      Hari simpan: {days} hari
                    </Text>
                  );
                })()}

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
                        backgroundColor: "#fff",
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
                    styles={{ input: { backgroundColor: "#fff" } }}
                  />
                </Group>
              </Box>

              {sel.totalReservedQty > 0 && (
                <Box mt="xs">
                  <Text size="xs" fw={700} c="orange" mb={2}>
                    Reserved Stock (Picking Plan)
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
                          backgroundColor: "#fef3c7",
                          color: "#d97706",
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
                      styles={{ input: { backgroundColor: "#fff" } }}
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
                        backgroundColor: "#fff",
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
                    styles={{ input: { backgroundColor: "#fff" } }}
                  />
                </Group>
              </Box>

              {/* Variance display */}
              {actualQty !== "" && actualQty !== sel.totalQty && (
                <Box
                  style={{
                    background: "#fff",
                    borderRadius: 8,
                    padding: "8px 12px",
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
                bg="#111827"
                c="#fff"
                size="md"
                radius="md"
                mt="sm"
                onClick={doOpname}
                style={{ fontWeight: 700 }}
              >
                {sel.opnamed && userRole >= 3 ? "Update Opname" : "Submit"}
              </Button>
              <Button
                fullWidth
                bg="#ef4444"
                c="#fff"
                size="md"
                radius="md"
                onClick={close}
                style={{ fontWeight: 700 }}
              >
                Close
              </Button>
            </Stack>
          )}
        </Modal>
      </Box>
    </Box>
  );
}
