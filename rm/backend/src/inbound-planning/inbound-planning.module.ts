import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { InboundPlanning } from './inbound-planning.entity';
import { InboundPlanningService } from './inbound-planning.service';
import { InboundPlanningController } from './inbound-planning.controller';

@Module({
    imports: [TypeOrmModule.forFeature([InboundPlanning])],
    controllers: [InboundPlanningController],
    providers: [InboundPlanningService],
    exports: [InboundPlanningService],
})
export class InboundPlanningModule { }
