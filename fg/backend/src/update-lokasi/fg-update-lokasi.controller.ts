import { Controller, Get, Post, Body, Query, UseGuards, Request } from '@nestjs/common';
import { FgUpdateLokasiService } from './fg-update-lokasi.service.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { RolesGuard } from '../auth/roles.guard.js';
import { Roles } from '../auth/roles.decorator.js';

@Controller('update-lokasi')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('INVENTORY', 'SUPERVISOR')
export class FgUpdateLokasiController {
  constructor(private lokasiService: FgUpdateLokasiService) {}

  @Post()
  async update(@Body() body: any, @Request() req) {
    body.namaUser = req.user.username;
    return this.lokasiService.updateLokasi(body);
  }

  @Post('bulk')
  async bulkUpdate(@Body() body: any, @Request() req) {
    body.namaUser = req.user.username;
    return this.lokasiService.bulkUpdateLokasi(body);
  }

  @Get('log')
  async getLog(@Query('idStock') idStock?: string) {
    return this.lokasiService.getLog(idStock);
  }
}
