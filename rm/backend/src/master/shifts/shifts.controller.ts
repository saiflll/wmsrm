import { Controller, Get, UseGuards } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Shift } from './shift.entity';
import { JwtAuthGuard } from '../../admin/auth/jwt-auth.guard';

@Controller('shifts')
@UseGuards(JwtAuthGuard)
export class ShiftsController {
  constructor(@InjectRepository(Shift) private repo: Repository<Shift>) {}

  @Get()
  findAll() {
    return this.repo.find({ order: { id: 'ASC' } });
  }
}
