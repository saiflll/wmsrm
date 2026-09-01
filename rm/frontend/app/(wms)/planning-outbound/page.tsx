// @ts-nocheck
"use client";

import React, { useEffect, useState } from "react";
import {
  ActionIcon,
  Autocomplete,
  Badge,
  Box,
  Button,
  Checkbox,
  Divider,
  Grid,
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
  Tooltip,
} from "@mantine/core";
import {
  IconBuildingWarehouse,
  IconEdit,
  IconFileTypePdf,
  IconPlus,
  IconSend,
  IconTrash,
} from "@tabler/icons-react";
import { notifications } from "@mantine/notifications";
import { api, unwrap, fmt, statusLabel, statusColor, dedup } from "../lib/api";

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const ZONES_WET = ["CS FROZEN", "CHILL", "WASTE"];
const ZONES_DRY = ["DRY A", "DRY B", "DRY FG"];
const ALL_ZONES = [...ZONES_WET, ...ZONES_DRY];

const EMPTY_FORM = {
  stock_id: "",
  qty: 1,
  tujuan: "",
  no_ref: "",
  shift_id: "",
  tanggal_permintaan: new Date().toISOString().split("T")[0],
  nomor_batch: "",
  items: [] as any[], // { stock_id, barangId, gudangId, qty, batch_no, satuan, _brg, _gdg, _zone }
};

const OFFLINE_QUEUE_KEY = "wms_outbound_offline_queue";

const isAyam = (obj: any) =>
  obj?.nama?.toLowerCase().includes("ayam") ||
  obj?.kategori?.toLowerCase().includes("ayam");

const activeStatusColor = (status: string) => {
  if (status === "PROGRESS") return "blue";
  if (status === "CANCEL") return "red";
  return "yellow";
};

/* ------------------------------------------------------------------ */
/*  Small presentational helpers                                      */
/* ------------------------------------------------------------------ */

const renderColorfulOption: any = ({ option }: any) => {
  if (!option.locName) return <Text size="sm">{option.label}</Text>;

  return (
    <Group gap={6} wrap="nowrap">
      <Badge
        color="green"
        variant="filled"
        size="xs"
        style={{ textTransform: "none" }}
      >
        {option.locName}
      </Badge>
      {option.itemNames && (
        <Badge
          color="orange"
          variant="light"
          size="xs"
          style={{ textTransform: "none", maxWidth: 150 }}
        >
          {option.itemNames.length > 25
            ? `${option.itemNames.slice(0, 25)}...`
            : option.itemNames}
        </Badge>
      )}
      {option.qtyStr && (
        <Text size="xs" c="blue" fw={600}>
          {option.qtyStr}
        </Text>
      )}
    </Group>
  );
};

function ItemsMiniList({
  items,
  barangs,
  allGudangs,
}: {
  items: any[];
  barangs: any[];
  allGudangs?: any[];
}) {
  if (!items?.length) return null;
  return (
    <>
      {items.map((item: any, idx: number) => {
        const barangId = item.barang_id ?? item.barangId;
        const gudangId = item.gudang_id ?? item.gudangId;
        const bName =
          barangs.find((b: any) => String(b.id) === String(barangId))?.nama ||
          `Barang #${barangId}`;
        const g = allGudangs?.find(
          (x: any) => String(x.id) === String(gudangId),
        );
        return (
          <div
            key={idx}
            style={{
              fontSize: 10,
              borderBottom: "1px solid #f1f5f9",
              padding: "2px 0",
            }}
          >
            <div>
              {bName}{" "}
              <b>
                x{item.qty} {item.satuan || ""}
              </b>
            </div>
            {g && (
              <div style={{ color: "#64748b", fontSize: 9 }}>
                Asal: [{g.zone}] {g.name}
              </div>
            )}
          </div>
        );
      })}
    </>
  );
}

function PlanMetaCell({
  plan,
  showExecuted,
}: {
  plan: any;
  showExecuted?: boolean;
}) {
  return (
    <>
      <Badge
        size="xs"
        color={
          plan.status === "DONE" ? "green" : activeStatusColor(plan.status)
        }
        variant="filled"
      >
        {plan.status}
      </Badge>
      <Text size="10px" c="dimmed">
        Dibuat {plan.created_by_username || "sistem"} · {fmt(plan.created_at)}
      </Text>
      {(showExecuted || plan.published_at) && (
        <Text size="10px" c="dimmed">
          Eksekusi {plan.executed_by_username || "sistem"} ·{" "}
          {fmt(plan.published_at)}
        </Text>
      )}
    </>
  );
}

/* ------------------------------------------------------------------ */
/*  PDF export                                                        */
/* ------------------------------------------------------------------ */

function buildOutboundPdfHtml(plan: any, barangs: any[], allGudangs: any[]) {
  const itemsHtml = (plan.items || [])
    .map((item: any, idx: number) => {
      const bObj = barangs.find(
        (b: any) => String(b.id) === String(item.barangId),
      );
      const name = bObj ? bObj.nama : `Barang #${item.barangId}`;
      const gObj = allGudangs.find(
        (g: any) => String(g.id) === String(item.gudangId),
      );
      const locStr = gObj ? `[${gObj.zone}] ${gObj.name}` : "-";
      return `<tr>
                <td style="text-align:center">${idx + 1}</td>
                <td><strong>${name}</strong></td>
                <td>${locStr}</td>
                <td>${item.batch_no || "-"}</td>
                <td style="text-align:right"><strong>${item.qty}</strong></td>
                <td>${item.satuan || bObj?.satuan || "Pcs"}</td>
            </tr>`;
    })
    .join("");

  const dateStr = plan.tanggal_planning ? fmt(plan.tanggal_planning) : "-";
  const shiftStr = plan.shift?.name || "-";
  const customerStr = plan.customer?.nama || plan.tujuan || "-";

  return `
        <!DOCTYPE html>
        <html>
        <head>
            <title>Laporan Outbound - ${plan.no_ref || "Planning Outbound"}</title>
            <style>
                body { font-family: 'Segoe UI', Arial, sans-serif; padding: 24px; color: #172033; }
                .header { border-bottom: 2px solid #e67700; padding-bottom: 12px; margin-bottom: 20px; }
                .title { font-size: 18px; font-weight: 800; color: #e67700; margin: 0; }
                .meta { margin-top: 8px; font-size: 12px; color: #4b5563; }
                .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; font-size: 12px; margin-bottom: 20px; background: #fff4e6; padding: 12px; border-radius: 8px; }
                table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 12px; }
                th, td { border: 1px solid #cbd5e1; padding: 8px 10px; text-align: left; }
                th { background: #ffe8cc; color: #d9480f; font-size: 11px; text-transform: uppercase; }
                .footer { margin-top: 30px; text-align: right; font-size: 11px; color: #6b7280; }
            </style>
        </head>
        <body>
            <div class="header">
                <h1 class="title">SURAT PLANNING OUTBOUND (PENGELUARAN BARANG)</h1>
                <div class="meta">No Ref: <strong>${plan.no_ref || `#${plan.id}`}</strong> | Date Generated: ${new Date().toLocaleDateString("id-ID")}</div>
            </div>
            <div class="grid">
                <div>Tujuan / Customer: <strong>${customerStr}</strong></div>
                <div>Tanggal Planning: <strong>${dateStr}</strong></div>
                <div>Shift: <strong>${shiftStr}</strong></div>
                <div>Status: <strong>${plan.status || "DONE"}</strong></div>
            </div>
            <table>
                <thead>
                    <tr>
                        <th style="width:30px;text-align:center">No</th>
                        <th>Item / Produk</th>
                        <th>Gudang / Rak Asal</th>
                        <th>Batch No</th>
                        <th style="text-align:right">Qty</th>
                        <th>Satuan</th>
                    </tr>
                </thead>
                <tbody>${itemsHtml}</tbody>
            </table>
            <div class="footer">Dicetak otomatis dari WMS System</div>
            <script>window.print();<\/script>
        </body>
        </html>
    `;
}

/* ------------------------------------------------------------------ */
/*  Main component                                                     */
/* ------------------------------------------------------------------ */

export default function PlanningOutboundPage() {
  /* ---------------- Master data ---------------- */
  const [allGudangs, setAllGudangs] = useState<any[]>([]);
  const [stocks, setStocks] = useState<any[]>([]);
  const [barangs, setBarangs] = useState<any[]>([]);
  const [logs, setLogs] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [shifts, setShifts] = useState<any[]>([]);
  const [plans, setPlans] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  /* ---------------- Form / edit state ---------------- */
  const [form, setForm] = useState<any>(EMPTY_FORM);
  const [editPlanId, setEditPlanId] = useState<number | null>(null);
  const [selectedZone, setSelectedZone] = useState("");
  const [selectedBarangId, setSelectedBarangId] = useState("");

  /* ---------------- Draft selection / publish (per-draft only) ---------------- */
  const [selectedDraftIds, setSelectedDraftIds] = useState<Set<number>>(
    new Set(),
  );

  /* ---------------- Offline queue ---------------- */
  const [offlineQueue, setOfflineQueue] = useState<any[]>([]);

  /* ---------------- Table sorting / filter ---------------- */
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");

  /* ================================================================ */
  /*  Offline queue persistence                                        */
  /* ================================================================ */

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const saved = localStorage.getItem(OFFLINE_QUEUE_KEY);
      if (saved) setOfflineQueue(JSON.parse(saved));
    } catch (e) {
      // ignore malformed local cache
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(offlineQueue));
  }, [offlineQueue]);

  useEffect(() => {
    const onOnline = () => {
      if (offlineQueue.length) flushOfflineQueue();
    };
    if (typeof window !== "undefined")
      window.addEventListener("online", onOnline);
    return () => window.removeEventListener("online", onOnline);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [offlineQueue]);

  const flushOfflineQueue = async () => {
    if (!offlineQueue.length) return;
    const queue = [...offlineQueue];
    let remaining = [...offlineQueue];

    for (const payload of queue) {
      try {
        await api().post("/planning-outbound", payload);
        remaining = remaining.filter((p) => p !== payload);
      } catch (e) {
        break; // stop at first failure, keep the rest queued
      }
    }

    if (remaining.length !== offlineQueue.length) {
      setOfflineQueue(remaining);
      if (!remaining.length) {
        notifications.show({
          title: "Sukses",
          message: "Draft offline berhasil dikirim ke server",
          color: "green",
        });
      }
      load();
    }
  };

  /* ================================================================ */
  /*  Data loading                                                     */
  /* ================================================================ */

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const load = async () => {
    setLoading(true);
    try {
      const [s, l, c, sh, g, b, p] = await Promise.all([
        api().get("/inventory/stock"),
        api().get("/inventory/logs/picking"),
        api().get("/customers"),
        api().get("/shifts"),
        api().get("/gudang"),
        api().get("/barang"),
        api().get("/planning-outbound"),
      ]);

      const stockData = unwrap(s) || [];
      const allStocks = Array.isArray(stockData)
        ? stockData
        : stockData?.data || [];
      const allBarangs = unwrap(b) || [];
      const allPlans = unwrap(p) || [];
      const gudangData = unwrap(g);

      setStocks(allStocks);
      setLogs(unwrap(l) || []);
      setCustomers(unwrap(c) || []);
      setShifts(unwrap(sh) || []);
      setAllGudangs(
        Array.isArray(gudangData) ? gudangData : gudangData?.data || [],
      );
      setBarangs(allBarangs);
      setPlans(allPlans);
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  /* ================================================================ */
  /*  Derived lists (filters / options)                                */
  /* ================================================================ */

  const availableStocks = stocks.filter(
    (s: any) => s.qty - (s.reserved_qty || 0) > 0,
  );
  const availableBarangs = barangs.filter((b: any) =>
    availableStocks.some((s: any) => String(s.barang?.id) === String(b.id)),
  );

  const availableZones = Array.from(
    new Set(
      availableStocks
        .filter(
          (s: any) =>
            !selectedBarangId ||
            String(s.barang?.id) === String(selectedBarangId),
        )
        .map((s: any) => s.gudang?.zone)
        .filter(Boolean),
    ),
  );

  const zoneStocks = availableStocks
    .filter((s: any) => !selectedZone || s.gudang?.zone === selectedZone)
    .filter(
      (s: any) =>
        !selectedBarangId || String(s.barang?.id) === String(selectedBarangId),
    );

  const stockOpts = dedup(
    zoneStocks.map((s: any) => {
      const available = s.qty - (s.reserved_qty || 0);
      return {
        value: String(s.id),
        label: `[${s.gudang?.zone}] Rak ${s.gudang?.name} — ${s.barang?.nama || "Unknown"} (Tersedia: ${available} ${
          s.satuan || "qty"
        }, Reserved: ${s.reserved_qty || 0}, Exp: ${
          s.expiry_date
            ? new Date(s.expiry_date).toLocaleDateString("id-ID")
            : "-"
        })`,
        locName: `[${s.gudang?.zone}] Rak ${s.gudang?.name}`,
        itemNames: s.barang?.nama || "Unknown",
        qtyStr: `Tersedia: ${available} ${s.satuan || "qty"}`,
        disabled: available <= 0,
      };
    }),
  );

  const barangOpts = dedup(
    availableBarangs.map((b: any) => ({
      value: String(b.id),
      label: b.sku
        ? `[${b.kategori}] ${b.sku} - ${b.nama}`
        : `[${b.kategori}] ${b.nama}`,
    })),
  );
  const zoneOpts = dedup(
    availableZones.map((z: any) => ({ value: z, label: z })),
  );
  const customerOpts = Array.from(
    new Set(customers.map((c: any) => c.nama || c.name).filter(Boolean)),
  );
  const shiftOpts = dedup(
    shifts.map((s: any) => ({ value: String(s.id), label: s.name })),
  );
  const batchOpts = Array.from(
    new Set(availableStocks.map((s: any) => s.batch_no).filter(Boolean)),
  );
  const refOpts = Array.from(
    new Set(logs.map((l: any) => l.no_ref).filter(Boolean)),
  );

  const selStock = stocks.find((s: any) => s.id === +form.stock_id);

  /* ================================================================ */
  /*  Form item handling                                               */
  /* ================================================================ */

  const addItemToForm = () => {
    if (!form.stock_id || !form.qty) {
      return notifications.show({
        title: "Error",
        message: "Pilih stock & qty",
        color: "red",
      });
    }
    const st = stocks.find((s: any) => s.id === +form.stock_id);
    if (!st) return;

    const exists = form.items.some(
      (it: any) => String(it.stock_id) === String(form.stock_id),
    );

    if (exists) {
      setForm((p: any) => ({
        ...p,
        items: p.items.map((it: any) =>
          String(it.stock_id) === String(form.stock_id)
            ? { ...it, qty: it.qty + form.qty }
            : it,
        ),
      }));
    } else {
      setForm((p: any) => ({
        ...p,
        items: [
          ...p.items,
          {
            stock_id: form.stock_id,
            barangId: st.barang?.id,
            gudangId: st.gudang?.id,
            qty: form.qty,
            batch_no: form.nomor_batch || st.batch_no || "",
            satuan: st.satuan || st.barang?.satuan || "Pcs",
            _brg: st.barang?.nama || "Unknown",
            _gdg: st.gudang?.name || "-",
            _zone: st.gudang?.zone || "-",
          },
        ],
      }));
    }

    setForm((p: any) => ({ ...p, stock_id: "", qty: 1, nomor_batch: "" }));
  };

  const removeItemFromForm = (idx: number) => {
    setForm((p: any) => ({
      ...p,
      items: p.items.filter((_: any, i: number) => i !== idx),
    }));
  };

  const resetForm = () => {
    setForm(EMPTY_FORM);
    setSelectedZone("");
    setSelectedBarangId("");
  };

  /* ================================================================ */
  /*  Create / update / delete plan                                    */
  /* ================================================================ */

  const submitPlanning = async () => {
    if (!form.items.length) {
      return notifications.show({
        title: "Error",
        message: "Tambahkan minimal 1 item ke planning",
        color: "red",
      });
    }

    const custName = form.tujuan;
    const cust = customers.find((c: any) => (c.nama || c.name) === custName);

    const payload: any = {
      no_ref: form.no_ref || `PLAN-OUT-${Date.now()}`,
      customer_id: cust ? cust.id : undefined,
      shift_id: form.shift_id ? Number(form.shift_id) : undefined,
      tanggal_planning: form.tanggal_permintaan,
      tujuan: custName || undefined,
      items: form.items.map((item: any) => ({
        barang_id: Number(item.barangId),
        gudang_id: Number(item.gudangId),
        qty: Number(item.qty),
        batch_no: item.batch_no || undefined,
        satuan: item.satuan || undefined,
      })),
    };

    try {
      if (editPlanId !== null) {
        await api().put(`/planning-outbound/${editPlanId}`, payload);
        notifications.show({
          title: "Sukses",
          message: "Planning Outbound berhasil diupdate",
          color: "green",
        });
      } else {
        payload.status = "DRAFT";
        try {
          await api().post("/planning-outbound", payload);
          notifications.show({
            title: "Sukses",
            message: "Planning Outbound tersimpan sebagai DRAFT",
            color: "green",
          });
        } catch (netErr: any) {
          const isOffline =
            netErr?.code === "ERR_NETWORK" ||
            netErr?.message === "Network Error" ||
            !navigator.onLine;
          if (isOffline) {
            setOfflineQueue((p) => [...p, payload]);
            notifications.show({
              title: "Mode Offline",
              message:
                "Tersimpan di antrean lokal, otomatis dikirim saat online",
              color: "orange",
            });
          } else {
            throw netErr;
          }
        }
      }

      setEditPlanId(null);
      resetForm();
      load();
    } catch (e: any) {
      notifications.show({
        title: "Error",
        message:
          unwrap(e.response)?.message || "Gagal menyimpan planning outbound",
        color: "red",
      });
    }
  };

  const cancelEdit = () => {
    setEditPlanId(null);
    resetForm();
  };

  const editTrans = (plan: any) => {
    const mappedItems = plan.items.map((r: any) => {
      const barangId = r.barang_id ?? r.barangId;
      const gudangId = r.gudang_id ?? r.gudangId;
      const bObj = barangs.find((b: any) => b.id === barangId);
      const gObj = allGudangs.find((g: any) => g.id === gudangId);
      return {
        barangId,
        gudangId,
        qty: r.qty,
        batch_no: r.batch_no || "",
        satuan: r.satuan || bObj?.satuan || "",
        _brg: bObj ? bObj.nama : "-",
        _gdg: gObj ? gObj.name : "-",
        _zone: gObj ? gObj.zone : "-",
      };
    });

    setForm({
      stock_id: "",
      qty: 1,
      tujuan: plan.customer?.nama || plan.tujuan || "",
      no_ref: plan.no_ref || "",
      shift_id: plan.shift?.id ? String(plan.shift.id) : "",
      tanggal_permintaan: plan.tanggal_planning,
      nomor_batch: "",
      items: mappedItems,
    });
    setEditPlanId(plan.id);
  };

  const deleteTrans = async (planId: number) => {
    if (!confirm("Yakin ingin menghapus Planning Outbound ini?")) return;
    try {
      await api().delete(`/planning-outbound/${planId}`);
      notifications.show({
        title: "Sukses",
        message: "Planning Outbound berhasil dihapus",
        color: "green",
      });
      load();
    } catch (e: any) {
      notifications.show({
        title: "Error",
        message: unwrap(e.response)?.message || "Gagal menghapus planning",
        color: "red",
      });
    }
  };

  /* ================================================================ */
  /*  Draft selection & publish                                        */
  /* ================================================================ */

  const draftPlans = plans.filter((p: any) => p.status === "DRAFT");
  const activePlans = plans.filter(
    (p: any) => p.status !== "DONE" && p.status !== "DRAFT",
  );
  const donePlans = plans.filter((p: any) => p.status === "DONE");

  const allDraftSelected =
    draftPlans.length > 0 && selectedDraftIds.size === draftPlans.length;
  const toggleDraft = (id: number) =>
    setSelectedDraftIds((prev) => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  const toggleSelectAllDrafts = () => {
    if (allDraftSelected) setSelectedDraftIds(new Set());
    else setSelectedDraftIds(new Set(draftPlans.map((d) => d.id)));
  };
  const publishSelected = async () => {
    const ids = Array.from(selectedDraftIds);
    if (!ids.length) return;
    let ok = 0,
      fail = 0;
    for (const id of ids) {
      try {
        await api().post(`/planning-outbound/${id}/promote`, {});
        ok++;
      } catch (e: any) {
        fail++;
        notifications.show({
          title: "Error",
          message: `Gagal publish #${id}: ${unwrap(e.response)?.message || e.message}`,
          color: "red",
        });
      }
    }
    setSelectedDraftIds(new Set());
    load();
    if (ok)
      notifications.show({
        title: "Sukses",
        message: `${ok} draft dipublish jadi WAIT`,
        color: "green",
      });
    if (fail)
      notifications.show({
        title: "Peringatan",
        message: `${fail} gagal`,
        color: "orange",
      });
  };

  /* ================================================================ */
  /*  Sorting                                                          */
  /* ================================================================ */

  const handleSort = (key: string) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  const sortIcon = (key: string) => {
    if (sortKey !== key) return " ↕";
    return sortDir === "asc" ? " ▲" : " ▼";
  };

  const sortFn = (a: any, b: any) => {
    if (!sortKey) return 0;
    let aVal = a[sortKey];
    let bVal = b[sortKey];
    if (aVal == null) aVal = "";
    if (bVal == null) bVal = "";

    if (typeof aVal === "number" && typeof bVal === "number") {
      return sortDir === "asc" ? aVal - bVal : bVal - aVal;
    }
    const cmp = String(aVal).localeCompare(String(bVal), undefined, {
      numeric: true,
    });
    return sortDir === "asc" ? cmp : -cmp;
  };

  const sortedActivePlans = [...activePlans].sort(sortFn);
  const sortedDonePlans = [...donePlans].sort(sortFn);

  /* ================================================================ */
  /*  PDF export                                                       */
  /* ================================================================ */

  const printPDF = (plan: any) => {
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;
    printWindow.document.write(buildOutboundPdfHtml(plan, barangs, allGudangs));
    printWindow.document.close();
  };

  /* ================================================================ */
  /*  Render                                                           */
  /* ================================================================ */

  const sortableColumns = [
    { key: "no_ref", label: "ID Transaksi / Ref" },
    { key: "tujuan", label: "Tujuan" },
    { key: "tanggal_planning", label: "Tanggal Planning" },
    { key: "shift.name", label: "Shift" },
  ];

  return (
    <Box>
      {/* ---------------- Page header ---------------- */}
      <Box
        style={{
          background: "#fff",
          borderLeft: "4px solid #e6921e",
          padding: "14px 20px",
          marginBottom: 16,
          boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
        }}
      >
        <Group justify="space-between">
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
            <IconBuildingWarehouse size={20} style={{ color: "#e6921e" }} />
            PLANNING OUTBOUND
          </Title>
        </Group>
      </Box>

      <Box p="md">
        <Grid gutter="md">
          {/* ============================================================ */}
          {/*  LEFT: Form panel                                            */}
          {/* ============================================================ */}
          <Grid.Col span={{ base: 12, md: 4, lg: 3 }}>
            <Paper withBorder p="md" radius="md" style={{ background: "#fff" }}>
              <Stack gap="xs">
                <Text
                  fw={800}
                  size="sm"
                  c="orange"
                  mb={4}
                  style={{
                    borderBottom: "1px solid #f1f5f9",
                    paddingBottom: 4,
                  }}
                >
                  Buat Planning Outbound
                </Text>

                <Autocomplete
                  label="No. Ref / ID Transaksi"
                  size="xs"
                  data={refOpts}
                  value={form.no_ref}
                  onChange={(v) => setForm((p) => ({ ...p, no_ref: v }))}
                  placeholder="Auto jika kosong"
                />

                <Select
                  label="Filter Nama Item (M. Produk)"
                  size="xs"
                  searchable
                  clearable
                  data={barangOpts}
                  value={selectedBarangId}
                  onChange={(v) => {
                    setSelectedBarangId(v || "");
                    setForm((p) => ({ ...p, stock_id: "" }));
                  }}
                  placeholder="Pilih barang..."
                />

                <Select
                  label="Filter Zone (Opsional)"
                  size="xs"
                  clearable
                  data={zoneOpts}
                  value={selectedZone}
                  onChange={(v) => {
                    setSelectedZone(v || "");
                    setForm((p) => ({ ...p, stock_id: "" }));
                  }}
                  placeholder="Pilih Zone..."
                />

                <Select
                  label="Nomor Rak / Stock"
                  size="xs"
                  searchable
                  clearable
                  data={stockOpts}
                  value={form.stock_id}
                  onChange={(v) => {
                    const sObj = stocks.find(
                      (s: any) => String(s.id) === String(v),
                    );
                    const avail = sObj
                      ? sObj.qty - (sObj.reserved_qty || 0)
                      : 1;
                    setForm((p) => ({
                      ...p,
                      stock_id: v || "",
                      qty: avail > 0 ? 1 : 0,
                    }));
                  }}
                  placeholder="Cari nomor rak..."
                  mb="xs"
                  renderOption={renderColorfulOption}
                />

                {selStock && (
                  <Box
                    style={{
                      background: "#f8f9fa",
                      borderRadius: 6,
                      padding: "6px 8px",
                      fontSize: 11,
                    }}
                  >
                    <Text size="xs" c="dimmed">
                      Nama Item: <b>{selStock.barang?.nama}</b>
                    </Text>
                    <Text size="xs" c="dimmed">
                      Tgl Expired:{" "}
                      <b>
                        {selStock.expiry_date ? fmt(selStock.expiry_date) : "-"}
                      </b>
                    </Text>
                    <Text size="xs" c="dimmed">
                      Stok Fisik:{" "}
                      <b>
                        {selStock.qty} {selStock.satuan}
                      </b>
                    </Text>
                    <Text size="xs" c="orange" fw={600}>
                      Stok Tersedia:{" "}
                      <b>
                        {selStock.qty - (selStock.reserved_qty || 0)}{" "}
                        {selStock.satuan}
                      </b>
                    </Text>
                  </Box>
                )}

                <NumberInput
                  label="Qty"
                  size="xs"
                  allowedDecimalSeparators={[".", ","]}
                  decimalScale={3}
                  step={0.1}
                  value={form.qty}
                  onChange={(v) => setForm((p) => ({ ...p, qty: Number(v) }))}
                  min={1}
                  max={
                    selStock
                      ? selStock.qty - (selStock.reserved_qty || 0)
                      : undefined
                  }
                  disabled={!form.stock_id}
                />

                <Autocomplete
                  label="Nomor Batch"
                  size="xs"
                  data={batchOpts}
                  value={form.nomor_batch}
                  onChange={(v) => setForm((p) => ({ ...p, nomor_batch: v }))}
                  placeholder="Pilih/Ketik Nomor Batch"
                />

                <Button
                  size="xs"
                  color="orange"
                  variant="outline"
                  onClick={addItemToForm}
                  leftSection={<IconPlus size={14} />}
                >
                  + Tambah Item
                </Button>

                {form.items.length > 0 && (
                  <Box style={{ overflowX: "auto", marginTop: 8 }}>
                    <table
                      style={{
                        width: "100%",
                        fontSize: 10,
                        borderCollapse: "collapse",
                      }}
                    >
                      <thead>
                        <tr
                          style={{
                            background: "#f8f9fa",
                            borderBottom: "1px solid #e2e8f0",
                          }}
                        >
                          <th style={{ textAlign: "left", padding: 4 }}>
                            Barang
                          </th>
                          <th style={{ textAlign: "right", padding: 4 }}>
                            Qty
                          </th>
                          <th style={{ textAlign: "center", padding: 4 }}>
                            Aksi
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {form.items.map((it: any, idx: number) => (
                          <tr
                            key={idx}
                            style={{ borderBottom: "1px solid #f1f5f9" }}
                          >
                            <td style={{ padding: 4 }}>
                              {it._brg} ({it._gdg})
                            </td>
                            <td
                              style={{
                                padding: 4,
                                textAlign: "right",
                                fontWeight: 700,
                              }}
                            >
                              {it.qty} {it.satuan}
                            </td>
                            <td style={{ padding: 4, textAlign: "center" }}>
                              <ActionIcon
                                size="xs"
                                color="red"
                                variant="subtle"
                                onClick={() => removeItemFromForm(idx)}
                              >
                                <IconTrash size={12} />
                              </ActionIcon>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </Box>
                )}

                <Divider my={4} />

                <Autocomplete
                  label="Tujuan (Master Customer)"
                  size="xs"
                  data={customerOpts}
                  value={form.tujuan}
                  onChange={(v) => setForm((p) => ({ ...p, tujuan: v }))}
                  placeholder="Produksi AP / Customer..."
                />
                <TextInput
                  label="Tanggal Permintaan"
                  size="xs"
                  type="date"
                  value={form.tanggal_permintaan}
                  onChange={(e) =>
                    setForm((p) => ({
                      ...p,
                      tanggal_permintaan: e.target.value,
                    }))
                  }
                />
                <Autocomplete
                  label="Shift"
                  size="xs"
                  data={shifts.map((s: any) => s.name)}
                  value={
                    shifts.find((s: any) => String(s.id) === form.shift_id)
                      ?.name || form.shift_id
                  }
                  onChange={(v) => {
                    const match = shifts.find(
                      (s: any) => s.name.toLowerCase() === v.toLowerCase(),
                    );
                    setForm((p) => ({
                      ...p,
                      shift_id: match ? String(match.id) : v,
                    }));
                  }}
                  placeholder="Pilih shift"
                />

                <Group gap="xs" mt="xs">
                  <Button
                    fullWidth
                    size="xs"
                    color="orange"
                    onClick={submitPlanning}
                    style={{ fontWeight: 700, flex: 1 }}
                    leftSection={<IconPlus size={14} />}
                  >
                    {editPlanId !== null
                      ? "Update Planning Outbound"
                      : "Simpan Planning Outbound"}
                  </Button>
                  {editPlanId !== null && (
                    <Button
                      size="xs"
                      color="gray"
                      variant="outline"
                      onClick={cancelEdit}
                    >
                      Batal
                    </Button>
                  )}
                </Group>
              </Stack>
            </Paper>
          </Grid.Col>

          {/* ============================================================ */}
          {/*  RIGHT: Tables                                               */}
          {/* ============================================================ */}
          <Grid.Col span={{ base: 12, md: 8, lg: 9 }}>
            <Stack gap="md">
              {/* ---------------- DRAFT ---------------- */}
              <Paper
                withBorder
                p="md"
                radius="md"
                style={{ background: "#fff" }}
              >
                <Group justify="space-between" mb="sm">
                  <Text fw={850} size="sm" c="orange">
                    DRAFT PLANNING OUTBOUND ({draftPlans.length})
                  </Text>
                  <Button
                    size="xs"
                    color="green"
                    leftSection={<IconSend size={14} />}
                    disabled={selectedDraftIds.size === 0}
                    onClick={publishSelected}
                  >
                    Publish{" "}
                    {selectedDraftIds.size ? `(${selectedDraftIds.size})` : ""}
                  </Button>
                </Group>

                {draftPlans.length === 0 ? (
                  <Text size="xs" c="dimmed">
                    Belum ada draft planning outbound. Buat planning dan simpan,
                    maka akan muncul di sini sebagai DRAFT.
                  </Text>
                ) : (
                  <Box style={{ overflowX: "auto" }}>
                    <Table
                      withTableBorder
                      withColumnBorders
                      style={{
                        fontSize: 11,
                        tableLayout: "auto",
                        width: "100%",
                      }}
                    >
                      <Table.Thead
                        style={{
                          background: "#fff4e6",
                          borderBottom: "2px solid #ffd8a8",
                        }}
                      >
                        <Table.Tr>
                          <Table.Th
                            style={{
                              color: "#d9480f",
                              width: 36,
                              whiteSpace: "nowrap",
                            }}
                          >
                            <Text size="xs" fw={700} c="#d9480f">#</Text>
                          </Table.Th>
                          <Table.Th
                            style={{
                              color: "#d9480f",
                              whiteSpace: "nowrap",
                              width: "22%",
                            }}
                          >
                            ID / Ref
                          </Table.Th>
                          <Table.Th
                            style={{
                              color: "#d9480f",
                              whiteSpace: "nowrap",
                              width: "18%",
                            }}
                          >
                            Tujuan
                          </Table.Th>
                          <Table.Th
                            style={{
                              color: "#d9480f",
                              whiteSpace: "nowrap",
                              width: 110,
                            }}
                          >
                            Tanggal
                          </Table.Th>
                          <Table.Th style={{ color: "#d9480f", minWidth: 180 }}>
                            Items
                          </Table.Th>
                          <Table.Th
                            style={{
                              color: "#d9480f",
                              width: 70,
                              whiteSpace: "nowrap",
                            }}
                          >
                            Aksi
                          </Table.Th>
                        </Table.Tr>
                      </Table.Thead>
                      <Table.Tbody>
                        {draftPlans.map((plan: any) => {
                          const items: any[] = Array.isArray(plan.items)
                            ? plan.items
                            : [];
                          return (
                            <Table.Tr
                              key={plan.id}
                              style={
                                selectedDraftIds.has(plan.id)
                                  ? { background: "#fff7ed" }
                                  : undefined
                              }
                            >
                              <Table.Td>
                                <Checkbox
                                  size="xs"
                                  checked={selectedDraftIds.has(plan.id)}
                                  onChange={() => toggleDraft(plan.id)}
                                />
                              </Table.Td>
                              <Table.Td fw={700} style={{ color: "#1565c0" }}>
                                {plan.no_ref || `#${plan.id}`}
                              </Table.Td>
                              <Table.Td>
                                {plan.customer?.nama || plan.tujuan || "-"}
                              </Table.Td>
                              <Table.Td>{fmt(plan.tanggal_planning)}</Table.Td>
                              <Table.Td>
                                <div
                                  style={{ maxHeight: 120, overflowY: "auto" }}
                                >
                                  {items.map((item: any, idx: number) => {
                                    const bName =
                                      barangs.find(
                                        (b: any) => b.id === item.barangId,
                                      )?.nama || "-";
                                    return (
                                      <div
                                        key={idx}
                                        style={{
                                          fontSize: 10,
                                          borderBottom: "1px solid #f1f5f9",
                                          padding: "2px 0",
                                        }}
                                      >
                                        {bName} <b>x{item.qty}</b>{" "}
                                        {item.satuan || ""}
                                      </div>
                                    );
                                  })}
                                </div>
                              </Table.Td>
                              <Table.Td>
                                <Group gap={6} wrap="nowrap">
                                  <Tooltip label="Edit">
                                    <ActionIcon
                                      size="sm"
                                      color="green"
                                      variant="light"
                                      onClick={() => editTrans(plan)}
                                    >
                                      <IconEdit size={13} />
                                    </ActionIcon>
                                  </Tooltip>
                                  <Tooltip label="Hapus">
                                    <ActionIcon
                                      size="sm"
                                      color="red"
                                      variant="light"
                                      onClick={() => deleteTrans(plan.id)}
                                    >
                                      <IconTrash size={13} />
                                    </ActionIcon>
                                  </Tooltip>
                                </Group>
                              </Table.Td>
                            </Table.Tr>
                          );
                        })}
                      </Table.Tbody>
                    </Table>
                  </Box>
                )}

                {offlineQueue.length > 0 && (
                  <Text size="xs" c="orange" mt="xs">
                    {offlineQueue.length} draft tertahan di antrean offline
                    (belum terkirim ke server).
                  </Text>
                )}
              </Paper>

              {/* ---------------- DONE / HISTORY (gabung aktif + selesai kayak inbound) ---------------- */}
              <Paper withBorder p="md" radius="md" style={{ background: "#fff" }}>
                <Group justify="space-between" mb="xs">
                  <Text fw={850} size="sm" c="dimmed">RIWAYAT PLANNING OUTBOUND ({[...activePlans, ...donePlans].length} Transaksi)</Text>
                  <Group gap="xs">
                    <TextInput placeholder="Cari Ref/Tujuan..." size="xs" value={search} onChange={(e) => setSearch(e.target.value)} style={{ width: 180 }} />
                    <Select size="xs" data={[{ value: "ALL", label: "Semua Status" }, { value: "WAIT", label: "WAIT" }, { value: "DONE", label: "DONE" }]} value={statusFilter} onChange={(v) => setStatusFilter(v || "ALL")} style={{ width: 120 }} />
                  </Group>
                </Group>
                <Box style={{ overflowX: "auto" }}>
                  <Table
                    withTableBorder
                    withColumnBorders
                    style={{ fontSize: 11, tableLayout: "auto", width: "100%" }}
                  >
                    <Table.Thead
                      style={{
                        background: "#fff4e6",
                        borderBottom: "2px solid #ffd8a8",
                      }}
                    >
                      <Table.Tr>
                        {sortableColumns.map((col) => (
                          <Table.Th key={col.key} style={{ color: "#d9480f", cursor: "pointer", whiteSpace: "nowrap" }} onClick={() => handleSort(col.key)}>
                            {col.label}{sortIcon(col.key)}
                          </Table.Th>
                        ))}
                        <Table.Th style={{ color: "#d9480f" }}>Items / Asal</Table.Th>
                        <Table.Th style={{ color: "#d9480f", whiteSpace: "nowrap" }}>Status</Table.Th>
                        <Table.Th style={{ color: "#d9480f" }}>Audit / Keterangan</Table.Th>
                      </Table.Tr>
                    </Table.Thead>
                    <Table.Tbody>
                      {[...activePlans, ...donePlans]
                        .filter((p: any) => (statusFilter==="ALL"||p.status===statusFilter) && (!search || p.no_ref?.toLowerCase().includes(search.toLowerCase()) || p.tujuan?.toLowerCase().includes(search.toLowerCase())))
                        .sort(
                          (a, b) =>
                            (a.status === "WAIT" ? -1 : 1) -
                              (b.status === "WAIT" ? -1 : 1) ||
                            new Date(b.created_at).getTime() -
                              new Date(a.created_at).getTime(),
                        )
                        .map((plan: any) => (
                          <Table.Tr
                            key={plan.id}
                            style={
                              plan.status === "WAIT"
                                ? { background: "#fffbeb" }
                                : undefined
                            }
                          >
                            <Table.Td fw={700} style={{ color: "#1565c0" }}>
                              {plan.no_ref || `#${plan.id}`}
                            </Table.Td>
                            <Table.Td>
                              {plan.customer?.nama || plan.tujuan || "-"}
                            </Table.Td>
                            <Table.Td>{fmt(plan.tanggal_planning)}</Table.Td>
                            <Table.Td>{plan.shift?.name || "-"}</Table.Td>
                            <Table.Td>
                              <ItemsMiniList
                                items={plan.items}
                                barangs={barangs}
                                allGudangs={allGudangs}
                              />
                            </Table.Td>
                            <Table.Td>
                              <Badge
                                size="xs"
                                color={
                                  plan.status === "WAIT"
                                    ? "yellow"
                                    : plan.status === "DONE"
                                      ? "green"
                                      : "gray"
                                }
                              >
                                {plan.status}
                              </Badge>
                            </Table.Td>
                            <Table.Td>
                              <div style={{ fontSize: 10 }}>
                                <div>
                                  Dibuat {plan.created_by_username || "sistem"}{" "}
                                  · {fmt(plan.created_at)}
                                </div>
                                {plan.published_at && (
                                  <div style={{ color: "#64748b" }}>
                                    Eksekusi{" "}
                                    {plan.executed_by_username || "sistem"} ·{" "}
                                    {fmt(plan.published_at)}
                                  </div>
                                )}
                                {plan.keterangan && (
                                  <div
                                    style={{ marginTop: 2, color: "#475569" }}
                                  >
                                    {plan.keterangan}
                                  </div>
                                )}
                              </div>
                            </Table.Td>
                          </Table.Tr>
                        ))}
                      {[...activePlans, ...donePlans].filter((p: any) => (statusFilter==="ALL"||p.status===statusFilter) && (!search || p.no_ref?.toLowerCase().includes(search.toLowerCase()) || p.tujuan?.toLowerCase().includes(search.toLowerCase()))).length === 0 && (
                        <Table.Tr>
                          <Table.Td colSpan={7} ta="center" c="dimmed">
                            Tidak ada data planning outbound.
                          </Table.Td>
                        </Table.Tr>
                      )}
                    </Table.Tbody>
                  </Table>
                </Box>
              </Paper>
            </Stack>
          </Grid.Col>
        </Grid>
      </Box>
    </Box>
  );
}
