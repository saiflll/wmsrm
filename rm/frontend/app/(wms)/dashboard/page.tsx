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
import OFTITab from "./components/OFTITab";
import SerapanTab from "./components/SerapanTab";
import OccupancyTab from "./components/OccupancyTab";
import ReportTab from "./components/ReportTab";
import StatsRow from "./components/StatsRow";
import { SectionHeader, TH, TD } from "./components/Helpers";


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
/* ─────────────────────────── Table Cell ─────────────────────────── */


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

  // Sorting for Mutasi Terbaru table
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  const handleSort = (key: string) => {
    if (sortKey === key) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  const sortIcon = (key: string) => {
    if (sortKey !== key) return " ↕";
    return sortDir === "asc" ? " ▲" : " ▼";
  };

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
    let result = logs;
    if (tableSearch) {
      const q = tableSearch.toLowerCase();
      result = logs.filter(
        (log) =>
          (log.no_po && log.no_po.toLowerCase().includes(q)) ||
          (log.no_ref && log.no_ref.toLowerCase().includes(q)) ||
          (log.barang?.nama && log.barang.nama.toLowerCase().includes(q)) ||
          (log.supplier && log.supplier.toLowerCase().includes(q)) ||
          (log.tujuan && log.tujuan.toLowerCase().includes(q)) ||
          (log.gudang?.name && log.gudang.name.toLowerCase().includes(q)),
      );
    }

    if (sortKey) {
      result = [...result].sort((a, b) => {
        let valA = a[sortKey];
        let valB = b[sortKey];
        if (sortKey === "barang.nama") {
          valA = a.barang?.nama || "";
          valB = b.barang?.nama || "";
        } else if (sortKey === "gudang.name") {
          valA = a.gudang?.name || "";
          valB = b.gudang?.name || "";
        } else if (sortKey === "supplier") {
          valA = a.supplier || a.tujuan || "";
          valB = b.supplier || b.tujuan || "";
        }
        if (typeof valA === "number" && typeof valB === "number") {
          return sortDir === "asc" ? valA - valB : valB - valA;
        }
        return sortDir === "asc"
          ? String(valA || "").localeCompare(String(valB || ""))
          : String(valB || "").localeCompare(String(valA || ""));
      });
    }

    return result;
  }, [logs, tableSearch, sortKey, sortDir]);

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
      "Tipe,No PO/Ref,Item,Qty,Satuan,Batch,Expired,Rak,Tanggal,Supplier/Tujuan,Keterangan,Dieksekusi Oleh",
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
            log.expiry_date && !isNaN(new Date(log.expiry_date).getTime())
              ? new Date(log.expiry_date).toISOString().split("T")[0]
              : log.expiry_date || "-",
            log.gudang?.name || "-",
            log.tanggal_income || fmt(log.created_at),
            log.supplier || log.tujuan || "-",
            log.note || "-",
            log.user?.username || "sistem",
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
          padding: "10px 16px",
          marginBottom: 10,
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
      </Box>

      {/* ════════ OVERVIEW GRID (Nav Panel + KPIs) ════════ */}
      <Box px="md">
        <Box style={{ display: "grid", gridTemplateColumns: "190px minmax(0, 1fr)", gap: 12, alignItems: "stretch", marginBottom: 10 }}>
          {/* Nav Panel Left */}
          <Paper withBorder p="xs" radius="md" style={{ background: "#fff", boxShadow: "0 1px 6px rgba(0,0,0,0.04)" }}>
            <Text size="9px" c="dimmed" fw={900} style={{ letterSpacing: "0.5px", textTransform: "uppercase" }} mb={6}>
              NAVIGASI DASHBOARD
            </Text>
            <Box style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 4 }}>
              {TABS.map((tab) => {
                const Icon = tab.icon;
                const active = activeTab === tab.key;
                return (
                  <Button
                    key={tab.key}
                    size="xs"
                    variant={active ? "filled" : "outline"}
                    color={active ? "blue" : "gray"}
                    onClick={() => setActiveTab(tab.key)}
                    style={{
                      minHeight: 36,
                      fontSize: 10,
                      fontWeight: 900,
                      padding: "4px 2px",
                      whiteSpace: "normal",
                      lineHeight: 1.1,
                      textAlign: "center"
                    }}
                  >
                    {tab.label}
                  </Button>
                );
              })}
            </Box>
          </Paper>

          {/* KPIs Right */}
          <StatsRow stats={s} />
        </Box>
      </Box>

      {/* ════════ TAB CONTENT ════════ */}
      <Box p="md" pt={0} className={activeTab === "occupancy" ? "custom-scroll-blue" : activeTab === "ofti" ? "custom-scroll-green" : activeTab === "serapan" ? "custom-scroll-purple" : "custom-scroll-orange"}>
        <Stack gap="sm">
                    {/* ── OCCUPANCY tab ── */}
          {activeTab === "occupancy" && (
            <OccupancyTab 
                occupancyData={occupancyData}
                selectedZone={selectedZone}
                handleZoneClick={handleZoneClick}
                setSelectedZone={setSelectedZone}
                loadOccupancy={loadOccupancy}
                tableSearch={tableSearch}
                setTableSearch={setTableSearch}
                OccupancyGauge={OccupancyGauge}
              />
          )}

          {/* ── OFTI tab ── */}
          {activeTab === "ofti" && (
            <OFTITab oftiData={oftiData} />
          )}

          {/* ── SERAPAN tab ── */}
          {activeTab === "serapan" && (
            <SerapanTab serapanData={serapanData} />
          )}

          {/* ── REPORT tab ── */}
          {activeTab === "report" && (
            <ReportTab 
                reportData={reportData}
                ReportChart={ReportChart}
              />
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
                    background: "#f1f5f9",
                    borderBottom: "2px solid #cbd5e1",
                    position: "sticky",
                    top: 0,
                    zIndex: 1,
                  }}
                >
                  <Box component="tr">
                    {[
                      { label: "Tipe", key: "type" },
                      { label: "No PO/Ref", key: "no_po" },
                      { label: "Item", key: "barang.nama" },
                      { label: "Qty", key: "qty" },
                      { label: "Satuan", key: "satuan" },
                      { label: "Batch", key: "batch_no" },
                      { label: "Expired", key: "expiry_date" },
                      { label: "Rak", key: "gudang.name" },
                      { label: "Tanggal", key: "created_at" },
                      { label: "Supplier/Tujuan", key: "supplier" },
                      { label: "Ket", key: "keterangan" },
                    ].map((col) => (
                      <TH
                        key={col.label}
                        right={col.label === "Qty"}
                        color="#334155"
                        style={{ cursor: "pointer" }}
                        onClick={() => handleSort(col.key)}
                      >
                        {col.label}
                        {sortIcon(col.key)}
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
                          {(() => {
                            if (!log.expiry_date) return <Text size="10px" c="dimmed">—</Text>;
                            const d = new Date(log.expiry_date);
                            if (isNaN(d.getTime())) return <Text size="10px">{String(log.expiry_date)}</Text>;
                            const isExp = d < new Date();
                            return (
                              <Badge
                                size="xs"
                                color={isExp ? "red" : "teal"}
                                variant={isExp ? "filled" : "light"}
                              >
                                {d.toISOString().split("T")[0]}
                              </Badge>
                            );
                          })()}
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





