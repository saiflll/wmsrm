"use client";
import { useState, useEffect, useRef } from "react";
import {
  Title,
  Button,
  Group,
  Text,
  Box,
  Paper,
  Stack,
  Select,
  Badge,
  TextInput,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { IconScan, IconCamera, IconCameraOff } from "@tabler/icons-react";
import { Html5Qrcode } from "html5-qrcode";
import api from "../lib/api";

export default function ScanPage() {
  const [scanning, setScanning] = useState(false);
  const [result, setResult] = useState("");
  const [cameraId, setCameraId] = useState("");
  const [cameras, setCameras] = useState<any[]>([]);
  const [rakDetail, setRakDetail] = useState<any[]>([]);
  const [scanningRak, setScanningRak] = useState(false);
  const scannerRef = useRef<Html5Qrcode | null>(null);

  useEffect(() => {
    Html5Qrcode.getCameras()
      .then((devices) => {
        setCameras(devices || []);
        if (devices?.length) setCameraId(devices[0].id);
      })
      .catch(() => {
        notifications.show({
          title: "Kamera",
          message: "Tidak dapat mengakses kamera.",
          color: "red",
        });
      });
  }, []);

  const startScan = async () => {
    if (!cameraId) {
      notifications.show({
        title: "Kamera",
        message: "Pilih kamera terlebih dahulu.",
        color: "red",
      });
      return;
    }
    scannerRef.current = new Html5Qrcode("qr-reader");
    try {
      await scannerRef.current.start(
        cameraId,
        { fps: 10, qrbox: { width: 250, height: 250 } },
        (decodedText) => {
          setResult(decodedText);
          setRakDetail([]);
          stopScan();
          notifications.show({
            title: "QR Terbaca",
            message: decodedText,
            color: "green",
          });
          // Auto lookup if looks like a rack code (e.g. R-A-01, T-01, GANG-A)
          if (/^(R-|T-|GANG|FLOOR)/i.test(decodedText.trim())) {
            setScanningRak(true);
            api
              .get(`/stock/by-rak?rak=${encodeURIComponent(decodedText.trim())}`)
              .then((res: any) => {
                setRakDetail(res || []);
              })
              .catch(() => {})
              .finally(() => setScanningRak(false));
          }
        },
        () => {},
      );
      setScanning(true);
    } catch (e) {
      notifications.show({
        title: "Gagal",
        message: "Tidak bisa memulai scanner.",
        color: "red",
      });
    }
  };

  const stopScan = async () => {
    if (scannerRef.current && scanning) {
      await scannerRef.current.stop();
      await scannerRef.current.clear();
      scannerRef.current = null;
      setScanning(false);
    }
  };

  return (
    <Box>
      <Box
        style={{
          background: "#fff",
          borderLeft: "4px solid #8b5cf6",
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
              <IconScan size={20} style={{ color: "#8b5cf6" }} />
              QR / BARCODE SCANNER
            </Title>
            <Text size="xs" c="dimmed" mt={2}>
              Scan kode QR atau barcode untuk membaca ID stock, batch, atau rak.
            </Text>
          </Box>
          <Badge color="violet" variant="light" size="lg">
            Scanner
          </Badge>
        </Group>
      </Box>

      <Paper withBorder p="md" radius="md">
        <Stack gap="md">
          <Group>
            <Select
              size="xs"
              label="Pilih Kamera"
              data={cameras.map((c) => ({ value: c.id, label: c.label }))}
              value={cameraId}
              onChange={(v) => setCameraId(v || "")}
              style={{ minWidth: 200 }}
              disabled={scanning}
            />
            {!scanning ? (
              <Button
                size="xs"
                color="violet"
                leftSection={<IconCamera size={14} />}
                onClick={startScan}
              >
                Mulai Scan
              </Button>
            ) : (
              <Button
                size="xs"
                color="red"
                leftSection={<IconCameraOff size={14} />}
                onClick={stopScan}
              >
                Stop Scan
              </Button>
            )}
          </Group>

          <Box
            id="qr-reader"
            style={{
              width: "100%",
              minHeight: scanning ? 300 : 100,
              border: "2px dashed #ddd",
              borderRadius: 8,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "#f9fafb",
            }}
          >
            {!scanning && (
              <Text size="sm" c="dimmed">
                Klik "Mulai Scan" untuk mengaktifkan kamera
              </Text>
            )}
          </Box>

          {result && (
          <Box
            p="sm"
            style={{
              background: "#f0fdf4",
              border: "1px solid #86efac",
              borderRadius: 8,
            }}
          >
            <Text size="xs" c="dimmed">
              Hasil Scan:
            </Text>
            <Text size="md" fw={700} c="green">
              {result}
            </Text>
            <TextInput
              size="xs"
              label="Salin hasil"
              value={result}
              readOnly
              mt="xs"
              onClick={(e) => (e.currentTarget as HTMLInputElement).select()}
            />
          </Box>
        )}

        {scanningRak ? (
          <Text size="xs" c="dimmed" ta="center">
            Mencari stock di rak {result}...
          </Text>
        ) : rakDetail.length > 0 ? (
          <Box
            p="sm"
            style={{
              background: "#eff6ff",
              border: "1px solid #93c5fd",
              borderRadius: 8,
            }}
          >
            <Text size="xs" fw={700} c="blue" mb="xs">
              Stock di Rak {result}
            </Text>
            {rakDetail.map((s: any, i: number) => (
              <Group key={i} justify="space-between" py={2} style={{ borderBottom: i < rakDetail.length - 1 ? "1px solid #dbeafe" : undefined }}>
                <Text size="xs">
                  {s.namaBarang} (Batch: {s.nomorBatch || "-"})
                </Text>
                <Text size="xs" fw={700} c={s.stockOnhand > 0 ? "green" : "red"}>
                  {s.stockOnhand} {s.satuan}
                </Text>
              </Group>
            ))}
          </Box>
        ) : result && /^(R-|T-|GANG|FLOOR)/i.test(result.trim()) ? (
          <Text size="xs" c="dimmed" ta="center">
            Tidak ada stock di rak {result}.
          </Text>
        ) : null}
        </Stack>
      </Paper>
    </Box>
  );
}
