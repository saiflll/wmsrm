"use client";
import { useState, useEffect } from "react";
import {
  Title,
  Card,
  TextInput,
  Select,
  Button,
  Stack,
  Group,
  Table,
  Text,
  NumberInput,
  Textarea,
  Badge,
  Box,
  Paper,
  Modal,
  Tabs,
  Grid,
  ActionIcon,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";
import {
  IconPackage,
  IconFileText,
  IconStack2,
  IconPlus,
  IconTrash,
  IconCheck,
  IconHistory,
  IconBuildingWarehouse,
  IconClock,
  IconClockHour4,
  IconRotate,
} from "@tabler/icons-react";
import api from "../lib/api";

export default function BarangMasukPage() {
  const [form, setForm] = useState<any>({
    tanggalBstb: "",
    tanggalProduksi: "",
    namaBarang: "",
    satuan: "Carton",
    status: "GOOD",
    shiftIn: "",
    nomorBstb: "",
    nomorITKirim: "",
    keterangan: "",
    waktuMasukCS: "",
    batches: [{ nomorBatch: "", qty: 0, lokasiRak: "" }],
  });
  const [barangList, setBarangList] = useState<any[]>([]);
  const [barangFullData, setBarangFullData] = useState<any[]>([]);
  const [jamIn, setJamIn] = useState("");
  const [rakFullData, setRakFullData] = useState<any[]>([]);
  const [statusList, setStatusList] = useState<any[]>([]);
  const [koordinatorList, setKoordinatorList] = useState<any[]>([]);
  const [history, setHistory] = useState<any[]>([]);
  const [stocks, setStocks] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<string | null>("stock");
  const [bmStockSortKey, setBmStockSortKey] = useState<string | null>(null);
  const [bmStockSortDir, setBmStockSortDir] = useState<"asc" | "desc">("asc");
  const [bmHistSortKey, setBmHistSortKey] = useState<string | null>(null);
  const [bmHistSortDir, setBmHistSortDir] = useState<"asc" | "desc">("asc");

  const sortData = (data: any[], key: string | null, dir: "asc" | "desc") => {
    if (!key) return data;
    return [...data].sort((a, b) => {
      let aVal = a[key];
      let bVal = b[key];
      if (aVal == null) aVal = "";
      if (bVal == null) bVal = "";
      if (typeof aVal === "number" && typeof bVal === "number") {
        return dir === "asc" ? aVal - bVal : bVal - aVal;
      }
      const cmp = String(aVal).localeCompare(String(bVal), undefined, { numeric: true });
      return dir === "asc" ? cmp : -cmp;
    });
  };

  const toggleSort = (
    key: string,
    curKey: string | null,
    curDir: "asc" | "desc",
    setKey: (k: string | null) => void,
    setDir: (d: "asc" | "desc") => void,
  ) => {
    if (curKey === key) {
      setDir(curDir === "asc" ? "desc" : "asc");
    } else {
      setKey(key);
      setDir("asc");
    }
  };

  const sortIcon = (key: string, curKey: string | null, curDir: "asc" | "desc") => {
    if (curKey !== key) return " ↕";
    return curDir === "asc" ? " ▲" : " ▼";
  };

  const bmStockColumns = [
    { label: "Lokasi Rak", key: "lokasiRak" },
    { label: "Barang", key: "namaBarang" },
    { label: "Batch", key: "nomorBatch" },
    { label: "Qty", key: "stockOnhand" },
    { label: "Exp", key: "tanggalExpired" },
    { label: "Status", key: "status" },
  ];

  const bmHistColumns = [
    { label: "Tgl BSTB", key: "tanggalBstb" },
    { label: "Barang", key: "namaBarang" },
    { label: "Qty", key: "totalQty" },
    { label: "Rak", key: "lokasiRak" },
    { label: "Batch", key: "nomorBatch" },
    { label: "Shift", key: "shiftIn" },
    { label: "User", key: "namaUserTransaksi" },
  ];
  const [confirmOpened, { open: co, close: cc }] = useDisclosure(false);
  const [lastOutMap, setLastOutMap] = useState<Record<number, any>>({});
  const [noticeOpened, { open: openNotice, close: closeNotice }] = useDisclosure(false);
  const [noticeData, setNoticeData] = useState<any>(null);

  useEffect(() => {
    loadData();
    const tick = () => {
      const now = new Date();
      setJamIn(
        now.toLocaleTimeString("id-ID", { timeZone: "Asia/Jakarta" }),
      );
    };
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, []);

  const loadData = () => {
    api
      .get("/master-barang")
      .then((r: any) => {
        setBarangList(r || []);
        setBarangFullData(r || []);
      })
      .catch(() => {});
    api
      .get("/master-rak")
      .then((r: any) => setRakFullData(r || []))
      .catch(() => {});
    api
      .get("/master-status")
      .then((r: any) => setStatusList((r || []).map((s: any) => s.status)))
      .catch(() => {});
    api
      .get("/users/koordinator-in")
      .then((r: any) => {
        setKoordinatorList(
          (r || []).map((u: any) => ({
            value: `${u.namaUser} - ${u.shift}`,
            label: `${u.namaUser} - ${u.shift}`,
          })),
        );
      })
      .catch(() => {});
    api
      .get("/barang-masuk")
      .then((r: any) => setHistory(r || []))
      .catch(() => {});
    api
      .get("/stock?available=true")
      .then((r: any) => setStocks(r || []))
      .catch(() => {});
  };

  const [tanggalExpiredPreview, setTanggalExpiredPreview] = useState("");

  const calculateExpired = (nmBrg: string, tglProd: string) => {
    if (!nmBrg || !tglProd) {
      setTanggalExpiredPreview("");
      return;
    }
    const barang = barangFullData.find((b: any) => b.nama === nmBrg);
    const bulan = barang?.umurExpiredBulan || 0;
    if (bulan <= 0) {
      setTanggalExpiredPreview("");
      return;
    }
    const d = new Date(tglProd);
    d.setMonth(d.getMonth() + bulan);
    setTanggalExpiredPreview(d.toISOString().split("T")[0]);
  };

  const f = (k: string, v: any) => {
    setForm({ ...form, [k]: v });
    if (k === "namaBarang" || k === "tanggalProduksi") {
      const nm = k === "namaBarang" ? v : form.namaBarang;
      const tp = k === "tanggalProduksi" ? v : form.tanggalProduksi;
      calculateExpired(nm, tp);
    }
  };

  // Format input sebagai mm:ss (menit:detik)
  const formatMMSS = (val: string) => {
    const raw = val.replace(/[^0-9]/g, "").slice(0, 4);
    if (raw.length <= 2) return raw;
    const mm = parseInt(raw.slice(0, 2), 10);
    const ss = parseInt(raw.slice(2), 10);
    const mmStr = Math.min(mm, 99).toString().padStart(2, "0");
    const ssStr = Math.min(ss, 59).toString().padStart(2, "0");
    return `${mmStr}:${ssStr}`;
  };
  const ub = (i: number, k: string, v: any) => {
    const b = [...form.batches];
    b[i] = { ...b[i], [k]: v };
    setForm({ ...form, batches: b });

    if (k === "lokasiRak" && v) {
      api
        .get(`/master-rak/last-out/${encodeURIComponent(v)}`)
        .then((res: any) => {
          setLastOutMap((prev) => ({ ...prev, [i]: res?.info || null }));
        })
        .catch(() => {
          setLastOutMap((prev) => ({ ...prev, [i]: null }));
        });
    }
  };
  const addB = () =>
    setForm({
      ...form,
      batches: [...form.batches, { nomorBatch: "", qty: 0, lokasiRak: "" }],
    });
  const delB = (i: number) =>
    setForm({
      ...form,
      batches: form.batches.filter((_: any, j: number) => j !== i),
    });

  const stockByRak: Record<string, any[]> = {};
  stocks.forEach((s: any) => {
    const r = s.lokasiRak || "-";
    if (!stockByRak[r]) stockByRak[r] = [];
    stockByRak[r].push(s);
  });

  const rakOpts = (rakFullData || []).map((rd: any) => {
    const inRack = stockByRak[rd.lokasiRak] || [];
    const qty = inRack.reduce(
      (a: number, s: any) => a + (s.stockOnhand || 0),
      0,
    );
    const prod = [...new Set(inRack.map((s: any) => s.namaBarang))].join(", ");
    const batches = [...new Set(inRack.map((s: any) => s.nomorBatch).filter(Boolean))].join(", ");
    const tglProd = [...new Set(inRack.map((s: any) => s.tanggalProduksi).filter(Boolean))].join(", ");
    const kap = rd.kapasitasRak || 0;
    const isFloor = rd.jenisRak === "FLOOR" || rd.jenisRak === "GANGWAY";
    const full = !isFloor && kap > 0 && qty >= kap;
    const extra = [
      prod,
      batches ? `Batch: ${batches}` : "",
      tglProd ? `Prod: ${tglProd}` : "",
      qty > 0 ? `${qty}${kap > 0 ? "/" + kap : ""}` : "",
    ].filter(Boolean).join(" | ");
    return {
      value: rd.lokasiRak,
      label: `${rd.lokasiRak}${extra ? ` — ${extra}` : kap > 0 ? ` (KOSONG, Kap:${kap})` : " (KOSONG)"}`,
      disabled: full,
    };
  });

  const isValidMMSS = (val: string) => /^\d{2}:\d{2}$/.test(val);

  const doSubmit = async (confirmed = false, noticeKeyData?: string, noticeMessage?: string) => {
    if (form.waktuMasukCS && !isValidMMSS(form.waktuMasukCS)) {
      notifications.show({
        title: "Validasi",
        message: "Waktu Masuk CS harus format mm:ss (contoh: 12:30)",
        color: "red",
      });
      return;
    }
    try {
      const payload: any = { ...form };
      if (confirmed) {
        payload.noticeConfirmed = true;
        payload.noticeKeyData = noticeKeyData;
        payload.noticeMessage = noticeMessage;
      }
      const res = await api.post("/barang-masuk", payload);
      notifications.show({
        title: "Barang Masuk Berhasil",
        message: (res as any)?.message || "Tersimpan",
        color: "green",
      });
      setForm({
        tanggalBstb: "",
        tanggalProduksi: "",
        namaBarang: "",
        satuan: "Carton",
        status: "GOOD",
        shiftIn: "",
        nomorBstb: "",
        nomorITKirim: "",
        keterangan: "",
        waktuMasukCS: "",
        batches: [{ nomorBatch: "", qty: 0, lokasiRak: "" }],
      });
      setTanggalExpiredPreview("");
      cc();
      closeNotice();
      loadData();
    } catch (err: any) {
      notifications.show({
        title: "Gagal",
        message: err.response?.data?.message || "Error",
        color: "red",
      });
    }
  };

  const handleSubmit = async () => {
    try {
      const noticeRes: any = await api.post("/barang-masuk/check-notice", form);
      if (noticeRes?.hasNotice) {
        setNoticeData(noticeRes);
        openNotice();
        return;
      }
    } catch (err: any) {
      // Jika check-notice gagal, tetap lanjut submit agar tidak blokir
    }
    await doSubmit();
  };

  const handleRollback = async (id: number) => {
    if (!confirm("Yakin rollback transaksi barang masuk ini? Stock akan dikembalikan.")) return;
    try {
      const res: any = await api.delete(`/barang-masuk/${id}/rollback`);
      notifications.show({
        title: "Rollback Berhasil",
        message: res?.message || "Transaksi dibatalkan",
        color: "green",
      });
      loadData();
    } catch (err: any) {
      notifications.show({
        title: "Gagal",
        message: err.response?.data?.message || "Error",
        color: "red",
      });
    }
  };

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
              BARANG MASUK (INBOUND)
            </Title>
            <Text size="xs" c="dimmed" mt={2}>
              Manajemen penerimaan barang, pencatatan batch produksi, dan
              alokasi rak penyimpanan.
            </Text>
          </Box>
          <Badge color="orange" variant="light" size="lg">
            Inbound Operations
          </Badge>
        </Group>
      </Box>

      <Grid>
        {/* LEFT: Form */}
        <Grid.Col span={{ base: 12, xl: 5 }}>
          <Paper withBorder p="md" radius="md">
            <Stack gap="md">
              {/* Section 1: Dokumen */}
              <Box>
                <Group
                  gap={6}
                  mb="xs"
                  pb={4}
                  style={{ borderBottom: "1px solid #f1f5f9" }}
                >
                  <IconFileText size={15} style={{ color: "#e6921e" }} />
                  <Text fw={700} size="sm">
                    Informasi Dokumen BSTB
                  </Text>
                </Group>
                <Group grow>
                  <TextInput
                    size="xs"
                    label="Nomor BSTB"
                    placeholder="BSTB-001"
                    value={form.nomorBstb || ""}
                    onChange={(e) => f("nomorBstb", e.currentTarget.value)}
                    required
                  />
                  <TextInput
                    size="xs"
                    label="Nomor IT Kirim"
                    placeholder="Opsional"
                    value={form.nomorITKirim || ""}
                    onChange={(e) => f("nomorITKirim", e.currentTarget.value)}
                  />
                </Group>
                <Group grow mt="xs">
                  <TextInput
                    size="xs"
                    label="Tanggal BSTB"
                    type="date"
                    value={form.tanggalBstb || ""}
                    onChange={(e) => f("tanggalBstb", e.currentTarget.value)}
                    required
                  />
                  <TextInput
                    size="xs"
                    label="Tanggal Produksi"
                    type="date"
                    value={form.tanggalProduksi || ""}
                    onChange={(e) =>
                      f("tanggalProduksi", e.currentTarget.value)
                    }
                    required
                  />
                </Group>
                <Group grow mt="xs">
                  <Box
                    style={{
                      background: "#fefce8",
                      borderRadius: 8,
                      padding: "8px 12px",
                      flex: 1,
                    }}
                  >
                    <Group gap={6}>
                      <IconClockHour4 size={14} style={{ color: "#ca8a04" }} />
                      <Text size="xs" fw={600} c="dimmed">
                        Jam In (Real-time)
                      </Text>
                    </Group>
                    <Text size="lg" fw={900} c="orange">
                      {jamIn || "-"}
                    </Text>
                  </Box>
                  <TextInput
                    size="xs"
                    label="Waktu Masuk CS (mm:ss)"
                    placeholder="00:00"
                    value={form.waktuMasukCS || ""}
                    onChange={(e) => {
                      const v = formatMMSS(e.currentTarget.value);
                      f("waktuMasukCS", v);
                    }}
                    description="Format menit:detik, contoh: 12:30"
                  />
                </Group>
              </Box>

              {/* Section 2: Produk */}
              <Box>
                <Group
                  gap={6}
                  mb="xs"
                  pb={4}
                  style={{ borderBottom: "1px solid #f1f5f9" }}
                >
                  <IconPackage size={15} style={{ color: "#e6921e" }} />
                  <Text fw={700} size="sm">
                    Identitas Barang
                  </Text>
                </Group>
                <Select
                  size="xs"
                  label="Nama Barang"
                  data={barangList.map((b: any) => b.nama)}
                  value={form.namaBarang || ""}
                  onChange={(v) => f("namaBarang", v)}
                  searchable
                  required
                  placeholder="Pilih barang..."
                />
                <Group grow mt="xs">
                  <Select
                    size="xs"
                    label="Satuan"
                    data={["Carton", "Pack", "Kg", "Pcs"]}
                    value={form.satuan || ""}
                    onChange={(v) => f("satuan", v)}
                    required
                  />
                  <Select
                    size="xs"
                    label="Status Mutu"
                    data={
                      statusList.length > 0
                        ? statusList
                        : ["GOOD", "HOLD", "REJECT"]
                    }
                    value={form.status || ""}
                    onChange={(v) => f("status", v)}
                    required
                  />
                  <Select
                    size="xs"
                    label="Shift / Koordinator"
                    data={koordinatorList}
                    value={form.shiftIn || ""}
                    onChange={(v) => f("shiftIn", v)}
                    searchable
                    required
                    placeholder="Pilih..."
                  />
                </Group>
                {tanggalExpiredPreview && (
                  <Box
                    style={{
                      background: "#f0fdf4",
                      borderRadius: 8,
                      padding: "6px 10px",
                      marginTop: 4,
                    }}
                  >
                    <Group gap={6}>
                      <IconClock size={14} style={{ color: "#16a34a" }} />
                      <Text size="xs" c="dimmed">
                        Tanggal Expired (estimasi):
                      </Text>
                      <Text size="xs" fw={700} c="green">
                        {tanggalExpiredPreview}
                      </Text>
                    </Group>
                  </Box>
                )}
              </Box>

              {/* Section 3: Batch & Rak */}
              <Box>
                <Group
                  justify="space-between"
                  mb="xs"
                  pb={4}
                  style={{ borderBottom: "1px solid #f1f5f9" }}
                >
                  <Group gap={6}>
                    <IconStack2 size={15} style={{ color: "#e6921e" }} />
                    <Text fw={700} size="sm">
                      Detail Batch & Rak
                    </Text>
                  </Group>
                  <Button
                    size="xs"
                    variant="light"
                    color="orange"
                    leftSection={<IconPlus size={14} />}
                    onClick={addB}
                  >
                    Tambah Batch
                  </Button>
                </Group>

                <Stack gap="xs">
                  {form.batches.map((b: any, i: number) => (
                    <Paper
                      key={i}
                      withBorder
                      p="xs"
                      radius="md"
                      style={{ borderLeft: "3px solid #0ea5e9" }}
                    >
                      <Group grow align="end" gap="xs">
                        <TextInput
                          size="xs"
                          label="Nomor Batch"
                          placeholder="Nomor Batch"
                          value={b.nomorBatch || ""}
                          onChange={(e) =>
                            ub(i, "nomorBatch", e.currentTarget.value)
                          }
                          required
                        />
                        <NumberInput
                          size="xs"
                          label="Qty"
                          min={1}
                          allowDecimal={false}
                          value={b.qty || 0}
                          onChange={(v) => ub(i, "qty", v)}
                          required
                        />
                        <Box style={{ flex: 1 }}>
                          <Select
                            size="xs"
                            label="Lokasi Rak"
                            data={rakOpts}
                            value={b.lokasiRak || ""}
                            onChange={(v) => ub(i, "lokasiRak", v)}
                            searchable
                            required
                            placeholder="Pilih Rak"
                          />
                          {lastOutMap[i] && (
                            <Box
                              mt={4}
                              p={6}
                              style={{
                                background: "#fff7ed",
                                border: "1px solid #fed7aa",
                                borderRadius: 6,
                                fontSize: 10,
                                color: "#9a3412",
                              }}
                            >
                              <Text size="xs" fw={700}>
                                Info barang keluar terakhir:
                              </Text>
                              <Text size="xs">
                                {lastOutMap[i].tanggalKeluar} —{" "}
                                {lastOutMap[i].namaBarang} (batch{" "}
                                {lastOutMap[i].nomorBatch || "-"}) qty{" "}
                                {lastOutMap[i].qtyKeluar}{" "}
                                {lastOutMap[i].satuan}
                              </Text>
                              <Text size="xs" c="dimmed">
                                SJ: {lastOutMap[i].nomorSuratJalan || "-"} |{" "}
                                Resto: {lastOutMap[i].namaResto || "-"} | Sopir:{" "}
                                {lastOutMap[i].namaSopir || "-"}
                              </Text>
                            </Box>
                          )}
                        </Box>
                        {form.batches.length > 1 && (
                          <Button
                            size="xs"
                            color="red"
                            variant="subtle"
                            onClick={() => delB(i)}
                            style={{ alignSelf: "flex-end" }}
                          >
                            <IconTrash size={14} />
                          </Button>
                        )}
                      </Group>
                    </Paper>
                  ))}
                </Stack>
              </Box>

              <Box pt="xs" style={{ borderTop: "1px solid #f1f5f9" }}>
                <Textarea
                  size="xs"
                  label="Keterangan Tambahan"
                  placeholder="Catatan khusus inbound..."
                  value={form.keterangan || ""}
                  onChange={(e) => f("keterangan", e.currentTarget.value)}
                  rows={2}
                />
                <Button
                  fullWidth
                  color="orange"
                  mt="sm"
                  leftSection={<IconCheck size={16} />}
                  onClick={co}
                >
                  Simpan Transaksi Barang Masuk
                </Button>
              </Box>
            </Stack>
          </Paper>
        </Grid.Col>

        {/* RIGHT: Dashboard */}
        <Grid.Col span={{ base: 12, xl: 7 }}>
          <Paper withBorder p="md" radius="md" h="100%">
            <Tabs value={activeTab} onChange={setActiveTab}>
              <Tabs.List mb="md">
                <Tabs.Tab
                  value="stock"
                  leftSection={<IconBuildingWarehouse size={15} />}
                >
                  Stok Saat Ini
                </Tabs.Tab>
                <Tabs.Tab
                  value="history"
                  leftSection={<IconHistory size={15} />}
                >
                  Riwayat Penerimaan
                </Tabs.Tab>
              </Tabs.List>

              <Tabs.Panel value="stock">
                <Text size="xs" c="dimmed" mb="sm">
                  Daftar sebaran kapasitas rak aktif beserta produk tersimpan.
                </Text>
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
                        {bmStockColumns.map((c) => (
                          <Table.Th
                            key={c.key}
                            style={{ color: "#fff", fontSize: 11, cursor: "pointer", userSelect: "none" }}
                            onClick={() =>
                              toggleSort(c.key, bmStockSortKey, bmStockSortDir, setBmStockSortKey, setBmStockSortDir)
                            }
                          >
                            {c.label}{sortIcon(c.key, bmStockSortKey, bmStockSortDir)}
                          </Table.Th>
                        ))}
                      </Table.Tr>
                    </Table.Thead>
                    <Table.Tbody>
                      {(sortData(stocks, bmStockSortKey, bmStockSortDir).length === 0 ? (
                        <Table.Tr>
                          <Table.Td colSpan={6} ta="center" c="dimmed" py="xl">
                            Belum ada stok barang di gudang.
                          </Table.Td>
                        </Table.Tr>
                      ) : (
                        sortData(stocks, bmStockSortKey, bmStockSortDir).map((s: any) => (
                          <Table.Tr key={s.idStock}>
                            <Table.Td fw={700} c="blue">
                              {s.lokasiRak}
                            </Table.Td>
                            <Table.Td fw={500}>{s.namaBarang}</Table.Td>
                            <Table.Td>
                              <Badge size="xs" variant="light" color="gray">
                                {s.nomorBatch}
                              </Badge>
                            </Table.Td>
                            <Table.Td ta="right" fw={700}>
                              {s.stockOnhand}
                            </Table.Td>
                            <Table.Td>{s.tanggalExpired || "-"}</Table.Td>
                            <Table.Td>
                              <Badge
                                size="xs"
                                color={
                                  s.status === "GOOD"
                                    ? "green"
                                    : s.status === "HOLD"
                                      ? "yellow"
                                      : "red"
                                }
                              >
                                {s.status}
                              </Badge>
                            </Table.Td>
                          </Table.Tr>
                        ))
                      ))}
                    </Table.Tbody>
                  </Table>
                </Box>
              </Tabs.Panel>

              <Tabs.Panel value="history">
                <Text size="xs" c="dimmed" mb="sm">
                  30 transaksi penerimaan barang inbound terbaru.
                </Text>
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
                        {bmHistColumns.map((c) => (
                          <Table.Th
                            key={c.key}
                            style={{ color: "#fff", fontSize: 11, cursor: "pointer", userSelect: "none" }}
                            onClick={() =>
                              toggleSort(c.key, bmHistSortKey, bmHistSortDir, setBmHistSortKey, setBmHistSortDir)
                            }
                          >
                            {c.label}{sortIcon(c.key, bmHistSortKey, bmHistSortDir)}
                          </Table.Th>
                        ))}
                        <Table.Th style={{ color: "#fff", fontSize: 11 }}>Aksi</Table.Th>
                      </Table.Tr>
                    </Table.Thead>
                    <Table.Tbody>
                      {sortData(history, bmHistSortKey, bmHistSortDir).length === 0 ? (
                        <Table.Tr>
                          <Table.Td colSpan={8} ta="center" c="dimmed" py="xl">
                            Belum ada riwayat transaksi inbound.
                          </Table.Td>
                        </Table.Tr>
                      ) : (
                        sortData(history, bmHistSortKey, bmHistSortDir).slice(0, 30).map((h: any, i: number) => (
                          <Table.Tr key={i}>
                            <Table.Td>{h.tanggalBstb}</Table.Td>
                            <Table.Td fw={600}>{h.namaBarang}</Table.Td>
                            <Table.Td ta="right" fw={700}>
                              {h.totalQty}
                            </Table.Td>
                            <Table.Td>
                              <Badge size="xs" variant="light" color="blue">
                                {h.lokasiRak}
                              </Badge>
                            </Table.Td>
                            <Table.Td>{h.nomorBatch}</Table.Td>
                            <Table.Td>{h.shiftIn}</Table.Td>
                            <Table.Td>{h.namaUserTransaksi}</Table.Td>
                            <Table.Td>
                              <ActionIcon
                                size="sm"
                                color="red"
                                variant="subtle"
                                title="Rollback transaksi"
                                onClick={() => handleRollback(h.id)}
                              >
                                <IconRotate size={14} />
                              </ActionIcon>
                            </Table.Td>
                          </Table.Tr>
                        ))
                      )}
                    </Table.Tbody>
                  </Table>
                </Box>
              </Tabs.Panel>
            </Tabs>
          </Paper>
        </Grid.Col>
      </Grid>

      {/* Confirm Modal */}
      <Modal
        opened={confirmOpened}
        onClose={cc}
        title={<Text fw={900}>Konfirmasi Dokumen Inbound</Text>}
        centered
      >
        <Stack gap="sm">
          <Text size="xs" c="dimmed">
            Pastikan seluruh detail dokumen penerimaan barang berikut sudah
            sesuai.
          </Text>
          <Box style={{ background: "#f8f9fa", borderRadius: 8, padding: 12 }}>
            <Group gap="xl" mb={4}>
              <Text size="xs" c="dimmed">
                Nomor BSTB:
              </Text>
              <Text size="xs" fw={700}>
                {form.nomorBstb || "-"}
              </Text>
            </Group>
            <Group gap="xl" mb={4}>
              <Text size="xs" c="dimmed">
                Tanggal BSTB:
              </Text>
              <Text size="xs" fw={700}>
                {form.tanggalBstb || "-"}
              </Text>
            </Group>
            <Group gap="xl" mb={4}>
              <Text size="xs" c="dimmed">
                Tgl Produksi:
              </Text>
              <Text size="xs" fw={600}>
                {form.tanggalProduksi || "-"}
              </Text>
            </Group>
            <Group gap="xl" mb={4}>
              <Text size="xs" c="dimmed">
                Barang / Satuan:
              </Text>
              <Text size="xs" fw={700} c="orange">
                {form.namaBarang || "Belum dipilih"} ({form.satuan})
              </Text>
            </Group>
            <Box pt="xs" style={{ borderTop: "1px solid #e5e7eb" }}>
              <Text size="xs" fw={700} c="blue" mb={4}>
                Alokasi Batch & Rak:
              </Text>
              {form.batches.map((b: any, i: number) => (
                <Group key={i} gap="xl" ml="xs">
                  <Text size="xs">Batch: {b.nomorBatch || "-"}</Text>
                  <Text size="xs" fw={600}>
                    {b.qty || 0} {form.satuan} →{" "}
                    <Badge size="xs" color="blue">
                      {b.lokasiRak || "Tanpa Rak"}
                    </Badge>
                  </Text>
                </Group>
              ))}
            </Box>
          </Box>
          <Group justify="flex-end">
            <Button variant="default" onClick={cc}>
              Batal
            </Button>
            <Button color="orange" onClick={handleSubmit}>
              Ya, Simpan ke Sistem
            </Button>
          </Group>
        </Stack>
      </Modal>

      {/* Notice / Collision Detection Modal */}
      <Modal
        opened={noticeOpened}
        onClose={closeNotice}
        title={<Text fw={900} c="orange">Peringatan: Cek Kembali Data Inbound</Text>}
        centered
        size="md"
      >
        <Stack gap="sm">
          <Text size="xs" c="dimmed">
            Sistem mendeteksi potensi masalah pada data yang akan disimpan. Silakan
            periksa dan konfirmasi jika memang sudah benar.
          </Text>
          <Box
            style={{
              background: "#fff7ed",
              border: "1px solid #fed7aa",
              borderRadius: 8,
              padding: 12,
              maxHeight: 300,
              overflow: "auto",
            }}
          >
            <Stack gap="xs">
              {noticeData?.notices?.map((n: string, i: number) => (
                <Group key={i} gap="xs" align="flex-start">
                  <Text size="xs" c="orange" fw={700}>
                    {i + 1}.
                  </Text>
                  <Text size="xs" c="#9a3412">
                    {n}
                  </Text>
                </Group>
              ))}
            </Stack>
          </Box>
          <Group justify="flex-end">
            <Button variant="default" size="xs" onClick={closeNotice}>
              Periksa Ulang
            </Button>
            <Button
              size="xs"
              color="orange"
              onClick={() =>
                doSubmit(
                  true,
                  noticeData?.keyData,
                  noticeData?.notices?.join(" | "),
                )
              }
            >
              Tetap Simpan
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Box>
  );
}
