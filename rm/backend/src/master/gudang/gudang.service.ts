import { Injectable, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, ILike } from 'typeorm';
import { Gudang } from './gudang.entity';

@Injectable()
export class GudangService {
  constructor(@InjectRepository(Gudang) private repo: Repository<Gudang>) {}

  findAll(side?: boolean, zone?: string, search?: string) {
    const where: any = {};
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
    return this.repo.findOne({ where: { id }, relations: ['barang'] });
  }

  findBySlot(name: string) {
    return this.repo.findOne({ where: { name }, relations: ['barang'] });
  }

  findByZone(zone: string) {
    return this.repo.find({
      where: { zone },
      relations: ['barang'],
      order: { name: 'ASC' },
    });
  }

  async create(data: Partial<Gudang>) {
    // Check duplicate name
    if (data.name) {
      const existing = await this.repo.findOne({ where: { name: data.name } });
      if (existing)
        throw new ConflictException(`Lokasi "${data.name}" sudah ada`);
    }
    // Auto-extract kolom from name (e.g. A1.1 -> A)
    if (data.name && !data.kolom) {
      data.kolom = data.name.charAt(0);
    }
    return this.repo.save(this.repo.create(data));
  }

  async update(id: number, data: Partial<Gudang>) {
    // Check duplicate name
    if (data.name) {
      const existing = await this.repo.findOne({ where: { name: data.name } });
      if (existing && existing.id !== id)
        throw new ConflictException(`Lokasi "${data.name}" sudah ada`);
    }
    await this.repo.update(id, data);
    return this.findOne(id);
  }

  async remove(id: number) {
    await this.repo.delete(id);
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
