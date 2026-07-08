"use client";
import { useState, useEffect } from "react";
import { Title, Button, Group, TextInput, Modal, Stack, Text, Badge, Box, Paper, Select, Tabs, Textarea } from "@mantine/core";
import { Table } from '../components/Table';
import { useDisclosure } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";
import { IconBuildingStore, IconPlus, IconTrash, IconUpload, IconDownload } from "@tabler/icons-react";
import api from "../lib/api";

export default function MasterRestoPage() {
  const [list, setList] = useState<any[]>([]);
  const [opened, { open, close }] = useDisclosure(false);
  const [form, setForm] = useState<any>({
    kode: "",
    nama: "",
    nopol: "",
    wa: "",
    sopir: "",
    keterangan: "",
  });
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [filterNama, setFilterNama] = useState<string | null>(null);
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
    { label: "Kode", key: "kode" },
    { label: "Nama", key: "nama" },
    { label: "Nopol", key: "nopol" },
    { label: "WA", key: "wa" },
    { label: "Sopir", key: "sopir" },
  ];

  const load = () => {
    api
      .get("/master-resto")
      .then((res: any) => setList(res || []))
      .catch(() => {});
  };
  useEffect(() => {
    load();
  }, []);

  const handleSave = async () => {
    try {
      await api.post("/master-resto", form);
      notifications.show({
        title: "Berhasil",
        message: "Resto ditambahkan",
        color: "green",
      });
      close();
      setForm({
        kode: "",
        nama: "",
        nopol: "",
        wa: "",
        sopir: "",
        keterangan: "",
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
    await api.delete(`/master-resto/${id}`);
    load();
  };

  const handleImportCsv = async () => {
    setImportLoading(true);
    try {
      const res: any = await api.post("/master-resto/import-csv", { csvText });
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
    const csv = `kode,nama,nopol,wa,sopir,keterangan\nSB001,Sabana Raya,B 1234 CD,08123456789,Andi,`;
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "template-master-resto.csv";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const namaOpts = [...new Set(list.map((r) => r.nama).filter(Boolean))].sort();
  const filteredList = list.filter((r) => !filterNama || r.nama === filterNama);

  return (
    <Box>
      {/* Header */}
      <Box
        style={{
          background: "#fff",
          borderLeft: "4px solid #e11d48",
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
              <IconBuildingStore size={20} style={{ color: "#e11d48" }} />
              MASTER RESTO / TUJUAN
            </Title>
            <Text size="xs" c="dimmed" mt={2}>
              Kelola database resto tujuan pengiriman.
            </Text>
          </Box>
          <Badge color="red" variant="light" size="lg">
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
                + Tambah Resto
              </Button>
              <Select
                size="xs"
                placeholder="Filter Nama"
                clearable
                searchable
                data={namaOpts}
                value={filterNama}
                onChange={setFilterNama}
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
                  {sortData(filteredList, sortKey, sortDir).map((r: any) => (
                    <Table.Tr key={r.id}>
                      <Table.Td fw={700}>{r.kode}</Table.Td>
                      <Table.Td>{r.nama}</Table.Td>
                      <Table.Td>{r.nopol}</Table.Td>
                      <Table.Td>{r.wa}</Table.Td>
                      <Table.Td>{r.sopir}</Table.Td>
                      <Table.Td>
                        <Button
                          size="xs"
                          color="red"
                          variant="subtle"
                          leftSection={<IconTrash size={12} />}
                          onClick={() => handleDelete(r.id)}
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
                Paste CSV atau download template terlebih dahulu. Header: kode, nama, nopol, wa, sopir, keterangan
              </Text>
              <Group>
                <Button size="xs" variant="light" color="blue" leftSection={<IconDownload size={14} />} onClick={downloadTemplate}>
                  Download Template
                </Button>
              </Group>
              <Textarea
                value={csvText}
                onChange={(e) => setCsvText(e.currentTarget.value)}
                placeholder="kode,nama,nopol,wa,sopir,keterangan&#10;SB001,Sabana Raya,B 1234 CD,08123456789,Andi,"
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
        title={<Text fw={900}>Tambah Resto</Text>}
        centered
      >
        <Stack>
          <TextInput
            size="xs"
            label="Kode Resto"
            value={form.kode}
            onChange={(e) => setForm({ ...form, kode: e.currentTarget.value })}
            required
          />
          <TextInput
            size="xs"
            label="Nama Resto"
            value={form.nama}
            onChange={(e) => setForm({ ...form, nama: e.currentTarget.value })}
            required
          />
          <TextInput
            size="xs"
            label="Nopol"
            value={form.nopol}
            onChange={(e) => setForm({ ...form, nopol: e.currentTarget.value })}
          />
          <TextInput
            size="xs"
            label="WA Sopir"
            value={form.wa}
            onChange={(e) => setForm({ ...form, wa: e.currentTarget.value })}
          />
          <TextInput
            size="xs"
            label="Nama Sopir"
            value={form.sopir}
            onChange={(e) => setForm({ ...form, sopir: e.currentTarget.value })}
          />
          <TextInput
            size="xs"
            label="Keterangan"
            value={form.keterangan}
            onChange={(e) =>
              setForm({ ...form, keterangan: e.currentTarget.value })
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
