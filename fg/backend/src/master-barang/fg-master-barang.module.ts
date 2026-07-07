import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FgBarang } from './fg-barang.entity.js';
import { FgMasterBarangController } from './fg-master-barang.controller.js';

@Module({
  imports: [TypeOrmModule.forFeature([FgBarang])],
  controllers: [FgMasterBarangController],
  exports: [TypeOrmModule],
})
export class FgMasterBarangModule {}
