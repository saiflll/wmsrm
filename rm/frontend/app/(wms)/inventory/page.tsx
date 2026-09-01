// @ts-nocheck
"use client";
import React, { useState, useEffect, useRef } from "react";
import {
  Box,
  Group,
  Title,
  Text,
  Table,
  Badge,
  Loader,
  TextInput,
  Paper,
  ScrollArea,
  Alert,
  ActionIcon,
  Tooltip,
  SegmentedControl,
} from "@mantine/core";
import {
  IconFileTypePdf,
  IconFileSpreadsheet,
  IconAlertCircle,
  IconSearch,
  IconFilter,
  IconRefresh,
  IconDroplet,
  IconSun,
} from "@tabler/icons-react";
import { api, unwrap, fmt, saveXlsx } from "../lib/api";
import Pagination from "../components/Pagination";
import { notifications } from "@mantine/notifications";
import * as XLSX from "xlsx";

export default function InventoryPage() {
  const [side, setSide] = useState(true);
  const [data, setData] = useState<any[]>([]);
  const [alerts, setAlerts] = useState<{ expired: any[]; nearExpired: any[] }>({
    expired: [],
    nearExpired: [],
  });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [page, setPage] = useState(1);
  const [limit] = useState(50);
  const hasLoadedRef = useRef(false);

  useEffect(() => {
    load();
    loadAlerts();
  }, [side]);

  const loadAlerts = async () => {
    try {
      const res = await api().get("/inventory/expired-alerts");
      const raw = unwrap(res) || {};
      setAlerts({
        expired: Array.isArray(raw.expired) ? raw.expired : [],
        nearExpired: Array.isArray(raw.nearExpired)
          ? raw.nearExpired
          : Array.isArray(raw.near_expired)
            ? raw.near_expired
            : [],
      });
    } catch (e) {
      console.error(e);
      setAlerts({ expired: [], nearExpired: [] });
    }
  };

  const load = async () => {
    const showLoading = !hasLoadedRef.current;
    if (showLoading) setLoading(true);
    try {
      const res = await api().get(`/inventory/matrix?side=${side}`);
      const raw = unwrap(res);
      setData(Array.isArray(raw) ? raw : Array.isArray(raw?.data) ? raw.data : []);
      hasLoadedRef.current = true;
    } catch (e) {
      console.error(e);
      if (!hasLoadedRef.current) setData([]);
    } finally {
      if (showLoading) setLoading(false);
    }
  };

  const handleReset = () => {
    setSearch("");
    setFromDate("");
    setToDate("");
    load();
  };

  const allDates = [
    ...new Set(data.flatMap((d: any) => Object.keys(d.daily || {}))),
  ].sort();

  const filtered = search
    ? data.filter((d: any) =>
      d.nama?.toLowerCase().includes(search.toLowerCase()),
    )
    : data;

  const totalItems = filtered.length;
  const totalPages = Math.ceil(totalItems / limit);
  const paginated = filtered.slice((page - 1) * limit, page * limit);

  // Client-side Excel/CSV Export
  const handleExportExcel = () => {
    if (!filtered.length) {
      notifications.show({
        title: "Info",
        message: "Tidak ada data inventory untuk diexport",
        color: "blue",
      });
      return;
    }
    const dateStr = new Date().toLocaleDateString("id-ID", {
      day: "2-digit",
      month: "long",
      year: "numeric",
    });
    const categoryStr = side ? "ITEM DRY" : "ITEM WET";

    const headerRows = [
      [`LAPORAN MATRIX INVENTORY - ${categoryStr}`],
      [`Tanggal Cetak: ${dateStr}`],
      [],
      [
        "No",
        "Nama Item",
        "Satuan",
        "Total Stok",
        ...allDates.flatMap((dt) => [
          `${dt} Shift 1 In`,
          `${dt} Shift 1 Out`,
          `${dt} Shift 2 In`,
          `${dt} Shift 2 Out`,
          `${dt} Shift 3 In`,
          `${dt} Shift 3 Out`,
        ]),
      ],
    ];

    const rows = filtered.map((item: any, i: number) => [
      i + 1,
      item.nama || "",
      item.satuan || "",
      item.saldoAwal || 0,
      ...allDates.flatMap((dt) => [
        item.daily?.[dt]?.["1"]?.in || 0,
        item.daily?.[dt]?.["1"]?.out || 0,
        item.daily?.[dt]?.["2"]?.in || 0,
        item.daily?.[dt]?.["2"]?.out || 0,
        item.daily?.[dt]?.["3"]?.in || 0,
        item.daily?.[dt]?.["3"]?.out || 0,
      ]),
    ]);

    const ws = XLSX.utils.aoa_to_sheet([...headerRows, ...rows]);
    ws["!merges"] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 5 } }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Inventory Matrix");

    saveXlsx(
      XLSX,
      wb,
      `InventoryMatrix_${categoryStr.replace(/\s+/g, "_")}_${new Date().toISOString().split("T")[0]
      }.xlsx`,
    );

    notifications.show({
      title: "Export Berhasil",
      message: `${filtered.length} data inventory diexport ke Excel`,
      color: "green",
    });
  };

  // Client-side PDF Print Export
  const handleExportPdf = () => {
    if (!filtered.length) {
      notifications.show({
        title: "Info",
        message: "Tidak ada data inventory untuk diprint",
        color: "blue",
      });
      return;
    }
    const categoryStr = side ? "ITEM DRY" : "ITEM WET";
    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(`
      <html>
      <head>
          <title>Inventory Matrix - ${categoryStr}</title>
          <style>
              body { font-family: Arial; padding: 20px; font-size: 10px; }
              table { width: 100%; border-collapse: collapse; margin-top: 15px; }
              th, td { border: 1px solid #333; padding: 4px; text-align: left; }
              th { background: #111827; color: #fff; font-size: 9px; }
              .header { font-size: 14px; font-weight: bold; margin-bottom: 4px; color: #059669; }
              .info { font-size: 10px; color: #555; margin-bottom: 10px; }
          </style>
      </head>
      <body>
          <div class="header">LAPORAN MATRIX INVENTORY (${categoryStr})</div>
          <div class="info">Dicetak: ${new Date().toLocaleString()} &nbsp;|&nbsp; Total Item: ${filtered.length
      }</div>
          <table>
              <thead>
                  <tr>
                      <th>No</th>
                      <th>Nama Item</th>
                      <th>Satuan</th>
                      <th>Total Stok</th>
                      ${allDates
        .map(
          (d) => `<th colspan="3" style="text-align:center">${d}</th>`,
        )
        .join("")}
                  </tr>
              </thead>
              <tbody>
                  ${filtered
        .map(
          (item: any, idx: number) => `
                      <tr>
                          <td style="text-align:center">${idx + 1}</td>
                          <td><b>${item.nama}</b></td>
                          <td style="text-align:center">${item.satuan}</td>
                          <td style="text-align:right"><b>${item.saldoAwal}</b></td>
                          ${allDates
              .map((dt) => {
                const inQty =
                  (item.daily?.[dt]?.["1"]?.in || 0) +
                  (item.daily?.[dt]?.["2"]?.in || 0) +
                  (item.daily?.[dt]?.["3"]?.in || 0);
                const outQty =
                  (item.daily?.[dt]?.["1"]?.out || 0) +
                  (item.daily?.[dt]?.["2"]?.out || 0) +
                  (item.daily?.[dt]?.["3"]?.out || 0);
                return `
                              <td style="text-align:right;color:#059669">In: ${inQty}</td>
                              <td style="text-align:right;color:#dc2626">Out: ${outQty}</td>
                              <td style="text-align:right"><b>${inQty - outQty}</b></td>
                            `;
              })
              .join("")}
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
      <Group justify="space-between" align="center" mb="lg" wrap="nowrap" gap="sm" pb="xs" style={{ borderBottom: "1px solid #f1f5f9" }}>
        {/* Left Side: Title & Segmented Control */}
        <Group gap="md" align="center" style={{ background: '#fff', borderLeft: '4px solid #07f78fff', padding: '10px 16px', borderRadius: 4, boxShadow: '0 1px 3px rgba(0,0,0,.05)' }}>
          <Title order={3} style={{ color: "#059669", fontWeight: 900, letterSpacing: "-0.02em", whiteSpace: "nowrap" }}>
            INVENTORY DATA
          </Title>

          <SegmentedControl
            value={side ? "dry" : "wet"}
            onChange={(val) => setSide(val === "dry")}
            data={[
              {
                label: (
                  <Group gap={6} wrap="nowrap">
                    <IconDroplet size={14} color="#0ea5e9" />
                    <Text size="xs" fw={700}>
                      ITEM WET
                    </Text>
                  </Group>
                ),
                value: "wet",
              },
              {
                label: (
                  <Group gap={6} wrap="nowrap">
                    <IconSun size={14} color="#eab308" />
                    <Text size="xs" fw={700}>
                      ITEM DRY
                    </Text>
                  </Group>
                ),
                value: "dry",
              },
            ]}
            size="xs"
            radius="md"
            bg="#f8f9fa"
          />
        </Group>

        {/* Right Side: Search, Date Range & Minimalist Icon Actions */}
        <Group gap="xs" align="center" wrap="nowrap">
          <TextInput
            placeholder="Cari item..."
            size="xs"
            radius="md"
            style={{ width: 140 }}
            leftSection={<IconSearch size={14} color="#64748b" />}
            value={search}
            onChange={(e: any) => setSearch(e.target.value)}
          />

          <Group gap={4} wrap="nowrap" align="center">
            <Text size="xs" fw={600} c="dimmed">
              Dari
            </Text>
            <TextInput
              type="date"
              size="xs"
              radius="md"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
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
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
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
              onClick={handleReset}
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
              onClick={handleExportExcel}
            >
              <IconFileSpreadsheet size={16} />
            </ActionIcon>
          </Tooltip>

          <Tooltip label="Export / Print PDF">
            <ActionIcon
              color="red"
              variant="filled"
              size="md"
              radius="md"
              onClick={handleExportPdf}
            >
              <IconFileTypePdf size={16} />
            </ActionIcon>
          </Tooltip>
        </Group>
      </Group>

      {alerts.expired.length > 0 && (
        <Alert
          icon={<IconAlertCircle size={16} />}
          title="Stok Expired"
          color="red"
          mb="md"
        >
          Ada {alerts.expired.length} batch barang yang sudah kadaluarsa. Harap
          periksa gudang/rak terkait.
        </Alert>
      )}

      {alerts.nearExpired.length > 0 && (
        <Alert
          icon={<IconAlertCircle size={16} />}
          title="Stok Hampir Expired"
          color="orange"
          mb="md"
        >
          Ada {alerts.nearExpired.length} batch barang yang akan kadaluarsa
          dalam 30 hari.
        </Alert>
      )}

      {loading ? (
        <Loader />
      ) : (
        <ScrollArea type="always" offsetScrollbars>
          <Box style={{ minWidth: 900, paddingBottom: 20 }}>
            <Table
              withTableBorder
              withColumnBorders
              style={{ fontSize: 11 }}
            >
              <Table.Thead style={{ background: "#fff" }}>
                <Table.Tr>
                  <Table.Th
                    rowSpan={2}
                    style={{
                      position: "sticky",
                      left: 0,
                      background: "#fff",
                      zIndex: 2,
                      borderBottom: "2px solid #10b981",
                      minWidth: 200,
                      verticalAlign: "middle",
                      textAlign: "center",
                    }}
                  >
                    Nama Item
                  </Table.Th>
                  <Table.Th
                    rowSpan={2}
                    style={{
                      background: "#10b981",
                      color: "#fff",
                      borderBottom: "2px solid #059669",
                      textAlign: "center",
                      verticalAlign: "middle",
                    }}
                  >
                    SATUAN
                  </Table.Th>
                  <Table.Th
                    rowSpan={2}
                    style={{ background: "#fff", borderBottom: "2px solid #10b981" }}
                  ></Table.Th>
                  <Table.Th
                    rowSpan={2}
                    style={{
                      background: "#fff",
                      borderBottom: "2px solid #10b981",
                      textAlign: "center",
                      verticalAlign: "middle",
                      whiteSpace: "nowrap",
                    }}
                  >
                    TOTAL STOK
                  </Table.Th>
                  {allDates.map((dt: string) => (
                    <Table.Th
                      key={dt}
                      colSpan={3}
                      style={{
                        background: "#fff",
                        textAlign: "center",
                        borderLeft: "2px solid #555",
                        borderBottom: "1px solid #ddd",
                        fontSize: 12,
                      }}
                    >
                      {fmt(dt).split(" ")[0]}
                    </Table.Th>
                  ))}
                </Table.Tr>
                {allDates.length > 0 && (
                  <Table.Tr>
                    {allDates.map((dt: string) => (
                      <React.Fragment key={dt}>
                        <Table.Th
                          style={{
                            textAlign: "center",
                            background: "#fff",
                            borderLeft: "2px solid #555",
                          }}
                        >
                          1
                        </Table.Th>
                        <Table.Th
                          style={{
                            textAlign: "center",
                            background: "#fff",
                            borderLeft: "1px solid #ddd",
                          }}
                        >
                          2
                        </Table.Th>
                        <Table.Th
                          style={{
                            textAlign: "center",
                            background: "#fff",
                            borderLeft: "1px solid #ddd",
                          }}
                        >
                          3
                        </Table.Th>
                      </React.Fragment>
                    ))}
                  </Table.Tr>
                )}
              </Table.Thead>
              <Table.Tbody>
                {paginated.length === 0 ? (
                  <Table.Tr>
                    <Table.Td colSpan={50} ta="center" c="dimmed">
                      Tidak ada data
                    </Table.Td>
                  </Table.Tr>
                ) : (
                  paginated.map((item: any) => {
                    let totalInInView = 0;
                    let totalOutInView = 0;
                    filtered.forEach((it) => {
                      if (it.id === item.id) {
                        Object.values(it.daily || {}).forEach((day: any) => {
                          Object.values(day).forEach((sh: any) => {
                            totalInInView += sh.in || 0;
                            totalOutInView += sh.out || 0;
                          });
                        });
                      }
                    });

                    let runningStock =
                      (item.saldoAwal || 0) - totalInInView + totalOutInView;

                    const tdIn: any[] = [];
                    const tdOut: any[] = [];
                    const tdStock: any[] = [];

                    allDates.forEach((dt) => {
                      ["1", "2", "3"].forEach((sh, shIdx) => {
                        const inQty = item.daily?.[dt]?.[sh]?.in || 0;
                        const outQty = item.daily?.[dt]?.[sh]?.out || 0;
                        runningStock = runningStock + inQty - outQty;

                        const cellStyle = {
                          borderLeft: shIdx === 0 ? "2px solid #555" : "1px solid #ddd",
                        };
                        tdIn.push(
                          <Table.Td
                            key={`in-${dt}-${sh}`}
                            ta="right"
                            bg="#fff"
                            style={cellStyle}
                          >
                            {inQty || 0}
                          </Table.Td>,
                        );
                        tdOut.push(
                          <Table.Td
                            key={`out-${dt}-${sh}`}
                            ta="right"
                            bg="#fff"
                            style={cellStyle}
                          >
                            {outQty || 0}
                          </Table.Td>,
                        );
                        tdStock.push(
                          <Table.Td
                            key={`stk-${dt}-${sh}`}
                            ta="right"
                            bg="#fef08a"
                            fw={700}
                            c={runningStock < 0 ? "red" : "inherit"}
                            style={cellStyle}
                          >
                            {runningStock}
                          </Table.Td>,
                        );
                      });
                    });

                    return (
                      <React.Fragment key={item.id}>
                        <Table.Tr>
                          <Table.Td
                            rowSpan={3}
                            style={{
                              position: "sticky",
                              left: 0,
                              background: "#fff",
                              zIndex: 1,
                              borderRight: "1px solid #ddd",
                              fontWeight: 600,
                              verticalAlign: "top",
                              paddingTop: 8,
                            }}
                          >
                            {item.nama}
                          </Table.Td>
                          <Table.Td
                            rowSpan={3}
                            align="center"
                            style={{ verticalAlign: "top", paddingTop: 8 }}
                          >
                            {item.satuan}
                          </Table.Td>
                          <Table.Td style={{ background: "#f8f9fa" }}>in</Table.Td>
                          <Table.Td
                            rowSpan={3}
                            ta="right"
                            bg="#fff"
                            fw={700}
                            style={{ verticalAlign: "top", paddingTop: 8 }}
                          >
                            {item.saldoAwal}
                          </Table.Td>
                          {tdIn}
                        </Table.Tr>
                        <Table.Tr>
                          <Table.Td style={{ background: "#f8f9fa" }}>out</Table.Td>
                          {tdOut}
                        </Table.Tr>
                        <Table.Tr>
                          <Table.Td fw={700} style={{ background: "#f8f9fa" }}>
                            stock
                          </Table.Td>
                          {tdStock}
                        </Table.Tr>
                      </React.Fragment>
                    );
                  })
                )}
              </Table.Tbody>
            </Table>
          </Box>
        </ScrollArea>
      )}

      {!loading && (
        <Pagination
          page={page}
          totalPages={totalPages}
          total={totalItems}
          onPageChange={setPage}
        />
      )}
    </Box>
  );
}
