import { Controller, Get, Post, Body, Query, UseGuards, Request } from '@nestjs/common';
import { FgStockService } from './fg-stock.service.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';

@Controller('stock')
@UseGuards(JwtAuthGuard)
export class FgStockController {
  constructor(private stockService: FgStockService) {}

  @Get()
  async findAll(@Query('available') available?: string) {
    return this.stockService.findAll(available !== 'false');
  }

  @Get('summary')
  async getSummary() {
    return this.stockService.getSummary();
  }

  @Get('expiring')
  async getExpiring(@Query('days') days?: string) {
    return this.stockService.getExpiringSoon(days ? parseInt(days) : 30);
  }

  @Get('per-item')
  async getPerItem() {
    return this.stockService.getPerItemSummary();
  }

  @Get('by-rak')
  async findByRak(@Query('rak') rak: string) {
    const stocks = await this.stockService.findAll(false);
    return stocks.filter(s => s.lokasiRak === rak);
  }

  @Post('import-csv')
  async importCsv(@Body() body: any, @Request() req) {
    return this.stockService.importCsv(body.csvText || '', req.user.username);
  }
}
