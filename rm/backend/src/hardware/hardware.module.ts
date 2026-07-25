import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Barang } from '../master/barang/barang.entity';
import { Gudang } from '../master/gudang/gudang.entity';
import { HardwareController } from './hardware.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Barang, Gudang])],
  controllers: [HardwareController],
})
export class HardwareModule {}
