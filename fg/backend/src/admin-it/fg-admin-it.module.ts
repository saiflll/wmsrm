import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FgAdminIT } from './fg-admin-it.entity.js';
import { FgBarangMasuk } from '../barang-masuk/fg-barang-masuk.entity.js';
import { FgBarangKeluar } from '../barang-keluar/fg-barang-keluar.entity.js';
import { FgStock } from '../stock/fg-stock.entity.js';
import { FgMutasi } from '../mutasi/fg-mutasi.entity.js';
import { FgOtdr } from '../otdr/fg-otdr.entity.js';
import { FgAdminItService } from './fg-admin-it.service.js';
import { FgAdminItController } from './fg-admin-it.controller.js';

@Module({
  imports: [TypeOrmModule.forFeature([FgAdminIT, FgBarangMasuk, FgBarangKeluar, FgStock, FgMutasi, FgOtdr])],
  controllers: [FgAdminItController],
  providers: [FgAdminItService],
})
export class FgAdminItModule {}
