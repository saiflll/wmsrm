import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FgKoordinator } from './fg-koordinator.entity.js';
import { FgMasterKoordinatorController } from './fg-master-koordinator.controller.js';

@Module({
  imports: [TypeOrmModule.forFeature([FgKoordinator])],
  controllers: [FgMasterKoordinatorController],
  exports: [TypeOrmModule],
})
export class FgMasterKoordinatorModule {}
