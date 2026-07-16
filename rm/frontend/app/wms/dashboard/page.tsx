// @ts-nocheck
"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  Box,
  Group,
  Paper,
  Stack,
  Text,
  Title,
  Badge,
  Button,
  Loader,
  TextInput,
} from "@mantine/core";
import {
  IconPackage,
  IconTrendingUp,
  IconTrendingDown,
  IconRefresh,
  IconCalendarStats,
  IconBuildingWarehouse,
  IconAlertTriangle,
  IconChartBar,
  IconChartLine,
  IconChartPie,
  IconTruckDelivery,
  IconMeat,
  IconDownload,
  IconDatabase,
  IconArrowUpRight,
  IconArrowDownRight,
  IconSearch,
  IconFilter,
  IconX,
} from "@tabler/icons-react";
import { api, unwrap, fmt } from "../lib/api";

/* ─────────────────────────── constants ─────────────────────────── */
const TABS = [
  {
    key: "occupancy",
    label: "OCCUPANCY",
    icon: IconChartPie,
    accent: "#228be6",
    bg: "#e7f5ff",
  },
  {
    key: "ofti",
    label: "OFTI",
    icon: IconTruckDelivery,
    accent: "#2b8a3e",
    bg: "#d3f9d8",
  },
  {
    key: "serapan",
    label: "Serapan Ayam",
    icon: IconMeat,
    accent: "#be4bdb",
    bg: "#f3d9fa",
  },
  {
    key: "report",
    label: "Report",
    icon: IconChartBar,
    accent: "#e67700",
    bg: "#fff3bf",
  },
];

const cardShadow = "0 2px 12px rgba(0,0,0,0.07)";
const sectionShadow = "0 2px 8px rgba(0,0,0,0.05)";

/* ─────────────────────────── data helpers ─────────────────────────── */
const asArray = (value: any) => (Array.isArray(value) ? value : []);
const toNumber = (value: string) => {
  const parsed = typeof value === "string" ? Number(value.replace(/,/g, "")) : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};
const toNullableNumber = (value: string | null | undefined) => value === null || value === undefined || value === "" ? null : toNumber(value);
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const percentage = (part: number, total: number) => total > 0 ? clamp(Math.round((part / total) * 100), 0, 100) : 0;

const normalizeStats = (raw: { totalSku: any; skuCount: any; totalStock: any; inboundHariIni: any; outboundHariIni: any; expiredCount: any; nearExpiredCount: any; wasteCount: any; }) => ({
  ...(raw || {}),
  totalSku: toNullableNumber(raw?.totalSku ?? raw?.skuCount),
  totalStock: toNullableNumber(raw?.totalStock),
  inboundHariIni: toNullableNumber(raw?.inboundHariIni),
  outboundHariIni: toNullableNumber(raw?.outboundHariIni),
  expiredCount: toNullableNumber(raw?.expiredCount),
  nearExpiredCount: toNullableNumber(raw?.nearExpiredCount),
  wasteCount: toNullableNumber(raw?.wasteCount),
});

const normalizeOccupancy = (raw: { gauges: any; dailySeries: any; items: any; weeks: any; series: any; } | null) => ({
  ...(raw || {}),
  gauges: asArray(raw?.gauges).map((g) => {
    const occupiedRacks = toNumber(g.occupiedRacks);
    const totalRacks = toNumber(g.totalRacks);
    const pct = totalRacks > 0 ? percentage(occupiedRacks, totalRacks) : clamp(toNumber(g.pct), 0, 100);
    return { ...g, occupiedRacks, totalRacks, pct };
  }),
  dailySeries: asArray(raw?.dailySeries).map((d) => ({ ...d, value: toNumber(d.value) })),
  items: asArray(raw?.items).map((item) => ({ ...item, qty: toNumber(item.qty) })),
  weeks: asArray(raw?.weeks),
  series: asArray(raw?.series).map((s) => ({ ...s, data: asArray(s.data).map(toNumber) })),
});

const normalizeOfti = (raw: { weekly: any; } | null) => ({
  ...(raw || {}),
  weekly: asArray(raw?.weekly).map((d) => ({
    ...d,
    ontime: toNumber(d.ontime),
    late: toNumber(d.late),
    otif: toNumber(d.otif ?? d.ontime),
    notOtif: toNumber(d.notOtif ?? d.late),
  })),
});

const normalizeSerapan = (raw: { data: any; } | null) => ({
  ...(raw || {}),
  data: asArray(raw?.data).map((d) => ({ ...d, planning: toNumber(d.planning), serapan: toNumber(d.serapan) })),
});

const normalizeReport = (raw: any) => asArray(raw).map((d) => ({
  ...d,
  inbound: toNumber(d.inbound),
  outbound: toNumber(d.outbound),
}));
const csvCell = (value: any) => `"${String(value ?? "").replace(/"/g, '""')}"`;

/* ─────────────────────────── responsive helpers ─────────────────────────── */

/**
 * useContainerWidth — mengukur lebar container secara real-time pakai ResizeObserver.
 * Dipakai oleh semua chart supaya lebar SVG selalu mengikuti card, bukan angka fixed.
 */
function useContainerWidth(fallback = 760) {
  const ref = useRef(null);
  const [width, setWidth] = useState(fallback);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => {
      const w = el.getBoundingClientRect().width;
      if (w > 0) setWidth(w);
    };
    measure();
    const ro = new ResizeObserver(() => measure());
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return [ref, width];
}

/**
 * useBarAnimation — men-trigger transisi CSS dari 0 -> tinggi asli setiap kali data berubah.
 */
function useBarAnimation(dataSignature: unknown) {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    setReady(false);
    const raf = requestAnimationFrame(() => {
      const raf2 = requestAnimationFrame(() => setReady(true));
      return () => cancelAnimationFrame(raf2);
    });
    return () => cancelAnimationFrame(raf);
  }, [dataSignature]);
  return ready;
}

/** Pilih rotasi label berdasarkan spasi yang tersedia per label (px). */
function labelRotationFor(spacePerLabel: number) {
  if (spacePerLabel > 40) return 0;
  if (spacePerLabel > 22) return -30;
  return -45;
}

/** Legend seragam, diletakkan DI BAWAH chart (bukan di kanan) supaya area chart lebih lebar. */
const ChartLegend = ({ series }) => {
  if (!series?.length) return null;
  return (
    <Group gap={14} mt={8} wrap="wrap" justify="center">
      {series.map((s: { label: boolean | React.ReactElement<unknown, string | React.JSXElementConstructor<any>> | Iterable<React.ReactNode> | Promise<string | number | bigint | boolean | React.ReactPortal | React.ReactElement<unknown, string | React.JSXElementConstructor<any>> | Iterable<React.ReactNode> | null | undefined> | React.Key | null | undefined; color: any; }) => (
        <Group key={s.label} gap={5} wrap="nowrap">
          <Box
            style={{
              width: 10,
              height: 10,
              borderRadius: 3,
              background: s.color,
              flexShrink: 0,
            }}
          />
          <Text size="10px" c="dimmed" fw={600}>
            {s.label}
          </Text>
        </Group>
      ))}
    </Group>
  );
};

/** Tooltip mengambang mengikuti posisi mouse relatif ke container chart. */
const ChartTooltip = ({ tooltip }) => {
  if (!tooltip) return null;
  return (
    <div
      style={{
        position: "absolute",
        left: tooltip.x,
        top: tooltip.y,
        transform: "translate(-50%, calc(-100% - 10px))",
        background: "#1a1a1a",
        color: "#fff",
        padding: "6px 10px",
        borderRadius: 8,
        fontSize: 11,
        pointerEvents: "none",
        whiteSpace: "nowrap",
        zIndex: 20,
        boxShadow: "0 6px 16px rgba(0,0,0,0.3)",
      }}
    >
      {tooltip.title && (
        <div
          style={{
            fontSize: 9,
            opacity: 0.65,
            marginBottom: 3,
            fontWeight: 700,
          }}
        >
          {tooltip.title}
        </div>
      )}
      {tooltip.lines.map((l: { color: any; label: string | number | bigint | boolean | React.ReactElement<unknown, string | React.JSXElementConstructor<any>> | Iterable<React.ReactNode> | React.ReactPortal | Promise<string | number | bigint | boolean | React.ReactPortal | React.ReactElement<unknown, string | React.JSXElementConstructor<any>> | Iterable<React.ReactNode> | null | undefined> | null | undefined; value: string | number | bigint | boolean | React.ReactElement<unknown, string | React.JSXElementConstructor<any>> | Iterable<React.ReactNode> | React.ReactPortal | Promise<string | number | bigint | boolean | React.ReactPortal | React.ReactElement<unknown, string | React.JSXElementConstructor<any>> | Iterable<React.ReactNode> | null | undefined> | null | undefined; }, i: React.Key | null | undefined) => (
        <div
          key={i}
          style={{
            display: "flex",
            gap: 6,
            alignItems: "center",
            fontWeight: 600,
          }}
        >
          {l.color && (
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: 2,
                background: l.color,
                display: "inline-block",
                flexShrink: 0,
              }}
            />
          )}
          <span>
            {l.label}: <strong>{l.value}</strong>
          </span>
        </div>
      ))}
    </div>
  );
};

/* ─────────────────────────── KPI card ─────────────────────────── */
const KpiCard = ({ label, value, sub, icon: Icon, accent, bg, trend }) => (
  <Paper
    withBorder
    p="xs"
    style={{
      borderRadius: 10,
      background: "#fff",
      boxShadow: sectionShadow,
      borderLeft: `3px solid ${accent}`,
      flex: "1 1 0",
      minWidth: 130,
    }}
  >
    <Group gap={6} wrap="nowrap" align="flex-start">
      <Box
        style={{ background: bg, borderRadius: 7, padding: 6, flexShrink: 0 }}
      >
        <Icon size={16} color={accent} />
      </Box>
      <Box style={{ minWidth: 0 }}>
        <Text
          size="9px"
          c="dimmed"
          fw={600}
          tt="uppercase"
          style={{
            letterSpacing: "0.05em",
            lineHeight: 1.2,
            whiteSpace: "nowrap",
          }}
        >
          {label}
        </Text>
        <Text size="lg" fw={900} style={{ color: "#1a1a2e", lineHeight: 1.1 }}>
          {value ?? "—"}
        </Text>
        {sub && (
          <Text size="9px" c="dimmed" style={{ lineHeight: 1.2 }}>
            {sub}
          </Text>
        )}
      </Box>
      {trend !== undefined && (
        <Box style={{ marginLeft: "auto", flexShrink: 0 }}>
          {trend >= 0 ? (
            <IconArrowUpRight size={14} color="#40c057" />
          ) : (
            <IconArrowDownRight size={14} color="#e03131" />
          )}
        </Box>
      )}
    </Group>
  </Paper>
);

/* ─────────────────────────── Occupancy Gauge ─────────────────────────── */
const OccupancyGauge = ({ pct, label, subLabel, color, onClick, selected }) => {
  const safePct = clamp(toNumber(pct), 0, 100);
  const size = 90;
  const cx = size / 2;
  const cy = size / 2;
  const r = 36;
  const waveHeight = 4;
  const fillY = cy + r - (safePct / 100) * (r * 2);

  const wavePath = () => {
    const startX = cx - r;
    const endX = cx + r;
    const width = endX - startX;
    const segments = 4;
    const segW = width / segments;
    let d = `M ${startX} ${fillY}`;
    for (let i = 0; i < segments; i++) {
      const x1 = startX + i * segW;
      const x2 = x1 + segW / 2;
      const x3 = x1 + segW;
      const dir = i % 2 === 0 ? 1 : -1;
      d += ` Q ${x2} ${fillY + dir * waveHeight}, ${x3} ${fillY}`;
    }
    d += ` L ${endX} ${cy + r} L ${startX} ${cy + r} Z`;
    return d;
  };

  const statusColor = "#000000";
  const gaugeBlue = "#228be6";
  const gaugeFill = "#74c0fc";
  const clipId = `cc-${label.replace(/\s+/g, "-")}`;
  const gradId = `lg-${label.replace(/\s+/g, "-")}`;

  return (
    <Paper
      withBorder
      p="xs"
      style={{
        borderRadius: 10,
        background: selected ? "#f0f7ff" : "#fff",
        boxShadow: selected
          ? `0 0 0 2px ${color}, ${sectionShadow}`
          : sectionShadow,
        textAlign: "center",
        cursor: "pointer",
        transition: "all 0.2s ease",
        borderColor: selected ? color : undefined,
      }}
      onClick={onClick}
    >
      <svg
        width={size}
        height={size}
        style={{ margin: "0 auto", display: "block" }}
      >
        <defs>
          <clipPath id={clipId}>
            <circle cx={cx} cy={cy} r={r} />
          </clipPath>
          <linearGradient id={gradId} x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor={gaugeBlue} stopOpacity={0.9} />
            <stop offset="100%" stopColor={gaugeBlue} stopOpacity={0.45} />
          </linearGradient>
        </defs>
        <circle
          cx={cx}
          cy={cy}
          r={r}
          fill="#f1f3f5"
          stroke={gaugeBlue}
          strokeWidth={2}
        />
        <g clipPath={`url(#${clipId})`}>
          <rect
            x={cx - r}
            y={isNaN(fillY) ? cy + r : fillY}
            width={r * 2}
            height={isNaN(cy + r - fillY) ? 0 : Math.max(cy + r - fillY, 0)}
            fill={`url(#${gradId})`}
          />
          <path d={wavePath()} fill={color} opacity={0.25} />
        </g>
        <circle
          cx={cx}
          cy={cy}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={2}
          opacity={0.5}
        />
        <text
          x={cx}
          y={cy + 1}
          textAnchor="middle"
          fontSize={16}
          fontWeight={800}
          fill={statusColor}
        >
          {safePct}%
        </text>
        <text
          x={cx}
          y={cy + 13}
          textAnchor="middle"
          fontSize={7.5}
          fill="#868e96"
          fontWeight={600}
        >
          {label}
        </text>
      </svg>
      <Text size="8px" c="dimmed" truncate mt={2} px={2}>
        {subLabel}
      </Text>
    </Paper>
  );
};

/* ─────────────────────────── Section Header ─────────────────────────── */
const SectionHeader = ({ icon: Icon, accent, bg, title, sub, right }) => (
  <Group justify="space-between" mb={8} wrap="nowrap">
    <Group gap={8} wrap="nowrap">
      <Box
        style={{ background: bg, borderRadius: 7, padding: 5, flexShrink: 0 }}
      >
        <Icon size={16} color={accent} />
      </Box>
      <Box>
        <Text size="sm" fw={800} style={{ color: "#1a1a2e", lineHeight: 1.2 }}>
          {title}
        </Text>
        {sub && (
          <Text size="9px" c="dimmed" style={{ lineHeight: 1.2 }}>
            {sub}
          </Text>
        )}
      </Box>
    </Group>
    {right}
  </Group>
);

/* ─────────────────────────── Table Header ─────────────────────────── */
const TH = ({ children, right = false, style = {} }) => (
  <Box
    component="th"
    style={{
      color: "#e9ecef",
      fontSize: 10,
      fontWeight: 700,
      padding: "7px 10px",
      textAlign: right ? "right" : "left",
      letterSpacing: "0.04em",
      textTransform: "uppercase",
      whiteSpace: "nowrap",
      ...style,
    }}
  >
    {children}
  </Box>
);

/* ─────────────────────────── Table Cell ─────────────────────────── */
const TD = ({ children, right = false, style = {} }) => (
  <Box
    component="td"
    style={{
      padding: "6px 10px",
      fontSize: 11,
      textAlign: right ? "right" : "left",
      verticalAlign: "middle",
      ...style,
    }}
  >
    {children}
  </Box>
);

/* ─────────────────────────── Bar Charts ─────────────────────────── */

/**
 * OccupancyYearChart — chart occupancy tahunan (banyak week × banyak zone).
 * Full responsive: lebar mengikuti container (ResizeObserver), bar width adaptif,
 * legend di bawah, tooltip hover, animasi masuk, dan rotasi label otomatis.
 */
const OccupancyYearChart = ({ series, labels }) => {
  const [containerRef, containerWidth] = useContainerWidth(800);
  const [tooltip, setTooltip] = useState(null);
  const dataSignature = JSON.stringify([
    series?.map((s: { data: any; }) => s.data),
    labels?.length,
  ]);
  const ready = useBarAnimation(dataSignature);

  if (!series?.length || !labels?.length)
    return (
      <Text size="xs" c="dimmed" ta="center" py="md">
        Tidak ada data.
      </Text>
    );

  const nGroups = labels.length;
  const nSeries = series.length;
  const height = 300;
  const pad = { top: 32, right: 20, bottom: 60, left: 60 };

  // Lebar minimum supaya bar tidak terlalu tipis, dipakai hanya kalau container tidak cukup lebar.
  const minBarW = 8;
  const maxBarW = 26;
  const gap = 3;
  const groupGap = 10;
  const minGroupW = nSeries * minBarW + (nSeries - 1) * gap + groupGap;
  const minChartW = nGroups * minGroupW;

  const chartW = Math.max(containerWidth - pad.left - pad.right, minChartW);
  const totalW = chartW + pad.left + pad.right;
  const chartH = height - pad.top - pad.bottom;
  const maxVal = Math.max(...series.flatMap((s: { data: any; }) => s.data), 1);
  const gridLines = [0, 0.25, 0.5, 0.75, 1];

  const groupW = chartW / nGroups;
  const barW = Math.min(
    maxBarW,
    Math.max(minBarW, (groupW - groupGap - (nSeries - 1) * gap) / nSeries),
  );

  const rotation = labelRotationFor(groupW);

  return (
    <Box ref={containerRef} style={{ position: "relative", width: "100%" }}>
      <svg
        width={totalW}
        height={height}
        viewBox={`0 0 ${totalW} ${height}`}
        style={{ display: "block", overflow: "visible" }}
      >
        <rect
          x={pad.left}
          y={pad.top}
          width={chartW}
          height={chartH}
          fill="#fafbfc"
          rx={4}
        />

        {gridLines.map((p, i) => {
          const y = pad.top + chartH * p;
          const val = Math.round(maxVal * (1 - p));
          return (
            <g key={i}>
              <line
                x1={pad.left}
                y1={y}
                x2={pad.left + chartW}
                y2={y}
                stroke={p === 0 || p === 1 ? "#ced4da" : "#e9ecef"}
                strokeDasharray={p === 0 || p === 1 ? "none" : "4,4"}
                strokeWidth={p === 0 || p === 1 ? 1.5 : 1}
              />
              <text
                x={pad.left - 8}
                y={y + 4}
                textAnchor="end"
                fontSize={10}
                fill="#868e96"
                fontWeight={600}
              >
                {val >= 1000 ? `${(val / 1000).toFixed(0)}k` : val}
              </text>
            </g>
          );
        })}

        {labels.map((l: { key: any; label: string | number | bigint | boolean | React.ReactElement<unknown, string | React.JSXElementConstructor<any>> | Iterable<React.ReactNode> | React.ReactPortal | Promise<string | number | bigint | boolean | React.ReactPortal | React.ReactElement<unknown, string | React.JSXElementConstructor<any>> | Iterable<React.ReactNode> | null | undefined> | null | undefined; }, wIdx: number) => {
          const gx = pad.left + wIdx * groupW;
          const gCenter = gx + groupW / 2;
          return (
            <g key={l.key ?? wIdx}>
              {series.map((s: { data: { [x: string]: number; }; label: React.Key | null | undefined; color: string | undefined; }, sIdx: number) => {
                const val = s.data[wIdx] || 0;
                const fullH = isNaN((val / maxVal) * chartH)
                  ? 0
                  : Math.max((val / maxVal) * chartH, val > 0 ? 2 : 0);
                const h = ready ? fullH : 0;
                const bx =
                  gCenter -
                  (nSeries * barW + (nSeries - 1) * gap) / 2 +
                  sIdx * (barW + gap);
                const by = pad.top + chartH - h;
                return (
                  <rect
                    key={s.label}
                    x={bx}
                    y={by}
                    width={barW}
                    height={h}
                    rx={3}
                    fill={s.color}
                    opacity={0.85}
                    style={{
                      transition:
                        "height 550ms cubic-bezier(.4,0,.2,1), y 550ms cubic-bezier(.4,0,.2,1), opacity 150ms ease",
                      cursor: "pointer",
                    }}
                    onMouseEnter={(e) => {
                      const rect = containerRef.current.getBoundingClientRect();
                      setTooltip({
                        x: e.clientX - rect.left,
                        y: e.clientY - rect.top,
                        title: l.label,
                        lines: [
                          {
                            label: s.label,
                            value: val.toLocaleString(),
                            color: s.color,
                          },
                        ],
                      });
                    }}
                    onMouseMove={(e) => {
                      const rect = containerRef.current.getBoundingClientRect();
                      setTooltip((t) =>
                        t
                          ? {
                            ...t,
                            x: e.clientX - rect.left,
                            y: e.clientY - rect.top,
                          }
                          : t,
                      );
                    }}
                    onMouseLeave={() => setTooltip(null)}
                  />
                );
              })}
              <text
                x={gCenter}
                y={pad.top + chartH + (rotation ? 10 : 16)}
                textAnchor={rotation ? "end" : "middle"}
                fontSize={9}
                fill="#495057"
                fontWeight={600}
                transform={
                  rotation
                    ? `rotate(${rotation}, ${gCenter}, ${pad.top + chartH + 10})`
                    : undefined
                }
              >
                {l.label}
              </text>
            </g>
          );
        })}
      </svg>
      <ChartLegend series={series} />
      <ChartTooltip tooltip={tooltip} />
    </Box>
  );
};

const SimpleBarChart = ({ series, labels }) => {
  const [containerRef, containerWidth] = useContainerWidth(760);
  const [tooltip, setTooltip] = useState(null);
  const dataSignature = JSON.stringify([
    series?.map((s: { data: any; }) => s.data),
    labels?.length,
  ]);
  const ready = useBarAnimation(dataSignature);

  if (!series?.length || !labels?.length)
    return (
      <Text size="xs" c="dimmed" ta="center" py="md">
        Tidak ada data.
      </Text>
    );

  const nGroups = labels.length;
  const nSeries = series.length;
  const height = 250;
  const pad = { top: 28, right: 20, bottom: 50, left: 55 };

  const minBarW = 8;
  const maxBarW = 28;
  const gap = 3;
  const groupGap = 12;
  const minGroupW = nSeries * minBarW + (nSeries - 1) * gap + groupGap;
  const minChartW = nGroups * minGroupW;

  const chartW = Math.max(containerWidth - pad.left - pad.right, minChartW);
  const totalW = chartW + pad.left + pad.right;
  const chartH = height - pad.top - pad.bottom;
  const maxVal = Math.max(...series.flatMap((s: { data: any; }) => s.data), 1);

  const groupW = chartW / nGroups;
  const barW = Math.min(
    maxBarW,
    Math.max(minBarW, (groupW - groupGap - (nSeries - 1) * gap) / nSeries),
  );
  const rotation = labelRotationFor(groupW);

  return (
    <Box ref={containerRef} style={{ position: "relative", width: "100%" }}>
      <svg
        width={totalW}
        height={height}
        viewBox={`0 0 ${totalW} ${height}`}
        style={{ display: "block", overflow: "visible" }}
      >
        <rect
          x={pad.left}
          y={pad.top}
          width={chartW}
          height={chartH}
          fill="#fafbfc"
          rx={4}
        />
        {[0, 0.25, 0.5, 0.75, 1].map((p, i) => {
          const y = pad.top + chartH * p;
          const val = Math.round(maxVal * (1 - p));
          return (
            <g key={i}>
              <line
                x1={pad.left}
                y1={y}
                x2={pad.left + chartW}
                y2={y}
                stroke={p === 0 || p === 1 ? "#ced4da" : "#e9ecef"}
                strokeDasharray={p === 0 || p === 1 ? "none" : "4,4"}
              />
              <text
                x={pad.left - 6}
                y={y + 4}
                textAnchor="end"
                fontSize={9}
                fill="#868e96"
              >
                {val >= 1000 ? `${(val / 1000).toFixed(0)}k` : val}
              </text>
            </g>
          );
        })}
        {labels.map((l: { key: any; label: string | number | bigint | boolean | React.ReactElement<unknown, string | React.JSXElementConstructor<any>> | Iterable<React.ReactNode> | React.ReactPortal | Promise<string | number | bigint | boolean | React.ReactPortal | React.ReactElement<unknown, string | React.JSXElementConstructor<any>> | Iterable<React.ReactNode> | null | undefined> | null | undefined; }, wIdx: number) => {
          const gx = pad.left + wIdx * groupW;
          const gCenter = gx + groupW / 2;
          return (
            <g key={l.key ?? wIdx}>
              {series.map((s: { data: { [x: string]: number; }; label: React.Key | null | undefined; color: string | undefined; }, sIdx: number) => {
                const val = s.data[wIdx] || 0;
                const fullH = isNaN((val / maxVal) * chartH)
                  ? 0
                  : Math.max((val / maxVal) * chartH, val > 0 ? 2 : 0);
                const h = ready ? fullH : 0;
                const bx =
                  gCenter -
                  (nSeries * barW + (nSeries - 1) * gap) / 2 +
                  sIdx * (barW + gap);
                const by = pad.top + chartH - h;
                return (
                  <rect
                    key={s.label}
                    x={bx}
                    y={by}
                    width={barW}
                    height={h}
                    rx={3}
                    fill={s.color}
                    opacity={0.88}
                    style={{
                      transition:
                        "height 550ms cubic-bezier(.4,0,.2,1), y 550ms cubic-bezier(.4,0,.2,1)",
                      cursor: "pointer",
                    }}
                    onMouseEnter={(e) => {
                      const rect = containerRef.current.getBoundingClientRect();
                      setTooltip({
                        x: e.clientX - rect.left,
                        y: e.clientY - rect.top,
                        title: l.label,
                        lines: [
                          {
                            label: s.label,
                            value: val.toLocaleString(),
                            color: s.color,
                          },
                        ],
                      });
                    }}
                    onMouseMove={(e) => {
                      const rect = containerRef.current.getBoundingClientRect();
                      setTooltip((t) =>
                        t
                          ? {
                            ...t,
                            x: e.clientX - rect.left,
                            y: e.clientY - rect.top,
                          }
                          : t,
                      );
                    }}
                    onMouseLeave={() => setTooltip(null)}
                  />
                );
              })}
              <text
                x={rotation ? gCenter : gCenter}
                y={pad.top + chartH + (rotation ? 10 : 16)}
                textAnchor={rotation ? "end" : "middle"}
                fontSize={10}
                fill="#495057"
                fontWeight={700}
                transform={
                  rotation
                    ? `rotate(${rotation}, ${gCenter}, ${pad.top + chartH + 10})`
                    : undefined
                }
              >
                {l.label}
              </text>
            </g>
          );
        })}
      </svg>
      <ChartLegend series={series} />
      <ChartTooltip tooltip={tooltip} />
    </Box>
  );
};

const HorizontalBarChart = ({
  data,
  leftKey,
  rightKey,
  leftColor,
  rightColor,
}) => {
  const [containerRef, containerWidth] = useContainerWidth(760);
  const [tooltip, setTooltip] = useState(null);
  const dataSignature = JSON.stringify(
    data?.map((d: { [x: string]: any; }) => [d[leftKey], d[rightKey]]),
  );
  const ready = useBarAnimation(dataSignature);

  if (!data?.length)
    return (
      <Text size="xs" c="dimmed" ta="center" py="md">
        Tidak ada data.
      </Text>
    );

  const width = Math.max(containerWidth, 380);
  const height = 28 + data.length * 26;
  const pad = { top: 18, right: 28, bottom: 18, left: 58 };
  const chartW = width - pad.left - pad.right;

  return (
    <Box ref={containerRef} style={{ position: "relative", width: "100%" }}>
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        style={{ display: "block", overflow: "visible" }}
      >
        <line
          x1={pad.left + chartW / 2}
          y1={pad.top}
          x2={pad.left + chartW / 2}
          y2={height - pad.bottom}
          stroke="#dee2e6"
          strokeDasharray="3,3"
        />
        {data.map((d: { [x: string]: any; week: string | number | bigint | boolean | React.ReactElement<unknown, string | React.JSXElementConstructor<any>> | Iterable<React.ReactNode> | React.ReactPortal | Promise<string | number | bigint | boolean | React.ReactPortal | React.ReactElement<unknown, string | React.JSXElementConstructor<any>> | Iterable<React.ReactNode> | null | undefined> | null | undefined; }, i: React.Key | null | undefined) => {
          const y = pad.top + i * 26;
          const total = (d[leftKey] || 0) + (d[rightKey] || 0);
          const fullLeftW =
            total > 0 && !isNaN(((d[leftKey] || 0) / total) * (chartW / 2 - 8))
              ? (d[leftKey] / total) * (chartW / 2 - 8)
              : 0;
          const fullRightW =
            total > 0 && !isNaN(((d[rightKey] || 0) / total) * (chartW / 2 - 8))
              ? (d[rightKey] / total) * (chartW / 2 - 8)
              : 0;
          const leftW = ready ? fullLeftW : 0;
          const rightW = ready ? fullRightW : 0;
          const leftPct = percentage(d[leftKey], total);
          const rightPct = percentage(d[rightKey], total);
          return (
            <g key={i}>
              <text
                x={pad.left - 6}
                y={y + 14}
                textAnchor="end"
                fontSize={10}
                fill="#495057"
                fontWeight={700}
              >
                {d.week}
              </text>
              <rect
                x={pad.left + chartW / 2 - leftW - 4}
                y={y + 4}
                width={leftW}
                height={18}
                rx={3}
                fill={leftColor}
                opacity={0.85}
                style={{
                  transition: "width 550ms cubic-bezier(.4,0,.2,1)",
                  cursor: "pointer",
                }}
                onMouseEnter={(e) => {
                  const rect = containerRef.current.getBoundingClientRect();
                  setTooltip({
                    x: e.clientX - rect.left,
                    y: e.clientY - rect.top,
                    title: d.week,
                    lines: [
                      {
                        label: "On Time",
                        value: `${d[leftKey] ?? 0} (${leftPct}%)`,
                        color: leftColor,
                      },
                    ],
                  });
                }}
                onMouseMove={(e) => {
                  const rect = containerRef.current.getBoundingClientRect();
                  setTooltip((t) =>
                    t
                      ? {
                        ...t,
                        x: e.clientX - rect.left,
                        y: e.clientY - rect.top,
                      }
                      : t,
                  );
                }}
                onMouseLeave={() => setTooltip(null)}
              />
              <rect
                x={pad.left + chartW / 2 + 4}
                y={y + 4}
                width={rightW}
                height={18}
                rx={3}
                fill={rightColor}
                opacity={0.85}
                style={{
                  transition: "width 550ms cubic-bezier(.4,0,.2,1)",
                  cursor: "pointer",
                }}
                onMouseEnter={(e) => {
                  const rect = containerRef.current.getBoundingClientRect();
                  setTooltip({
                    x: e.clientX - rect.left,
                    y: e.clientY - rect.top,
                    title: d.week,
                    lines: [
                      {
                        label: "Late",
                        value: `${d[rightKey] ?? 0} (${rightPct}%)`,
                        color: rightColor,
                      },
                    ],
                  });
                }}
                onMouseMove={(e) => {
                  const rect = containerRef.current.getBoundingClientRect();
                  setTooltip((t) =>
                    t
                      ? {
                        ...t,
                        x: e.clientX - rect.left,
                        y: e.clientY - rect.top,
                      }
                      : t,
                  );
                }}
                onMouseLeave={() => setTooltip(null)}
              />
              {leftPct > 0 && (
                <text
                  x={pad.left + chartW / 2 - 8}
                  y={y + 16}
                  textAnchor="end"
                  fontSize={9}
                  fill="#fff"
                  fontWeight={700}
                  style={{ pointerEvents: "none" }}
                >
                  {leftPct}%
                </text>
              )}
              {rightPct > 0 && (
                <text
                  x={pad.left + chartW / 2 + 8}
                  y={y + 16}
                  fontSize={9}
                  fill="#fff"
                  fontWeight={700}
                  style={{ pointerEvents: "none" }}
                >
                  {rightPct}%
                </text>
              )}
            </g>
          );
        })}
      </svg>
      <ChartLegend
        series={[
          { label: "On Time / OTIF", color: leftColor },
          { label: "Late / NOT OTIF", color: rightColor },
        ]}
      />
      <ChartTooltip tooltip={tooltip} />
    </Box>
  );
};

const ReportChart = ({ data }) => {
  const [containerRef, containerWidth] = useContainerWidth(760);
  const [tooltip, setTooltip] = useState(null);
  const dataSignature = JSON.stringify(
    data?.map((d: { inbound: any; outbound: any; }) => [d.inbound, d.outbound]),
  );
  const ready = useBarAnimation(dataSignature);

  if (!data?.length)
    return (
      <Text size="xs" c="dimmed" ta="center" py="md">
        Tidak ada data.
      </Text>
    );

  const height = 220;
  const pad = { top: 28, right: 20, bottom: 46, left: 55 };

  const minGroupW = 44;
  const minChartW = data.length * minGroupW;
  const chartW = Math.max(containerWidth - pad.left - pad.right, minChartW);
  const totalW = chartW + pad.left + pad.right;
  const chartH = height - pad.top - pad.bottom;
  const maxVal = Math.max(
    ...data.flatMap((d: { inbound: any; outbound: any; }) => [d.inbound || 0, d.outbound || 0]),
    1,
  );
  const groupW = chartW / data.length;
  const barW = Math.min(24, Math.max(6, (groupW - 12) / 2));
  const rotation = labelRotationFor(groupW);

  return (
    <Box
      ref={containerRef}
      style={{ position: "relative", width: "100%", overflowX: "auto" }}
    >
      <svg
        width={totalW}
        height={height}
        viewBox={`0 0 ${totalW} ${height}`}
        style={{ display: "block", overflow: "visible" }}
      >
        {[0, 0.25, 0.5, 0.75, 1].map((p, i) => {
          const y = pad.top + chartH * p;
          const val = Math.round(maxVal * (1 - p));
          return (
            <g key={i}>
              <line
                x1={pad.left}
                y1={y}
                x2={pad.left + chartW}
                y2={y}
                stroke="#e9ecef"
                strokeDasharray="3,3"
              />
              <text
                x={pad.left - 6}
                y={y + 4}
                textAnchor="end"
                fontSize={9}
                fill="#868e96"
              >
                {val >= 1000 ? `${(val / 1000).toFixed(1)}k` : val}
              </text>
            </g>
          );
        })}
        {data.map((d: { inbound: any; outbound: any; week: string | any[]; }, wIdx: React.Key | null | undefined) => {
          const fullInH = isNaN(((d.inbound || 0) / maxVal) * chartH)
            ? 0
            : Math.max(((d.inbound || 0) / maxVal) * chartH, 0);
          const fullOutH = isNaN(((d.outbound || 0) / maxVal) * chartH)
            ? 0
            : Math.max(((d.outbound || 0) / maxVal) * chartH, 0);
          const inH = ready ? fullInH : 0;
          const outH = ready ? fullOutH : 0;
          const x = pad.left + wIdx * groupW + (groupW - barW * 2 - 4) / 2;
          const gCenter = pad.left + wIdx * groupW + groupW / 2;
          return (
            <g key={wIdx}>
              <rect
                x={x}
                y={pad.top + chartH - inH}
                width={barW}
                height={inH}
                rx={3}
                fill="#40c057"
                opacity={0.88}
                style={{
                  transition:
                    "height 550ms cubic-bezier(.4,0,.2,1), y 550ms cubic-bezier(.4,0,.2,1)",
                  cursor: "pointer",
                }}
                onMouseEnter={(e) => {
                  const rect = containerRef.current.getBoundingClientRect();
                  setTooltip({
                    x: e.clientX - rect.left,
                    y: e.clientY - rect.top,
                    title: d.week,
                    lines: [
                      {
                        label: "Inbound",
                        value: (d.inbound || 0).toLocaleString(),
                        color: "#40c057",
                      },
                    ],
                  });
                }}
                onMouseMove={(e) => {
                  const rect = containerRef.current.getBoundingClientRect();
                  setTooltip((t) =>
                    t
                      ? {
                        ...t,
                        x: e.clientX - rect.left,
                        y: e.clientY - rect.top,
                      }
                      : t,
                  );
                }}
                onMouseLeave={() => setTooltip(null)}
              />
              <rect
                x={x + barW + 4}
                y={pad.top + chartH - outH}
                width={barW}
                height={outH}
                rx={3}
                fill="#e03131"
                opacity={0.88}
                style={{
                  transition:
                    "height 550ms cubic-bezier(.4,0,.2,1), y 550ms cubic-bezier(.4,0,.2,1)",
                  cursor: "pointer",
                }}
                onMouseEnter={(e) => {
                  const rect = containerRef.current.getBoundingClientRect();
                  setTooltip({
                    x: e.clientX - rect.left,
                    y: e.clientY - rect.top,
                    title: d.week,
                    lines: [
                      {
                        label: "Outbound",
                        value: (d.outbound || 0).toLocaleString(),
                        color: "#e03131",
                      },
                    ],
                  });
                }}
                onMouseMove={(e) => {
                  const rect = containerRef.current.getBoundingClientRect();
                  setTooltip((t) =>
                    t
                      ? {
                        ...t,
                        x: e.clientX - rect.left,
                        y: e.clientY - rect.top,
                      }
                      : t,
                  );
                }}
                onMouseLeave={() => setTooltip(null)}
              />
              <text
                x={gCenter}
                y={pad.top + chartH + (rotation ? 12 : 18)}
                textAnchor={rotation ? "end" : "middle"}
                fontSize={9}
                fill="#495057"
                fontWeight={600}
                transform={
                  rotation
                    ? `rotate(${rotation}, ${gCenter}, ${pad.top + chartH + 12})`
                    : undefined
                }
              >
                {d.week?.slice(5) || `W${wIdx + 1}`}
              </text>
            </g>
          );
        })}
      </svg>
      <ChartLegend
        series={[
          { label: "Inbound", color: "#40c057" },
          { label: "Outbound", color: "#e03131" },
        ]}
      />
      <ChartTooltip tooltip={tooltip} />
    </Box>
  );
};

/* ─────────────────────────── Main Page ─────────────────────────── */
export default function DashboardPage() {
  const [activeTab, setActiveTab] = useState("occupancy");
  const [stats, setStats] = useState(null);
  const [occupancyData, setOccupancyData] = useState(null);
  const [oftiData, setOftiData] = useState(null);
  const [serapanData, setSerapanData] = useState(null);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tableSearch, setTableSearch] = useState("");
  const [selectedZone, setSelectedZone] = useState(null);
  const [exportFrom, setExportFrom] = useState<Date | null>(null);
  const [exportTo, setExportTo] = useState<Date | null>(null);
  const [showExportFilter, setShowExportFilter] = useState(false);
  const [reportData, setReportData] = useState(null);

  useEffect(() => {
    loadBaseData();
  }, []);

  useEffect(() => {
    if (activeTab === "occupancy" && !occupancyData) loadOccupancy();
    if (activeTab === "ofti" && !oftiData) loadOFTI();
    if (activeTab === "serapan" && !serapanData) loadSerapan();
    if (activeTab === "report" && !reportData) loadReport();
  }, [activeTab]);

  const loadBaseData = async () => {
    try {
      const [dashRes, logRes] = await Promise.all([
        api().get("/inventory/dashboard"),
        api().get("/inventory/logs"),
      ]);
      setStats(normalizeStats(unwrap(dashRes)));
      setLogs(asArray(unwrap(logRes)));
    } catch (e) {
      console.error("Dashboard load error", e);
    }
    setLoading(false);
  };

  const loadOccupancy = async (zone?: string) => {
    try {
      const params = zone ? `?zone=${zone}` : "";
      setOccupancyData(normalizeOccupancy(
        unwrap(await api().get(`/inventory/dashboard/occupancy${params}`)),
      ));
    } catch (e) {
      console.error("Occupancy load error", e);
      setOccupancyData(normalizeOccupancy(null));
    }
  };

  const handleZoneClick = (zone: string) => {
    if (selectedZone === zone) {
      setSelectedZone(null);
      loadOccupancy();
    } else {
      setSelectedZone(zone);
      loadOccupancy(zone);
    }
  };

  const loadOFTI = async () => {
    try {
      setOftiData(normalizeOfti(unwrap(await api().get("/inventory/dashboard/ofti"))));
    } catch (e) {
      console.error("OFTI load error", e);
      setOftiData(normalizeOfti(null));
    }
  };
  const loadSerapan = async () => {
    try {
      setSerapanData(normalizeSerapan(
        unwrap(await api().get("/inventory/dashboard/serapan-ayam")),
      ));
    } catch (e) {
      console.error("Serapan ayam load error", e);
      setSerapanData(normalizeSerapan(null));
    }
  };
  const loadReport = async () => {
    try {
      setReportData(normalizeReport(
        unwrap(await api().get("/inventory/dashboard/inout-chart")),
      ));
    } catch (e) {
      console.error("Report load error", e);
      setReportData([]);
    }
  };

  const filteredLogs = useMemo(() => {
    if (!tableSearch) return logs;
    const q = tableSearch.toLowerCase();
    return logs.filter(
      (log) =>
        (log.no_po && log.no_po.toLowerCase().includes(q)) ||
        (log.no_ref && log.no_ref.toLowerCase().includes(q)) ||
        (log.barang?.nama && log.barang.nama.toLowerCase().includes(q)) ||
        (log.supplier && log.supplier.toLowerCase().includes(q)) ||
        (log.tujuan && log.tujuan.toLowerCase().includes(q)) ||
        (log.gudang?.name && log.gudang.name.toLowerCase().includes(q)),
    );
  }, [logs, tableSearch]);

  if (loading)
    return (
      <Box
        p="xl"
        style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          minHeight: 300,
        }}
      >
        <Loader size="lg" />
      </Box>
    );

  const s = stats || {};

  /* ── export helper ── */
  const handleExportCSV = () => {
    let exportLogs = filteredLogs;
    if (exportFrom) {
      const d = new Date(exportFrom);
      exportLogs = exportLogs.filter((l) => new Date(l.created_at) >= d);
    }
    if (exportTo) {
      const d = new Date(exportTo);
      d.setHours(23, 59, 59);
      exportLogs = exportLogs.filter((l) => new Date(l.created_at) <= d);
    }
    const csv = [
      "Tipe,No PO/Ref,Item,Qty,Satuan,Batch,Expired,Rak,Tanggal,Supplier/Tujuan,Keterangan",
    ]
      .concat(
        exportLogs.map((log) =>
          [
            log.type,
            log.no_po || log.no_ref || "-",
            log.barang?.nama || "-",
            log.qty,
            log.satuan || "-",
            log.batch_no || "-",
            log.expiry_date
              ? new Date(log.expiry_date).toISOString().split("T")[0]
              : "-",
            log.gudang?.name || "-",
            log.tanggal_income || fmt(log.created_at),
            log.supplier || log.tujuan || "-",
            log.note || "-",
          ].map(csvCell).join(","),
        ),
      )
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `mutasi_${exportFrom ? exportFrom.toISOString().split("T")[0] : "all"}_to_${exportTo ? exportTo.toISOString().split("T")[0] : "now"}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  /* ── active tab meta ── */
  const tabMeta = TABS.find((t) => t.key === activeTab);

  return (
    <Box style={{ minHeight: "100vh" }}>
      {/* ════════ TOP HEADER STRIP ════════ */}
      <Box
        style={{
          background: "#fff",
          borderLeft: "4px solid #228be6",
          padding: "14px 20px",
          marginBottom: 16,
          boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
        }}
      >
        {/* Title row */}
        <Group justify="space-between" align="center">
          <Group gap={8}>
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
                <IconBuildingWarehouse size={20} style={{ color: "#228be6" }} />
                DASHBOARD MONITORING RAW MATERIALS
              </Title>
              <Text size="xs" c="dimmed" mt={2}>
                Ringkasan occupancy gudang, OFTI, serapan ayam, dan report.
              </Text>
            </Box>
            {/* Alert badges */}
            <Group gap={4} ml={4}>
              {s.expiredCount > 0 && (
                <Badge
                  color="red"
                  variant="filled"
                  size="xs"
                  leftSection={<IconAlertTriangle size={10} />}
                >
                  EXPIRED {s.expiredCount}
                </Badge>
              )}
              {s.nearExpiredCount > 0 && (
                <Badge
                  color="yellow"
                  variant="filled"
                  size="xs"
                  leftSection={<IconCalendarStats size={10} />}
                  style={{ color: "#1a1a1a" }}
                >
                  NEAR EXP {s.nearExpiredCount}
                </Badge>
              )}
              {s.wasteCount > 0 && (
                <Badge
                  color="violet"
                  variant="filled"
                  size="xs"
                  leftSection={<IconPackage size={10} />}
                >
                  WASTE {s.wasteCount}
                </Badge>
              )}
            </Group>
          </Group>
          <Button
            size="xs"
            variant="outline"
            leftSection={<IconRefresh size={13} />}
            onClick={() => {
              loadBaseData();
              if (activeTab === "occupancy") loadOccupancy();
              if (activeTab === "ofti") loadOFTI();
              if (activeTab === "serapan") loadSerapan();
              if (activeTab === "report") loadReport();
            }}
            style={{ fontWeight: 700, borderRadius: 8 }}
          >
            Refresh
          </Button>
        </Group>

        {/* KPI cards row */}
        <Group
          gap={6}
          mt={12}
          wrap="nowrap"
          style={{ overflowX: "auto", paddingBottom: 2 }}
        >
          <KpiCard
            label="Total SKU"
            value={s.totalSku == null ? "—" : s.totalSku.toLocaleString()}
            icon={IconPackage}
            accent="#228be6"
            bg="#e7f5ff"
            sub="aktif di gudang"
          />
          <KpiCard
            label="Total Stock"
            value={s.totalStock == null ? "—" : `${s.totalStock.toLocaleString()} kg`}
            icon={IconDatabase}
            accent="#40c057"
            bg="#d3f9d8"
            sub="keseluruhan gudang"
          />
          <KpiCard
            label="Inbound Hari Ini"
            value={s.inboundHariIni == null ? "—" : s.inboundHariIni.toLocaleString()}
            icon={IconTrendingUp}
            accent="#0ca678"
            bg="#c3fae8"
            sub="transaksi masuk"
          />
          <KpiCard
            label="Outbound Hari Ini"
            value={s.outboundHariIni == null ? "—" : s.outboundHariIni.toLocaleString()}
            icon={IconTrendingDown}
            accent="#e03131"
            bg="#ffe3e3"
            sub="transaksi keluar"
          />
          <KpiCard
            label="Expired"
            value={s.expiredCount ?? "—"}
            icon={IconAlertTriangle}
            accent="#e03131"
            bg="#ffe3e3"
            sub="item expired"
          />
          <KpiCard
            label="Near Expired"
            value={s.nearExpiredCount ?? "—"}
            icon={IconCalendarStats}
            accent="#f59f00"
            bg="#fff3bf"
            sub="≤ 7 hari"
          />
        </Group>

        {/* Tab nav */}
        <Group gap={4} mt={12} wrap="nowrap" style={{ overflowX: "auto" }}>
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.key;
            return (
              <Button
                key={tab.key}
                size="xs"
                variant={active ? "filled" : "outline"}
                color={active ? "blue" : "gray"}
                leftSection={<Icon size={13} />}
                onClick={() => setActiveTab(tab.key)}
                style={{ fontWeight: 700, fontSize: 11 }}
              >
                {tab.label}
              </Button>
            );
          })}
        </Group>
      </Box>

      {/* ════════ TAB CONTENT ════════ */}
      <Box p="sm">
        <Stack gap="sm">
          {/* ── OCCUPANCY tab ── */}
          {activeTab === "occupancy" && (
            <>
              {/* Gauges */}
              <Paper
                withBorder
                p="sm"
                style={{
                  borderRadius: 12,
                  background: "#fff",
                  boxShadow: cardShadow,
                }}
              >
                <SectionHeader
                  icon={IconChartPie}
                  accent="#228be6"
                  bg="#e7f5ff"
                  title="Okupansi per Zone"
                  sub="Klik zone untuk melihat detail item & trend harian"
                />
                <Box style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {occupancyData?.gauges?.map((g: { id: React.Key | null | undefined; pct: unknown; name: unknown; occupiedRacks: any; totalRacks: any; color: unknown; }) => (
                    <Box
                      key={g.id}
                      style={{ flex: "1 1 0", minWidth: 100, maxWidth: 150 }}
                    >
                      <OccupancyGauge
                        pct={g.pct}
                        label={g.name}
                        subLabel={`${g.occupiedRacks} / ${g.totalRacks} rak terisi`}
                        color={g.color}
                        selected={selectedZone === g.id}
                        onClick={() => handleZoneClick(g.id)}
                      />
                    </Box>
                  ))}
                  {!occupancyData && (
                    <Box py="xl" ta="center" style={{ width: "100%" }}>
                      <Loader size="sm" />
                    </Box>
                  )}
                  {occupancyData && occupancyData.gauges.length === 0 && (
                    <Box py="xl" ta="center" style={{ width: "100%" }}>
                      <Text size="xs" c="dimmed">Tidak ada data okupansi dari server.</Text>
                    </Box>
                  )}
                </Box>
              </Paper>

              {selectedZone ? (
                <>
                  {/* Daily trend chart */}
                  <Paper
                    withBorder
                    p="sm"
                    style={{
                      borderRadius: 12,
                      background: "#fff",
                      boxShadow: cardShadow,
                    }}
                  >
                    <SectionHeader
                      icon={IconChartBar}
                      accent="#f59f00"
                      bg="#fff3bf"
                      title={`Trend Harian — Zone ${selectedZone}`}
                      sub="Scroll horizontal untuk data 1 tahun"
                      right={
                        <Badge
                          size="sm"
                          variant="light"
                          color="yellow"
                          style={{ cursor: "pointer" }}
                          onClick={() => {
                            setSelectedZone(null);
                            loadOccupancy();
                          }}
                        >
                          ✕ Kembali ke semua zone
                        </Badge>
                      }
                    />
                    <Box style={{ overflowX: "auto", maxWidth: "100%" }}>
                      <SimpleBarChart
                        series={[
                          {
                            label: "Qty",
                            color:
                              occupancyData?.gauges?.find(
                                (g: { id: any; }) => g.id === selectedZone,
                              )?.color || "#228be6",
                            data:
                              occupancyData?.dailySeries?.map((d: { value: any; }) => d.value) ||
                              [],
                          },
                        ]}
                        labels={
                          occupancyData?.dailySeries?.map((d: { date: string | any[]; }) => ({
                            key: d.date,
                            label: d.date.slice(5),
                          })) || []
                        }
                      />
                    </Box>
                  </Paper>

                  {/* Items table for selected zone */}
                  <Paper
                    withBorder
                    p="sm"
                    style={{
                      borderRadius: 12,
                      background: "#fff",
                      boxShadow: cardShadow,
                    }}
                  >
                    <SectionHeader
                      icon={IconBuildingWarehouse}
                      accent="#228be6"
                      bg="#e7f5ff"
                      title={`Item di Zone ${selectedZone}`}
                      sub={`${occupancyData?.items?.length || 0} item ditemukan`}
                      right={
                        <TextInput
                          placeholder="Cari item..."
                          size="xs"
                          leftSection={<IconSearch size={12} />}
                          value={tableSearch}
                          onChange={(e) => setTableSearch(e.target.value)}
                          style={{ width: 180 }}
                        />
                      }
                    />
                    <Box
                      style={{
                        overflowX: "auto",
                        borderRadius: 8,
                        border: "1px solid #e9ecef",
                      }}
                    >
                      <Box
                        component="table"
                        style={{
                          width: "100%",
                          borderCollapse: "collapse",
                          minWidth: 620,
                        }}
                      >
                        <Box
                          component="thead"
                          style={{ background: "#1a1a1a" }}
                        >
                          <Box component="tr">
                            {[
                              "Barang",
                              "Batch",
                              "Qty",
                              "Satuan",
                              "Expired",
                              "Rak",
                            ].map((h, i) => (
                              <TH key={h} right={h === "Qty"}>
                                {h}
                              </TH>
                            ))}
                          </Box>
                        </Box>
                        <Box component="tbody">
                          {occupancyData?.items
                            ?.filter(
                              (item: { barang: string; batch: string; }) =>
                                !tableSearch ||
                                item.barang
                                  .toLowerCase()
                                  .includes(tableSearch.toLowerCase()) ||
                                item.batch
                                  .toLowerCase()
                                  .includes(tableSearch.toLowerCase()),
                            )
                            .map((item: { id: React.Key | null | undefined; barang: unknown; batch: string | number | bigint | boolean | React.ReactElement<unknown, string | React.JSXElementConstructor<any>> | Iterable<React.ReactNode> | React.ReactPortal | Promise<string | number | bigint | boolean | React.ReactPortal | React.ReactElement<unknown, string | React.JSXElementConstructor<any>> | Iterable<React.ReactNode> | null | undefined> | null | undefined; qty: { toLocaleString: () => unknown; }; satuan: string | number | bigint | boolean | React.ReactElement<unknown, string | React.JSXElementConstructor<any>> | Iterable<React.ReactNode> | React.ReactPortal | Promise<string | number | bigint | boolean | React.ReactPortal | React.ReactElement<unknown, string | React.JSXElementConstructor<any>> | Iterable<React.ReactNode> | null | undefined> | null | undefined; expiry: string | number | bigint | boolean | Date | React.ReactElement<unknown, string | React.JSXElementConstructor<any>> | Iterable<React.ReactNode> | Promise<string | number | bigint | boolean | React.ReactPortal | React.ReactElement<unknown, string | React.JSXElementConstructor<any>> | Iterable<React.ReactNode> | null | undefined> | null | undefined; rack: string | number | bigint | boolean | React.ReactElement<unknown, string | React.JSXElementConstructor<any>> | Iterable<React.ReactNode> | React.ReactPortal | Promise<string | number | bigint | boolean | React.ReactPortal | React.ReactElement<unknown, string | React.JSXElementConstructor<any>> | Iterable<React.ReactNode> | null | undefined> | null | undefined; }, idx: number) => (
                              <Box
                                component="tr"
                                key={item.id}
                                style={{
                                  borderBottom: "1px solid #f1f3f5",
                                  background:
                                    idx % 2 === 0 ? "#fff" : "#f8f9fa",
                                }}
                              >
                                <TD
                                  style={{ fontWeight: 700, color: "#1a1a2e" }}
                                >
                                  {item.barang}
                                </TD>
                                <TD>
                                  <Badge
                                    size="xs"
                                    color="indigo"
                                    variant="light"
                                  >
                                    {item.batch}
                                  </Badge>
                                </TD>
                                <TD right style={{ fontWeight: 700 }}>
                                  {item.qty.toLocaleString()}
                                </TD>
                                <TD>
                                  <Text size="10px" c="dimmed">
                                    {item.satuan}
                                  </Text>
                                </TD>
                                <TD>
                                  {item.expiry ? (
                                    <Badge
                                      size="xs"
                                      color={
                                        new Date(item.expiry) < new Date()
                                          ? "red"
                                          : "teal"
                                      }
                                      variant="light"
                                    >
                                      {item.expiry}
                                    </Badge>
                                  ) : (
                                    <Text size="10px" c="dimmed">
                                      —
                                    </Text>
                                  )}
                                </TD>
                                <TD>
                                  <Badge
                                    size="xs"
                                    color="gray"
                                    variant="outline"
                                  >
                                    {item.rack}
                                  </Badge>
                                </TD>
                              </Box>
                            ))}
                          {(!occupancyData?.items ||
                            occupancyData.items.length === 0) && (
                              <Box component="tr">
                                <Box
                                  component="td"
                                  colSpan={6}
                                  style={{ padding: 20, textAlign: "center" }}
                                >
                                  <Text size="xs" c="dimmed">
                                    Tidak ada item di zone ini.
                                  </Text>
                                </Box>
                              </Box>
                            )}
                        </Box>
                      </Box>
                    </Box>
                  </Paper>
                </>
              ) : (
                <>
                  {/* Zone bar chart */}
                  <Paper
                    withBorder
                    p="sm"
                    style={{
                      borderRadius: 12,
                      background: "#fff",
                      boxShadow: cardShadow,
                    }}
                  >
                    <SectionHeader
                      icon={IconChartBar}
                      accent="#f59f00"
                      bg="#fff3bf"
                      title="Okupansi per Zone (1 Tahun)"
                      sub="Otomatis menyesuaikan lebar layar"
                    />
                    <OccupancyYearChart
                      series={occupancyData?.series}
                      labels={occupancyData?.weeks}
                    />
                  </Paper>

                  {/* Summary zone table */}
                  <Paper
                    withBorder
                    p="sm"
                    style={{
                      borderRadius: 12,
                      background: "#fff",
                      boxShadow: cardShadow,
                    }}
                  >
                    <SectionHeader
                      icon={IconBuildingWarehouse}
                      accent="#228be6"
                      bg="#e7f5ff"
                      title="Summary per Zone"
                      sub="Klik baris untuk melihat detail zone"
                      right={
                        <TextInput
                          placeholder="Cari zone..."
                          size="xs"
                          leftSection={<IconSearch size={12} />}
                          value={tableSearch}
                          onChange={(e) => setTableSearch(e.target.value)}
                          style={{ width: 160 }}
                        />
                      }
                    />
                    <Box
                      style={{
                        overflowX: "auto",
                        borderRadius: 8,
                        border: "1px solid #e9ecef",
                      }}
                    >
                      <Box
                        component="table"
                        style={{
                          width: "100%",
                          borderCollapse: "collapse",
                          minWidth: 580,
                        }}
                      >
                        <Box
                          component="thead"
                          style={{ background: "#1a1a1a" }}
                        >
                          <Box component="tr">
                            {[
                              "Zone",
                              "Rak Terisi",
                              "Total Rak",
                              "%",
                              "Status",
                              "Trend",
                            ].map((h) => (
                              <TH
                                key={h}
                                right={[
                                  "Rak Terisi",
                                  "Total Rak",
                                ].includes(h)}
                              >
                                {h}
                              </TH>
                            ))}
                          </Box>
                        </Box>
                        <Box component="tbody">
                          {occupancyData?.gauges
                            ?.filter(
                              (g: { name: string; }) =>
                                !tableSearch ||
                                g.name
                                  .toLowerCase()
                                  .includes(tableSearch.toLowerCase()),
                            )
                            .map((g: { pct: string | number | bigint | boolean | React.ReactElement<unknown, string | React.JSXElementConstructor<any>> | Iterable<React.ReactNode> | Promise<string | number | bigint | boolean | React.ReactPortal | React.ReactElement<unknown, string | React.JSXElementConstructor<any>> | Iterable<React.ReactNode> | null | undefined> | null | undefined; id: React.Key | null | undefined; name: unknown; occupiedRacks: unknown; totalRacks: unknown; color: any; }, idx: number) => {
                              const pctColor =
                                g.pct > 90
                                  ? "red"
                                  : g.pct > 75
                                    ? "orange"
                                    : g.pct > 50
                                      ? "yellow"
                                      : "green";
                              const statusLabel =
                                g.pct > 90
                                  ? "🔴 Penuh"
                                  : g.pct > 75
                                    ? "🟠 Hampir Penuh"
                                    : g.pct > 50
                                      ? "🟡 Sedang"
                                      : "🟢 Aman";
                              return (
                                <Box
                                  component="tr"
                                  key={g.id}
                                  style={{
                                    borderBottom: "1px solid #f1f3f5",
                                    background:
                                      idx % 2 === 0 ? "#fff" : "#f8f9fa",
                                    cursor: "pointer",
                                    transition: "background 0.15s",
                                  }}
                                  onClick={() => handleZoneClick(g.id)}
                                >
                                  <TD
                                    style={{
                                      fontWeight: 800,
                                      color: "#1a1a2e",
                                    }}
                                  >
                                    {g.name}
                                  </TD>
                                  <TD right style={{ fontWeight: 700 }}>
                                    {g.occupiedRacks}
                                  </TD>
                                  <TD right>
                                    {g.totalRacks}
                                  </TD>
                                  <TD>
                                    <Group gap={6} wrap="nowrap">
                                      <Box
                                        style={{
                                          flex: 1,
                                          background: "#f1f3f5",
                                          borderRadius: 4,
                                          height: 8,
                                          minWidth: 60,
                                          maxWidth: 90,
                                          overflow: "hidden",
                                        }}
                                      >
                                        <Box
                                          style={{
                                            width: `${g.pct}%`,
                                            height: "100%",
                                            background: g.color,
                                            borderRadius: 4,
                                            transition: "width 0.4s",
                                          }}
                                        />
                                      </Box>
                                      <Badge
                                        size="xs"
                                        color={pctColor}
                                        variant="filled"
                                        style={{ flexShrink: 0 }}
                                      >
                                        {g.pct}%
                                      </Badge>
                                    </Group>
                                  </TD>
                                  <TD>
                                    <Text size="10px" fw={600}>
                                      {statusLabel}
                                    </Text>
                                  </TD>
                                  <TD>
                                    <Text
                                      size="10px"
                                      c="blue"
                                      style={{ textDecoration: "underline" }}
                                    >
                                      Detail →
                                    </Text>
                                  </TD>
                                </Box>
                              );
                            })}
                          {!occupancyData && (
                            <Box component="tr">
                              <Box
                                component="td"
                                colSpan={6}
                                style={{ padding: 20, textAlign: "center" }}
                              >
                                <Loader size="sm" />
                              </Box>
                            </Box>
                          )}
                        </Box>
                      </Box>
                    </Box>
                  </Paper>
                </>
              )}
            </>
          )}

          {/* ── OFTI tab ── */}
          {activeTab === "ofti" && (
            <>
              <Paper
                withBorder
                p="sm"
                style={{
                  borderRadius: 12,
                  background: "#fff",
                  boxShadow: cardShadow,
                }}
              >
                <SectionHeader
                  icon={IconTruckDelivery}
                  accent="#2b8a3e"
                  bg="#d3f9d8"
                  title="Planning Inbound vs Actual Inbound"
                  sub="On Time (hijau) vs Late (merah) — 1 tahun"
                />
                <SimpleBarChart
                  series={[
                    {
                      label: "On Time",
                      color: "#40c057",
                      data: oftiData?.weekly?.map((d: { ontime: any; }) => d.ontime) || [],
                    },
                    {
                      label: "Late",
                      color: "#e03131",
                      data: oftiData?.weekly?.map((d: { late: any; }) => d.late) || [],
                    },
                  ]}
                  labels={
                    oftiData?.weekly?.map((d: { week: any; }) => ({
                      key: d.week,
                      label: d.week,
                    })) || []
                  }
                />
              </Paper>

              <Paper
                withBorder
                p="sm"
                style={{
                  borderRadius: 12,
                  background: "#fff",
                  boxShadow: cardShadow,
                }}
              >
                <SectionHeader
                  icon={IconChartLine}
                  accent="#228be6"
                  bg="#e7f5ff"
                  title="OTIF INBOUND CP3"
                  sub="% OTIF vs NOT OTIF per minggu — 1 tahun"
                />
                <Box style={{ overflowX: "auto", maxWidth: "100%" }}>
                  <HorizontalBarChart
                    data={oftiData?.weekly}
                    leftKey="otif"
                    rightKey="notOtif"
                    leftColor="#228be6"
                    rightColor="#e03131"
                  />
                </Box>
              </Paper>

              {/* OFTI summary table */}
              {oftiData?.weekly?.length > 0 && (
                <Paper
                  withBorder
                  p="sm"
                  style={{
                    borderRadius: 12,
                    background: "#fff",
                    boxShadow: cardShadow,
                  }}
                >
                  <SectionHeader
                    icon={IconChartBar}
                    accent="#2b8a3e"
                    bg="#d3f9d8"
                    title="Tabel OTIF per Minggu"
                    sub={`${oftiData.weekly.length} minggu terakhir`}
                  />
                  <Box
                    style={{
                      overflowX: "auto",
                      maxHeight: 320,
                      borderRadius: 8,
                      border: "1px solid #e9ecef",
                    }}
                  >
                    <Box
                      component="table"
                      style={{
                        width: "100%",
                        borderCollapse: "collapse",
                        minWidth: 480,
                      }}
                    >
                      <Box
                        component="thead"
                        style={{
                          background: "#1a1a1a",
                          position: "sticky",
                          top: 0,
                          zIndex: 1,
                        }}
                      >
                        <Box component="tr">
                          {[
                            "Minggu",
                            "On Time",
                            "Late",
                            "Total",
                            "OTIF %",
                            "NOT OTIF %",
                          ].map((h) => (
                            <TH
                              key={h}
                              right={[
                                "On Time",
                                "Late",
                                "Total",
                                "OTIF %",
                                "NOT OTIF %",
                              ].includes(h)}
                            >
                              {h}
                            </TH>
                          ))}
                        </Box>
                      </Box>
                      <Box component="tbody">
                        {oftiData.weekly.map((d: { otif: any; notOtif: any; week: unknown; ontime: { toLocaleString: () => string | number | bigint | boolean | React.ReactElement<unknown, string | React.JSXElementConstructor<any>> | Iterable<React.ReactNode> | React.ReactPortal | Promise<string | number | bigint | boolean | React.ReactPortal | React.ReactElement<unknown, string | React.JSXElementConstructor<any>> | Iterable<React.ReactNode> | null | undefined> | null | undefined; }; late: { toLocaleString: () => string | number | bigint | boolean | React.ReactElement<unknown, string | React.JSXElementConstructor<any>> | Iterable<React.ReactNode> | React.ReactPortal | Promise<string | number | bigint | boolean | React.ReactPortal | React.ReactElement<unknown, string | React.JSXElementConstructor<any>> | Iterable<React.ReactNode> | null | undefined> | null | undefined; }; }, idx: number) => {
                          const total = d.otif + d.notOtif;
                          const otifPct = percentage(d.otif, total);
                          return (
                            <Box
                              component="tr"
                              key={d.week}
                              style={{
                                borderBottom: "1px solid #f1f3f5",
                                background: idx % 2 === 0 ? "#fff" : "#f8f9fa",
                              }}
                            >
                              <TD style={{ fontWeight: 700 }}>{d.week}</TD>
                              <TD right>
                                <Badge size="xs" color="green" variant="light">
                                  {d.ontime.toLocaleString()}
                                </Badge>
                              </TD>
                              <TD right>
                                <Badge size="xs" color="red" variant="light">
                                  {d.late.toLocaleString()}
                                </Badge>
                              </TD>
                              <TD right style={{ fontWeight: 700 }}>
                                {total}
                              </TD>
                              <TD right>
                                <Badge
                                  size="xs"
                                  color={
                                    otifPct >= 80
                                      ? "green"
                                      : otifPct >= 60
                                        ? "yellow"
                                        : "red"
                                  }
                                  variant="filled"
                                >
                                  {otifPct}%
                                </Badge>
                              </TD>
                              <TD right>
                                <Text size="10px" c="dimmed">
                                  {total > 0 ? 100 - otifPct : 0}%
                                </Text>
                              </TD>
                            </Box>
                          );
                        })}
                      </Box>
                    </Box>
                  </Box>
                </Paper>
              )}
            </>
          )}

          {/* ── SERAPAN tab ── */}
          {activeTab === "serapan" && (
            <>
              <Paper
                withBorder
                p="sm"
                style={{
                  borderRadius: 12,
                  background: "#fff",
                  boxShadow: cardShadow,
                }}
              >
                <SectionHeader
                  icon={IconMeat}
                  accent="#be4bdb"
                  bg="#f3d9fa"
                  title="Serapan Ayam"
                  sub="Planning vs Serapan per minggu — 1 tahun"
                />
                <SimpleBarChart
                  series={[
                    {
                      label: "Planning",
                      color: "#4c6ef5",
                      data: serapanData?.data?.map((d: { planning: any; }) => d.planning) || [],
                    },
                    {
                      label: "Serapan",
                      color: "#be4bdb",
                      data: serapanData?.data?.map((d: { serapan: any; }) => d.serapan) || [],
                    },
                  ]}
                  labels={
                    serapanData?.data?.map((d: { week: any; }) => ({
                      key: d.week,
                      label: d.week,
                    })) || []
                  }
                />
              </Paper>

              {serapanData?.data?.length > 0 && (
                <Paper
                  withBorder
                  p="sm"
                  style={{
                    borderRadius: 12,
                    background: "#fff",
                    boxShadow: cardShadow,
                  }}
                >
                  <SectionHeader
                    icon={IconChartBar}
                    accent="#be4bdb"
                    bg="#f3d9fa"
                    title="Tabel Serapan per Minggu"
                    sub={`${serapanData.data.length} minggu terakhir`}
                  />
                  <Box
                    style={{
                      overflowX: "auto",
                      maxHeight: 320,
                      borderRadius: 8,
                      border: "1px solid #e9ecef",
                    }}
                  >
                    <Box
                      component="table"
                      style={{
                        width: "100%",
                        borderCollapse: "collapse",
                        minWidth: 420,
                      }}
                    >
                      <Box
                        component="thead"
                        style={{
                          background: "#1a1a1a",
                          position: "sticky",
                          top: 0,
                          zIndex: 1,
                        }}
                      >
                        <Box component="tr">
                          {[
                            "Minggu",
                            "Planning",
                            "Serapan",
                            "Selisih",
                            "% Serapan",
                          ].map((h) => (
                            <TH
                              key={h}
                              right={[
                                "Planning",
                                "Serapan",
                                "Selisih",
                                "% Serapan",
                              ].includes(h)}
                            >
                              {h}
                            </TH>
                          ))}
                        </Box>
                      </Box>
                      <Box component="tbody">
                        {serapanData.data.map((d: { planning: number; serapan: number; week: unknown; }, idx: number) => {
                          const pct = d.planning > 0 ? Math.round((d.serapan / d.planning) * 100) : 0;
                          const selisih = d.serapan - d.planning;
                          return (
                            <Box
                              component="tr"
                              key={d.week}
                              style={{
                                borderBottom: "1px solid #f1f3f5",
                                background: idx % 2 === 0 ? "#fff" : "#f8f9fa",
                              }}
                            >
                              <TD style={{ fontWeight: 700 }}>{d.week}</TD>
                              <TD right style={{ fontWeight: 700 }}>
                                {(d.planning || 0).toLocaleString()}
                              </TD>
                              <TD right>
                                <Badge size="xs" color="grape" variant="light">
                                  {(d.serapan || 0).toLocaleString()}
                                </Badge>
                              </TD>
                              <TD right>
                                <Text
                                  size="10px"
                                  fw={700}
                                  c={selisih >= 0 ? "green" : "red"}
                                >
                                  {selisih >= 0 ? "+" : ""}
                                  {selisih.toLocaleString()}
                                </Text>
                              </TD>
                              <TD right>
                                <Badge
                                  size="xs"
                                  color={
                                    pct >= 90
                                      ? "green"
                                      : pct >= 70
                                        ? "yellow"
                                        : "red"
                                  }
                                  variant="filled"
                                >
                                  {pct}%
                                </Badge>
                              </TD>
                            </Box>
                          );
                        })}
                      </Box>
                    </Box>
                  </Box>
                </Paper>
              )}
            </>
          )}

          {/* ── REPORT tab ── */}
          {activeTab === "report" && (
            <>
              <Paper
                withBorder
                p="sm"
                style={{
                  borderRadius: 12,
                  background: "#fff",
                  boxShadow: cardShadow,
                }}
              >
                <SectionHeader
                  icon={IconChartBar}
                  accent="#e67700"
                  bg="#fff3bf"
                  title="Inbound vs Outbound (1 Tahun)"
                  sub="Otomatis menyesuaikan lebar layar"
                />
                <ReportChart data={reportData} />
              </Paper>

              {reportData?.length > 0 && (
                <Paper
                  withBorder
                  p="sm"
                  style={{
                    borderRadius: 12,
                    background: "#fff",
                    boxShadow: cardShadow,
                  }}
                >
                  <SectionHeader
                    icon={IconDatabase}
                    accent="#e67700"
                    bg="#fff3bf"
                    title="Tabel Inbound vs Outbound"
                    sub={`${reportData.length} minggu terakhir`}
                  />
                  <Box
                    style={{
                      overflowX: "auto",
                      maxHeight: 300,
                      borderRadius: 8,
                      border: "1px solid #e9ecef",
                    }}
                  >
                    <Box
                      component="table"
                      style={{
                        width: "100%",
                        borderCollapse: "collapse",
                        minWidth: 380,
                      }}
                    >
                      <Box
                        component="thead"
                        style={{
                          background: "#1a1a1a",
                          position: "sticky",
                          top: 0,
                          zIndex: 1,
                        }}
                      >
                        <Box component="tr">
                          {[
                            "Minggu",
                            "Inbound",
                            "Outbound",
                            "Net",
                            "Ratio",
                          ].map((h) => (
                            <TH
                              key={h}
                              right={[
                                "Inbound",
                                "Outbound",
                                "Net",
                                "Ratio",
                              ].includes(h)}
                            >
                              {h}
                            </TH>
                          ))}
                        </Box>
                      </Box>
                      <Box component="tbody">
                        {reportData.map((d: { inbound: any; outbound: any; week: unknown; }, idx: number) => {
                          const net = (d.inbound || 0) - (d.outbound || 0);
                          const total = (d.inbound || 0) + (d.outbound || 0);
                          const ratio =
                            total > 0 ? percentage(d.inbound, total) : 0;
                          return (
                            <Box
                              component="tr"
                              key={d.week}
                              style={{
                                borderBottom: "1px solid #f1f3f5",
                                background: idx % 2 === 0 ? "#fff" : "#f8f9fa",
                              }}
                            >
                              <TD style={{ fontWeight: 700 }}>{d.week}</TD>
                              <TD right>
                                <Badge size="xs" color="green" variant="light">
                                  {(d.inbound || 0).toLocaleString()}
                                </Badge>
                              </TD>
                              <TD right>
                                <Badge size="xs" color="red" variant="light">
                                  {(d.outbound || 0).toLocaleString()}
                                </Badge>
                              </TD>
                              <TD right>
                                <Text
                                  size="10px"
                                  fw={700}
                                  c={net >= 0 ? "green" : "red"}
                                >
                                  {net >= 0 ? "+" : ""}
                                  {net.toLocaleString()}
                                </Text>
                              </TD>
                              <TD right>
                                <Box
                                  style={{
                                    display: "flex",
                                    gap: 4,
                                    alignItems: "center",
                                    justifyContent: "flex-end",
                                  }}
                                >
                                  <Box
                                    style={{
                                      width: 60,
                                      height: 8,
                                      background: "#f1f3f5",
                                      borderRadius: 4,
                                      overflow: "hidden",
                                    }}
                                  >
                                    <Box
                                      style={{
                                        width: `${ratio}%`,
                                        height: "100%",
                                        background: "#40c057",
                                        borderRadius: 4,
                                      }}
                                    />
                                  </Box>
                                  <Text size="9px" c="dimmed">
                                    {ratio}%
                                  </Text>
                                </Box>
                              </TD>
                            </Box>
                          );
                        })}
                      </Box>
                    </Box>
                  </Box>
                </Paper>
              )}
            </>
          )}

          {/* ════ MUTASI TABLE — always shown ════ */}
          <Paper
            withBorder
            p="sm"
            style={{
              borderRadius: 12,
              background: "#fff",
              boxShadow: cardShadow,
            }}
          >
            <SectionHeader
              icon={IconTrendingUp}
              accent="#228be6"
              bg="#e7f5ff"
              title="Mutasi Terbaru"
              sub={`${filteredLogs.length} transaksi • menampilkan 15 terbaru`}
              right={
                <Group gap={4} wrap="nowrap">
                  <TextInput
                    placeholder="Cari PO, Item..."
                    size="xs"
                    leftSection={<IconSearch size={12} />}
                    value={tableSearch}
                    onChange={(e) => setTableSearch(e.target.value)}
                    style={{ width: 150 }}
                    rightSection={
                      tableSearch && (
                        <Box
                          style={{ cursor: "pointer" }}
                          onClick={() => setTableSearch("")}
                        >
                          <IconX size={12} color="#868e96" />
                        </Box>
                      )
                    }
                  />
                  <Button
                    size="xs"
                    variant={showExportFilter ? "filled" : "light"}
                    color="gray"
                    leftSection={<IconFilter size={12} />}
                    onClick={() => setShowExportFilter(!showExportFilter)}
                  >
                    Filter
                  </Button>
                  <Button
                    size="xs"
                    variant="light"
                    color="blue"
                    leftSection={<IconDownload size={12} />}
                    onClick={handleExportCSV}
                  >
                    CSV
                  </Button>
                </Group>
              }
            />

            {/* Date filter */}
            {showExportFilter && (
              <Box
                style={{
                  background: "#f8f9fa",
                  borderRadius: 8,
                  padding: "8px 12px",
                  marginBottom: 8,
                }}
              >
                <Group gap={8} wrap="wrap" align="flex-end">
                  <Box>
                    <Text size="9px" c="dimmed" fw={600} mb={2}>
                      DARI
                    </Text>
                    <input
                      type="date"
                      value={
                        exportFrom ? exportFrom.toISOString().split("T")[0] : ""
                      }
                      onChange={(e) =>
                        setExportFrom(
                          e.target.value ? new Date(e.target.value) : null,
                        )
                      }
                      style={{
                        padding: "4px 8px",
                        border: "1px solid #dee2e6",
                        borderRadius: 6,
                        fontSize: 12,
                        background: "#fff",
                      }}
                    />
                  </Box>
                  <Box>
                    <Text size="9px" c="dimmed" fw={600} mb={2}>
                      SAMPAI
                    </Text>
                    <input
                      type="date"
                      value={
                        exportTo ? exportTo.toISOString().split("T")[0] : ""
                      }
                      onChange={(e) =>
                        setExportTo(
                          e.target.value ? new Date(e.target.value) : null,
                        )
                      }
                      style={{
                        padding: "4px 8px",
                        border: "1px solid #dee2e6",
                        borderRadius: 6,
                        fontSize: 12,
                        background: "#fff",
                      }}
                    />
                  </Box>
                  <Button
                    size="xs"
                    variant="subtle"
                    color="red"
                    onClick={() => {
                      setExportFrom(null);
                      setExportTo(null);
                    }}
                  >
                    Reset
                  </Button>
                </Group>
              </Box>
            )}

            {/* Table */}
            <Box
              style={{
                overflowX: "auto",
                maxHeight: 380,
                borderRadius: 8,
                border: "1px solid #e9ecef",
              }}
            >
              <Box
                component="table"
                style={{
                  width: "100%",
                  borderCollapse: "collapse",
                  fontSize: 11,
                  minWidth: 900,
                }}
              >
                <Box
                  component="thead"
                  style={{
                    background: "#1a1a1a",
                    position: "sticky",
                    top: 0,
                    zIndex: 1,
                  }}
                >
                  <Box component="tr">
                    {[
                      "Tipe",
                      "No PO/Ref",
                      "Item",
                      "Qty",
                      "Satuan",
                      "Batch",
                      "Expired",
                      "Rak",
                      "Tanggal",
                      "Supplier/Tujuan",
                      "Ket",
                    ].map((h, i) => (
                      <TH key={h} right={h === "Qty"}>
                        {h}
                      </TH>
                    ))}
                  </Box>
                </Box>
                <Box component="tbody">
                  {filteredLogs.slice(0, 15).map((log, idx) => {
                    const typeColor =
                      log.type === "INBOUND"
                        ? "green"
                        : log.type === "OUTBOUND"
                          ? "red"
                          : "blue";
                    const isExpired =
                      log.expiry_date && new Date(log.expiry_date) < new Date();
                    return (
                      <Box
                        component="tr"
                        key={log.id}
                        style={{
                          borderBottom: "1px solid #f1f3f5",
                          background: idx % 2 === 0 ? "#fff" : "#f8f9fa",
                          transition: "background 0.12s",
                        }}
                      >
                        <TD>
                          <Badge
                            size="xs"
                            color={typeColor}
                            variant="filled"
                            style={{ letterSpacing: "0.03em" }}
                          >
                            {log.type}
                          </Badge>
                        </TD>
                        <TD
                          style={{
                            fontWeight: 700,
                            color: "#1a1a2e",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {log.no_po || log.no_ref || "—"}
                        </TD>
                        <TD
                          style={{
                            fontWeight: 600,
                            maxWidth: 180,
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {log.barang?.nama || "—"}
                        </TD>
                        <TD right style={{ fontWeight: 700 }}>
                          {log.qty?.toLocaleString()}
                        </TD>
                        <TD>
                          <Text size="10px" c="dimmed">
                            {log.satuan || "—"}
                          </Text>
                        </TD>
                        <TD>
                          <Badge size="xs" color="indigo" variant="light">
                            {log.batch_no || "—"}
                          </Badge>
                        </TD>
                        <TD>
                          {log.expiry_date ? (
                            <Badge
                              size="xs"
                              color={isExpired ? "red" : "teal"}
                              variant={isExpired ? "filled" : "light"}
                            >
                              {
                                new Date(log.expiry_date)
                                  .toISOString()
                                  .split("T")[0]
                              }
                            </Badge>
                          ) : (
                            <Text size="10px" c="dimmed">
                              —
                            </Text>
                          )}
                        </TD>
                        <TD>
                          <Group gap={3} wrap="nowrap">
                            <Badge size="xs" color="gray" variant="outline">
                              {log.gudang?.name || "—"}
                            </Badge>
                            {log.gudang_tujuan && (
                              <>
                                <Text size="9px">→</Text>
                                <Badge size="xs" color="teal">
                                  {log.gudang_tujuan.name}
                                </Badge>
                              </>
                            )}
                          </Group>
                        </TD>
                        <TD style={{ whiteSpace: "nowrap" }}>
                          <Text size="10px" c="dimmed">
                            {log.tanggal_income || fmt(log.created_at)}
                          </Text>
                        </TD>
                        <TD
                          style={{
                            maxWidth: 130,
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          <Text size="10px">
                            {log.supplier || log.tujuan || "—"}
                          </Text>
                        </TD>
                        <TD
                          style={{
                            maxWidth: 110,
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          <Text size="10px" c="dimmed">
                            {log.note || "—"}
                          </Text>
                        </TD>
                      </Box>
                    );
                  })}
                  {filteredLogs.length === 0 && (
                    <Box component="tr">
                      <Box
                        component="td"
                        colSpan={11}
                        style={{ padding: 28, textAlign: "center" }}
                      >
                        <Stack align="center" gap={4}>
                          <IconSearch size={24} color="#ced4da" />
                          <Text size="xs" c="dimmed">
                            Tidak ada data mutasi ditemukan.
                          </Text>
                        </Stack>
                      </Box>
                    </Box>
                  )}
                </Box>
              </Box>
            </Box>

            {filteredLogs.length > 15 && (
              <Box
                mt={6}
                style={{
                  background: "#f8f9fa",
                  borderRadius: 6,
                  padding: "5px 10px",
                }}
              >
                <Text size="10px" c="dimmed" ta="center">
                  ⚠️ Menampilkan <strong>15</strong> dari{" "}
                  <strong>{filteredLogs.length}</strong> transaksi. Gunakan{" "}
                  <strong>Export CSV</strong> untuk data lengkap.
                </Text>
              </Box>
            )}
          </Paper>
        </Stack>
      </Box>
    </Box>
  );
}