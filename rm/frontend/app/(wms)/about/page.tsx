// @ts-nocheck
"use client";
import React from "react";
import { Box, UnstyledButton } from "@mantine/core";
import {
  IconMail,
  IconArrowUpRight,
  IconPackage,
  IconTruck,
  IconBarcode,
  IconClipboardList,
  IconBoxSeam,
} from "@tabler/icons-react";

const FLOATERS = [
  { Icon: IconPackage, top: "8%", left: "6%", size: 46, dur: "9s", delay: "0s", rot: -8 },
  { Icon: IconBarcode, top: "18%", left: "88%", size: 40, dur: "7.5s", delay: "0.4s", rot: 6 },
  { Icon: IconTruck, top: "48%", left: "3%", size: 52, dur: "10s", delay: "1.2s", rot: 4 },
  { Icon: IconClipboardList, top: "72%", left: "90%", size: 42, dur: "8.5s", delay: "0.8s", rot: -5 },
  { Icon: IconBoxSeam, top: "85%", left: "10%", size: 38, dur: "11s", delay: "0.2s", rot: 10 },
  { Icon: IconPackage, top: "62%", left: "94%", size: 30, dur: "6.5s", delay: "1.6s", rot: 12 },
];

export default function AboutPage() {
  const version = process.env.NEXT_PUBLIC_APP_VERSION || "1.1.9";
  const supportEmail = "lezztb@gmail.com";
  const mailtoHref = `mailto:${supportEmail}?subject=${encodeURIComponent(
    "DW (Digitalisation Warehouse) – Masukan & Dukungan"
  )}`;

  return (
    <Box
      p="md"
      style={{
        minHeight: "100vh",
        background: "#ffffff",
        position: "relative",
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "center",
        overflow: "hidden",
      }}
    >
      {/* Ambient floating icons */}
      {FLOATERS.map(({ Icon, top, left, size, dur, delay, rot }, i) => (
        <span
          key={i}
          className="floater"
          style={{
            top,
            left,
            animationDuration: dur,
            animationDelay: delay,
            "--rot": `${rot}deg`,
          }}
          aria-hidden="true"
        >
          <Icon size={size} stroke={1.4} />
        </span>
      ))}

      <div className="manifest">
        <div className="perf-row" aria-hidden="true">
          {Array.from({ length: 26 }).map((_, i) => (
            <span key={i} className="perf-dot" />
          ))}
        </div>

        {/* Header */}
        <div className="manifest-head">
          <div className="head-left">
            <span className="eyebrow">PROFIL SISTEM</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 0, marginTop: 8 }}>
              <img src="/dw_logo.png" alt="DW Logo" style={{ height: 45, margin: 0, padding: '0 6px', objectFit: 'contain', display: 'block' }} />
              <div style={{ width: 2, height: 28, background: '#0ea5e9', margin: '0 10px' }} />
              <span style={{ fontSize: 24, fontWeight: 900, color: '#0ea5e9', letterSpacing: '0.05em' }}>
                RM
              </span>
            </div>
            <span className="sub" style={{ marginTop: 8 }}>
              Raw Material — Digitalisation Warehouse
            </span>
          </div>
          <div className="stamp" aria-hidden="true">
            <span>SISTEM</span>
            <span className="stamp-sub">DAPAT DIANDALKAN</span>
          </div>
        </div>

        <div className="tear-line" aria-hidden="true" />

        {/* Description */}
        <div className="field">
          <span className="field-label">RINGKASAN SISTEM</span>
          <p className="field-value">
            <b>DW (Digitalisation Warehouse)</b> adalah sistem manajemen gudang modern yang dirancang untuk mengintegrasikan seluruh siklus operasional pergudangan secara real-time. Sistem ini mencakup perencanaan & penerimaan barang masuk (Inbound), reservasi serta pemrosesan pengeluaran barang (Outbound & Picking Plan), relokasi stok antar-rak berbasis Batch & Expiry Date (FEFO), hingga audit Stock Opname visual 3D dan laporan analitik berakurasi tinggi.
          </p>
        </div>

        <div className="tear-line" aria-hidden="true" />

        {/* Team */}
        <div className="field">
          <span className="field-label">SUSUNAN TIM & PENGEMBANG</span>

          <div className="entry">
            <span className="entry-no">01</span>
            <div className="entry-body">
              <span className="entry-role">Grup Pengembang</span>
              <span className="entry-name">UTKRAVA</span>
              <span className="entry-meta">Freelance Software Development</span>
            </div>
          </div>

          <a
            href={mailtoHref}
            className="entry entry--link"
            style={{ textDecoration: 'none', color: 'inherit' }}
            title="Kirim Email ke lezztb@gmail.com"
          >
            <span className="entry-no">02</span>
            <div className="entry-body">
              <span className="entry-role">Lead Developer</span>
              <span className="entry-name">
                RENAGGE39
                <IconArrowUpRight size={14} className="entry-arrow" />
              </span>
              <span className="entry-meta">
                <IconMail size={11} style={{ marginRight: 4 }} />
                lezztb@gmail.com (Klik untuk kirim masukan / dukungan)
              </span>
            </div>
          </a>
        </div>

        {/* Footer */}
        <div className="manifest-foot">
          <span>BUILD {version}</span>
          <span className="dot">•</span>
          <span>DIGITALISATION WAREHOUSE SYSTEM</span>
        </div>
      </div>

      <style jsx global>{`
        .floater {
          position: absolute;
          color: #cbd5e1;
          opacity: 0.55;
          animation-name: floatY;
          animation-timing-function: ease-in-out;
          animation-iteration-count: infinite;
          pointer-events: none;
          z-index: 0;
          transform: rotate(var(--rot));
        }

        @keyframes floatY {
          0%,
          100% {
            transform: translateY(0) rotate(var(--rot));
          }
          50% {
            transform: translateY(-16px) rotate(var(--rot));
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .floater {
            animation: none;
          }
        }

        .manifest {
          width: 100%;
          max-width: 640px;
          background: #ffffff;
          border: 1px solid #e5e7eb;
          box-shadow: 0 20px 45px rgba(15, 23, 42, 0.08);
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
          position: relative;
          z-index: 1;
          overflow: hidden;
        }

        .perf-row {
          display: flex;
          justify-content: space-between;
          padding: 0 14px;
          background: #f8fafc;
        }
        .perf-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: #ffffff;
          border: 1px solid #e5e7eb;
          transform: translateY(4px);
        }

        .manifest-head {
          background: #f8fafc;
          color: #111827;
          padding: 26px 28px 22px;
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 12px;
          border-bottom: 1px solid #e5e7eb;
        }
        .eyebrow {
          font-size: 11px;
          letter-spacing: 0.18em;
          color: #c6791e;
          font-weight: 700;
          font-family: "Courier New", monospace;
        }
        .title {
          margin: 6px 0 4px;
          font-size: 34px;
          font-weight: 800;
          letter-spacing: -0.02em;
          line-height: 1;
          color: #111827;
        }
        .sub {
          display: block;
          font-size: 12.5px;
          color: #6b7280;
        }

        .stamp {
          border: 2px solid #c6791e;
          color: #c6791e;
          border-radius: 6px;
          padding: 8px 12px;
          display: flex;
          flex-direction: column;
          align-items: center;
          transform: rotate(-6deg);
          font-family: "Courier New", monospace;
          font-weight: 800;
          letter-spacing: 0.08em;
          font-size: 13px;
          flex-shrink: 0;
          opacity: 0.9;
        }
        .stamp-sub {
          font-size: 9px;
          letter-spacing: 0.1em;
          opacity: 0.8;
        }

        .tear-line {
          height: 0;
          border-top: 2px dashed #e5e7eb;
          margin: 0 28px;
        }

        .field {
          padding: 20px 28px;
        }
        .field-label {
          display: block;
          font-size: 10.5px;
          letter-spacing: 0.14em;
          color: #9ca3af;
          font-weight: 700;
          font-family: "Courier New", monospace;
          margin-bottom: 10px;
        }
        .field-value {
          font-size: 14px;
          line-height: 1.7;
          color: #374151;
          margin: 0;
        }

        .entry {
          display: flex;
          gap: 14px;
          align-items: flex-start;
          padding: 12px 0;
          border-bottom: 1px solid #f1f5f9;
          text-align: left;
        }
        .entry:last-child {
          border-bottom: none;
        }
        .entry-no {
          font-family: "Courier New", monospace;
          font-size: 12px;
          color: #c6791e;
          font-weight: 700;
          padding-top: 2px;
          flex-shrink: 0;
        }
        .entry-body {
          display: flex;
          flex-direction: column;
        }
        .entry-role {
          font-size: 11px;
          color: #9ca3af;
          font-weight: 600;
        }
        .entry-name {
          font-size: 17px;
          font-weight: 800;
          color: #111827;
          display: flex;
          align-items: center;
          gap: 4px;
        }
        .entry-meta {
          font-size: 11.5px;
          color: #9ca3af;
          display: flex;
          align-items: center;
          margin-top: 2px;
        }
        .entry-arrow {
          color: #9ca3af;
          transition: transform 120ms ease, color 120ms ease;
        }
        .entry--link {
          width: 100%;
          cursor: pointer;
          transition: background 120ms ease;
        }
        .entry--link:hover {
          background: #f9fafb;
        }
        .entry--link:hover .entry-arrow {
          transform: translate(2px, -2px);
          color: #c6791e;
        }

        .manifest-foot {
          background: #f8fafc;
          padding: 12px 28px;
          font-family: "Courier New", monospace;
          font-size: 10.5px;
          letter-spacing: 0.06em;
          color: #9ca3af;
          display: flex;
          gap: 8px;
          border-top: 1px solid #e5e7eb;
        }
        .dot {
          opacity: 0.6;
        }

        @media (max-width: 480px) {
          .title {
            font-size: 26px;
          }
          .manifest-head {
            flex-direction: column;
          }
          .stamp {
            align-self: flex-end;
          }
          .floater {
            display: none;
          }
        }
      `}</style>
    </Box>
  );
}