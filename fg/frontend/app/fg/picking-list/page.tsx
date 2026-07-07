"use client";
import { useState, useEffect } from "react";
import {
  Title,
  Table,
  Button,
  Group,
  TextInput,
  Stack,
  Text,
  Badge,
  Box,
  Paper,
  Tabs,
  Modal,
  Select,
  NumberInput,
  ActionIcon,
  Divider,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";
import {
  IconClipboardList,
  IconListDetails,
  IconPlus,
  IconPrinter,
  IconTrash,
  IconTruckDelivery,
  IconCheck,
  IconSearch,
  IconBuildingStore,
} from "@tabler/icons-react";
import api from "../lib/api";

export default function PickingListPage() {
  const [pickingList, setPickingList] = useState<any[]>([]);
  const [restoList, setRestoList] = useState<any[]>([]);
  const [barangList, setBarangList] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<string | null>("list");

  // filters
  const [filterPO, setFilterPO] = useState("");
  const [filterStart, setFilterStart] = useState("");
  const [filterEnd, setFilterEnd] = useState("");
  const [filterStatus, setFilterStatus] = useState<string | null>("");

  // create form
  const [createForm, setCreateForm] = useState<any>({
    nomorPO: "",
    tanggalMuat: "",
    restoId: "",
    nomorSuratJalan: "",
    catatan: "",
    items: [{ namaBarang: "", qtyPO: 0, satuan: "Carton" }],
  });

  // print modal
  const [printData, setPrintData] = useState<any>(null);
  const [printOpened, { open: openPrint, close: closePrint }] =
    useDisclosure(false);

  // convert to BK modal
  const [convertPO, setConvertPO] = useState("");
  const [convertOpened, { open: openConvert, close: closeConvert }] =
    useDisclosure(false);

  // approve modal
  const [approvePO, setApprovePO] = useState("");
  const [approveItems, setApproveItems] = useState<any[]>([]);
  const [approveOpened, { open: openApprove, close: closeApprove }] =
    useDisclosure(false);

  useEffect(() => {
    load();
    api
      .get("/master-resto")
      .then((res: any) =>
        setRestoList(
          (res || []).map((r: any) => ({
            value: String(r.id),
            label: `${r.kode} - ${r.nama} | ${r.nopol}`,
            kode: r.kode,
            nama: r.nama,
            nopol: r.nopol,
            sopir: r.sopir,
            wa: r.wa,
          })),
        ),
      )
      .catch(() => {});
    api
      .get("/master-barang")
      .then((res: any) => setBarangList((res || []).map((b: any) => b.nama)))
      .catch(() => {});
  }, []);

  const load = () => {
    const params: any = {};
    if (filterPO) params.nomorPO = filterPO;
    if (filterStart) params.startDate = filterStart;
    if (filterEnd) params.endDate = filterEnd;
    if (filterStatus) params.status = filterStatus;
    api
      .get("/picking-list", { params })
      .then((res: any) => setPickingList(res || []))
      .catch(() => {});
  };

  useEffect(() => {
    load();
  }, [filterPO, filterStart, filterEnd, filterStatus]);

  const handleCreate = async () => {
    try {
      const resto = restoList.find(
        (r) => String(r.value) === String(createForm.restoId),
      );
      const payload = {
        ...createForm,
        kodeResto: resto?.kode || "",
        namaResto: resto?.nama || "",
        nopol: resto?.nopol || "",
        namaSopir: resto?.sopir || "",
      };
      const res: any = await api.post("/picking-list", payload);
      notifications.show({
        title: "Berhasil",
        message: res?.message || "Picking list dibuat",
        color: "green",
      });
      setCreateForm({
        nomorPO: "",
        tanggalMuat: "",
        restoId: "",
        nomorSuratJalan: "",
        catatan: "",
        items: [{ namaBarang: "", qtyPO: 0, satuan: "Carton" }],
      });
      setActiveTab("list");
      load();
    } catch (err: any) {
      notifications.show({
        title: "Gagal",
        message: err.response?.data?.message || "Error",
        color: "red",
      });
    }
  };

  const handlePrint = async (nomorPO: string) => {
    try {
      const res: any = await api.get(`/picking-list/print?nomorPO=${nomorPO}`);
      setPrintData(res);
      openPrint();
    } catch (err: any) {
      notifications.show({
        title: "Gagal",
        message: err.response?.data?.message || "Error",
        color: "red",
      });
    }
  };

  const handleApprove = async () => {
    try {
      const res: any = await api.put("/picking-list/approve", {
        nomorPO: approvePO,
        items: approveItems,
      });
      notifications.show({
        title: "Berhasil",
        message: res?.message || "Picking list approved",
        color: "green",
      });
      closeApprove();
      load();
    } catch (err: any) {
      notifications.show({
        title: "Gagal",
        message: err.response?.data?.message || "Error",
        color: "red",
      });
    }
  };

  const handleConvert = async () => {
    try {
      const res: any = await api.post("/barang-keluar/from-picking", {
        nomorPO: convertPO,
      });
      notifications.show({
        title: "Berhasil",
        message: res?.message || "Barang keluar dibuat",
        color: "green",
      });
      closeConvert();
      load();
    } catch (err: any) {
      notifications.show({
        title: "Gagal",
        message: err.response?.data?.message || "Error",
        color: "red",
      });
    }
  };

  // Frontend status filter (backend currently only filters PO/date)
  const filteredList = filterStatus
    ? pickingList.filter((p) => p.statusPicking === filterStatus)
    : pickingList;

  // Group by PO
  const byPO: Record<string, any[]> = {};
  filteredList.forEach((p) => {
    if (!byPO[p.nomorPO]) byPO[p.nomorPO] = [];
    byPO[p.nomorPO].push(p);
  });

  return (
    <Box>
      {/* Header */}
      <Box
        style={{
          background: "#fff",
          borderLeft: "4px solid #7c3aed",
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
              <IconClipboardList size={20} style={{ color: "#7c3aed" }} />
              PICKING LIST
            </Title>
            <Text size="xs" c="dimmed" mt={2}>
              Buat picking list dari PO, rekomendasi FEFO otomatis, cetak, dan
              konversi ke barang keluar.
            </Text>
          </Box>
          <Badge color="violet" variant="light" size="lg">
            Picking Operations
          </Badge>
        </Group>
      </Box>

      <Tabs value={activeTab} onChange={setActiveTab}>
        <Tabs.List mb="md">
          <Tabs.Tab value="list" leftSection={<IconListDetails size={15} />}>
            Daftar Picking
          </Tabs.Tab>
          <Tabs.Tab value="create" leftSection={<IconPlus size={15} />}>
            Buat Picking List
          </Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="list">
          <Paper withBorder p="md" radius="md">
            {/* Filters */}
            <Group mb="md" grow>
              <TextInput
                size="xs"
                placeholder="Cari Nomor PO..."
                value={filterPO}
                onChange={(e) => setFilterPO(e.currentTarget.value)}
                leftSection={<IconSearch size={14} />}
              />
              <TextInput
                size="xs"
                label="Dari Tanggal"
                type="date"
                value={filterStart}
                onChange={(e) => setFilterStart(e.currentTarget.value)}
              />
              <TextInput
                size="xs"
                label="Sampai Tanggal"
                type="date"
                value={filterEnd}
                onChange={(e) => setFilterEnd(e.currentTarget.value)}
              />
              <Select
                size="xs"
                label="Status"
                data={[
                  { value: "", label: "Semua" },
                  { value: "DRAFT PICKING", label: "DRAFT PICKING" },
                  { value: "APPROVED", label: "APPROVED" },
                  { value: "CLOSED", label: "CLOSED" },
                ]}
                value={filterStatus}
                onChange={setFilterStatus}
                clearable
              />
            </Group>

            {/* List grouped by PO */}
            <Stack gap="md">
              {Object.keys(byPO).length === 0 ? (
                <Text ta="center" c="dimmed" py="xl">
                  Tidak ada data picking list.
                </Text>
              ) : (
                Object.entries(byPO).map(([po, rows]) => {
                  const first = rows[0];
                  const isDraft = rows.some(
                    (r) => r.statusPicking === "DRAFT PICKING",
                  );
                  const isApproved = !isDraft && rows.some(
                    (r) => r.statusPicking === "APPROVED",
                  );
                  const totalPick = rows.reduce(
                    (sum, r) => sum + (r.qtyPick || 0),
                    0,
                  );
                  return (
                    <Paper
                      key={po}
                      withBorder
                      p="sm"
                      radius="md"
                      style={{ borderLeft: "3px solid #7c3aed" }}
                    >
                      <Group justify="space-between" mb="xs">
                        <Box>
                          <Text size="sm" fw={700}>
                            PO: {po}
                          </Text>
                          <Text size="xs" c="dimmed">
                            {first.tanggalMuat} · {first.kodeResto} -{" "}
                            {first.namaResto} · {first.nopol}
                          </Text>
                        </Box>
                        <Group gap="xs">
                          <Badge
                            size="xs"
                            color={isDraft ? "yellow" : isApproved ? "blue" : "green"}
                          >
                            {isDraft ? "DRAFT PICKING" : isApproved ? "APPROVED" : "CLOSED"}
                          </Badge>
                          <Button
                            size="xs"
                            variant="light"
                            leftSection={<IconPrinter size={14} />}
                            onClick={() => handlePrint(po)}
                          >
                            Cetak
                          </Button>
                          {isDraft && (
                            <>
                              <Button
                                size="xs"
                                color="green"
                                leftSection={<IconCheck size={14} />}
                                onClick={() => {
                                  const items = rows.reduce((acc: any[], r: any) => {
                                    if (!acc.find((x: any) => x.namaBarang === r.namaBarang)) {
                                      acc.push({ namaBarang: r.namaBarang, qtyPo: r.qtyPO });
                                    }
                                    return acc;
                                  }, []);
                                  setApprovePO(po);
                                  setApproveItems(items);
                                  openApprove();
                                }}
                              >
                                Approve
                              </Button>
                              <Button
                                size="xs"
                                color="violet"
                                leftSection={<IconTruckDelivery size={14} />}
                                onClick={() => {
                                  setConvertPO(po);
                                  openConvert();
                                }}
                              >
                                Buat Barang Keluar
                              </Button>
                            </>
                          )}
                        </Group>
                      </Group>

                      <Box style={{ maxHeight: 240, overflow: "auto" }}>
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
                              {[
                                "Barang",
                                "Qty PO",
                                "Qty Pick",
                                "Rak",
                                "Batch",
                                "Expired",
                                "Status",
                              ].map((h) => (
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
                            {rows.map((p: any, i: number) => (
                              <Table.Tr key={i}>
                                <Table.Td fw={500}>{p.namaBarang}</Table.Td>
                                <Table.Td>{p.qtyPO}</Table.Td>
                                <Table.Td ta="right" fw={700}>
                                  {p.qtyPick}
                                </Table.Td>
                                <Table.Td>
                                  <Badge
                                    size="xs"
                                    variant="light"
                                    color="blue"
                                  >
                                    {p.lokasiRak}
                                  </Badge>
                                </Table.Td>
                                <Table.Td>
                                  <Badge
                                    size="xs"
                                    variant="light"
                                    color="gray"
                                  >
                                    {p.nomorBatch}
                                  </Badge>
                                </Table.Td>
                                <Table.Td>{p.tanggalExpired}</Table.Td>
                                <Table.Td>
                                <Badge
                                  size="xs"
                                  color={
                                    p.statusPicking === "CLOSED"
                                      ? "green"
                                      : p.statusPicking === "APPROVED"
                                        ? "blue"
                                        : "yellow"
                                  }
                                >
                                  {p.statusPicking}
                                </Badge>
                                </Table.Td>
                              </Table.Tr>
                            ))}
                          </Table.Tbody>
                        </Table>
                      </Box>
                      <Text size="xs" c="dimmed" mt="xs" ta="right">
                        Total Pick: {totalPick}
                      </Text>
                    </Paper>
                  );
                })
              )}
            </Stack>
          </Paper>
        </Tabs.Panel>

        <Tabs.Panel value="create">
          <Paper withBorder p="md" radius="md">
            <Stack gap="md">
              <Group grow>
                <TextInput
                  size="xs"
                  label="Nomor PO"
                  placeholder="PO-001"
                  value={createForm.nomorPO}
                  onChange={(e) =>
                    setCreateForm({ ...createForm, nomorPO: e.currentTarget.value })
                  }
                  required
                />
                <TextInput
                  size="xs"
                  label="Tanggal Muat"
                  type="date"
                  value={createForm.tanggalMuat}
                  onChange={(e) =>
                    setCreateForm({
                      ...createForm,
                      tanggalMuat: e.currentTarget.value,
                    })
                  }
                  required
                />
                <Select
                  size="xs"
                  label="Resto Tujuan"
                  data={restoList}
                  value={createForm.restoId}
                  onChange={(v) =>
                    setCreateForm({ ...createForm, restoId: v || "" })
                  }
                  searchable
                  required
                  placeholder="Pilih resto..."
                />
              </Group>
              <Group grow>
                <TextInput
                  size="xs"
                  label="Nomor Surat Jalan"
                  value={createForm.nomorSuratJalan}
                  onChange={(e) =>
                    setCreateForm({
                      ...createForm,
                      nomorSuratJalan: e.currentTarget.value,
                    })
                  }
                />
                <TextInput
                  size="xs"
                  label="Catatan"
                  value={createForm.catatan}
                  onChange={(e) =>
                    setCreateForm({ ...createForm, catatan: e.currentTarget.value })
                  }
                />
              </Group>

              <Divider />
              <Text fw={700} size="sm">
                Item PO
              </Text>
              {createForm.items.map((item: any, i: number) => (
                <Group key={i} grow align="end">
                  <Select
                    size="xs"
                    label="Nama Barang"
                    data={barangList}
                    value={item.namaBarang}
                    onChange={(v) => {
                      const items = [...createForm.items];
                      items[i] = { ...items[i], namaBarang: v || "" };
                      setCreateForm({ ...createForm, items });
                    }}
                    searchable
                    required
                    placeholder="Pilih barang..."
                  />
                  <NumberInput
                    size="xs"
                    label="Qty PO"
                    value={item.qtyPO}
                    onChange={(v) => {
                      const items = [...createForm.items];
                      items[i] = { ...items[i], qtyPO: v || 0 };
                      setCreateForm({ ...createForm, items });
                    }}
                    min={1}
                    allowDecimal={false}
                    required
                  />
                  <Select
                    size="xs"
                    label="Satuan"
                    data={["Carton", "Pack", "Kg", "Pcs"]}
                    value={item.satuan}
                    onChange={(v) => {
                      const items = [...createForm.items];
                      items[i] = { ...items[i], satuan: v || "Carton" };
                      setCreateForm({ ...createForm, items });
                    }}
                    required
                  />
                  {createForm.items.length > 1 && (
                    <ActionIcon
                      color="red"
                      variant="subtle"
                      onClick={() => {
                        const items = createForm.items.filter(
                          (_: any, j: number) => j !== i,
                        );
                        setCreateForm({ ...createForm, items });
                      }}
                    >
                      <IconTrash size={16} />
                    </ActionIcon>
                  )}
                </Group>
              ))}
              <Button
                size="xs"
                variant="light"
                leftSection={<IconPlus size={14} />}
                onClick={() =>
                  setCreateForm({
                    ...createForm,
                    items: [
                      ...createForm.items,
                      { namaBarang: "", qtyPO: 0, satuan: "Carton" },
                    ],
                  })
                }
              >
                Tambah Item
              </Button>
              <Button
                size="xs"
                color="violet"
                leftSection={<IconCheck size={14} />}
                onClick={handleCreate}
              >
                Buat Picking List (Auto FEFO)
              </Button>
            </Stack>
          </Paper>
        </Tabs.Panel>
      </Tabs>

      {/* Print Modal */}
      <Modal
        opened={printOpened}
        onClose={closePrint}
        title={<Text fw={900}>Cetak Picking List: {printData?.nomorPO}</Text>}
        centered
        size="lg"
      >
        {printData && (
          <Stack gap="sm">
            <Text size="sm">
              Total Item: {printData.totalRows} | Total Pick:{" "}
              {printData.totalQtyPick}
            </Text>
            <Box style={{ maxHeight: 400, overflow: "auto" }}>
              <Table striped style={{ fontSize: 11 }}>
                <Table.Thead
                  style={{ background: "#111827", position: "sticky", top: 0 }}
                >
                  <Table.Tr>
                    {[
                      "Rak",
                      "Barang",
                      "Batch",
                      "Exp",
                      "Qty Pick",
                      "Satuan",
                    ].map((h) => (
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
                  {printData.rows.map((r: any, i: number) => (
                    <Table.Tr key={i}>
                      <Table.Td fw={700} c="blue">
                        {r.lokasiRak}
                      </Table.Td>
                      <Table.Td>{r.namaBarang}</Table.Td>
                      <Table.Td>{r.nomorBatch}</Table.Td>
                      <Table.Td>{r.tanggalExpired}</Table.Td>
                      <Table.Td ta="right" fw={700}>
                        {r.qtyPick}
                      </Table.Td>
                      <Table.Td>{r.satuan}</Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            </Box>
            <Button
              size="xs"
              leftSection={<IconPrinter size={14} />}
              onClick={() => window.print()}
            >
              Print Halaman Ini
            </Button>
          </Stack>
        )}
      </Modal>

      {/* Approve Modal */}
      <Modal
        opened={approveOpened}
        onClose={closeApprove}
        title={<Text fw={900}>Approve Picking List: {approvePO}</Text>}
        centered
        size="lg"
      >
        <Stack gap="sm">
          <Text size="xs" c="dimmed">Edit quantity per item jika diperlukan.</Text>
          {approveItems.map((item, i) => (
            <Group key={i} grow>
              <Text size="sm" fw={500}>{item.namaBarang}</Text>
              <NumberInput
                size="xs"
                label="Qty PO"
                value={item.qtyPo}
                onChange={(v) => {
                  const updated = [...approveItems];
                  updated[i] = { ...updated[i], qtyPo: v || 0 };
                  setApproveItems(updated);
                }}
                min={1}
                allowDecimal={false}
              />
            </Group>
          ))}
          <Group justify="flex-end">
            <Button variant="default" size="xs" onClick={closeApprove}>Batal</Button>
            <Button size="xs" color="green" leftSection={<IconCheck size={14} />} onClick={handleApprove}>
              Approve
            </Button>
          </Group>
        </Stack>
      </Modal>

      {/* Convert to Barang Keluar Modal */}
      <Modal
        opened={convertOpened}
        onClose={closeConvert}
        title={<Text fw={900}>Konfirmasi Barang Keluar</Text>}
        centered
      >
        <Stack gap="sm">
          <Text size="sm">
            Buat transaksi barang keluar dari picking list{" "}
            <strong>{convertPO}</strong>?
          </Text>
          <Text size="xs" c="dimmed">
            Sistem akan otomatis membuat OTDR dan mengurangi stock sesuai hasil
            picking.
          </Text>
          <Group justify="flex-end">
            <Button variant="default" size="xs" onClick={closeConvert}>
              Batal
            </Button>
            <Button
              size="xs"
              color="violet"
              leftSection={<IconTruckDelivery size={14} />}
              onClick={handleConvert}
            >
              Ya, Buat Barang Keluar
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Box>
  );
}
