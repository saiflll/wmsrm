import { Injectable, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, ILike, IsNull } from 'typeorm';
import { Gudang } from './gudang.entity';

@Injectable()
export class GudangService {
  constructor(@InjectRepository(Gudang) private repo: Repository<Gudang>) {}

  findAll(side?: boolean, zone?: string, search?: string) {
    const where: any = { deleted_at: IsNull() };
    if (side !== undefined) where.side = side;
    if (zone) where.zone = zone;
    if (search) where.name = ILike(`%${search}%`);
    return this.repo.find({
      where,
      relations: ['barang'],
      order: { name: 'ASC' },
    });
  }

  findOne(id: number) {
    return this.repo.findOne({ where: { id, deleted_at: IsNull() }, relations: ['barang'] });
  }

  findBySlot(name: string) {
    return this.repo.findOne({ where: { name, deleted_at: IsNull() }, relations: ['barang'] });
  }

  findByZone(zone: string) {
    return this.repo.find({
      where: { zone, deleted_at: IsNull() },
      relations: ['barang'],
      order: { name: 'ASC' },
    });
  }

  async create(data: Partial<Gudang>) {
    // Check duplicate name in the same zone
    if (data.name) {
      const existing = await this.repo.findOne({ where: { name: data.name, zone: data.zone || 'DRY A', deleted_at: IsNull() } });
      if (existing)
        throw new ConflictException(`Lokasi "${data.name}" pada zone "${data.zone || 'DRY A'}" sudah ada`);
    }
    // Auto-extract kolom from name (e.g. A1.1 -> A)
    if (data.name && !data.kolom) {
      data.kolom = data.name.charAt(0);
    }
    return this.repo.save(this.repo.create(data));
  }

  async update(id: number, data: Partial<Gudang>) {
    // Check duplicate name in the same zone
    if (data.name) {
      const existing = await this.repo.findOne({ where: { name: data.name, zone: data.zone || 'DRY A', deleted_at: IsNull() } });
      if (existing && existing.id !== id)
        throw new ConflictException(`Lokasi "${data.name}" pada zone "${data.zone || 'DRY A'}" sudah ada`);
    }
    await this.repo.update(id, data);
    return this.findOne(id);
  }

  async remove(id: number, cascade: boolean = false) {
    if (cascade) {
      // 1. Hapus relocation yang mengacu ke stock yang ada di gudang ini (source_stock)
      try { await this.repo.manager.query(`DELETE FROM relocation WHERE "sourceStockId" IN (SELECT id FROM stock WHERE "gudangId" = $1 OR gudang_id = $1)`, [id]); } catch (e) {}
      try { await this.repo.manager.query(`DELETE FROM relocation WHERE source_stock_id IN (SELECT id FROM stock WHERE "gudangId" = $1 OR gudang_id = $1)`, [id]); } catch (e) {}

      // 2. Hapus relocation yang target gudangnya adalah gudang ini
      try { await this.repo.manager.query(`DELETE FROM relocation WHERE "targetGudangId" = $1 OR target_gudang_id = $1 OR "target_gudangId" = $1`, [id]); } catch (e) {}

      // 3. Hapus stock_log yang terikat gudang ini (baik sebagai gudang maupun gudang_tujuan)
      try { await this.repo.manager.query(`DELETE FROM stock_log WHERE "gudangId" = $1 OR gudang_id = $1`, [id]); } catch (e) {}
      try { await this.repo.manager.query(`DELETE FROM stock_log WHERE "gudangTujuanId" = $1 OR gudang_tujuan_id = $1 OR "gudang_tujuanId" = $1`, [id]); } catch (e) {}

      // 4. Hapus stock yang ada di gudang ini
      try { await this.repo.manager.query(`DELETE FROM stock WHERE "gudangId" = $1 OR gudang_id = $1`, [id]); } catch (e) {}

      // 5. Hapus transaksi yang mengacu gudang ini
      try { await this.repo.manager.query(`DELETE FROM transaksi WHERE "gudangId" = $1 OR gudang_id = $1`, [id]); } catch (e) {}

      try {
        await this.repo.delete(id);
      } catch (err: any) {
        throw new ConflictException(`Gagal hapus lokasi/gudang (ada relasi tersisa): ${err?.message || err}`);
      }
      return { deleted: true, cascade: true };
    }
    await this.repo.update(id, { deleted_at: new Date() });
    return { deleted: true };
  }

  // Get zones summary for dashboard
  async getZonesSummary() {
    const zones = ['CS FROZEN', 'CHILL', 'DRY A', 'DRY B', 'DRY FG', 'WASTE'];
    const result: any[] = [];
    for (const z of zones) {
      const total = await this.repo.count({ where: { zone: z } });
      const filled = await this.repo.count({
        where: { zone: z, status: false },
      }); // false = occupied
      result.push({
        zone: z,
        total,
        filled,
        pct: total > 0 ? ((filled / total) * 100).toFixed(1) : '0',
      });
    }
    return result;
  }
}
