import { Controller, Get, Post, Put, Body, Query, Param, UseGuards, Request } from '@nestjs/common';
import { FgAdminItService } from './fg-admin-it.service.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { RolesGuard } from '../auth/roles.guard.js';
import { Roles } from '../auth/roles.decorator.js';

@Controller('admin-it')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN', 'SUPERVISOR')
export class FgAdminItController {
  constructor(private adminItService: FgAdminItService) {}

  @Post()
  async submit(@Body() body: any, @Request() req) {
    return this.adminItService.submitRows({ rows: body.rows, namaUser: req.user.username });
  }

  @Get()
  async getList(@Query('startDate') startDate?: string, @Query('endDate') endDate?: string) {
    return this.adminItService.getList(startDate, endDate);
  }

  @Get('transactions')
  async getTransactions(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('jenis') jenis?: string,
  ) {
    return this.adminItService.getTransactions({ startDate, endDate, jenis });
  }

  @Put('barang-masuk/:id/it-terima')
  async updateBarangMasukITTerima(@Param('id') id: number, @Body() body: any, @Request() req) {
    return this.adminItService.updateBarangMasukITTerima(id, body.nomorITTerima || '', req.user.username);
  }

  @Put('barang-keluar/:id/it-kirim')
  async updateBarangKeluarITKirim(@Param('id') id: number, @Body() body: any, @Request() req) {
    return this.adminItService.updateBarangKeluarITKirim(id, body.nomorITKirim || '', req.user.username);
  }
}
