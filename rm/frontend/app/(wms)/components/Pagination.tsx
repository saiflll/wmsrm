'use client';
import { Group, Button, Text } from '@mantine/core';
import { IconChevronLeft, IconChevronRight } from '@tabler/icons-react';

interface PaginationProps {
  page: number;
  totalPages: number;
  total: number;
  onPageChange: (page: number) => void;
}

export default function Pagination({ page, totalPages, total, onPageChange }: PaginationProps) {
  if (totalPages <= 1) return null;
  return (
    <Group justify="space-between" mt="md">
      <Text size="sm" c="dimmed">Total {total} data</Text>
      <Group gap="xs">
        <Button
          variant="light" size="xs"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
          leftSection={<IconChevronLeft size={14} />}
        >
          Sebelumnya
        </Button>
        <Text size="sm" c="dimmed" mx="xs">{page} / {totalPages}</Text>
        <Button
          variant="light" size="xs"
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
          rightSection={<IconChevronRight size={14} />}
        >
          Selanjutnya
        </Button>
      </Group>
    </Group>
  );
}
