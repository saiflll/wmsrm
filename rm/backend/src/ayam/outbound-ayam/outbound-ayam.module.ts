import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OutboundAyam } from './outbound-ayam.entity';
import { OutboundAyamService } from './outbound-ayam.service';
import { OutboundAyamController } from './outbound-ayam.controller';
import { PlanningAyam } from '../planning-ayam/planning-ayam.entity';
import { Shift } from '../../master/shifts/shift.entity';
import { Stock } from '../../management/inventory/stock.entity';
import { StockLog } from '../../management/inventory/stock-log.entity';
import { Barang } from '../../master/barang/barang.entity';
import { Gudang } from '../../master/gudang/gudang.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      OutboundAyam,
      PlanningAyam,
      Shift,
      Stock,
      StockLog,
      Barang,
      Gudang,
    ]),
  ],
  controllers: [OutboundAyamController],
  providers: [OutboundAyamService],
  exports: [OutboundAyamService],
})
export class OutboundAyamModule {}
