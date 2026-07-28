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

  @Get()
  findAll(@Query('search') search?: string) {
    const where: any = { deleted_at: IsNull() };
    if (search) where.nama = ILike(`%${search}%`);
    return this.repo.find({ where, order: { created_at: 'DESC' } });
  }

  @Get(':id')
  findOne(@Param('id') id: number) {
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
    const numId = +id;
    if (cascade === 'true') {
      try { await this.repo.manager.query(`DELETE FROM transaksi WHERE suplayer_id = $1 OR "suplayer_id" = $1 OR "customerId" = $1`, [numId]); } catch (e) {}
      await this.repo.delete(numId);
      return { deleted: true, cascade: true };
    }
    await this.repo.update(numId, { deleted_at: new Date() });
    return { deleted: true };
  }
}
