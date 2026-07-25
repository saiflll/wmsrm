// @ts-nocheck
'use client';
import { Paper, Box, Text, Badge } from '@mantine/core';
import { IconChartBar, IconDatabase } from '@tabler/icons-react';

import { SectionHeader, TH, TD } from './Helpers';

export default function ReportTab({
  reportData,
  ReportChart
}: {
  reportData: any[];
  ReportChart: any;
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
          icon={IconChartBar}
          accent="#e67700"
          bg="#fff3bf"
          title="Inbound vs Outbound (1 Tahun)"
          sub="Otomatis menyesuaikan lebar layar"
        />
        <ReportChart data={reportData} />
      </Paper>

      {reportData?.length > 0 && (
        <Paper
          withBorder
          p="sm"
          style={{ borderRadius: 12, background: "#fff", boxShadow: cardShadow }}
        >
          <SectionHeader
            icon={IconDatabase}
            accent="#e67700"
            bg="#fff3bf"
            title="Tabel Inbound vs Outbound"
            sub={`${reportData.length} minggu terakhir`}
          />
          <Box style={{ overflowX: "auto", maxHeight: 300, borderRadius: 8, border: "1px solid #e9ecef" }}>
            <Box component="table" style={{ width: "100%", borderCollapse: "collapse", minWidth: 380 }}>
              <Box component="thead" style={{ background: "#fff4e6", borderBottom: "2px solid #ffd8a8", position: "sticky", top: 0, zIndex: 1 }}>
                <Box component="tr">
                  {["Minggu", "Inbound", "Outbound", "Net", "Ratio"].map((h) => (
                    <TH key={h} right={["Inbound", "Outbound", "Net", "Ratio"].includes(h)} color="#d9480f">
                      {h}
                    </TH>
                  ))}
                </Box>
              </Box>
              <Box component="tbody">
                {reportData.map((d: any, idx: number) => {
                  const net = (d.inbound || 0) - (d.outbound || 0);
                  const total = (d.inbound || 0) + (d.outbound || 0);
                  const inPct = total > 0 ? Math.round(((d.inbound || 0) / total) * 100) : 0;
                  return (
                    <Box
                      component="tr"
                      key={d.week}
                      style={{ borderBottom: "1px solid #f1f3f5", background: idx % 2 === 0 ? "#fff" : "#f8f9fa" }}
                    >
                      <TD style={{ fontWeight: 700 }}>{d.week}</TD>
                      <TD right>
                        <Badge size="xs" color="green" variant="light">{(d.inbound || 0).toLocaleString()}</Badge>
                      </TD>
                      <TD right>
                        <Badge size="xs" color="red" variant="light">{(d.outbound || 0).toLocaleString()}</Badge>
                      </TD>
                      <TD right>
                        <Text size="10px" fw={700} c={net > 0 ? "green" : net < 0 ? "red" : "gray"}>
                          {net > 0 ? "+" : ""}
                          {net.toLocaleString()}
                        </Text>
                      </TD>
                      <TD right>
                        <Text size="10px" c="dimmed">{inPct}% IN</Text>
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