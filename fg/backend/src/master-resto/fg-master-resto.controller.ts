import { Controller, Get, Post, Put, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { FgResto } from './fg-resto.entity.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';

@Controller('master-resto')
@UseGuards(JwtAuthGuard)
export class FgMasterRestoController {
  constructor(@InjectRepository(FgResto) private repo: Repository<FgResto>) {}

  @Get()
  async findAll() { return this.repo.find({ order: { kode: 'ASC' } }); }

  @Post()
  async create(@Body() body: Partial<FgResto>) { return this.repo.save(this.repo.create(body)); }

  @Put(':id')
  async update(@Param('id') id: number, @Body() body: Partial<FgResto>) {
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

      if (!row.kode) { failed++; errors.push(`Baris ${i + 2}: 'kode' wajib diisi`); continue; }
      if (!row.nama) { failed++; errors.push(`Baris ${i + 2}: 'nama' wajib diisi`); continue; }

      const exist = await this.repo.findOne({ where: { kode: row.kode } });
      if (exist) { failed++; errors.push(`Baris ${i + 2}: kode '${row.kode}' sudah ada, skip`); continue; }

      try {
        await this.repo.save(this.repo.create({
          kode: row.kode,
          nama: row.nama,
          nopol: row.nopol || null,
          wa: row.wa || null,
          sopir: row.sopir || null,
          keterangan: row.keterangan || null,
        }));
        success++;
      } catch (e: any) {
        failed++; errors.push(`Baris ${i + 2}: ${e.message}`);
      }
    }

    return { message: `Import selesai: ${success} berhasil, ${failed} gagal`, success, failed, errors };
  }
}
