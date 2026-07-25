// @ts-nocheck
'use client';
import { Paper, Box, Text, Badge, Loader, Group, TextInput } from '@mantine/core';
import { IconChartPie, IconChartBar, IconBuildingWarehouse, IconSearch } from '@tabler/icons-react';

import SimpleBarChart from './SimpleBarChart';
import { SectionHeader, TH, TD } from './Helpers';

export default function OccupancyTab({
  occupancyData,
  selectedZone,
  handleZoneClick,
  setSelectedZone,
  loadOccupancy,
  tableSearch,
  setTableSearch,
  OccupancyGauge
}: {
  occupancyData: any;
  selectedZone: string | null;
  handleZoneClick: (zoneId: string) => void;
  setSelectedZone: (zoneId: string | null) => void;
  loadOccupancy: () => void;
  tableSearch: string;
  setTableSearch: (val: string) => void;
  OccupancyGauge: any;
}) {
  const cardShadow = "0 2px 12px rgba(0,0,0,0.07)";

  return (
    <>
      <Paper
        withBorder
        p="sm"
        style={{ borderRadius: 12, background: "#fff", boxShadow: cardShadow }}
      >
        <SectionHeader
          icon={IconChartPie}
          accent="#228be6"
          bg="#e7f5ff"
          title="Okupansi per Zone"
          sub="Klik zone untuk melihat detail item & trend harian"
        />
        <Box style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {occupancyData?.gauges?.map((g: any) => (
            <Box key={g.id} style={{ flex: "1 1 0", minWidth: 100, maxWidth: 150 }}>
              <OccupancyGauge
                pct={g.pct}
                label={g.name}
                subLabel={`${g.occupiedRacks} / ${g.totalRacks} rak terisi`}
                color={g.color}
                selected={selectedZone === g.id}
                onClick={() => handleZoneClick(g.id)}
              />
            </Box>
          ))}
          {!occupancyData && (
            <Box py="xl" ta="center" style={{ width: "100%" }}>
              <Loader size="sm" />
            </Box>
          )}
          {occupancyData && occupancyData.gauges.length === 0 && (
            <Box py="xl" ta="center" style={{ width: "100%" }}>
              <Text size="xs" c="dimmed">Tidak ada data okupansi dari server.</Text>
            </Box>
          )}
        </Box>
      </Paper>

      {selectedZone && (
        <>
          <Paper
            withBorder
            p="sm"
            style={{ borderRadius: 12, background: "#fff", boxShadow: cardShadow }}
          >
            <SectionHeader
              icon={IconChartBar}
              accent="#f59f00"
              bg="#fff3bf"
              title={`Trend Harian — Zone ${selectedZone}`}
              sub="Scroll horizontal untuk data 1 tahun"
              right={
                <Badge
                  size="sm"
                  variant="light"
                  color="yellow"
                  style={{ cursor: "pointer" }}
                  onClick={() => {
                    setSelectedZone(null);
                    loadOccupancy();
                  }}
                >
                  ✕ Kembali ke semua zone
                </Badge>
              }
            />
            <Box style={{ overflowX: "auto", maxWidth: "100%" }}>
              <SimpleBarChart
                series={[
                  {
                    label: "Qty",
                    color: occupancyData?.gauges?.find((g: any) => g.id === selectedZone)?.color || "#228be6",
                    data: occupancyData?.dailySeries?.map((d: any) => d.value) || [],
                  },
                ]}
                labels={occupancyData?.dailySeries?.map((d: any) => ({
                  key: d.date,
                  label: typeof d.date === 'string' ? d.date.slice(5) : String(d.date || ''),
                })) || []}
              />
            </Box>
          </Paper>

          <Paper
            withBorder
            p="sm"
            style={{ borderRadius: 12, background: "#fff", boxShadow: cardShadow }}
          >
            <SectionHeader
              icon={IconBuildingWarehouse}
              accent="#228be6"
              bg="#e7f5ff"
              title={`Item di Zone ${selectedZone}`}
              sub={`${occupancyData?.items?.length || 0} item ditemukan`}
              right={
                <TextInput
                  placeholder="Cari item..."
                  size="xs"
                  leftSection={<IconSearch size={12} />}
                  value={tableSearch}
                  onChange={(e) => setTableSearch(e.target.value)}
                  style={{ width: 180 }}
                />
              }
            />
            <Box style={{ overflowX: "auto", borderRadius: 8, border: "1px solid #e9ecef" }}>
              <Box component="table" style={{ width: "100%", borderCollapse: "collapse", minWidth: 620 }}>
                <Box component="thead" style={{ background: "#f0f7ff", borderBottom: "2px solid #a5d8ff" }}>
                  <Box component="tr">
                    {["Barang", "Batch", "Qty", "Satuan", "Expired", "Rak"].map((h) => (
                      <TH key={h} right={h === "Qty"} color="#1864ab">{h}</TH>
                    ))}
                  </Box>
                </Box>
                <Box component="tbody">
                  {occupancyData?.items
                    ?.filter(
                      (item: any) =>
                        !tableSearch ||
                        item.barang.toLowerCase().includes(tableSearch.toLowerCase()) ||
                        item.batch.toLowerCase().includes(tableSearch.toLowerCase()),
                    )
                    .map((item: any, idx: number) => (
                      <Box
                        component="tr"
                        key={item.id}
                        style={{
                          borderBottom: "1px solid #f1f3f5",
                          background: idx % 2 === 0 ? "#fff" : "#f8f9fa",
                        }}
                      >
                        <TD style={{ fontWeight: 700, color: "#1a1a2e" }}>{item.barang}</TD>
                        <TD>
                          <Badge size="xs" color="indigo" variant="light">{item.batch}</Badge>
                        </TD>
                        <TD right style={{ fontWeight: 700 }}>{item.qty.toLocaleString()}</TD>
                        <TD>
                          <Text size="10px" c="dimmed">{item.satuan}</Text>
                        </TD>
                        <TD>
                          {(() => {
                            if (!item.expiry) return "—";
                            const d = new Date(item.expiry);
                            if (isNaN(d.getTime())) return String(item.expiry);
                            const isExp = d < new Date();
                            return (
                              <Badge
                                size="xs"
                                color={isExp ? "red" : "teal"}
                                variant="light"
                              >
                                {d.toISOString().split("T")[0]}
                              </Badge>
                            );
                          })()}
                        </TD>
                        <TD>
                          <Badge size="xs" color="gray" variant="outline">{item.rack}</Badge>
                        </TD>
                      </Box>
                    ))}
                </Box>
              </Box>
            </Box>
          </Paper>
        </>
      )}
    </>
  );
}