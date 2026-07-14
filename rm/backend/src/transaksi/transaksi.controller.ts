import { Controller, Get, Post, Body, UseGuards } from '@nestjs/common';
import { TransaksiService } from './transaksi.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('transaksi')
@UseGuards(JwtAuthGuard)
export class TransaksiController {
  constructor(private readonly transaksiService: TransaksiService) {}

  @Get()
  findAll() {
    return this.transaksiService.findAll();
  }

  @Post()
  create(@Body() body: any) {
    return this.transaksiService.create(body);
  }
}
