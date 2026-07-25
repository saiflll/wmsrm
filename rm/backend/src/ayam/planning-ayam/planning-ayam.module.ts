import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PlanningAyam } from './planning-ayam.entity';
import { PlanningAyamService } from './planning-ayam.service';
import { PlanningAyamController } from './planning-ayam.controller';
import { Barang } from '../../master/barang/barang.entity';
import { Shift } from '../../master/shifts/shift.entity';
import { OutboundAyam } from '../outbound-ayam/outbound-ayam.entity';
import { Stock } from '../../management/inventory/stock.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      PlanningAyam,
      Barang,
      Shift,
      OutboundAyam,
      Stock,
    ]),
  ],
  controllers: [PlanningAyamController],
  providers: [PlanningAyamService],
  exports: [PlanningAyamService],
})
export class PlanningAyamModule {}
