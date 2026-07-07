import { Controller, Get, Post, Put, Delete, Body, Param, UseGuards, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { FgRak } from './fg-rak.entity.js';
import { FgBarangKeluar } from '../barang-keluar/fg-barang-keluar.entity.js';
import { FgStock } from '../stock/fg-stock.entity.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';

@Controller('master-rak')
@UseGuards(JwtAuthGuard)
export class FgMasterRakController {
  constructor(
    @InjectRepository(FgRak) private repo: Repository<FgRak>,
    @InjectRepository(FgBarangKeluar) private bkRepo: Repository<FgBarangKeluar>,
    @InjectRepository(FgStock) private stockRepo: Repository<FgStock>,
  ) {}

  @Get()
  async findAll() { return this.repo.find({ order: { lokasiRak: 'ASC' } }); }

  @Post()
  async create(@Body() body: Partial<FgRak>) { return this.repo.save(this.repo.create(body)); }

  @Put(':id')
  async update(@Param('id') id: number, @Body() body: Partial<FgRak>) {
    await this.repo.update(id, body);
    return this.repo.findOne({ where: { id } });
  }

  @Delete(':id')
  async remove(@Param('id') id: number) { await this.repo.delete(id); return { ok: true }; }

  @Get('last-out/:lokasiRak')
  async getLastOut(@Param('lokasiRak') lokasiRak: string) {
    const rak = await this.repo.findOne({ where: { lokasiRak } });
    if (!rak) throw new NotFoundException('Rak tidak ditemukan');

    const lastOut = await this.bkRepo.findOne({
      where: { lokasiRak },
      order: { timestampInput: 'DESC' },
    });

    if (!lastOut) {
      return {
        lokasiRak,
        info: null,
        message: 'Belum ada transaksi barang keluar di rak ini',
      };
    }

    return {
      lokasiRak,
      info: {
        tanggalKeluar: lastOut.tanggalDimuat,
        namaBarang: lastOut.namaBarang,
        nomorBatch: lastOut.nomorBatch,
        qtyKeluar: lastOut.qtyKeluar,
        satuan: lastOut.satuan,
        nomorSuratJalan: lastOut.nomorSuratJalan,
        kodeResto: lastOut.kodeResto,
        namaResto: lastOut.namaResto,
        nopol: lastOut.nopol,
        namaSopir: lastOut.namaSopir,
        namaUserTransaksi: lastOut.namaUserTransaksi,
        timestampInput: lastOut.timestampInput,
      },
    };
  }

  @Get('last-out')
  async getAllLastOut() {
    const rakList = await this.repo.find({ order: { lokasiRak: 'ASC' } });
    const results = await Promise.all(
      rakList.map(async (rak) => {
        const lastOut = await this.bkRepo.findOne({
          where: { lokasiRak: rak.lokasiRak },
          order: { timestampInput: 'DESC' },
        });
        return {
          lokasiRak: rak.lokasiRak,
          info: lastOut
            ? {
                tanggalKeluar: lastOut.tanggalDimuat,
                namaBarang: lastOut.namaBarang,
                nomorBatch: lastOut.nomorBatch,
                qtyKeluar: lastOut.qtyKeluar,
                satuan: lastOut.satuan,
                nomorSuratJalan: lastOut.nomorSuratJalan,
                kodeResto: lastOut.kodeResto,
                namaResto: lastOut.namaResto,
                nopol: lastOut.nopol,
                namaUserTransaksi: lastOut.namaUserTransaksi,
                timestampInput: lastOut.timestampInput,
              }
            : null,
        };
      }),
    );
    return results;
  }

  @Get('occupancy')
  async getOccupancy() {
    const rakList = await this.repo.find({ order: { lokasiRak: 'ASC' } });
    const stocks = await this.stockRepo.find();
    const stockByRak: Record<string, { total: number; release: number; hold: number; reject: number }> = {};
    stocks.forEach((s) => {
      if (!stockByRak[s.lokasiRak]) stockByRak[s.lokasiRak] = { total: 0, release: 0, hold: 0, reject: 0 };
      stockByRak[s.lokasiRak].total += s.stockOnhand;
      if (s.status === 'RELEASE' || s.status === 'GOOD') stockByRak[s.lokasiRak].release += s.stockOnhand;
      else if (s.status === 'HOLD') stockByRak[s.lokasiRak].hold += s.stockOnhand;
      else if (s.status === 'REJECT') stockByRak[s.lokasiRak].reject += s.stockOnhand;
    });

    const rows = rakList
      .filter((rak) => rak.jenisRak !== 'GANGWAY')
      .map((rak) => {
        const used = stockByRak[rak.lokasiRak]?.total || 0;
        const release = stockByRak[rak.lokasiRak]?.release || 0;
        const hold = stockByRak[rak.lokasiRak]?.hold || 0;
        const reject = stockByRak[rak.lokasiRak]?.reject || 0;
        const capacity = rak.kapasitasRak || 0;
        const pct = capacity > 0 ? Math.round((used / capacity) * 100) : 0;
        return {
          lokasiRak: rak.lokasiRak,
          jenisRak: rak.jenisRak,
          capacity,
          used,
          release,
          hold,
          reject,
          available: Math.max(0, capacity - used),
          percentage: pct,
          status: pct >= 100 ? 'FULL' : pct >= 80 ? 'WARNING' : 'OK',
        };
      });

    const totalCapacity = rows.reduce((s, r) => s + r.capacity, 0);
    const totalUsed = rows.reduce((s, r) => s + r.used, 0);
    const totalRelease = rows.reduce((s, r) => s + r.release, 0);
    const totalHold = rows.reduce((s, r) => s + r.hold, 0);
    const totalReject = rows.reduce((s, r) => s + r.reject, 0);
    const overallPct = totalCapacity > 0 ? Math.round((totalUsed / totalCapacity) * 100) : 0;

    return {
      overall: {
        totalCapacity,
        totalUsed,
        totalRelease,
        totalHold,
        totalReject,
        totalAvailable: Math.max(0, totalCapacity - totalUsed),
        percentage: overallPct,
      },
      rows,
    };
  }

  @Post('import-csv')
  async importCsv(@Body() body: { csvText: string }) {
    const lines = body.csvText.split('\n').map(l => l.trim()).filter(Boolean);
    if (lines.length < 2) return { message: 'CSV kosong atau tidak valid', success: 0, failed: 0, errors: [] };
    const header = lines[0].split(',').map(h => h.trim().toLowerCase());
    const rows = lines.slice(1);
    let success = 0, failed = 0;
    const errors: string[] = [];

    for (let i = 0; i < rows.length; i++) {
      const vals = rows[i].split(',').map(v => v.trim());
      const row: any = {};
      header.forEach((h, idx) => { row[h] = vals[idx] || ''; });

      if (!row.lokasiRak) { failed++; errors.push(`Baris ${i + 2}: 'lokasiRak' wajib diisi`); continue; }

      const exist = await this.repo.findOne({ where: { lokasiRak: row.lokasiRak } });
      if (exist) { failed++; errors.push(`Baris ${i + 2}: '${row.lokasiRak}' sudah ada, skip`); continue; }

      try {
        await this.repo.save(this.repo.create({
          lokasiRak: row.lokasiRak,
          kapasitasRak: parseInt(row.kapasitas || row.kapasitasRak || '0', 10) || 0,
          jenisRak: row.jenis || row.jenisRak || 'DEDICATED',
        }));
        success++;
      } catch (e: any) {
        failed++; errors.push(`Baris ${i + 2}: ${e.message}`);
      }
    }

    return { message: `Import selesai: ${success} berhasil, ${failed} gagal`, success, failed, errors };
  }
}
