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
import { Repository, ILike } from 'typeorm';
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
    // Self-heal records on request to fix any historic casing mismatches
    try {
      const all = await this.repo.find();
      for (const b of all) {
        const kat = b.kategori ? b.kategori.trim().toLowerCase() : '';
        const expectedSide = !(kat === 'wet' || kat === 'waste');
        const expectedKatName =
          kat === 'wet' ? 'Wet' : kat === 'waste' ? 'Waste' : 'Dry';
        if (b.side !== expectedSide || b.kategori !== expectedKatName) {
          b.side = expectedSide;
          b.kategori = expectedKatName as any;
          await this.repo.save(b);
        }
      }
    } catch (e) {
      console.error('Self-heal failed:', e);
    }

    const where: any = {};
    if (side === 'true') where.side = true;
    if (side === 'false') where.side = false;
    if (kategori) where.kategori = kategori;
    if (search) where.nama = ILike(`%${search}%`);
    return this.repo.find({ where, order: { id: 'ASC' } });
  }

  @Get(':id')
  findOne(@Param('id') id: number) {
    return this.repo.findOneBy({ id });
  }

  @Post()
  @Roles(UserRole.SUPERVISOR, UserRole.SUPER_ADMIN)
  async create(@Body() dto: CreateBarangDto) {
    // Check duplicate nama
    if (dto.nama) {
      const existing = await this.repo.findOne({ where: { nama: dto.nama } });
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
      const existing = await this.repo.findOne({ where: { nama: dto.nama } });
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
    return this.repo.findOneBy({ id });
  }

  @Delete(':id')
  @Roles(UserRole.SUPERVISOR, UserRole.SUPER_ADMIN)
  async remove(@Param('id') id: number) {
    await this.repo.delete(id);
    return { deleted: true };
  }
}
