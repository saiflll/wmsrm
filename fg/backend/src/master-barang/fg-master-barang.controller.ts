import { Controller, Get, Post, Put, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { FgBarang } from './fg-barang.entity.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';

@Controller('master-barang')
@UseGuards(JwtAuthGuard)
export class FgMasterBarangController {
  constructor(@InjectRepository(FgBarang) private repo: Repository<FgBarang>) {}

  @Get()
  async findAll() { return this.repo.find({ order: { nama: 'ASC' } }); }

  @Post()
  async create(@Body() body: Partial<FgBarang>) { return this.repo.save(this.repo.create(body)); }

  @Put(':id')
  async update(@Param('id') id: number, @Body() body: Partial<FgBarang>) {
    await this.repo.update(id, body);
    return this.repo.findOne({ where: { id } });
  }

  @Delete(':id')
  async remove(@Param('id') id: number) { await this.repo.delete(id); return { ok: true }; }

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

      if (!row.nama) { failed++; errors.push(`Baris ${i + 2}: 'nama' wajib diisi`); continue; }

      const exist = await this.repo.findOne({ where: { nama: row.nama } });
      if (exist) { failed++; errors.push(`Baris ${i + 2}: '${row.nama}' sudah ada, skip`); continue; }

      try {
        await this.repo.save(this.repo.create({
          nama: row.nama,
          satuanDefault: row.satuan || row.satuanDefault || 'Carton',
          statusDefault: row.status || row.statusDefault || 'GOOD',
          lokasiRakDefault: row.lokasiRak || row.lokasiRakDefault || null,
          umurExpiredBulan: parseInt(row.expiredBulan || row.umurExpiredBulan || '0', 10) || 0,
        }));
        success++;
      } catch (e: any) {
        failed++; errors.push(`Baris ${i + 2}: ${e.message}`);
      }
    }

    return { message: `Import selesai: ${success} berhasil, ${failed} gagal`, success, failed, errors };
  }
}
