import { Controller, Get, Post, Delete, Body, Query, Param, UseGuards, Request } from '@nestjs/common';
import { FgBarangMasukService } from './fg-barang-masuk.service.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { RolesGuard } from '../auth/roles.guard.js';
import { Roles } from '../auth/roles.decorator.js';

@Controller('barang-masuk')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('KOORDINATOR_IN', 'SUPERVISOR')
export class FgBarangMasukController {
  constructor(private bmService: FgBarangMasukService) {}

  @Post()
  async submit(@Body() body: any, @Request() req) {
    body.namaUserTransaksi = req.user.username;
    const result = await this.bmService.submitBarangMasuk(body);
    if (body.noticeConfirmed && body.noticeKeyData) {
      await this.bmService.logNotice({
        jenisTransaksi: 'BARANG_MASUK',
        levelNotice: 'DIKONFIRMASI USER',
        keyData: body.noticeKeyData,
        pesanNotice: body.noticeMessage || 'Disimpan setelah konfirmasi notice',
        userKoordinator: req.user.username,
        statusTindakan: 'TETAP DISIMPAN SETELAH KONFIRMASI',
      });
    }
    return result;
  }

  @Post('check-notice')
  async checkNotice(@Body() body: any, @Request() req) {
    body.namaUserTransaksi = req.user.username;
    return this.bmService.checkNotice(body);
  }

  @Get()
  async getList(@Query('startDate') startDate?: string, @Query('endDate') endDate?: string) {
    return this.bmService.getBarangMasukList(startDate, endDate);
  }

  @Delete(':id/rollback')
  async rollback(@Param('id') id: number, @Request() req) {
    return this.bmService.rollback(id, req.user.username);
  }
}
