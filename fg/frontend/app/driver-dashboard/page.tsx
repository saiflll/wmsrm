"use client";
import { useState, useEffect, Suspense } from "react";
import {
  Title,
  Card,
  Table,
  Group,
  TextInput,
  Button,
  Stack,
  Text,
  Badge,
  Textarea,
  Select,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { useSearchParams } from "next/navigation";
import api from "../fg/lib/api";

function DriverDashboardContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token") || "";
  const [otdr, setOtdr] = useState<any>(null);
  const [form, setForm] = useState({
    statusTerima: "",
    namaPenerima: "",
    namaChecker: "",
    statusChecker: "",
    linkBuktiFoto: "",
    catatanBuktiTerima: "",
  });

  useEffect(() => {
    if (token) {
      api
        .get(`/driver-dashboard?token=${token}`)
        .then((res: any) => setOtdr(res))
        .catch(() => {
          notifications.show({
            title: "Error",
            message: "Token tidak valid",
            color: "red",
          });
        });
    }
  }, [token]);

  const handleSubmit = async () => {
    try {
      await api.post("/driver-dashboard/evidence", { ...form, token });
      notifications.show({
        title: "Berhasil",
        message: "Bukti terima berhasil dikirim",
        color: "green",
      });
    } catch (err: any) {
      notifications.show({
        title: "Gagal",
        message: err.response?.data?.message || "Error",
        color: "red",
      });
    }
  };

  if (!token)
    return (
      <Card>
        <Text>Token dashboard sopir tidak ditemukan.</Text>
      </Card>
    );
  if (!otdr)
    return (
      <Card>
        <Text>Loading...</Text>
      </Card>
    );

  return (
    <Stack p="md" gap="md">
      <Title order={3}>Dashboard Bukti Terima Sopir</Title>
      <Card shadow="sm" padding="lg" radius="md">
        <Title order={4} mb="md">
          Detail Pengiriman
        </Title>
        <Group gap="xl">
          <div>
            <Text size="sm" c="dimmed">
              ID OTDR
            </Text>
            <Text fw={700}>{otdr.idOtdr}</Text>
          </div>
          <div>
            <Text size="sm" c="dimmed">
              Tanggal
            </Text>
            <Text>{otdr.tanggalDimuat}</Text>
          </div>
          <div>
            <Text size="sm" c="dimmed">
              Resto
            </Text>
            <Text>
              {otdr.kodeResto} - {otdr.namaResto}
            </Text>
          </div>
          <div>
            <Text size="sm" c="dimmed">
              Nopol
            </Text>
            <Text>{otdr.nopol}</Text>
          </div>
          <div>
            <Text size="sm" c="dimmed">
              Surat Jalan
            </Text>
            <Text>{otdr.nomorSuratJalan}</Text>
          </div>
          <div>
            <Text size="sm" c="dimmed">
              Total Item
            </Text>
            <Text>
              {otdr.totalItemOutput} ({otdr.totalQtyOutput} qty)
            </Text>
          </div>
          <div>
            <Text size="sm" c="dimmed">
              Status
            </Text>
            <Badge color={otdr.statusOtdr === "COMPLETE" ? "green" : "blue"}>
              {otdr.statusOtdr}
            </Badge>
          </div>
        </Group>
      </Card>

      {otdr.statusOtdr !== "COMPLETE" && (
        <Card shadow="sm" padding="lg" radius="md">
          <Title order={4} mb="md">
            Form Bukti Terima
          </Title>
          <Stack>
            <Select
              label="Status Terima"
              data={["DITERIMA", "TIDAK DITERIMA"]}
              value={form.statusTerima}
              onChange={(v) => setForm({ ...form, statusTerima: v || "" })}
              required
            />
            <TextInput
              label="Nama Penerima"
              value={form.namaPenerima}
              onChange={(e) =>
                setForm({ ...form, namaPenerima: e.currentTarget.value })
              }
              required
            />
            <TextInput
              label="Nama Checker"
              value={form.namaChecker}
              onChange={(e) =>
                setForm({ ...form, namaChecker: e.currentTarget.value })
              }
            />
            <Select
              label="Status Checker"
              data={["SESUAI", "TIDAK SESUAI"]}
              value={form.statusChecker}
              onChange={(v) => setForm({ ...form, statusChecker: v || "" })}
            />
            <TextInput
              label="Link Bukti Foto"
              value={form.linkBuktiFoto}
              onChange={(e) =>
                setForm({ ...form, linkBuktiFoto: e.currentTarget.value })
              }
            />
            <Textarea
              label="Catatan"
              value={form.catatanBuktiTerima}
              onChange={(e) =>
                setForm({ ...form, catatanBuktiTerima: e.currentTarget.value })
              }
            />
            <Button onClick={handleSubmit}>Kirim Bukti Terima</Button>
          </Stack>
        </Card>
      )}
    </Stack>
  );
}

export default function DriverDashboardPage() {
  return (
    <Suspense fallback={<Text>Loading...</Text>}>
      <DriverDashboardContent />
    </Suspense>
  );
}
