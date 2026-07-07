import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FgMutasi } from './fg-mutasi.entity.js';
import { FgMutasiService } from './fg-mutasi.service.js';
import { FgMutasiController } from './fg-mutasi.controller.js';

@Module({
  imports: [TypeOrmModule.forFeature([FgMutasi])],
  controllers: [FgMutasiController],
  providers: [FgMutasiService],
  exports: [FgMutasiService],
})
export class FgMutasiModule {}
