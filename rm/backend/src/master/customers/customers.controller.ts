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
import { Customer } from './customer.entity';
import { JwtAuthGuard } from '../../admin/auth/jwt-auth.guard';

import { RolesGuard } from '../../admin/auth/roles.guard';
import { Roles } from '../../admin/auth/roles.decorator';
import { UserRole } from '../../admin/users/user.entity';

@Controller('customers')
@UseGuards(JwtAuthGuard, RolesGuard)
export class CustomersController {
  constructor(@InjectRepository(Customer) private repo: Repository<Customer>) {}

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
          { deleted_at: IsNull(), alamat: ILike(`%${search}%`) },
        ]
      : { deleted_at: IsNull() };
    const [data, total] = await this.repo.findAndCount({
      where, order: { created_at: 'DESC' },
      skip: (currentPage - 1) * pageSize, take: pageSize,
    });
    return { data, total, page: currentPage, limit: pageSize, totalPages: Math.max(1, Math.ceil(total / pageSize)) };
  }

  @Get()
  find_all(@Query('search') search?: string) {
    const where: any = { deleted_at: IsNull() };
    if (search) where.nama = ILike(`%${search}%`);
    return this.repo.find({ where, order: { created_at: 'DESC' } });
  }

  @Get(':id')
  find_one(@Param('id') id: number) {
    return this.repo.findOne({ where: { id, deleted_at: IsNull() } });
  }

  @Post()
  @Roles(UserRole.SUPERVISOR, UserRole.SUPER_ADMIN)
  async create(@Body() body: Partial<Customer>) {
    if (body.nama) {
      const existing = await this.repo.findOne({ where: { nama: body.nama, deleted_at: IsNull() } });
      if (existing)
        throw new ConflictException(`Customer "${body.nama}" sudah ada`);
    }
    return this.repo.save(this.repo.create(body));
  }

  @Put(':id')
  @Roles(UserRole.SUPERVISOR, UserRole.SUPER_ADMIN)
  async update(@Param('id') id: number, @Body() body: Partial<Customer>) {
    if (body.nama) {
      const existing = await this.repo.findOne({ where: { nama: body.nama, deleted_at: IsNull() } });
      if (existing && existing.id !== id)
        throw new ConflictException(`Customer "${body.nama}" sudah ada`);
    }
    await this.repo.update(id, body);
    return this.repo.findOne({ where: { id, deleted_at: IsNull() } });
  }

  @Delete(':id')
  @Roles(UserRole.SUPERVISOR, UserRole.SUPER_ADMIN)
  async remove(@Param('id') id: string, @Query('cascade') cascade?: string) {
    const num_id = +id;
    if (cascade === 'true') {
      try { await this.repo.manager.query(`DELETE FROM transaksi WHERE suplayer_id = $1 OR "suplayer_id" = $1 OR "customerId" = $1 OR customer_id = $1`, [num_id]); } catch (e) {}
      try { await this.repo.manager.query(`UPDATE planning_outbound SET "customerId" = NULL WHERE "customerId" = $1`, [num_id]); } catch (e) {}
      try { await this.repo.manager.query(`UPDATE planning_outbound SET customer_id = NULL WHERE customer_id = $1`, [num_id]); } catch (e) {}
      try {
        await this.repo.delete(num_id);
      } catch (err: any) {
        throw new ConflictException(`Gagal hapus customer (ada relasi tersisa): ${err?.message || err}`);
      }
      return { deleted: true, cascade: true };
    }
    await this.repo.update(num_id, { deleted_at: new Date() });
    return { deleted: true };
  }
}
