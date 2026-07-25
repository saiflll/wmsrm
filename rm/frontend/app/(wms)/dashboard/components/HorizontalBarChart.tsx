// @ts-nocheck
'use client';

import React, { useState } from 'react';
import { Box, Text } from '@mantine/core';
import { useContainerWidth, useBarAnimation, percentage } from './chartUtils';
import { ChartLegend } from './ChartLegend';
import { ChartTooltip } from './ChartTooltip';

export default function HorizontalBarChart({
  data,
  leftKey,
  rightKey,
  leftColor,
  rightColor,
}: {
  data: any[];
  leftKey: string;
  rightKey: string;
  leftColor: string;
  rightColor: string;
}) {
  const [containerRef, containerWidth] = useContainerWidth(760);
  const [tooltip, setTooltip] = useState<any>(null);
  const dataSignature = JSON.stringify(
    data?.map((d) => [d[leftKey], d[rightKey]]),
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
    <Box ref={containerRef} style={{ position: 'relative', width: '100%', overflowX: 'auto' }}>
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        style={{ display: 'block', overflow: 'visible' }}
      >
        <line
          x1={pad.left + chartW / 2}
          y1={pad.top}
          x2={pad.left + chartW / 2}
          y2={height - pad.bottom}
          stroke="#dee2e6"
          strokeDasharray="3,3"
        />
        {data.map((d, i) => {
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
                  transition: 'width 550ms cubic-bezier(.4,0,.2,1)',
                  cursor: 'pointer',
                }}
                onMouseEnter={(e) => {
                  if(!containerRef.current) return;
                  const rect = containerRef.current.getBoundingClientRect();
                  setTooltip({
                    x: e.clientX - rect.left,
                    y: e.clientY - rect.top,
                    title: d.week,
                    lines: [
                      {
                        label: 'On Time',
                        value: `${d[leftKey] ?? 0} (${leftPct}%)`,
                        color: leftColor,
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
              <rect
                x={pad.left + chartW / 2 + 4}
                y={y + 4}
                width={rightW}
                height={18}
                rx={3}
                fill={rightColor}
                opacity={0.85}
                style={{
                  transition: 'width 550ms cubic-bezier(.4,0,.2,1)',
                  cursor: 'pointer',
                }}
                onMouseEnter={(e) => {
                  if(!containerRef.current) return;
                  const rect = containerRef.current.getBoundingClientRect();
                  setTooltip({
                    x: e.clientX - rect.left,
                    y: e.clientY - rect.top,
                    title: d.week,
                    lines: [
                      {
                        label: 'Late',
                        value: `${d[rightKey] ?? 0} (${rightPct}%)`,
                        color: rightColor,
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
              {leftPct > 0 && (
                <text
                  x={pad.left + chartW / 2 - 8}
                  y={y + 16}
                  textAnchor="end"
                  fontSize={9}
                  fill="#fff"
                  fontWeight={700}
                  style={{ pointerEvents: 'none' }}
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
                  style={{ pointerEvents: 'none' }}
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
          { label: 'On Time / OTIF', color: leftColor },
          { label: 'Late / NOT OTIF', color: rightColor },
        ]}
      />
      <ChartTooltip tooltip={tooltip} />
    </Box>
  );
}
