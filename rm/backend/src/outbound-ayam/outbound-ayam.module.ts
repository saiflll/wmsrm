import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OutboundAyam } from './outbound-ayam.entity';
import { OutboundAyamService } from './outbound-ayam.service';
import { OutboundAyamController } from './outbound-ayam.controller';
import { PlanningAyam } from '../planning-ayam/planning-ayam.entity';
import { Shift } from '../shifts/shift.entity';

@Module({
    imports: [TypeOrmModule.forFeature([OutboundAyam, PlanningAyam, Shift])],
    controllers: [OutboundAyamController],
    providers: [OutboundAyamService],
    exports: [OutboundAyamService],
})
export class OutboundAyamModule { }
