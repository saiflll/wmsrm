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
import { Customer } from './customer.entity';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('customers')
@UseGuards(JwtAuthGuard)
export class CustomersController {
  constructor(@InjectRepository(Customer) private repo: Repository<Customer>) {}

  @Get()
  findAll(@Query('search') search?: string) {
    const where = search ? { nama: ILike(`%${search}%`) } : {};
    return this.repo.find({ where, order: { created_at: 'DESC' } });
  }

  @Get(':id')
  findOne(@Param('id') id: number) {
    return this.repo.findOneBy({ id });
  }

  @Post()
  async create(@Body() body: Partial<Customer>) {
    if (body.nama) {
      const existing = await this.repo.findOne({ where: { nama: body.nama } });
      if (existing)
        throw new ConflictException(`Customer "${body.nama}" sudah ada`);
    }
    return this.repo.save(this.repo.create(body));
  }

  @Put(':id')
  async update(@Param('id') id: number, @Body() body: Partial<Customer>) {
    if (body.nama) {
      const existing = await this.repo.findOne({ where: { nama: body.nama } });
      if (existing && existing.id !== id)
        throw new ConflictException(`Customer "${body.nama}" sudah ada`);
    }
    await this.repo.update(id, body);
    return this.repo.findOneBy({ id });
  }

  @Delete(':id')
  async remove(@Param('id') id: number) {
    await this.repo.delete(id);
    return { deleted: true };
  }
}
