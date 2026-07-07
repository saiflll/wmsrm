import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FgRak } from './fg-rak.entity.js';
import { FgBarangKeluar } from '../barang-keluar/fg-barang-keluar.entity.js';
import { FgStock } from '../stock/fg-stock.entity.js';
import { FgMasterRakController } from './fg-master-rak.controller.js';

@Module({
  imports: [TypeOrmModule.forFeature([FgRak, FgBarangKeluar, FgStock])],
  controllers: [FgMasterRakController],
  exports: [TypeOrmModule],
})
export class FgMasterRakModule {}
