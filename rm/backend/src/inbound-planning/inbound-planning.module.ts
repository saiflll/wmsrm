import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { InboundPlanning } from './inbound-planning.entity';
import { Stock } from '../inventory/stock.entity';
import { StockLog } from '../inventory/stock-log.entity';
import { Barang } from '../barang/barang.entity';
import { Gudang } from '../gudang/gudang.entity';
import { Shift } from '../shifts/shift.entity';
import { InboundPlanningService } from './inbound-planning.service';
import { InboundPlanningController } from './inbound-planning.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      InboundPlanning,
      Stock,
      StockLog,
      Barang,
      Gudang,
      Shift,
    ]),
  ],
  controllers: [InboundPlanningController],
  providers: [InboundPlanningService],
  exports: [InboundPlanningService],
})
export class InboundPlanningModule {}
