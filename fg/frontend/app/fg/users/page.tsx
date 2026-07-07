"use client";
import { useState, useEffect } from "react";
import {
  Title,
  Table,
  Button,
  Group,
  TextInput,
  Modal,
  Stack,
  Select,
  Badge,
  Text,
  Box,
  Paper,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";
import { IconUsers, IconPlus, IconTrash } from "@tabler/icons-react";
import api from "../lib/api";

export default function UsersPage() {
  const [list, setList] = useState<any[]>([]);
  const [opened, { open, close }] = useDisclosure(false);
  const [form, setForm] = useState<any>({
    username: "",
    password: "",
    namaUser: "",
    role: "KOORDINATOR_IN",
    status: "AKTIF",
  });
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [filterRole, setFilterRole] = useState<string | null>(null);

  const sortData = (data: any[], key: string | null, dir: "asc" | "desc") => {
    if (!key) return data;
    return [...data].sort((a, b) => {
      let aVal = a[key];
      let bVal = b[key];
      if (aVal == null) aVal = "";
      if (bVal == null) bVal = "";
      if (typeof aVal === "number" && typeof bVal === "number") {
        return dir === "asc" ? aVal - bVal : bVal - aVal;
      }
      const cmp = String(aVal).localeCompare(String(bVal), undefined, { numeric: true });
      return dir === "asc" ? cmp : -cmp;
    });
  };

  const columns = [
    { label: "Username", key: "username" },
    { label: "Nama", key: "namaUser" },
    { label: "Role", key: "role" },
    { label: "Status", key: "status" },
  ];

  const load = () => {
    api
      .get("/users")
      .then((res: any) => setList(res || []))
      .catch(() => {});
  };
  useEffect(() => {
    load();
  }, []);

  const handleSave = async () => {
    try {
      await api.post("/users", form);
      notifications.show({
        title: "Berhasil",
        message: "User ditambahkan",
        color: "green",
      });
      close();
      setForm({
        username: "",
        password: "",
        namaUser: "",
        role: "KOORDINATOR_IN",
        status: "AKTIF",
      });
      load();
    } catch (err: any) {
      notifications.show({
        title: "Gagal",
        message: err.response?.data?.message || "Error",
        color: "red",
      });
    }
  };

  const handleDelete = async (id: number) => {
    await api.delete(`/users/${id}`);
    load();
  };

  const roleOpts = [...new Set(list.map((u) => u.role).filter(Boolean))].sort();
  const filteredList = list.filter((u) => !filterRole || u.role === filterRole);

  return (
    <Box>
      {/* Header */}
      <Box
        style={{
          background: "#fff",
          borderLeft: "4px solid #6366f1",
          padding: "14px 20px",
          marginBottom: 16,
          borderRadius: 8,
          boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
        }}
      >
        <Group justify="space-between">
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
              <IconUsers size={20} style={{ color: "#6366f1" }} />
              USER MANAGEMENT
            </Title>
            <Text size="xs" c="dimmed" mt={2}>
              Kelola pengguna sistem dan hak akses.
            </Text>
          </Box>
          <Badge color="indigo" variant="light" size="lg">
            Users
          </Badge>
        </Group>
      </Box>

      <Paper withBorder p="md" radius="md">
        <Group mb="md">
          <Button
            size="xs"
            leftSection={<IconPlus size={14} />}
            onClick={open}
          >
            + Tambah User
          </Button>
          <Select
            size="xs"
            placeholder="Filter Role"
            clearable
            searchable
            data={roleOpts}
            value={filterRole}
            onChange={setFilterRole}
            style={{ width: 180 }}
          />
        </Group>
        <Box style={{ maxHeight: 500, overflow: "auto" }}>
          <Table striped style={{ fontSize: 11 }}>
            <Table.Thead
              style={{
                background: "#111827",
                position: "sticky",
                top: 0,
                zIndex: 1,
              }}
            >
              <Table.Tr>
                {columns.map((c) => (
                  <Table.Th
                    key={c.key}
                    style={{ cursor: "pointer", userSelect: "none", color: "#fff", fontSize: 11 }}
                    onClick={() => {
                      if (sortKey === c.key) {
                        setSortDir((d) => (d === "asc" ? "desc" : "asc"));
                      } else {
                        setSortKey(c.key);
                        setSortDir("asc");
                      }
                    }}
                  >
                    {c.label}{sortKey !== c.key ? " ↕" : sortDir === "asc" ? " ▲" : " ▼"}
                  </Table.Th>
                ))}
                <Table.Th style={{ color: "#fff", fontSize: 11 }}>Aksi</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {sortData(filteredList, sortKey, sortDir).map((u: any) => (
                <Table.Tr key={u.id}>
                  <Table.Td fw={700}>{u.username}</Table.Td>
                  <Table.Td>{u.namaUser}</Table.Td>
                  <Table.Td>
                    <Badge size="xs" variant="light">
                      {u.role}
                    </Badge>
                  </Table.Td>
                  <Table.Td>
                    <Badge
                      size="xs"
                      color={u.status === "AKTIF" ? "green" : "red"}
                    >
                      {u.status}
                    </Badge>
                  </Table.Td>
                  <Table.Td>
                    <Button
                      size="xs"
                      color="red"
                      variant="subtle"
                      leftSection={<IconTrash size={12} />}
                      onClick={() => handleDelete(u.id)}
                    >
                      Hapus
                    </Button>
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </Box>
      </Paper>

      <Modal
        opened={opened}
        onClose={close}
        title={<Text fw={900}>Tambah User</Text>}
        centered
      >
        <Stack>
          <TextInput
            size="xs"
            label="Username"
            value={form.username}
            onChange={(e) => setForm({ ...form, username: e.currentTarget.value })}
            required
          />
          <TextInput
            size="xs"
            label="Password"
            type="password"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.currentTarget.value })}
            required
          />
          <TextInput
            size="xs"
            label="Nama User"
            value={form.namaUser}
            onChange={(e) => setForm({ ...form, namaUser: e.currentTarget.value })}
            required
          />
          <Select
            size="xs"
            label="Role"
            data={[
              "KOORDINATOR_IN",
              "KOORDINATOR_OUT",
              "INVENTORY",
              "QUALITY_CONTROL",
              "SUPERVISOR",
              "ADMIN",
            ]}
            value={form.role}
            onChange={(v) => setForm({ ...form, role: v })}
            required
          />
          <Button size="xs" onClick={handleSave}>
            Simpan
          </Button>
        </Stack>
      </Modal>
    </Box>
  );
}
