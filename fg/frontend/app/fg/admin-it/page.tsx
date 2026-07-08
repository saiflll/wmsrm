"use client";
import { useState, useEffect } from "react";
import { Title, Button, Group, TextInput, Stack, Select, Text, Badge, Box, Paper, Tabs } from "@mantine/core";
import { Table } from '../components/Table';
import { notifications } from "@mantine/notifications";
import {
  IconServer,
  IconPlus,
  IconSend,
  IconHistory,
  IconLink,
} from "@tabler/icons-react";
import api from "../lib/api";

export default function AdminItPage() {
  const [list, setList] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<string | null>("input");
  const [transactions, setTransactions] = useState<any>({ masuk: [], keluar: [] });
  const [transFilter, setTransFilter] = useState({
    startDate: "",
    endDate: "",
    jenis: "BOTH",
  });
  const [rows, setRows] = useState<any[]>([
    {
      tanggalIT: "",
      jenisIT: "TERIMA",
      nomorITTerima: "",
      nomorITKirim: "",
    },
  ]);
  const [adminHistSortKey, setAdminHistSortKey] = useState<string | null>(null);
  const [adminHistSortDir, setAdminHistSortDir] = useState<"asc" | "desc">("asc");
  const [adminBMasukSortKey, setAdminBMasukSortKey] = useState<string | null>(null);
  const [adminBMasukSortDir, setAdminBMasukSortDir] = useState<"asc" | "desc">("asc");
  const [adminBKeluarSortKey, setAdminBKeluarSortKey] = useState<string | null>(null);
  const [adminBKeluarSortDir, setAdminBKeluarSortDir] = useState<"asc" | "desc">("asc");

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

  const histColumns = [
    { label: "Tanggal", key: "tanggalIT" },
    { label: "Jenis", key: "jenisIT" },
    { label: "IT Terima", key: "nomorITTerima" },
    { label: "IT Kirim", key: "nomorITKirim" },
    { label: "Admin", key: "namaAdminInput" },
    { label: "Status", key: "statusRelasi" },
  ];

  const bmColumns = [
    { label: "Tanggal", key: "tanggalBstb" },
    { label: "BSTB", key: "nomorBstb" },
    { label: "Barang", key: "namaBarang" },
    { label: "Batch", key: "nomorBatch" },
    { label: "Rak", key: "lokasiRak" },
  ];

  const bkColumns = [
    { label: "Tanggal", key: "tanggalDimuat" },
    { label: "SJ", key: "nomorSuratJalan" },
    { label: "Resto", key: "namaResto" },
    { label: "Barang", key: "namaBarang" },
    { label: "Batch", key: "nomorBatch" },
    { label: "Rak", key: "lokasiRak" },
  ];

  useEffect(() => {
    api
      .get("/admin-it")
      .then((res: any) => setList(res || []))
      .catch(() => {});
  }, []);

  const updateRow = (idx: number, key: string, value: any) => {
    const updated = [...rows];
    updated[idx] = { ...updated[idx], [key]: value };
    setRows(updated);
  };
  const addRow = () =>
    setRows([
      ...rows,
      { tanggalIT: "", jenisIT: "TERIMA", nomorITTerima: "", nomorITKirim: "" },
    ]);

  const loadTransactions = () => {
    const params: any = { jenis: transFilter.jenis };
    if (transFilter.startDate) params.startDate = transFilter.startDate;
    if (transFilter.endDate) params.endDate = transFilter.endDate;
    api
      .get("/admin-it/transactions", { params })
      .then((res: any) => setTransactions(res || { masuk: [], keluar: [] }))
      .catch(() => {});
  };

  const updateITMasuk = async (id: number, nomorITTerima: string) => {
    try {
      await api.put(`/admin-it/barang-masuk/${id}/it-terima`, { nomorITTerima });
      notifications.show({
        title: "Berhasil",
        message: "IT Terima diupdate",
        color: "green",
      });
      loadTransactions();
    } catch (err: any) {
      notifications.show({
        title: "Gagal",
        message: err.response?.data?.message || "Error",
        color: "red",
      });
    }
  };

  const updateITKeluar = async (id: number, nomorITKirim: string) => {
    try {
      await api.put(`/admin-it/barang-keluar/${id}/it-kirim`, { nomorITKirim });
      notifications.show({
        title: "Berhasil",
        message: "IT Kirim diupdate",
        color: "green",
      });
      loadTransactions();
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
      await api.post("/admin-it", { rows });
      notifications.show({
        title: "Berhasil",
        message: "Nomor IT tersimpan",
        color: "green",
      });
      setRows([
        {
          tanggalIT: "",
          jenisIT: "TERIMA",
          nomorITTerima: "",
          nomorITKirim: "",
        },
      ]);
      api
        .get("/admin-it")
        .then((res: any) => setList(res || []))
        .catch(() => {});
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
              <IconServer size={20} style={{ color: "#dc2626" }} />
              ADMIN IT - NOMOR IT TERIMA/KIRIM
            </Title>
            <Text size="xs" c="dimmed" mt={2}>
              Input dan kelola nomor IT terima/kirim untuk transaksi.
            </Text>
          </Box>
          <Badge color="red" variant="light" size="lg">
            Admin IT
          </Badge>
        </Group>
      </Box>

      <Tabs value={activeTab} onChange={setActiveTab}>
        <Tabs.List mb="md">
          <Tabs.Tab value="input" leftSection={<IconSend size={15} />}>
            Input IT
          </Tabs.Tab>
          <Tabs.Tab value="history" leftSection={<IconHistory size={15} />}>
            Riwayat
          </Tabs.Tab>
          <Tabs.Tab value="relasi" leftSection={<IconLink size={15} />}>
            Relasi ke Transaksi
          </Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="input">
          <Paper withBorder p="md" radius="md">
            <Group gap={6} mb="xs" pb={4} style={{ borderBottom: "1px solid #f1f5f9" }}>
              <IconSend size={15} style={{ color: "#dc2626" }} />
              <Text fw={700} size="sm">Form Input Nomor IT</Text>
            </Group>
            <Stack>
              {rows.map((r, idx) => (
                <Group key={idx} grow>
                  <TextInput
                    size="xs"
                    label="Tanggal IT"
                    type="date"
                    value={r.tanggalIT}
                    onChange={(e) =>
                      updateRow(idx, "tanggalIT", e.currentTarget.value)
                    }
                    required
                  />
                  <Select
                    size="xs"
                    label="Jenis"
                    data={["TERIMA", "KIRIM", "TERIMA & KIRIM"]}
                    value={r.jenisIT}
                    onChange={(v) => updateRow(idx, "jenisIT", v)}
                  />
                  <TextInput
                    size="xs"
                    label="IT Terima"
                    value={r.nomorITTerima}
                    onChange={(e) =>
                      updateRow(idx, "nomorITTerima", e.currentTarget.value)
                    }
                  />
                  <TextInput
                    size="xs"
                    label="IT Kirim"
                    value={r.nomorITKirim}
                    onChange={(e) =>
                      updateRow(idx, "nomorITKirim", e.currentTarget.value)
                    }
                  />
                </Group>
              ))}
              <Group>
                <Button
                  size="xs"
                  variant="light"
                  leftSection={<IconPlus size={14} />}
                  onClick={addRow}
                >
                  + Tambah Baris
                </Button>
                <Button
                  size="xs"
                  color="red"
                  leftSection={<IconSend size={14} />}
                  onClick={handleSubmit}
                >
                  Simpan
                </Button>
              </Group>
            </Stack>
          </Paper>
        </Tabs.Panel>

        <Tabs.Panel value="history">
          <Paper withBorder p="md" radius="md">
            <Group gap={6} mb="xs" pb={4} style={{ borderBottom: "1px solid #f1f5f9" }}>
              <IconHistory size={15} style={{ color: "#dc2626" }} />
              <Text fw={700} size="sm">Riwayat Input IT</Text>
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
                    {histColumns.map((c) => (
                      <Table.Th
                        key={c.key}
                        style={{ cursor: "pointer", userSelect: "none", color: "#fff", fontSize: 11 }}
                        onClick={() => {
                          if (adminHistSortKey === c.key) {
                            setAdminHistSortDir((d) => (d === "asc" ? "desc" : "asc"));
                          } else {
                            setAdminHistSortKey(c.key);
                            setAdminHistSortDir("asc");
                          }
                        }}
                      >
                        {c.label}{adminHistSortKey !== c.key ? " ↕" : adminHistSortDir === "asc" ? " ▲" : " ▼"}
                      </Table.Th>
                    ))}
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {list.length === 0 ? (
                    <Table.Tr>
                      <Table.Td colSpan={6} ta="center" c="dimmed" py="xl">
                        Belum ada data.
                      </Table.Td>
                    </Table.Tr>
                  ) : (
                    sortData(list, adminHistSortKey, adminHistSortDir).map((l: any, i: number) => (
                      <Table.Tr key={i}>
                        <Table.Td>{l.tanggalIT}</Table.Td>
                        <Table.Td>
                          <Badge size="xs" variant="light">
                            {l.jenisIT}
                          </Badge>
                        </Table.Td>
                        <Table.Td fw={600}>{l.nomorITTerima}</Table.Td>
                        <Table.Td fw={600}>{l.nomorITKirim}</Table.Td>
                        <Table.Td>{l.namaAdminInput}</Table.Td>
                        <Table.Td>
                          <Badge size="xs" color="green" variant="light">
                            {l.statusRelasi}
                          </Badge>
                        </Table.Td>
                      </Table.Tr>
                    ))
                  )}
                </Table.Tbody>
              </Table>
            </Box>
          </Paper>
        </Tabs.Panel>

        <Tabs.Panel value="relasi">
          <Paper withBorder p="md" radius="md">
            <Group gap={6} mb="xs" pb={4} style={{ borderBottom: "1px solid #f1f5f9" }}>
              <IconLink size={15} style={{ color: "#dc2626" }} />
              <Text fw={700} size="sm">Relasi Nomor IT ke Transaksi</Text>
            </Group>
            <Group mb="md">
              <TextInput
                size="xs"
                label="Start Date"
                type="date"
                value={transFilter.startDate}
                onChange={(e) =>
                  setTransFilter({ ...transFilter, startDate: e.currentTarget.value })
                }
              />
              <TextInput
                size="xs"
                label="End Date"
                type="date"
                value={transFilter.endDate}
                onChange={(e) =>
                  setTransFilter({ ...transFilter, endDate: e.currentTarget.value })
                }
              />
              <Select
                size="xs"
                label="Jenis"
                value={transFilter.jenis}
                onChange={(v) => setTransFilter({ ...transFilter, jenis: v || "BOTH" })}
                data={[
                  { value: "BOTH", label: "Semua" },
                  { value: "MASUK", label: "Barang Masuk" },
                  { value: "KELUAR", label: "Barang Keluar" },
                ]}
                style={{ width: 150 }}
              />
              <Button
                size="xs"
                color="red"
                leftSection={<IconHistory size={14} />}
                onClick={loadTransactions}
                style={{ alignSelf: "flex-end" }}
              >
                Muat Transaksi
              </Button>
            </Group>

            {(transFilter.jenis === "BOTH" || transFilter.jenis === "MASUK") && (
              <Box mb="md">
                <Text size="xs" fw={700} mb="xs">
                  Barang Masuk
                </Text>
                <Box style={{ maxHeight: 250, overflow: "auto" }}>
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
                        {bmColumns.map((c) => (
                          <Table.Th
                            key={c.key}
                            style={{ cursor: "pointer", userSelect: "none", color: "#fff", fontSize: 10 }}
                            onClick={() => {
                              if (adminBMasukSortKey === c.key) {
                                setAdminBMasukSortDir((d) => (d === "asc" ? "desc" : "asc"));
                              } else {
                                setAdminBMasukSortKey(c.key);
                                setAdminBMasukSortDir("asc");
                              }
                            }}
                          >
                            {c.label}{adminBMasukSortKey !== c.key ? " ↕" : adminBMasukSortDir === "asc" ? " ▲" : " ▼"}
                          </Table.Th>
                        ))}
                        <Table.Th style={{ color: "#fff", fontSize: 10 }}>IT Terima</Table.Th>
                        <Table.Th style={{ color: "#fff", fontSize: 10 }}>Aksi</Table.Th>
                      </Table.Tr>
                    </Table.Thead>
                    <Table.Tbody>
                      {transactions.masuk?.length === 0 ? (
                        <Table.Tr>
                          <Table.Td colSpan={7} ta="center" c="dimmed" py="md">
                            Tidak ada data.
                          </Table.Td>
                        </Table.Tr>
                      ) : (
                        sortData(transactions.masuk || [], adminBMasukSortKey, adminBMasukSortDir).map((m: any) => (
                          <Table.Tr key={m.id}>
                            <Table.Td>{m.tanggalBstb}</Table.Td>
                            <Table.Td>{m.nomorBstb}</Table.Td>
                            <Table.Td>{m.namaBarang}</Table.Td>
                            <Table.Td>{m.nomorBatch}</Table.Td>
                            <Table.Td>{m.lokasiRak}</Table.Td>
                            <Table.Td>
                              <TextInput
                                size="xs"
                                style={{ width: 120 }}
                                value={m.nomorITTerima || ""}
                                onChange={(e) =>
                                  setTransactions({
                                    ...transactions,
                                    masuk: transactions.masuk.map((x: any) =>
                                      x.id === m.id
                                        ? { ...x, nomorITTerima: e.currentTarget.value }
                                        : x,
                                    ),
                                  })
                                }
                              />
                            </Table.Td>
                            <Table.Td>
                              <Button
                                size="xs"
                                color="green"
                                onClick={() => updateITMasuk(m.id, m.nomorITTerima)}
                              >
                                Simpan
                              </Button>
                            </Table.Td>
                          </Table.Tr>
                        ))
                      )}
                    </Table.Tbody>
                  </Table>
                </Box>
              </Box>
            )}

            {(transFilter.jenis === "BOTH" || transFilter.jenis === "KELUAR") && (
              <Box>
                <Text size="xs" fw={700} mb="xs">
                  Barang Keluar
                </Text>
                <Box style={{ maxHeight: 250, overflow: "auto" }}>
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
                        {bkColumns.map((c) => (
                          <Table.Th
                            key={c.key}
                            style={{ cursor: "pointer", userSelect: "none", color: "#fff", fontSize: 10 }}
                            onClick={() => {
                              if (adminBKeluarSortKey === c.key) {
                                setAdminBKeluarSortDir((d) => (d === "asc" ? "desc" : "asc"));
                              } else {
                                setAdminBKeluarSortKey(c.key);
                                setAdminBKeluarSortDir("asc");
                              }
                            }}
                          >
                            {c.label}{adminBKeluarSortKey !== c.key ? " ↕" : adminBKeluarSortDir === "asc" ? " ▲" : " ▼"}
                          </Table.Th>
                        ))}
                        <Table.Th style={{ color: "#fff", fontSize: 10 }}>IT Kirim</Table.Th>
                        <Table.Th style={{ color: "#fff", fontSize: 10 }}>Aksi</Table.Th>
                      </Table.Tr>
                    </Table.Thead>
                    <Table.Tbody>
                      {transactions.keluar?.length === 0 ? (
                        <Table.Tr>
                          <Table.Td colSpan={8} ta="center" c="dimmed" py="md">
                            Tidak ada data.
                          </Table.Td>
                        </Table.Tr>
                      ) : (
                        sortData(transactions.keluar || [], adminBKeluarSortKey, adminBKeluarSortDir).map((k: any) => (
                          <Table.Tr key={k.id}>
                            <Table.Td>{k.tanggalDimuat}</Table.Td>
                            <Table.Td>{k.nomorSuratJalan}</Table.Td>
                            <Table.Td>{k.namaResto}</Table.Td>
                            <Table.Td>{k.namaBarang}</Table.Td>
                            <Table.Td>{k.nomorBatch}</Table.Td>
                            <Table.Td>{k.lokasiRak}</Table.Td>
                            <Table.Td>
                              <TextInput
                                size="xs"
                                style={{ width: 120 }}
                                value={k.nomorITKirim || ""}
                                onChange={(e) =>
                                  setTransactions({
                                    ...transactions,
                                    keluar: transactions.keluar.map((x: any) =>
                                      x.id === k.id
                                        ? { ...x, nomorITKirim: e.currentTarget.value }
                                        : x,
                                    ),
                                  })
                                }
                              />
                            </Table.Td>
                            <Table.Td>
                              <Button
                                size="xs"
                                color="green"
                                onClick={() => updateITKeluar(k.id, k.nomorITKirim)}
                              >
                                Simpan
                              </Button>
                            </Table.Td>
                          </Table.Tr>
                        ))
                      )}
                    </Table.Tbody>
                  </Table>
                </Box>
              </Box>
            )}
          </Paper>
        </Tabs.Panel>
      </Tabs>
    </Box>
  );
}
