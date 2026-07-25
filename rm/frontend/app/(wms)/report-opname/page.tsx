// @ts-nocheck
"use client";
import React, { useState, useEffect } from "react";
import {
  Box,
  Group,
  Title,
  Table,
  Badge,
  TextInput,
  Select,
  Loader,
  Text,
  Autocomplete,
  ActionIcon,
  Tooltip,
} from "@mantine/core";
import { api, unwrap, fmt, saveXlsx, dedup } from "../lib/api";
import {
  IconFileTypePdf,
  IconFileSpreadsheet,
  IconSearch,
  IconFilter,
  IconRefresh,
} from "@tabler/icons-react";
import * as XLSX from "xlsx";

function exportExcel(data: any[], from: string, to: string, filterBarangNama?: string) {
  const dateStr = new Date().toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
  const periodeStr =
    from && to
      ? `${from} s/d ${to}`
      : from
        ? `Dari ${from}`
        : to
          ? `Sampai ${to}`
          : "Semua Periode";
  const headerRows = [
    ["LAPORAN STOCK OPNAME"],
    [`Dicetak: ${dateStr}`],
    [`Periode: ${periodeStr}`],
    filterBarangNama ? [`Filter Produk: ${filterBarangNama}`] : [],
    [],
    [
      "ID Opname",
      "Item / Produk",
      "Tanggal Opname",
      "Shift",
      "Lokasi (Rak)",
      "Zone",
      "Qty Opname (Fisik)",
      "Satuan",
      "Keterangan / Note",
    ],
  ].filter((r) => r.length > 0);

  const rows = data.map((r: any) => [
    `LOG-${r.id}`,
    r.barang?.nama || "",
    fmt(r.created_at),
    r.shift?.name || "-",
    r.gudang?.name || "-",
    r.gudang?.zone || "-",
    r.qty,
    r.satuan || "",
    r.note || "",
  ]);

  const ws = XLSX.utils.aoa_to_sheet([...headerRows, ...rows]);
  const lastCol = 8;
  ws["!merges"] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: lastCol } },
    { s: { r: 1, c: 0 }, e: { r: 1, c: lastCol } },
    { s: { r: 2, c: 0 }, e: { r: 2, c: lastCol } },
    ...(filterBarangNama ? [{ s: { r: 3, c: 0 }, e: { r: 3, c: lastCol } }] : []),
  ];
  ws["!cols"] = [
    { wch: 12 },
    { wch: 28 },
    { wch: 14 },
    { wch: 12 },
    { wch: 14 },
    { wch: 12 },
    { wch: 16 },
    { wch: 10 },
    { wch: 36 },
  ];

  const wb = XLSX.utils.book_new();
  const sheetName = filterBarangNama
    ? `Opname-${filterBarangNama.slice(0, 20)}`
    : "Report Opname";
  XLSX.utils.book_append_sheet(wb, ws, sheetName);

  // Rekap per shift
  const shiftMap: Record<string, number> = {};
  data.forEach((r: any) => {
    const sh = r.shift?.name || "Tanpa Shift";
    shiftMap[sh] = (shiftMap[sh] || 0) + 1;
  });
  const rekapRows = [
    ["REKAP PER SHIFT"],
    [`Periode: ${periodeStr}`],
    [],
    ["Shift", "Jumlah Opname"],
    ...Object.entries(shiftMap).map(([sh, cnt]) => [sh, cnt]),
  ];
  const wsRekap = XLSX.utils.aoa_to_sheet(rekapRows);
  wsRekap["!cols"] = [{ wch: 16 }, { wch: 16 }];
  XLSX.utils.book_append_sheet(wb, wsRekap, "Rekap Shift");

  const produkPart = filterBarangNama
    ? `_${filterBarangNama.replace(/[^a-zA-Z0-9]/g, "_").slice(0, 20)}`
    : "";
  const periodePart =
    from && to
      ? `_${from.replace(/-/g, "")}-${to.replace(/-/g, "")}`
      : `_${new Date().toISOString().split("T")[0].replace(/-/g, "")}`;
  saveXlsx(XLSX, wb, `ReportOpname${produkPart}${periodePart}.xlsx`);
}

export default function ReportOpnamePage() {
  const [logs, setLogs] = useState<any[]>([]);
  const [shifts, setShifts] = useState<any[]>([]);
  const [barangs, setBarangs] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [filterShift, setFilterShift] = useState("");
  const [filterBarang, setFilterBarang] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api().get("/shifts").then((r) => setShifts(unwrap(r)));
    api().get("/barang").then((r) => setBarangs(unwrap(r)));
    load();
  }, []);

  const load = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (from) params.set("from", from);
      if (to) params.set("to", to);
      const res = await api().get(`/inventory/logs/opname?${params}`);
      setLogs(unwrap(res));
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  const barangOpts = dedup([
    { value: "", label: "Semua Item" },
    ...barangs
      .filter((b: any) => b?.id)
      .map((b: any) => ({ value: String(b.id), label: b.nama })),
  ]);

  const filtered = logs
    .filter(
      (r: any) =>
        !search ||
        r.barang?.nama?.toLowerCase().includes(search.toLowerCase()) ||
        String(r.id) === search,
    )
    .filter((r: any) => !filterShift || r.shift?.name === filterShift)
    .filter(
      (r: any) => !filterBarang || String(r.barang?.id) === filterBarang,
    );

  const handlePrint = () => {
    const periodeStr =
      from && to
        ? `${from} s/d ${to}`
        : from
          ? `Dari ${from}`
          : to
            ? `Sampai ${to}`
            : "Semua Periode";
    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(`
      <html>
      <head>
          <title>Laporan Opname - ${periodeStr}</title>
          <style>
              body { font-family: Arial; padding: 20px; font-size: 10px; }
              table { width: 100%; border-collapse: collapse; margin-top: 15px; }
              th, td { border: 1px solid #333; padding: 5px; text-align: left; }
              th { background: #1f2937; color: #fff; font-size: 10px; }
              .title { font-size: 15px; font-weight: bold; margin-bottom: 4px; }
              .subtitle { font-size: 11px; color: #555; margin-bottom: 12px; border-bottom: 2px solid #000; padding-bottom: 8px; }
          </style>
      </head>
      <body>
          <div class="title">LAPORAN STOCK OPNAME</div>
          <div class="subtitle">Periode: ${periodeStr} &nbsp;|&nbsp; Dicetak: ${new Date().toLocaleDateString(
            "id-ID",
            { day: "2-digit", month: "long", year: "numeric" },
          )}</div>
          <table>
              <thead>
                  <tr>
                      <th>ID Opname</th>
                      <th>Item / Produk</th>
                      <th>Tanggal Opname</th>
                      <th>Shift</th>
                      <th>Lokasi (Rak)</th>
                      <th>Zone</th>
                      <th>Qty Fisik</th>
                      <th>Satuan</th>
                      <th>Keterangan</th>
                  </tr>
              </thead>
              <tbody>
                  ${filtered
                    .map(
                      (r: any) => `
                      <tr>
                          <td>LOG-${r.id}</td>
                          <td>${r.barang?.nama || "-"}</td>
                          <td>${fmt(r.created_at)}</td>
                          <td>${r.shift?.name || "-"}</td>
                          <td>${r.gudang?.name || "-"}</td>
                          <td>${r.gudang?.zone || "-"}</td>
                          <td>${r.qty}</td>
                          <td>${r.satuan || ""}</td>
                          <td>${r.note || "-"}</td>
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
  };

  return (
    <Box p="md" bg="#fff" style={{ minHeight: "100vh" }}>
      {/* Top Single Strict Inline Toolbar (Space-Between, No-Wrap) */}
      <Group
        justify="space-between"
        align="center"
        mb="lg"
        wrap="nowrap"
        gap="sm"
        pb="xs"
        style={{ borderBottom: "1px solid #f1f5f9" }}
      >
        <Title
          order={3}
          style={{ color: "#e6921e", fontWeight: 900, letterSpacing: "-0.02em", whitespace: "nowrap" }}
        >
          REPORT OPNAME
        </Title>

        <Group gap="xs" align="center" wrap="nowrap">
          <TextInput
            placeholder="Cari ID, Item..."
            size="xs"
            radius="md"
            style={{ width: 140 }}
            leftSection={<IconSearch size={14} color="#64748b" />}
            value={search}
            onChange={(e: any) => setSearch(e.target.value)}
          />

          <Autocomplete
            size="xs"
            placeholder="Semua Shift"
            radius="md"
            data={shifts.map((s: any) => s.name)}
            value={filterShift}
            onChange={(v) => setFilterShift(v)}
            style={{ width: 110 }}
          />

          <Select
            size="xs"
            placeholder="Semua Item"
            clearable
            radius="md"
            data={barangOpts}
            value={filterBarang}
            onChange={(v: any) => setFilterBarang(v || "")}
            style={{ width: 130 }}
          />

          <Group gap={4} wrap="nowrap" align="center">
            <Text size="xs" fw={600} c="dimmed">
              Dari
            </Text>
            <TextInput
              type="date"
              size="xs"
              radius="md"
              value={from}
              onChange={(e: any) => setFrom(e.target.value)}
              style={{ width: 115 }}
            />
          </Group>

          <Group gap={4} wrap="nowrap" align="center">
            <Text size="xs" fw={600} c="dimmed">
              Sampai
            </Text>
            <TextInput
              type="date"
              size="xs"
              radius="md"
              value={to}
              onChange={(e: any) => setTo(e.target.value)}
              style={{ width: 115 }}
            />
          </Group>

          <Tooltip label="Filter Data">
            <ActionIcon
              color="blue"
              variant="filled"
              size="md"
              radius="md"
              onClick={load}
            >
              <IconFilter size={16} />
            </ActionIcon>
          </Tooltip>

          <Tooltip label="Reset Filter">
            <ActionIcon
              color="gray"
              variant="outline"
              size="md"
              radius="md"
              onClick={() => {
                setSearch("");
                setFilterShift("");
                setFilterBarang("");
                setFrom("");
                setTo("");
                load();
              }}
            >
              <IconRefresh size={16} />
            </ActionIcon>
          </Tooltip>

          <Tooltip label="Export Excel / CSV">
            <ActionIcon
              color="teal"
              variant="filled"
              size="md"
              radius="md"
              onClick={() =>
                exportExcel(
                  filtered,
                  from,
                  to,
                  barangs.find((b: any) => String(b.id) === filterBarang)?.nama,
                )
              }
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
              onClick={handlePrint}
            >
              <IconFileTypePdf size={16} />
            </ActionIcon>
          </Tooltip>
        </Group>
      </Group>

      {loading ? (
        <Loader color="orange" />
      ) : (
        <Table.ScrollContainer minWidth={900}>
          <Table
            withColumnBorders
            style={{ fontSize: 11, border: "1px solid #dee2e6" }}
          >
          <Table.Thead style={{ background: "#f1f5f9", borderBottom: "2px solid #cbd5e1" }}>
            <Table.Tr>
              <Table.Th
                style={{ color: "#334155", fontSize: 11, textAlign: "center" }}
              >
                ID Opname
              </Table.Th>
              <Table.Th style={{ color: "#334155", fontSize: 11 }}>Item</Table.Th>
              <Table.Th
                style={{ color: "#334155", fontSize: 11, textAlign: "center" }}
              >
                Tanggal
              </Table.Th>
              <Table.Th
                style={{ color: "#334155", fontSize: 11, textAlign: "center" }}
              >
                Shift
              </Table.Th>
              <Table.Th
                style={{ color: "#334155", fontSize: 11, textAlign: "center" }}
              >
                Lokasi
              </Table.Th>
              <Table.Th
                style={{ color: "#334155", fontSize: 11, textAlign: "center" }}
              >
                Zone
              </Table.Th>
              <Table.Th
                style={{ color: "#334155", fontSize: 11, textAlign: "center" }}
              >
                Qty (Hasil)
              </Table.Th>
              <Table.Th
                style={{ color: "#334155", fontSize: 11, textAlign: "center" }}
              >
                Satuan
              </Table.Th>
              <Table.Th style={{ color: "#334155", fontSize: 11 }}>
                Keterangan / Note
              </Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {filtered.length === 0 ? (
              <Table.Tr>
                <Table.Td colSpan={9} ta="center" c="dimmed">
                  Tidak ada log/data ditemukan
                </Table.Td>
              </Table.Tr>
            ) : null}
            {filtered.map((r: any) => (
              <Table.Tr
                key={r.id}
                style={{ background: "#fff", borderTop: "1px solid #e5e7eb" }}
              >
                <Table.Td
                  fw={700}
                  ta="center"
                  style={{
                    verticalAlign: "middle",
                    borderRight: "1px solid #eee",
                  }}
                >
                  LOG-{r.id}
                </Table.Td>
                <Table.Td fw={600}>{r.barang?.nama}</Table.Td>
                <Table.Td
                  ta="center"
                  style={{
                    verticalAlign: "middle",
                    borderRight: "1px solid #eee",
                  }}
                >
                  {fmt(r.created_at)}
                </Table.Td>
                <Table.Td
                  ta="center"
                  style={{
                    verticalAlign: "middle",
                    borderRight: "1px solid #eee",
                  }}
                >
                  <span
                    style={{
                      background: r.shift?.name ? "#111827" : "#e5e7eb",
                      color: r.shift?.name ? "#fff" : "#9ca3af",
                      borderRadius: 4,
                      padding: "2px 8px",
                      fontSize: 11,
                      fontWeight: 700,
                    }}
                  >
                    {r.shift?.name || "-"}
                  </span>
                </Table.Td>
                <Table.Td ta="center" fw={700} c="#111827">
                  {r.gudang?.name}
                </Table.Td>
                <Table.Td ta="center">{r.gudang?.zone || "-"}</Table.Td>
                <Table.Td ta="center">{r.qty}</Table.Td>
                <Table.Td ta="center">{r.satuan}</Table.Td>
                <Table.Td
                  style={{
                    verticalAlign: "middle",
                    borderLeft: "1px solid #eee",
                  }}
                >
                  {r.note || "-"}
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
        </Table.ScrollContainer>
      )}
    </Box>
  );
}
