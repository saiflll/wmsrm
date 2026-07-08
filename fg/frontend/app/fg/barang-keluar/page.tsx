"use client";
import { useState, useEffect } from "react";
import { Title, Card, TextInput, Select, Button, Stack, Group, Text, NumberInput, Textarea, Badge, Box, Paper, Modal, Tabs, Grid, ActionIcon } from "@mantine/core";
import { Table } from '../components/Table';
import { useDisclosure } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";
import {
  IconTruckDelivery,
  IconFileText,
  IconPackage,
  IconStack2,
  IconPlus,
  IconTrash,
  IconCheck,
  IconBuildingWarehouse,
  IconUser,
  IconPhone,
  IconMapPin,
  IconClockHour4,
  IconPencil,
  IconHistory,
  IconRotate,
} from "@tabler/icons-react";
import api from "../lib/api";

export default function BarangKeluarPage() {
  const [form, setForm] = useState<any>({
    tglDimuat: "",
    restoId: "",
    nomorSuratJalan: "",
    shiftOut: "",
    nomorITKirim: "",
    keterangan: "",
    outputs: [{}],
  });
  const [restoList, setRestoList] = useState<any[]>([]);
  const [stockList, setStockList] = useState<any[]>([]);
  const [history, setHistory] = useState<any[]>([]);
  const [koordinatorList, setKoordinatorList] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<string | null>("stock");
  const [jamSekarang, setJamSekarang] = useState("");
  const [confirmOpened, { open: co, close: cc }] = useDisclosure(false);
  const [editRow, setEditRow] = useState<any>(null);
  const [editQty, setEditQty] = useState<number>(0);
  const [editAlasan, setEditAlasan] = useState("");
  const [editOpened, { open: openEdit, close: closeEdit }] =
    useDisclosure(false);
  const [noticeOpened, { open: openNotice, close: closeNotice }] =
    useDisclosure(false);
  const [noticeData, setNoticeData] = useState<any>(null);
  const [bkStockSortKey, setBkStockSortKey] = useState<string | null>(null);
  const [bkStockSortDir, setBkStockSortDir] = useState<"asc" | "desc">("asc");
  const [bkHistSortKey, setBkHistSortKey] = useState<string | null>(null);
  const [bkHistSortDir, setBkHistSortDir] = useState<"asc" | "desc">("asc");

  const bkSortData = (data: any[], key: string | null, dir: "asc" | "desc") => {
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

  const bkToggleSort = (
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

  const bkSortIcon = (key: string, curKey: string | null, curDir: "asc" | "desc") => {
    if (curKey !== key) return " ↕";
    return curDir === "asc" ? " ▲" : " ▼";
  };

  const bkStockColumns = [
    { label: "Rak", key: "lokasiRak" },
    { label: "Barang", key: "namaBarang" },
    { label: "Batch", key: "nomorBatch" },
    { label: "Qty", key: "stockOnhand" },
    { label: "Exp", key: "tanggalExpired" },
    { label: "Status", key: "status" },
  ];

  const bkHistColumns = [
    { label: "Tgl Muat", key: "tanggalDimuat" },
    { label: "Resto", key: "namaResto" },
    { label: "Barang", key: "namaBarang" },
    { label: "Qty", key: "qtyKeluar" },
    { label: "Batch", key: "nomorBatch" },
    { label: "SJ", key: "nomorSuratJalan" },
    { label: "OTDR", key: "idOtdr" },
    { label: "User", key: "namaUserTransaksi" },
  ];

  useEffect(() => {
    const tick = () => {
      const now = new Date();
      setJamSekarang(
        now.toLocaleTimeString("id-ID", { timeZone: "Asia/Jakarta" }),
      );
    };
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    api
      .get("/master-resto")
      .then((r: any) =>
        setRestoList(
          (r || []).map((x: any) => ({
            value: String(x.id),
            label: `${x.kode} - ${x.nama} | ${x.nopol}`,
            kode: x.kode,
            nama: x.nama,
            nopol: x.nopol,
            sopir: x.namaSopir || x.sopir,
            wa: x.wa || x.waSopir,
          })),
        ),
      )
      .catch(() => {});
    loadStock();
    api
      .get("/barang-keluar")
      .then((r: any) => setHistory(r || []))
      .catch(() => {});
    api
      .get("/users/koordinator-out")
      .then((r: any) => {
        setKoordinatorList(
          (r || []).map((u: any) => ({
            value: `${u.namaUser} - ${u.shift}`,
            label: `${u.namaUser} - ${u.shift}`,
          })),
        );
      })
      .catch(() => {});
  }, []);

  const loadStock = () =>
    api
      .get("/stock?available=true")
      .then((r: any) => setStockList(r || []))
      .catch(() => {});

  const f = (k: string, v: any) => setForm({ ...form, [k]: v });
  const uo = (i: number, k: string, v: any) => {
    const o = [...form.outputs];
    o[i] = { ...o[i], [k]: v };
    setForm({ ...form, outputs: o });
  };
  const addO = () => setForm({ ...form, outputs: [...form.outputs, {}] });
  const delO = (i: number) =>
    setForm({
      ...form,
      outputs: form.outputs.filter((_: any, j: number) => j !== i),
    });

  const selResto = restoList.find(
    (r: any) => String(r.value) === String(form.restoId),
  );
  const products = [...new Set(stockList.map((s: any) => s.namaBarang))];

  const fefoSorted = [...stockList].sort((a: any, b: any) => {
    if (!a.tanggalExpired) return 1;
    if (!b.tanggalExpired) return -1;
    return (
      new Date(a.tanggalExpired).getTime() -
      new Date(b.tanggalExpired).getTime()
    );
  });

  const doSubmit = async (confirmed = false, noticeKeyData?: string, noticeMessage?: string) => {
    try {
      const payload: any = { ...form };
      if (confirmed) {
        payload.noticeConfirmed = true;
        payload.noticeKeyData = noticeKeyData;
        payload.noticeMessage = noticeMessage;
      }
      const res = await api.post("/barang-keluar", payload);
      notifications.show({
        title: "Barang Keluar Berhasil",
        message: (res as any)?.message || "Tersimpan",
        color: "green",
      });
      setForm({
        tglDimuat: "",
        restoId: "",
        nomorSuratJalan: "",
        shiftOut: "",
        nomorITKirim: "",
        keterangan: "",
        outputs: [{}],
      });
      cc();
      closeNotice();
      loadStock();
      api
        .get("/barang-keluar")
        .then((r: any) => setHistory(r || []))
        .catch(() => {});
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
      const noticeRes: any = await api.post("/barang-keluar/check-notice", form);
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
    if (!confirm("Yakin rollback transaksi barang keluar ini? Stock akan dikembalikan.")) return;
    try {
      const res: any = await api.delete(`/barang-keluar/${id}/rollback`);
      notifications.show({
        title: "Rollback Berhasil",
        message: res?.message || "Transaksi dibatalkan",
        color: "green",
      });
      loadStock();
      api.get("/barang-keluar").then((r: any) => setHistory(r || [])).catch(() => {});
    } catch (err: any) {
      notifications.show({
        title: "Gagal",
        message: err.response?.data?.message || "Error",
        color: "red",
      });
    }
  };

  const startEdit = (row: any) => {
    setEditRow(row);
    setEditQty(row.qtyKeluar);
    setEditAlasan("");
    openEdit();
  };

  const handleEdit = async () => {
    try {
      const res: any = await api.put("/barang-keluar/edit", {
        rowNumber: editRow.id,
        qtyBaru: editQty,
        alasan: editAlasan,
      });
      notifications.show({
        title: "Berhasil",
        message: res?.message || "Qty diupdate",
        color: "green",
      });
      closeEdit();
      api
        .get("/barang-keluar")
        .then((r: any) => setHistory(r || []))
        .catch(() => {});
      loadStock();
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
          borderLeft: "4px solid #dc2626",
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
              <IconTruckDelivery size={20} style={{ color: "#dc2626" }} />
              BARANG KELUAR (OUTBOUND)
            </Title>
            <Text size="xs" c="dimmed" mt={2}>
              Pengeluaran barang ke resto, FEFO auto-select, dan tracking OTDR.
            </Text>
          </Box>
          <Badge color="red" variant="light" size="lg">
            Outbound Operations
          </Badge>
        </Group>
      </Box>

      <Grid>
        {/* LEFT: Form */}
        <Grid.Col span={{ base: 12, xl: 5 }}>
          <Paper withBorder p="md" radius="md">
            <Stack gap="md">
              {/* Section 1: Tujuan */}
              <Box>
                <Group
                  gap={6}
                  mb="xs"
                  pb={4}
                  style={{ borderBottom: "1px solid #f1f5f9" }}
                >
                  <IconMapPin size={15} style={{ color: "#dc2626" }} />
                  <Text fw={700} size="sm">
                    Tujuan Pengiriman
                  </Text>
                </Group>
                <Select
                  size="xs"
                  label="Tujuan Resto"
                  data={restoList}
                  value={form.restoId ? String(form.restoId) : ""}
                  onChange={(v) => f("restoId", v ? Number(v) : "")}
                  searchable
                  required
                  placeholder="Pilih resto..."
                />
                <Group grow mt="xs">
                  <TextInput
                    size="xs"
                    label="Tanggal Dimuat"
                    type="date"
                    value={form.tglDimuat || ""}
                    onChange={(e) => f("tglDimuat", e.currentTarget.value)}
                    required
                  />
                  <TextInput
                    size="xs"
                    label="Nomor Surat Jalan"
                    value={form.nomorSuratJalan || ""}
                    onChange={(e) =>
                      f("nomorSuratJalan", e.currentTarget.value)
                    }
                    required
                  />
                </Group>
                <Box
                  style={{
                    background: "#fefce8",
                    borderRadius: 8,
                    padding: "6px 10px",
                    marginTop: 4,
                  }}
                >
                  <Group gap={6}>
                    <IconClockHour4 size={14} style={{ color: "#ca8a04" }} />
                    <Text size="xs" c="dimmed">
                      Jam Saat Ini:
                    </Text>
                    <Text size="sm" fw={700} c="orange">
                      {jamSekarang || "-"}
                    </Text>
                  </Group>
                </Box>
                {selResto && (
                  <Box
                    style={{
                      background: "#fef2f2",
                      borderRadius: 8,
                      padding: "6px 10px",
                      marginTop: 8,
                    }}
                  >
                    <Group gap="md">
                      <Group gap={4}>
                        <IconTruckDelivery size={14} />
                        <Text size="xs">{selResto.nopol || "-"}</Text>
                      </Group>
                      <Group gap={4}>
                        <IconUser size={14} />
                        <Text size="xs">{selResto.sopir || "-"}</Text>
                      </Group>
                      <Group gap={4}>
                        <IconPhone size={14} />
                        <Text size="xs">{selResto.wa || "-"}</Text>
                      </Group>
                    </Group>
                  </Box>
                )}
              </Box>

              {/* Section 2: Koordinator */}
              <Box>
                <Group
                  gap={6}
                  mb="xs"
                  pb={4}
                  style={{ borderBottom: "1px solid #f1f5f9" }}
                >
                  <IconUser size={15} style={{ color: "#dc2626" }} />
                  <Text fw={700} size="sm">
                    Koordinator & Dokumen
                  </Text>
                </Group>
                <Group grow>
                  <Select
                    size="xs"
                    label="Shift Out / Koordinator"
                    data={koordinatorList}
                    value={form.shiftOut || ""}
                    onChange={(v) => f("shiftOut", v)}
                    searchable
                    required
                    placeholder="Pilih koordinator..."
                  />
                  <TextInput
                    size="xs"
                    label="Nomor IT Kirim"
                    value={form.nomorITKirim || ""}
                    onChange={(e) => f("nomorITKirim", e.currentTarget.value)}
                    placeholder="Opsional"
                  />
                </Group>
              </Box>

              {/* Section 3: Output Items */}
              <Box>
                <Group
                  justify="space-between"
                  mb="xs"
                  pb={4}
                  style={{ borderBottom: "1px solid #f1f5f9" }}
                >
                  <Group gap={6}>
                    <IconStack2 size={15} style={{ color: "#dc2626" }} />
                    <Text fw={700} size="sm">
                      Output Items (FEFO Auto)
                    </Text>
                  </Group>
                  <Button
                    size="xs"
                    variant="light"
                    color="red"
                    leftSection={<IconPlus size={14} />}
                    onClick={addO}
                  >
                    Tambah Output
                  </Button>
                </Group>

                <Stack gap="xs">
                  {form.outputs.map((o: any, i: number) => (
                    <Paper
                      key={i}
                      withBorder
                      p="xs"
                      radius="md"
                      style={{ borderLeft: "3px solid #ef4444" }}
                    >
                      <Stack gap="xs">
                        <Select
                          size="xs"
                          label="Nama Barang"
                          data={products}
                          value={o.namaBarang || ""}
                          onChange={(v) => {
                            if (!v) return;
                            const fefo = fefoSorted.find(
                              (s: any) => s.namaBarang === v,
                            );
                            const outputs = [...form.outputs];
                            outputs[i] = {
                              ...outputs[i],
                              namaBarang: v,
                              idStock: fefo?.idStock || "",
                              nomorBatch: fefo?.nomorBatch || "",
                              lokasiRak: fefo?.lokasiRak || "",
                              qtyKeluar: fefo?.stockOnhand || 0,
                              satuan: fefo?.satuan || "",
                            };
                            setForm({ ...form, outputs });
                          }}
                          searchable
                          required
                          placeholder="Pilih barang..."
                        />
                        <Select
                          size="xs"
                          label="Override Batch & Rak"
                          data={fefoSorted
                            .filter(
                              (s: any) =>
                                !o.namaBarang || s.namaBarang === o.namaBarang,
                            )
                            .map((s: any) => ({
                              value: s.idStock,
                              label: `${s.lokasiRak} | ${s.nomorBatch || "-"} | ${s.stockOnhand} ${s.satuan}`,
                            }))}
                          value={o.idStock || ""}
                          onChange={(v) => {
                            if (!v) return;
                            const s = fefoSorted.find(
                              (x: any) => x.idStock === v,
                            );
                            if (s) {
                              uo(i, "idStock", s.idStock);
                              uo(i, "nomorBatch", s.nomorBatch || "");
                              uo(i, "lokasiRak", s.lokasiRak || "");
                              uo(i, "qtyKeluar", s.stockOnhand);
                              uo(i, "satuan", s.satuan || "");
                            }
                          }}
                          searchable
                          clearable
                          placeholder="Auto FEFO"
                        />
                        <Group grow>
                          <NumberInput
                            size="xs"
                            label="Qty Keluar"
                            value={o.qtyKeluar || 0}
                            onChange={(v) => uo(i, "qtyKeluar", v)}
                            min={1}
                            allowDecimal={false}
                            required
                          />
                          <Select
                            size="xs"
                            label="Satuan"
                            data={["Carton", "Pack", "Kg", "Pcs"]}
                            value={o.satuan || ""}
                            onChange={(v) => uo(i, "satuan", v)}
                            required
                          />
                        </Group>
                      </Stack>
                      {form.outputs.length > 1 && (
                        <Button
                          size="xs"
                          color="red"
                          variant="subtle"
                          mt={4}
                          leftSection={<IconTrash size={14} />}
                          onClick={() => delO(i)}
                        >
                          Hapus
                        </Button>
                      )}
                    </Paper>
                  ))}
                </Stack>
              </Box>

              <Box pt="xs" style={{ borderTop: "1px solid #f1f5f9" }}>
                <Textarea
                  size="xs"
                  label="Keterangan"
                  placeholder="Catatan tambahan..."
                  value={form.keterangan || ""}
                  onChange={(e) => f("keterangan", e.currentTarget.value)}
                  rows={2}
                />
                <Button
                  fullWidth
                  color="red"
                  mt="sm"
                  leftSection={<IconCheck size={16} />}
                  onClick={co}
                >
                  Simpan Barang Keluar
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
                  Stok Tersedia (FEFO)
                </Tabs.Tab>
                <Tabs.Tab
                  value="history"
                  leftSection={<IconHistory size={15} />}
                >
                  Riwayat Barang Keluar
                </Tabs.Tab>
              </Tabs.List>

              <Tabs.Panel value="stock">
                <Text size="xs" c="dimmed" mb="sm">
                  Stok aktif diurutkan berdasarkan tanggal expired terdekat
                  (FEFO).
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
                        {bkStockColumns.map((c) => (
                          <Table.Th
                            key={c.key}
                            style={{ color: "#fff", fontSize: 11, cursor: "pointer", userSelect: "none" }}
                            onClick={() =>
                              bkToggleSort(c.key, bkStockSortKey, bkStockSortDir, setBkStockSortKey, setBkStockSortDir)
                            }
                          >
                            {c.label}{bkSortIcon(c.key, bkStockSortKey, bkStockSortDir)}
                          </Table.Th>
                        ))}
                      </Table.Tr>
                    </Table.Thead>
                    <Table.Tbody>
                      {bkSortData(fefoSorted, bkStockSortKey, bkStockSortDir).length === 0 ? (
                        <Table.Tr>
                          <Table.Td colSpan={6} ta="center" c="dimmed" py="xl">
                            Tidak ada stok tersedia.
                          </Table.Td>
                        </Table.Tr>
                      ) : (
                        bkSortData(fefoSorted, bkStockSortKey, bkStockSortDir).map((s: any) => (
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
                      )}
                    </Table.Tbody>
                  </Table>
                </Box>
              </Tabs.Panel>

              <Tabs.Panel value="history">
                <Text size="xs" c="dimmed" mb="sm">
                  Riwayat transaksi barang keluar terbaru.
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
                        {bkHistColumns.map((c) => (
                          <Table.Th
                            key={c.key}
                            style={{ color: "#fff", fontSize: 11, cursor: "pointer", userSelect: "none" }}
                            onClick={() =>
                              bkToggleSort(c.key, bkHistSortKey, bkHistSortDir, setBkHistSortKey, setBkHistSortDir)
                            }
                          >
                            {c.label}{bkSortIcon(c.key, bkHistSortKey, bkHistSortDir)}
                          </Table.Th>
                        ))}
                        <Table.Th style={{ color: "#fff", fontSize: 11 }}>Aksi</Table.Th>
                      </Table.Tr>
                    </Table.Thead>
                    <Table.Tbody>
                        {bkSortData(history, bkHistSortKey, bkHistSortDir).length === 0 ? (
                          <Table.Tr>
                            <Table.Td colSpan={9} ta="center" c="dimmed" py="xl">
                              Belum ada riwayat transaksi outbound.
                            </Table.Td>
                          </Table.Tr>
                        ) : (
                          bkSortData(history, bkHistSortKey, bkHistSortDir).slice(0, 30).map((h: any, i: number) => (
                            <Table.Tr key={i}>
                              <Table.Td>{h.tanggalDimuat}</Table.Td>
                              <Table.Td fw={600}>
                                {h.kodeResto} - {h.namaResto}
                              </Table.Td>
                              <Table.Td>{h.namaBarang}</Table.Td>
                              <Table.Td ta="right" fw={700}>
                                {h.qtyKeluar}
                              </Table.Td>
                              <Table.Td>{h.nomorBatch}</Table.Td>
                              <Table.Td>{h.nomorSuratJalan}</Table.Td>
                              <Table.Td>
                                <Badge size="xs" variant="light" color="blue">
                                  {h.idOtdr}
                                </Badge>
                              </Table.Td>
                              <Table.Td>{h.namaUserTransaksi}</Table.Td>
                              <Table.Td>
                                <Group gap={4}>
                                  <ActionIcon
                                    size="sm"
                                    color="blue"
                                    variant="light"
                                    onClick={() => startEdit(h)}
                                    title="Edit Qty"
                                  >
                                    <IconPencil size={14} />
                                  </ActionIcon>
                                  <ActionIcon
                                    size="sm"
                                    color="red"
                                    variant="subtle"
                                    onClick={() => handleRollback(h.id)}
                                    title="Rollback transaksi"
                                  >
                                    <IconRotate size={14} />
                                  </ActionIcon>
                                </Group>
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
        title={<Text fw={900}>Konfirmasi Barang Keluar</Text>}
        centered
      >
        <Stack gap="sm">
          <Text size="xs" c="dimmed">
            Pastikan detail pengiriman berikut sudah sesuai.
          </Text>
          <Box style={{ background: "#f8f9fa", borderRadius: 8, padding: 12 }}>
            <Group gap="xl" mb={4}>
              <Text size="xs" c="dimmed">
                Tujuan:
              </Text>
              <Text size="xs" fw={700}>
                {selResto?.label || "-"}
              </Text>
            </Group>
            <Group gap="xl" mb={4}>
              <Text size="xs" c="dimmed">
                Tgl Muat:
              </Text>
              <Text size="xs" fw={600}>
                {form.tglDimuat || "-"}
              </Text>
            </Group>
            <Group gap="xl" mb={4}>
              <Text size="xs" c="dimmed">
                Surat Jalan:
              </Text>
              <Text size="xs" fw={600}>
                {form.nomorSuratJalan || "-"}
              </Text>
            </Group>
            <Box pt="xs" style={{ borderTop: "1px solid #e5e7eb" }}>
              <Text size="xs" fw={700} c="red" mb={4}>
                Output Items:
              </Text>
              {form.outputs.map((o: any, i: number) => (
                <Group key={i} gap="xl" ml="xs">
                  <Text size="xs" fw={600}>
                    {o.namaBarang || "-"}
                  </Text>
                  <Text size="xs">
                    {o.qtyKeluar || 0} {o.satuan || ""} →{" "}
                    <Badge size="xs" color="blue">
                      {o.lokasiRak || "Auto"}
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
            <Button color="red" onClick={handleSubmit}>
              Ya, Simpan
            </Button>
          </Group>
        </Stack>
      </Modal>

      {/* Edit Qty Modal */}
      <Modal
        opened={editOpened}
        onClose={closeEdit}
        title={<Text fw={900}>Edit Qty Barang Keluar</Text>}
        centered
        size="sm"
      >
        {editRow && (
          <Stack gap="sm">
            <Box
              style={{ background: "#f8f9fa", borderRadius: 8, padding: 12 }}
            >
              <Text size="xs" c="dimmed">
                Barang
              </Text>
              <Text size="sm" fw={700}>
                {editRow.namaBarang}
              </Text>
              <Text size="xs" c="dimmed" mt={4}>
                Rak / Batch
              </Text>
              <Text size="sm" fw={600}>
                {editRow.lokasiRak} | {editRow.nomorBatch}
              </Text>
              <Text size="xs" c="dimmed" mt={4}>
                Qty Saat Ini
              </Text>
              <Text size="sm" fw={700} c="red">
                {editRow.qtyKeluar}
              </Text>
            </Box>
            <NumberInput
              size="xs"
              label="Qty Baru"
              value={editQty}
              onChange={(v) => setEditQty(typeof v === "number" ? v : parseInt(v || "0", 10))}
              min={0}
              required
            />
            <TextInput
              size="xs"
              label="Alasan / Catatan"
              value={editAlasan}
              onChange={(e) => setEditAlasan(e.currentTarget.value)}
              required
            />
            <Group justify="flex-end">
              <Button variant="default" size="xs" onClick={closeEdit}>
                Batal
              </Button>
              <Button size="xs" color="red" onClick={handleEdit}>
                Simpan Perubahan
              </Button>
            </Group>
          </Stack>
        )}
      </Modal>

      {/* Notice / Collision Detection Modal */}
      <Modal
        opened={noticeOpened}
        onClose={closeNotice}
        title={<Text fw={900} c="red">Peringatan: Cek Kembali Data Outbound</Text>}
        centered
        size="md"
      >
        <Stack gap="sm">
          <Text size="xs" c="dimmed">
            Sistem mendeteksi potensi masalah pada data yang akan disimpan.
            Silakan periksa dan konfirmasi jika memang sudah benar.
          </Text>
          <Box
            style={{
              background: "#fef2f2",
              border: "1px solid #fecaca",
              borderRadius: 8,
              padding: 12,
              maxHeight: 300,
              overflow: "auto",
            }}
          >
            <Stack gap="xs">
              {noticeData?.notices?.map((n: string, i: number) => (
                <Group key={i} gap="xs" align="flex-start">
                  <Text size="xs" c="red" fw={700}>
                    {i + 1}.
                  </Text>
                  <Text size="xs" c="#991b1b">
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
              color="red"
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
