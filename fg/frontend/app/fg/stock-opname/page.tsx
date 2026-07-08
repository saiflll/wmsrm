"use client";
import { useState, useEffect } from "react";
import { Title, Group, TextInput, Button, Stack, Select, Textarea, Text, Box, Badge, Modal, Loader, Paper, Tabs, FileInput, ActionIcon } from "@mantine/core";
import { Table } from '../components/Table';
import { useDisclosure } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";
import {
  IconMapPin,
  IconClipboardData,
  IconHistory,
  IconBuildingWarehouse,
  IconPrinter,
  IconChecklist,
  IconCheck,
  IconUpload,
  IconSend,
  IconCircleCheck,
  IconX,
  IconFileDownload,
} from "@tabler/icons-react";
import api from "../lib/api";

export default function StockOpnamePage() {
  const [stocks, setStocks] = useState<any[]>([]);
  const [rakList, setRakList] = useState<any[]>([]);
  const [log, setLog] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedStock, setSelectedStock] = useState("");
  const [lokasiBaru, setLokasiBaru] = useState("");
  const [statusBaru, setStatusBaru] = useState("");
  const [keterangan, setKeterangan] = useState("");
  const [opened, { open, close }] = useDisclosure(false);
  const [activeTab, setActiveTab] = useState<string | null>("update");
  const [sel, setSel] = useState<any>(null);
  const [user, setUser] = useState<any>(null);
  const [opnameList, setOpnameList] = useState<any[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [uploadOpnameId, setUploadOpnameId] = useState<number | null>(null);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadModal, setUploadModal] = useState(false);
  // Multi-select for Update Lokasi table
  const [updateSelectedIds, setUpdateSelectedIds] = useState<string[]>([]);
  const [updateBulkLokasi, setUpdateBulkLokasi] = useState("");
  const [updateBulkStatus, setUpdateBulkStatus] = useState("");

  // Stock opname form state
  const [opnameRows, setOpnameRows] = useState<any[]>([]);
  const [opnameFilterRak, setOpnameFilterRak] = useState("");
  const [opnameDate, setOpnameDate] = useState(
    new Date().toISOString().split("T")[0],
  );
  const [signedBy, setSignedBy] = useState({
    inventory: "",
    supervisor: "",
    admin: "",
  });

  const filteredOpnameRows = opnameFilterRak
    ? opnameRows.filter((s) => s.lokasiRak === opnameFilterRak)
    : opnameRows;

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tab = params.get("tab");
    if (tab) setActiveTab(tab);
    const stored = localStorage.getItem("fg_user");
    if (stored) setUser(JSON.parse(stored));
    load();
  }, []);

  const loadOpnameHistory = async () => {
    try {
      const res: any = await api.get("/stock-opname");
      setOpnameList(res || []);
    } catch { setOpnameList([]); }
  };

  const load = () => {
    setLoading(true);
    api
      .get("/stock?available=true")
      .then((res: any) => {
        const data = res || [];
        setStocks(data);
        setOpnameRows(
          data.map((s: any) => ({
            ...s,
            qtyActual: "",
            selisih: "",
            statusOpname: "",
          })),
        );
      })
      .catch(() => {});
    api
      .get("/master-rak")
      .then((res: any) => setRakList(res || []))
      .catch(() => {});
    api
      .get("/update-lokasi/log")
      .then((res: any) => setLog(res || []))
      .catch(() => {});
    setLoading(false);
  };

  const handleSubmitOpname = async () => {
    const items = opnameRows
      .filter((s) => s.qtyActual !== "")
      .map((s) => ({
        idStock: s.idStock,
        namaBarang: s.namaBarang,
        lokasiRak: s.lokasiRak,
        nomorBatch: s.nomorBatch || "",
        tanggalExpired: s.tanggalExpired || "",
        qtySistem: s.stockOnhand || 0,
        qtyActual: parseInt(s.qtyActual, 10) || 0,
        selisih: (parseInt(s.qtyActual, 10) || 0) - (s.stockOnhand || 0),
        statusOpname: s.statusOpname || "Tidak Sesuai",
      }));
    if (items.length === 0) {
      notifications.show({ title: "Error", message: "Isi qty actual minimal 1 item", color: "red" });
      return;
    }
    if (!signedBy.inventory || !signedBy.supervisor || !signedBy.admin) {
      notifications.show({ title: "Error", message: "Semua tanda tangan harus diisi", color: "red" });
      return;
    }
    setSubmitting(true);
    try {
      const res: any = await api.post("/stock-opname/submit", {
        tanggalOpname: opnameDate,
        diajukanOleh: user?.namaUser || user?.username || "",
        namaInventory: signedBy.inventory,
        namaSupervisor: signedBy.supervisor,
        namaAdmin: signedBy.admin,
        items,
      });
      notifications.show({ title: "Berhasil", message: `Opname #${res.id} diajukan`, color: "green" });
      setOpnameRows(stocks.map((s: any) => ({ ...s, qtyActual: "", selisih: "", statusOpname: "" })));
      loadOpnameHistory();
    } catch (err: any) {
      notifications.show({ title: "Gagal", message: err.response?.data?.message || "Error", color: "red" });
    } finally { setSubmitting(false); }
  };

  const handleUploadPdf = async () => {
    if (!uploadFile || !uploadOpnameId) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", uploadFile);
      const token = localStorage.getItem("fg_token");
      const res: any = await fetch(`/api/stock-opname/${uploadOpnameId}/upload-pdf`, {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
      }).then((r) => r.json());
      notifications.show({ title: "Upload Berhasil", message: "PDF tersimpan", color: "green" });
      setUploadModal(false);
      setUploadFile(null);
      loadOpnameHistory();
    } catch (err: any) {
      notifications.show({ title: "Gagal", message: err.message || "Error", color: "red" });
    } finally { setUploading(false); }
  };

  const handleApprove = async (id: number) => {
    try {
      const res: any = await api.post(`/stock-opname/${id}/approve`, {
        disetujuiOleh: user?.namaUser || user?.username || "",
      });
      notifications.show({ title: "Disetujui", message: `Opname #${id} disetujui, stok disesuaikan`, color: "green" });
      loadOpnameHistory();
      load();
    } catch (err: any) {
      notifications.show({ title: "Gagal", message: err.response?.data?.message || "Error", color: "red" });
    }
  };

  const handleReject = async (id: number) => {
    const catatan = prompt("Alasan ditolak:");
    if (catatan === null) return;
    try {
      await api.post(`/stock-opname/${id}/reject`, { catatan: catatan || "Ditolak" });
      notifications.show({ title: "Ditolak", message: `Opname #${id} ditolak`, color: "orange" });
      loadOpnameHistory();
    } catch (err: any) {
      notifications.show({ title: "Gagal", message: err.response?.data?.message || "Error", color: "red" });
    }
  };

  const isSpv = user?.role === "SUPERVISOR";

  const handleUpdate = async () => {
    try {
      await api.post("/update-lokasi", {
        idStock: selectedStock,
        lokasiBaru,
        statusBaru,
        picKoordinator: user?.namaUser || user?.username || "PIC",
        keterangan,
      });
      notifications.show({
        title: "Berhasil",
        message: "Lokasi berhasil diupdate",
        color: "green",
      });
      setSelectedStock("");
      setLokasiBaru("");
      setStatusBaru("");
      setKeterangan("");
      load();
    } catch (err: any) {
      notifications.show({
        title: "Gagal",
        message: err.response?.data?.message || "Error",
        color: "red",
      });
    }
  };

  // Group stocks by rak
  const byRak: Record<string, any[]> = {};
  stocks.forEach((s: any) => {
    const rak = s.lokasiRak || "Tanpa Rak";
    if (!byRak[rak]) byRak[rak] = [];
    byRak[rak].push(s);
  });

  const getRackColor = (rackName: string) => {
    const items = byRak[rackName] || [];
    if (items.length === 0) return { bg: "#9ca3af", text: "#fff" };
    const hasExpired = items.some(
      (s: any) => s.tanggalExpired && new Date(s.tanggalExpired) < new Date(),
    );
    if (hasExpired) return { bg: "#ef4444", text: "#fff" };
    const hasNearExp = items.some((s: any) => {
      if (!s.tanggalExpired) return false;
      const days =
        (new Date(s.tanggalExpired).getTime() - Date.now()) /
        (1000 * 60 * 60 * 24);
      return days < 30;
    });
    if (hasNearExp) return { bg: "#f97316", text: "#fff" };
    const hasAging = items.some((s: any) => {
      if (!s.tanggalProduksi) return false;
      const days =
        (Date.now() - new Date(s.tanggalProduksi).getTime()) /
        (1000 * 60 * 60 * 24);
      return days > 90;
    });
    if (hasAging) return { bg: "#eab308", text: "#fff" };
    return { bg: "#0ea5e9", text: "#fff" };
  };

  // Layout grid uses master rak list so empty racks still appear
  const sortedRaks = rakList.map((r: any) => r.lokasiRak).sort();

  // Split raks by type: DEDICATED vs FLOOR/GANGWAY (model from script.gs)
  const dedicatedRaks = sortedRaks.filter(
    (r) => !r.toUpperCase().startsWith("GANG") && !r.toUpperCase().startsWith("T-"),
  );
  const gangwayRaks = sortedRaks.filter(
    (r) => r.toUpperCase().startsWith("GANG") || r.toUpperCase().startsWith("T-"),
  );

  return (
    <Box>
      {/* Header */}
      <Box
        style={{
          background: "#fff",
          borderLeft: "4px solid #e6921e",
          padding: "14px 20px",
          marginBottom: 16,
          borderRadius: 8,
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
              <IconBuildingWarehouse size={20} style={{ color: "#e6921e" }} />
              UPDATE LOKASI / STOCK OPNAME
            </Title>
            <Text size="xs" c="dimmed" mt={2}>
              Pindah lokasi rak, ubah status stok, dan lihat layout gudang
              (DEDICATED / FLOOR).
            </Text>
          </Box>
          <Badge color="orange" variant="light" size="lg">
            Inventory Control
          </Badge>
        </Group>

        {/* Legend */}
        <Group mt="xs" gap={6}>
          <Box w={36} h={14} style={{ background: "#0ea5e9", borderRadius: 10 }} />
          <Text size="xs" fw={700}>TERISI</Text>
          <Box w={36} h={14} style={{ background: "#eab308", borderRadius: 10 }} />
          <Text size="xs" fw={700}>AGING (&gt;90 hari)</Text>
          <Box w={36} h={14} style={{ background: "#f97316", borderRadius: 10 }} />
          <Text size="xs" fw={700}>NEAR EXP</Text>
          <Box w={36} h={14} style={{ background: "#ef4444", borderRadius: 10 }} />
          <Text size="xs" fw={700}>EXPIRED</Text>
          <Box w={36} h={14} style={{ background: "#9ca3af", borderRadius: 10 }} />
          <Text size="xs" fw={700}>KOSONG</Text>
        </Group>
      </Box>

      <Tabs value={activeTab} onChange={(v) => { setActiveTab(v); if (v === "riwayat-opname") loadOpnameHistory(); }}>
        <Tabs.List mb="md">
          <Tabs.Tab value="update" leftSection={<IconMapPin size={15} />}>
            Update Lokasi
          </Tabs.Tab>
          <Tabs.Tab value="log" leftSection={<IconHistory size={15} />}>
            Log Update Lokasi
          </Tabs.Tab>
          <Tabs.Tab value="opname" leftSection={<IconChecklist size={15} />}>
            Form Stock Opname
          </Tabs.Tab>
          <Tabs.Tab value="riwayat-opname" leftSection={<IconHistory size={15} />}>
            Riwayat Opname
          </Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="update">
          {/* Form Update Single */}
          <Paper withBorder p="md" radius="md" mb="md">
            <Group gap={6} mb="xs" pb={4} style={{ borderBottom: "1px solid #f1f5f9" }}>
              <IconClipboardData size={15} style={{ color: "#e6921e" }} />
              <Text fw={700} size="sm">Update Lokasi & Status — Single Item</Text>
            </Group>
            <Stack>
              <Select
                size="xs"
                label="Pilih Stock"
                data={stocks.map((s: any) => ({
                  value: s.idStock,
                  label: `${s.lokasiRak || "-"} | ${s.namaBarang} | Qty: ${s.stockOnhand}`,
                }))}
                value={selectedStock}
                onChange={(v) => {
                  setSelectedStock(v || "");
                  const s = stocks.find((x: any) => x.idStock === v);
                  setLokasiBaru(s?.lokasiRak || "");
                }}
                searchable
                required
                placeholder="Cari ID stock..."
              />
              <Group grow>
                <Select
                  size="xs"
                  label="Lokasi Baru"
                  data={rakList.map((r: any) => ({ value: r.lokasiRak, label: r.lokasiRak }))}
                  value={lokasiBaru}
                  onChange={(v) => setLokasiBaru(v || "")}
                  searchable
                  required
                  placeholder="Cari rak..."
                />
                <Select
                  size="xs"
                  label="Status Baru"
                  data={["GOOD", "HOLD", "RELEASE", "REJECT"]}
                  value={statusBaru}
                  onChange={(v) => setStatusBaru(v || "")}
                  placeholder="Pilih status..."
                />
              </Group>
              <Textarea
                size="xs"
                label="Keterangan"
                value={keterangan}
                onChange={(e) => setKeterangan(e.currentTarget.value)}
                placeholder="Alasan update..."
                rows={2}
              />
              <Button
                size="xs"
                color="orange"
                leftSection={<IconClipboardData size={15} />}
                onClick={handleUpdate}
              >
                Update Lokasi
              </Button>
            </Stack>
          </Paper>

          {/* Multi-Select Update */}
          <Paper withBorder p="md" radius="md" mb="md">
            <Group gap={6} mb="xs" pb={4} style={{ borderBottom: "1px solid #f1f5f9" }}>
              <IconChecklist size={15} style={{ color: "#e6921e" }} />
              <Text fw={700} size="sm">Update Multi Item</Text>
            </Group>
            <Text size="xs" c="dimmed" mb="xs">Centang item, pilih lokasi/status baru, lalu Update.</Text>
            <Group grow mb="sm">
              <Select
                size="xs"
                label="Lokasi Baru"
                data={rakList.map((r: any) => ({ value: r.lokasiRak, label: r.lokasiRak }))}
                value={updateBulkLokasi}
                onChange={(v) => setUpdateBulkLokasi(v || "")}
                searchable
                placeholder="Kosongkan jika tidak pindah rak"
                clearable
              />
              <Select
                size="xs"
                label="Status Baru"
                data={["GOOD", "HOLD", "RELEASE", "REJECT"]}
                value={updateBulkStatus}
                onChange={(v) => setUpdateBulkStatus(v || "")}
                clearable
                placeholder="Biarkan sama"
              />
            </Group>
            <Box style={{ maxHeight: 300, overflow: "auto" }} mb="sm">
              <Table striped style={{ fontSize: 11 }}>
                <Table.Thead style={{ background: "#111827", position: "sticky", top: 0, zIndex: 1 }}>
                  <Table.Tr>
                    <Table.Th style={{ color: "#fff", fontSize: 11, width: 40 }}>
                      <input type="checkbox" checked={updateSelectedIds.length === stocks.length && stocks.length > 0}
                        onChange={(e) => { if (e.target.checked) setUpdateSelectedIds(stocks.map((s) => s.idStock)); else setUpdateSelectedIds([]); }} />
                    </Table.Th>
                    {["Stock ID", "Barang", "Rak", "Batch", "Qty", "Status"].map((h) => (
                      <Table.Th key={h} style={{ color: "#fff", fontSize: 11 }}>{h}</Table.Th>
                    ))}
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {stocks.length === 0 ? (
                    <Table.Tr><Table.Td colSpan={7} ta="center" c="dimmed" py="xl">Tidak ada stok.</Table.Td></Table.Tr>
                  ) : (
                    stocks.map((s: any) => (
                      <Table.Tr key={s.idStock} style={{ background: updateSelectedIds.includes(s.idStock) ? "#fff7ed" : undefined }}>
                        <Table.Td>
                          <input type="checkbox" checked={updateSelectedIds.includes(s.idStock)}
                            onChange={(e) => {
                              if (e.target.checked) setUpdateSelectedIds([...updateSelectedIds, s.idStock]);
                              else setUpdateSelectedIds(updateSelectedIds.filter((id) => id !== s.idStock));
                            }} />
                        </Table.Td>
                        <Table.Td><Badge size="xs" variant="light" color="gray">{s.idStock}</Badge></Table.Td>
                        <Table.Td fw={500}>{s.namaBarang}</Table.Td>
                        <Table.Td><Badge size="xs" variant="light" color="blue">{s.lokasiRak}</Badge></Table.Td>
                        <Table.Td>{s.nomorBatch}</Table.Td>
                        <Table.Td ta="right" fw={700}>{s.stockOnhand}</Table.Td>
                        <Table.Td><Badge size="xs" color={s.status === "GOOD" ? "green" : s.status === "HOLD" ? "yellow" : "red"}>{s.status}</Badge></Table.Td>
                      </Table.Tr>
                    ))
                  )}
                </Table.Tbody>
              </Table>
            </Box>
            <Text size="xs" c="dimmed" mb="xs">Terpilih: {updateSelectedIds.length} item</Text>
            <Button
              size="xs"
              color="orange"
              leftSection={<IconCheck size={14} />}
              disabled={updateSelectedIds.length === 0}
              onClick={async () => {
                const lokasi = updateBulkLokasi || undefined;
                try {
                  const res: any = await api.post("/update-lokasi/bulk", {
                    items: updateSelectedIds.map((id) => ({
                      idStock: id,
                      statusBaru: updateBulkStatus || undefined,
                      keterangan: "Update multi item",
                    })),
                    lokasiBaru: lokasi || "SAMA",
                    picKoordinator: user?.namaUser || user?.username || "PIC",
                  });
                  notifications.show({ title: "Update Selesai", message: res?.message || "", color: res?.failed ? "orange" : "green" });
                  setUpdateSelectedIds([]);
                  load();
                } catch (err: any) {
                  notifications.show({ title: "Gagal", message: err.response?.data?.message || "Error", color: "red" });
                }
              }}
            >
              Update Terpilih ({updateSelectedIds.length})
            </Button>
          </Paper>

          {/* Rack Layout Grid */}
          <Paper withBorder p="md" radius="md" mb="md">
            <Group gap={6} mb="md" pb={4} style={{ borderBottom: "1px solid #f1f5f9" }}>
              <IconBuildingWarehouse size={15} style={{ color: "#e6921e" }} />
              <Text fw={700} size="sm">Layout Rak — DEDICATED</Text>
            </Group>
            {loading ? (
              <Loader />
            ) : (
              <Stack>
                <Group gap="xs" style={{ flexWrap: "wrap" }}>
                  {dedicatedRaks.map((rak: string) => {
                    const { bg, text } = getRackColor(rak);
                    const items = byRak[rak] || [];
                    const totalQty = items.reduce(
                      (sum, s) => sum + (s.stockOnhand || 0),
                      0,
                    );
                    return (
                      <Box key={rak} style={{ position: "relative" }}>
                        <Button
                          radius="md"
                          style={{
                            background: bg,
                            color: text,
                            width: 90,
                            height: 36,
                            fontWeight: 800,
                            fontSize: 11,
                            padding: 0,
                          }}
                          onClick={() => {
                            setSel({ rak, items, totalQty });
                            setSelectedStock("");
                            open();
                          }}
                          title={items
                            .map((s: any) => `${s.namaBarang}: ${s.stockOnhand}`)
                            .join("\n")}
                        >
                          {rak}
                        </Button>
                        {totalQty > 0 && (
                          <Text
                            size="xs"
                            style={{
                              position: "absolute",
                              bottom: -14,
                              left: 0,
                              right: 0,
                              textAlign: "center",
                              fontSize: 9,
                              color: "#374151",
                              fontWeight: 600,
                            }}
                          >
                            {totalQty}
                          </Text>
                        )}
                      </Box>
                    );
                  })}
                </Group>

                {gangwayRaks.length > 0 && (
                  <>
                    <Text size="xs" fw={700} c="dimmed" mt="sm">
                      FLOOR / GANGWAY (tanpa kapasitas)
                    </Text>
                    <Group gap="xs" style={{ flexWrap: "wrap" }}>
                      {gangwayRaks.map((rak: string) => {
                        const { bg, text } = getRackColor(rak);
                        const items = byRak[rak] || [];
                        const totalQty = items.reduce(
                          (sum, s) => sum + (s.stockOnhand || 0),
                          0,
                        );
                        return (
                          <Box key={rak} style={{ position: "relative" }}>
                            <Button
                              radius="md"
                              style={{
                                background: bg,
                                color: text,
                                width: 90,
                                height: 36,
                                fontWeight: 800,
                                fontSize: 11,
                                padding: 0,
                                opacity: 0.7,
                              }}
                              onClick={() => {
                                setSel({ rak, items, totalQty });
                                setSelectedStock("");
                                open();
                              }}
                              title={items
                                .map((s: any) => `${s.namaBarang}: ${s.stockOnhand}`)
                                .join("\n")}
                            >
                              {rak}
                            </Button>
                          </Box>
                        );
                      })}
                    </Group>
                  </>
                )}
              </Stack>
            )}
          </Paper>
        </Tabs.Panel>

        <Tabs.Panel value="log">
          <Paper withBorder p="md" radius="md">
            <Group gap={6} mb="md" pb={4} style={{ borderBottom: "1px solid #f1f5f9" }}>
              <IconHistory size={15} style={{ color: "#e6921e" }} />
              <Text fw={700} size="sm">Riwayat Update Lokasi</Text>
            </Group>
            <Box style={{ maxHeight: 500, overflow: "auto" }}>
              <Table striped style={{ fontSize: 11 }}>
                <Table.Thead
                  style={{
                    background: "#111827",
                    position: "sticky",
                    top: 0,
                    zIndex: 1,
                  }}
                >
                  <Table.Tr>
                    {["Waktu", "Stock ID", "Barang", "Lokasi Lama", "Lokasi Baru", "User"].map(
                      (h) => (
                        <Table.Th key={h} style={{ color: "#fff", fontSize: 11 }}>
                          {h}
                        </Table.Th>
                      ),
                    )}
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {log.length === 0 ? (
                    <Table.Tr>
                      <Table.Td colSpan={6} ta="center" c="dimmed" py="xl">
                        Belum ada riwayat update.
                      </Table.Td>
                    </Table.Tr>
                  ) : (
                    log.map((l: any, i: number) => (
                      <Table.Tr key={i}>
                        <Table.Td>{l.timestampUpdate}</Table.Td>
                        <Table.Td>
                          <Badge size="xs" variant="light" color="gray">
                            {l.idStock}
                          </Badge>
                        </Table.Td>
                        <Table.Td fw={500}>{l.namaBarang}</Table.Td>
                        <Table.Td>
                          <Badge size="xs" variant="light" color="blue">
                            {l.lokasiLama}
                          </Badge>
                        </Table.Td>
                        <Table.Td>
                          <Badge size="xs" variant="light" color="green">
                            {l.lokasiBaru}
                          </Badge>
                        </Table.Td>
                        <Table.Td>{l.namaUserUpdate}</Table.Td>
                      </Table.Tr>
                    ))
                  )}
                </Table.Tbody>
              </Table>
            </Box>
          </Paper>
        </Tabs.Panel>

        <Tabs.Panel value="opname">
          <Paper withBorder p="md" radius="md" className="opname-print-area">
            <Group justify="space-between" mb="md">
              <Group gap={6}>
                <IconChecklist size={15} style={{ color: "#e6921e" }} />
                <Text fw={700} size="sm">
                  FORM STOCK OPNAME
                </Text>
              </Group>
              <Group>
                <TextInput
                  size="xs"
                  label="Tanggal Opname"
                  type="date"
                  value={opnameDate}
                  onChange={(e) => setOpnameDate(e.currentTarget.value)}
                />
                <Button
                  size="xs"
                  color="orange"
                  leftSection={<IconPrinter size={14} />}
                  onClick={() => window.print()}
                >
                  Cetak Form
                </Button>
              </Group>
            </Group>

            <Select
              size="xs"
              label="Filter Rak"
              placeholder="Semua Rak"
              data={rakList.map((r: any) => ({ value: r.lokasiRak, label: r.lokasiRak }))}
              value={opnameFilterRak}
              onChange={(v) => setOpnameFilterRak(v || "")}
              searchable
              clearable
              mb="sm"
            />

            <Text size="xs" c="dimmed" mb="sm">
              Isi qty actual, selisih akan dihitung otomatis. Status: Sesuai /
              Tidak Sesuai.
            </Text>

            <Box style={{ maxHeight: 500, overflow: "auto" }}>
              <Table striped style={{ fontSize: 10 }}>
                <Table.Thead
                  style={{
                    background: "#111827",
                    position: "sticky",
                    top: 0,
                    zIndex: 1,
                  }}
                >
                  <Table.Tr>
                    {[
                      "No",
                      "Rak",
                      "Barang",
                      "Batch",
                      "Exp",
                      "Qty Sistem",
                      "Qty Actual",
                      "Selisih",
                      "Status",
                    ].map((h) => (
                      <Table.Th
                        key={h}
                        style={{ color: "#fff", fontSize: 10 }}
                      >
                        {h}
                      </Table.Th>
                    ))}
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {filteredOpnameRows.length === 0 ? (
                    <Table.Tr>
                      <Table.Td colSpan={10} ta="center" c="dimmed" py="xl">
                        {opnameFilterRak ? "Tidak ada stock di rak ini." : "Tidak ada data stock."}
                      </Table.Td>
                    </Table.Tr>
                  ) : (
                    filteredOpnameRows.map((s: any, i: number) => {
                      const actual = parseInt(s.qtyActual, 10) || 0;
                      const system = s.stockOnhand || 0;
                      const selisih = actual - system;
                      return (
                        <Table.Tr key={i}>
                          <Table.Td>{i + 1}</Table.Td>
                          <Table.Td>
                            <Badge size="xs" variant="light" color="blue">
                              {s.lokasiRak}
                            </Badge>
                          </Table.Td>
                          <Table.Td fw={500} style={{ minWidth: 140 }}>
                            {s.namaBarang}
                          </Table.Td>
                          <Table.Td>{s.nomorBatch}</Table.Td>
                          <Table.Td>{s.tanggalExpired || "-"}</Table.Td>
                          <Table.Td ta="right" fw={700}>
                            {system}
                          </Table.Td>
                          <Table.Td style={{ padding: 2 }}>
                            <TextInput
                              size="xs"
                              style={{ width: 70 }}
                              value={s.qtyActual}
                              onChange={(e) => {
                                const v = e.currentTarget.value.replace(
                                  /[^0-9]/g,
                                  "",
                                );
                                const rows = [...opnameRows];
                                rows[i] = {
                                  ...rows[i],
                                  qtyActual: v,
                                  selisih: (parseInt(v || "0", 10) - system).toString(),
                                  statusOpname:
                                    parseInt(v || "0", 10) === system
                                      ? "Sesuai"
                                      : "Tidak Sesuai",
                                };
                                setOpnameRows(rows);
                              }}
                            />
                          </Table.Td>
                          <Table.Td ta="right" fw={700} c={selisih === 0 ? "green" : "red"}>
                            {selisih}
                          </Table.Td>
                          <Table.Td>
                            <Badge
                              size="xs"
                              color={s.statusOpname === "Sesuai" ? "green" : s.statusOpname ? "red" : "gray"}
                            >
                              {s.statusOpname || "-"}
                            </Badge>
                          </Table.Td>
                        </Table.Tr>
                      );
                    })
                  )}
                </Table.Tbody>
              </Table>
            </Box>

            {/* Signature area */}
            <Group grow mt="xl" className="signature-area">
              {[
                { key: "inventory", label: "Inventory" },
                { key: "supervisor", label: "Supervisor" },
                { key: "admin", label: "Admin" },
              ].map((role) => (
                <Box key={role.key} ta="center">
                  <TextInput
                    size="xs"
                    placeholder={`Nama ${role.label}`}
                    value={signedBy[role.key as keyof typeof signedBy]}
                    onChange={(e) =>
                      setSignedBy({
                        ...signedBy,
                        [role.key]: e.currentTarget.value,
                      })
                    }
                    mb="md"
                  />
                  <Box
                    style={{
                      borderTop: "1px solid #111827",
                      width: "80%",
                      margin: "0 auto",
                      paddingTop: 8,
                    }}
                  >
                    <Text size="xs" fw={700}>
                      {role.label}
                    </Text>
                    <Text size="xs" c="dimmed">
                      Tanda Tangan & Nama Jelas
                    </Text>
                  </Box>
                </Box>
              ))}
            </Group>

            <Group justify="flex-end" mt="lg">
              <Button
                size="xs"
                color="green"
                leftSection={<IconSend size={14} />}
                loading={submitting}
                onClick={handleSubmitOpname}
              >
                Ajukan Opname
              </Button>
            </Group>
          </Paper>
        </Tabs.Panel>

        <Tabs.Panel value="riwayat-opname">
          <Paper withBorder p="md" radius="md">
            <Group gap={6} mb="md" pb={4} style={{ borderBottom: "1px solid #f1f5f9" }}>
              <IconHistory size={15} style={{ color: "#e6921e" }} />
              <Text fw={700} size="sm">Riwayat Stock Opname</Text>
            </Group>
            <Button size="xs" variant="light" mb="sm" onClick={loadOpnameHistory}>Muat Ulang</Button>
            <Box style={{ maxHeight: 600, overflow: "auto" }}>
              <Table striped style={{ fontSize: 11 }}>
                <Table.Thead style={{ background: "#111827", position: "sticky", top: 0, zIndex: 1 }}>
                  <Table.Tr>
                    {["#", "Tanggal", "Diajukan", "Inventory", "Supervisor", "Admin", "Status", "PDF", "Aksi"].map((h) => (
                      <Table.Th key={h} style={{ color: "#fff", fontSize: 11 }}>{h}</Table.Th>
                    ))}
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {opnameList.length === 0 ? (
                    <Table.Tr><Table.Td colSpan={9} ta="center" c="dimmed" py="xl">Belum ada opname.</Table.Td></Table.Tr>
                  ) : (
                    opnameList.map((o: any) => (
                      <Table.Tr key={o.id}>
                        <Table.Td fw={700}>{o.id}</Table.Td>
                        <Table.Td>{o.tanggalOpname}</Table.Td>
                        <Table.Td>{o.diajukanOleh}</Table.Td>
                        <Table.Td>{o.namaInventory}</Table.Td>
                        <Table.Td>{o.namaSupervisor}</Table.Td>
                        <Table.Td>{o.namaAdmin}</Table.Td>
                        <Table.Td>
                          <Badge size="xs" color={o.status === "DISETUJUI" ? "green" : o.status === "DITOLAK" ? "red" : "yellow"}>
                            {o.status}
                          </Badge>
                        </Table.Td>
                        <Table.Td>
                          {o.pdfPath ? (
                            <Badge size="xs" color="green" leftSection={<IconCheck size={10} />}>Ada</Badge>
                          ) : (
                            <Badge size="xs" color="gray">Tidak</Badge>
                          )}
                        </Table.Td>
                        <Table.Td>
                          <Group gap={4}>
                            {o.status === "MENUNGGU" && (
                              <>
                                {isSpv && (
                                  <>
                                    <ActionIcon size="sm" color="green" variant="light" onClick={() => handleApprove(o.id)}>
                                      <IconCircleCheck size={14} />
                                    </ActionIcon>
                                    <ActionIcon size="sm" color="red" variant="light" onClick={() => handleReject(o.id)}>
                                      <IconX size={14} />
                                    </ActionIcon>
                                  </>
                                )}
                                <ActionIcon size="sm" color="blue" variant="light" onClick={() => { setUploadOpnameId(o.id); setUploadModal(true); }}>
                                  <IconUpload size={14} />
                                </ActionIcon>
                              </>
                            )}
                            {o.pdfPath && (
                              <ActionIcon size="sm" color="gray" variant="light" component="a" href={`/api/stock-opname/pdf/${o.pdfPath}`} target="_blank">
                                <IconFileDownload size={14} />
                              </ActionIcon>
                            )}
                          </Group>
                        </Table.Td>
                      </Table.Tr>
                    ))
                  )}
                </Table.Tbody>
              </Table>
            </Box>
          </Paper>
        </Tabs.Panel>
      </Tabs>

      {/* Upload PDF Modal */}
      <Modal opened={uploadModal} onClose={() => { setUploadModal(false); setUploadFile(null); }} title="Upload PDF Bertanda Tangan" centered size="sm">
        <Stack>
          <Text size="sm">Unggah hasil scan form opname yang sudah ditandatangani.</Text>
          <FileInput
            size="sm"
            label="File PDF"
            placeholder="Pilih file PDF..."
            accept="application/pdf"
            value={uploadFile}
            onChange={setUploadFile}
            required
          />
          <Button
            size="xs"
            color="blue"
            leftSection={<IconUpload size={14} />}
            loading={uploading}
            disabled={!uploadFile}
            onClick={handleUploadPdf}
          >
            Upload
          </Button>
        </Stack>
      </Modal>

      {/* Detail Rak Modal */}
      <Modal
        opened={opened}
        onClose={close}
        title={<Text fw={900}>Detail Rak: {sel?.rak}</Text>}
        centered
        size="sm"
      >
        {sel && (
          <Stack gap="xs">
            {sel.items.map((s: any, i: number) => (
              <Box
                key={i}
                style={{
                  background: "#f8f9fa",
                  borderRadius: 8,
                  padding: "8px 12px",
                }}
              >
                <Text size="sm" fw={700}>
                  {s.namaBarang}
                </Text>
                <Group gap="xl">
                  <Text size="xs" c="dimmed">
                    Batch: {s.nomorBatch || "-"}
                  </Text>
                  <Text size="xs" c="dimmed">
                    Exp: {s.tanggalExpired || "-"}
                  </Text>
                </Group>
                <Group gap="xl">
                  <Text size="xs" fw={600}>
                    Qty: {s.stockOnhand}
                  </Text>
                  <Text size="xs">
                    Status:{" "}
                    <Badge
                      size="xs"
                      color={
                        s.status === "GOOD"
                          ? "green"
                          : s.status === "HOLD"
                            ? "yellow"
                            : "gray"
                      }
                    >
                      {s.status}
                    </Badge>
                  </Text>
                </Group>
              </Box>
            ))}
            <Text size="sm" fw={700} ta="right">
              Total Qty: {sel.totalQty}
            </Text>
          </Stack>
        )}
      </Modal>
    </Box>
  );
}
