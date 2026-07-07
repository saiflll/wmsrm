import { Controller, Get, Post, Put, Delete, Body, Query, Param, UseGuards, Request } from '@nestjs/common';
import { FgBarangKeluarService } from './fg-barang-keluar.service.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { RolesGuard } from '../auth/roles.guard.js';
import { Roles } from '../auth/roles.decorator.js';

@Controller('barang-keluar')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('KOORDINATOR_OUT', 'SUPERVISOR')
export class FgBarangKeluarController {
  constructor(private bkService: FgBarangKeluarService) {}

  @Post()
  async submit(@Body() body: any, @Request() req) {
    body.namaUserTransaksi = req.user.username;
    const result = await this.bkService.submitBarangKeluar(body);
    if (body.noticeConfirmed && body.noticeKeyData) {
      await this.bkService.logNotice({
        jenisTransaksi: 'BARANG_KELUAR',
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
    return this.bkService.checkNotice(body);
  }

  @Post('from-picking')
  async submitFromPicking(@Body() body: any, @Request() req) {
    body.namaUserTransaksi = req.user.username;
    return this.bkService.submitBarangKeluarFromPickingList(body);
  }

  @Put('edit')
  async edit(@Body() body: any, @Request() req) {
    body.namaUser = req.user.username;
    return this.bkService.editQtyKeluar(body);
  }

  @Get()
  async getList(@Query('startDate') startDate?: string, @Query('endDate') endDate?: string, @Query('keyword') keyword?: string) {
    return this.bkService.getBarangKeluarList(startDate, endDate, keyword);
  }

  @Delete(':id/rollback')
  async rollback(@Param('id') id: number, @Request() req) {
    return this.bkService.rollback(id, req.user.username);
  }
}
