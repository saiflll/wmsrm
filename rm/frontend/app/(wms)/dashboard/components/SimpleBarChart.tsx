// @ts-nocheck
'use client';

import React, { useState } from 'react';
import { Box, Text } from '@mantine/core';
import { useContainerWidth, useBarAnimation, labelRotationFor } from './chartUtils';
import { ChartLegend } from './ChartLegend';
import { ChartTooltip } from './ChartTooltip';

export default function SimpleBarChart({ series, labels }: { series: any[], labels: any[] }) {
  const [containerRef, containerWidth] = useContainerWidth(760);
  const [tooltip, setTooltip] = useState<any>(null);
  const dataSignature = JSON.stringify([
    series?.map((s) => s.data),
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
  const maxVal = Math.max(...series.flatMap((s) => s.data), 1);

  const groupW = chartW / nGroups;
  const barW = Math.min(
    maxBarW,
    Math.max(minBarW, (groupW - groupGap - (nSeries - 1) * gap) / nSeries),
  );
  const rotation = labelRotationFor(groupW);

  return (
    <Box ref={containerRef} style={{ position: 'relative', width: '100%', overflowX: 'auto' }}>
      <svg
        width={totalW}
        height={height}
        viewBox={`0 0 ${totalW} ${height}`}
        style={{ display: 'block', overflow: 'visible' }}
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
                stroke={p === 0 || p === 1 ? '#ced4da' : '#e9ecef'}
                strokeDasharray={p === 0 || p === 1 ? 'none' : '4,4'}
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
        {labels.map((l, wIdx) => {
          const gx = pad.left + wIdx * groupW;
          const gCenter = gx + groupW / 2;
          return (
            <g key={l.key ?? wIdx}>
              {series.map((s, sIdx) => {
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
                    key={s.label as string}
                    x={bx}
                    y={by}
                    width={barW}
                    height={h}
                    rx={3}
                    fill={s.color}
                    opacity={0.88}
                    style={{
                      transition:
                        'height 550ms cubic-bezier(.4,0,.2,1), y 550ms cubic-bezier(.4,0,.2,1)',
                      cursor: 'pointer',
                    }}
                    onMouseEnter={(e) => {
                      if(!containerRef.current) return;
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
                      if(!containerRef.current) return;
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
                textAnchor={rotation ? 'end' : 'middle'}
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
}
