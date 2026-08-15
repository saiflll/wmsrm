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
import { api, unwrap, fmt, fmtDateTime, statusLabel, statusColor, saveXlsx } from "../lib/api";
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
    ["LAPORAN INBOUND - PENERIMAAN BARANG"],
    [`Dicetak: ${dateStr}`],
    [`Periode: ${periodeStr}`],
    filterBarangNama ? [`Filter Produk: ${filterBarangNama}`] : [],
    [],
    [
      "No.PO/SJ",
      "Item / Produk",
      "Tanggal Income",
      "Tanggal Posting",
      "Jam Posting",
      "Shift",
      "Tanggal Expired",
      "Qty",
      "Satuan",
      "Status",
      "Zone",
      "Lokasi Rak",
      "Supplier",
      "Batch No",
      "Jam Datang",
      "Jam Bongkar",
      "Jam Selesai",
      "Keterangan",
      "Dibuat Oleh",
      "Waktu Dibuat",
      "Di-ACC Oleh",
      "Waktu ACC",
    ],
  ].filter((r) => r.length > 0);
  const rows = data.map((r: any) => [
    r.no_po || "-",
    r.barang?.nama || "",
    r.tanggal_income ? r.tanggal_income : (r.created_at ? fmt(r.created_at) : "-"),
    r.created_at ? fmt(r.created_at) : "-",
    r.created_at ? fmtDateTime(r.created_at).split(" ")[1] : "-",
    r.shift?.name || "-",
    r.expiry_date ? fmt(r.expiry_date) : "-",
    r.qty,
    r.satuan || "",
    statusLabel(r.expiry_date),
    r.gudang?.zone || "-",
    r.gudang?.name || "-",
    r.supplier || "-",
    r.batch_no || "-",
    r.jam_datang || "-",
    r.jam_bongkar || "-",
    r.jam_selesai || "-",
    r.note || r.keterangan || "-",
    r.planned_by_username || "Manual / tanpa planning",
    fmtDateTime(r.planned_at),
    r.executed_by_username || r.user?.username || "sistem",
    fmtDateTime(r.executed_at || r.created_at),
  ]);
  const ws = XLSX.utils.aoa_to_sheet([...headerRows, ...rows]);
  const mergeEndRow = filterBarangNama ? 4 : 3;
  ws["!merges"] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: 21 } },
    { s: { r: 1, c: 0 }, e: { r: 1, c: 21 } },
    { s: { r: 2, c: 0 }, e: { r: 2, c: 21 } },
    ...(filterBarangNama ? [{ s: { r: 3, c: 0 }, e: { r: 3, c: 21 } }] : []),
  ];
  ws["!cols"] = [
    { wch: 16 },
    { wch: 28 },
    { wch: 14 },
    { wch: 16 },
    { wch: 14 },
    { wch: 12 },
    { wch: 14 },
    { wch: 8 },
    { wch: 8 },
    { wch: 12 },
    { wch: 12 },
    { wch: 14 },
    { wch: 20 },
    { wch: 18 },
    { wch: 20 },
    { wch: 18 },
    { wch: 20 },
    { wch: 16 },
    { wch: 12 },
    { wch: 12 },
    { wch: 12 },
    { wch: 20 },
  ];
  const wb = XLSX.utils.book_new();
  const sheetName = filterBarangNama
    ? `Inbound-${filterBarangNama.slice(0, 20)}`
    : "Inbound";
  XLSX.utils.book_append_sheet(wb, ws, sheetName);

  const produkPart = filterBarangNama
    ? `_${filterBarangNama.replace(/[^a-zA-Z0-9]/g, "_").slice(0, 20)}`
    : "";
  const periodePart =
    from && to
      ? `_${from.replace(/-/g, "")}-${to.replace(/-/g, "")}`
      : `_${new Date().toISOString().split("T")[0].replace(/-/g, "")}`;
  saveXlsx(XLSX, wb, `ReportInbound${produkPart}${periodePart}.xlsx`);
}

export default function ReportInboundPage() {
  const [logs, setLogs] = useState<any[]>([]);
  const [shifts, setShifts] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [barangs, setBarangs] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [filterShift, setFilterShift] = useState("");
  const [filterSupplier, setFilterSupplier] = useState("");
  const [filterBarang, setFilterBarang] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api().get("/shifts").then((r) => setShifts(unwrap(r)));
    api().get("/customers").then((r) => setCustomers(unwrap(r)));
    api().get("/barang").then((r) => setBarangs(unwrap(r)));
    load();
  }, []);

  const load = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (from) params.set("from", from);
      if (to) params.set("to", to);
      const res = await api().get(`/inventory/logs/inbound?${params}`);
      setLogs(unwrap(res));
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  const filtered = logs
    .filter(
      (r: any) =>
        !search ||
        r.barang?.nama?.toLowerCase().includes(search.toLowerCase()) ||
        r.no_po?.includes(search) ||
        String(r.id) === search,
    )
    .filter((r: any) => !filterShift || r.shift?.name === filterShift)
    .filter((r: any) => !filterSupplier || r.supplier === filterSupplier)
    .filter(
      (r: any) => !filterBarang || String(r.barang?.id) === filterBarang,
    );

  const groupedLogs: Record<string, any[]> = {};
  filtered.forEach((r: any) => {
    const key = r.no_po || `LOG-${r.id}`;
    if (!groupedLogs[key]) groupedLogs[key] = [];
    groupedLogs[key].push(r);
  });

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
          <title>Laporan Inbound - ${periodeStr}</title>
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
          <div class="header">LAPORAN INBOUND - PENERIMAAN BARANG</div>
          <div class="subtitle">Periode: ${periodeStr} &nbsp;|&nbsp; Dicetak: ${new Date().toLocaleDateString(
            "id-ID",
            { day: "2-digit", month: "long", year: "numeric" },
          )}</div>
          <table>
              <thead>
                  <tr>
                      <th>No.PO/SJ</th>
                      <th>Item / Produk</th>
                      <th>Supplier</th>
                      <th>Shift</th>
                      <th>Tgl.Income</th>
                      <th>Batch</th>
                      <th>Tgl.Expired</th>
                      <th>Qty</th>
                      <th>Satuan</th>
                      <th>Status</th>
                      <th>Zone / Rak</th>
                      <th>Jam Datang</th>
                      <th>Jam Bongkar</th>
                      <th>Jam Selesai</th>
                      <th>Keterangan</th>
                      <th>Audit Planning / ACC</th>
                  </tr>
              </thead>
              <tbody>
                  ${Object.entries(groupedLogs)
                    .map(([transId, items]: [string, any[]]) => {
                      return items
                        .map(
                          (r: any, idx: number) => `
                          <tr>
                              ${
                                idx === 0
                                  ? `<td rowspan="${items.length}">${transId}</td>`
                                  : ""
                              }
                              <td>${r.barang?.nama || "-"}</td>
                              ${
                                idx === 0
                                  ? `<td rowspan="${items.length}">${
                                      r.supplier || "-"
                                    }</td>`
                                  : ""
                              }
                              ${
                                idx === 0
                                  ? `<td rowspan="${items.length}">${
                                      r.shift?.name || "-"
                                    }</td>`
                                  : ""
                              }
                              ${
                                idx === 0
                                  ? `<td rowspan="${items.length}">${
                                      r.tanggal_income ||
                                      fmt(r.created_at)
                                    }</td>`
                                  : ""
                              }
                              <td>${r.batch_no || "-"}</td>
                              <td>${
                                r.expiry_date
                                  ? fmt(r.expiry_date)
                                  : "-"
                              }</td>
                              <td>${r.qty}</td>
                              <td>${r.satuan || ""}</td>
                              <td>${statusLabel(r.expiry_date)}</td>
                              <td>${r.gudang?.name || "-"} (${
                                r.gudang?.zone || "-"
                              })</td>
                              ${
                                idx === 0
                                  ? `<td rowspan="${items.length}">${
                                      r.jam_datang || "-"
                                    }</td>`
                                  : ""
                              }
                              ${
                                idx === 0
                                  ? `<td rowspan="${items.length}">${
                                      r.jam_bongkar || "-"
                                    }</td>`
                                  : ""
                              }
                              ${
                                idx === 0
                                  ? `<td rowspan="${items.length}">${
                                      r.jam_selesai || "-"
                                    }</td>`
                                  : ""
                              }
                              <td>${r.note || r.keterangan || "-"}</td>
                              ${idx === 0 ? `<td rowspan="${items.length}">
                                <b>Dibuat:</b> ${r.planned_by_username || "Manual / tanpa planning"}<br>${fmtDateTime(r.planned_at)}<br>
                                <b>Di-ACC:</b> ${r.executed_by_username || r.user?.username || "sistem"}<br>${fmtDateTime(r.executed_at || r.created_at)}
                              </td>` : ""}
                          </tr>
                      `,
                        )
                        .join("");
                    })
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
      {/* Responsive Top Toolbar (Space-Between with Responsive Wrap) */}
      <Group
        justify="space-between"
        align="center"
        mb="lg"
        wrap="wrap"
        gap="xs"
        pb="xs"
        style={{ borderBottom: "1px solid #f1f5f9" }}
      >
        <Title
          order={3}
          style={{ color: "#e6921e", fontWeight: 900, letterSpacing: "-0.02em", whiteSpace: "nowrap" }}
        >
          REPORT INBOUND
        </Title>

        <Group gap="xs" align="center" wrap="wrap">
          <TextInput
            placeholder="Cari PO/SJ/Item..."
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
                setFilterSupplier("");
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
        <Table.ScrollContainer minWidth={1000}>
          <Table
            withColumnBorders
            style={{ fontSize: 11, border: "1px solid #dee2e6" }}
          >
          <Table.Thead style={{ background: "#f0fdfa", borderBottom: "2px solid #99f6e4" }}>
            <Table.Tr>
              <Table.Th
                style={{ color: "#0f766e", fontSize: 11, textAlign: "center" }}
              >
                ID Transaksi
              </Table.Th>
              <Table.Th style={{ color: "#0f766e", fontSize: 11 }}>Item</Table.Th>
              <Table.Th style={{ color: "#0f766e", fontSize: 11 }}>
                Tujuan/Supplier
              </Table.Th>
              <Table.Th
                style={{ color: "#0f766e", fontSize: 11, textAlign: "center" }}
              >
                Shift
              </Table.Th>
              <Table.Th
                style={{ color: "#0f766e", fontSize: 11, textAlign: "center" }}
              >
                Batch
              </Table.Th>
              <Table.Th
                style={{ color: "#0f766e", fontSize: 11, textAlign: "center" }}
              >
                Tgl.Expired
              </Table.Th>
              <Table.Th
                style={{ color: "#0f766e", fontSize: 11, textAlign: "center" }}
              >
                Qty
              </Table.Th>
              <Table.Th
                style={{ color: "#0f766e", fontSize: 11, textAlign: "center" }}
              >
                Status
              </Table.Th>
              <Table.Th
                style={{ color: "#0f766e", fontSize: 11, textAlign: "center" }}
              >
                Location
              </Table.Th>
              <Table.Th
                style={{ color: "#0f766e", fontSize: 11, textAlign: "center" }}
              >
                Jam Operasional
              </Table.Th>
              <Table.Th
                style={{ color: "#0f766e", fontSize: 11, textAlign: "center" }}
              >
                Keterangan
              </Table.Th>
              <Table.Th
                style={{ color: "#0f766e", fontSize: 11, textAlign: "center" }}
              >
                Audit Planning / ACC
              </Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {filtered.length === 0 ? (
              <Table.Tr>
                <Table.Td colSpan={12} ta="center" c="dimmed">
                  Tidak ada log/data ditemukan
                </Table.Td>
              </Table.Tr>
            ) : null}
            {Object.entries(groupedLogs).map(
              ([transId, items]: [string, any[]]) =>
                items.map((r: any, idx: number) => (
                  <Table.Tr
                    key={r.id}
                    style={{
                      background: "#fff",
                      borderTop: idx === 0 ? "1px solid #e5e7eb" : "none",
                      borderBottom: "none",
                    }}
                  >
                    {idx === 0 && (
                      <Table.Td
                        fw={700}
                        ta="center"
                        style={{
                          verticalAlign: "middle",
                          borderRight: "1px solid #eee",
                        }}
                        rowSpan={items.length}
                      >
                        {transId}
                      </Table.Td>
                    )}
                    <Table.Td fw={600}>{r.barang?.nama}</Table.Td>
                    {idx === 0 && (
                      <Table.Td
                        ta="center"
                        rowSpan={items.length}
                        style={{
                          verticalAlign: "middle",
                          borderRight: "1px solid #eee",
                        }}
                      >
                        {r.supplier || "-"}
                      </Table.Td>
                    )}
                    {idx === 0 && (
                      <Table.Td
                        ta="center"
                        rowSpan={items.length}
                        style={{
                          verticalAlign: "middle",
                          borderRight: "1px solid #eee",
                        }}
                      >
                        {r.shift?.name || "-"}
                      </Table.Td>
                    )}

                    <Table.Td ta="center">{r.batch_no || "-"}</Table.Td>
                    <Table.Td ta="center">
                      {r.expiry_date ? fmt(r.expiry_date) : "-"}
                    </Table.Td>
                    <Table.Td ta="center">
                      {r.qty} {r.satuan}
                    </Table.Td>

                    <Table.Td
                      ta="center"
                      fw={700}
                      c={statusColor(r.expiry_date)}
                      style={{ textTransform: "uppercase" }}
                    >
                      {statusLabel(r.expiry_date)}
                    </Table.Td>
                    <Table.Td ta="center" fw={700} c="#111827">
                      {r.gudang?.zone || "-"}
                    </Table.Td>

                    {idx === 0 && (
                      <Table.Td
                        ta="center"
                        rowSpan={items.length}
                        style={{
                          verticalAlign: "middle",
                          borderLeft: "1px solid #eee",
                        }}
                      >
                        <div style={{ fontSize: "10px" }}>
                          Datang: {r.jam_datang || "-"}
                        </div>
                        <div style={{ fontSize: "10px" }}>
                          Bongkar: {r.jam_bongkar || "-"}
                        </div>
                        <div style={{ fontSize: "10px" }}>
                          Selesai: {r.jam_selesai || "-"}
                        </div>
                      </Table.Td>
                    )}
                    <Table.Td ta="center">
                      {r.note || r.keterangan || "-"}
                    </Table.Td>

                    {idx === 0 && (
                      <Table.Td
                        ta="center"
                        rowSpan={items.length}
                        style={{
                          verticalAlign: "middle",
                          borderLeft: "1px solid #eee",
                        }}
                      >
                        <div><b>Dibuat:</b> {r.planned_by_username || "Manual / tanpa planning"}</div>
                        <div style={{ fontSize: 10, color: "#64748b" }}>{fmtDateTime(r.planned_at)}</div>
                        <div><b>Di-ACC:</b> {r.executed_by_username || r.user?.username || "sistem"}</div>
                        <div style={{ fontSize: 10, color: "#64748b" }}>{fmtDateTime(r.executed_at || r.created_at)}</div>
                      </Table.Td>
                    )}
                  </Table.Tr>
                )),
            )}
          </Table.Tbody>
        </Table>
        </Table.ScrollContainer>
      )}
    </Box>
  );
}
