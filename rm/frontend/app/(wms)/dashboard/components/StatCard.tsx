// @ts-nocheck
'use client';

import { Paper, Group, Text, RingProgress, Center } from '@mantine/core';
import { ReactNode } from 'react';

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  color?: string;
  icon?: ReactNode;
  progress?: number;
}

export default function StatCard({ title, value, subtitle, color = 'blue', icon, progress }: StatCardProps) {
  return (
    <Paper withBorder p="md" radius="md" style={{ flex: 1, minWidth: 160 }}>
      <Group justify="space-between" mb="xs">
        <Text size="xs" c="dimmed" fw={700}>{title}</Text>
        {icon}
      </Group>
      <Text fw={800} size="xl" style={{ color }}>
        {value}
      </Text>
      {subtitle && <Text size="xs" c="dimmed" mt={4}>{subtitle}</Text>}
      {progress !== undefined && (
        <RingProgress size={60} thickness={4} sections={[{ value: progress, color }]} />
      )}
    </Paper>
  );
}