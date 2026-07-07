import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FgStock } from './fg-stock.entity.js';
import { FgRelasiRakBatch } from './fg-relasi-rak-batch.entity.js';
import { FgBarang } from '../master-barang/fg-barang.entity.js';
import { FgRak } from '../master-rak/fg-rak.entity.js';
import { FgStatus } from '../master-status/fg-status.entity.js';
import { FgStockService } from './fg-stock.service.js';
import { FgStockController } from './fg-stock.controller.js';
import { FgMutasiModule } from '../mutasi/fg-mutasi.module.js';

@Module({
  imports: [TypeOrmModule.forFeature([FgStock, FgRelasiRakBatch, FgBarang, FgRak, FgStatus]), FgMutasiModule],
  controllers: [FgStockController],
  providers: [FgStockService],
  exports: [FgStockService],
})
export class FgStockModule {}
