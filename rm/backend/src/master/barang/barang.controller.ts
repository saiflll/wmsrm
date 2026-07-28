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

  @Get()
  async findAll(
    @Query('side') side?: string,
    @Query('search') search?: string,
    @Query('kategori') kategori?: string,
  ) {
    const where: any = { deleted_at: IsNull() };
    if (side === 'true') where.side = true;
    if (side === 'false') where.side = false;
    if (kategori) where.kategori = kategori;
    if (search) where.nama = ILike(`%${search}%`);
    return this.repo.find({ where, order: { id: 'ASC' } });
  }

  @Get(':id')
  findOne(@Param('id') id: number) {
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
    const numId = +id;
    if (cascade === 'true') {
      try { await this.repo.manager.query(`UPDATE gudang SET "barangId" = NULL WHERE "barangId" = $1`, [numId]); } catch (e) {}
      try { await this.repo.manager.query(`UPDATE gudang SET barang_id = NULL WHERE barang_id = $1`, [numId]); } catch (e) {}
      try { await this.repo.manager.query(`DELETE FROM stock_log WHERE barang_id = $1 OR "barangId" = $1`, [numId]); } catch (e) {}
      try { await this.repo.manager.query(`DELETE FROM stock WHERE barang_id = $1 OR "barangId" = $1`, [numId]); } catch (e) {}
      try { await this.repo.manager.query(`DELETE FROM transaksi WHERE barang_id = $1 OR "barangId" = $1`, [numId]); } catch (e) {}
      try { await this.repo.manager.query(`DELETE FROM planning_ayam WHERE barang_id = $1 OR "barangId" = $1`, [numId]); } catch (e) {}
      await this.repo.delete(numId);
      return { deleted: true, cascade: true };
    }
    await this.repo.update(numId, { deleted_at: new Date() });
    return { deleted: true };
  }
}
