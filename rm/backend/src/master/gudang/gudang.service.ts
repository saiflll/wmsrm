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
      try { await this.repo.manager.query(`DELETE FROM relocation WHERE target_gudang_id = $1 OR "targetGudangId" = $1`, [id]); } catch (e) {}
      try { await this.repo.manager.query(`DELETE FROM stock_log WHERE gudang_id = $1 OR gudang_tujuan_id = $1 OR "gudangId" = $1 OR "gudangTujuanId" = $1`, [id]); } catch (e) {}
      try { await this.repo.manager.query(`DELETE FROM stock WHERE gudang_id = $1 OR "gudangId" = $1`, [id]); } catch (e) {}
      try { await this.repo.manager.query(`DELETE FROM transaksi WHERE gudang_id = $1 OR "gudangId" = $1`, [id]); } catch (e) {}
      await this.repo.delete(id);
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
