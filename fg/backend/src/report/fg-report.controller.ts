import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { FgMutasi } from '../mutasi/fg-mutasi.entity.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { RolesGuard } from '../auth/roles.guard.js';
import { Roles } from '../auth/roles.decorator.js';

@Controller('report')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('SUPERVISOR')
export class FgReportController {
  constructor(@InjectRepository(FgMutasi) private mutasiRepo: Repository<FgMutasi>) {}

  @Get('inbound-outbound')
  async getInboundOutboundReport(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('namaBarang') namaBarang?: string,
  ) {
    const qb = this.mutasiRepo.createQueryBuilder('m');
    if (startDate) qb.andWhere('m.tanggalTransaksi >= :startDate', { startDate });
    if (endDate) qb.andWhere('m.tanggalTransaksi <= :endDate', { endDate });
    if (namaBarang) qb.andWhere('m.namaBarang = :namaBarang', { namaBarang });
    const mutasi = await qb.orderBy('m.tanggalTransaksi', 'ASC').getMany();

    const itemMap: Record<string, { namaBarang: string; satuan: string; inbound: number; outbound: number; net: number }> = {};
    const dailyMap: Record<string, { tanggal: string; inbound: number; outbound: number; net: number; totalItem: number }> = {};
    const detailRows: any[] = [];

    mutasi.forEach((m) => {
      if (!itemMap[m.namaBarang]) itemMap[m.namaBarang] = { namaBarang: m.namaBarang, satuan: m.satuan, inbound: 0, outbound: 0, net: 0 };
      if (m.jenisMutasi === 'IN') itemMap[m.namaBarang].inbound += m.qtyMasuk || 0;
      if (m.jenisMutasi === 'OUT') itemMap[m.namaBarang].outbound += m.qtyKeluar || 0;
      itemMap[m.namaBarang].net = itemMap[m.namaBarang].inbound - itemMap[m.namaBarang].outbound;

      const tgl = m.tanggalTransaksi;
      if (!dailyMap[tgl]) dailyMap[tgl] = { tanggal: tgl, inbound: 0, outbound: 0, net: 0, totalItem: 0 };
      if (m.jenisMutasi === 'IN') dailyMap[tgl].inbound += m.qtyMasuk || 0;
      if (m.jenisMutasi === 'OUT') dailyMap[tgl].outbound += m.qtyKeluar || 0;
      dailyMap[tgl].net = dailyMap[tgl].inbound - dailyMap[tgl].outbound;

      detailRows.push({
        tanggal: m.tanggalTransaksi,
        namaBarang: m.namaBarang,
        satuan: m.satuan,
        jenis: m.jenisMutasi,
        qty: m.jenisMutasi === 'IN' ? m.qtyMasuk : m.qtyKeluar,
        saldo: m.saldoAkhirLot,
        user: m.namaUserTransaksi,
      });
    });

    Object.keys(dailyMap).forEach((tgl) => {
      const items = new Set(mutasi.filter(m => m.tanggalTransaksi === tgl).map(m => m.namaBarang));
      dailyMap[tgl].totalItem = items.size;
    });

    const rangeRows = Object.values(itemMap).sort((a, b) => b.inbound - a.inbound);
    const dailyRows = Object.values(dailyMap).sort((a, b) => a.tanggal.localeCompare(b.tanggal));

    return {
      summary: {
        totalHari: dailyRows.length,
        totalItemRange: rangeRows.length,
        totalInbound: rangeRows.reduce((s, r) => s + r.inbound, 0),
        totalOutbound: rangeRows.reduce((s, r) => s + r.outbound, 0),
        totalNet: rangeRows.reduce((s, r) => s + r.net, 0),
      },
      rangeRows,
      dailyRows,
      detailRows,
    };
  }
}
