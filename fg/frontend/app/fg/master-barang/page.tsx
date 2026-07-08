"use client";
import { useState, useEffect } from "react";
import { Title, Button, Group, TextInput, Modal, Stack, NumberInput, Select, Text, Badge, Box, Paper, Tabs, Textarea } from "@mantine/core";
import { Table } from '../components/Table';
import { useDisclosure } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";
import { IconPackage, IconPlus, IconTrash, IconUpload, IconDownload } from "@tabler/icons-react";
import api from "../lib/api";

export default function MasterBarangPage() {
  const [list, setList] = useState<any[]>([]);
  const [opened, { open, close }] = useDisclosure(false);
  const [form, setForm] = useState<any>({
    nama: "",
    satuanDefault: "Carton",
    statusDefault: "GOOD",
    lokasiRakDefault: "",
    umurExpiredBulan: 0,
  });
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [filterBarang, setFilterBarang] = useState<string | null>(null);
  const [csvText, setCsvText] = useState("");
  const [importResult, setImportResult] = useState<any>(null);
  const [importLoading, setImportLoading] = useState(false);

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

  const columns = [
    { label: "Nama", key: "nama" },
    { label: "Satuan", key: "satuanDefault" },
    { label: "Status Default", key: "statusDefault" },
    { label: "Rak Default", key: "lokasiRakDefault" },
    { label: "Expired (Bulan)", key: "umurExpiredBulan" },
  ];

  const load = () => {
    api
      .get("/master-barang")
      .then((res: any) => setList(res || []))
      .catch(() => {});
  };
  useEffect(() => {
    load();
  }, []);

  const handleSave = async () => {
    try {
      await api.post("/master-barang", form);
      notifications.show({
        title: "Berhasil",
        message: "Barang ditambahkan",
        color: "green",
      });
      close();
      setForm({
        nama: "",
        satuanDefault: "Carton",
        statusDefault: "GOOD",
        lokasiRakDefault: "",
        umurExpiredBulan: 0,
      });
      load();
    } catch (err: any) {
      notifications.show({
        title: "Gagal",
        message: err.response?.data?.message || "Error",
        color: "red",
      });
    }
  };

  const handleDelete = async (id: number) => {
    await api.delete(`/master-barang/${id}`);
    load();
  };

  const handleImportCsv = async () => {
    setImportLoading(true);
    try {
      const res: any = await api.post("/master-barang/import-csv", { csvText });
      setImportResult(res);
      notifications.show({
        title: "Import Selesai",
        message: res?.message || "CSV diproses",
        color: res?.failed ? "orange" : "green",
      });
      setCsvText("");
      load();
    } catch (err: any) {
      notifications.show({
        title: "Gagal",
        message: err.response?.data?.message || "Error",
        color: "red",
      });
    } finally {
      setImportLoading(false);
    }
  };

  const downloadTemplate = () => {
    const csv = `nama,satuan,status,rakDefault,expiredBulan\nContoh Barang,Carton,GOOD,R-A-01,6`;
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "template-master-barang.csv";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const barangOpts = [...new Set(list.map((b) => b.nama).filter(Boolean))].sort();
  const filteredList = list.filter((b) => !filterBarang || b.nama === filterBarang);

  return (
    <Box>
      {/* Header */}
      <Box
        style={{
          background: "#fff",
          borderLeft: "4px solid #0ea5e9",
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
              <IconPackage size={20} style={{ color: "#0ea5e9" }} />
              MASTER BARANG
            </Title>
            <Text size="xs" c="dimmed" mt={2}>
              Kelola database barang, satuan, dan umur expired.
            </Text>
          </Box>
          <Badge color="cyan" variant="light" size="lg">
            Master Data
          </Badge>
        </Group>
      </Box>

      <Paper withBorder p="md" radius="md">
        <Tabs defaultValue="data">
          <Tabs.List>
            <Tabs.Tab value="data">Data</Tabs.Tab>
            <Tabs.Tab value="import">Import CSV</Tabs.Tab>
          </Tabs.List>

          <Tabs.Panel value="data" pt="md">
            <Group mb="md">
              <Button
                size="xs"
                leftSection={<IconPlus size={14} />}
                onClick={open}
              >
                + Tambah Barang
              </Button>
              <Select
                size="xs"
                placeholder="Filter Barang"
                clearable
                searchable
                data={barangOpts}
                value={filterBarang}
                onChange={setFilterBarang}
                style={{ width: 180 }}
              />
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
                    {columns.map((c) => (
                      <Table.Th
                        key={c.key}
                        style={{ cursor: "pointer", userSelect: "none", color: "#fff", fontSize: 11 }}
                        onClick={() => {
                          if (sortKey === c.key) {
                            setSortDir((d) => (d === "asc" ? "desc" : "asc"));
                          } else {
                            setSortKey(c.key);
                            setSortDir("asc");
                          }
                        }}
                      >
                        {c.label}{sortKey !== c.key ? " ↕" : sortDir === "asc" ? " ▲" : " ▼"}
                      </Table.Th>
                    ))}
                    <Table.Th style={{ color: "#fff", fontSize: 11 }}>Aksi</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {sortData(filteredList, sortKey, sortDir).map((b: any) => (
                    <Table.Tr key={b.id}>
                      <Table.Td fw={500}>{b.nama}</Table.Td>
                      <Table.Td>{b.satuanDefault}</Table.Td>
                      <Table.Td>
                        <Badge size="xs" color={b.statusDefault === "GOOD" ? "green" : "yellow"}>
                          {b.statusDefault}
                        </Badge>
                      </Table.Td>
                      <Table.Td>
                        <Badge size="xs" variant="light" color="blue">
                          {b.lokasiRakDefault}
                        </Badge>
                      </Table.Td>
                      <Table.Td>{b.umurExpiredBulan}</Table.Td>
                      <Table.Td>
                        <Button
                          size="xs"
                          color="red"
                          variant="subtle"
                          leftSection={<IconTrash size={12} />}
                          onClick={() => handleDelete(b.id)}
                        >
                          Hapus
                        </Button>
                      </Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            </Box>
          </Tabs.Panel>

          <Tabs.Panel value="import" pt="md">
            <Stack>
              <Text size="xs" c="dimmed">
                Paste CSV atau download template terlebih dahulu. Header: nama, satuan, status, rakDefault, expiredBulan
              </Text>
              <Group>
                <Button size="xs" variant="light" color="blue" leftSection={<IconDownload size={14} />} onClick={downloadTemplate}>
                  Download Template
                </Button>
              </Group>
              <Textarea
                value={csvText}
                onChange={(e) => setCsvText(e.currentTarget.value)}
                placeholder="nama,satuan,status,rakDefault,expiredBulan&#10;Nugget Ayam,Carton,GOOD,R-A-01,6"
                minRows={8}
                style={{ fontFamily: "monospace", fontSize: 12 }}
              />
              <Group>
                <Button size="xs" color="orange" leftSection={<IconUpload size={14} />} onClick={handleImportCsv} loading={importLoading} disabled={!csvText.trim()}>
                  Import
                </Button>
              </Group>
              {importResult && (
                <Box p="sm" style={{ background: importResult.failed ? "#fff7ed" : "#f0fdf4", border: `1px solid ${importResult.failed ? "#fed7aa" : "#86efac"}`, borderRadius: 8 }}>
                  <Text size="sm" fw={700} c={importResult.failed ? "orange" : "green"}>{importResult.message}</Text>
                  {importResult.errors?.length > 0 && (
                    <Stack gap={2} mt="xs">
                      {importResult.errors.map((e: string, i: number) => <Text key={i} size="xs" c="red">{e}</Text>)}
                    </Stack>
                  )}
                </Box>
              )}
            </Stack>
          </Tabs.Panel>
        </Tabs>
      </Paper>

      <Modal
        opened={opened}
        onClose={close}
        title={<Text fw={900}>Tambah Barang</Text>}
        centered
      >
        <Stack>
          <TextInput
            size="xs"
            label="Nama Barang"
            value={form.nama}
            onChange={(e) => setForm({ ...form, nama: e.currentTarget.value })}
            required
          />
          <Select
            size="xs"
            label="Satuan Default"
            data={["Carton", "Pack", "Kg", "Pcs"]}
            value={form.satuanDefault}
            onChange={(v) => setForm({ ...form, satuanDefault: v })}
          />
          <NumberInput
            size="xs"
            label="Umur Expired (Bulan)"
            value={form.umurExpiredBulan}
            onChange={(v) => setForm({ ...form, umurExpiredBulan: v as number })}
          />
          <TextInput
            size="xs"
            label="Lokasi Rak Default"
            value={form.lokasiRakDefault}
            onChange={(e) =>
              setForm({ ...form, lokasiRakDefault: e.currentTarget.value })
            }
          />
          <Button size="xs" onClick={handleSave}>
            Simpan
          </Button>
        </Stack>
      </Modal>
    </Box>
  );
}
