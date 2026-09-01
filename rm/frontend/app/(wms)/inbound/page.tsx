"use client";
// @ts-nocheck

import React, { Suspense, useEffect, useRef, useState } from "react";
import {
  ActionIcon,
  Autocomplete,
  Badge,
  Box,
  Button,
  Divider,
  Grid,
  Group,
  Loader,
  NumberInput,
  Paper,
  Select,
  Stack,
  Text,
  TextInput,
  Title,
  Tooltip,
} from "@mantine/core";
import { Table } from "../components/Table";
import {
  IconBuildingWarehouse,
  IconCheck,
  IconPlus,
  IconSend,
  IconTrash,
  IconX,
} from "@tabler/icons-react";
import { notifications } from "@mantine/notifications";
import { useRouter, useSearchParams } from "next/navigation";
import { api, unwrap, fmtDateTime, dedup } from "../lib/api";

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const ZONES = ["CS FROZEN", "CHILL", "WASTE", "DRY A", "DRY B", "DRY FG"];
const DRAFTS_STORAGE_KEY = "wms_inbound_drafts";

const EMPTY_FORM = {
  no_po: "",
  barang_id: "",
  item_manual: "",
  qty: 1,
  satuan: "",
  batch_no: "",
  expiry_date: "",
  supplier: "",
  shift_id: "",
  tanggal_income: new Date().toISOString().split("T")[0],
  jam_datang: "",
  jam_bongkar: "",
  jam_selesai: "",
  gudang_id: "",
};

const EMPTY_PROCESS_TOP = { jam_datang: "", jam_bongkar: "", shift_id: "" };

/* ------------------------------------------------------------------ */
/*  Small formatting / stock helpers                                   */
/* ------------------------------------------------------------------ */

function formatDateTime(value: any) {
  if (!value) return "-";
  const d = new Date(value);
  return `${d.toLocaleDateString("id-ID")} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

const stocksInRack = (stocks: any[], gudangId: any) => stocks.filter((s: any) => String(s.gudang?.id) === String(gudangId));

const rackTotalQty = (rackStocks: any[]) => rackStocks.reduce((sum: number, s: any) => sum + (s.qty || 0), 0);

/** True when a rack already holds stock for a different product than the one being placed. */
function rackHasProductConflict(rackStocks: any[], barangId: any, itemManual?: string) {
  if (barangId) {
    return rackStocks.some((s: any) => s.barang && String(s.barang.id) !== String(barangId));
  }
  if (itemManual) {
    return rackStocks.some((s: any) => s.barang || (s.item_name && s.item_name !== itemManual));
  }
  return false;
}

/* ------------------------------------------------------------------ */
/*  Small presentational helpers                                      */
/* ------------------------------------------------------------------ */

const renderColorfulOption: any = ({ option }: any) => {
  if (option.isEmpty) {
    return (
      <Group gap={6} wrap="nowrap">
        <Badge color="green" variant="filled" style={{ textTransform: "none" }}>
          {option.locName}
        </Badge>
        <Text size="xs" c="dimmed">KOSONG</Text>
      </Group>
    );
  }
  if (option.locName) {
    return (
      <Group gap={6} wrap="nowrap">
        <Badge color="green" variant="filled" style={{ textTransform: "none" }}>
          {option.locName}
        </Badge>
        {option.itemNames && (
          <Badge color="orange" variant="light" style={{ textTransform: "none", maxWidth: 120 }} size="xs">
            {option.itemNames.length > 20 ? `${option.itemNames.slice(0, 20)}...` : option.itemNames}
          </Badge>
        )}
        {option.qtyStr && (
          <Text size="xs" c="blue" fw={600}>{option.qtyStr}</Text>
        )}
      </Group>
    );
  }
  return <Text size="sm">{option.label}</Text>;
};

function EmptyState({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) {
  return (
    <Box style={{ textAlign: "center", padding: "60px 20px", opacity: 0.6 }}>
      <Box style={{ fontSize: 48, marginBottom: 16 }}>{icon}</Box>
      <Text fw={700} size="lg" mb={4}>{title}</Text>
      <Text size="sm" c="dimmed">{description}</Text>
    </Box>
  );
}

function PlanningItemsList({ plan, barangs }: { plan: any; barangs: any[] }) {
  return (
    <>
      {plan.items?.map((item: any, idx: number) => {
        const barangId = item.barang_id ?? item.barangId;
        const bObj = barangs.find((b: any) => String(b.id) === String(barangId));
        const name = bObj ? bObj.nama : `Barang #${barangId}`;
        return (
          <div key={idx} style={{ fontSize: 10, borderBottom: "1px solid #f1f5f9", padding: "2px 0" }}>
            {name} <b>x{item.qty} {item.satuan || bObj?.satuan || ""}</b>
          </div>
        );
      })}
    </>
  );
}

const HISTORY_COLUMNS = [
  { key: "no_po", label: "NoPO" },
  { key: "barang.nama", label: "Item" },
  { key: "tanggal_income", label: "Tgl.Income" },
  { key: "gudang.zone", label: "Zone" },
  { key: "gudang.name", label: "Rak" },
  { key: "qty", label: "Qty" },
  { key: "expiry_date", label: "Expired" },
  { key: "supplier", label: "Supplier" },
  { key: "shift.name", label: "Shift" },
];

/* ------------------------------------------------------------------ */
/*  Process-item card (used inside the "proses planning" side panel)   */
/* ------------------------------------------------------------------ */

function ProcessItemCard({
  item,
  index,
  barangOpts,
  barangs,
  allGudangs,
  stocks,
  canRemove,
  onUpdate,
  onRemove,
}: {
  item: any;
  index: number;
  barangOpts: any[];
  barangs: any[];
  allGudangs: any[];
  stocks: any[];
  canRemove: boolean;
  onUpdate: (id: number, field: string, value: any) => void;
  onRemove: (id: number) => void;
}) {
  const bName = barangs.find((b: any) => String(b.id) === String(item.barang_id))?.nama || `Item ${index + 1}`;

  const itemZone = item.zone || "";
  const filteredRaks = allGudangs
    .filter((g: any) => g.zone?.toUpperCase() === itemZone.toUpperCase())
    .map((g: any) => {
      const rackStocks = stocksInRack(stocks, g.id);
      const totalQty = rackTotalQty(rackStocks);
      const disabled = totalQty > 0 && rackHasProductConflict(rackStocks, item.barang_id);
      const label = totalQty > 0 ? `${g.name} (${totalQty} qty)` : `${g.name} (KOSONG)`;
      return { value: String(g.id), label, disabled };
    })
    .filter((r: any) => !r.disabled);

  const qtyMismatch = Number(item.qty) !== Number(item.plan_qty);

  return (
    <Box style={{ border: "1px solid #e2e8f0", borderRadius: 6, padding: 8, background: "#fafafa", marginBottom: 4 }}>
      <Group justify="space-between" mb={4}>
        {item.plan_qty > 0 ? (
          <Text fw={700} size="xs" c="indigo">{bName}</Text>
        ) : (
          <Select
            label="Pilih Barang"
            size="xs"
            searchable
            data={barangOpts}
            value={item.barang_id}
            onChange={(v) => onUpdate(item.id, "barang_id", v || "")}
            placeholder="Pilih produk master"
            required
            style={{ flex: 1, marginRight: 8 }}
          />
        )}
        {canRemove && (
          <ActionIcon size="xs" color="red" variant="subtle" onClick={() => onRemove(item.id)}>
            <IconTrash size={12} />
          </ActionIcon>
        )}
      </Group>

      <Text size="10px" c="dimmed" mb={4}>
        Planning Qty: <b>{item.plan_qty} {item.satuan}</b>
      </Text>

      <NumberInput
        label="Qty Diterima"
        size="xs"
        allowedDecimalSeparators={[".", ","]}
        decimalScale={3}
        step={0.1}
        value={item.qty}
        onChange={(v) => onUpdate(item.id, "qty", Number(v || 0))}
        min={0.001}
        required
      />

      <Select
        label="Pilih Zone"
        size="xs"
        data={ZONES}
        value={item.zone || ""}
        onChange={(v) => {
          onUpdate(item.id, "zone", v || "");
          onUpdate(item.id, "gudang_id", ""); // reset rak
        }}
        placeholder="Pilih Zone"
        required
      />

      {item.zone && (
        <Select
          label="Tujuan Rak"
          size="xs"
          searchable
          data={filteredRaks}
          value={item.gudang_id || ""}
          onChange={(v) => onUpdate(item.id, "gudang_id", v || "")}
          placeholder="Pilih rak"
          required
        />
      )}

      <TextInput
        label="Batch No"
        size="xs"
        value={item.batch_no}
        onChange={(e) => onUpdate(item.id, "batch_no", e.target.value)}
        placeholder="Batch number"
      />

      <TextInput
        label="Expiry Date"
        size="xs"
        type="date"
        required
        value={item.expiry_date}
        onChange={(e) => onUpdate(item.id, "expiry_date", e.target.value)}
      />

      {qtyMismatch && (
        <TextInput
          label="Keterangan Selisih"
          size="xs"
          placeholder="Sebab selisih qty..."
          value={item.note || ""}
          onChange={(e) => onUpdate(item.id, "note", e.target.value)}
          required
        />
      )}
    </Box>
  );
}

/* ------------------------------------------------------------------ */
/*  Main content (wrapped in Suspense below because of useSearchParams)*/
/* ------------------------------------------------------------------ */

function InboundContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  /* ---------------- Master data ---------------- */
  const [barangs, setBarangs] = useState<any[]>([]);
  const [allGudangs, setAllGudangs] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [shifts, setShifts] = useState<any[]>([]);
  const [stocks, setStocks] = useState<any[]>([]);
  const [dbPlannings, setDbPlannings] = useState<any[]>([]);
  const [logs, setLogs] = useState<any[]>([]);

  /* ---------------- Local (not-yet-posted) drafts ---------------- */
  const [drafts, setDrafts] = useState<any[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      const saved = localStorage.getItem(DRAFTS_STORAGE_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      return [];
    }
  });

  /* ---------------- Riwayat filters ---------------- */
  const [type, setType] = useState("wet");
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  /* ---------------- Permissions ---------------- */
  const [canManual, setCanManual] = useState(false);

  /* ---------------- Manual-entry form ---------------- */
  const [form, setForm] = useState<any>(EMPTY_FORM);
  const [selectedZone, setSelectedZone] = useState("");
  const barcodeRef = useRef<any>(null);

  /* ---------------- "Proses planning" side form ---------------- */
  const [selectedPlanningId, setSelectedPlanningId] = useState<number | null>(null);
  const [selectedPlanning, setSelectedPlanning] = useState<any>(null);
  const [processItems, setProcessItems] = useState<any[]>([]);
  const [processLoading, setProcessLoading] = useState(false);
  const [processTop, setProcessTop] = useState<any>(EMPTY_PROCESS_TOP);

  /* ================================================================ */
  /*  Permissions                                                      */
  /* ================================================================ */

  useEffect(() => {
    try {
      const role = Number(JSON.parse(localStorage.getItem("user") || "{}").role);
      setCanManual(role === 1 || role === 4 || role === 5);
    } catch {
      setCanManual(false);
    }
  }, []);

  /* ================================================================ */
  /*  Data loading                                                     */
  /* ================================================================ */

  const loadBarangs = async () => {
    try {
      const r = await api().get("/barang");
      setBarangs(unwrap(r));
    } catch (e) {
      console.error("Load barangs failed:", e);
    }
  };

  const loadDbPlannings = async () => {
    try {
      const r = await api().get("/inbound-planning");
      const planData = unwrap(r);
      setDbPlannings(Array.isArray(planData) ? planData : planData?.data || []);
    } catch (e) {
      console.error("Load db plannings failed:", e);
    }
  };

  const loadGudangsAndStocks = async () => {
    try {
      const [g, s] = await Promise.all([api().get("/gudang"), api().get("/inventory/stock")]);
      const gudangData = unwrap(g);
      setAllGudangs(Array.isArray(gudangData) ? gudangData : gudangData?.data || []);
      const stockData = unwrap(s);
      setStocks(Array.isArray(stockData) ? stockData : stockData?.data || []);
    } catch (e) {
      console.error("Load gudangs failed:", e);
    }
  };

  const loadLogs = () => {
    api().get("/inventory/logs/inbound").then((r) => setLogs(unwrap(r)));
  };

  useEffect(() => {
    loadBarangs();
    loadGudangsAndStocks();
    loadDbPlannings();
    api().get("/customers").then((r) => setCustomers(unwrap(r)));
    api().get("/shifts").then((r) => setShifts(unwrap(r)));
    loadLogs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ---------------- Persist local drafts (skip initial write) ---------------- */

  const initialWrite = useRef(true);
  useEffect(() => {
    if (initialWrite.current) {
      initialWrite.current = false;
      return;
    }
    localStorage.setItem(DRAFTS_STORAGE_KEY, JSON.stringify(drafts));
  }, [drafts]);

  /* ---------------- Prefill from redirect (?no_po=&supplier=) ---------------- */

  useEffect(() => {
    if (!searchParams) return;
    const qPo = searchParams.get("no_po");
    const qSup = searchParams.get("supplier");
    if (qPo) f("no_po", qPo);
    if (qSup) f("supplier", qSup);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const f = (k: string, v: any) => setForm((p: any) => ({ ...p, [k]: v }));

  const deletePlanning = async (plan: any) => {
    if (!confirm(`Yakin hapus planning inbound: ${plan.no_po}?`)) return;
    try {
      await api().delete(`/inbound-planning/${plan.id}`);
      notifications.show({ title: "Sukses", message: "Planning berhasil dihapus", color: "green" });
      loadDbPlannings();
    } catch (e: any) {
      notifications.show({ title: "Error", message: unwrap(e.response)?.message || "Gagal hapus", color: "red" });
    }
  };

  /* ================================================================ */
  /*  Manual draft form                                                */
  /* ================================================================ */

  const getGudangs = () => {
    if (!selectedZone) return [];
    return allGudangs.filter((g: any) => g.zone?.toUpperCase() === selectedZone.toUpperCase());
  };

  const addDraft = () => {
    if (!form.barang_id && !form.item_manual) {
      return notifications.show({ title: "Error", message: "Pilih / isi item", color: "red" });
    }
    if (!selectedZone) {
      return notifications.show({ title: "Error", message: "Pilih Zone Gudang", color: "red" });
    }

    if (form.gudang_id) {
      const rackStocks = stocksInRack(stocks, form.gudang_id);
      if (rackStocks.length > 0 && rackHasProductConflict(rackStocks, form.barang_id, form.item_manual)) {
        return notifications.show({ title: "Klaim Error", message: "Rak ini sudah dialokasikan untuk produk lain!", color: "red" });
      }
    }

    let brgName = form.item_manual || "";
    if (!brgName && form.barang_id) {
      brgName = barangs.find((b: any) => String(b.id) === String(form.barang_id))?.nama || "";
    }

    setDrafts((p: any[]) => [
      ...p,
      {
        ...form,
        id: Date.now(),
        _brg: brgName,
        _gdg: allGudangs.find((g: any) => String(g.id) === String(form.gudang_id))?.name || "-",
        _zone: selectedZone,
      },
    ]);

    setForm((p: any) => ({ ...p, barang_id: "", item_manual: "", qty: 1, batch_no: "", expiry_date: "", gudang_id: "" }));
    if (barcodeRef.current) barcodeRef.current.focus();
  };

  const postAll = async () => {
    if (!drafts.length) return;
    const invalidDrafts = drafts.filter((d: any) => !Number.isFinite(Number(d.qty)) || Number(d.qty) <= 0);
    if (invalidDrafts.length > 0) {
      return notifications.show({
        title: "Qty tidak valid",
        message: `${invalidDrafts.length} draft memiliki qty 0/kosong. Isi qty lebih dari 0 sebelum posting.`,
        color: "red",
      });
    }

    try {
      await api().post("/inventory/inbound", {
        items: drafts.map((d: any) => ({
          barang_id: d.barang_id ? Number(d.barang_id) : 0,
          gudang_id: d.gudang_id ? Number(d.gudang_id) : 0,
          qty: Number(d.qty),
          batch_no: d.batch_no,
          expiry_date: d.expiry_date || null,
          supplier: d.supplier,
          no_po: d.no_po,
          shift_id: d.shift_id ? Number(d.shift_id) : undefined,
          tanggal_income: d.tanggal_income,
          jam_datang: d.jam_datang,
          jam_bongkar: d.jam_bongkar,
          jam_selesai: d.jam_selesai,
        })),
      });

      notifications.show({ title: "Sukses", message: "Semua draft berhasil diposting", color: "green" });
      setDrafts([]);
      loadLogs();
      loadDbPlannings();
    } catch (e: any) {
      notifications.show({ title: "Error", message: unwrap(e.response)?.message || "Failed", color: "red" });
    }
  };

  const postAllFromDraft = async (idx: number) => {
    const draft = drafts[idx];
    if (!draft) return;
    if (!Number.isFinite(Number(draft.qty)) || Number(draft.qty) <= 0) {
      return notifications.show({ title: "Qty tidak valid", message: "Qty inbound harus lebih besar dari 0.", color: "red" });
    }

    try {
      await api().post("/inventory/inbound", {
        items: [
          {
            barang_id: draft.barang_id ? Number(draft.barang_id) : 0,
            gudang_id: draft.gudang_id ? Number(draft.gudang_id) : 0,
            qty: Number(draft.qty),
            batch_no: draft.batch_no,
            expiry_date: draft.expiry_date || null,
            supplier: draft.supplier,
            no_po: draft.no_po,
            shift_id: draft.shift_id ? Number(draft.shift_id) : undefined,
            tanggal_income: draft.tanggal_income,
            jam_datang: draft.jam_datang,
            jam_bongkar: draft.jam_bongkar,
            jam_selesai: draft.jam_selesai,
          },
        ],
      });
      notifications.show({ title: "Sukses", message: `Draft ${draft.no_po} berhasil diproses`, color: "green" });
      setDrafts((p: any[]) => p.filter((_, j) => j !== idx));
      loadLogs();
      loadDbPlannings();
    } catch (e: any) {
      notifications.show({ title: "Error", message: unwrap(e.response)?.message || "Gagal", color: "red" });
    }
  };

  /* ================================================================ */
  /*  Option lists                                                     */
  /* ================================================================ */

  const barangOpts = dedup(
    barangs.map((s: any) => ({
      value: String(s.id),
      label: s.sku ? `[${s.kategori}] ${s.sku} - ${s.nama}` : `[${s.kategori}] ${s.nama}`,
    }))
  );
  const customerOpts = Array.from(new Set(customers.map((c: any) => c.nama || c.name).filter(Boolean)));
  const shiftOpts = dedup(shifts.map((s: any) => ({ value: String(s.id), label: s.name })));
  const poOpts = Array.from(new Set(logs.map((l: any) => l.no_po).filter(Boolean)));
  const satuanOpts = Array.from(new Set([...barangs.map((b: any) => b.satuan), ...logs.map((l: any) => l.satuan)].filter(Boolean)));
  const batchOpts = Array.from(new Set(logs.map((l: any) => l.batch_no).filter(Boolean)));

  const rakOpts = dedup(
    getGudangs()
      .map((g: any) => {
        const rackStocks = stocksInRack(stocks, g.id);
        const totalQty = rackTotalQty(rackStocks);

        if (totalQty > 0) {
          const disabled = rackHasProductConflict(rackStocks, form.barang_id, form.item_manual);
          const produkNames = Array.from(new Set(rackStocks.map((s: any) => (s.barang ? s.barang.nama : s.item_name)).filter(Boolean))).join(", ");
          return {
            value: String(g.id),
            label: g.name,
            locName: g.name,
            itemNames: produkNames,
            qtyStr: `${totalQty} ${rackStocks[0]?.satuan || "qty"}`,
            disabled,
            isEmpty: false,
          };
        }
        return { value: String(g.id), label: `${g.name} (KOSONG)`, locName: g.name, isEmpty: true, disabled: false };
      })
      .filter((r: any) => !r.disabled)
  );

  /* ================================================================ */
  /*  Sorting / filtering (riwayat)                                    */
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

  const sortedData = [...logs].sort((a, b) => {
    if (!sortKey) return 0;

    let aVal = a[sortKey];
    let bVal = b[sortKey];

    if (sortKey === "barang.nama") { aVal = a.barang?.nama || ""; bVal = b.barang?.nama || ""; }
    else if (sortKey === "gudang.name") { aVal = a.gudang?.name || ""; bVal = b.gudang?.name || ""; }
    else if (sortKey === "gudang.zone") { aVal = a.gudang?.zone || ""; bVal = b.gudang?.zone || ""; }
    else if (sortKey === "shift.name") { aVal = a.shift?.name || ""; bVal = b.shift?.name || ""; }

    if (aVal == null) aVal = "";
    if (bVal == null) bVal = "";

    if (typeof aVal === "number" && typeof bVal === "number") {
      return sortDir === "asc" ? aVal - bVal : bVal - aVal;
    }
    const cmp = String(aVal).localeCompare(String(bVal), undefined, { numeric: true });
    return sortDir === "asc" ? cmp : -cmp;
  });

  const filtered = sortedData
    .filter((r: any) => {
      const z = r.gudang?.zone?.toUpperCase() || "";
      const cat = r.barang?.kategori?.toUpperCase() || "";
      if (type.toUpperCase() === "WET") return ["CS FROZEN", "CHILL", "WASTE"].includes(z) || cat === "WET";
      if (type.toUpperCase() === "DRY") return ["DRY A", "DRY B", "DRY FG"].includes(z) || cat === "DRY";
      return true;
    })
    .filter(
      (r: any) =>
        !search ||
        r.barang?.nama?.toLowerCase().includes(search.toLowerCase()) ||
        r.no_po?.toLowerCase().includes(search.toLowerCase()) ||
        r.supplier?.toLowerCase().includes(search.toLowerCase()) ||
        r.gudang?.name?.toLowerCase().includes(search.toLowerCase()) ||
        r.gudang?.zone?.toLowerCase().includes(search.toLowerCase())
    );

  /* ================================================================ */
  /*  "Proses planning" side form                                      */
  /* ================================================================ */

  const openProcessModal = (planning: any) => {
    setSelectedPlanning(planning);
    setSelectedPlanningId(planning.id);
    setForm({ ...EMPTY_FORM, no_po: planning.no_po, supplier: planning.supplier || "" });
    setProcessTop({
      jam_datang: planning.estimasi_datang ? new Date(planning.estimasi_datang).toISOString().slice(11, 16) : "",
      jam_bongkar: "",
      shift_id: "",
    });

    const initialItems: any[] = [];
    (planning.items || []).forEach((item: any, idx: number) => {
      const barangId = item.barang_id ?? item.barangId;
      const rackAllocations = item.rack_allocations ?? item.rackAllocations ?? [];
      const bObj = barangs.find((b: any) => String(b.id) === String(barangId));

      if (rackAllocations.length > 0) {
        rackAllocations.forEach((alloc: any, aIdx: number) => {
          const gudangId = alloc.gudang_id ?? alloc.gudangId;
          const gdg = allGudangs.find((g: any) => String(g.id) === String(gudangId));
          initialItems.push({
            id: Date.now() + idx + aIdx + Math.random(),
            barang_id: String(barangId),
            gudang_id: String(gudangId),
            zone: gdg ? gdg.zone : item.zone || "",
            qty: alloc.qty,
            plan_qty: alloc.qty,
            batch_no: "",
            expiry_date: "",
            shift_id: "",
            satuan: item.satuan || bObj?.satuan || "",
          });
        });
      } else {
        initialItems.push({
          id: Date.now() + idx + Math.random(),
          barang_id: String(barangId),
          gudang_id: "",
          zone: item.zone || "",
          qty: item.qty,
          plan_qty: item.qty,
          batch_no: "",
          expiry_date: "",
          shift_id: "",
          satuan: item.satuan || bObj?.satuan || "",
        });
      }
    });
    setProcessItems(initialItems);
  };

  const closeProcessModal = () => {
    setSelectedPlanning(null);
    setSelectedPlanningId(null);
    setProcessItems([]);
  };

  const addProcessItem = () => {
    setProcessItems((p) => [
      ...p,
      { id: Date.now(), barang_id: "", gudang_id: "", qty: 1, plan_qty: 0, batch_no: "", expiry_date: "", shift_id: "", satuan: "" },
    ]);
  };

  const updateProcessItem = (id: number, field: string, value: any) => {
    setProcessItems((p) => p.map((item) => (item.id === id ? { ...item, [field]: value } : item)));
  };

  const removeProcessItem = (id: number) => {
    setProcessItems((p) => p.filter((item) => item.id !== id));
  };

  const submitProcessInbound = async () => {
    if (!processItems.length) {
      return notifications.show({ title: "Error", message: "Tambahkan minimal 1 item untuk diproses", color: "red" });
    }

    for (const item of processItems) {
      if (!item.barang_id || !item.gudang_id || !item.qty) {
        return notifications.show({ title: "Error", message: "Semua item harus memiliki barang, gudang, dan qty", color: "red" });
      }
      if (!item.expiry_date) {
        return notifications.show({ title: "Error", message: "Expiry Date wajib diisi untuk setiap item", color: "red" });
      }
    }

    setProcessLoading(true);
    try {
      const mergedNotes = processItems
        .map((item) => {
          const bObj = barangs.find((b: any) => String(b.id) === String(item.barang_id));
          const name = bObj ? bObj.nama : `Barang #${item.barang_id}`;
          if (Number(item.qty) !== Number(item.plan_qty)) {
            return `${name}: Selisih (${item.note || "tidak ada keterangan"})`;
          }
          return `${name}: Sesuai`;
        })
        .join("; ");

      const tanggal_aktual = new Date().toISOString().split("T")[0];
      const payload = {
        shift_id: processTop.shift_id ? Number(processTop.shift_id) : undefined,
        note: mergedNotes || undefined,
        items: processItems.map((item) => ({
          barang_id: Number(item.barang_id),
          gudang_id: Number(item.gudang_id),
          qty: Number(item.qty),
          batch_no: item.batch_no || undefined,
          expiry_date: item.expiry_date,
          satuan: item.satuan || undefined,
          tanggal_aktual,
          jam_datang: processTop.jam_datang || undefined,
          jam_bongkar: processTop.jam_bongkar || undefined,
        })),
      };

      await api().post(`/inbound-planning/${selectedPlanningId}/process`, payload);

      notifications.show({ title: "Sukses", message: "Inbound planning berhasil diproses", color: "green" });
      closeProcessModal();
      loadLogs();
      loadDbPlannings();
    } catch (e: any) {
      notifications.show({ title: "Error", message: unwrap(e.response)?.message || "Gagal memproses inbound", color: "red" });
    } finally {
      setProcessLoading(false);
    }
  };

  const waitingPlannings = dbPlannings.filter((p: any) => p.status === "WAIT");

  /* ================================================================ */
  /*  Render                                                           */
  /* ================================================================ */

  return (
    <Box>
      {/* ---------------- Page header ---------------- */}
      <Box
        style={{
          background: "#fff",
          borderLeft: "4px solid #0ea5e9",
          padding: "14px 20px",
          marginBottom: 16,
          boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
        }}
      >
        <Group justify="space-between">
          <Title order={4} style={{ color: "#111827", fontWeight: 800, display: "flex", alignItems: "center", gap: 8 }}>
            <IconBuildingWarehouse size={20} style={{ color: "#0ea5e9" }} />
            BARANG MASUK (INBOUND)
          </Title>
        </Group>
      </Box>

      <Box p="md">
        <Grid gutter="md">
          {/* ============================================================ */}
          {/*  LEFT: Manual form OR Process-planning form                  */}
          {/* ============================================================ */}
          <Grid.Col span={{ base: 12, md: 4, lg: 3 }}>
            {selectedPlanning ? (
              <Paper withBorder p="md" radius="md" style={{ background: "#fff" }}>
                <Stack gap="xs">
                  <Group justify="space-between" style={{ borderBottom: "1px solid #f1f5f9", paddingBottom: 4 }}>
                    <Text fw={800} size="xs" c="green" style={{ display: "flex", alignItems: "center", gap: 4 }}>
                      <IconCheck size={14} /> PROSES INBOUND: {selectedPlanning.no_po}
                    </Text>
                    <ActionIcon size="xs" color="gray" variant="subtle" onClick={closeProcessModal}>
                      <IconX size={14} />
                    </ActionIcon>
                  </Group>

                  <TextInput
                    label="Jam Datang"
                    size="xs"
                    type="time"
                    value={processTop.jam_datang}
                    onChange={(e) => setProcessTop((p: any) => ({ ...p, jam_datang: e.target.value }))}
                  />
                  <TextInput
                    label="Jam Bongkar"
                    size="xs"
                    type="time"
                    value={processTop.jam_bongkar}
                    onChange={(e) => setProcessTop((p: any) => ({ ...p, jam_bongkar: e.target.value }))}
                  />
                  <Select
                    label="Shift"
                    size="xs"
                    data={shiftOpts}
                    value={processTop.shift_id}
                    onChange={(v) => setProcessTop((p: any) => ({ ...p, shift_id: v || "" }))}
                    placeholder="Pilih shift"
                    required
                  />

                  <Divider my={4} label="Items" labelPosition="center" />

                  {processItems.map((item: any, idx: number) => (
                    <ProcessItemCard
                      key={item.id}
                      item={item}
                      index={idx}
                      barangOpts={barangOpts}
                      barangs={barangs}
                      allGudangs={allGudangs}
                      stocks={stocks}
                      canRemove={processItems.length > 1}
                      onUpdate={updateProcessItem}
                      onRemove={removeProcessItem}
                    />
                  ))}

                  <Button variant="light" size="xs" onClick={addProcessItem} leftSection={<IconPlus size={14} />}>
                    Tambah Item
                  </Button>

                  <Button
                    fullWidth
                    size="xs"
                    color="green"
                    onClick={submitProcessInbound}
                    loading={processLoading}
                    leftSection={<IconCheck size={14} />}
                    style={{ fontWeight: 800, marginTop: 8 }}
                  >
                    Selesaikan Inbound
                  </Button>
                </Stack>
              </Paper>
            ) : canManual ? (
              <Paper withBorder p="md" radius="md" style={{ background: "#fff" }}>
                <Stack gap="xs">
                  <Text fw={800} size="sm" c="green" mb={4} style={{ borderBottom: "1px solid #f1f5f9", paddingBottom: 4 }}>
                    Eksekusi Inbound Manual
                  </Text>

                  <Autocomplete
                    label="No.PO/SJ"
                    size="xs"
                    ref={barcodeRef}
                    placeholder="Cari / isi No PO..."
                    data={poOpts}
                    value={form.no_po}
                    onChange={(v: string) => f("no_po", v)}
                  />

                  <Select
                    label="Nama Item"
                    size="xs"
                    searchable
                    data={barangOpts}
                    value={form.barang_id}
                    onChange={(v: any) => f("barang_id", v || "")}
                    placeholder="Pilih dari master produk"
                    clearable
                    onDropdownOpen={loadBarangs}
                  />
                  {!form.barang_id && (
                    <Autocomplete
                      label="Atau Input Manual"
                      size="xs"
                      placeholder="Ketik nama item manual..."
                      value={form.item_manual || ""}
                      onChange={(v: string) => f("item_manual", v)}
                      data={barangs.map((b: any) => b.nama).filter(Boolean)}
                      styles={{ input: { background: "#fdfbc8" } }}
                      limit={10}
                    />
                  )}

                  <Select
                    label="Gudang (Zone)"
                    size="xs"
                    data={ZONES}
                    value={selectedZone || null}
                    onChange={(v) => { setSelectedZone(v || ""); f("gudang_id", ""); }}
                    placeholder="Pilih zone gudang..."
                    clearable
                  />

                  {selectedZone && (
                    <Select
                      label="Sub-Lokasi Gudang / Rak"
                      size="xs"
                      searchable
                      data={rakOpts}
                      value={form.gudang_id}
                      onChange={(v: any) => f("gudang_id", v || "")}
                      placeholder="Pilih rak"
                      renderOption={renderColorfulOption}
                      onDropdownOpen={loadGudangsAndStocks}
                    />
                  )}

                  <Group gap="xs">
                    <NumberInput
                      label="Qty"
                      size="xs"
                      allowedDecimalSeparators={[".", ","]}
                      decimalScale={3}
                      step={0.1}
                      value={form.qty}
                      onChange={(v: any) => f("qty", v)}
                      style={{ flex: 1 }}
                    />
                    <Autocomplete
                      label="Satuan"
                      size="xs"
                      data={satuanOpts}
                      value={form.satuan}
                      onChange={(v: string) => f("satuan", v)}
                      w={80}
                      placeholder="Pcs/Ltr"
                    />
                  </Group>

                  <Autocomplete
                    label="Batch No"
                    size="xs"
                    data={batchOpts}
                    value={form.batch_no}
                    onChange={(v: string) => f("batch_no", v)}
                    placeholder="Isi / Pilih Batch"
                  />
                  <TextInput
                    label="Tgl Expired"
                    size="xs"
                    type="date"
                    value={form.expiry_date}
                    onChange={(e: any) => f("expiry_date", e.target.value)}
                  />
                  <Autocomplete
                    label="Supplier (Master Customer)"
                    size="xs"
                    data={customerOpts}
                    value={form.supplier}
                    onChange={(v: string) => f("supplier", v)}
                    placeholder="Pilih / ketik supplier"
                  />
                  <Autocomplete
                    label="Shift"
                    size="xs"
                    data={shifts.map((s: any) => s.name)}
                    value={shifts.find((s: any) => String(s.id) === form.shift_id)?.name || form.shift_id}
                    onChange={(v) => {
                      const match = shifts.find((s: any) => s.name.toLowerCase() === v.toLowerCase());
                      f("shift_id", match ? String(match.id) : v);
                    }}
                    placeholder="Pilih shift"
                  />

                  <Divider my={2} />
                  <Text size="xs" fw={700} c="dimmed">Waktu Kedatangan & Income</Text>

                  <TextInput
                    label="Tanggal Income"
                    size="xs"
                    type="date"
                    value={form.tanggal_income}
                    onChange={(e: any) => f("tanggal_income", e.target.value)}
                    mb="xs"
                  />
                  <Group gap="xs">
                    <TextInput
                      label="Jam Datang"
                      size="xs"
                      type="time"
                      value={form.jam_datang}
                      onChange={(e: any) => f("jam_datang", e.target.value)}
                      style={{ flex: 1 }}
                    />
                    <TextInput
                      label="Jam Bongkar"
                      size="xs"
                      type="time"
                      value={form.jam_bongkar}
                      onChange={(e: any) => f("jam_bongkar", e.target.value)}
                      style={{ flex: 1 }}
                    />
                  </Group>
                  <TextInput
                    label="Jam Selesai"
                    size="xs"
                    type="time"
                    value={form.jam_selesai}
                    onChange={(e: any) => f("jam_selesai", e.target.value)}
                  />

                  <Button
                    fullWidth
                    size="xs"
                    color="blue"
                    onClick={addDraft}
                    style={{ fontWeight: 800, marginTop: "8px" }}
                    leftSection={<IconPlus size={14} />}
                  >
                    Tambahkan Draft
                  </Button>
                </Stack>
              </Paper>
            ) : (
              <Paper withBorder p="md" radius="md">
                <Text size="sm" fw={700}>Eksekusi inbound melalui planning</Text>
                <Text size="xs" c="dimmed">Input manual hanya tersedia untuk Checker dan Supervisor.</Text>
              </Paper>
            )}
          </Grid.Col>

          {/* ============================================================ */}
          {/*  RIGHT: Waiting plannings / drafts / history                 */}
          {/* ============================================================ */}
          <Grid.Col span={{ base: 12, md: 8, lg: 9 }}>
            <Stack gap="md">
              {/* ---------------- Planning waiting to be processed ---------------- */}
              {waitingPlannings.length > 0 && (
                <Paper withBorder p="md" radius="md" style={{ background: "#fff" }}>
                  <Text fw={800} size="sm" c="green" mb="xs">
                    PROSES PLANNING INBOUND ({waitingPlannings.length})
                  </Text>
                  <Box style={{ overflowX: "auto" }}>
                    <Table withTableBorder withColumnBorders style={{ fontSize: 11, tableLayout: 'auto', width: '100%' }}>
                      <Table.Thead style={{ background: "#ebfbee", borderBottom: "2px solid #b2f2bb" }}>
                        <Table.Tr>
                          {["No PO", "Supplier", "Items", "ETA / Shift", "Lokasi", "Audit", "Aksi"].map((h) => (
                            <Table.Th key={h} style={{ color: "#2b8a3e", fontSize: 11, whiteSpace: "nowrap" }}>{h}</Table.Th>
                          ))}
                        </Table.Tr>
                      </Table.Thead>
                      <Table.Tbody>
                        {waitingPlannings.map((d: any) => {
                          const firstItem = d.items?.[0]; const zone = firstItem?.zone || d.zone || "-"; const rackNames = (d.items || []).flatMap((it: any) => (it.rack_allocations || it.rackAllocations || []).map((a: any) => a.gudangName || a.gudang_name || `#${a.gudang_id || a.gudangId}`)).join(", ") || "-";
                          return (
                          <Table.Tr key={d.id}>
                            <Table.Td fw={700}>{d.no_po}</Table.Td>
                            <Table.Td>{d.supplier || "-"}</Table.Td>
                            <Table.Td><PlanningItemsList plan={d} barangs={barangs} /></Table.Td>
                            <Table.Td style={{ fontSize: 10 }}><div>{formatDateTime(d.estimasi_datang)}</div><div style={{ color: "#64748b" }}>{d.shift?.name || "-"}</div></Table.Td>
                            <Table.Td style={{ fontSize: 10 }}><Badge size="xs" color="teal">{zone}</Badge> <Badge size="xs" color="blue">{rackNames}</Badge></Table.Td>
                            <Table.Td style={{ fontSize: 10 }}><div>Dibuat {d.created_by_username || "sistem"}</div><div style={{ color: "#64748b" }}>{formatDateTime(d.created_at)}</div></Table.Td>
                            <Table.Td>
                              <Group gap={4}>
                                <Tooltip label="Proses Inbound">
                                  <ActionIcon size="sm" color="green" variant="light" onClick={() => openProcessModal(d)}>
                                    <IconCheck size={13} />
                                  </ActionIcon>
                                </Tooltip>
                                <Tooltip label="Hapus">
                                  <ActionIcon size="sm" color="red" variant="light" onClick={() => deletePlanning(d)}>
                                    <IconTrash size={13} />
                                  </ActionIcon>
                                </Tooltip>
                              </Group>
                            </Table.Td>
                          </Table.Tr>
                          );})}
                      </Table.Tbody>
                    </Table>
                  </Box>
                </Paper>
              )}

              {/* ---------------- Local drafts queue ---------------- */}
              {drafts.length > 0 && (
                <Paper withBorder p="md" radius="md" style={{ background: "#fff" }}>
                  <Group justify="space-between" mb="xs">
                    <Text fw={800} size="sm" c="blue">
                      DRAFT ANTRIAN INBOUND ({drafts.length})
                    </Text>
                  </Group>
                  <Box style={{ overflowX: "auto" }}>
                    <Table withTableBorder withColumnBorders style={{ fontSize: 11, tableLayout: 'auto', width: '100%' }}>
                      <Table.Thead style={{ background: "#e7f5ff", borderBottom: "2px solid #a5d8ff" }}>
                        <Table.Tr>
                          {["NoPO", "Item", "Zone", "Rak", "Qty", "Tgl", "Batch", "Exp", "Supp", "Shift", "Aksi"].map((h: string) => (
                            <Table.Th key={h} style={{ color: "#1864ab", fontSize: 11 }}>{h}</Table.Th>
                          ))}
                        </Table.Tr>
                      </Table.Thead>
                      <Table.Tbody>
                        {drafts.map((d: any, i: number) => (
                          <Table.Tr key={d.id || i}>
                            <Table.Td>{d.no_po}</Table.Td>
                            <Table.Td fw={700}>{d._brg}</Table.Td>
                            <Table.Td><Badge size="xs" color="teal">{d._zone}</Badge></Table.Td>
                            <Table.Td><Badge size="xs" color="blue">{d._gdg}</Badge></Table.Td>
                            <Table.Td ta="right">{d.qty}</Table.Td>
                            <Table.Td>{d.tanggal_income}</Table.Td>
                            <Table.Td>{d.batch_no}</Table.Td>
                            <Table.Td>{d.expiry_date || "-"}</Table.Td>
                            <Table.Td>{d.supplier || "-"}</Table.Td>
                            <Table.Td>{shifts.find((s: any) => String(s.id) === String(d.shift_id))?.name || "-"}</Table.Td>
                            <Table.Td>
                              <Group gap={4} wrap="nowrap">
                                <Tooltip label="Proses">
                                  <ActionIcon size="sm" color="green" variant="light" onClick={() => postAllFromDraft(i)}>
                                    <IconCheck size={13} />
                                  </ActionIcon>
                                </Tooltip>
                                <Tooltip label="Hapus">
                                  <ActionIcon size="sm" color="red" variant="light" onClick={() => setDrafts((p: any[]) => p.filter((_, j: number) => j !== i))}>
                                    <IconTrash size={13} />
                                  </ActionIcon>
                                </Tooltip>
                              </Group>
                            </Table.Td>
                          </Table.Tr>
                        ))}
                      </Table.Tbody>
                    </Table>
                  </Box>
                </Paper>
              )}

              {drafts.length > 0 && (
                <Paper withBorder p="md" radius="md" style={{ background: "#fff" }}>
                  <Group justify="center">
                    <Button size="sm" color="green" onClick={postAll} style={{ fontWeight: 850 }} leftSection={<IconSend size={14} />}>
                      PUBLISH — Posting Inbound ({drafts.length} inbound)
                    </Button>
                  </Group>
                </Paper>
              )}

              {/* ---------------- History ---------------- */}
              <Paper withBorder p="md" radius="md" style={{ background: "#fff" }}>
                <Group justify="space-between" mb="sm">
                  <Text fw={850} size="sm">RIWAYAT PENERIMAAN RAW MATERIALS</Text>
                  <Group gap="xs">
                    <TextInput
                      placeholder="Cari logs..."
                      size="xs"
                      value={search}
                      onChange={(e: any) => setSearch(e.target.value)}
                      style={{ width: 180 }}
                    />
                    <Select
                      size="xs"
                      w={110}
                      data={["ALL", "WET", "DRY"]}
                      value={type.toUpperCase()}
                      onChange={(v) => { if (v) setType(v.toLowerCase()); }}
                    />
                  </Group>
                </Group>

                <Box style={{ overflowX: "auto" }}>
                    <Table withTableBorder withColumnBorders style={{ fontSize: 11, tableLayout: 'auto', width: '100%' }}>
                    <Table.Thead style={{ background: "#ebfbee", borderBottom: "2px solid #b2f2bb" }}>
                      <Table.Tr>
                        <Table.Th style={{ color: "#2b8a3e", cursor: "pointer", whiteSpace: "nowrap" }} onClick={() => handleSort("no_po")}>NoPO{sortIcon("no_po")}</Table.Th>
                        <Table.Th style={{ color: "#2b8a3e", cursor: "pointer" }} onClick={() => handleSort("barang.nama")}>Item{sortIcon("barang.nama")}</Table.Th>
                        <Table.Th style={{ color: "#2b8a3e", whiteSpace: "nowrap" }}>Lokasi</Table.Th>
                        <Table.Th style={{ color: "#2b8a3e", cursor: "pointer", whiteSpace: "nowrap" }} onClick={() => handleSort("qty")}>Qty{sortIcon("qty")}</Table.Th>
                        <Table.Th style={{ color: "#2b8a3e", whiteSpace: "nowrap" }}>Tgl / Expired</Table.Th>
                        <Table.Th style={{ color: "#2b8a3e", whiteSpace: "nowrap" }}>ETA / Shift</Table.Th>
                        <Table.Th style={{ color: "#2b8a3e" }}>Audit Planning / ACC</Table.Th>
                      </Table.Tr>
                    </Table.Thead>
                    <Table.Tbody>
                      {filtered.slice(0, 100).map((r: any, index: number) => (
                        <Table.Tr key={r.id} style={{ backgroundColor: index % 2 === 0 ? "#fff" : "#f8f9fa" }}>
                          <Table.Td fw={600}>{r.no_po || "-"}</Table.Td>
                          <Table.Td fw={700}>{r.barang?.nama}</Table.Td>
                          <Table.Td><Badge size="xs" color="teal">{r.gudang?.zone || "-"}</Badge> <Badge size="xs" color="blue">{r.gudang?.name || "-"}</Badge></Table.Td>
                          <Table.Td ta="right" fw={700}>{r.qty} {r.satuan}</Table.Td>
                          <Table.Td style={{ fontSize: 10 }}><div>{r.tanggal_income || new Date(r.created_at).toLocaleDateString()}</div><div style={{ color: "#64748b" }}>Exp: {r.expiry_date ? new Date(r.expiry_date).toISOString().split("T")[0] : "-"}</div></Table.Td>
                          <Table.Td style={{ fontSize: 10 }}><div>{r.tanggal_income || "-"}</div><div style={{ color: "#64748b" }}>{r.shift?.name || "-"}</div></Table.Td>
                          <Table.Td style={{ minWidth: 220 }}>
                            <div><b>Dibuat:</b> {r.planned_by_username || "Manual / tanpa planning"}</div>
                            <div style={{ color: "#64748b" }}>{fmtDateTime(r.planned_at)}</div>
                            <div><b>Di-ACC:</b> {r.executed_by_username || r.user?.username || "sistem"}</div>
                            <div style={{ color: "#64748b" }}>{fmtDateTime(r.executed_at || r.created_at)}</div>
                          </Table.Td>
                        </Table.Tr>
                      ))}
                      {filtered.length === 0 && (
                        <Table.Tr>
                          <Table.Td colSpan={10} style={{ padding: 0, border: "none" }}>
                            <EmptyState
                              icon={<IconBuildingWarehouse size={48} />}
                              title="Tidak ada riwayat inbound"
                              description="Data penerimaan barang masuk akan tampil di sini"
                            />
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

export default function InboundPage() {
  return (
    <Suspense fallback={<Box p="xl" style={{ display: "flex", justifyContent: "center" }}><Loader size="lg" /></Box>}>
      <InboundContent />
    </Suspense>
  );
}
