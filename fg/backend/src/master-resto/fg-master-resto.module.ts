import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FgResto } from './fg-resto.entity.js';
import { FgMasterRestoController } from './fg-master-resto.controller.js';

@Module({
  imports: [TypeOrmModule.forFeature([FgResto])],
  controllers: [FgMasterRestoController],
  exports: [TypeOrmModule],
})
export class FgMasterRestoModule {}
