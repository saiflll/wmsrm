"use client";
// @ts-nocheck
import React, { useState, useEffect, useRef } from "react";
import { Box, Group, Button, Title, Text, Badge, Paper, Stack, TextInput, Select, MultiSelect, Autocomplete, Grid, ActionIcon, NumberInput, Tooltip } from "@mantine/core";
import { Table } from '../components/Table';
import Pagination from '../components/Pagination';
import {
  IconPlus,
  IconEdit,
  IconTrash,
  IconBuildingWarehouse,
  IconSend,
} from "@tabler/icons-react";
import { notifications } from "@mantine/notifications";
import { useRouter } from "next/navigation";
import { api, unwrap, dedup } from "../lib/api";

export default function PlanningInboundPage() {
  const router = useRouter();
  const [plans, setPlans] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [barangs, setBarangs] = useState<any[]>([]);
  const [gudangs, setGudangs] = useState<any[]>([]);
  const [stocks, setStocks] = useState<any[]>([]);
  const [logs, setLogs] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [page, setPage] = useState(1);
  const [limit] = useState(10);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);

  const [editPlanId, setEditPlanId] = useState<number | null>(null);
  const [planningDrafts, setPlanningDrafts] = useState<any[]>(() => {
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem("wms_driver_planning_drafts");
        if (saved) return JSON.parse(saved);
      } catch (e) {}
    }
    return [];
  });
  const [editDraftIndex, setEditDraftIndex] = useState<number | null>(null);

  useEffect(() => {
    localStorage.setItem("wms_driver_planning_drafts", JSON.stringify(planningDrafts));
  }, [planningDrafts]);

  const pf = (k: string, v: any) => setForm((p: any) => ({ ...p, [k]: v }));

  // Sort states
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  const [form, setForm] = useState<any>({
    no_po: "",
    supplier: "",
    estimasi_datang: "",
    note: "",
    items: [], // [{ barangId: number, qty: number, _name: string, satuan: string }]
  });

  // Current item being added inside the form
  const [selectedBarangId, setSelectedBarangId] = useState("");
  const [itemQty, setItemQty] = useState(1);
  const [selectedZone, setSelectedZone] = useState("");
  const [selectedRackIds, setSelectedRackIds] = useState<string[]>([]);

  const load = async () => {
    try {
      const [pRes, cRes, lRes, bRes, gRes, sRes] = await Promise.all([
        api().get(`/inbound-planning?page=${page}&limit=${limit}`),
        api().get("/customers"),
        api().get("/inventory/logs/inbound"),
        api().get("/barang"),
        api().get("/gudang"),
        api().get("/inventory/stock"),
      ]);
      const planData = unwrap(pRes);
      if (planData && planData.data) {
        setPlans(planData.data);
        setTotal(planData.total || 0);
        setTotalPages(planData.totalPages || 0);
      } else {
        setPlans(planData);
      }
      setCustomers(unwrap(cRes));
      setLogs(unwrap(lRes));
      setBarangs(unwrap(bRes));
      const gudangData = unwrap(gRes);
      setGudangs(Array.isArray(gudangData) ? gudangData : gudangData?.data || []);
      const stockData = unwrap(sRes);
      setStocks(Array.isArray(stockData) ? stockData : stockData?.data || []);
    } catch (e) {
      console.error("Load planning inbound data failed:", e);
    }
  };

  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    load();
  }, [page]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const editVal = params.get("edit");
      if (editVal) {
        try {
          if (editVal.startsWith("{")) {
            const draftObj = JSON.parse(decodeURIComponent(editVal));
            setForm({
              no_po: draftObj.no_po || "",
              supplier: draftObj.supplier || "",
              estimasi_datang: draftObj.estimasi_datang || "",
              note: draftObj.note || "",
              items: draftObj.items || [],
            });
            const idx = planningDrafts.findIndex((d) => d.no_po === draftObj.no_po);
            if (idx !== -1) {
              setEditDraftIndex(idx);
            }
          } else {
            const dbId = Number(editVal);
            if (!isNaN(dbId)) {
              setEditPlanId(dbId);
            }
          }
        } catch (e) {
          console.error(e);
        }
      }
    }
  }, [plans]);

  useEffect(() => {
    if (editPlanId !== null && plans.length > 0) {
      const p = plans.find((x) => x.id === editPlanId);
      if (p) {
        const mappedItems = p.items.map((it: any) => {
          const bObj = barangs.find((b: any) => b.id === it.barangId);
          return {
            barangId: it.barangId,
            qty: it.qty,
            _name: bObj ? bObj.nama : '-',
            satuan: it.satuan || bObj?.satuan || '',
            zone: it.zone || '',
            rackAllocations: it.rackAllocations || [],
          };
        });
        setForm({
          no_po: p.no_po,
          supplier: p.supplier || "",
          estimasi_datang: p.estimasi_datang ? new Date(p.estimasi_datang).toISOString().slice(0, 16) : "",
          note: p.note || "",
          items: mappedItems,
        });
      }
    }
  }, [editPlanId, plans, barangs]);

  if (!mounted) return null;

  const zones = Array.from(new Set(gudangs.map((g: any) => g.zone).filter(Boolean))).sort();
  const rackCapacity = (rack: any) => Number(rack?.capacity ?? rack?.kapasitas ?? rack?.max_capacity ?? rack?.maxCapacity ?? 1000);
  const rackUsedQty = (rackId: any) => stocks
    .filter((s: any) => String(s.gudang?.id) === String(rackId))
    .reduce((sum: number, s: any) => sum + Number(s.qty || 0), 0);
  const rackPlannedQty = (rackId: any) => form.items
    .flatMap((it: any) => it.rackAllocations || [])
    .filter((a: any) => String(a.gudangId) === String(rackId))
    .reduce((sum: number, a: any) => sum + Number(a.qty || 0), 0);
  const rackAcceptsItem = (rackId: any, barangId: any) => !stocks
    .filter((s: any) => String(s.gudang?.id) === String(rackId))
    .some((s: any) => s.barang && String(s.barang.id) !== String(barangId));

  const rackOptions = gudangs
    .filter((g: any) => g.status !== false && g.zone?.toUpperCase() === selectedZone.toUpperCase() && rackAcceptsItem(g.id, selectedBarangId))
    .map((g: any) => {
      const capacity = rackCapacity(g);
      const available = Math.max(0, capacity - rackUsedQty(g.id) - rackPlannedQty(g.id));
      return { value: String(g.id), label: `${g.name} — sisa ${available}/${capacity}`, disabled: available <= 0 };
    });

  const buildRackAllocations = () => {
    let remaining = Number(itemQty || 0);
    const allocations: any[] = [];
    for (const rackId of selectedRackIds) {
      if (remaining <= 0) break;
      const rack = gudangs.find((g: any) => String(g.id) === String(rackId));
      if (!rack) continue;
      const available = Math.max(0, rackCapacity(rack) - rackUsedQty(rack.id) - rackPlannedQty(rack.id));
      const qty = Math.min(remaining, available);
      if (qty > 0) {
        allocations.push({ gudangId: Number(rack.id), gudangName: rack.name, qty });
        remaining -= qty;
      }
    }
    return { allocations, remaining };
  };

  const addItemToForm = () => {
    if (!selectedBarangId) {
      return notifications.show({ title: "Error", message: "Pilih barang terlebih dahulu", color: "red" });
    }
    if (itemQty <= 0) {
      return notifications.show({ title: "Error", message: "Qty harus lebih dari 0", color: "red" });
    }
    if (!selectedZone || !selectedRackIds.length) {
      return notifications.show({ title: "Error", message: "Pilih zone dan minimal satu rak", color: "red" });
    }
    const bObj = barangs.find((b: any) => String(b.id) === selectedBarangId);
    if (!bObj) return;

    const { allocations, remaining } = buildRackAllocations();
    if (remaining > 0) {
      return notifications.show({
        title: "Kapasitas rak tidak cukup",
        message: `Masih ada ${remaining} ${bObj.satuan || "qty"}. Pilih rak tambahan.`,
        color: "red",
      });
    }
    setForm((p: any) => ({
      ...p,
      items: [...p.items, {
        barangId: Number(selectedBarangId), qty: itemQty, _name: bObj.nama,
        satuan: bObj.satuan || 'Pcs', zone: selectedZone, rackAllocations: allocations,
      }],
    }));
    setSelectedBarangId("");
    setItemQty(1);
    setSelectedZone("");
    setSelectedRackIds([]);
  };

  const removeItemFromForm = (idx: number) => {
    setForm((p: any) => ({
      ...p,
      items: p.items.filter((_: any, i: number) => i !== idx),
    }));
  };

  const submitPlanning = async () => {
    if (!form.no_po) {
      return notifications.show({ title: "Error", message: "No PO/SJ wajib diisi", color: "red" });
    }
    if (!form.items.length) {
      return notifications.show({ title: "Error", message: "Tambahkan minimal 1 item ke planning", color: "red" });
    }

    const payload = {
      no_po: form.no_po,
      supplier: form.supplier,
      estimasi_datang: form.estimasi_datang || undefined,
      note: form.note,
      items: form.items.map((it: any) => ({
        barangId: Number(it.barangId),
        qty: Number(it.qty),
        satuan: it.satuan || undefined,
        zone: it.zone || undefined,
        rackAllocations: it.rackAllocations?.map((a: any) => ({ gudangId: Number(a.gudangId), qty: Number(a.qty) })),
      })),
    };

    try {
      if (editPlanId !== null) {
        await api().put(`/inbound-planning/${editPlanId}`, payload);
        notifications.show({ title: "Sukses", message: "Planning Inbound berhasil diupdate", color: "green" });
      } else if (editDraftIndex !== null) {
        setPlanningDrafts((p) => p.map((d, i) => (i === editDraftIndex ? { ...payload, items: form.items } : d)));
        notifications.show({ title: "Sukses", message: "Draft Planning Inbound berhasil diupdate", color: "green" });
      } else {
        setPlanningDrafts((p) => [...p, { ...payload, items: form.items }]);
        notifications.show({ title: "Sukses", message: "Planning Inbound ditambahkan ke draft", color: "green" });
      }
      setEditPlanId(null);
      setEditDraftIndex(null);
      setForm({
        no_po: "",
        supplier: "",
        estimasi_datang: "",
        note: "",
        items: [],
      });
      setSelectedBarangId("");
      setItemQty(1);
      load();
    } catch (e: any) {
      notifications.show({
        title: "Error",
        message: unwrap(e.response)?.message || "Gagal menyimpan planning",
        color: "red",
      });
    }
  };

  const cancelEdit = () => {
    setEditPlanId(null);
    setEditDraftIndex(null);
    setForm({
      no_po: "",
      supplier: "",
      estimasi_datang: "",
      note: "",
      items: [],
    });
    setSelectedBarangId("");
    setItemQty(1);
  };

  const deletePlan = async (id: number) => {
    if (!confirm("Yakin ingin menghapus planning inbound ini?")) return;
    try {
      await api().delete(`/inbound-planning/${id}`);
      notifications.show({ title: "Sukses", message: "Planning Inbound berhasil dihapus", color: "green" });
      load();
    } catch (e: any) {
      notifications.show({
        title: "Error",
        message: unwrap(e.response)?.message || "Gagal menghapus planning",
        color: "red",
      });
    }
  };
  const publishDrafts = async () => {
    if (!planningDrafts.length) return;
    try {
      for (const draft of planningDrafts) {
        await api().post("/inbound-planning", {
          no_po: draft.no_po,
          supplier: draft.supplier,
          estimasi_datang: draft.estimasi_datang || undefined,
          note: draft.note,
          items: draft.items.map((it: any) => ({
            barangId: Number(it.barangId),
            qty: Number(it.qty),
            satuan: it.satuan || undefined,
            zone: it.zone || undefined,
            rackAllocations: it.rackAllocations?.map((a: any) => ({ gudangId: Number(a.gudangId), qty: Number(a.qty) })),
          })),
        });
      }
      notifications.show({ title: "Sukses", message: "Semua draft planning inbound berhasil diposting", color: "green" });
      setPlanningDrafts([]);
      load();
    } catch (e: any) {
      notifications.show({
        title: "Error",
        message: unwrap(e.response)?.message || "Gagal memposting draft planning",
        color: "red",
      });
    }
  };



  // Option lists
  const poOpts = Array.from(new Set(logs.map((l: any) => l.no_po).filter(Boolean)));
  const supplierOpts = customers.map((c: any) => c.nama || c.name).filter(Boolean);
  const barangOpts = dedup(barangs.map((b: any) => ({
    value: String(b.id),
    label: b.sku ? `[${b.kategori}] ${b.sku} - ${b.nama}` : `[${b.kategori}] ${b.nama}`,
  })));

  // Sort function
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

  const sortedPlans = [...plans].sort((a, b) => {
    if (!sortKey) return 0;
    let aVal = a[sortKey];
    let bVal = b[sortKey];

    if (aVal == null) aVal = "";
    if (bVal == null) bVal = "";

    if (typeof aVal === 'number' && typeof bVal === 'number') {
      return sortDir === 'asc' ? aVal - bVal : bVal - aVal;
    }
    const cmp = String(aVal).localeCompare(String(bVal), undefined, { numeric: true });
    return sortDir === 'asc' ? cmp : -cmp;
  });

  const filtered = sortedPlans.filter((p: any) => {
    const sLower = search.toLowerCase();
    const matchesSearch =
      !search ||
      p.no_po?.toLowerCase().includes(sLower) ||
      p.supplier?.toLowerCase().includes(sLower);

    const matchesStatus = statusFilter === "ALL" || p.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  return (
    <Box>
      <Box
        style={{
          background: "#fff",
          borderLeft: "4px solid #4f46e5",
          padding: "14px 20px",
          marginBottom: 16,
          boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
        }}
      >
        <Title order={4} style={{ color: "#111827", fontWeight: 800, display: "flex", alignItems: "center", gap: 8 }}>
          <IconBuildingWarehouse size={20} style={{ color: "#4f46e5" }} />
          PLANNING INBOUND
        </Title>
      </Box>

      <Box p="md">
        <Grid gutter="md">
          {/* Left Input Form */}
          <Grid.Col span={{ base: 12, md: 4, lg: 3 }}>
            <Paper withBorder p="md" radius="md" style={{ background: "#fff" }}>
              <Stack gap="xs">
                <Text fw={800} size="sm" c="indigo" mb={4} style={{ borderBottom: "1px solid #f1f5f9", paddingBottom: 4 }}>
                  {editPlanId !== null ? "EDIT PLANNING INBOUND" : "BUAT PLANNING INBOUND"}
                </Text>

                <Autocomplete
                  label="No PO / SJ"
                  size="xs"
                  placeholder="Masukkan No PO/SJ..."
                  required
                  data={poOpts}
                  value={form.no_po}
                  onChange={(v) => pf("no_po", v)}
                />

                <Autocomplete
                  label="Supplier (Master Customer)"
                  size="xs"
                  placeholder="Pilih Supplier..."
                  data={supplierOpts}
                  value={form.supplier}
                  onChange={(v) => pf("supplier", v)}
                />

                <Box style={{ border: "1px solid #e2e8f0", borderRadius: 6, padding: 8, marginTop: 4 }}>
                  <Text fw={700} size="xs" c="indigo" mb={4}>Sub-Draft Items</Text>

                  <Select
                    label="Pilih Barang"
                    size="xs"
                    placeholder="Pilih barang..."
                    searchable
                    data={barangOpts}
                    value={selectedBarangId}
                    onChange={(v) => setSelectedBarangId(v || "")}
                  />

                  <Select
                    label="Zone Gudang"
                    size="xs"
                    mt="xs"
                    placeholder="Pilih zone..."
                    searchable
                    data={zones}
                    value={selectedZone}
                    onChange={(v) => { setSelectedZone(v || ""); setSelectedRackIds([]); }}
                  />

                  {selectedZone && selectedBarangId && (
                    <MultiSelect
                      label="Pilih Beberapa Rak"
                      description="Urutan pilihan menentukan urutan pengisian"
                      size="xs"
                      mt="xs"
                      placeholder="Pilih rak sampai kapasitas cukup..."
                      searchable
                      clearable
                      data={rackOptions}
                      value={selectedRackIds}
                      onChange={setSelectedRackIds}
                    />
                  )}

                  <Group gap="xs" mt="xs" align="flex-end">
                    <NumberInput
                      label="Qty"
                      size="xs"
                      value={itemQty}
                      onChange={(v) => setItemQty(Number(v || 1))}
                      min={1}
                      style={{ flex: 1 }}
                    />
                    <Button size="xs" color="indigo" onClick={addItemToForm}>+ Tambah</Button>
                  </Group>

                  {form.items.length > 0 && (
                    <Box style={{ overflowX: "auto", marginTop: 8 }}>
                      <table style={{ width: "100%", fontSize: 10, borderCollapse: "collapse" }}>
                        <thead>
                          <tr style={{ background: "#f8f9fa", borderBottom: "1px solid #e2e8f0" }}>
                            <th style={{ textAlign: "left", padding: 4 }}>Barang</th>
                            <th style={{ textAlign: "right", padding: 4 }}>Qty</th>
                            <th style={{ textAlign: "center", padding: 4 }}>Aksi</th>
                          </tr>
                        </thead>
                        <tbody>
                          {form.items.map((it: any, idx: number) => (
                            <tr key={idx} style={{ borderBottom: "1px solid #f1f5f9" }}>
                              <td style={{ padding: 4 }}>
                                <div>{it._name}</div>
                                {it.rackAllocations?.map((a: any) => (
                                  <div key={a.gudangId} style={{ color: "#64748b", fontSize: 9 }}>
                                    {a.gudangName || `Rak #${a.gudangId}`}: {a.qty}
                                  </div>
                                ))}
                              </td>
                              <td style={{ padding: 4, textAlign: "right", fontWeight: 700 }}>{it.qty} {it.satuan}</td>
                              <td style={{ padding: 4, textAlign: "center" }}>
                                <ActionIcon size="xs" color="red" variant="subtle" onClick={() => removeItemFromForm(idx)}>
                                  <IconTrash size={12} />
                                </ActionIcon>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </Box>
                  )}
                </Box>

                <TextInput
                  label="Estimasi Kedatangan (ETA)"
                  size="xs"
                  type="datetime-local"
                  required
                  value={form.estimasi_datang}
                  onChange={(e) => pf("estimasi_datang", e.target.value)}
                />

                <TextInput
                  label="Keterangan"
                  size="xs"
                  placeholder="Catatan..."
                  value={form.note}
                  onChange={(e) => pf("note", e.target.value)}
                />

                <Group gap="xs" mt="xs">
                  <Button size="xs" color="indigo" style={{ flex: 1 }} onClick={submitPlanning} leftSection={<IconPlus size={14} />}>
                    {editPlanId !== null || editDraftIndex !== null ? "Update Planning Inbound" : "Simpan Planning Inbound"}
                  </Button>
                  {(editPlanId !== null || editDraftIndex !== null) && (
                    <Button
                      size="xs"
                      color="gray"
                      variant="outline"
                      onClick={cancelEdit}
                    >
                      Batal
                    </Button>
                  )}
                </Group>
              </Stack>
            </Paper>
          </Grid.Col>

          {/* Right: Riwayat */}
          <Grid.Col span={{ base: 12, md: 8, lg: 9 }}>
            <Stack gap="md">
              {/* Draft planning lokal */}
              {planningDrafts.length > 0 && (
                <Paper withBorder p="md" radius="md" style={{ background: "#fff" }}>
                  <Group justify="space-between" mb="xs">
                    <Text fw={850} size="sm" c="indigo">
                      DRAFT ANTRIAN PLANNING INBOUND ({planningDrafts.length})
                    </Text>
                    <Tooltip label={`Publish All Drafts (${planningDrafts.length})`}>
                      <ActionIcon
                        size="md"
                        color="green"
                        variant="filled"
                        onClick={publishDrafts}
                        radius="md"
                      >
                        <IconSend size={16} />
                      </ActionIcon>
                    </Tooltip>
                  </Group>

                  <Box style={{ overflowX: "auto" }}>
                    <Table withTableBorder withColumnBorders style={{ fontSize: 11 }}>
                      <Table.Thead style={{ background: "#eef2ff", borderBottom: "2px solid #c7d2fe" }}>
                        <Table.Tr>
                          <Table.Th style={{ color: "#3730a3", fontSize: 11 }}>No PO</Table.Th>
                          <Table.Th style={{ color: "#3730a3", fontSize: 11 }}>Supplier</Table.Th>
                          <Table.Th style={{ color: "#3730a3", fontSize: 11 }}>Items</Table.Th>
                          <Table.Th style={{ color: "#3730a3", fontSize: 11 }}>ETA</Table.Th>
                          <Table.Th style={{ color: "#3730a3", fontSize: 11 }}>Status</Table.Th>
                          <Table.Th style={{ color: "#3730a3", fontSize: 11 }}>Aksi</Table.Th>
                        </Table.Tr>
                      </Table.Thead>
                      <Table.Tbody>
                        {planningDrafts.map((d: any, i: number) => {
                          let etaStr = "-";
                          if (d.estimasi_datang) {
                            const dt = new Date(d.estimasi_datang);
                            etaStr = `${dt.toLocaleDateString("id-ID")} ${String(dt.getHours()).padStart(2, "0")}:${String(dt.getMinutes()).padStart(2, "0")}`;
                          }
                          return (
                            <Table.Tr key={`draft-${i}`}>
                              <Table.Td fw={700}>{d.no_po}</Table.Td>
                              <Table.Td>{d.supplier || "-"}</Table.Td>
                              <Table.Td style={{ padding: '4px 6px' }}>
                                <div style={{ maxHeight: 80, overflowY: 'auto' }}>
                                  {d.items?.map((item: any, idx: number) => {
                                    const name = item._name || `Barang #${item.barangId}`;
                                    return (
                                      <div key={idx} style={{ fontSize: 10, borderBottom: '1px solid #f1f5f9', padding: '1px 0', lineHeight: '1.3' }}>
                                        <span style={{ fontWeight: 600 }}>{name}</span> x{item.qty} {item.satuan || ''}
                                        {item.rackAllocations?.map((a: any) => (
                                          <span key={a.gudangId} style={{ color: "#64748b", fontSize: 9, display: 'block', paddingLeft: 8 }}>
                                            {a.gudangName || `Rak #${a.gudangId}`}: {a.qty}
                                          </span>
                                        ))}
                                      </div>
                                    );
                                  })}
                                </div>
                              </Table.Td>
                              <Table.Td style={{ fontSize: 10 }}>{etaStr}</Table.Td>
                              <Table.Td><Badge color="gray" variant="filled" size="xs">DRAFT</Badge></Table.Td>
                              <Table.Td>
                                <Group gap={2} wrap="nowrap">
                                  <Tooltip label="Edit">
                                    <ActionIcon size="sm" color="blue" variant="light" onClick={() => {
                                      setForm({
                                        no_po: d.no_po || "",
                                        supplier: d.supplier || "",
                                        estimasi_datang: d.estimasi_datang ? new Date(d.estimasi_datang).toISOString().slice(0, 16) : "",
                                        note: d.note || "",
                                        items: d.items || [],
                                      });
                                      setEditDraftIndex(i);
                                      setEditPlanId(null);
                                    }}>
                                      <IconEdit size={13} />
                                    </ActionIcon>
                                  </Tooltip>
                                  <Tooltip label="Hapus">
                                    <ActionIcon size="sm" color="red" variant="light" onClick={() => {
                                      setPlanningDrafts((p) => p.filter((_, j) => j !== i));
                                    }}>
                                      <IconTrash size={13} />
                                    </ActionIcon>
                                  </Tooltip>
                                </Group>
                              </Table.Td>
                            </Table.Tr>
                          );
                        })}
                      </Table.Tbody>
                    </Table>
                  </Box>
                </Paper>
              )}

              {/* Riwayat Planning Table */}
              <Paper withBorder p="md" radius="md" style={{ background: "#fff" }}>
                <Group justify="space-between" mb="xs">
                  <Group gap="xs">
                    <TextInput
                      placeholder="Cari PO, Supplier..."
                      size="xs"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      style={{ width: 220 }}
                    />
                    <Select
                      size="xs"
                      data={[
                        { value: "ALL", label: "Semua Status" },
                        { value: "WAIT", label: "WAIT" },
                        { value: "FAIL", label: "FAIL" },
                        { value: "DONE", label: "DONE" },
                      ]}
                      value={statusFilter}
                      onChange={(v) => setStatusFilter(v || "ALL")}
                      style={{ width: 130 }}
                    />
                  </Group>
                  <Button size="xs" variant="outline" color="indigo" onClick={load}>
                    Refresh Data
                  </Button>
                </Group>

                <Box style={{ overflowX: "auto" }}>
                  <Table withTableBorder withColumnBorders style={{ fontSize: 11 }}>
                    <Table.Thead style={{ background: "#eef2ff", borderBottom: "2px solid #c7d2fe" }}>
                      <Table.Tr>
                        <Table.Th style={{ color: "#3730a3", cursor: "pointer" }} onClick={() => handleSort('no_po')}>
                          No PO / SJ{sortIcon('no_po')}
                        </Table.Th>
                        <Table.Th style={{ color: "#3730a3", cursor: "pointer" }} onClick={() => handleSort('supplier')}>
                          Supplier{sortIcon('supplier')}
                        </Table.Th>
                        <Table.Th style={{ color: "#3730a3" }}>Items</Table.Th>
                        <Table.Th style={{ color: "#3730a3", cursor: "pointer" }} onClick={() => handleSort('estimasi_datang')}>
                          Timeline{sortIcon('estimasi_datang')}
                        </Table.Th>
                        <Table.Th style={{ color: "#3730a3", cursor: "pointer" }} onClick={() => handleSort('status')}>
                          Status{sortIcon('status')}
                        </Table.Th>
                        <Table.Th style={{ color: "#3730a3", cursor: "pointer" }} onClick={() => handleSort('note')}>
                          Keterangan{sortIcon('note')}
                        </Table.Th>
                        <Table.Th style={{ color: "#3730a3" }}>Aksi</Table.Th>
                      </Table.Tr>
                    </Table.Thead>
                    <Table.Tbody>
                      {sortedPlans.map((p: any) => {
                        let etaStr = "-";
                        if (p.estimasi_datang) {
                          const d = new Date(p.estimasi_datang);
                          etaStr = `${d.toLocaleDateString("id-ID")} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
                        }

                        let realStr = "-";
                        if (p.tanggal_realisasi) {
                          const d = new Date(p.tanggal_realisasi);
                          realStr = `${d.toLocaleDateString("id-ID")} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
                        }

                        let diffBadge = null;
                        if (p.status === "DONE" && p.selisih_menit !== null && p.selisih_menit !== undefined) {
                          const diff = p.selisih_menit;
                          if (diff > 0) {
                            diffBadge = <Badge color="red" size="xs" variant="light">+{diff}m</Badge>;
                          } else if (diff < 0) {
                            diffBadge = <Badge color="green" size="xs" variant="light">{diff}m</Badge>;
                          } else {
                            diffBadge = <Badge color="teal" size="xs" variant="light">Tepat</Badge>;
                          }
                        }

                        const badgeColor =
                          p.status === "DONE"
                            ? "green"
                            : p.status === "FAIL"
                            ? "red"
                            : "yellow";

                        return (
                          <Table.Tr key={p.id}>
                            <Table.Td fw={700}>{p.no_po}</Table.Td>
                            <Table.Td>{p.supplier || "-"}</Table.Td>
                            <Table.Td style={{ padding: '4px 6px' }}>
                              <div style={{ maxHeight: 80, overflowY: 'auto' }}>
                                {p.items?.map((item: any, idx: number) => {
                                  const bName = barangs.find((b: any) => b.id === item.barangId)?.nama || '-';
                                  return (
                                    <div key={idx} style={{ fontSize: 10, borderBottom: '1px solid #f1f5f9', padding: '1px 0', lineHeight: '1.3' }}>
                                      <span style={{ fontWeight: 600 }}>{bName}</span> x{item.qty} {item.satuan || ''}
                                      {item.rackAllocations?.map((a: any) => (
                                        <span key={a.gudangId} style={{ color: "#64748b", fontSize: 9, display: 'block', paddingLeft: 8 }}>
                                          {a.gudangName || `Rak #${a.gudangId}`}: {a.qty}
                                        </span>
                                      ))}
                                    </div>
                                  );
                                })}
                              </div>
                            </Table.Td>
                            <Table.Td style={{ fontSize: 10, padding: '4px 6px', verticalAlign: 'top' }}>
                              <div><span style={{ color: '#64748b' }}>ETA:</span> {etaStr}</div>
                              {realStr !== '-' && <div><span style={{ color: '#64748b' }}>Realisasi:</span> {realStr}</div>}
                              {diffBadge && <div style={{ marginTop: 2 }}>{diffBadge}</div>}
                              {realStr === '-' && etaStr === '-' && <span style={{ color: '#adb5bd' }}>-</span>}
                            </Table.Td>
                            <Table.Td>
                              <Badge color={badgeColor} variant="filled" size="xs">
                                {p.status}
                              </Badge>
                            </Table.Td>
                            <Table.Td>{p.note || "-"}</Table.Td>
                            <Table.Td>
                              {p.status === "WAIT" && (
                                <Group gap={2} wrap="nowrap">
                                  <Tooltip label="Edit">
                                    <ActionIcon
                                      size="sm"
                                      color="green"
                                      variant="light"
                                      onClick={() => {
                                        const mappedItems = p.items.map((it: any) => {
                                          const bObj = barangs.find((b: any) => b.id === it.barangId);
                                          return {
                                            barangId: it.barangId,
                                            qty: it.qty,
                                            _name: bObj ? bObj.nama : '-',
                                            satuan: it.satuan || bObj?.satuan || '',
                                            zone: it.zone || '',
                                            rackAllocations: it.rackAllocations || [],
                                          };
                                        });
                                        setForm({
                                          no_po: p.no_po,
                                          supplier: p.supplier || "",
                                          estimasi_datang: p.estimasi_datang ? new Date(p.estimasi_datang).toISOString().slice(0, 16) : "",
                                          note: p.note || "",
                                          items: mappedItems,
                                        });
                                        setEditPlanId(p.id);
                                        setEditDraftIndex(null);
                                      }}
                                    >
                                      <IconEdit size={13} />
                                    </ActionIcon>
                                  </Tooltip>
                                  <Tooltip label="Hapus">
                                    <ActionIcon
                                      size="sm"
                                      color="red"
                                      variant="light"
                                      onClick={() => deletePlan(p.id)}
                                    >
                                      <IconTrash size={13} />
                                    </ActionIcon>
                                  </Tooltip>
                                </Group>
                              )}
                            </Table.Td>
                          </Table.Tr>
                        );
                      })}
                      {filtered.length === 0 && (
                        <Table.Tr>
                          <Table.Td colSpan={7} align="center">
                            <Text size="xs" c="dimmed">
                              Tidak ada jadwal planning inbound.
                            </Text>
                          </Table.Td>
                        </Table.Tr>
                      )}
                    </Table.Tbody>
                  </Table>
                </Box>
                
                <Pagination page={page} totalPages={totalPages} total={total} onPageChange={setPage} />
              </Paper>
            </Stack>
          </Grid.Col>
        </Grid>
      </Box>
    </Box>
  );
}
