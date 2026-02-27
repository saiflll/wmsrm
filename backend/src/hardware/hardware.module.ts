import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Barang } from '../barang/barang.entity';
import { Gudang } from '../gudang/gudang.entity';
import { HardwareController } from './hardware.controller';

@Module({
    imports: [TypeOrmModule.forFeature([Barang, Gudang])],
    controllers: [HardwareController],
})
export class HardwareModule { }
