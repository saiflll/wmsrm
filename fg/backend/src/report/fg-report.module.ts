import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FgMutasi } from '../mutasi/fg-mutasi.entity.js';
import { FgReportController } from './fg-report.controller.js';

@Module({
  imports: [TypeOrmModule.forFeature([FgMutasi])],
  controllers: [FgReportController],
})
export class FgReportModule {}
