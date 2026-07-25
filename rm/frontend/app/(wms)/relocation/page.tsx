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
  ActionIcon,
  Tooltip,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { api, fmt, unwrap, dedup } from "../lib/api";
import { IconCheck, IconEdit, IconPrinter, IconSend, IconX } from "@tabler/icons-react";

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
  const [executingAll, setExecutingAll] = useState(false);
  const [editingDraftId, setEditingDraftId] = useState<number | null>(null);

  // Date range filter for history
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

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

      const stockData = unwrap(stockResponse);
      setStocks(Array.isArray(stockData) ? stockData : stockData?.data || []);
      const gudangData = unwrap(gudangResponse);
      setGudangs(Array.isArray(gudangData) ? gudangData : gudangData?.data || []);
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

  const [sourceZone, setSourceZone] = useState("");
  const [targetZone, setTargetZone] = useState("");

  const zones = useMemo(
    () => Array.from(new Set(gudangs.map((g) => g.zone).filter(Boolean))),
    [gudangs],
  );

  const stockOptions = useMemo(
    () =>
      dedup(stocks
        .filter(
          (stock: any) =>
            Number(stock.qty) > 0 &&
            (!sourceZone || stock.gudang?.zone === sourceZone),
        )
        .map((stock: any) => ({
          value: String(stock.id),
          label: `${stock.barang?.nama || "Item"} • ${stock.gudang?.name || "Rak -"
            } • ${stock.qty} ${stock.satuan || ""}`,
        }))),
    [stocks, sourceZone],
  );

  const targetOptions = useMemo(() => {
    if (!selectedStock) return [];

    const selectedBarangId = String(selectedStock.barang?.id || selectedStock.barang_id || "");
    const selectedBarangNama = selectedStock.barang?.nama || "Item";

    return dedup(gudangs
      .filter((gudang: any) => {
        if (String(gudang.id) === String(selectedStock.gudang?.id)) return false;
        if (targetZone && gudang.zone !== targetZone) return false;

        const stocksInRack = stocks.filter(
          (s: any) => String(s.gudang?.id || s.gudang_id) === String(gudang.id) && Number(s.qty) > 0,
        );

        const totalQtyInRack = stocksInRack.reduce((sum: number, s: any) => sum + Number(s.qty || 0), 0);
        const maxCapacity = Number(gudang.capacity || 1000);
        const remainingCapacity = maxCapacity - totalQtyInRack;

        if (remainingCapacity <= 0) return false;

        const isEmpty = stocksInRack.length === 0;
        const isSameItem = stocksInRack.length > 0 && stocksInRack.every((s: any) => String(s.barang?.id || s.barang_id) === selectedBarangId);

        return isEmpty || isSameItem;
      })
      .map((gudang: any) => {
        const stocksInRack = stocks.filter(
          (s: any) => String(s.gudang?.id || s.gudang_id) === String(gudang.id) && Number(s.qty) > 0,
        );
        const totalQtyInRack = stocksInRack.reduce((sum: number, s: any) => sum + Number(s.qty || 0), 0);
        const maxCapacity = Number(gudang.capacity || 1000);
        const remainingCapacity = maxCapacity - totalQtyInRack;
        const isEmpty = stocksInRack.length === 0;

        const zoneStr = gudang.zone ? `[${gudang.zone}] ` : '';
        if (isEmpty) {
          return {
            value: String(gudang.id),
            label: `${zoneStr}Rak ${gudang.name} (KOSONG — Sisa Kapasitas: ${remainingCapacity})`,
          };
        } else {
          return {
            value: String(gudang.id),
            label: `${zoneStr}Rak ${gudang.name} — ${selectedBarangNama} (Stok: ${totalQtyInRack}, Sisa Kapasitas: ${remainingCapacity})`,
          };
        }
      }));
  }, [gudangs, targetZone, selectedStock, stocks]);

  const resetForm = () => {
    setEditingDraftId(null);
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
      if (editingDraftId) {
        try { await api().delete(`/relocation/${editingDraftId}`); } catch (e) { }
      }

      await api().post("/relocation", {
        stock_id: Number(stockId),
        target_gudang_id: Number(targetGudangId),
        gudang_tujuan_id: Number(targetGudangId),
        qty: relocationQty,
        note,
      });

      notifications.show({
        title: "Draft disimpan",
        message: editingDraftId ? "Draft relokasi berhasil diperbarui." : "Relokasi telah masuk ke daftar draft.",
        color: "green",
      });

      resetForm();
      await load();
    } catch (error: any) {
      notifications.show({
        title: "Gagal menyimpan draft",
        message: unwrap(error.response)?.message || "Terjadi kesalahan.",
        color: "red",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const editDraft = (draft: any) => {
    setEditingDraftId(draft.id);
    const sourceStockId = String(draft.source_stock?.id || draft.stock?.id || draft.stock_id || "");
    setStockId(sourceStockId);
    const targetGudang = String(draft.target_gudang?.id || draft.gudang_tujuan?.id || draft.target_gudang_id || "");
    setTargetGudangId(targetGudang);
    setQty(draft.qty || 1);
    setNote(draft.note || "");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const deleteDraft = async (id: number) => {
    if (!confirm("Reject / hapus draft relokasi ini?")) return;
    try {
      await api().delete(`/relocation/${id}`);
      notifications.show({
        title: "Sukses",
        message: "Draft relokasi berhasil di-reject/dihapus.",
        color: "green",
      });
      if (editingDraftId === id) resetForm();
      await load();
    } catch (error: any) {
      notifications.show({
        title: "Gagal menghapus draft",
        message: unwrap(error.response)?.message || "Terjadi kesalahan.",
        color: "red",
      });
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
      const errRes = unwrap(error.response);
      const errMsg = typeof errRes === 'string' ? errRes : errRes?.message || error.response?.data?.message || "Stok asal tidak cukup atau sudah berubah.";

      notifications.show({
        title: "Gagal mengeksekusi relokasi",
        message: errMsg,
        color: "red",
      });
    } finally {
      setExecutingId(null);
    }
  };

  const executeAllDrafts = async () => {
    if (!drafts.length) return;
    if (!confirm(`Eksekusi massal seluruh ${drafts.length} draft relokasi?`)) return;

    setExecutingAll(true);
    let successCount = 0;
    const errors: string[] = [];

    for (const draft of drafts) {
      try {
        await api().post(`/relocation/${draft.id}/execute`);
        successCount++;
      } catch (e: any) {
        const errRes = unwrap(e.response);
        const msg = typeof errRes === 'string' ? errRes : errRes?.message || e.response?.data?.message || `Draft #${draft.id} gagal`;
        errors.push(`Draft #${draft.id}: ${msg}`);
        console.error(`Gagal mengeksekusi draft #${draft.id}`, e);
      }
    }

    if (successCount > 0) {
      notifications.show({
        title: "Eksekusi Massal Selesai",
        message: `${successCount} dari ${drafts.length} draft relokasi berhasil dieksekusi.${errors.length ? ` (${errors.length} gagal)` : ''}`,
        color: successCount === drafts.length ? "green" : "yellow",
      });
    } else {
      notifications.show({
        title: "Gagal Eksekusi Massal",
        message: errors[0] || "Tidak ada draft yang berhasil dieksekusi.",
        color: "red",
      });
    }

    setExecutingAll(false);
    await load();
  };

  const executedHistory = history
    .filter(
      (row: any) =>
        row.status === "EXECUTED" ||
        row.relocation?.status === "EXECUTED" ||
        !row.status,
    )
    .filter((row: any) => {
      if (!fromDate && !toDate) return true;
      const rowDate = row.created_at ? new Date(row.created_at).toISOString().split("T")[0] : "";
      if (fromDate && rowDate < fromDate) return false;
      if (toDate && rowDate > toDate) return false;
      return true;
    });

  const printHistoryOnly = () => {
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;
    const rowsHtml = executedHistory.map((row: any, idx: number) => {
      const item = getItem(row);
      return `<tr>
        <td style="text-align:center">${idx + 1}</td>
        <td>${fmt(row.created_at)}</td>
        <td><strong>${item.nama || "-"}</strong></td>
        <td>${getSourceRack(row)}</td>
        <td>${getTargetRack(row)}</td>
        <td style="text-align:right"><strong>${row.qty}</strong> ${row.satuan || item.satuan || ""}</td>
        <td style="text-align:center"><span style="background:#2b8a3e;color:#fff;padding:2px 6px;border-radius:4px;font-size:10px">EXECUTED</span></td>
      </tr>`;
    }).join("");

    const periodeStr = fromDate && toDate ? `${fromDate} s/d ${toDate}` : fromDate ? `Dari ${fromDate}` : toDate ? `Sampai ${toDate}` : "Semua Periode";

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Riwayat Relokasi Stok</title>
        <style>
          body { font-family: 'Segoe UI', Arial, sans-serif; padding: 24px; color: #172033; }
          .header { border-bottom: 2px solid #2b8a3e; padding-bottom: 12px; margin-bottom: 16px; }
          .title { font-size: 18px; font-weight: 800; color: #2b8a3e; margin: 0; }
          .meta { font-size: 11px; color: #6b7280; margin-top: 4px; }
          table { width: 100%; border-collapse: collapse; margin-top: 14px; font-size: 11px; }
          th, td { border: 1px solid #cbd5e1; padding: 8px; text-align: left; }
          th { background: #ebfbee; color: #2b8a3e; font-size: 10px; text-transform: uppercase; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1 class="title">LAPORAN RIWAYAT RELOKASI STOK</h1>
          <div class="meta">Periode: ${periodeStr} | Dicetak: ${new Date().toLocaleDateString('id-ID')}</div>
        </div>
        <table>
          <thead>
            <tr>
              <th style="width:30px;text-align:center">No</th>
              <th>Tanggal</th>
              <th>Item / Produk</th>
              <th>Rak Asal</th>
              <th>Rak Tujuan</th>
              <th style="text-align:right">Qty</th>
              <th style="text-align:center">Status</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml}
          </tbody>
        </table>
        <script>window.print();<\/script>
      </body>
      </html>
    `);
    printWindow.document.close();
  };

  return (
    <Box p="md">
      <Box
        mb="md"
        pb="md"
        style={{ background: '#fff', borderLeft: '4px solid #1bd40aff', padding: '14px 20px', marginBottom: 16, boxShadow: '0 1px 3px rgba(0,0,0,.05)' }}
      >
        {/* <Text size="xs" fw={800} c="orange" tt="uppercase" mb={4}>
          Warehouse Movement
        </Text> */}
        <Title order={2} style={{ letterSpacing: "-0.04em" }}>
          Relocation
        </Title>
        {/* <Text size="sm" c="dimmed" mt={4}>
          Rencanakan perpindahan stok terlebih dahulu, lalu eksekusi saat
          barang benar-benar dipindahkan.
        </Text> */}
      </Box>

      <Group align="flex-start" gap="md" wrap="nowrap">
        <Paper
          withBorder
          radius="md"
          p="lg"
          style={{ width: 330, flexShrink: 0 }}
        >
          <Group justify="space-between" mb={2}>
            <Text fw={800} size="sm">
              {editingDraftId ? "Edit Planning" : "Planning"}
            </Text>
            {editingDraftId && (
              <ActionIcon size="xs" variant="subtle" color="gray" onClick={resetForm}>
                <IconX size={14} />
              </ActionIcon>
            )}
          </Group>
          <Text size="xs" c="dimmed" mb="md">
            {editingDraftId ? "Perbarui isi draft relokasi." : "Buat draft perpindahan stok."}
          </Text>

          <Stack gap="sm">
            <Select
              label="Source Zone"
              placeholder="Filter zone asal"
              searchable
              clearable
              data={zones}
              value={sourceZone}
              onChange={(value) => {
                setSourceZone(value || "");
                setStockId("");
              }}
            />

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
              label="Target Zone"
              placeholder="Filter zone tujuan"
              searchable
              clearable
              data={zones}
              value={targetZone}
              onChange={(value) => {
                setTargetZone(value || "");
                setTargetGudangId("");
              }}
            />

            <Select
              label="Target Gudang"
              description="Rak tujuan (Kosong / Item sama & ada kapasitas)"
              placeholder={selectedStock ? "Pilih rak tujuan" : "Pilih stok asal terlebih dahulu"}
              searchable
              disabled={!stockId}
              data={targetOptions}
              value={targetGudangId}
              onChange={(value) => setTargetGudangId(value || "")}
              nothingFoundMessage="Tidak ada rak kosong atau rak dengan item sama yang tersedia"
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
              {editingDraftId ? "SIMPAN PERUBAHAN DRAFT" : "BUAT DRAFT RELOCATION"}
            </Button>
            {editingDraftId && (
              <Button size="xs" variant="subtle" color="gray" onClick={resetForm}>
                Batal Edit
              </Button>
            )}
          </Stack>
        </Paper>

        <Box style={{ flex: 1, minWidth: 0 }}>
          <Paper withBorder radius="md" p="lg" mb="md">
            <Group justify="space-between" mb="md" wrap="nowrap">
              <Box>
                <Text fw={800} size="sm">
                  Draft Relocation
                </Text>
                <Text size="xs" c="dimmed">
                  Draft belum memengaruhi stok sampai dieksekusi.
                </Text>
              </Box>
              <Group gap="xs" wrap="nowrap">
                <Badge color="orange" variant="light">
                  {drafts.length} DRAFT
                </Badge>
                {drafts.length > 0 && (
                  <Tooltip label={`Eksekusi Massal (${drafts.length} Draft)`}>
                    <ActionIcon
                      size="md"
                      color="green"
                      variant="filled"
                      loading={executingAll}
                      onClick={executeAllDrafts}
                    >
                      <IconSend size={15} />
                    </ActionIcon>
                  </Tooltip>
                )}
              </Group>
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
                <Table.Thead style={{ background: "#fff4e6", borderBottom: "2px solid #ffd8a8" }}>
                  <Table.Tr>
                    {["Item", "Rak Asal", "Rak Tujuan", "Qty", "Note", "Aksi"].map(
                      (header) => (
                        <Table.Th
                          key={header}
                          style={{ color: "#d9480f", fontSize: 11 }}
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
                            <Group gap={4} wrap="nowrap">
                              <Tooltip label="Eksekusi Relokasi">
                                <ActionIcon
                                  size="sm"
                                  color="green"
                                  variant="light"
                                  loading={executingId === draft.id}
                                  onClick={() => executeDraft(draft.id)}
                                >
                                  <IconCheck size={14} />
                                </ActionIcon>
                              </Tooltip>
                              <Tooltip label="Edit Draft">
                                <ActionIcon
                                  size="sm"
                                  color="blue"
                                  variant="light"
                                  onClick={() => editDraft(draft)}
                                >
                                  <IconEdit size={14} />
                                </ActionIcon>
                              </Tooltip>
                              <Tooltip label="Reject / Hapus Draft">
                                <ActionIcon
                                  size="sm"
                                  color="red"
                                  variant="light"
                                  onClick={() => deleteDraft(draft.id)}
                                >
                                  <IconX size={14} />
                                </ActionIcon>
                              </Tooltip>
                            </Group>
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
              <Box style={{ flex: 1 }}>
                <Group justify="space-between" mb="xs">
                  <Box>
                    <Text fw={800} size="sm">
                      Execution History ({executedHistory.length})
                    </Text>
                    <Text size="xs" c="dimmed">
                      Riwayat relocation yang sudah dieksekusi.
                    </Text>
                  </Box>
                  <Group gap="xs">
                    <TextInput
                      type="date"
                      size="xs"
                      value={fromDate}
                      onChange={(e) => setFromDate(e.target.value)}
                      placeholder="Start date"
                      title="Filter Dari Tanggal"
                    />
                    <TextInput
                      type="date"
                      size="xs"
                      value={toDate}
                      onChange={(e) => setToDate(e.target.value)}
                      placeholder="End date"
                      title="Filter Sampai Tanggal"
                    />
                    {(fromDate || toDate) && (
                      <ActionIcon size="sm" variant="subtle" color="gray" onClick={() => { setFromDate(""); setToDate(""); }}>
                        <IconX size={14} />
                      </ActionIcon>
                    )}
                    <Tooltip label="Print PDF Riwayat Relokasi">
                      <ActionIcon
                        variant="outline"
                        color="dark"
                        onClick={printHistoryOnly}
                      >
                        <IconPrinter size={16} />
                      </ActionIcon>
                    </Tooltip>
                  </Group>
                </Group>
              </Box>
            </Group>

            {loading ? (
              <Loader size="sm" />
            ) : (
              <Table
                withTableBorder
                withColumnBorders
                style={{ fontSize: 12 }}
              >
                <Table.Thead style={{ background: "#fff4e6", borderBottom: "2px solid #ffd8a8" }}>
                  <Table.Tr>
                    {["Tanggal", "Item", "Rak Asal", "Rak Tujuan", "Qty", "Status"].map(
                      (header) => (
                        <Table.Th
                          key={header}
                          style={{ color: "#d9480f", fontSize: 11 }}
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
