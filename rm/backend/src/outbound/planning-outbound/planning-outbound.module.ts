import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PlanningOutbound } from './planning-outbound.entity';
import { PlanningOutboundService } from './planning-outbound.service';
import { PlanningOutboundController } from './planning-outbound.controller';
import { Customer } from '../../master/customers/customer.entity';
import { Shift } from '../../master/shifts/shift.entity';
import { Stock } from '../../management/inventory/stock.entity';
import { StockLog } from '../../management/inventory/stock-log.entity';
import { Barang } from '../../master/barang/barang.entity';
import { Gudang } from '../../master/gudang/gudang.entity';

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
