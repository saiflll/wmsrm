import { Controller, Get, Post, Put, Body, Query, UseGuards, Request } from '@nestjs/common';
import { FgPickingListService } from './fg-picking-list.service.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { RolesGuard } from '../auth/roles.guard.js';
import { Roles } from '../auth/roles.decorator.js';

@Controller('picking-list')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('KOORDINATOR_OUT', 'SUPERVISOR', 'ADMIN')
export class FgPickingListController {
  constructor(private pickingService: FgPickingListService) {}

  @Post()
  async create(@Body() body: any, @Request() req) {
    body.namaUser = req.user.username;
    return this.pickingService.createPickingList(body);
  }

  @Get()
  async getList(@Query('nomorPO') nomorPO?: string, @Query('startDate') startDate?: string, @Query('endDate') endDate?: string) {
    return this.pickingService.getPickingList(nomorPO, startDate, endDate);
  }

  @Put('approve')
  async approve(@Body() body: { nomorPO: string; items?: { namaBarang: string; qtyPo: number }[] }, @Request() req) {
    return this.pickingService.approve(body.nomorPO, body.items || [], req.user.username);
  }

  @Get('print')
  async getPrintData(@Query('nomorPO') nomorPO: string) {
    return this.pickingService.getPrintData(nomorPO);
  }
}
