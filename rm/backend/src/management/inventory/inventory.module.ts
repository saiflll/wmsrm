import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Stock } from './stock.entity';
import { StockLog } from './stock-log.entity';
import { Barang } from '../../master/barang/barang.entity';
import { Gudang } from '../../master/gudang/gudang.entity';
import { Shift } from '../../master/shifts/shift.entity';
import { InboundPlanning } from '../../inbound/inbound-planning/inbound-planning.entity';
import { PlanningAyam } from '../../ayam/planning-ayam/planning-ayam.entity';
import { OutboundAyam } from '../../ayam/outbound-ayam/outbound-ayam.entity';
import { InventoryService } from './inventory.service';
import { InventoryController } from './inventory.controller';
import { RelocationModule } from '../relocation/relocation.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Stock,
      StockLog,
      Barang,
      Gudang,
      Shift,
      InboundPlanning,
      PlanningAyam,
      OutboundAyam,
    ]),
    RelocationModule,
  ],
  controllers: [InventoryController],
  providers: [InventoryService],
  exports: [InventoryService],
})
export class InventoryModule {}
