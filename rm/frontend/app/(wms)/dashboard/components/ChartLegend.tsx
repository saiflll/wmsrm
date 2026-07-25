'use client';
import { Group, Box, Text } from '@mantine/core';

export const ChartLegend = ({ series }: { series: any[] }) => {
  if (!series?.length) return null;
  return (
    <Group gap={14} mt={8} wrap="wrap" justify="center">
      {series.map((s) => (
        <Group key={s.label as string} gap={5} wrap="nowrap">
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
