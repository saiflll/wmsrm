import { Controller, Get, Post, Body, Query, UseGuards, Request } from '@nestjs/common';
import { FgMutasiService } from './fg-mutasi.service.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';

@Controller('mutasi')
@UseGuards(JwtAuthGuard)
export class FgMutasiController {
  constructor(private mutasiService: FgMutasiService) {}

  @Get()
  async getList(@Query('jenis') jenis?: string, @Query('startDate') startDate?: string, @Query('endDate') endDate?: string) {
    return this.mutasiService.getMutasiList(jenis, startDate, endDate);
  }

  @Get('export')
  async getExport(@Query('startDate') startDate: string, @Query('endDate') endDate: string) {
    return this.mutasiService.getExportData(startDate, endDate);
  }
}
