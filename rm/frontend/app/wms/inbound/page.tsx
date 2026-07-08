"use client";
// @ts-nocheck
import React, { useState, useEffect, useRef, Suspense } from "react";
import { Box, Group, Button, Title, Text, Badge, Paper, Stack, TextInput, Select, NumberInput, Divider, ActionIcon, Autocomplete, Loader, Grid } from "@mantine/core";
import { Table } from '../components/Table';
import {
  IconPlus,
  IconTrash,
  IconFileTypePdf,
  IconFileSpreadsheet,
  IconEdit,
  IconSend,
  IconChevronDown,
  IconChevronUp,
  IconBuildingWarehouse,
} from "@tabler/icons-react";
import { notifications } from "@mantine/notifications";
import { useSearchParams } from "next/navigation";
import {
  api,
  unwrap,
  fmt,
  statusLabel,
  statusColor,
  saveXlsx,
  parseExcelDate,
} from "../lib/api";
import * as XLSX from "xlsx";

const renderColorfulOption: any = ({ option }: any) => {
  if (option.isEmpty) {
    return (
      <Group gap={6} wrap="nowrap">
        <Badge color="green" variant="filled" style={{ textTransform: "none" }}>
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
        <Badge color="green" variant="filled" style={{ textTransform: "none" }}>
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

function InboundContent() {
  const searchParams = useSearchParams();
  const [type, setType] = useState("wet");
  const [barangs, setBarangs] = useState<any[]>([]);
  const [allGudangs, setAllGudangs] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [shifts, setShifts] = useState<any[]>([]);
  const [stocks, setStocks] = useState<any[]>([]);
  const [drafts, setDrafts] = useState<any[]>(() => {
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem("wms_inbound_drafts");
        if (saved) return JSON.parse(saved);
      } catch (e) {}
    }
    return [];
  });
  const [logs, setLogs] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const barcodeRef = useRef<any>(null);
  const [selectedZone, setSelectedZone] = useState("");

  // Sort states
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  const [form, setForm] = useState<any>({
    no_po: "",
    barang_id: "",
    item_manual: "",
    qty: 1,
    satuan: "",
    batch_no: "",
    expiry_date: "",
    supplier: "",
    shift_id: "",
    tanggal_income: new Date().toISOString().split("T")[0],
    jam_datang: "",
    jam_bongkar: "",
    jam_selesai: "",
    gudang_id: "",
  });

  const loadBarangs = async () => {
    try {
      const r = await api().get("/barang");
      setBarangs(unwrap(r));
    } catch (e) {
      console.error("Load barangs failed:", e);
    }
  };

  const loadGudangsAndStocks = async () => {
    try {
      const [g, s] = await Promise.all([
        api().get("/gudang"),
        api().get("/inventory/stock"),
      ]);
      setAllGudangs(unwrap(g));
      setStocks(unwrap(s));
    } catch (e) {
      console.error("Load gudangs failed:", e);
    }
  };

  useEffect(() => {
    loadBarangs();
    loadGudangsAndStocks();
    api()
      .get("/customers")
      .then((r) => setCustomers(unwrap(r)));
    api()
      .get("/shifts")
      .then((r) => setShifts(unwrap(r)));
    loadLogs();
  }, []);

  // Save drafts to LocalStorage on change (skip initial write, already in sync from lazy init)
  const initialWrite = useRef(true);
  useEffect(() => {
    if (initialWrite.current) {
      initialWrite.current = false;
      return;
    }
    localStorage.setItem("wms_inbound_drafts", JSON.stringify(drafts));
  }, [drafts]);

  // Process search params for prefill (redirected from planning)
  useEffect(() => {
    if (searchParams) {
      const qPo = searchParams.get("no_po");
      const qSup = searchParams.get("supplier");
      if (qPo) f("no_po", qPo);
      if (qSup) f("supplier", qSup);
    }
  }, [searchParams]);

  const loadLogs = () => {
    api()
      .get("/inventory/logs/inbound")
      .then((r) => setLogs(unwrap(r)));
  };

  const f = (k: string, v: any) => setForm((p: any) => ({ ...p, [k]: v }));

  const getGudangs = () => {
    if (!selectedZone) return [];
    return allGudangs.filter(
      (g: any) => g.zone?.toUpperCase() === selectedZone.toUpperCase(),
    );
  };

  const addDraft = () => {
    if (!form.barang_id && !form.item_manual)
      return notifications.show({
        title: "Error",
        message: "Pilih / isi item",
        color: "red",
      });
    if (!selectedZone)
      return notifications.show({
        title: "Error",
        message: "Pilih Zone Gudang",
        color: "red",
      });
    if (form.gudang_id) {
      const stocksInRack = stocks.filter(
        (s: any) => String(s.gudang?.id) === String(form.gudang_id),
      );
      if (stocksInRack.length > 0) {
        if (
          form.barang_id &&
          stocksInRack.some(
            (s: any) =>
              s.barang && String(s.barang.id) !== String(form.barang_id),
          )
        ) {
          return notifications.show({
            title: "Klaim Error",
            message: "Rak ini sudah dialokasikan untuk produk lain!",
            color: "red",
          });
        }
        if (
          !form.barang_id &&
          form.item_manual &&
          stocksInRack.some(
            (s: any) =>
              s.barang || (s.item_name && s.item_name !== form.item_manual),
          )
        ) {
          return notifications.show({
            title: "Klaim Error",
            message: "Rak ini sudah dialokasikan untuk produk lain!",
            color: "red",
          });
        }
      }
    }

    let brgName = form.item_manual || "";
    if (!brgName && form.barang_id) {
      brgName =
        barangs.find((b: any) => String(b.id) === String(form.barang_id))
          ?.nama || "";
    }

    setDrafts((p: any[]) => [
      ...p,
      {
        ...form,
        id: Date.now(),
        _brg: brgName,
        _gdg:
          allGudangs.find((g: any) => String(g.id) === String(form.gudang_id))
            ?.name || "-",
        _zone: selectedZone,
      },
    ]);
    setForm((p: any) => ({
      ...p,
      barang_id: "",
      item_manual: "",
      qty: 1,
      batch_no: "",
      expiry_date: "",
      gudang_id: "",
    }));
    if (barcodeRef.current) barcodeRef.current.focus();
  };

  const editDraft = (idx: number) => {
    const d = drafts[idx];
    setForm({
      no_po: d.no_po,
      barang_id: d.barang_id,
      item_manual: d.item_manual || "",
      qty: d.qty,
      satuan: d.satuan,
      batch_no: d.batch_no,
      expiry_date: d.expiry_date,
      supplier: d.supplier,
      shift_id: d.shift_id,
      tanggal_income: d.tanggal_income,
      jam_datang: d.jam_datang,
      jam_bongkar: d.jam_bongkar,
      jam_selesai: d.jam_selesai,
      gudang_id: d.gudang_id,
    });
    setSelectedZone(d._zone);
    setDrafts((p) => p.filter((_, i) => i !== idx));
  };

  const downloadTemplate = () => {
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([
      [
        "NoPO",
        "Item",
        "Qty",
        "Satuan",
        "Batch",
        "Expired",
        "Supplier",
        "Shift",
        "Zone",
        "Rak",
      ],
      [
        "PO-12345",
        "Ayam Dada Fillet Chilled - Cp",
        100,
        "Kg",
        "LOT-WET-2601",
        "2026-07-15",
        "JAPFA",
        "Shift 1",
        "CS FROZEN",
        "A1.1",
      ],
    ]);
    XLSX.utils.book_append_sheet(wb, ws, "Template");
    saveXlsx(XLSX, wb, "Template_Inbound.xlsx");
  };

  const handleImport = async (file: File | null) => {
    if (!file) return;
    try {
      const data = await file.arrayBuffer();
      const wb = XLSX.read(data, { type: "array", cellDates: true });
      const rows: any[] = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
      let success = 0,
        fail = 0;
      for (const row of rows) {
        try {
          const itemName = String(row.Item || "").trim();
          const brg = barangs.find(
            (b: any) =>
              b.nama?.toLowerCase().trim() === itemName.toLowerCase() ||
              b.sku?.toLowerCase().trim() === itemName.toLowerCase(),
          );
          const shiftStr = String(row.Shift || "").trim();
          const shift = shifts.find(
            (s: any) => s.name?.toLowerCase().trim() === shiftStr.toLowerCase(),
          );
          const rakStr = String(row.Rak || "").trim();
          const gudang = allGudangs.find(
            (g: any) => g.name?.toLowerCase().trim() === rakStr.toLowerCase(),
          );

          if (!brg) {
            console.error(`Item not found in master product: "${itemName}"`);
            fail++;
            continue;
          }
          if (!gudang) {
            console.error(`Rak not found in warehouse: "${rakStr}"`);
            fail++;
            continue;
          }

          await api().post("/inventory/inbound", {
            items: [
              {
                barang_id: brg.id,
                gudang_id: gudang.id,
                qty: Number(row.Qty) || 0,
                batch_no: String(row.Batch || "").trim(),
                expiry_date: parseExcelDate(row.Expired),
                supplier: String(row.Supplier || "").trim(),
                no_po: String(row.NoPO || "").trim(),
                shift_id: shift?.id || undefined,
              },
            ],
          });
          success++;
        } catch (e: any) {
          console.error("Import row failed:", e?.response?.data || e);
          fail++;
        }
      }
      notifications.show({
        title: "Import Selesai",
        message: `${success} berhasil, ${fail} gagal`,
        color: fail > 0 ? "yellow" : "green",
      });
      loadLogs();
    } catch (e) {
      console.error("Import process failed:", e);
      notifications.show({
        title: "Error",
        message: "Gagal memproses file Excel",
        color: "red",
      });
    }
  };

  const postAll = async () => {
    if (!drafts.length) return;
    try {
      await api().post("/inventory/inbound", {
        items: drafts.map((d: any) => ({
          barang_id: d.barang_id ? Number(d.barang_id) : 0,
          gudang_id: d.gudang_id ? Number(d.gudang_id) : 0,
          qty: Number(d.qty),
          batch_no: d.batch_no,
          expiry_date: d.expiry_date || null,
          supplier: d.supplier,
          no_po: d.no_po,
          shift_id: d.shift_id ? Number(d.shift_id) : undefined,
          tanggal_income: d.tanggal_income,
          jam_datang: d.jam_datang,
          jam_bongkar: d.jam_bongkar,
          jam_selesai: d.jam_selesai,
        })),
      });
      notifications.show({
        title: "Sukses",
        message: "Semua draft berhasil diposting",
        color: "green",
      });
      setDrafts([]);
      loadLogs();
    } catch (e: any) {
      notifications.show({
        title: "Error",
        message: unwrap(e.response)?.message || "Failed",
        color: "red",
      });
    }
  };

  const barangOpts = barangs.map((s: any) => ({
    value: String(s.id),
    label: s.sku ? `[${s.kategori}] ${s.sku} - ${s.nama}` : `[${s.kategori}] ${s.nama}`,
  }));
  const customerOpts = customers.map((c: any) => c.nama || c.name).filter(Boolean);
  const shiftOpts = shifts.map((s: any) => ({
    value: String(s.id),
    label: s.name,
  }));
  const zones =
    type === "wet"
      ? ["CS FROZEN", "CHILL", "WASTE"]
      : ["DRY A", "DRY B", "DRY FG"];

  const rakOpts = getGudangs()
    .map((g: any) => {
      const stocksInRack = stocks.filter(
        (s: any) => String(s.gudang?.id) === String(g.id),
      );
      const totalQty = stocksInRack.reduce(
        (sum: number, s: any) => sum + (s.qty || 0),
        0,
      );

      let disabled = false;
      if (totalQty > 0) {
        if (
          form.barang_id &&
          stocksInRack.some(
            (s: any) =>
              s.barang && String(s.barang.id) !== String(form.barang_id),
          )
        )
          disabled = true;
        if (
          !form.barang_id &&
          form.item_manual &&
          stocksInRack.some(
            (s: any) =>
              s.barang || (s.item_name && s.item_name !== form.item_manual),
          )
        )
          disabled = true;

        const produkNames = Array.from(
          new Set(
            stocksInRack
              .map((s: any) => (s.barang ? s.barang.nama : s.item_name))
              .filter(Boolean),
          ),
        ).join(", ");
        return {
          value: String(g.id),
          label: g.name,
          locName: g.name,
          itemNames: produkNames,
          qtyStr: `${totalQty} ${stocksInRack[0]?.satuan || "qty"}`,
          disabled,
          isEmpty: false,
        };
      }
      return {
        value: String(g.id),
        label: `${g.name} (KOSONG)`,
        locName: g.name,
        isEmpty: true,
        disabled: false,
      };
    })
    .filter((r: any) => !r.disabled);

  const poOpts = Array.from(
    new Set(logs.map((l: any) => l.no_po).filter(Boolean)),
  );
  const satuanOpts = Array.from(
    new Set(
      [
        ...barangs.map((b: any) => b.satuan),
        ...logs.map((l: any) => l.satuan),
      ].filter(Boolean),
    ),
  );
  const batchOpts = Array.from(
    new Set(logs.map((l: any) => l.batch_no).filter(Boolean)),
  );

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

  const sortedData = [...logs].sort((a, b) => {
    if (!sortKey) return 0;
    
    let aVal = a[sortKey];
    let bVal = b[sortKey];

    // Handle relations
    if (sortKey === 'barang.nama') {
      aVal = a.barang?.nama || '';
      bVal = b.barang?.nama || '';
    } else if (sortKey === 'gudang.name') {
      aVal = a.gudang?.name || '';
      bVal = b.gudang?.name || '';
    } else if (sortKey === 'gudang.zone') {
      aVal = a.gudang?.zone || '';
      bVal = b.gudang?.zone || '';
    } else if (sortKey === 'shift.name') {
      aVal = a.shift?.name || '';
      bVal = b.shift?.name || '';
    }

    if (aVal == null) aVal = "";
    if (bVal == null) bVal = "";

    if (typeof aVal === "number" && typeof bVal === "number") {
      return sortDir === "asc" ? aVal - bVal : bVal - aVal;
    }
    const cmp = String(aVal).localeCompare(String(bVal), undefined, { numeric: true });
    return sortDir === "asc" ? cmp : -cmp;
  });

  const filtered = search
    ? sortedData.filter(
        (r: any) =>
          r.barang?.nama?.toLowerCase().includes(search.toLowerCase()) ||
          r.no_po?.includes(search) ||
          r.supplier?.toLowerCase().includes(search.toLowerCase()),
      )
    : sortedData;

  return (
    <Box>
      <Box
        style={{
          background: "#fff",
          borderLeft: "4px solid #0ea5e9",
          padding: "14px 20px",
          marginBottom: 16,
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
              <IconBuildingWarehouse size={20} style={{ color: "#0ea5e9" }} />
              BARANG MASUK (INBOUND)
            </Title>
            <Text size="xs" c="dimmed" mt={2}>
              Manajemen penerimaan raw materials, alokasi rak, dan pencatatan kedatangan pengiriman.
            </Text>
          </Box>
          <Group gap="xs">
            <Button
              size="xs"
              color={type === "wet" ? "yellow" : "gray"}
              variant={type === "wet" ? "filled" : "outline"}
              onClick={() => {
                setType("wet");
                setSelectedZone("");
              }}
              style={{ fontWeight: 700 }}
            >
              ITEM WET
            </Button>
            <Button
              size="xs"
              variant={type === "dry" ? "filled" : "outline"}
              color={type === "dry" ? "blue" : "gray"}
              onClick={() => {
                setType("dry");
                setSelectedZone("");
              }}
              style={{ fontWeight: 700 }}
            >
              ITEM DRY
            </Button>
          </Group>
        </Group>
      </Box>

      <Box p="md">
        <Grid gutter="md">
          {/* Form Inbound */}
          <Grid.Col span={{ base: 12, md: 4, lg: 3 }}>
            <Paper withBorder p="md" radius="md" style={{ background: "#fff" }}>
              <Stack gap="xs">
                <Text fw={800} size="sm" c="blue" mb={4} style={{ borderBottom: "1px solid #f1f5f9", paddingBottom: 4 }}>
                  Eksekusi Inbound
                </Text>
                <Autocomplete
                  label="No.PO/SJ"
                  size="xs"
                  ref={barcodeRef}
                  placeholder="Cari / isi No PO..."
                  data={poOpts}
                  value={form.no_po}
                  onChange={(v: string) => f("no_po", v)}
                />

                <Select
                  label="Nama Item"
                  size="xs"
                  searchable
                  data={barangOpts}
                  value={form.barang_id}
                  onChange={(v: any) => f("barang_id", v || "")}
                  placeholder="Pilih dari master produk"
                  clearable
                  onDropdownOpen={loadBarangs}
                />
                {!form.barang_id && (
                  <Autocomplete
                    label="Atau Input Manual"
                    size="xs"
                    placeholder="Ketik nama item manual..."
                    value={form.item_manual || ""}
                    onChange={(v: string) => f("item_manual", v)}
                    data={barangs.map((b: any) => b.nama).filter(Boolean)}
                    styles={{ input: { background: "#fdfbc8" } }}
                    limit={10}
                  />
                )}

                <Divider my={4} />

                <Box>
                  <Text size="xs" fw={700} mb={4}>
                    Gudang (Zone)
                  </Text>
                  <Group gap={4} style={{ flexWrap: "wrap" }}>
                    {zones.map((z: any) => (
                      <Button
                        key={z}
                        size="xs"
                        variant={selectedZone === z ? "filled" : "outline"}
                        color={selectedZone === z ? "blue" : "gray"}
                        onClick={() => {
                          setSelectedZone(z);
                          f("gudang_id", "");
                        }}
                      >
                        {z}
                      </Button>
                    ))}
                  </Group>
                </Box>

                {selectedZone && (
                  <Select
                    label="Sub-Lokasi Gudang / Rak"
                    size="xs"
                    searchable
                    data={rakOpts}
                    value={form.gudang_id}
                    onChange={(v: any) => f("gudang_id", v || "")}
                    placeholder="Pilih rak"
                    renderOption={renderColorfulOption}
                    onDropdownOpen={loadGudangsAndStocks}
                  />
                )}

                <Group gap="xs">
                  <NumberInput
                    label="Qty"
                    size="xs"
                    value={form.qty}
                    onChange={(v: any) => f("qty", v)}
                    style={{ flex: 1 }}
                  />
                  <Autocomplete
                    label="Satuan"
                    size="xs"
                    data={satuanOpts}
                    value={form.satuan}
                    onChange={(v: string) => f("satuan", v)}
                    w={80}
                    placeholder="Pcs/Ltr"
                  />
                </Group>
                <Autocomplete
                  label="Batch No"
                  size="xs"
                  data={batchOpts}
                  value={form.batch_no}
                  onChange={(v: string) => f("batch_no", v)}
                  placeholder="Isi / Pilih Batch"
                />
                <TextInput
                  label="Tgl Expired"
                  size="xs"
                  type="date"
                  value={form.expiry_date}
                  onChange={(e: any) => f("expiry_date", e.target.value)}
                />
                <Autocomplete
                  label="Supplier (Master Customer)"
                  size="xs"
                  data={customerOpts}
                  value={form.supplier}
                  onChange={(v: string) => f("supplier", v)}
                  placeholder="Pilih / ketik supplier"
                />
                <Select
                  label="Shift"
                  size="xs"
                  data={shiftOpts}
                  value={form.shift_id}
                  onChange={(v: any) => f("shift_id", v || "")}
                  placeholder="Pilih shift"
                  clearable
                />

                <Divider my={2} />
                <Text size="xs" fw={700} c="dimmed">
                  Waktu Kedatangan & Income
                </Text>
                <TextInput
                  label="Tanggal Income"
                  size="xs"
                  type="date"
                  value={form.tanggal_income}
                  onChange={(e: any) => f("tanggal_income", e.target.value)}
                  mb="xs"
                />
                <Group gap="xs">
                  <TextInput
                    label="Jam Datang"
                    size="xs"
                    type="time"
                    value={form.jam_datang}
                    onChange={(e: any) => f("jam_datang", e.target.value)}
                    style={{ flex: 1 }}
                  />
                  <TextInput
                    label="Jam Bongkar"
                    size="xs"
                    type="time"
                    value={form.jam_bongkar}
                    onChange={(e: any) => f("jam_bongkar", e.target.value)}
                    style={{ flex: 1 }}
                  />
                </Group>
                <TextInput
                  label="Jam Selesai"
                  size="xs"
                  type="time"
                  value={form.jam_selesai}
                  onChange={(e: any) => f("jam_selesai", e.target.value)}
                />

                <Button
                  fullWidth
                  size="xs"
                  color="blue"
                  onClick={addDraft}
                  style={{ fontWeight: 800, marginTop: "8px" }}
                  leftSection={<IconPlus size={14} />}
                >
                  Tambahkan Draft
                </Button>
              </Stack>
            </Paper>
          </Grid.Col>

          {/* Draft & History Tables */}
          <Grid.Col span={{ base: 12, md: 8, lg: 9 }}>
            {drafts.length > 0 && (
              <Paper withBorder p="md" radius="md" mb="md" style={{ background: "#fff" }}>
                <Group justify="space-between" mb="xs">
                  <Text fw={800} size="sm" c="blue">
                    DRAFT ANTRIAN INBOUND ({drafts.length})
                  </Text>
                  <Button
                    size="xs"
                    color="green"
                    onClick={postAll}
                    style={{ fontWeight: 850 }}
                    leftSection={<IconSend size={14} />}
                  >
                    POSTING DRAFT INBOUND
                  </Button>
                </Group>
                <Box style={{ overflowX: "auto" }}>
                  <Table withTableBorder withColumnBorders style={{ fontSize: 11 }}>
                    <Table.Thead style={{ background: "#333" }}>
                      <Table.Tr>
                        {[
                          "NoPO",
                          "Item",
                          "Zone",
                          "Rak",
                          "Qty",
                          "Tgl Income",
                          "Batch",
                          "Expired",
                          "Supplier",
                          "Shift",
                          "Aksi",
                        ].map((h: string) => (
                          <Table.Th
                            key={h}
                            style={{ color: "#fff", fontSize: 11 }}
                          >
                            {h}
                          </Table.Th>
                        ))}
                      </Table.Tr>
                    </Table.Thead>
                    <Table.Tbody>
                      {drafts.map((d: any, i: number) => (
                        <Table.Tr key={d.id || i}>
                          <Table.Td>{d.no_po}</Table.Td>
                          <Table.Td fw={700}>{d._brg}</Table.Td>
                          <Table.Td>
                            <Badge size="xs" color="teal">
                              {d._zone}
                            </Badge>
                          </Table.Td>
                          <Table.Td>
                            <Badge size="xs" color="blue">
                              {d._gdg}
                            </Badge>
                          </Table.Td>
                          <Table.Td ta="right">{d.qty}</Table.Td>
                          <Table.Td>{d.tanggal_income}</Table.Td>
                          <Table.Td>{d.batch_no}</Table.Td>
                          <Table.Td>{d.expiry_date || "-"}</Table.Td>
                          <Table.Td>{d.supplier || "-"}</Table.Td>
                          <Table.Td>
                            {shifts.find(
                              (s: any) => String(s.id) === String(d.shift_id),
                            )?.name || "-"}
                          </Table.Td>
                          <Table.Td>
                            <Group gap={4} wrap="nowrap">
                              <ActionIcon
                                size="sm"
                                color="green"
                                variant="light"
                                onClick={() => editDraft(i)}
                              >
                                <IconEdit size={13} />
                              </ActionIcon>
                              <ActionIcon
                                size="sm"
                                color="red"
                                variant="light"
                                onClick={() =>
                                  setDrafts((p: any[]) =>
                                    p.filter((_, j: number) => j !== i),
                                  )
                                }
                              >
                                <IconTrash size={13} />
                              </ActionIcon>
                            </Group>
                          </Table.Td>
                        </Table.Tr>
                      ))}
                    </Table.Tbody>
                  </Table>
                </Box>
              </Paper>
            )}

            <Paper withBorder p="md" radius="md" style={{ background: "#fff" }}>
              <Group justify="space-between" mb="sm">
                <Text fw={850} size="sm">
                  RIWAYAT PENERIMAAN RAW MATERIALS
                </Text>
                <Group gap="xs">
                  <Button
                    size="xs"
                    variant="outline"
                    color="gray"
                    onClick={downloadTemplate}
                  >
                    Template
                  </Button>
                  <input
                    type="file"
                    accept=".xlsx,.xls"
                    id="import-inbound"
                    style={{ display: "none" }}
                    onChange={(e) => handleImport(e.target.files?.[0] || null)}
                  />
                  <Button
                    size="xs"
                    variant="outline"
                    color="blue"
                    onClick={() =>
                      document.getElementById("import-inbound")?.click()
                    }
                  >
                    Import Excel
                  </Button>
                  <TextInput
                    placeholder="Cari logs..."
                    size="xs"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    style={{ width: 180 }}
                  />
                </Group>
              </Group>

              <Box style={{ overflowX: "auto" }}>
                <Table withTableBorder withColumnBorders style={{ fontSize: 11 }}>
                  <Table.Thead style={{ background: "#1a1a1a" }}>
                    <Table.Tr>
                      <Table.Th style={{ color: "#fff", cursor: "pointer" }} onClick={() => handleSort('no_po')}>
                        NoPO{sortIcon('no_po')}
                      </Table.Th>
                      <Table.Th style={{ color: "#fff", cursor: "pointer" }} onClick={() => handleSort('barang.nama')}>
                        Item{sortIcon('barang.nama')}
                      </Table.Th>
                      <Table.Th style={{ color: "#fff", cursor: "pointer" }} onClick={() => handleSort('tanggal_income')}>
                        Tgl.Income{sortIcon('tanggal_income')}
                      </Table.Th>
                      <Table.Th style={{ color: "#fff", cursor: "pointer" }} onClick={() => handleSort('gudang.zone')}>
                        Zone{sortIcon('gudang.zone')}
                      </Table.Th>
                      <Table.Th style={{ color: "#fff", cursor: "pointer" }} onClick={() => handleSort('gudang.name')}>
                        Rak{sortIcon('gudang.name')}
                      </Table.Th>
                      <Table.Th style={{ color: "#fff", cursor: "pointer" }} onClick={() => handleSort('qty')}>
                        Qty{sortIcon('qty')}
                      </Table.Th>
                      <Table.Th style={{ color: "#fff", cursor: "pointer" }} onClick={() => handleSort('expiry_date')}>
                        Expired{sortIcon('expiry_date')}
                      </Table.Th>
                      <Table.Th style={{ color: "#fff", cursor: "pointer" }} onClick={() => handleSort('supplier')}>
                        Supplier{sortIcon('supplier')}
                      </Table.Th>
                      <Table.Th style={{ color: "#fff", cursor: "pointer" }} onClick={() => handleSort('shift.name')}>
                        Shift{sortIcon('shift.name')}
                      </Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {filtered.slice(0, 100).map((r: any) => (
                      <Table.Tr key={r.id}>
                        <Table.Td fw={600}>{r.no_po || "-"}</Table.Td>
                        <Table.Td fw={700}>{r.barang?.nama}</Table.Td>
                        <Table.Td>
                          {r.tanggal_income
                            ? r.tanggal_income
                            : new Date(r.created_at).toLocaleDateString()}
                        </Table.Td>
                        <Table.Td>
                          <Badge size="xs" color="teal">
                            {r.gudang?.zone || "-"}
                          </Badge>
                        </Table.Td>
                        <Table.Td>
                          <Badge size="xs" color="blue">
                            {r.gudang?.name || "-"}
                          </Badge>
                        </Table.Td>
                        <Table.Td ta="right" fw={700}>
                          {r.qty} {r.satuan}
                        </Table.Td>
                        <Table.Td>
                          {r.expiry_date
                            ? new Date(r.expiry_date).toISOString().split("T")[0]
                            : "-"}
                        </Table.Td>
                        <Table.Td>{r.supplier || "-"}</Table.Td>
                        <Table.Td>{r.shift?.name || "-"}</Table.Td>
                      </Table.Tr>
                    ))}
                    {filtered.length === 0 && (
                      <Table.Tr>
                        <Table.Td colSpan={9} ta="center" c="dimmed">
                          Tidak ada data logs inbound.
                        </Table.Td>
                      </Table.Tr>
                    )}
                  </Table.Tbody>
                </Table>
              </Box>
            </Paper>
          </Grid.Col>
        </Grid>
      </Box>
    </Box>
  );
}

export default function InboundPage() {
  return (
    <Suspense fallback={<Box p="xl" style={{ display: 'flex', justifyContent: 'center' }}><Loader size="lg" /></Box>}>
      <InboundContent />
    </Suspense>
  );
}
