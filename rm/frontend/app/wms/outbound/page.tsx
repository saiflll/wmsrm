"use client";
// @ts-nocheck
import React, { useState, useEffect } from "react";
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
  Drawer,
  ActionIcon,
  Card,
  Grid,
  ThemeIcon,
  Tabs,
  Textarea,
  Divider,
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
  IconPrinter,
  IconSend,
  IconHistory,
  IconChevronRight,
} from "@tabler/icons-react";
import { notifications } from "@mantine/notifications";
import { api, unwrap, fmt } from "../lib/api";

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
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<string | null>("WAIT");
  const [sideFormOpen, setSideFormOpen] = useState(false);
  const [selectedPlanning, setSelectedPlanning] = useState<any>(null);
  const [splitRows, setSplitRows] = useState<any[]>([]);
  const [publishingId, setPublishingId] = useState<number | null>(null);

  useEffect(() => {
    load();
  }, [activeTab]);

  const load = async () => {
    setLoading(true);
    try {
      const [pRes, rRes, sRes] = await Promise.all([
        api().get(`/planning-outbound?status=${activeTab || ""}`),
        api().get("/gudang"),
        api().get("/shifts"),
      ]);
      setPlannings(unwrap(pRes));
      
      const allGudang = unwrap(rRes);
      const uniqueZones = Array.from(
        new Set(allGudang.map((g: any) => g.zone).filter(Boolean))
      ).map((z: any) => ({ value: z, label: z }));
      setZones(uniqueZones);
      setRacks(allGudang);
      setShifts(unwrap(sRes));
    } catch (e) {
      console.error("Load planning outbound failed", e);
    }
    setLoading(false);
  };

  const openSideForm = (planning: any) => {
    setSelectedPlanning(planning);
    
    // Load existing draft if in PROGRESS status
    if (planning.process_data?.items) {
      setSplitRows(
        planning.process_data.items.map((item: any, idx: number) => ({
          id: Date.now() + idx,
          barangId: item.barangId,
          qty: item.qty,
          tujuan: item.tujuan,
          gudangId: item.gudangId || null,
          zone: item.gudangId
            ? racks.find((r) => r.id === item.gudangId)?.zone || null
            : null,
          batch_no: item.batch_no || "",
          notes: "",
        }))
      );
    } else {
      // Initialize with one row for each planned item
      setSplitRows(
        planning.items?.map((item: any, idx: number) => ({
          id: Date.now() + idx,
          barangId: item.barangId,
          qty: item.qty,
          tujuan: "NORMAL",
          gudangId: item.gudangId || null,
          zone: item.gudangId
            ? racks.find((r) => r.id === item.gudangId)?.zone || null
            : null,
          batch_no: item.batch_no || "",
          notes: "",
        })) || []
      );
    }
    setSideFormOpen(true);
  };

  const closeSideForm = () => {
    setSideFormOpen(false);
    setSelectedPlanning(null);
    setSplitRows([]);
  };

  const addSplitRow = () => {
    if (!selectedPlanning?.items?.length) return;
    const firstItem = selectedPlanning.items[0];
    setSplitRows([
      ...splitRows,
      {
        id: Date.now(),
        barangId: firstItem.barangId,
        qty: 0,
        tujuan: "NORMAL",
        gudangId: null,
        zone: null,
        batch_no: "",
        notes: "",
      },
    ]);
  };

  const updateSplitRow = (id: number, field: string, value: any) => {
    setSplitRows((rows) =>
      rows.map((row) => {
        if (row.id !== id) return row;
        
        if (field === "zone") {
          return { ...row, zone: value, gudangId: null };
        }
        
        return { ...row, [field]: value };
      })
    );
  };

  const removeSplitRow = (id: number) => {
    setSplitRows((rows) => rows.filter((row) => row.id !== id));
  };

  const saveProcessDraft = async () => {
    if (!selectedPlanning) return;

    // Validation
    for (const row of splitRows) {
      if (!row.qty || row.qty <= 0) {
        return notifications.show({
          title: "Error",
          message: "Semua split row harus memiliki qty > 0",
          color: "red",
        });
      }
      if (["WASTE", "REJECT", "MISSING"].includes(row.tujuan) && !row.notes) {
        return notifications.show({
          title: "Error",
          message: `Notes wajib diisi untuk kategori ${row.tujuan}`,
          color: "red",
        });
      }
    }

    try {
      const payload: any = {
        items: splitRows.map((row) => ({
          barangId: row.barangId,
          qty: row.qty,
          tujuan: row.tujuan,
          gudangId: row.gudangId || undefined,
          batch_no: row.batch_no || undefined,
        })),
        keterangan: splitRows
          .filter((r) => r.notes)
          .map((r) => `${r.tujuan}: ${r.notes}`)
          .join("; "),
      };

      await api().post(`/planning-outbound/${selectedPlanning.id}/process`, payload);
      notifications.show({
        title: "Sukses",
        message: "Draft split processing berhasil disimpan",
        color: "green",
      });
      closeSideForm();
      load();
    } catch (e: any) {
      notifications.show({
        title: "Error",
        message: unwrap(e.response)?.message || "Gagal menyimpan draft",
        color: "red",
      });
    }
  };

  const publishPlanning = async (planningId: number) => {
    if (!confirm("Publish planning ini? Stok akan dideduct dan transaksi finalized."))
      return;

    setPublishingId(planningId);
    try {
      await api().post(`/planning-outbound/${planningId}/publish`, {
        keterangan: "Published from outbound page",
      });
      notifications.show({
        title: "Sukses",
        message: "Planning berhasil dipublish",
        color: "green",
      });
      load();
    } catch (e: any) {
      notifications.show({
        title: "Error",
        message: unwrap(e.response)?.message || "Gagal publish",
        color: "red",
      });
    }
    setPublishingId(null);
  };

  const deletePlanning = async (planningId: number) => {
    if (!confirm("Hapus planning ini?")) return;
    try {
      await api().delete(`/planning-outbound/${planningId}`);
      notifications.show({
        title: "Sukses",
        message: "Planning berhasil dihapus",
        color: "green",
      });
      load();
    } catch (e: any) {
      notifications.show({
        title: "Error",
        message: unwrap(e.response)?.message || "Gagal hapus",
        color: "red",
      });
    }
  };

  const filteredRacks = (zoneValue: string | null) => {
    if (!zoneValue) return [];
    return racks
      .filter((r) => r.zone === zoneValue)
      .map((r) => ({
        value: String(r.id),
        label: `${r.name} (${r.type || ""})`,
      }));
  };

  const statusColor = (status: string) => {
    if (status === "DONE") return "green";
    if (status === "PROGRESS") return "blue";
    if (status === "CANCEL") return "red";
    return "yellow";
  };

  const totalQty = selectedPlanning?.items?.reduce(
    (sum: number, item: any) => sum + (item.qty || 0),
    0
  ) || 0;

  const splitTotal = splitRows.reduce((sum, row) => sum + (row.qty || 0), 0);

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
            PLANNING OUTBOUND
          </Title>
          <Group gap="xs">
            <Button
              size="xs"
              color="blue"
              variant="outline"
              onClick={() => router.push("/wms/picking")}
              leftSection={<IconPlus size={14} />}
            >
              Buat Planning Baru
            </Button>
          </Group>
        </Group>
      </Box>

      {/* Main Content */}
      <Box p="md">
        <Paper withBorder p="md" radius="md" style={{ background: "#fff" }}>
          <Tabs value={activeTab} onChange={setActiveTab}>
            <Tabs.List>
              <Tabs.Tab value="WAIT" leftSection={<IconHistory size={14} />}>
                Menunggu
              </Tabs.Tab>
              <Tabs.Tab value="PROGRESS" leftSection={<IconEdit size={14} />}>
                Draft
              </Tabs.Tab>
              <Tabs.Tab value="DONE" leftSection={<IconCheck size={14} />}>
                Selesai
              </Tabs.Tab>
            </Tabs.List>

            <Tabs.Panel value={activeTab || "WAIT"} pt="md">
              {loading ? (
                <Group justify="center" py="xl">
                  <Loader size="sm" />
                </Group>
              ) : plannings.length === 0 ? (
                <Box
                  p="xl"
                  style={{
                    textAlign: "center",
                    border: "1px dashed #cbd5e1",
                    borderRadius: 8,
                  }}
                >
                  <Text c="dimmed" size="sm">
                    Tidak ada planning outbound di status ini
                  </Text>
                </Box>
              ) : (
                <Grid gutter="md">
                  {plannings.map((plan) => (
                    <Grid.Col key={plan.id} span={{ base: 12, md: 6, lg: 4 }}>
                      <Card
                        withBorder
                        p="md"
                        radius="md"
                        style={{
                          background: "#f8fafc",
                          cursor: "pointer",
                          transition: "all 0.2s",
                        }}
                        onClick={() => openSideForm(plan)}
                      >
                        <Group justify="space-between" mb="xs">
                          <Box>
                            <Group gap={6}>
                              <Badge size="sm" color="red" variant="filled">
                                {plan.no_ref || `#${plan.id}`}
                              </Badge>
                              <Badge
                                size="sm"
                                color={statusColor(plan.status)}
                                variant="light"
                              >
                                {plan.status}
                              </Badge>
                            </Group>
                            <Text size="xs" c="dimmed" mt={4}>
                              {fmt(plan.tanggal_planning)} • {plan.shift?.name || "-"}
                            </Text>
                          </Box>
                          <ActionIcon size="sm" color="blue" variant="light">
                            <IconChevronRight size={14} />
                          </ActionIcon>
                        </Group>

                        <Divider my="xs" />

                        <Stack gap={4}>
                          <Text size="xs" fw={600}>
                            Customer: {plan.customer?.nama || "-"}
                          </Text>
                          <Text size="xs" c="dimmed">
                            Tujuan: {plan.tujuan || "-"}
                          </Text>
                          <Text size="xs" c="dimmed">
                            Items: {plan.items?.length || 0} barang
                          </Text>
                        </Stack>

                        {plan.status === "PROGRESS" && (
                          <Button
                            fullWidth
                            size="xs"
                            color="green"
                            mt="md"
                            onClick={(e) => {
                              e.stopPropagation();
                              publishPlanning(plan.id);
                            }}
                            loading={publishingId === plan.id}
                            leftSection={<IconSend size={13} />}
                          >
                            Publish
                          </Button>
                        )}

                        {plan.status === "WAIT" && (
                          <Button
                            fullWidth
                            size="xs"
                            color="red"
                            variant="light"
                            mt="md"
                            onClick={(e) => {
                              e.stopPropagation();
                              deletePlanning(plan.id);
                            }}
                            leftSection={<IconTrash size={13} />}
                          >
                            Hapus
                          </Button>
                        )}
                      </Card>
                    </Grid.Col>
                  ))}
                </Grid>
              )}
            </Tabs.Panel>
          </Tabs>
        </Paper>
      </Box>

      {/* Side Form Drawer */}
      <Drawer
        opened={sideFormOpen}
        onClose={closeSideForm}
        position="right"
        size="xl"
        title={
          <Group gap="xs">
            <ThemeIcon color="blue" variant="light" size="lg">
              <IconEdit size={18} />
            </ThemeIcon>
            <Box>
              <Text fw={800} size="sm">
                SPLIT PROCESSING
              </Text>
              <Text size="xs" c="dimmed">
                {selectedPlanning?.no_ref || `#${selectedPlanning?.id}`}
              </Text>
            </Box>
          </Group>
        }
        overlayProps={{ opacity: 0.3, blur: 2 }}
      >
        {selectedPlanning && (
          <Stack gap="md">
            {/* Planning Details */}
            <Paper withBorder p="md" radius="md" style={{ background: "#f8fafc" }}>
              <Text fw={700} size="sm" mb="xs" c="blue">
                Detail Planning
              </Text>
              <Stack gap={4}>
                <Group justify="space-between">
                  <Text size="xs" c="dimmed">Customer:</Text>
                  <Text size="xs" fw={600}>{selectedPlanning.customer?.nama || "-"}</Text>
                </Group>
                <Group justify="space-between">
                  <Text size="xs" c="dimmed">Tanggal:</Text>
                  <Text size="xs" fw={600}>{fmt(selectedPlanning.tanggal_planning)}</Text>
                </Group>
                <Group justify="space-between">
                  <Text size="xs" c="dimmed">Shift:</Text>
                  <Text size="xs" fw={600}>{selectedPlanning.shift?.name || "-"}</Text>
                </Group>
                <Group justify="space-between">
                  <Text size="xs" c="dimmed">Tujuan:</Text>
                  <Text size="xs" fw={600}>{selectedPlanning.tujuan || "-"}</Text>
                </Group>
                <Group justify="space-between">
                  <Text size="xs" c="dimmed">Total Qty Planning:</Text>
                  <Text size="xs" fw={700} c="blue">{totalQty}</Text>
                </Group>
              </Stack>
            </Paper>

            {/* Split Items */}
            <Paper withBorder p="md" radius="md">
              <Group justify="space-between" mb="sm">
                <Text fw={700} size="sm">Split Items</Text>
                <Button
                  size="xs"
                  variant="light"
                  color="blue"
                  onClick={addSplitRow}
                  leftSection={<IconPlus size={13} />}
                >
                  Tambah Row
                </Button>
              </Group>

              <Stack gap="sm">
                {splitRows.map((row, idx) => (
                  <Card key={row.id} withBorder p="xs" radius="md">
                    <Group justify="space-between" mb="xs">
                      <Text size="xs" fw={700} c="dimmed">Split #{idx + 1}</Text>
                      <ActionIcon
                        size="xs"
                        color="red"
                        variant="light"
                        onClick={() => removeSplitRow(row.id)}
                      >
                        <IconTrash size={12} />
                      </ActionIcon>
                    </Group>

                    <Stack gap="xs">
                      <Select
                        label="Category"
                        size="xs"
                        data={CATEGORIES}
                        value={row.tujuan}
                        onChange={(v) => updateSplitRow(row.id, "tujuan", v)}
                        required
                      />

                      <NumberInput
                        label="Qty"
                        size="xs"
                        value={row.qty}
                        onChange={(v) => updateSplitRow(row.id, "qty", Number(v))}
                        min={0}
                        required
                      />

                      <Select
                        label="Zone"
                        size="xs"
                        data={zones}
                        value={row.zone}
                        onChange={(v) => updateSplitRow(row.id, "zone", v)}
                        placeholder="Pilih zone..."
                        clearable
                      />

                      {row.zone && (
                        <Select
                          label="Rack"
                          size="xs"
                          data={filteredRacks(row.zone)}
                          value={row.gudangId ? String(row.gudangId) : null}
                          onChange={(v) =>
                            updateSplitRow(row.id, "gudangId", v ? Number(v) : null)
                          }
                          placeholder="Pilih rack..."
                          clearable
                        />
                      )}

                      <TextInput
                        label="Batch No"
                        size="xs"
                        value={row.batch_no}
                        onChange={(e) => updateSplitRow(row.id, "batch_no", e.target.value)}
                        placeholder="Optional"
                      />

                      {["WASTE", "REJECT", "MISSING"].includes(row.tujuan) && (
                        <Textarea
                          label="Notes / Reason"
                          size="xs"
                          value={row.notes}
                          onChange={(e) => updateSplitRow(row.id, "notes", e.target.value)}
                          placeholder="Wajib diisi..."
                          required
                          minRows={2}
                        />
                      )}
                    </Stack>
                  </Card>
                ))}
              </Stack>

              {splitRows.length > 0 && (
                <Paper withBorder p="xs" mt="sm" style={{ background: "#fff9db" }}>
                  <Group justify="space-between">
                    <Text size="xs" fw={600}>Total Split Qty:</Text>
                    <Badge size="lg" color={splitTotal === totalQty ? "green" : "orange"}>
                      {splitTotal} / {totalQty}
                    </Badge>
                  </Group>
                </Paper>
              )}
            </Paper>

            {/* Action Buttons */}
            <Group justify="flex-end" gap="xs">
              <Button size="sm" variant="light" color="gray" onClick={closeSideForm}>
                Batal
              </Button>
              <Button
                size="sm"
                color="blue"
                onClick={saveProcessDraft}
                leftSection={<IconCheck size={14} />}
              >
                Simpan Draft
              </Button>
            </Group>
          </Stack>
        )}
      </Drawer>
    </Box>
  );
}
