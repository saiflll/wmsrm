"use client";
// @ts-nocheck
import React, { useState, useEffect } from "react";
import { Box, Group, Button, Title, Text, Badge, Paper, Stack, TextInput, Select, Loader, NumberInput, Divider, Autocomplete, Tooltip, ActionIcon, Card, Grid, ThemeIcon } from "@mantine/core";
import { Table } from '../components/Table';
import {
  IconTrash,
  IconCheck,
  IconFileTypePdf,
  IconSend,
  IconClipboardCheck,
  IconHistory,
  IconSearch,
  IconX,
  IconBuildingWarehouse,
} from "@tabler/icons-react";
import { notifications } from "@mantine/notifications";
import {
  api,
  unwrap,
  fmt,
} from "../lib/api";

const renderColorfulOption: any = ({ option }: any) => {
  if (option.isEmpty) {
    return (
      <Group gap={6} wrap="nowrap">
        <Badge color="green" variant="filled" size="xs" style={{ textTransform: "none" }}>
          {option.locName}
        </Badge>
        <Text size="xs" c="dimmed">
          KOSONG
        </Text>
      </Group>
    );
  }
  if (option.locName) {
    return (
      <Group gap={6} wrap="nowrap">
        <Badge color="green" variant="filled" size="xs" style={{ textTransform: "none" }}>
          {option.locName}
        </Badge>
        {option.itemNames && (
          <Badge
            color="orange"
            variant="light"
            style={{ textTransform: "none", maxWidth: 120 }}
            size="xs"
          >
            {option.itemNames.length > 20
              ? option.itemNames.slice(0, 20) + "..."
              : option.itemNames}
          </Badge>
        )}
        {option.qtyStr && (
          <Text size="xs" c="blue" fw={600}>
            {option.qtyStr}
          </Text>
        )}
      </Group>
    );
  }
  return <Text size="sm">{option.label}</Text>;
};

export default function OutboundPage() {
  const [type, setType] = useState("wet");
  const [stocks, setStocks] = useState<any[]>([]);
  const [barangs, setBarangs] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [shifts, setShifts] = useState<any[]>([]);
  const [outboundLogs, setOutboundLogs] = useState<any[]>([]);
  const [inboundLogs, setInboundLogs] = useState<any[]>([]);
  const [pendingPickings, setPendingPickings] = useState<any[]>([]);
  const [filterRak, setFilterRak] = useState("");
  const [loading, setLoading] = useState(true);

  // Sorting states
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  // Form for Direct Outbound
  const [form, setForm] = useState({
    no_ref: "",
    stock_id: "",
    qty: 1,
    tujuan: "",
    shift_id: "",
  });

  const [selectedBarangId, setSelectedBarangId] = useState("");

  useEffect(() => {
    load();
  }, [type]);

  const load = async () => {
    setLoading(true);
    try {
      const side = type === "dry";
      const [s, ol, il, b, c, sh, pp] = await Promise.all([
        api().get(`/inventory/stock?side=${side}`),
        api().get("/inventory/logs/outbound"),
        api().get("/inventory/logs/inbound"),
        api().get("/barang"),
        api().get("/customers"),
        api().get("/shifts"),
        api().get("/inventory/picking/pending"),
      ]);
      setStocks(unwrap(s));
      setOutboundLogs(
        unwrap(ol).filter((l: any) =>
          type === "wet" ? !l.barang?.side : l.barang?.side,
        ),
      );
      setInboundLogs(unwrap(il));
      setBarangs(unwrap(b));
      setCustomers(unwrap(c));
      setShifts(unwrap(sh));
      setPendingPickings(unwrap(pp));
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  const confirmCheckout = async (noRef: string) => {
    try {
      await api().post("/inventory/outbound/confirm", { no_ref: noRef });
      notifications.show({
        title: "Sukses",
        message: `Planning Outbound ${noRef} berhasil dicheckout dari gudang`,
        color: "green",
      });
      load();
    } catch (e: any) {
      notifications.show({
        title: "Error",
        message: unwrap(e.response)?.message || "Gagal checkout",
        color: "red",
      });
    }
  };

  const cancelPicking = async (noRef: string) => {
    if (!confirm(`Apakah Anda yakin ingin membatalkan Planning Outbound ${noRef}? Stok reserved akan dibebaskan kembali.`)) return;
    try {
      await api().delete(`/inventory/picking/${encodeURIComponent(noRef)}`);
      notifications.show({
        title: "Sukses",
        message: `Planning Outbound ${noRef} berhasil dibatalkan`,
        color: "green",
      });
      load();
    } catch (e: any) {
      notifications.show({
        title: "Error",
        message: unwrap(e.response)?.message || "Gagal membatalkan",
        color: "red",
      });
    }
  };

  const directOutboundSubmit = async () => {
    if (!form.stock_id || !form.qty || !form.tujuan) {
      return notifications.show({
        title: "Error",
        message: "Pilih stock, qty, dan tujuan pengeluaran",
        color: "red",
      });
    }

    const selSt = stocks.find((s) => s.id === +form.stock_id);
    if (!selSt) return;

    const finalNoRef = form.no_ref || `OUT-${String(Date.now()).slice(-6)}`;

    try {
      await api().post("/inventory/outbound", {
        items: [
          {
            no_ref: finalNoRef,
            barang_id: selSt.barang?.id,
            gudang_id: selSt.gudang?.id,
            qty: +form.qty,
            satuan: selSt.satuan,
            tujuan: form.tujuan,
            shift_id: form.shift_id ? +form.shift_id : undefined,
            batch_no: selSt.batch_no,
          },
        ],
      });

      notifications.show({
        title: "Sukses",
        message: `Barang berhasil dikeluarkan (Ref: ${finalNoRef})`,
        color: "green",
      });

      setForm({ no_ref: "", stock_id: "", qty: 1, tujuan: "", shift_id: "" });
      setSelectedBarangId("");
      load();
    } catch (e: any) {
      notifications.show({
        title: "Error",
        message: unwrap(e.response)?.message || "Failed",
        color: "red",
      });
    }
  };

  const deleteOutboundLog = async (logId: string) => {
    if (!confirm("Apakah Anda yakin ingin menghapus/merevert transaksi outbound ini? Stok akan dikembalikan ke rak asal.")) return;
    try {
      await api().delete(`/inventory/outbound/${encodeURIComponent(logId)}`);
      notifications.show({
        title: "Sukses",
        message: "Transaksi outbound berhasil direvert",
        color: "green",
      });
      load();
    } catch (e: any) {
      notifications.show({
        title: "Error",
        message: unwrap(e.response)?.message || "Gagal revert",
        color: "red",
      });
    }
  };

  const printPDF = (transId: string, items: any[]) => {
    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(`
        <html>
        <head>
            <title>Outbound Document - ${transId}</title>
            <style>
                body { font-family: Arial; padding: 20px; font-size: 10px; }
                table { width: 100%; border-collapse: collapse; margin-top: 12px; }
                th, td { border: 1px solid #333; padding: 5px; text-align: left; }
                th { background: #1f2937; color: #fff; font-size: 10px; }
                .title { font-size: 14px; font-weight: bold; margin-bottom: 4px; }
                .meta { display: flex; justify-content: space-between; font-size: 10px; margin-bottom: 10px; border-bottom: 2px solid #000; padding-bottom: 8px; color: #333; }
            </style>
        </head>
        <body>
            <div class="title">OUTBOUND DELIVERED DOCUMENT</div>
            <div class="meta">
                <div>
                    <b>ID Transaksi / Ref:</b> ${transId}<br/>
                    <b>Tujuan:</b> ${items[0]?.tujuan || '-'}<br/>
                    <b>Shift:</b> ${items[0]?.shift?.name || '-'}
                </div>
                <div style="text-align: right">
                    <b>Tanggal Keluar:</b> ${items[0]?.created_at ? fmt(items[0].created_at) : '-'}<br/>
                    <b>Total Item:</b> ${items.length} baris
                </div>
            </div>
            <table>
                <thead>
                    <tr>
                        <th>No.</th>
                        <th>Item / Produk</th>
                        <th>Batch No</th>
                        <th>Rak Asal</th>
                        <th>Qty Keluar</th>
                        <th>Satuan</th>
                    </tr>
                </thead>
                <tbody>
                    ${items.map((r: any, i: number) => `
                        <tr>
                            <td>${i + 1}</td>
                            <td><b>${r.barang?.nama || '-'}</b></td>
                            <td>${r.batch_no || '-'}</td>
                            <td>${r.gudang?.name || '-'}</td>
                            <td>${r.qty}</td>
                            <td>${r.satuan || ''}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
            <div style="margin-top: 40px; display: flex; justify-content: space-between; font-size: 10px;">
                <div>Checker / Pengambil:<br/><br/>______________________________</div>
                <div>Supervisor / Approved:<br/><br/>______________________________</div>
            </div>
            <script>window.onload=()=>{window.print();window.close()}</script>
        </body>
        </html>
    `);
    win.document.close();
  };

  // Combine Inbound and Outbound reference numbers for suggestions
  const refOpts = Array.from(
    new Set([
      ...outboundLogs.map((l: any) => l.no_ref),
      ...inboundLogs.map((l: any) => l.no_po),
    ].filter(Boolean)),
  );

  const barangOpts = barangs
    .filter((b: any) => (type === "wet" ? !b.side : b.side))
    .map((b: any) => ({
      value: String(b.id),
      label: b.sku ? `${b.sku} - ${b.nama}` : b.nama,
    }));

  const customerNames = customers.map((c: any) => c.nama || c.name).filter(Boolean);
  const customerOpts = [...new Set(["Prod", "Premix", "PDI", ...customerNames])];

  const shiftOpts = shifts.map((s: any) => ({
    value: String(s.id),
    label: s.name,
  }));

  // Stocks for direct outbound
  const stockOpts = stocks
    .filter(
      (s: any) =>
        !selectedBarangId || String(s.barang?.id) === String(selectedBarangId),
    )
    .map((s: any) => {
      const available = s.qty - (s.reserved_qty || 0);
      return {
        value: String(s.id),
        label: `[${s.gudang?.zone}] ${s.gudang?.name} — ${s.barang?.nama} (Tersedia: ${available} ${s.satuan || ""}, Reserved: ${s.reserved_qty || 0})`,
        locName: s.gudang?.name || "-",
        itemNames: s.barang?.nama || "Unknown",
        qtyStr: `Tersedia: ${available} ${s.satuan || ""}`,
        disabled: available <= 0,
      };
    });

  const selStockObj = stocks.find((s) => s.id === +form.stock_id);
  const maxQty = selStockObj ? selStockObj.qty - (selStockObj.reserved_qty || 0) : 1;

  // Filter pending picking plans by side (wet/dry)
  const filteredPending = pendingPickings.filter((p: any) => {
    if (!p.items || !p.items.length) return false;
    const isWetItem = !p.items[0]?.barang?.side;
    return type === "wet" ? isWetItem : !isWetItem;
  });

  // Sorting logic
  const handleSort = (key: string) => {
    if (sortKey === key) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  const sortIcon = (key: string) => {
    if (sortKey !== key) return " ↕";
    return sortDir === "asc" ? " ▲" : " ▼";
  };

  // Sort logs array
  const sortedLogs = [...outboundLogs].sort((a, b) => {
    if (!sortKey) return 0;
    
    let aVal = a[sortKey];
    let bVal = b[sortKey];

    if (sortKey === 'barang.nama') {
      aVal = a.barang?.nama || '';
      bVal = b.barang?.nama || '';
    } else if (sortKey === 'gudang.name') {
      aVal = a.gudang?.name || '';
      bVal = b.gudang?.name || '';
    } else if (sortKey === 'shift.name') {
      aVal = a.shift?.name || '';
      bVal = b.shift?.name || '';
    }

    if (aVal == null) aVal = "";
    if (bVal == null) bVal = "";

    if (typeof aVal === 'number' && typeof bVal === 'number') {
      return sortDir === 'asc' ? aVal - bVal : bVal - aVal;
    }
    const cmp = String(aVal).localeCompare(String(bVal), undefined, { numeric: true });
    return sortDir === 'asc' ? cmp : -cmp;
  });

  const filteredLogs = sortedLogs.filter(
    (l: any) =>
      !filterRak ||
      l.gudang?.name?.toLowerCase().includes(filterRak.toLowerCase()) ||
      l.barang?.nama?.toLowerCase().includes(filterRak.toLowerCase()) ||
      l.no_ref?.toLowerCase().includes(filterRak.toLowerCase()) ||
      l.tujuan?.toLowerCase().includes(filterRak.toLowerCase()),
  );

  return (
    <Box>
      {/* Top Banner Header */}
      <Box
        style={{
          background: "#fff",
          borderLeft: "4px solid #f03e3e",
          padding: "14px 20px",
          marginBottom: 16,
          boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
        }}
      >
        <Group justify="space-between">
          <Title order={4} style={{ color: "#111827", fontWeight: 800, display: "flex", alignItems: "center", gap: 8 }}>
            <IconBuildingWarehouse size={20} style={{ color: "#f03e3e" }} />
            BARANG KELUAR (OUTBOUND)
          </Title>
          <Group gap="xs">
            <Button
              size="xs"
              color={type === "wet" ? "yellow" : "gray"}
              variant={type === "wet" ? "filled" : "outline"}
              onClick={() => {
                setType("wet");
                setSelectedBarangId("");
                setForm({ no_ref: "", stock_id: "", qty: 1, tujuan: "", shift_id: "" });
              }}
              style={{ fontWeight: 700 }}
            >
              ITEM WET
            </Button>
            <Button
              size="xs"
              color={type === "dry" ? "blue" : "gray"}
              variant={type === "dry" ? "filled" : "outline"}
              onClick={() => {
                setType("dry");
                setSelectedBarangId("");
                setForm({ no_ref: "", stock_id: "", qty: 1, tujuan: "", shift_id: "" });
              }}
              style={{ fontWeight: 700 }}
            >
              ITEM DRY
            </Button>
          </Group>
        </Group>
      </Box>

      {/* Main content in responsive Grid */}
      <Box p="md">
        <Grid gutter="md">
          {/* Form Outbound Langsung */}
          <Grid.Col span={{ base: 12, md: 4, lg: 3 }}>
            <Paper withBorder p="md" radius="md" style={{ background: "#fff" }}>
              <Group gap="xs" mb="sm" style={{ borderBottom: "1px solid #f1f5f9", paddingBottom: 4 }}>
                <ThemeIcon color="red" variant="light" size="sm">
                  <IconSend size={16} />
                </ThemeIcon>
                <Text fw={800} size="sm" c="red">OUTBOUND LANGSUNG</Text>
              </Group>
              
              <Stack gap="xs">
                <Autocomplete
                  label="No. Ref / Transaksi"
                  size="xs"
                  data={refOpts}
                  value={form.no_ref}
                  onChange={(v) => setForm((p) => ({ ...p, no_ref: v }))}
                  placeholder="Auto jika kosong"
                />

                <Select
                  label="Filter Produk"
                  size="xs"
                  searchable
                  clearable
                  data={barangOpts}
                  value={selectedBarangId}
                  onChange={(v) => {
                    setSelectedBarangId(v || "");
                    setForm((p) => ({ ...p, stock_id: "", qty: 1 }));
                  }}
                  placeholder="Cari master produk"
                />

                <Select
                  label="Pilih Rak Asal (Stock)"
                  size="xs"
                  searchable
                  data={stockOpts}
                  value={form.stock_id}
                  onChange={(v) => {
                    const sObj = stocks.find((s) => String(s.id) === String(v));
                    const avail = sObj ? sObj.qty - (sObj.reserved_qty || 0) : 1;
                    setForm((p) => ({
                      ...p,
                      stock_id: v || "",
                      qty: avail > 0 ? 1 : 0,
                    }));
                  }}
                  placeholder="Pilih lokasi penyimpanan"
                  renderOption={renderColorfulOption}
                />

                {selStockObj && (
                  <Box style={{ background: "#f8f9fa", borderRadius: 6, padding: "6px 8px", fontSize: 11 }}>
                    <Text size="xs" c="dimmed">Item: <b>{selStockObj.barang?.nama}</b></Text>
                    <Text size="xs" c="dimmed">Batch: <b>{selStockObj.batch_no || "-"}</b></Text>
                    <Text size="xs" c="dimmed">Stok Fisik: <b>{selStockObj.qty} {selStockObj.satuan}</b></Text>
                    <Text size="xs" c="orange" fw={600}>Stok Tersedia: <b>{maxQty} {selStockObj.satuan}</b></Text>
                  </Box>
                )}

                <NumberInput
                  label="Qty Keluar"
                  size="xs"
                  value={form.qty}
                  onChange={(v) => setForm((p) => ({ ...p, qty: Number(v) }))}
                  min={1}
                  max={maxQty}
                  disabled={!form.stock_id}
                />

                <Autocomplete
                  label="Tujuan Keluar (Master Customer)"
                  size="xs"
                  data={customerOpts}
                  value={form.tujuan}
                  onChange={(v) => setForm((p) => ({ ...p, tujuan: v }))}
                  placeholder="Tulis tujuan / pilih customer"
                />

                <Autocomplete
                  label="Shift"
                  size="xs"
                  data={shifts.map((s: any) => s.name)}
                  value={shifts.find((s: any) => String(s.id) === form.shift_id)?.name || form.shift_id}
                  onChange={(v) => {
                    const match = shifts.find((s: any) => s.name.toLowerCase() === v.toLowerCase());
                    setForm((p) => ({ ...p, shift_id: match ? String(match.id) : v }));
                  }}
                  placeholder="Pilih shift"
                  
                />

                <Button
                  fullWidth
                  size="xs"
                  color="red"
                  onClick={directOutboundSubmit}
                  style={{ fontWeight: 800, marginTop: 4 }}
                  leftSection={<IconSend size={14} />}
                >
                  PROSES PENGELUARAN
                </Button>
              </Stack>
            </Paper>
          </Grid.Col>

          {/* Pending Pickings list + History Table */}
          <Grid.Col span={{ base: 12, md: 8, lg: 9 }}>
            {/* PENDING PICKING PLANS */}
            <Paper withBorder p="md" mb="md" radius="md" style={{ background: "#fff" }}>
              <Group gap="xs" mb="sm" style={{ borderBottom: "1px solid #f1f5f9", paddingBottom: 4 }}>
                <ThemeIcon color="blue" variant="light" size="sm">
                  <IconClipboardCheck size={16} />
                </ThemeIcon>
                <Text fw={800} size="sm" c="blue">
                  ANTREAN PLANNING OUTBOUND ({filteredPending.length})
                </Text>
              </Group>

              {filteredPending.length === 0 ? (
                <Box p="md" style={{ textAlign: "center", border: "1px dashed #cbd5e1", borderRadius: 8 }}>
                  <Text c="dimmed" size="xs">Tidak ada Planning Outbound pending checkout.</Text>
                </Box>
              ) : (
                <Grid gutter="xs">
                  {filteredPending.map((p: any) => (
                    <Grid.Col key={p.no_ref} span={{ base: 12, md: 6 }}>
                      <Card withBorder p="xs" radius="md" style={{ background: "#f8fafc" }}>
                        <Group justify="space-between" mb={4}>
                          <Box>
                            <Text fw={800} size="xs" c="blue">{p.no_ref}</Text>
                            <Text size="10px" c="dimmed">Tujuan: <b>{p.tujuan}</b> | Shift: <b>{p.shift}</b></Text>
                          </Box>
                          <Group gap={4}>
                            <Button
                              size="xs"
                              color="green"
                              leftSection={<IconCheck size={12} />}
                              onClick={() => confirmCheckout(p.no_ref)}
                              style={{ padding: "0 8px", height: 24, fontSize: 10 }}
                            >
                              Checkout
                            </Button>
                            <ActionIcon
                              size="sm"
                              color="red"
                              variant="light"
                              onClick={() => cancelPicking(p.no_ref)}
                            >
                              <IconX size={12} />
                            </ActionIcon>
                          </Group>
                        </Group>
                        <Divider my={4} />
                        <Table withColumnBorders style={{ fontSize: 9, background: "#fff" }}>
                          <Table.Thead style={{ background: "#f1f5f9" }}>
                            <Table.Tr>
                              <Table.Th style={{ padding: "2px 4px" }}>Item</Table.Th>
                              <Table.Th style={{ padding: "2px 4px" }}>Rak</Table.Th>
                              <Table.Th style={{ padding: "2px 4px" }}>Qty</Table.Th>
                            </Table.Tr>
                          </Table.Thead>
                          <Table.Tbody>
                            {p.items?.map((it: any) => (
                              <Table.Tr key={it.id}>
                                <Table.Td fw={600} style={{ padding: "2px 4px" }}>{it.barang?.nama}</Table.Td>
                                <Table.Td style={{ padding: "2px 4px" }}>{it.gudang?.name}</Table.Td>
                                <Table.Td ta="right" fw={700} style={{ padding: "2px 4px" }}>{it.qty} {it.satuan}</Table.Td>
                              </Table.Tr>
                            ))}
                          </Table.Tbody>
                        </Table>
                      </Card>
                    </Grid.Col>
                  ))}
                </Grid>
              )}
            </Paper>

            {/* OUTBOUND DELIVERED HISTORY */}
            <Paper withBorder p="md" radius="md" style={{ background: "#fff" }}>
              <Group justify="space-between" mb="sm">
                <Group gap="xs">
                  <ThemeIcon color="dark" variant="light" size="sm">
                    <IconHistory size={16} />
                  </ThemeIcon>
                  <Text fw={800} size="sm">RIWAYAT PENGELUARAN TERKIRIM</Text>
                </Group>
                <TextInput
                  placeholder="Cari Ref, Rak, Item..."
                  size="xs"
                  value={filterRak}
                  onChange={(e) => setFilterRak(e.target.value)}
                  style={{ width: 220 }}
                  leftSection={<IconSearch size={12} />}
                />
              </Group>

              {loading ? (
                <Group justify="center" py="md"><Loader size="sm" /></Group>
              ) : (
                <Box style={{ overflowX: "auto" }}>
                  <Table withTableBorder withColumnBorders style={{ fontSize: 11 }}>
                    <Table.Thead style={{ background: "#1a1a1a" }}>
                      <Table.Tr>
                        <Table.Th style={{ color: "#fff", cursor: "pointer" }} onClick={() => handleSort('no_ref')}>
                          ID Ref{sortIcon('no_ref')}
                        </Table.Th>
                        <Table.Th style={{ color: "#fff", cursor: "pointer" }} onClick={() => handleSort('barang.nama')}>
                          Nama Item{sortIcon('barang.nama')}
                        </Table.Th>
                        <Table.Th style={{ color: "#fff", cursor: "pointer" }} onClick={() => handleSort('batch_no')}>
                          Batch No{sortIcon('batch_no')}
                        </Table.Th>
                        <Table.Th style={{ color: "#fff", cursor: "pointer" }} onClick={() => handleSort('gudang.name')}>
                          Rak Asal{sortIcon('gudang.name')}
                        </Table.Th>
                        <Table.Th style={{ color: "#fff", cursor: "pointer" }} onClick={() => handleSort('created_at')}>
                          Tgl Keluar{sortIcon('created_at')}
                        </Table.Th>
                        <Table.Th style={{ color: "#fff", cursor: "pointer" }} onClick={() => handleSort('shift.name')}>
                          Shift{sortIcon('shift.name')}
                        </Table.Th>
                        <Table.Th style={{ color: "#fff", cursor: "pointer" }} onClick={() => handleSort('qty')}>
                          Qty{sortIcon('qty')}
                        </Table.Th>
                        <Table.Th style={{ color: "#fff", cursor: "pointer" }} onClick={() => handleSort('tujuan')}>
                          Tujuan{sortIcon('tujuan')}
                        </Table.Th>
                        <Table.Th style={{ color: "#fff" }}>Aksi</Table.Th>
                      </Table.Tr>
                    </Table.Thead>
                    <Table.Tbody>
                      {filteredLogs.length === 0 ? (
                        <Table.Tr>
                          <Table.Td colSpan={9} ta="center" c="dimmed">
                            Tidak ada riwayat pengeluaran barang.
                          </Table.Td>
                        </Table.Tr>
                      ) : (
                        (() => {
                          const grouped: Record<string, any[]> = {};
                          filteredLogs.forEach((log) => {
                            const ref = log.no_ref || `OUT-${log.id}`;
                            if (!grouped[ref]) grouped[ref] = [];
                            grouped[ref].push(log);
                          });

                          return Object.entries(grouped).map(([ref, items]) =>
                            items.map((r: any, idx: number) => (
                              <Table.Tr key={r.id}>
                                {idx === 0 && (
                                  <Table.Td fw={700} style={{ color: "#e60000" }} rowSpan={items.length}>
                                    {ref}
                                  </Table.Td>
                                )}
                                <Table.Td fw={600}>{r.barang?.nama}</Table.Td>
                                <Table.Td>{r.batch_no || "-"}</Table.Td>
                                <Table.Td>
                                  <Badge size="xs" color="blue" variant="light">
                                    {r.gudang?.name}
                                  </Badge>
                                </Table.Td>
                                <Table.Td>{fmt(r.created_at)}</Table.Td>
                                <Table.Td>{r.shift?.name || "-"}</Table.Td>
                                <Table.Td ta="right" fw={700}>
                                  {r.qty} {r.satuan}
                                </Table.Td>
                                <Table.Td>{r.tujuan || "-"}</Table.Td>
                                {idx === 0 && (
                                  <Table.Td rowSpan={items.length}>
                                    <Group gap={6} wrap="nowrap">
                                      <Button
                                        size="xs"
                                        color="red"
                                        variant="light"
                                        leftSection={<IconFileTypePdf size={14} />}
                                        onClick={() => printPDF(ref, items)}
                                      >
                                        Print
                                      </Button>
                                      <Tooltip label="Batalkan & Kembalikan ke Rak">
                                        <ActionIcon
                                          size="md"
                                          color="red"
                                          variant="light"
                                          onClick={() => deleteOutboundLog(ref)}
                                        >
                                          <IconTrash size={16} />
                                        </ActionIcon>
                                      </Tooltip>
                                    </Group>
                                  </Table.Td>
                                )}
                              </Table.Tr>
                            )),
                          );
                        })()
                      )}
                    </Table.Tbody>
                  </Table>
                </Box>
              )}
            </Paper>
          </Grid.Col>
        </Grid>
      </Box>
    </Box>
  );
}
