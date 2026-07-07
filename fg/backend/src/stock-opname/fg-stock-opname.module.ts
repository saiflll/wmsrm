import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FgStockOpname } from './fg-stock-opname.entity.js';
import { FgStockOpnameItem } from './fg-stock-opname-item.entity.js';
import { FgStockOpnameController } from './fg-stock-opname.controller.js';
import { FgStockOpnameService } from './fg-stock-opname.service.js';
import { FgStockModule } from '../stock/fg-stock.module.js';
import { FgMutasiModule } from '../mutasi/fg-mutasi.module.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([FgStockOpname, FgStockOpnameItem]),
    FgStockModule,
    FgMutasiModule,
  ],
  controllers: [FgStockOpnameController],
  providers: [FgStockOpnameService],
  exports: [FgStockOpnameService],
})
export class FgStockOpnameModule {}
