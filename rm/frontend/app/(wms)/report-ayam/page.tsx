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
  ActionIcon,
  Tooltip,
} from "@mantine/core";
import { api, unwrap, fmt, saveXlsx } from "../lib/api";
import {
  IconFileTypePdf,
  IconFileSpreadsheet,
  IconSearch,
  IconFilter,
  IconRefresh,
} from "@tabler/icons-react";
import * as XLSX from "xlsx";

function exportExcel(data: any[], from: string, to: string) {
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
    ["LAPORAN SERAPAN & OPERASIONAL OUTBOUND AYAM"],
    [`Dicetak: ${dateStr}`],
    [`Periode: ${periodeStr}`],
    [],
    [
      "No",
      "Tanggal / Waktu Eksekusi",
      "Item / Produk Ayam",
      "Planning (kg)",
      "Outbound (kg)",
      "Serapan (%)",
      "Status Planning",
      "Dibuat Oleh",
      "Dieksekusi Oleh",
    ],
  ];
  const rows = data.map((r: any, idx: number) => {
    const planning = r.planning || 0;
    const outbound = r.outbound || 0;
    const serapan =
      r.serapan != null
        ? typeof r.serapan === "number"
          ? r.serapan
          : Number(r.serapan)
        : planning > 0
          ? Math.round((outbound / planning) * 100)
          : 0;
    return [
      idx + 1,
      r.date ? fmt(r.date) : "-",
      r.barang || "-",
      planning,
      outbound,
      `${serapan}%`,
      r.status || "-",
      r.created_by_username || "sistem",
      r.executed_by_username || "-",
    ];
  });
  const ws = XLSX.utils.aoa_to_sheet([...headerRows, ...rows]);
  ws["!merges"] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: 8 } },
    { s: { r: 1, c: 0 }, e: { r: 1, c: 8 } },
    { s: { r: 2, c: 0 }, e: { r: 2, c: 8 } },
  ];
  ws["!cols"] = [
    { wch: 6 },
    { wch: 14 },
    { wch: 28 },
    { wch: 14 },
    { wch: 14 },
    { wch: 12 },
    { wch: 16 },
    { wch: 18 },
    { wch: 18 },
  ];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "ReportAyam");

  const periodePart =
    from && to
      ? `_${from.replace(/-/g, "")}-${to.replace(/-/g, "")}`
      : `_${new Date().toISOString().split("T")[0].replace(/-/g, "")}`;
  saveXlsx(XLSX, wb, `ReportAyam${periodePart}.xlsx`);
}

export default function ReportAyamPage() {
  const [logs, setLogs] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    load();
  }, []);

  const load = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (from) params.set("from", from);
      if (to) params.set("to", to);
      const res = await api().get(`/planning-ayam/report?${params}`);
      const raw = unwrap(res);
      const list = Array.isArray(raw)
        ? raw
        : Array.isArray(raw?.rows)
          ? raw.rows
        : Array.isArray(raw?.data)
          ? raw.data
          : [];
      setLogs(list);
    } catch (e) {
      console.error(e);
      setLogs([]);
    } finally {
      setLoading(false);
    }
  };

  const filtered = logs
    .filter(
      (r: any) =>
        !search ||
        (r.barang || "").toLowerCase().includes(search.toLowerCase()) ||
        (r.date || "").includes(search) ||
        (r.status || "").toLowerCase().includes(search.toLowerCase()),
    )
    .filter((r: any) => !filterStatus || r.status === filterStatus);

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
          <title>Laporan Report Ayam - ${periodeStr}</title>
          <style>
              body { font-family: Arial; padding: 20px; font-size: 10px; }
              table { width: 100%; border-collapse: collapse; margin-top: 15px; }
              th, td { border: 1px solid #333; padding: 6px; text-align: left; }
              th { background: #1f2937; color: #fff; font-size: 10px; }
              .title { font-size: 15px; font-weight: bold; margin-bottom: 4px; }
              .subtitle { font-size: 11px; color: #555; margin-bottom: 12px; border-bottom: 2px solid #000; padding-bottom: 8px; }
          </style>
      </head>
      <body>
          <div class="title">LAPORAN SERAPAN & OPERASIONAL OUTBOUND AYAM</div>
          <div class="subtitle">Periode: ${periodeStr} &nbsp;|&nbsp; Dicetak: ${new Date().toLocaleDateString(
            "id-ID",
            { day: "2-digit", month: "long", year: "numeric" },
          )}</div>
          <table>
              <thead>
                  <tr>
                      <th>No</th>
                      <th>Tanggal</th>
                      <th>Item / Produk Ayam</th>
                      <th>Planning (kg)</th>
                      <th>Outbound (kg)</th>
                      <th>Serapan (%)</th>
                      <th>Status Planning</th>
                  </tr>
              </thead>
              <tbody>
                  ${filtered
                    .map((r: any, idx: number) => {
                      const planning = r.planning || 0;
                      const outbound = r.outbound || 0;
                      const serapan =
                        r.serapan != null
                          ? typeof r.serapan === "number"
                            ? r.serapan
                            : Number(r.serapan)
                          : planning > 0
                            ? Math.round((outbound / planning) * 100)
                            : 0;
                      return `
                          <tr>
                              <td>${idx + 1}</td>
                              <td>${
                                r.date ? fmt(r.date).split(" ")[0] : "-"
                              }</td>
                              <td>${r.barang || "-"}</td>
                              <td>${planning}</td>
                              <td>${outbound}</td>
                              <td><b>${serapan}%</b></td>
                              <td>${r.status || "-"}</td>
                          </tr>
                      `;
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
      {/* Top Toolbar (Responsive) */}
      <Box mb="lg" pb="xs" style={{ borderBottom: "1px solid #f1f5f9" }}>
        <Group justify="space-between" align="center" wrap="wrap" gap="sm">
          <Title
            order={3}
            style={{ color: "#e6921e", fontWeight: 900, letterSpacing: "-0.02em", whiteSpace: "nowrap" }}
          >
            REPORT AYAM
          </Title>

          <Group gap="xs" align="center" wrap="wrap">
            <TextInput
              placeholder="Cari item, status..."
              size="xs"
              radius="md"
              style={{ minWidth: 120, flex: 1 }}
              leftSection={<IconSearch size={14} color="#64748b" />}
              value={search}
              onChange={(e: any) => setSearch(e.target.value)}
            />

            <Select
              size="xs"
              placeholder="Semua Status"
              radius="md"
              data={[
                { value: "", label: "Semua Status" },
                { value: "WAIT", label: "WAIT" },
                { value: "PROGRESS", label: "PROGRESS" },
                { value: "PUBLISH_READY", label: "PUBLISH READY" },
                { value: "DONE", label: "DONE" },
                { value: "CANCEL", label: "CANCEL" },
              ]}
              value={filterStatus}
              onChange={(v) => setFilterStatus(v || "")}
              style={{ width: 115 }}
              visibleFrom="sm"
            />

            <Group gap={4} wrap="nowrap" align="center" visibleFrom="sm">
              <Text size="xs" fw={600} c="dimmed">Dari</Text>
              <TextInput type="date" size="xs" radius="md" value={from} onChange={(e: any) => setFrom(e.target.value)} style={{ width: 115 }} />
            </Group>

            <Group gap={4} wrap="nowrap" align="center" visibleFrom="sm">
              <Text size="xs" fw={600} c="dimmed">Sampai</Text>
              <TextInput type="date" size="xs" radius="md" value={to} onChange={(e: any) => setTo(e.target.value)} style={{ width: 115 }} />
            </Group>

            <Tooltip label="Filter Data">
              <ActionIcon color="blue" variant="filled" size="md" radius="md" onClick={load}>
                <IconFilter size={16} />
              </ActionIcon>
            </Tooltip>

            <Tooltip label="Reset Filter">
              <ActionIcon color="gray" variant="outline" size="md" radius="md" onClick={() => { setSearch(""); setFilterStatus(""); setFrom(""); setTo(""); load(); }}>
                <IconRefresh size={16} />
              </ActionIcon>
            </Tooltip>

            <Tooltip label="Export Excel / CSV">
              <ActionIcon color="teal" variant="filled" size="md" radius="md" onClick={() => exportExcel(filtered, from, to)}>
                <IconFileSpreadsheet size={16} />
              </ActionIcon>
            </Tooltip>

            <Tooltip label="Print / Export PDF">
              <ActionIcon color="red" variant="filled" size="md" radius="md" onClick={handlePrint}>
                <IconFileTypePdf size={16} />
              </ActionIcon>
            </Tooltip>
          </Group>
        </Group>
      </Box>

      {loading ? (
        <Loader color="orange" />
      ) : (
        <Table.ScrollContainer minWidth={800}>
          <Table
            withColumnBorders
            style={{ fontSize: 11, border: "1px solid #dee2e6" }}
          >
          <Table.Thead style={{ background: "#fff0f6", borderBottom: "2px solid #fcc2d7" }}>
            <Table.Tr>
              <Table.Th
                style={{ color: "#c2255c", fontSize: 11, textAlign: "center" }}
              >
                No
              </Table.Th>
              <Table.Th
                style={{ color: "#c2255c", fontSize: 11, textAlign: "center" }}
              >
                Tanggal
              </Table.Th>
              <Table.Th style={{ color: "#c2255c", fontSize: 11 }}>
                Item / Produk Ayam
              </Table.Th>
              <Table.Th
                style={{ color: "#c2255c", fontSize: 11, textAlign: "right" }}
              >
                Planning (kg)
              </Table.Th>
              <Table.Th
                style={{ color: "#c2255c", fontSize: 11, textAlign: "right" }}
              >
                Outbound (kg)
              </Table.Th>
              <Table.Th
                style={{ color: "#c2255c", fontSize: 11, textAlign: "center" }}
              >
                Serapan (%)
              </Table.Th>
              <Table.Th
                style={{ color: "#c2255c", fontSize: 11, textAlign: "center" }}
              >
                Status Planning
              </Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {filtered.length === 0 ? (
              <Table.Tr>
                <Table.Td colSpan={7} ta="center" c="dimmed">
                  Tidak ada log/data serapan ayam ditemukan
                </Table.Td>
              </Table.Tr>
            ) : (
              filtered.map((r: any, idx: number) => {
                const planning = r.planning || 0;
                const outbound = r.outbound || 0;
                const serapan =
                  r.serapan != null
                    ? typeof r.serapan === "number"
                      ? r.serapan
                      : Number(r.serapan)
                    : planning > 0
                      ? Math.round((outbound / planning) * 100)
                      : 0;
                return (
                  <Table.Tr key={r.id || idx}>
                    <Table.Td ta="center">{idx + 1}</Table.Td>
                    <Table.Td ta="center">
                      {r.date ? fmt(r.date).split(" ")[0] : "-"}
                    </Table.Td>
                    <Table.Td fw={700}>{r.barang || "-"}</Table.Td>
                    <Table.Td ta="right">{planning} kg</Table.Td>
                    <Table.Td ta="right" fw={700} c="blue">
                      {outbound} kg
                    </Table.Td>
                    <Table.Td ta="center" fw={800} c="teal">
                      {serapan}%
                    </Table.Td>
                    <Table.Td ta="center">
                      <Badge
                        size="xs"
                        color={
                          r.status === "DONE"
                            ? "green"
                            : r.status === "PROGRESS"
                              ? "blue"
                              : "gray"
                        }
                      >
                        {r.status || "-"}
                      </Badge>
                      <Text size="10px" c="dimmed">Dibuat {r.created_by_username || "sistem"} · {fmt(r.created_at)}</Text>
                      {r.executed_at && <Text size="10px" c="dimmed">Eksekusi {r.executed_by_username || "sistem"} · {fmt(r.executed_at)}</Text>}
                    </Table.Td>
                  </Table.Tr>
                );
              })
            )}
          </Table.Tbody>
        </Table>
        </Table.ScrollContainer>
      )}
    </Box>
  );
}
