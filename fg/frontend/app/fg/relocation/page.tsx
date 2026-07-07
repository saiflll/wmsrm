"use client";
import { useState, useEffect } from "react";
import {
  Title,
  Table,
  Group,
  TextInput,
  Select,
  Text,
  Box,
  Badge,
  Button,
  Paper,
  Stack,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import {
  IconArrowsShuffle,
  IconCheck,
} from "@tabler/icons-react";
import api from "../lib/api";

export default function RelocationPage() {
  const [stocks, setStocks] = useState<any[]>([]);
  const [rakList, setRakList] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [relocLokasi, setRelocLokasi] = useState("");
  const [relocStatus, setRelocStatus] = useState("");
  const [relocKet, setRelocKet] = useState("");
  const [relocLoading, setRelocLoading] = useState(false);
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    const stored = localStorage.getItem("fg_user");
    if (stored) setUser(JSON.parse(stored));
    load();
  }, []);

  const load = () => {
    api.get("/stock?available=true").then((r: any) => setStocks(r || [])).catch(() => {});
    api.get("/master-rak").then((r: any) => setRakList(r || [])).catch(() => {});
  };

  const filtered = stocks.filter(
    (s) =>
      !search ||
      s.namaBarang?.toLowerCase().includes(search.toLowerCase()) ||
      s.idStock?.toLowerCase().includes(search.toLowerCase()) ||
      s.lokasiRak?.toLowerCase().includes(search.toLowerCase()) ||
      s.nomorBatch?.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <Box>
      <Box
        style={{
          background: "#fff",
          borderLeft: "4px solid #f97316",
          padding: "14px 20px",
          marginBottom: 16,
          borderRadius: 8,
          boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
        }}
      >
        <Group justify="space-between">
          <Box>
            <Title order={4} style={{ color: "#111827", fontWeight: 800, display: "flex", alignItems: "center", gap: 8 }}>
              <IconArrowsShuffle size={20} style={{ color: "#f97316" }} />
              RELOCATION — PINDAH STOK
            </Title>
            <Text size="xs" c="dimmed" mt={2}>
              Pilih beberapa item sekaligus untuk dipindahkan ke rak lain atau diubah statusnya.
            </Text>
          </Box>
          <Badge color="orange" variant="light" size="lg">
            Multi Move
          </Badge>
        </Group>
      </Box>

      <Paper withBorder p="md" radius="md">
        <Group mb="md" wrap="wrap">
          <TextInput
            placeholder="Cari barang, ID stock, rak, batch..."
            value={search}
            onChange={(e) => setSearch(e.currentTarget.value)}
            style={{ flex: 1, minWidth: 200 }}
          />
        </Group>

        <Box style={{ maxHeight: 450, overflow: "auto" }} mb="md">
          <Table striped style={{ fontSize: 11 }}>
            <Table.Thead style={{ background: "#111827", position: "sticky", top: 0, zIndex: 1 }}>
              <Table.Tr>
                <Table.Th style={{ color: "#fff", fontSize: 11, width: 40 }}>
                  <input
                    type="checkbox"
                    checked={selectedIds.length === filtered.length && filtered.length > 0}
                    onChange={(e) => {
                      if (e.target.checked) setSelectedIds(filtered.map((s) => s.idStock));
                      else setSelectedIds([]);
                    }}
                  />
                </Table.Th>
                {["ID Stock", "Barang", "Rak", "Batch", "Qty", "Status"].map((h) => (
                  <Table.Th key={h} style={{ color: "#fff", fontSize: 11 }}>{h}</Table.Th>
                ))}
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {filtered.length === 0 ? (
                <Table.Tr><Table.Td colSpan={7} ta="center" c="dimmed" py="xl">Tidak ada stok.</Table.Td></Table.Tr>
              ) : (
                filtered.map((s: any) => (
                  <Table.Tr
                    key={s.idStock}
                    style={{ background: selectedIds.includes(s.idStock) ? "#fff7ed" : undefined }}
                  >
                    <Table.Td>
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(s.idStock)}
                        onChange={(e) => {
                          if (e.target.checked) setSelectedIds([...selectedIds, s.idStock]);
                          else setSelectedIds(selectedIds.filter((id) => id !== s.idStock));
                        }}
                      />
                    </Table.Td>
                    <Table.Td><Badge size="xs" variant="light" color="gray">{s.idStock}</Badge></Table.Td>
                    <Table.Td fw={500}>{s.namaBarang}</Table.Td>
                    <Table.Td><Badge size="xs" variant="light" color="blue">{s.lokasiRak}</Badge></Table.Td>
                    <Table.Td>{s.nomorBatch}</Table.Td>
                    <Table.Td ta="right" fw={700}>{s.stockOnhand}</Table.Td>
                    <Table.Td>
                      <Badge size="xs" color={s.status === "GOOD" ? "green" : s.status === "HOLD" ? "yellow" : "red"}>
                        {s.status}
                      </Badge>
                    </Table.Td>
                  </Table.Tr>
                ))
              )}
            </Table.Tbody>
          </Table>
        </Box>

        <Text size="xs" c="dimmed" mb="xs">Terpilih: {selectedIds.length} item</Text>

        <Stack>
          <Group grow>
            <Select
              size="xs"
              label="Lokasi Tujuan"
              data={rakList.map((r: any) => ({ value: r.lokasiRak, label: r.lokasiRak }))}
              value={relocLokasi}
              onChange={(v) => setRelocLokasi(v || "")}
              searchable
              required
              placeholder="Cari rak..."
            />
            <Select
              size="xs"
              label="Status Baru (opsional)"
              data={["GOOD", "HOLD", "RELEASE", "REJECT"]}
              value={relocStatus}
              onChange={(v) => setRelocStatus(v || "")}
              clearable
              placeholder="Biarkan sama"
            />
          </Group>
          <Group grow>
            <TextInput
              size="xs"
              label="Keterangan"
              value={relocKet}
              onChange={(e) => setRelocKet(e.currentTarget.value)}
              placeholder="Alasan relokasi..."
            />
            <Button
              size="xs"
              color="orange"
              leftSection={<IconCheck size={14} />}
              loading={relocLoading}
              disabled={selectedIds.length === 0 || !relocLokasi}
              onClick={async () => {
                setRelocLoading(true);
                try {
                  const res: any = await api.post("/update-lokasi/bulk", {
                    items: selectedIds.map((id) => ({
                      idStock: id,
                      statusBaru: relocStatus || undefined,
                      keterangan: relocKet,
                    })),
                    lokasiBaru: relocLokasi,
                    picKoordinator: user?.namaUser || user?.username || "PIC",
                  });
                  notifications.show({
                    title: "Relokasi Selesai",
                    message: res?.message || "",
                    color: res?.failed ? "orange" : "green",
                  });
                  setSelectedIds([]);
                  setRelocLokasi("");
                  setRelocStatus("");
                  setRelocKet("");
                  load();
                } catch (err: any) {
                  notifications.show({
                    title: "Gagal",
                    message: err.response?.data?.message || "Error",
                    color: "red",
                  });
                } finally {
                  setRelocLoading(false);
                }
              }}
            >
              Pindahkan Terpilih ({selectedIds.length})
            </Button>
          </Group>
        </Stack>
      </Paper>
    </Box>
  );
}
