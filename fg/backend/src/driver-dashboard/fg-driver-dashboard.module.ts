import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FgOtdrEvidence } from './fg-otdr-evidence.entity.js';
import { FgDriverDashboardService } from './fg-driver-dashboard.service.js';
import { FgDriverDashboardController } from './fg-driver-dashboard.controller.js';
import { FgOtdrModule } from '../otdr/fg-otdr.module.js';

@Module({
  imports: [TypeOrmModule.forFeature([FgOtdrEvidence]), FgOtdrModule],
  controllers: [FgDriverDashboardController],
  providers: [FgDriverDashboardService],
})
export class FgDriverDashboardModule {}
