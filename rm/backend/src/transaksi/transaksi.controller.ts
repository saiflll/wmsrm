import { Controller, Get, Post, Body, UseGuards } from '@nestjs/common';
import { TransaksiService } from './transaksi.service';
import { JwtAuthGuard } from '../admin/auth/jwt-auth.guard';

@Controller('transaksi')
@UseGuards(JwtAuthGuard)
export class TransaksiController {
  constructor(private readonly transaksi_service: TransaksiService) {}

  @Get()
  find_all() {
    return this.transaksi_service.find_all();
  }

  @Post()
  create(@Body() body: any) {
    return this.transaksi_service.create(body);
  }
}
