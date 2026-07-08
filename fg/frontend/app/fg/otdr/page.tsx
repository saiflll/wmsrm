"use client";
import { useState, useEffect } from "react";
import { Title, Card, Button, Group, Badge, TextInput, Select, Stack, Modal, Text, Textarea, ActionIcon, Tabs, Box, Paper } from "@mantine/core";
import { Table } from '../components/Table';
import { useDisclosure } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";
import {
  IconCheck,
  IconTruckDelivery,
  IconFileAlert,
  IconCircleCheck,
  IconBrandWhatsapp,
} from "@tabler/icons-react";
import api from "../lib/api";

function OtdrTable({ data, load }: { data: any[]; load: () => void }) {
  const [opened, { open, close }] = useDisclosure(false);
  const [sel, setSel] = useState<any>(null);
  const [muatForm, setMuatForm] = useState({
    startMuat: "",
    selesaiMuat: "",
    namaNamaYangMuat: "",
    nopol: "",
    waSopir: "",
    namaSopir: "",
    catatan: "",
  });

  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  const sortData = (d: any[], key: string | null, dir: "asc" | "desc") => {
    if (!key) return d;
    return [...d].sort((a, b) => {
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

  const openMuat = (o: any) => {
    setSel(o);
    setMuatForm({
      startMuat: o.startMuat || "",
      selesaiMuat: o.selesaiMuat || "",
      namaNamaYangMuat: o.namaNamaYangMuat || "",
      nopol: o.nopol || "",
      waSopir: o.waSopir || "",
      namaSopir: o.namaSopir || "",
      catatan: o.catatan || "",
    });
    open();
  };

  const handleMuat = async () => {
    try {
      await api.put("/otdr/muat", { idOtdr: sel.idOtdr, ...muatForm });
      notifications.show({
        title: "Berhasil",
        message: "Data muat tersimpan",
        color: "green",
      });
      close();
      load();
    } catch (err: any) {
      notifications.show({
        title: "Gagal",
        message: err.response?.data?.message || "Error",
        color: "red",
      });
    }
  };

  const handleComplete = async (idOtdr: string) => {
    try {
      await api.put("/otdr/complete", { idOtdr });
      notifications.show({
        title: "Berhasil",
        message: "OTDR Complete",
        color: "green",
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

  const sendWaLink = (o: any) => {
    const phone = (o.waSopir || "").replace(/\D/g, "");
    if (!phone) {
      notifications.show({
        title: "WA Sopir",
        message: "Nomor WA sopir belum diisi.",
        color: "red",
      });
      return;
    }
    const base = typeof window !== "undefined" ? window.location.origin : "";
    const link = `${base}/driver-dashboard?token=${o.tokenDashboardSopir}`;
    const text = encodeURIComponent(
      `Halo ${o.namaSopir || "Sopir"}, link dashboard bukti terima untuk pengiriman ${o.nomorSuratJalan} ke ${o.namaResto}: ${link}`,
    );
    window.open(`https://wa.me/${phone}?text=${text}`, "_blank");
  };

  const otdrColumns = [
    { label: "ID OTDR", key: "idOtdr" },
    { label: "Tanggal", key: "tanggalDimuat" },
    { label: "Resto", key: "namaResto" },
    { label: "SJ", key: "nomorSuratJalan" },
    { label: "Nopol", key: "nopol" },
    { label: "Item", key: "totalItemOutput" },
    { label: "Qty", key: "totalQtyOutput" },
    { label: "Start", key: "startMuat" },
    { label: "Selesai", key: "selesaiMuat" },
  ];

  return (
    <>
      <Table striped>
        <Table.Thead>
          <Table.Tr>
            {otdrColumns.map((c) => (
              <Table.Th
                key={c.key}
                style={{ cursor: "pointer", userSelect: "none", fontSize: 11 }}
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
            <Table.Th style={{ fontSize: 11 }}>Aksi</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {sortData(data, sortKey, sortDir).length === 0 ? (
            <Table.Tr>
              <Table.Td colSpan={10} ta="center" c="dimmed">
                Tidak ada data
              </Table.Td>
            </Table.Tr>
          ) : (
            sortData(data, sortKey, sortDir).map((o: any) => (
              <Table.Tr key={o.idOtdr}>
                <Table.Td fw={700}>{o.idOtdr}</Table.Td>
                <Table.Td>{o.tanggalDimuat}</Table.Td>
                <Table.Td>
                  {o.kodeResto} - {o.namaResto}
                </Table.Td>
                <Table.Td>{o.nomorSuratJalan}</Table.Td>
                <Table.Td>{o.nopol}</Table.Td>
                <Table.Td>{o.totalItemOutput}</Table.Td>
                <Table.Td>{o.totalQtyOutput}</Table.Td>
                <Table.Td>{o.startMuat || "-"}</Table.Td>
                <Table.Td>{o.selesaiMuat || "-"}</Table.Td>
                <Table.Td>
                  <Group gap="xs">
                    <Button
                      size="xs"
                      variant="light"
                      onClick={() => openMuat(o)}
                    >
                      {o.startMuat ? "Edit" : "Muat"}
                    </Button>
                    {o.waSopir && (
                      <ActionIcon
                        color="green"
                        variant="light"
                        onClick={() => sendWaLink(o)}
                        title="Kirim link dashboard via WA"
                      >
                        <IconBrandWhatsapp size={16} />
                      </ActionIcon>
                    )}
                    {o.statusOtdr !== "COMPLETE" && (
                      <ActionIcon
                        color="green"
                        variant="light"
                        onClick={() => handleComplete(o.idOtdr)}
                        title="Tandai Complete"
                      >
                        <IconCheck size={16} />
                      </ActionIcon>
                    )}
                  </Group>
                </Table.Td>
              </Table.Tr>
            ))
          )}
        </Table.Tbody>
      </Table>

      <Modal
        opened={opened}
        onClose={close}
        title={`Muat: ${sel?.idOtdr}`}
        centered
        size="md"
      >
        <Stack gap="sm">
          <Text size="sm" fw={600}>
            Resto: {sel?.kodeResto} - {sel?.namaResto}
          </Text>
          <Group grow>
            <TextInput
              label="Start Muat"
              type="datetime-local"
              value={muatForm.startMuat}
              onChange={(e) =>
                setMuatForm({ ...muatForm, startMuat: e.currentTarget.value })
              }
            />
            <TextInput
              label="Selesai Muat"
              type="datetime-local"
              value={muatForm.selesaiMuat}
              onChange={(e) =>
                setMuatForm({ ...muatForm, selesaiMuat: e.currentTarget.value })
              }
            />
          </Group>
          <Group grow>
            <TextInput
              label="Nopol"
              value={muatForm.nopol}
              onChange={(e) =>
                setMuatForm({ ...muatForm, nopol: e.currentTarget.value })
              }
            />
            <TextInput
              label="Nama Sopir"
              value={muatForm.namaSopir}
              onChange={(e) =>
                setMuatForm({ ...muatForm, namaSopir: e.currentTarget.value })
              }
            />
          </Group>
          <TextInput
            label="WA Sopir"
            value={muatForm.waSopir}
            onChange={(e) =>
              setMuatForm({ ...muatForm, waSopir: e.currentTarget.value })
            }
          />
          <Textarea
            label="Nama-Nama Yang Muat"
            value={muatForm.namaNamaYangMuat}
            onChange={(e) =>
              setMuatForm({
                ...muatForm,
                namaNamaYangMuat: e.currentTarget.value,
              })
            }
          />
          <Textarea
            label="Catatan"
            value={muatForm.catatan}
            onChange={(e) =>
              setMuatForm({ ...muatForm, catatan: e.currentTarget.value })
            }
          />
          <Button onClick={handleMuat} fullWidth>
            Simpan
          </Button>
        </Stack>
      </Modal>
    </>
  );
}

export default function OtdrPage() {
  const [otdrList, setOtdrList] = useState<any[]>([]);
  const [filter, setFilter] = useState("");
  const [filterResto, setFilterResto] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<string | null>("draft");

  useEffect(() => {
    load();
  }, []);

  const load = () => {
    api
      .get("/otdr")
      .then((res: any) => setOtdrList(res || []))
      .catch(() => {});
  };

  const restoOpts = [...new Set(otdrList.map((o) => o.namaResto).filter(Boolean))].sort();
  const all = otdrList.filter(
    (o: any) =>
      (!filter ||
        o.kodeResto?.toLowerCase().includes(filter.toLowerCase()) ||
        o.namaResto?.toLowerCase().includes(filter.toLowerCase()) ||
        o.idOtdr?.toLowerCase().includes(filter.toLowerCase())) &&
      (!filterResto || o.namaResto === filterResto),
  );
  const drafts = all.filter((o) => o.statusOtdr !== "COMPLETE");
  const complete = all.filter((o) => o.statusOtdr === "COMPLETE");

  return (
    <Box>
      {/* Header */}
      <Box
        style={{
          background: "#fff",
          borderLeft: "4px solid #0891b2",
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
              <IconTruckDelivery size={20} style={{ color: "#0891b2" }} />
              OTDR - OUTBOUND TRACKING
            </Title>
            <Text size="xs" c="dimmed" mt={2}>
              Tracking pengiriman barang keluar, proses muat, dan status
              pengiriman.
            </Text>
          </Box>
          <Badge color="cyan" variant="light" size="lg">
            Delivery Tracking
          </Badge>
        </Group>
      </Box>

      <Paper withBorder p="md" radius="md">
        <Group mb="md" wrap="wrap">
          <TextInput
            placeholder="Cari OTDR..."
            value={filter}
            onChange={(e) => setFilter(e.currentTarget.value)}
            style={{ flex: 1, minWidth: 200 }}
          />
          <Select
            size="xs"
            placeholder="Filter Resto"
            data={restoOpts}
            value={filterResto}
            onChange={setFilterResto}
            clearable
            searchable
            style={{ width: 180 }}
          />
        </Group>

        <Tabs value={activeTab} onChange={setActiveTab}>
          <Tabs.List mb="md">
            <Tabs.Tab
              value="draft"
              leftSection={<IconFileAlert size={15} />}
            >
              DRAFT / MUAT{" "}
              <Badge ml={6} color="yellow" size="xs">
                {drafts.length}
              </Badge>
            </Tabs.Tab>
            <Tabs.Tab
              value="complete"
              leftSection={<IconCircleCheck size={15} />}
            >
              COMPLETE{" "}
              <Badge ml={6} color="green" size="xs">
                {complete.length}
              </Badge>
            </Tabs.Tab>
          </Tabs.List>

          <Tabs.Panel value="draft">
            <OtdrTable data={drafts} load={load} />
          </Tabs.Panel>
          <Tabs.Panel value="complete">
            <OtdrTable data={complete} load={load} />
          </Tabs.Panel>
        </Tabs>
      </Paper>
    </Box>
  );
}
