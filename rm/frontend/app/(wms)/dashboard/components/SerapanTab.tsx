// @ts-nocheck
'use client';
import { Paper, Box, Text, Badge } from '@mantine/core';
import { IconMeat, IconChartBar } from '@tabler/icons-react';

import SimpleBarChart from './SimpleBarChart';
import { SectionHeader, TH, TD } from './Helpers';

export default function SerapanTab({ 
  serapanData
}: { serapanData: any }) {
  const cardShadow = "0 2px 12px rgba(0,0,0,0.07)";

  return (
    <>
      <Paper
        withBorder
        p="sm"
        style={{ borderRadius: 12, background: "#fff", boxShadow: cardShadow }}
      >
        <SectionHeader
          icon={IconMeat}
          accent="#be4bdb"
          bg="#f3d9fa"
          title="Serapan Ayam"
          sub="Planning vs Serapan per minggu — 1 tahun"
        />
        <SimpleBarChart
          series={[
            {
              label: "Planning",
              color: "#4c6ef5",
              data: serapanData?.data?.map((d: any) => d.planning) || [],
            },
            {
              label: "Serapan",
              color: "#be4bdb",
              data: serapanData?.data?.map((d: any) => d.serapan) || [],
            },
          ]}
          labels={
            serapanData?.data?.map((d: any) => ({
              key: d.week,
              label: d.week,
            })) || []
          }
        />
      </Paper>

      {serapanData?.data?.length > 0 && (
        <Paper
          withBorder
          p="sm"
          style={{ borderRadius: 12, background: "#fff", boxShadow: cardShadow }}
        >
          <SectionHeader
            icon={IconChartBar}
            accent="#be4bdb"
            bg="#f3d9fa"
            title="Tabel Serapan per Minggu"
            sub={`${serapanData.data.length} minggu terakhir`}
          />
          <Box style={{ overflowX: "auto", maxHeight: 320, borderRadius: 8, border: "1px solid #e9ecef" }}>
            <Box component="table" style={{ width: "100%", borderCollapse: "collapse", minWidth: 420 }}>
              <Box component="thead" style={{ background: "#f3d9fa", borderBottom: "2px solid #eebefa", position: "sticky", top: 0, zIndex: 1 }}>
                <Box component="tr">
                  {["Minggu", "Planning", "Serapan", "Selisih", "% Serapan"].map((h) => (
                    <TH key={h} right={["Planning", "Serapan", "Selisih", "% Serapan"].includes(h)} color="#862e9c">
                      {h}
                    </TH>
                  ))}
                </Box>
              </Box>
              <Box component="tbody">
                {serapanData.data.map((d: any, idx: number) => {
                  const pct = d.planning > 0 ? Math.round((d.serapan / d.planning) * 100) : 0;
                  const selisih = d.serapan - d.planning;
                  return (
                    <Box
                      component="tr"
                      key={d.week}
                      style={{ borderBottom: "1px solid #f1f3f5", background: idx % 2 === 0 ? "#fff" : "#f8f9fa" }}
                    >
                      <TD style={{ fontWeight: 700 }}>{d.week}</TD>
                      <TD right style={{ fontWeight: 700 }}>{(d.planning || 0).toLocaleString()}</TD>
                      <TD right>
                        <Badge size="xs" color="grape" variant="light">{(d.serapan || 0).toLocaleString()}</Badge>
                      </TD>
                      <TD right>
                        <Text size="10px" fw={700} c={selisih >= 0 ? "green" : "red"}>
                          {selisih >= 0 ? "+" : ""}
                          {selisih.toLocaleString()}
                        </Text>
                      </TD>
                      <TD right>
                        <Badge size="xs" color={pct >= 90 ? "green" : pct >= 70 ? "yellow" : "red"} variant="filled">
                          {pct}%
                        </Badge>
                      </TD>
                    </Box>
                  );
                })}
              </Box>
            </Box>
          </Box>
        </Paper>
      )}
    </>
  );
}