import { Controller, Get, Post, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { FgStatus } from './fg-status.entity.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';

@Controller('master-status')
@UseGuards(JwtAuthGuard)
export class FgMasterStatusController {
  constructor(@InjectRepository(FgStatus) private repo: Repository<FgStatus>) {}

  @Get()
  async findAll() { return this.repo.find(); }

  @Post()
  async create(@Body() body: { status: string }) { return this.repo.save(this.repo.create(body)); }

  @Delete(':id')
  async remove(@Param('id') id: number) { await this.repo.delete(id); return { ok: true }; }
}
