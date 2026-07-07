import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FgLogLokasi } from './fg-log-lokasi.entity.js';
import { FgUpdateLokasiService } from './fg-update-lokasi.service.js';
import { FgUpdateLokasiController } from './fg-update-lokasi.controller.js';
import { FgStockModule } from '../stock/fg-stock.module.js';

@Module({
  imports: [TypeOrmModule.forFeature([FgLogLokasi]), FgStockModule],
  controllers: [FgUpdateLokasiController],
  providers: [FgUpdateLokasiService],
})
export class FgUpdateLokasiModule {}
