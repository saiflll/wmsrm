import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PlanningOutbound } from './planning-outbound.entity';
import { PlanningOutboundService } from './planning-outbound.service';
import { PlanningOutboundController } from './planning-outbound.controller';
import { Customer } from '../customers/customer.entity';
import { Shift } from '../shifts/shift.entity';
import { Stock } from '../inventory/stock.entity';
import { StockLog } from '../inventory/stock-log.entity';
import { Barang } from '../barang/barang.entity';
import { Gudang } from '../gudang/gudang.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      PlanningOutbound,
      Customer,
      Shift,
      Stock,
      StockLog,
      Barang,
      Gudang,
    ]),
  ],
  controllers: [PlanningOutboundController],
  providers: [PlanningOutboundService],
  exports: [PlanningOutboundService],
})
export class PlanningOutboundModule {}
