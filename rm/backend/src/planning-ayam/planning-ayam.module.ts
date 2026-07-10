import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PlanningAyam } from './planning-ayam.entity';
import { PlanningAyamService } from './planning-ayam.service';
import { PlanningAyamController } from './planning-ayam.controller';
import { Barang } from '../barang/barang.entity';
import { Shift } from '../shifts/shift.entity';

@Module({
    imports: [TypeOrmModule.forFeature([PlanningAyam, Barang, Shift])],
    controllers: [PlanningAyamController],
    providers: [PlanningAyamService],
    exports: [PlanningAyamService],
})
export class PlanningAyamModule { }
