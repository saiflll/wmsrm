"use client";
// @ts-nocheck
import React, { useState, useEffect } from "react";
import { Box, Group, Button, Title, Text, Badge, Paper, Stack, TextInput, Select, Autocomplete, Grid, ActionIcon } from "@mantine/core";
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
  const [editPlanId, setEditPlanId] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");

  // Sort states
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  const [form, setForm] = useState<any>({
    no_po: "",
    driver_name: "",
    plat_nomor: "",
    supplier: "",
    estimasi_datang: "",
    status: "WAIT",
    note: "",
  });

  const pf = (k: string, v: any) => setForm((p: any) => ({ ...p, [k]: v }));

  useEffect(() => {
    load();
  }, []);

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
      console.error("Load driver planning data failed:", e);
    }
  };

  const savePlan = async () => {
    if (!form.no_po) {
      return notifications.show({ title: "Error", message: "No PO/SJ wajib diisi", color: "red" });
    }
    try {
      if (editPlanId) {
        await api().put(`/inbound-planning/${editPlanId}`, form);
        notifications.show({ title: "Sukses", message: "Planning berhasil diupdate", color: "green" });
      } else {
        await api().post("/inbound-planning", form);
        notifications.show({ title: "Sukses", message: "Planning berhasil disimpan", color: "green" });
      }
      setForm({
        no_po: "",
        driver_name: "",
        plat_nomor: "",
        supplier: "",
        estimasi_datang: "",
        status: "WAIT",
        note: "",
      });
      setEditPlanId(null);
      load();
    } catch (e: any) {
      notifications.show({ title: "Error", message: unwrap(e.response)?.message || "Gagal menyimpan", color: "red" });
    }
  };

  const deletePlan = async (id: number) => {
    if (!confirm("Hapus jadwal planning driver ini?")) return;
    try {
      await api().delete(`/inbound-planning/${id}`);
      notifications.show({ title: "Sukses", message: "Planning dihapus", color: "orange" });
      load();
    } catch (e) {
      console.error(e);
    }
  };

  const processInbound = (p: any) => {
    router.push(`/wms/inbound?no_po=${encodeURIComponent(p.no_po)}&supplier=${encodeURIComponent(p.supplier || "")}`);
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
          PLANNING DRIVER INBOUND
        </Title>
      </Box>

      <Box p="md">
        <Grid gutter="md">
          {/* Left Input Form */}
          <Grid.Col span={{ base: 12, md: 4, lg: 3 }}>
            <Paper withBorder p="md" radius="md" style={{ background: "#fff" }}>
              <Stack gap="xs">
                <Text fw={800} size="sm" c="indigo" mb={4} style={{ borderBottom: "1px solid #f1f5f9", paddingBottom: 4 }}>
                  {editPlanId ? "EDIT JADWAL DRIVER" : "TAMBAH JADWAL DRIVER"}
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
                  <Button size="xs" color="indigo" style={{ flex: 1 }} onClick={savePlan} leftSection={<IconPlus size={14} />}>
                    {editPlanId ? "Update" : "Simpan"}
                  </Button>
                  {editPlanId && (
                    <Button
                      size="xs"
                      color="gray"
                      variant="outline"
                      onClick={() => {
                        setEditPlanId(null);
                        setForm({
                          no_po: "",
                          driver_name: "",
                          plat_nomor: "",
                          supplier: "",
                          estimasi_datang: "",
                          status: "WAIT",
                          note: "",
                        });
                      }}
                    >
                      Batal
                    </Button>
                  )}
                </Group>
              </Stack>
            </Paper>
          </Grid.Col>

          {/* Right Schedule Table */}
          <Grid.Col span={{ base: 12, md: 8, lg: 9 }}>
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
                      <Table.Th style={{ color: "#fff" }}>Aksi</Table.Th>
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
                          <Table.Td>
                            <Group gap={4} wrap="nowrap">
                              {p.status !== "DONE" && (
                                <Button
                                  size="xs"
                                  color="blue"
                                  variant="light"
                                  onClick={() => processInbound(p)}
                                  style={{ padding: "0 6px", fontSize: 10 }}
                                >
                                  Proses Inbound
                                </Button>
                              )}
                              <ActionIcon
                                size="sm"
                                color="green"
                                variant="light"
                                onClick={() => {
                                  setEditPlanId(p.id);
                                  let dStr = "";
                                  if (p.estimasi_datang) {
                                    const d = new Date(p.estimasi_datang);
                                    const year = d.getFullYear();
                                    const month = String(d.getMonth() + 1).padStart(2, "0");
                                    const day = String(d.getDate()).padStart(2, "0");
                                    const hours = String(d.getHours()).padStart(2, "0");
                                    const minutes = String(d.getMinutes()).padStart(2, "0");
                                    dStr = `${year}-${month}-${day}T${hours}:${minutes}`;
                                  }
                                  setForm({
                                    no_po: p.no_po,
                                    driver_name: p.driver_name || "",
                                    plat_nomor: p.plat_nomor || "",
                                    supplier: p.supplier || "",
                                    estimasi_datang: dStr,
                                    status: p.status,
                                    note: p.note || "",
                                  });
                                }}
                              >
                                <IconEdit size={13} />
                              </ActionIcon>
                              <ActionIcon
                                size="sm"
                                color="red"
                                variant="light"
                                onClick={() => deletePlan(p.id)}
                              >
                                <IconTrash size={13} />
                              </ActionIcon>
                            </Group>
                          </Table.Td>
                        </Table.Tr>
                      );
                    })}
                    {filtered.length === 0 && (
                      <Table.Tr>
                        <Table.Td colSpan={10} align="center">
                          <Text size="xs" c="dimmed">
                            Tidak ada jadwal planning driver.
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
