"use client";
import { useState } from "react";
import {
  Title,
  Button,
  Group,
  Stack,
  TextInput,
  Select,
  NumberInput,
  Text,
  Badge,
  Box,
  Paper,
  SimpleGrid,
  Modal,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";
import {
  IconUpload,
  IconClock,
  IconUserShield,
} from "@tabler/icons-react";
import api from "../lib/api";

export default function SupervisorPage() {
  const [opened, { open, close }] = useDisclosure(false);
  const [importRows, setImportRows] = useState<any[]>([
    {
      namaBarang: "",
      tanggalProduksi: "",
      qty: 0,
      satuan: "Carton",
      status: "GOOD",
      lokasiRak: "",
      shiftKoordinator: "",
    },
  ]);

  const handleImport = async () => {
    try {
      const res = await api.post("/import-stock", { rows: importRows });
      notifications.show({
        title: "Import Selesai",
        message: (res as any)?.message || "Stock berhasil diimport",
        color: "green",
      });
      close();
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
              <IconUserShield size={20} style={{ color: "#7c3aed" }} />
              SUPERVISOR
            </Title>
            <Text size="xs" c="dimmed" mt={2}>
              Import stock awal dan time motion study.
            </Text>
          </Box>
          <Badge color="violet" variant="light" size="lg">
            Supervisor Tools
          </Badge>
        </Group>
      </Box>

      <SimpleGrid cols={2}>
        <Paper withBorder p="md" radius="md">
          <Group gap={6} mb="xs" pb={4} style={{ borderBottom: "1px solid #f1f5f9" }}>
            <IconUpload size={15} style={{ color: "#7c3aed" }} />
            <Text fw={700} size="sm">Import Stock Awal</Text>
          </Group>
          <Text size="xs" c="dimmed" mb="sm">
            Import stok awal dari template spreadsheet ke sistem.
          </Text>
          <Button size="xs" leftSection={<IconUpload size={14} />} onClick={open}>
            Buka Form Import
          </Button>
        </Paper>

        <Paper withBorder p="md" radius="md">
          <Group gap={6} mb="xs" pb={4} style={{ borderBottom: "1px solid #f1f5f9" }}>
            <IconClock size={15} style={{ color: "#7c3aed" }} />
            <Text fw={700} size="sm">Time Motion Study</Text>
          </Group>
          <Text size="xs" c="dimmed" mb="sm">
            Fitur untuk mengukur durasi barang masuk dan keluar.
          </Text>
        </Paper>
      </SimpleGrid>

      <Modal opened={opened} onClose={close} title="Import Stock Awal" size="xl" centered>
        <Stack>
          {importRows.map((row, idx) => (
            <Group key={idx} grow>
              <TextInput
                size="xs"
                label="Nama Barang"
                value={row.namaBarang}
                onChange={(e) => {
                  const r = [...importRows];
                  r[idx] = { ...r[idx], namaBarang: e.currentTarget.value };
                  setImportRows(r);
                }}
              />
              <TextInput
                size="xs"
                label="Tgl Produksi"
                type="date"
                value={row.tanggalProduksi}
                onChange={(e) => {
                  const r = [...importRows];
                  r[idx] = {
                    ...r[idx],
                    tanggalProduksi: e.currentTarget.value,
                  };
                  setImportRows(r);
                }}
              />
              <NumberInput
                size="xs"
                label="Qty"
                value={row.qty}
                onChange={(v) => {
                  const r = [...importRows];
                  r[idx] = { ...r[idx], qty: v };
                  setImportRows(r);
                }}
                min={0}
                allowDecimal={false}
              />
              <TextInput
                size="xs"
                label="Lokasi Rak"
                value={row.lokasiRak}
                onChange={(e) => {
                  const r = [...importRows];
                  r[idx] = { ...r[idx], lokasiRak: e.currentTarget.value };
                  setImportRows(r);
                }}
              />
            </Group>
          ))}
          <Button size="xs" variant="light" onClick={() =>
            setImportRows([
              ...importRows,
              { namaBarang: "", tanggalProduksi: "", qty: 0, satuan: "Carton", status: "GOOD", lokasiRak: "", shiftKoordinator: "" },
            ])
          }>
            + Tambah Baris
          </Button>
          <Button size="xs" onClick={handleImport}>Import Stock</Button>
        </Stack>
      </Modal>
    </Box>
  );
}
