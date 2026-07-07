"use client";
import { useState, useEffect } from "react";
import {
  Title,
  Table,
  Button,
  Group,
  TextInput,
  Modal,
  Stack,
  NumberInput,
  Select,
  Text,
  Badge,
  Box,
  Paper,
  Tabs,
  Textarea,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";
import { IconLayoutGrid, IconPlus, IconTrash, IconCheck, IconX, IconPencil, IconUpload, IconDownload } from "@tabler/icons-react";
import api from "../lib/api";

export default function MasterRakPage() {
  const [list, setList] = useState<any[]>([]);
  const [opened, { open, close }] = useDisclosure(false);
  const [form, setForm] = useState<any>({
    lokasiRak: "",
    kapasitasRak: 100,
    jenisRak: "DEDICATED",
  });
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<any>({ kapasitasRak: 0, jenisRak: "" });
  const [lastOutMap, setLastOutMap] = useState<Record<string, any>>({});
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [filterJenis, setFilterJenis] = useState<string | null>(null);
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
    { label: "Lokasi Rak", key: "lokasiRak" },
    { label: "Kapasitas", key: "kapasitasRak" },
    { label: "Jenis", key: "jenisRak" },
  ];

  const load = () => {
    api
      .get("/master-rak")
      .then((res: any) => setList(res || []))
      .catch(() => {});
    api
      .get("/master-rak/last-out")
      .then((res: any) => {
        const map: Record<string, any> = {};
        (res || []).forEach((item: any) => {
          map[item.lokasiRak] = item.info;
        });
        setLastOutMap(map);
      })
      .catch(() => {});
  };
  useEffect(() => {
    load();
  }, []);

  const handleSave = async () => {
    try {
      await api.post("/master-rak", form);
      notifications.show({
        title: "Berhasil",
        message: "Rak ditambahkan",
        color: "green",
      });
      close();
      setForm({ lokasiRak: "", kapasitasRak: 100, jenisRak: "DEDICATED" });
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
    await api.delete(`/master-rak/${id}`);
    load();
  };

  const handleImportCsv = async () => {
    setImportLoading(true);
    try {
      const res: any = await api.post("/master-rak/import-csv", { csvText });
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
    const csv = `lokasiRak,kapasitas,jenis\nR-Z-01,100,DEDICATED`;
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "template-master-rak.csv";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const startEdit = (r: any) => {
    setEditingId(r.id);
    setEditForm({ kapasitasRak: r.kapasitasRak, jenisRak: r.jenisRak });
  };

  const handleUpdate = async () => {
    try {
      await api.put(`/master-rak/${editingId}`, editForm);
      notifications.show({
        title: "Berhasil",
        message: "Rak diupdate",
        color: "green",
      });
      setEditingId(null);
      load();
    } catch (err: any) {
      notifications.show({
        title: "Gagal",
        message: err.response?.data?.message || "Error",
        color: "red",
      });
    }
  };

  const jenisOpts = [...new Set(list.map((r) => r.jenisRak).filter(Boolean))].sort();
  const filteredList = list.filter((r) => !filterJenis || r.jenisRak === filterJenis);

  return (
    <Box>
      {/* Header */}
      <Box
        style={{
          background: "#fff",
          borderLeft: "4px solid #8b5cf6",
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
              <IconLayoutGrid size={20} style={{ color: "#8b5cf6" }} />
              MASTER RAK
            </Title>
            <Text size="xs" c="dimmed" mt={2}>
              Kelola database rak (DEDICATED / FLOOR) dan kapasitas.
            </Text>
          </Box>
          <Badge color="violet" variant="light" size="lg">
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
                + Tambah Rak
              </Button>
              <Select
                size="xs"
                placeholder="Filter Jenis"
                clearable
                searchable
                data={jenisOpts}
                value={filterJenis}
                onChange={setFilterJenis}
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
                    <Table.Th style={{ color: "#fff", fontSize: 11 }}>Last Out</Table.Th>
                    <Table.Th style={{ color: "#fff", fontSize: 11 }}>Aksi</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {sortData(filteredList, sortKey, sortDir).map((r: any) => (
                    <Table.Tr key={r.id}>
                      <Table.Td fw={700} c="blue">
                        {r.lokasiRak}
                      </Table.Td>
                      <Table.Td>
                        {editingId === r.id ? (
                          <NumberInput
                            size="xs"
                            value={editForm.kapasitasRak}
                            onChange={(v) =>
                              setEditForm({ ...editForm, kapasitasRak: v as number })
                            }
                            min={0}
                            allowDecimal={false}
                            style={{ width: 100 }}
                          />
                        ) : (
                          r.kapasitasRak
                        )}
                      </Table.Td>
                      <Table.Td>
                        {editingId === r.id ? (
                          <Select
                            size="xs"
                            data={["DEDICATED", "FLOOR"]}
                            value={editForm.jenisRak}
                            onChange={(v) =>
                              setEditForm({ ...editForm, jenisRak: v })
                            }
                            style={{ width: 120 }}
                          />
                        ) : (
                          <Badge
                            size="xs"
                            color={r.jenisRak === "DEDICATED" ? "blue" : "gray"}
                          >
                            {r.jenisRak}
                          </Badge>
                        )}
                      </Table.Td>
                      <Table.Td>
                        {lastOutMap[r.lokasiRak] ? (
                          <Stack gap={0}>
                            <Text size="xs" fw={700} c="orange">
                              {lastOutMap[r.lokasiRak].tanggalKeluar}
                            </Text>
                            <Text size="xs">
                              {lastOutMap[r.lokasiRak].namaBarang} ({lastOutMap[r.lokasiRak].qtyKeluar} {lastOutMap[r.lokasiRak].satuan})
                            </Text>
                            <Text size="xs" c="dimmed">
                              SJ: {lastOutMap[r.lokasiRak].nomorSuratJalan || "-"}
                            </Text>
                          </Stack>
                        ) : (
                          <Text size="xs" c="dimmed">-</Text>
                        )}
                      </Table.Td>
                      <Table.Td>
                        <Group gap="xs">
                          {editingId === r.id ? (
                            <>
                              <Button
                                size="xs"
                                color="green"
                                variant="light"
                                leftSection={<IconCheck size={12} />}
                                onClick={handleUpdate}
                              >
                                Simpan
                              </Button>
                              <Button
                                size="xs"
                                variant="default"
                                leftSection={<IconX size={12} />}
                                onClick={() => setEditingId(null)}
                              >
                                Batal
                              </Button>
                            </>
                          ) : (
                            <>
                              <Button
                                size="xs"
                                color="blue"
                                variant="subtle"
                                leftSection={<IconPencil size={12} />}
                                onClick={() => startEdit(r)}
                              >
                                Edit
                              </Button>
                              <Button
                                size="xs"
                                color="red"
                                variant="subtle"
                                leftSection={<IconTrash size={12} />}
                                onClick={() => handleDelete(r.id)}
                              >
                                Hapus
                              </Button>
                            </>
                          )}
                        </Group>
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
                Paste CSV atau download template terlebih dahulu. Header: lokasiRak, kapasitas, jenis
              </Text>
              <Group>
                <Button size="xs" variant="light" color="blue" leftSection={<IconDownload size={14} />} onClick={downloadTemplate}>
                  Download Template
                </Button>
              </Group>
              <Textarea
                value={csvText}
                onChange={(e) => setCsvText(e.currentTarget.value)}
                placeholder="lokasiRak,kapasitas,jenis&#10;R-Z-01,100,DEDICATED"
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
        title={<Text fw={900}>Tambah Rak</Text>}
        centered
      >
        <Stack>
          <TextInput
            size="xs"
            label="Lokasi Rak"
            value={form.lokasiRak}
            onChange={(e) =>
              setForm({ ...form, lokasiRak: e.currentTarget.value })
            }
            required
            placeholder="Cth: R-A1"
          />
          <NumberInput
            size="xs"
            label="Kapasitas"
            value={form.kapasitasRak}
            onChange={(v) => setForm({ ...form, kapasitasRak: v as number })}
          />
          <Select
            size="xs"
            label="Jenis Rak"
            data={["DEDICATED", "FLOOR"]}
            value={form.jenisRak}
            onChange={(v) => setForm({ ...form, jenisRak: v })}
          />
          <Button size="xs" onClick={handleSave}>
            Simpan
          </Button>
        </Stack>
      </Modal>
    </Box>
  );
}
