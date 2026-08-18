import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Put,
  Delete,
  UseGuards,
  Query,
  ConflictException,
  ParseIntPipe,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, ILike, IsNull } from 'typeorm';
import { Barang } from './barang.entity';
import { JwtAuthGuard } from '../../admin/auth/jwt-auth.guard';
import { CreateBarangDto, UpdateBarangDto } from './barang.dto';

import { RolesGuard } from '../../admin/auth/roles.guard';
import { Roles } from '../../admin/auth/roles.decorator';
import { UserRole } from '../../admin/users/user.entity';

@Controller('barang')
@UseGuards(JwtAuthGuard, RolesGuard)
export class BarangController {
  constructor(
    @InjectRepository(Barang) private readonly repo: Repository<Barang>,
  ) {}

  /** Always expose stock from the rack-level source of truth. */
  private async with_current_stock<T extends Barang>(items: T[]): Promise<T[]> {
    if (!items.length) return items;
    const rows = await this.repo.manager
      .createQueryBuilder()
      .select('s."barangId"', 'barang_id')
      .addSelect('COALESCE(SUM(s.qty), 0)', 'total')
      .from('stock', 's')
      .where('s."barangId" IN (:...ids)', { ids: items.map((item) => item.id) })
      .groupBy('s."barangId"')
      .getRawMany();
    const totals = new Map(rows.map((row) => [Number(row.barang_id), Number(row.total || 0)]));
    return items.map((item) => Object.assign(item, { stok: totals.get(item.id) || 0 }));
  }

  @Get('paged')
  async find_paged(
    @Query('page') page = '1',
    @Query('limit') limit = '20',
    @Query('search') search = '',
  ) {
    const currentPage = Math.max(1, Number(page) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(limit) || 20));
    const where: any = search
      ? [
          { deleted_at: IsNull(), nama: ILike(`%${search}%`) },
          { deleted_at: IsNull(), sku: ILike(`%${search}%`) },
        ]
      : { deleted_at: IsNull() };
    const [data, total] = await this.repo.findAndCount({
      where,
      order: { id: 'ASC' },
      skip: (currentPage - 1) * pageSize,
      take: pageSize,
    });
    return { data: await this.with_current_stock(data), total, page: currentPage, limit: pageSize, totalPages: Math.max(1, Math.ceil(total / pageSize)) };
  }

  @Get()
  async find_all(
    @Query('side') side?: string,
    @Query('search') search?: string,
    @Query('kategori') kategori?: string,
  ) {
    const where: any = { deleted_at: IsNull() };
    if (side === 'true') where.side = true;
    if (side === 'false') where.side = false;
    if (kategori) where.kategori = kategori;
    if (search) where.nama = ILike(`%${search}%`);
    const items = await this.repo.find({ where, order: { id: 'ASC' } });
    return this.with_current_stock(items);
  }

  @Get(':id')
  find_one(@Param('id') id: number) {
    return this.repo.findOne({ where: { id, deleted_at: IsNull() } });
  }

  @Post()
  @Roles(UserRole.SUPERVISOR, UserRole.SUPER_ADMIN)
  async create(@Body() dto: CreateBarangDto) {
    // Check duplicate nama
    if (dto.nama) {
      const existing = await this.repo.findOne({ where: { nama: dto.nama, deleted_at: IsNull() } });
      if (existing)
        throw new ConflictException(`Produk "${dto.nama}" sudah ada`);
    }
    // Auto-set side based on kategori
    const data: any = { ...dto };
    const kat = dto.kategori ? dto.kategori.trim().toLowerCase() : '';
    if (kat === 'wet' || kat === 'waste') {
      data.side = false;
      data.kategori = (kat === 'wet' ? 'Wet' : 'Waste') as any;
    } else {
      data.side = true;
      data.kategori = 'Dry' as any;
    }
    if (!dto.sku) data.sku = `BRG${String(Date.now()).slice(-6)}`;
    return this.repo.save(this.repo.create(data));
  }

  @Put(':id')
  @Roles(UserRole.SUPERVISOR, UserRole.SUPER_ADMIN)
  async update(@Param('id') id: number, @Body() dto: UpdateBarangDto) {
    // Check duplicate nama
    if (dto.nama) {
      const existing = await this.repo.findOne({ where: { nama: dto.nama, deleted_at: IsNull() } });
      if (existing && existing.id !== id)
        throw new ConflictException(`Produk "${dto.nama}" sudah ada`);
    }
    const data: any = { ...dto };
    if (dto.kategori) {
      const kat = dto.kategori.trim().toLowerCase();
      if (kat === 'wet' || kat === 'waste') {
        data.side = false;
        data.kategori = (kat === 'wet' ? 'Wet' : 'Waste') as any;
      } else {
        data.side = true;
        data.kategori = 'Dry' as any;
      }
    }
    await this.repo.update(id, data);
    return this.repo.findOne({ where: { id, deleted_at: IsNull() } });
  }

  @Delete(':id')
  @Roles(UserRole.SUPERVISOR, UserRole.SUPER_ADMIN)
  async remove(@Param('id') id: string, @Query('cascade') cascade?: string) {
    const num_id = +id;
    if (cascade === 'true') {
      // Hapus outbound_ayam dulu — nama kolom FK yg benar: "planningAyamId" (fully camelCase TypeORM)
      try { await this.repo.manager.query(`DELETE FROM outbound_ayam WHERE "planningAyamId" IN (SELECT id FROM planning_ayam WHERE "barangId" = $1)`, [num_id]); } catch (e) {}
      try { await this.repo.manager.query(`DELETE FROM outbound_ayam WHERE planning_ayam_id IN (SELECT id FROM planning_ayam WHERE "barangId" = $1)`, [num_id]); } catch (e) {}
      // Hapus planning_ayam
      try { await this.repo.manager.query(`DELETE FROM planning_ayam WHERE "barangId" = $1`, [num_id]); } catch (e) {}
      // Hapus relocation (FK ke stock)
      try { await this.repo.manager.query(`DELETE FROM relocation WHERE "sourceStockId" IN (SELECT id FROM stock WHERE "barangId" = $1)`, [num_id]); } catch (e) {}
      try { await this.repo.manager.query(`DELETE FROM relocation WHERE source_stock_id IN (SELECT id FROM stock WHERE "barangId" = $1)`, [num_id]); } catch (e) {}
      // Null-kan FK di gudang
      try { await this.repo.manager.query(`UPDATE gudang SET "barangId" = NULL WHERE "barangId" = $1`, [num_id]); } catch (e) {}
      try { await this.repo.manager.query(`UPDATE gudang SET barang_id = NULL WHERE barang_id = $1`, [num_id]); } catch (e) {}
      // Hapus stock_log, stock, transaksi
      try { await this.repo.manager.query(`DELETE FROM stock_log WHERE "barangId" = $1`, [num_id]); } catch (e) {}
      try { await this.repo.manager.query(`DELETE FROM stock_log WHERE barang_id = $1`, [num_id]); } catch (e) {}
      try { await this.repo.manager.query(`DELETE FROM stock WHERE "barangId" = $1`, [num_id]); } catch (e) {}
      try { await this.repo.manager.query(`DELETE FROM stock WHERE barang_id = $1`, [num_id]); } catch (e) {}
      try { await this.repo.manager.query(`DELETE FROM transaksi WHERE "barangId" = $1`, [num_id]); } catch (e) {}
      try { await this.repo.manager.query(`DELETE FROM transaksi WHERE barang_id = $1`, [num_id]); } catch (e) {}
      try {
        await this.repo.delete(num_id);
      } catch (err: any) {
        throw new ConflictException(`Gagal hapus barang (ada relasi tersisa): ${err?.message || err}`);
      }
      return { deleted: true, cascade: true };
    }
    await this.repo.update(num_id, { deleted_at: new Date() });
    return { deleted: true };
  }
}
