"use client";
// @ts-nocheck
import React, { useState, useEffect, useRef } from "react";
import { Box, Group, Button, Title, Text, Badge, Paper, Stack, TextInput, Select, Autocomplete, Grid, ActionIcon, NumberInput } from "@mantine/core";
import { Table } from '../components/Table';
import {
  IconPlus,
  IconEdit,
  IconTrash,
  IconBuildingWarehouse,
} from "@tabler/icons-react";
import { notifications } from "@mantine/notifications";
import { useRouter } from "next/navigation";
import { api, unwrap } from "../lib/api";

export default function DriverPlanningPage() {
  const router = useRouter();
  const [plans, setPlans] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [logs, setLogs] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");

  // Draft system
  const [drafts, setDrafts] = useState<any[]>(() => {
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem("wms_driver_planning_drafts");
        if (saved) return JSON.parse(saved);
      } catch (e) {}
    }
    return [];
  });

  // Sort states
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  const [form, setForm] = useState<any>({
    no_po: "",
    driver_name: "",
    plat_nomor: "",
    supplier: "",
    qty: 0,
    estimasi_datang: "",
    status: "WAIT",
    note: "",
  });

  const [editDraftIdx, setEditDraftIdx] = useState<number | null>(null);

  const pf = (k: string, v: any) => setForm((p: any) => ({ ...p, [k]: v }));

  useEffect(() => {
    load();
  }, []);

  // Persist drafts to localStorage (skip initial render)
  const initialWrite = useRef(true);
  useEffect(() => {
    if (initialWrite.current) {
      initialWrite.current = false;
      return;
    }
    localStorage.setItem("wms_driver_planning_drafts", JSON.stringify(drafts));
  }, [drafts]);

  const load = async () => {
    try {
      const [pRes, cRes, lRes] = await Promise.all([
        api().get("/inbound-planning"),
        api().get("/customers"),
        api().get("/inventory/logs/inbound"),
      ]);
      setPlans(unwrap(pRes));
      setCustomers(unwrap(cRes));
      setLogs(unwrap(lRes));
    } catch (e) {
      console.error("Load planning inbound data failed:", e);
    }
  };

  const addDraft = () => {
    if (!form.no_po) {
      return notifications.show({ title: "Error", message: "No PO/SJ wajib diisi", color: "red" });
    }
    if (editDraftIdx !== null) {
      setDrafts((prev) => prev.map((d, i) => (i === editDraftIdx ? { ...d, ...form } : d)));
      setEditDraftIdx(null);
      notifications.show({ title: "Sukses", message: "Draft diupdate", color: "green" });
    } else {
      setDrafts((prev) => [...prev, { ...form, id: Date.now() }]);
      notifications.show({ title: "Sukses", message: "Draft ditambahkan", color: "green" });
    }
    setForm({
      no_po: "",
      driver_name: "",
      plat_nomor: "",
      supplier: "",
      qty: 0,
      estimasi_datang: "",
      status: "WAIT",
      note: "",
    });
  };

  const editDraft = (idx: number) => {
    const d = drafts[idx];
    setForm({
      no_po: d.no_po,
      driver_name: d.driver_name || "",
      plat_nomor: d.plat_nomor || "",
      supplier: d.supplier || "",
      qty: d.qty || 0,
      estimasi_datang: d.estimasi_datang || "",
      status: d.status || "WAIT",
      note: d.note || "",
    });
    setEditDraftIdx(idx);
  };

  const deleteDraft = (idx: number) => {
    setDrafts((prev) => prev.filter((_, i) => i !== idx));
  };

  const cancelEdit = () => {
    setEditDraftIdx(null);
    setForm({
      no_po: "",
      driver_name: "",
      plat_nomor: "",
      supplier: "",
      qty: 0,
      estimasi_datang: "",
      status: "WAIT",
      note: "",
    });
  };

  // Option lists
  const poOpts = Array.from(new Set(logs.map((l: any) => l.no_po).filter(Boolean)));
  const driverOpts = Array.from(new Set(plans.map((p: any) => p.driver_name).filter(Boolean)));
  const platOpts = Array.from(new Set(plans.map((p: any) => p.plat_nomor).filter(Boolean)));
  const supplierOpts = customers.map((c: any) => c.nama || c.name).filter(Boolean);

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
      p.driver_name?.toLowerCase().includes(sLower) ||
      p.plat_nomor?.toLowerCase().includes(sLower) ||
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
                  {editDraftIdx !== null ? "EDIT DRAFT PLANNING" : "TAMBAH DRAFT PLANNING"}
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
                  label="Nama Driver"
                  size="xs"
                  placeholder="Nama Driver..."
                  data={driverOpts}
                  value={form.driver_name}
                  onChange={(v) => pf("driver_name", v)}
                />

                <Autocomplete
                  label="Plat Nomor"
                  size="xs"
                  placeholder="B 1234 ABC..."
                  data={platOpts}
                  value={form.plat_nomor}
                  onChange={(v) => pf("plat_nomor", v)}
                />

                <Autocomplete
                  label="Supplier (Master Customer)"
                  size="xs"
                  placeholder="Pilih Supplier..."
                  data={supplierOpts}
                  value={form.supplier}
                  onChange={(v) => pf("supplier", v)}
                />

                <NumberInput
                  label="Qty Planning"
                  size="xs"
                  placeholder="Jumlah qty yang diplanning..."
                  value={form.qty}
                  onChange={(v) => pf("qty", Number(v))}
                  min={0}
                />

                <TextInput
                  label="Estimasi Kedatangan (ETA)"
                  size="xs"
                  type="datetime-local"
                  required
                  value={form.estimasi_datang}
                  onChange={(e) => pf("estimasi_datang", e.target.value)}
                />

                <Select
                  label="Status"
                  size="xs"
                  data={["WAIT", "FAIL", "DONE"]}
                  value={form.status}
                  onChange={(v) => pf("status", v || "WAIT")}
                />

                <TextInput
                  label="Keterangan"
                  size="xs"
                  placeholder="Catatan..."
                  value={form.note}
                  onChange={(e) => pf("note", e.target.value)}
                />

                <Group gap="xs" mt="xs">
                  <Button size="xs" color="indigo" style={{ flex: 1 }} onClick={addDraft} leftSection={<IconPlus size={14} />}>
                    + Tambahkan ke Draft
                  </Button>
                  {editDraftIdx !== null && (
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

          {/* Right: Drafts + Riwayat */}
          <Grid.Col span={{ base: 12, md: 8, lg: 9 }}>
            {/* Draft Table */}
            {drafts.length > 0 && (
              <Paper withBorder p="md" radius="md" mb="md" style={{ background: "#fff" }}>
                <Text fw={800} size="sm" c="indigo" mb="xs">
                  DRAFT PLANNING INBOUND ({drafts.length})
                </Text>
                <Box style={{ overflowX: "auto" }}>
                  <Table withTableBorder withColumnBorders style={{ fontSize: 11 }}>
                    <Table.Thead style={{ background: "#333" }}>
                      <Table.Tr>
                        {["No PO", "Driver", "Plat", "Supplier", "ETA", "Status", "Aksi"].map((h) => (
                          <Table.Th key={h} style={{ color: "#fff", fontSize: 11 }}>
                            {h}
                          </Table.Th>
                        ))}
                      </Table.Tr>
                    </Table.Thead>
                    <Table.Tbody>
                      {drafts.map((d: any, i: number) => {
                        let etaStr = "-";
                        if (d.estimasi_datang) {
                          const dt = new Date(d.estimasi_datang);
                          etaStr = `${dt.toLocaleDateString("id-ID")} ${String(dt.getHours()).padStart(2, "0")}:${String(dt.getMinutes()).padStart(2, "0")}`;
                        }
                        return (
                          <Table.Tr key={d.id || i}>
                            <Table.Td fw={700}>{d.no_po}</Table.Td>
                            <Table.Td fw={600}>{d.driver_name || "-"}</Table.Td>
                            <Table.Td>{d.plat_nomor || "-"}</Table.Td>
                            <Table.Td>{d.supplier || "-"}</Table.Td>
                            <Table.Td>{etaStr}</Table.Td>
                            <Table.Td>
                              <Badge
                                color={d.status === "DONE" ? "green" : d.status === "FAIL" ? "red" : "yellow"}
                                variant="filled"
                                size="xs"
                              >
                                {d.status || "WAIT"}
                              </Badge>
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
                                  onClick={() => deleteDraft(i)}
                                >
                                  <IconTrash size={13} />
                                </ActionIcon>
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
                    placeholder="Cari PO, Driver, Plat..."
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
                  <Table.Thead style={{ background: "#333" }}>
                    <Table.Tr>
                      <Table.Th style={{ color: "#fff", cursor: "pointer" }} onClick={() => handleSort('no_po')}>
                        No PO / SJ{sortIcon('no_po')}
                      </Table.Th>
                      <Table.Th style={{ color: "#fff", cursor: "pointer" }} onClick={() => handleSort('driver_name')}>
                        Nama Driver{sortIcon('driver_name')}
                      </Table.Th>
                      <Table.Th style={{ color: "#fff", cursor: "pointer" }} onClick={() => handleSort('plat_nomor')}>
                        Plat Nomor{sortIcon('plat_nomor')}
                      </Table.Th>
                      <Table.Th style={{ color: "#fff", cursor: "pointer" }} onClick={() => handleSort('supplier')}>
                        Supplier{sortIcon('supplier')}
                      </Table.Th>
                      <Table.Th style={{ color: "#fff", cursor: "pointer" }} onClick={() => handleSort('estimasi_datang')}>
                        Estimasi Datang (ETA){sortIcon('estimasi_datang')}
                      </Table.Th>
                      <Table.Th style={{ color: "#fff", cursor: "pointer" }} onClick={() => handleSort('tanggal_realisasi')}>
                        Waktu Realisasi{sortIcon('tanggal_realisasi')}
                      </Table.Th>
                      <Table.Th style={{ color: "#fff" }}>Selisih Punctuality</Table.Th>
                      <Table.Th style={{ color: "#fff" }}>Status</Table.Th>
                      <Table.Th style={{ color: "#fff" }}>Keterangan</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {filtered.map((p: any) => {
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
                          diffBadge = <Badge color="red" size="xs">Terlambat +{diff}m</Badge>;
                        } else if (diff < 0) {
                          diffBadge = <Badge color="green" size="xs">Cepat {diff}m</Badge>;
                        } else {
                          diffBadge = <Badge color="teal" size="xs">Tepat Waktu</Badge>;
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
                          <Table.Td fw={600}>{p.driver_name || "-"}</Table.Td>
                          <Table.Td>{p.plat_nomor || "-"}</Table.Td>
                          <Table.Td>{p.supplier || "-"}</Table.Td>
                          <Table.Td>{etaStr}</Table.Td>
                          <Table.Td>{realStr}</Table.Td>
                          <Table.Td>{diffBadge || "-"}</Table.Td>
                          <Table.Td>
                            <Badge color={badgeColor} variant="filled" size="xs">
                              {p.status}
                            </Badge>
                          </Table.Td>
                          <Table.Td>{p.note || "-"}</Table.Td>
                        </Table.Tr>
                      );
                    })}
                    {filtered.length === 0 && (
                      <Table.Tr>
                        <Table.Td colSpan={9} align="center">
                          <Text size="xs" c="dimmed">
                            Tidak ada jadwal planning inbound.
                          </Text>
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
