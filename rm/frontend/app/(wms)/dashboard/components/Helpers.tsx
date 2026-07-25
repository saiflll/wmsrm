'use client';

import React from 'react';
import { Group, Box, Text } from '@mantine/core';

export const SectionHeader = ({
  icon: Icon,
  accent,
  bg,
  title,
  sub,
  right,
}: {
  icon: any;
  accent: string;
  bg: string;
  title: string;
  sub?: string;
  right?: React.ReactNode;
}) => (
  <Group justify="space-between" mb={8} wrap="nowrap">
    <Group gap={8} wrap="nowrap">
      <Box
        style={{ background: bg, borderRadius: 7, padding: 5, flexShrink: 0 }}
      >
        <Icon size={16} color={accent} />
      </Box>
      <Box>
        <Text size="sm" fw={800} style={{ color: '#1a1a2e', lineHeight: 1.2 }}>
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

export const TH = ({
  children,
  right = false,
  color = '#2b2c40',
  style = {},
}: {
  children: React.ReactNode;
  right?: boolean;
  color?: string;
  style?: React.CSSProperties;
}) => (
  <Box
    component="th"
    style={{
      color: color,
      fontSize: 10,
      fontWeight: 800,
      padding: '10px 12px',
      textAlign: right ? 'right' : 'left',
      letterSpacing: '0.06em',
      textTransform: 'uppercase',
      whiteSpace: 'nowrap',
      borderBottom: '2px solid #e9ecef',
      ...style,
    }}
  >
    {children}
  </Box>
);

export const TD = ({
  children,
  right = false,
  style = {},
}: {
  children: React.ReactNode;
  right?: boolean;
  style?: React.CSSProperties;
}) => (
  <Box
    component="td"
    style={{
      padding: '6px 10px',
      fontSize: 11,
      textAlign: right ? 'right' : 'left',
      borderBottom: '1px solid #f1f3f5',
      ...style,
    }}
  >
    {children}
  </Box>
);
