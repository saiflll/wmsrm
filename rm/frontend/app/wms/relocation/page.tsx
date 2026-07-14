// @ts-nocheck
"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  Badge,
  Box,
  Button,
  Group,
  Loader,
  NumberInput,
  Paper,
  Select,
  Stack,
  Table,
  Text,
  TextInput,
  Title,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { api, fmt, unwrap } from "../lib/api";

const rowStyle = (index: number) => ({
  backgroundColor: index % 2 === 0 ? "#fff" : "#f8f9fa",
});

const getSourceRack = (row: any) =>
  row.stock?.gudang?.name ||
  row.gudang_asal?.name ||
  row.gudang?.name ||
  row.source_stock?.gudang?.name ||
  "-";

const getTargetRack = (row: any) =>
  row.gudang_tujuan?.name ||
  row.target_gudang?.name ||
  row.target_location?.name ||
  "-";

const getItem = (row: any) =>
  row.stock?.barang ||
  row.barang ||
  row.source_stock?.barang ||
  {};

export default function RelocationPage() {
  const [stocks, setStocks] = useState<any[]>([]);
  const [gudangs, setGudangs] = useState<any[]>([]);
  const [drafts, setDrafts] = useState<any[]>([]);
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [executingId, setExecutingId] = useState<number | null>(null);

  const [stockId, setStockId] = useState("");
  const [targetGudangId, setTargetGudangId] = useState("");
  const [qty, setQty] = useState<number | string>(0);
  const [note, setNote] = useState("");

  const load = async () => {
    setLoading(true);

    try {
      const [stockResponse, gudangResponse, draftResponse, historyResponse] =
        await Promise.all([
          api().get("/inventory/stock"),
          api().get("/gudang"),
          api().get("/relocation"),
          api().get("/inventory/logs?type=RELOCATION"),
        ]);

      setStocks(unwrap(stockResponse) || []);
      setGudangs(unwrap(gudangResponse) || []);
      setDrafts(unwrap(draftResponse) || []);
      setHistory(unwrap(historyResponse) || []);
    } catch (error) {
      console.error(error);
      notifications.show({
        title: "Gagal memuat data",
        message: "Data relokasi atau stok tidak dapat dimuat.",
        color: "red",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const selectedStock = useMemo(
    () => stocks.find((stock: any) => String(stock.id) === stockId),
    [stocks, stockId],
  );

  const stockOptions = useMemo(
    () =>
      stocks
        .filter((stock: any) => Number(stock.qty) > 0)
        .map((stock: any) => ({
          value: String(stock.id),
          label: `${stock.barang?.nama || "Item"} • ${
            stock.gudang?.name || "Rak -"
          } • ${stock.qty} ${stock.satuan || ""}`,
        })),
    [stocks],
  );

  const targetOptions = useMemo(
    () =>
      gudangs
        .filter(
          (gudang: any) =>
            String(gudang.id) !== String(selectedStock?.gudang?.id),
        )
        .map((gudang: any) => ({
          value: String(gudang.id),
          label: gudang.zone
            ? `${gudang.name} — ${gudang.zone}`
            : gudang.name,
        })),
    [gudangs, selectedStock],
  );

  const resetForm = () => {
    setStockId("");
    setTargetGudangId("");
    setQty(0);
    setNote("");
  };

  const createDraft = async () => {
    const relocationQty = Number(qty);

    if (!stockId || !targetGudangId || !relocationQty) {
      notifications.show({
        title: "Form belum lengkap",
        message: "Pilih stok asal, rak tujuan, dan masukkan quantity.",
        color: "red",
      });
      return;
    }

    if (relocationQty < 1 || relocationQty > Number(selectedStock?.qty || 0)) {
      notifications.show({
        title: "Quantity tidak valid",
        message: `Quantity harus antara 1 hingga ${selectedStock?.qty || 0}.`,
        color: "red",
      });
      return;
    }

    setSubmitting(true);

    try {
      await api().post("/relocation", {
        stock_id: Number(stockId),
        gudang_tujuan_id: Number(targetGudangId),
        qty: relocationQty,
        note,
      });

      notifications.show({
        title: "Draft dibuat",
        message: "Relokasi telah masuk ke daftar draft.",
        color: "green",
      });

      resetForm();
      await load();
    } catch (error: any) {
      notifications.show({
        title: "Gagal membuat draft",
        message: unwrap(error.response)?.message || "Terjadi kesalahan.",
        color: "red",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const executeDraft = async (id: number) => {
    setExecutingId(id);

    try {
      await api().post(`/relocation/${id}/execute`);

      notifications.show({
        title: "Relokasi dieksekusi",
        message: "Stok asal dan stok tujuan telah diperbarui.",
        color: "green",
      });

      await load();
    } catch (error: any) {
      notifications.show({
        title: "Gagal mengeksekusi relokasi",
        message: unwrap(error.response)?.message || "Terjadi kesalahan.",
        color: "red",
      });
    } finally {
      setExecutingId(null);
    }
  };

  const executedHistory = history.filter(
    (row: any) =>
      row.status === "EXECUTED" ||
      row.relocation?.status === "EXECUTED" ||
      !row.status,
  );

  return (
    <Box p="md">
      <Box
        mb="md"
        pb="md"
        style={{ borderBottom: "1px solid #e9ecef" }}
      >
        <Text size="xs" fw={800} c="orange" tt="uppercase" mb={4}>
          Warehouse Movement
        </Text>
        <Title order={2} style={{ letterSpacing: "-0.04em" }}>
          Relocation Plan → Execute
        </Title>
        <Text size="sm" c="dimmed" mt={4}>
          Rencanakan perpindahan stok terlebih dahulu, lalu eksekusi saat
          barang benar-benar dipindahkan.
        </Text>
      </Box>

      <Group align="flex-start" gap="md" wrap="nowrap">
        <Paper
          withBorder
          radius="md"
          p="lg"
          style={{ width: 330, flexShrink: 0 }}
        >
          <Text fw={800} size="sm" mb={2}>
            01 — Planning
          </Text>
          <Text size="xs" c="dimmed" mb="md">
            Buat draft perpindahan stok.
          </Text>

          <Stack gap="sm">
            <Select
              label="Source Stock"
              description="Item dan rak asal"
              placeholder="Pilih stok tersedia"
              searchable
              data={stockOptions}
              value={stockId}
              onChange={(value) => {
                setStockId(value || "");
                setTargetGudangId("");
                setQty(0);
              }}
            />

            {selectedStock && (
              <Box
                p="sm"
                style={{
                  background: "#f8f9fa",
                  borderLeft: "3px solid #e6921e",
                  borderRadius: 4,
                }}
              >
                <Text size="xs" fw={700}>
                  {selectedStock.barang?.nama}
                </Text>
                <Text size="xs" c="dimmed">
                  Rak asal: {selectedStock.gudang?.name || "-"}
                </Text>
                <Text size="xs" c="dimmed">
                  Stok tersedia: {selectedStock.qty}{" "}
                  {selectedStock.satuan || ""}
                </Text>
              </Box>
            )}

            <Select
              label="Target Gudang"
              description="Rak tujuan"
              placeholder="Pilih rak tujuan"
              searchable
              disabled={!stockId}
              data={targetOptions}
              value={targetGudangId}
              onChange={(value) => setTargetGudangId(value || "")}
            />

            <NumberInput
              label="Qty"
              placeholder="Masukkan quantity"
              min={1}
              max={selectedStock?.qty}
              value={qty}
              onChange={setQty}
            />

            <TextInput
              label="Keterangan"
              placeholder="Opsional"
              value={note}
              onChange={(event) => setNote(event.currentTarget.value)}
            />

            <Button
              color="orange"
              loading={submitting}
              onClick={createDraft}
              mt="xs"
              style={{ fontWeight: 800 }}
            >
              BUAT DRAFT RELOCATION
            </Button>
          </Stack>
        </Paper>

        <Box style={{ flex: 1, minWidth: 0 }}>
          <Paper withBorder radius="md" p="lg" mb="md">
            <Group justify="space-between" mb="md">
              <Box>
                <Text fw={800} size="sm">
                  02 — Draft Relocation
                </Text>
                <Text size="xs" c="dimmed">
                  Draft belum memengaruhi stok sampai dieksekusi.
                </Text>
              </Box>
              <Badge color="orange" variant="light">
                {drafts.length} DRAFT
              </Badge>
            </Group>

            {loading ? (
              <Loader size="sm" />
            ) : (
              <Table
                withTableBorder
                withColumnBorders
                highlightOnHover
                style={{ fontSize: 12 }}
              >
                <Table.Thead style={{ background: "#1d1d1f" }}>
                  <Table.Tr>
                    {["Item", "Rak Asal", "Rak Tujuan", "Qty", "Note", "Action"].map(
                      (header) => (
                        <Table.Th
                          key={header}
                          style={{ color: "#fff", fontSize: 11 }}
                        >
                          {header}
                        </Table.Th>
                      ),
                    )}
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {drafts.length === 0 ? (
                    <Table.Tr>
                      <Table.Td colSpan={6} ta="center" py="xl" c="dimmed">
                        Belum ada draft relocation.
                      </Table.Td>
                    </Table.Tr>
                  ) : (
                    drafts.map((draft: any, index: number) => {
                      const item = getItem(draft);

                      return (
                        <Table.Tr key={draft.id} style={rowStyle(index)}>
                          <Table.Td fw={700}>{item.nama || "-"}</Table.Td>
                          <Table.Td>
                            <Badge size="sm" color="blue" variant="light">
                              {getSourceRack(draft)}
                            </Badge>
                          </Table.Td>
                          <Table.Td>
                            <Badge size="sm" color="green" variant="light">
                              {getTargetRack(draft)}
                            </Badge>
                          </Table.Td>
                          <Table.Td ta="right">
                            {draft.qty} {draft.satuan || item.satuan || ""}
                          </Table.Td>
                          <Table.Td>{draft.note || "-"}</Table.Td>
                          <Table.Td>
                            <Button
                              size="xs"
                              color="green"
                              loading={executingId === draft.id}
                              onClick={() => executeDraft(draft.id)}
                              style={{ fontWeight: 800 }}
                            >
                              EXECUTE
                            </Button>
                          </Table.Td>
                        </Table.Tr>
                      );
                    })
                  )}
                </Table.Tbody>
              </Table>
            )}
          </Paper>

          <Paper withBorder radius="md" p="lg">
            <Group justify="space-between" mb="md">
              <Box>
                <Text fw={800} size="sm">
                  03 — Execution History
                </Text>
                <Text size="xs" c="dimmed">
                  Riwayat relocation yang sudah dieksekusi.
                </Text>
              </Box>
              <Button
                size="xs"
                variant="outline"
                color="dark"
                onClick={() => window.print()}
              >
                PRINT HISTORY
              </Button>
            </Group>

            {loading ? (
              <Loader size="sm" />
            ) : (
              <Table
                withTableBorder
                withColumnBorders
                style={{ fontSize: 12 }}
              >
                <Table.Thead style={{ background: "#1d1d1f" }}>
                  <Table.Tr>
                    {["Tanggal", "Item", "Rak Asal", "Rak Tujuan", "Qty", "Status"].map(
                      (header) => (
                        <Table.Th
                          key={header}
                          style={{ color: "#fff", fontSize: 11 }}
                        >
                          {header}
                        </Table.Th>
                      ),
                    )}
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {executedHistory.length === 0 ? (
                    <Table.Tr>
                      <Table.Td colSpan={6} ta="center" py="xl" c="dimmed">
                        Belum ada relocation yang dieksekusi.
                      </Table.Td>
                    </Table.Tr>
                  ) : (
                    executedHistory.map((row: any, index: number) => {
                      const item = getItem(row);

                      return (
                        <Table.Tr key={row.id} style={rowStyle(index)}>
                          <Table.Td>{fmt(row.created_at)}</Table.Td>
                          <Table.Td fw={700}>{item.nama || "-"}</Table.Td>
                          <Table.Td>{getSourceRack(row)}</Table.Td>
                          <Table.Td>{getTargetRack(row)}</Table.Td>
                          <Table.Td ta="right">
                            {row.qty} {row.satuan || item.satuan || ""}
                          </Table.Td>
                          <Table.Td>
                            <Badge color="green" variant="filled">
                              EXECUTED
                            </Badge>
                          </Table.Td>
                        </Table.Tr>
                      );
                    })
                  )}
                </Table.Tbody>
              </Table>
            )}
          </Paper>
        </Box>
      </Group>
    </Box>
  );
}
