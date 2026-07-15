import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Stock } from './stock.entity';
import { StockLog } from './stock-log.entity';
import { Barang } from '../barang/barang.entity';
import { Gudang } from '../gudang/gudang.entity';
import { Shift } from '../shifts/shift.entity';
import { InboundPlanning } from '../inbound-planning/inbound-planning.entity';
import { PlanningAyam } from '../planning-ayam/planning-ayam.entity';
import { OutboundAyam } from '../outbound-ayam/outbound-ayam.entity';
import { InventoryService } from './inventory.service';
import { InventoryController } from './inventory.controller';

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
  ],
  controllers: [InventoryController],
  providers: [InventoryService],
  exports: [InventoryService],
})
export class InventoryModule {}
