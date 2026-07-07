import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FgStatus } from './fg-status.entity.js';
import { FgMasterStatusController } from './fg-master-status.controller.js';

@Module({
  imports: [TypeOrmModule.forFeature([FgStatus])],
  controllers: [FgMasterStatusController],
  exports: [TypeOrmModule],
})
export class FgMasterStatusModule {}
