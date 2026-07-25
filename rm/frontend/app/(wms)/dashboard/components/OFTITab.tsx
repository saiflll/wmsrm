// @ts-nocheck
'use client';
import { Paper, Box, Text, Badge } from '@mantine/core';
import { IconTruckDelivery, IconChartLine, IconChartBar } from '@tabler/icons-react';
import { percentage } from './utils';

import SimpleBarChart from './SimpleBarChart';
import HorizontalBarChart from './HorizontalBarChart';
import { SectionHeader, TH, TD } from './Helpers';

export default function OFTITab({ 
  oftiData
}: { oftiData: any }) {
  const cardShadow = "0 2px 12px rgba(0,0,0,0.07)";

  return (
    <>
      <Paper
        withBorder
        p="sm"
        style={{ borderRadius: 12, background: "#fff", boxShadow: cardShadow }}
      >
        <SectionHeader
          icon={IconTruckDelivery}
          accent="#2b8a3e"
          bg="#d3f9d8"
          title="Planning Inbound vs Actual Inbound"
          sub="On Time (hijau) vs Late (merah) — 1 tahun"
        />
        <SimpleBarChart
          series={[
            {
              label: "On Time",
              color: "#40c057",
              data: oftiData?.weekly?.map((d: any) => d.ontime ?? d.otif) || [],
            },
            {
              label: "Late",
              color: "#e03131",
              data: oftiData?.weekly?.map((d: any) => d.late ?? d.notOtif) || [],
            },
          ]}
          labels={
            oftiData?.weekly?.map((d: any) => ({
              key: d.week,
              label: d.week,
            })) || []
          }
        />
      </Paper>

      <Paper
        withBorder
        p="sm"
        style={{ borderRadius: 12, background: "#fff", boxShadow: cardShadow }}
      >
        <SectionHeader
          icon={IconChartLine}
          accent="#228be6"
          bg="#e7f5ff"
          title="OTIF INBOUND CP3"
          sub="% OTIF vs NOT OTIF per minggu — 1 tahun"
        />
        <Box style={{ overflowX: "auto", maxWidth: "100%" }}>
          <HorizontalBarChart
            data={oftiData?.weekly}
            leftKey="otif"
            rightKey="notOtif"
            leftColor="#228be6"
            rightColor="#e03131"
          />
        </Box>
      </Paper>

      {oftiData?.weekly?.length > 0 && (
        <Paper
          withBorder
          p="sm"
          style={{ borderRadius: 12, background: "#fff", boxShadow: cardShadow }}
        >
          <SectionHeader
            icon={IconChartBar}
            accent="#2b8a3e"
            bg="#d3f9d8"
            title="Tabel OTIF per Minggu"
            sub={`${oftiData.weekly.length} minggu terakhir`}
          />
          <Box style={{ overflowX: "auto", maxHeight: 320, borderRadius: 8, border: "1px solid #e9ecef" }}>
            <Box component="table" style={{ width: "100%", borderCollapse: "collapse", minWidth: 480 }}>
              <Box component="thead" style={{ background: "#ebfbee", borderBottom: "2px solid #b2f2bb", position: "sticky", top: 0, zIndex: 1 }}>
                <Box component="tr">
                  {["Minggu", "On Time", "Late", "Total", "OTIF %", "NOT OTIF %"].map((h) => (
                    <TH key={h} right={["On Time", "Late", "Total", "OTIF %", "NOT OTIF %"].includes(h)} color="#2b8a3e">
                      {h}
                    </TH>
                  ))}
                </Box>
              </Box>
              <Box component="tbody">
                {oftiData.weekly.map((d: any, idx: number) => {
                  const onTimeCount = d.ontime ?? 0;
                  const lateCount = d.late ?? 0;
                  const total = onTimeCount + lateCount || d.planned || 0;
                  const otifPct = total > 0 ? Math.round((onTimeCount / total) * 100) : (d.otif || 0);
                  const notOtifPct = total > 0 ? 100 - otifPct : (d.notOtif || 0);
                  return (
                    <Box
                      component="tr"
                      key={d.week}
                      style={{ borderBottom: "1px solid #f1f3f5", background: idx % 2 === 0 ? "#fff" : "#f8f9fa" }}
                    >
                      <TD style={{ fontWeight: 700 }}>{d.week}</TD>
                      <TD right>
                        <Badge size="xs" color="green" variant="light">{onTimeCount.toLocaleString()}</Badge>
                      </TD>
                      <TD right>
                        <Badge size="xs" color="red" variant="light">{lateCount.toLocaleString()}</Badge>
                      </TD>
                      <TD right style={{ fontWeight: 700 }}>{total}</TD>
                      <TD right>
                        <Badge size="xs" color={otifPct >= 80 ? "green" : otifPct >= 60 ? "yellow" : "red"} variant="filled">
                          {otifPct}%
                        </Badge>
                      </TD>
                      <TD right>
                        <Text size="10px" c="dimmed">{notOtifPct}%</Text>
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