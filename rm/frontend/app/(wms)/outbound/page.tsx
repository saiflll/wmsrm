"use client";
// @ts-nocheck
import React, { useState, useEffect, useRef } from "react";
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
  Select,
  Loader,
  NumberInput,
  ActionIcon,
  Grid,
  Divider,
  Tooltip,
  Autocomplete,
} from "@mantine/core";
import { Table } from "../components/Table";
import { useRouter } from "next/navigation";
import {
  IconTrash,
  IconCheck,
  IconX,
  IconBuildingWarehouse,
  IconPlus,
  IconEdit,
  IconSend,
  IconHistory,
} from "@tabler/icons-react";
import { notifications } from "@mantine/notifications";
import {   api, unwrap, fmt, dedup } from "../lib/api";

const CATEGORIES = [
  { value: "NORMAL", label: "Normal Delivery" },
  { value: "WASTE", label: "Waste" },
  { value: "REJECT", label: "Reject" },
  { value: "MISSING", label: "Missing" },
  { value: "RETURN_TO_WH", label: "Return to WH" },
];

export default function OutboundPage() {
  const router = useRouter();
  const [plannings, setPlannings] = useState<any[]>([]);
  const [zones, setZones] = useState<any[]>([]);
  const [racks, setRacks] = useState<any[]>([]);
  const [shifts, setShifts] = useState<any[]>([]);
  const [stocks, setStocks] = useState<any[]>([]);
  const [barangs, setBarangs] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const barcodeRef = useRef<any>(null);

  // Sorting
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  // Selection state
  const [selectedPlanningId, setSelectedPlanningId] = useState<number | null>(null);
  const [selectedPlanning, setSelectedPlanning] = useState<any>(null);
  const [processItems, setProcessItems] = useState<any[]>([]);
  const [processLoading, setProcessLoading] = useState(false);
  const [processTop, setProcessTop] = useState<any>({
    shift_id: "",
  });

  // Manual execution drafts
  const [drafts, setDrafts] = useState<any[]>(() => {
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem("wms_outbound_drafts");
        if (saved) return JSON.parse(saved);
      } catch (e) { }
    }
    return [];
  });

  const [form, setForm] = useState<any>({
    no_po: "", // ref PO
    barang_id: "",
    stock_id: "",
    qty: 1,
    satuan: "",
    batch_no: "",
    tujuan: "",
    shift_id: "",
    tanggal_realisasi: new Date().toISOString().split("T")[0],
  });

  // Active Zone & Product filters for manual stock selector
  const [selectedManualZone, setSelectedManualZone] = useState("");

  useEffect(() => {
    load();
  }, []);

  // Save manual drafts to localStorage
  useEffect(() => {
    localStorage.setItem("wms_outbound_drafts", JSON.stringify(drafts));
  }, [drafts]);

  const load = async () => {
    setLoading(true);
    try {
      const [pRes, rRes, sRes, stRes, bRes, cRes, lRes] = await Promise.all([
        api().get("/planning-outbound"),
        api().get("/gudang"),
        api().get("/shifts"),
        api().get("/inventory/stock"),
        api().get("/barang"),
        api().get("/customers"),
        api().get("/inventory/logs/outbound"),
      ]);

      const gudangData = unwrap(rRes);
      const allGudang = Array.isArray(gudangData) ? gudangData : gudangData?.data || [];
      const uniqueZones = Array.from(
        new Set(allGudang.map((g: any) => g.zone).filter(Boolean))
      );
      setZones(uniqueZones);
      setRacks(allGudang);
      setShifts(unwrap(sRes));

      const stockData = unwrap(stRes) || [];
      const allStocks = Array.isArray(stockData) ? stockData : stockData?.data || [];
      const allBarangs = unwrap(bRes) || [];
      const allPlans = unwrap(pRes) || [];

      // Filter out all chicken items (handled separately in Planning & Outbound Ayam)
      const nonAyamBarangs = allBarangs.filter((x: any) =>
        !x.nama?.toLowerCase().includes('ayam') && !x.kategori?.toLowerCase().includes('ayam')
      );
      const nonAyamStocks = allStocks.filter((st: any) =>
        !st.barang?.nama?.toLowerCase().includes('ayam') && !st.barang?.kategori?.toLowerCase().includes('ayam')
      );
      const nonAyamPlans = allPlans.filter((plan: any) => {
        return !plan.items?.some((item: any) => {
          const brg = allBarangs.find((br: any) => String(br.id) === String(item.barangId));
          return brg?.nama?.toLowerCase().includes('ayam') || brg?.kategori?.toLowerCase().includes('ayam');
        });
      });

      setStocks(nonAyamStocks);
      setBarangs(nonAyamBarangs);
      setPlannings(nonAyamPlans);
      setCustomers(unwrap(cRes));
      const allLogs = unwrap(lRes) || [];
      const nonAyamLogs = allLogs.filter((log: any) =>
        !log.barang?.nama?.toLowerCase().includes('ayam') &&
        !log.barang?.kategori?.toLowerCase().includes('ayam') &&
        !log.keterangan?.toLowerCase().includes('outbound ayam')
      );
      setLogs(nonAyamLogs);
    } catch (e) {
      console.error("Load outbound data failed", e);
    }
    setLoading(false);
  };

  const f = (k: string, v: any) => setForm((p: any) => ({ ...p, [k]: v }));

  // Manual stock options
  const manualStockOpts = dedup(stocks
    .filter((s: any) => !selectedManualZone || s.gudang?.zone === selectedManualZone)
    .filter((s: any) => !form.barang_id || String(s.barang?.id) === String(form.barang_id))
    .map((s: any) => {
      const available = s.qty - (s.reserved_qty || 0);
      return {
        value: String(s.id),
        label: `${s.gudang?.name} — Qty: ${available} (${s.batch_no || "no batch"})`,
        disabled: available <= 0,
      };
    }));

  const addManualDraft = () => {
    if (!form.stock_id || !form.qty) {
      return notifications.show({ title: "Error", message: "Pilih stock rak & qty terlebih dahulu", color: "red" });
    }
    const selSt = stocks.find((s: any) => String(s.id) === String(form.stock_id));
    if (!selSt) return;

    const bName = selSt.barang?.nama || "Unknown";
    setDrafts((prev) => [
      ...prev,
      {
        id: Date.now(),
        barang_id: selSt.barang?.id,
        gudang_id: selSt.gudang?.id,
        qty: form.qty,
        satuan: form.satuan || selSt.satuan || selSt.barang?.satuan || "Pcs",
        batch_no: selSt.batch_no || "",
        tujuan: form.tujuan || "-",
        shift_id: form.shift_id || undefined,
        no_po: form.no_po || "-",
        tanggal_realisasi: form.tanggal_realisasi,
        _brg: bName,
        _gdg: selSt.gudang?.name || "-",
        _zone: selSt.gudang?.zone || "-",
      },
    ]);

    setForm((p: any) => ({
      ...p,
      stock_id: "",
      qty: 1,
      satuan: "",
      batch_no: "",
    }));
  };

  const postManualAll = async () => {
    if (!drafts.length) return;
    try {
      await api().post("/inventory/outbound", {
        items: drafts.map((d: any) => ({
          barang_id: Number(d.barang_id),
          gudang_id: Number(d.gudang_id),
          qty: Number(d.qty),
          batch_no: d.batch_no || undefined,
          satuan: d.satuan || undefined,
          tujuan: d.tujuan || undefined,
          shift_id: d.shift_id ? Number(d.shift_id) : undefined,
          no_ref: d.no_po || undefined,
        })),
      });

      notifications.show({
        title: "Sukses",
        message: "Eksekusi outbound berhasil diposting",
        color: "green",
      });
      setDrafts([]);
      load();
    } catch (e: any) {
      notifications.show({
        title: "Error",
        message: unwrap(e.response)?.message || "Gagal memposting outbound",
        color: "red",
      });
    }
  };

  const openProcessForm = (planning: any) => {
    setSelectedPlanning(planning);
    setSelectedPlanningId(planning.id);
    setProcessTop({
      shift_id: planning.shift?.id ? String(planning.shift.id) : "",
    });

    const initialItems = (planning.items || []).map((item: any, idx: number) => ({
      id: Date.now() + idx + Math.random(),
      barang_id: String(item.barangId),
      gudang_id: item.gudangId ? String(item.gudangId) : "",
      zone: item.gudangId ? (racks.find((r) => r.id === item.gudangId)?.zone || "") : "",
      qty: item.qty,
      plan_qty: item.qty,
      batch_no: item.batch_no || "",
      satuan: item.satuan || "",
      tujuan: "NORMAL",
      note: "",
    }));
    setProcessItems(initialItems);
  };

  const addProcessItem = () => {
    setProcessItems((p) => [
      ...p,
      {
        id: Date.now() + Math.random(),
        barang_id: "",
        gudang_id: "",
        zone: "",
        qty: 1,
        plan_qty: 0,
        batch_no: "",
        satuan: "",
        tujuan: "NORMAL",
        note: "",
      },
    ]);
  };

  const updateProcessItem = (id: number, field: string, value: any) => {
    setProcessItems((p) =>
      p.map((item) => {
        if (item.id !== id) return item;
        if (field === "zone") {
          return { ...item, zone: value, gudang_id: "" };
        }
        return { ...item, [field]: value };
      })
    );
  };

  const removeProcessItem = (id: number) => {
    setProcessItems((p) => p.filter((item) => item.id !== id));
  };

  const submitProcessOutbound = async () => {
    if (!processItems.length) {
      return notifications.show({
        title: "Error",
        message: "Tambahkan minimal 1 item untuk diproses",
        color: "red",
      });
    }

    // Validation
    for (const item of processItems) {
      if (!item.barang_id || !item.gudang_id || !item.qty) {
        return notifications.show({
          title: "Error",
          message: "Semua item harus memiliki barang, gudang, dan qty",
          color: "red",
        });
      }
      if (["WASTE", "REJECT", "MISSING"].includes(item.tujuan) && !item.note) {
        return notifications.show({
          title: "Error",
          message: `Keterangan wajib diisi untuk kategori ${item.tujuan}`,
          color: "red",
        });
      }
    }

    setProcessLoading(true);
    try {
      const payload = {
        items: processItems.map((item) => ({
          barangId: Number(item.barang_id),
          gudangId: Number(item.gudang_id),
          qty: Number(item.qty),
          tujuan: item.tujuan,
          batch_no: item.batch_no || undefined,
        })),
        keterangan: processItems
          .filter((r) => r.note)
          .map((r) => `${r.tujuan}: ${r.note}`)
          .join("; ") || "Diproses dari outbound page",
      };

      // 1. Process plan (saves split data, changes state to PROGRESS)
      await api().post(`/planning-outbound/${selectedPlanningId}/process`, payload);
      // 2. Publish plan (deducts stock and closes PO)
      await api().post(`/planning-outbound/${selectedPlanningId}/publish`, {
        keterangan: payload.keterangan,
      });

      notifications.show({
        title: "Sukses",
        message: "Outbound planning berhasil diproses & dipublish",
        color: "green",
      });

      setProcessItems([]);
      setSelectedPlanningId(null);
      setSelectedPlanning(null);
      load();
    } catch (e: any) {
      notifications.show({
        title: "Error",
        message: unwrap(e.response)?.message || "Gagal memproses outbound",
        color: "red",
      });
    }
    setProcessLoading(false);
  };

  const deletePlanning = async (id: number) => {
    if (!confirm("Hapus planning outbound ini?")) return;
    try {
      await api().delete(`/planning-outbound/${id}`);
      notifications.show({ title: "Sukses", message: "Planning berhasil dihapus", color: "green" });
      load();
    } catch (e: any) {
      notifications.show({ title: "Error", message: "Gagal menghapus planning", color: "red" });
    }
  };

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

  const sortedLogs = [...logs].sort((a, b) => {
    if (!sortKey) return 0;
    let aVal = a[sortKey];
    let bVal = b[sortKey];

    if (sortKey === "barang.nama") {
      aVal = a.barang?.nama || "";
      bVal = b.barang?.nama || "";
    } else if (sortKey === "gudang.name") {
      aVal = a.gudang?.name || "";
      bVal = b.gudang?.name || "";
    } else if (sortKey === "shift.name") {
      aVal = a.shift?.name || "";
      bVal = b.shift?.name || "";
    }

    if (aVal == null) aVal = "";
    if (bVal == null) bVal = "";

    if (typeof aVal === "number" && typeof bVal === "number") {
      return sortDir === "asc" ? aVal - bVal : bVal - aVal;
    }
    const cmp = String(aVal).localeCompare(String(bVal), undefined, { numeric: true });
    return sortDir === "asc" ? cmp : -cmp;
  });

  const filteredLogs = search
    ? sortedLogs.filter(
      (r: any) =>
        r.barang?.nama?.toLowerCase().includes(search.toLowerCase()) ||
        r.no_ref?.includes(search) ||
        r.tujuan?.toLowerCase().includes(search.toLowerCase())
    )
    : sortedLogs;

  const barangOpts = dedup(barangs.map((b: any) => ({
    value: String(b.id),
    label: b.sku ? `[${b.kategori}] ${b.sku} - ${b.nama}` : `[${b.kategori}] ${b.nama}`,
  })));

  const customerOpts = customers.map((c: any) => c.nama || c.name).filter(Boolean);
  const shiftOpts = dedup(shifts.map((s: any) => ({
    value: String(s.id),
    label: s.name,
  })));

  return (
    <Box>
      {/* Header */}
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
              <IconBuildingWarehouse size={20} style={{ color: "#f03e3e" }} />
              EKSEKUSI OUTBOUND (BARANG KELUAR)
            </Title>
            {/* <Text size="xs" c="dimmed" mt={2}>
              Manajemen pengeluaran raw materials, scan item keluar, dan sinkronisasi dengan draft planning.
            </Text> */}
          </Box>
        </Group>
      </Box>

      <Box p="md">
        <Grid gutter="md">
          {/* Left Column: Form Manual or Process Outbound Form */}
          <Grid.Col span={{ base: 12, md: 4, lg: 3 }}>
            {selectedPlanning ? (
              <Paper withBorder p="md" radius="md" style={{ background: "#fff" }}>
                <Stack gap="xs">
                  <Group justify="space-between" style={{ borderBottom: "1px solid #f1f5f9", paddingBottom: 4 }}>
                    <Text fw={800} size="xs" c="red" style={{ display: "flex", alignItems: "center", gap: 4 }}>
                      <IconCheck size={14} /> PROSES OUTBOUND: {selectedPlanning.no_ref || `#${selectedPlanning.id}`}
                    </Text>
                    <ActionIcon size="xs" color="gray" variant="subtle" onClick={() => {
                      setSelectedPlanning(null);
                      setSelectedPlanningId(null);
                      setProcessItems([]);
                    }}>
                      <IconX size={14} />
                    </ActionIcon>
                  </Group>

                  <Select
                    label="Shift"
                    size="xs"
                    data={shiftOpts}
                    value={processTop.shift_id}
                    onChange={(v) => setProcessTop((p: any) => ({ ...p, shift_id: v || "" }))}
                    placeholder="Pilih shift"
                    required
                  />

                  <Divider my={4} label="Items" labelPosition="center" />

                  {processItems.map((item: any, idx: number) => {
                    const bName = barangs.find((b: any) => String(b.id) === String(item.barang_id))?.nama || `Item ${idx + 1}`;

                    // Filter Raks holding this product
                    const itemZone = item.zone || "";
                    const filteredRaks = stocks
                      .filter((s: any) => s.gudang?.zone === itemZone && String(s.barang?.id) === String(item.barang_id))
                      .map((s: any) => {
                        const available = s.qty - (s.reserved_qty || 0);
                        return {
                          value: String(s.gudang?.id),
                          label: `${s.gudang?.name} (${available} qty, ${s.batch_no || "no batch"})`,
                          disabled: available <= 0,
                        };
                      });

                    return (
                      <Box key={item.id} style={{ border: "1px solid #e2e8f0", borderRadius: 6, padding: 8, background: "#fafafa", marginBottom: 4 }}>
                        <Group justify="space-between" mb={4}>
                          {item.plan_qty > 0 ? (
                            <Text fw={700} size="xs" c="indigo">{bName}</Text>
                          ) : (
                            <Select
                              label="Pilih Barang"
                              size="xs"
                              searchable
                              data={barangOpts}
                              value={item.barang_id}
                              onChange={(v) => updateProcessItem(item.id, "barang_id", v || "")}
                              placeholder="Pilih produk master"
                              required
                              style={{ flex: 1, marginRight: 8 }}
                            />
                          )}
                          {processItems.length > 1 && (
                            <ActionIcon size="xs" color="red" variant="subtle" onClick={() => removeProcessItem(item.id)}>
                              <IconTrash size={12} />
                            </ActionIcon>
                          )}
                        </Group>
                        <Text size="10px" c="dimmed" mb={4}>Planning Qty: <b>{item.plan_qty} {item.satuan}</b></Text>

                        <Select
                          label="Category"
                          size="xs"
                          data={CATEGORIES}
                          value={item.tujuan}
                          onChange={(v) => updateProcessItem(item.id, "tujuan", v || "NORMAL")}
                          required
                        />

                        <NumberInput
                          label="Qty Diambil"
                          size="xs"
                          value={item.qty}
                          onChange={(v) => updateProcessItem(item.id, "qty", Number(v || 0))}
                          min={0}
                          required
                        />

                        <Select
                          label="Pilih Zone Asal"
                          size="xs"
                          data={zones}
                          value={item.zone || ""}
                          onChange={(v) => {
                            updateProcessItem(item.id, "zone", v || "");
                            updateProcessItem(item.id, "gudang_id", "");
                          }}
                          placeholder="Pilih Zone"
                          required
                        />

                        {item.zone && (
                          <Select
                            label="Rak Asal (Tersedia)"
                            size="xs"
                            searchable
                            data={filteredRaks}
                            value={item.gudang_id || ""}
                            onChange={(v) => updateProcessItem(item.id, "gudang_id", v || "")}
                            placeholder="Pilih rak"
                            required
                          />
                        )}

                        <TextInput
                          label="Batch No"
                          size="xs"
                          value={item.batch_no}
                          onChange={(e) => updateProcessItem(item.id, "batch_no", e.target.value)}
                          placeholder="Batch number"
                        />

                        {["WASTE", "REJECT", "MISSING"].includes(item.tujuan) && (
                          <TextInput
                            label="Alasan / Notes"
                            size="xs"
                            placeholder="Alasan Waste/Reject..."
                            value={item.note || ""}
                            onChange={(e) => updateProcessItem(item.id, "note", e.target.value)}
                            required
                          />
                        )}
                      </Box>
                    );
                  })}

                  <Button
                    variant="light"
                    size="xs"
                    onClick={addProcessItem}
                    leftSection={<IconPlus size={14} />}
                  >
                    Tambah Item
                  </Button>

                  <Button
                    fullWidth
                    size="xs"
                    color="green"
                    onClick={submitProcessOutbound}
                    loading={processLoading}
                    leftSection={<IconCheck size={14} />}
                    style={{ fontWeight: 800, marginTop: 8 }}
                  >
                    Selesaikan Outbound
                  </Button>
                </Stack>
              </Paper>
            ) : (
              <Paper withBorder p="md" radius="md" style={{ background: "#fff" }}>
                <Stack gap="xs">
                  <Text fw={800} size="sm" c="red" mb={4} style={{ borderBottom: "1px solid #f1f5f9", paddingBottom: 4 }}>
                    Eksekusi Outbound Manual
                  </Text>

                  <Autocomplete
                    label="No. PO / Ref"
                    size="xs"
                    ref={barcodeRef}
                    placeholder="Isi / scan No Ref..."
                    value={form.no_po}
                    onChange={(v: string) => f("no_po", v)}
                  />

                  <Select
                    label="Pilih Item (M. Produk)"
                    size="xs"
                    searchable
                    data={barangOpts}
                    value={form.barang_id}
                    onChange={(v: any) => {
                      f("barang_id", v || "");
                      f("stock_id", "");
                    }}
                    placeholder="Pilih dari master produk"
                    clearable
                  />

                  <Select
                    label="Pilih Zone Asal"
                    size="xs"
                    data={zones}
                    value={selectedManualZone}
                    onChange={(v) => {
                      setSelectedManualZone(v || "");
                      f("stock_id", "");
                    }}
                    placeholder="Pilih Zone"
                    clearable
                  />

                  {(form.barang_id || selectedManualZone) && (
                    <Select
                      label="Pilih Rak & Batch Stok"
                      size="xs"
                      searchable
                      data={manualStockOpts}
                      value={form.stock_id}
                      onChange={(v: any) => f("stock_id", v || "")}
                      placeholder="Pilih rak asal"
                      required
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
                    <TextInput
                      label="Satuan"
                      size="xs"
                      value={form.satuan}
                      onChange={(e: any) => f("satuan", e.target.value)}
                      w={80}
                      placeholder="Pcs"
                    />
                  </Group>

                  <Autocomplete
                    label="Tujuan / Customer"
                    size="xs"
                    data={customerOpts}
                    value={form.tujuan}
                    onChange={(v: string) => f("tujuan", v)}
                    placeholder="Pilih / ketik tujuan"
                  />

                  <Select
                    label="Shift"
                    size="xs"
                    data={shiftOpts}
                    value={form.shift_id}
                    onChange={(v: any) => f("shift_id", v || "")}
                    placeholder="Pilih shift"
                  />

                  <TextInput
                    label="Tanggal Realisasi"
                    size="xs"
                    type="date"
                    value={form.tanggal_realisasi}
                    onChange={(e: any) => f("tanggal_realisasi", e.target.value)}
                  />

                  <Button
                    fullWidth
                    size="xs"
                    color="blue"
                    onClick={addManualDraft}
                    style={{ fontWeight: 800, marginTop: "8px" }}
                    leftSection={<IconPlus size={14} />}
                  >
                    Tambahkan Draft
                  </Button>
                </Stack>
              </Paper>
            )}
          </Grid.Col>

          {/* Right Column: Drafts & Active Plans & History */}
          <Grid.Col span={{ base: 12, md: 8, lg: 9 }}>
            <Stack gap="md">
              {/* Draft Manual Table */}
              {drafts.length > 0 && (
                <Paper withBorder p="md" radius="md" style={{ background: "#fff" }}>
                  <Text fw={800} size="sm" c="blue" mb="xs">
                    DRAFT ANTRIAN OUTBOUND ({drafts.length})
                  </Text>
                  <Box style={{ overflowX: "auto" }}>
                    <Table withTableBorder withColumnBorders style={{ fontSize: 11 }}>
                      <Table.Thead style={{ background: "#fef2f2", borderBottom: "2px solid #fecaca" }}>
                        <Table.Tr>
                          {["No PO/Ref", "Item", "Zone", "Rak", "Qty", "Tujuan", "Shift", "Aksi"].map((h) => (
                            <Table.Th key={h} style={{ color: "#b91c1c", fontSize: 11 }}>{h}</Table.Th>
                          ))}
                        </Table.Tr>
                      </Table.Thead>
                      <Table.Tbody>
                        {drafts.map((d: any, i: number) => (
                          <Table.Tr key={d.id || i}>
                            <Table.Td>{d.no_po}</Table.Td>
                            <Table.Td fw={700}>{d._brg}</Table.Td>
                            <Table.Td><Badge size="xs" color="teal">{d._zone}</Badge></Table.Td>
                            <Table.Td><Badge size="xs" color="red">{d._gdg}</Badge></Table.Td>
                            <Table.Td ta="right">{d.qty} {d.satuan}</Table.Td>
                            <Table.Td>{d.tujuan}</Table.Td>
                            <Table.Td>{shifts.find((s) => String(s.id) === String(d.shift_id))?.name || "-"}</Table.Td>
                            <Table.Td>
                              <ActionIcon
                                size="sm"
                                color="red"
                                variant="light"
                                onClick={() => setDrafts((p) => p.filter((_, j) => j !== i))}
                              >
                                <IconTrash size={13} />
                              </ActionIcon>
                            </Table.Td>
                          </Table.Tr>
                        ))}
                      </Table.Tbody>
                    </Table>
                  </Box>
                  <Group justify="center" mt="sm">
                    <Button
                      size="xs"
                      color="green"
                      onClick={postManualAll}
                      leftSection={<IconSend size={14} />}
                    >
                      PUBLISH — Posting Outbound ({drafts.length} item)
                    </Button>
                  </Group>
                </Paper>
              )}

              {/* Database Active Planning Outbound Table */}
              {plannings.filter((p) => p.status === "WAIT").length > 0 && (
                <Paper withBorder p="md" radius="md" style={{ background: "#fff" }}>
                  <Text fw={800} size="sm" c="red" mb="xs">
                    PLANNING OUTBOUND AKTIF (DATABASE) ({plannings.filter((p) => p.status === "WAIT").length})
                  </Text>
                  <Box style={{ overflowX: "auto" }}>
                    <Table withTableBorder withColumnBorders style={{ fontSize: 11 }}>
                      <Table.Thead style={{ background: "#fef2f2", borderBottom: "2px solid #fecaca" }}>
                        <Table.Tr>
                          {["No Ref", "Tujuan", "Items", "Tgl Planning", "Shift", "Aksi"].map((h) => (
                            <Table.Th key={h} style={{ color: "#b91c1c", fontSize: 11 }}>{h}</Table.Th>
                          ))}
                        </Table.Tr>
                      </Table.Thead>
                      <Table.Tbody>
                        {plannings.filter((p) => p.status === "WAIT").map((d: any) => (
                          <Table.Tr key={d.id}>
                            <Table.Td fw={700} style={{ color: "#f03e3e" }}>{d.no_ref || `#${d.id}`}</Table.Td>
                            <Table.Td>{d.customer?.nama || d.tujuan || "-"}</Table.Td>
                            <Table.Td>
                              {d.items?.map((item: any, idx: number) => {
                                const bObj = barangs.find((b) => b.id === item.barangId);
                                return (
                                  <div key={idx} style={{ fontSize: 10, borderBottom: '1px solid #f1f5f9', padding: '2px 0' }}>
                                    {bObj ? bObj.nama : `Barang #${item.barangId}`} <b>x{item.qty} {item.satuan || ""}</b>
                                  </div>
                                );
                              })}
                            </Table.Td>
                            <Table.Td>{fmt(d.tanggal_planning)}</Table.Td>
                            <Table.Td>{d.shift?.name || "-"}</Table.Td>
                            <Table.Td>
                              <Group gap={4}>
                                <Tooltip label="Proses Outbound">
                                  <ActionIcon
                                    size="sm"
                                    color="green"
                                    variant="light"
                                    onClick={() => openProcessForm(d)}
                                  >
                                    <IconCheck size={13} />
                                  </ActionIcon>
                                </Tooltip>
                                <Tooltip label="Hapus Planning">
                                  <ActionIcon
                                    size="sm"
                                    color="red"
                                    variant="light"
                                    onClick={() => deletePlanning(d.id)}
                                  >
                                    <IconTrash size={13} />
                                  </ActionIcon>
                                </Tooltip>
                              </Group>
                            </Table.Td>
                          </Table.Tr>
                        ))}
                      </Table.Tbody>
                    </Table>
                  </Box>
                </Paper>
              )}

              {/* Riwayat Outbound Table */}
              <Paper withBorder p="md" radius="md" style={{ background: "#fff" }}>
                <Group justify="space-between" mb="sm">
                  <Text fw={850} size="sm">
                    RIWAYAT PENGELUARAN RAW MATERIALS
                  </Text>
                  <TextInput
                    placeholder="Cari logs..."
                    size="xs"
                    value={search}
                    onChange={(e: any) => setSearch(e.target.value)}
                    style={{ width: 200 }}
                  />
                </Group>

                <Box style={{ overflowX: "auto" }}>
                  <Table withTableBorder withColumnBorders style={{ fontSize: 11 }}>
                    <Table.Thead style={{ background: "#fef2f2", borderBottom: "2px solid #fecaca" }}>
                      <Table.Tr>
                        <Table.Th style={{ color: "#b91c1c", cursor: "pointer" }} onClick={() => handleSort("no_ref")}>NoPO/Ref{sortIcon("no_ref")}</Table.Th>
                        <Table.Th style={{ color: "#b91c1c", cursor: "pointer" }} onClick={() => handleSort("barang.nama")}>Item{sortIcon("barang.nama")}</Table.Th>
                        <Table.Th style={{ color: "#b91c1c", cursor: "pointer" }} onClick={() => handleSort("created_at")}>Tgl Keluar{sortIcon("created_at")}</Table.Th>
                        <Table.Th style={{ color: "#b91c1c", cursor: "pointer" }} onClick={() => handleSort("gudang.zone")}>Zone{sortIcon("gudang.zone")}</Table.Th>
                        <Table.Th style={{ color: "#b91c1c", cursor: "pointer" }} onClick={() => handleSort("gudang.name")}>Rak{sortIcon("gudang.name")}</Table.Th>
                        <Table.Th style={{ color: "#b91c1c", cursor: "pointer" }} onClick={() => handleSort("qty")}>Qty{sortIcon("qty")}</Table.Th>
                        <Table.Th style={{ color: "#b91c1c", cursor: "pointer" }} onClick={() => handleSort("tujuan")}>Tujuan{sortIcon("tujuan")}</Table.Th>
                        <Table.Th style={{ color: "#b91c1c", cursor: "pointer" }} onClick={() => handleSort("shift.name")}>Shift{sortIcon("shift.name")}</Table.Th>
                      </Table.Tr>
                    </Table.Thead>
                    <Table.Tbody>
                      {filteredLogs.slice(0, 100).map((r: any, index: number) => (
                        <Table.Tr key={r.id} style={{ backgroundColor: index % 2 === 0 ? "#fff" : "#f8f9fa" }}>
                          <Table.Td fw={600}>{r.no_ref || "-"}</Table.Td>
                          <Table.Td fw={700}>{r.barang?.nama}</Table.Td>
                          <Table.Td>{new Date(r.created_at).toLocaleDateString()}</Table.Td>
                          <Table.Td><Badge size="xs" color="teal">{r.gudang?.zone || "-"}</Badge></Table.Td>
                          <Table.Td><Badge size="xs" color="blue">{r.gudang?.name || "-"}</Badge></Table.Td>
                          <Table.Td ta="right" fw={700}>{r.qty} {r.satuan}</Table.Td>
                          <Table.Td>{r.tujuan || "-"}</Table.Td>
                          <Table.Td>{r.shift?.name || "-"}</Table.Td>
                        </Table.Tr>
                      ))}
                      {filteredLogs.length === 0 && (
                        <Table.Tr>
                          <Table.Td colSpan={8} ta="center" c="dimmed">Tidak ada data logs outbound.</Table.Td>
                        </Table.Tr>
                      )}
                    </Table.Tbody>
                  </Table>
                </Box>
              </Paper>
            </Stack>
          </Grid.Col>
        </Grid>
      </Box>
    </Box>
  );
}
