import { Controller, Get, Post, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { FgKoordinator } from './fg-koordinator.entity.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';

@Controller('master-koordinator')
@UseGuards(JwtAuthGuard)
export class FgMasterKoordinatorController {
  constructor(@InjectRepository(FgKoordinator) private repo: Repository<FgKoordinator>) {}

  @Get()
  async findAll() { return this.repo.find({ order: { nama: 'ASC' } }); }

  @Post()
  async create(@Body() body: { nama: string; shift: string }) { return this.repo.save(this.repo.create(body)); }

  @Delete(':id')
  async remove(@Param('id') id: number) { await this.repo.delete(id); return { ok: true }; }
}
